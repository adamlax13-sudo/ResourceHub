#!/usr/bin/env node
/**
 * Compute Click-Through Affinities
 *
 * Analyzes search_analytics click data and service_votes to compute
 * per-(query, service) affinity scores. These scores are used to boost
 * services that users consistently find helpful for specific queries.
 *
 * Run weekly via cron or manually:
 *   node scripts/compute-click-affinities.mjs
 *   DRY_RUN=false node scripts/compute-click-affinities.mjs  # actually write
 *
 * Requires DATABASE_URL in env.
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DRY_RUN = process.env.DRY_RUN !== 'false';
const MIN_CLICKS = 2; // Minimum clicks for a query-service pair to be included

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log(`Computing click-through affinities (DRY_RUN=${DRY_RUN})`);

  // Step 1: Compute click scores from search_analytics
  // For each (normalized_query, clicked_service_id) pair:
  //   click_score = clicks / total_clicks_for_query * position_weight
  const clickData = await pool.query(`
    WITH query_clicks AS (
      SELECT
        normalized_query,
        clicked_service_id,
        COUNT(*) as click_count,
        AVG(CASE
          WHEN click_position <= 3 THEN 1.0
          WHEN click_position <= 5 THEN 0.8
          WHEN click_position <= 10 THEN 0.5
          ELSE 0.3
        END) as avg_position_weight
      FROM search_analytics
      WHERE clicked_service_id IS NOT NULL
        AND normalized_query IS NOT NULL
        AND created_at > NOW() - INTERVAL '90 days'
      GROUP BY normalized_query, clicked_service_id
      HAVING COUNT(*) >= $1
    ),
    query_totals AS (
      SELECT normalized_query, SUM(click_count) as total_clicks
      FROM query_clicks
      GROUP BY normalized_query
    )
    SELECT
      qc.normalized_query,
      qc.clicked_service_id as service_id,
      qc.click_count,
      qt.total_clicks,
      ROUND((qc.click_count::numeric / qt.total_clicks * qc.avg_position_weight)::numeric, 4) as click_score
    FROM query_clicks qc
    JOIN query_totals qt ON qt.normalized_query = qc.normalized_query
    ORDER BY click_score DESC
  `, [MIN_CLICKS]);

  console.log(`Found ${clickData.rows.length} query-service click pairs`);

  // Step 2: Compute vote scores from service_votes
  const voteData = await pool.query(`
    SELECT
      LOWER(TRIM(query_context)) as normalized_query,
      service_id,
      SUM(CASE WHEN vote = 'up' THEN 1 ELSE 0 END) as upvotes,
      SUM(CASE WHEN vote = 'down' THEN 1 ELSE 0 END) as downvotes,
      ROUND(
        SUM(CASE WHEN vote = 'up' THEN 1 ELSE 0 END)::numeric /
        NULLIF(COUNT(*)::numeric, 0),
        4
      ) as vote_score
    FROM service_votes
    WHERE query_context IS NOT NULL
      AND query_context != ''
    GROUP BY LOWER(TRIM(query_context)), service_id
  `);

  console.log(`Found ${voteData.rows.length} query-service vote pairs`);

  // Step 3: Merge click + vote data
  const affinities = new Map();

  for (const row of clickData.rows) {
    const key = `${row.normalized_query}||${row.service_id}`;
    affinities.set(key, {
      normalizedQuery: row.normalized_query,
      serviceId: row.service_id,
      clickScore: parseFloat(row.click_score) || 0,
      voteScore: 0,
    });
  }

  for (const row of voteData.rows) {
    if (!row.normalized_query) continue;
    const key = `${row.normalized_query}||${row.service_id}`;
    if (affinities.has(key)) {
      affinities.get(key).voteScore = parseFloat(row.vote_score) || 0;
    } else {
      affinities.set(key, {
        normalizedQuery: row.normalized_query,
        serviceId: row.service_id,
        clickScore: 0,
        voteScore: parseFloat(row.vote_score) || 0,
      });
    }
  }

  console.log(`Total merged affinities: ${affinities.size}`);

  if (DRY_RUN) {
    console.log('\nTop 20 affinities (DRY RUN):');
    const sorted = [...affinities.values()].sort((a, b) => (b.clickScore + b.voteScore) - (a.clickScore + a.voteScore));
    for (const a of sorted.slice(0, 20)) {
      console.log(`  "${a.normalizedQuery}" → ${a.serviceId}: click=${a.clickScore}, vote=${a.voteScore}`);
    }
    console.log('\nRun with DRY_RUN=false to write to database.');
    await pool.end();
    process.exit(0);
  }

  // Step 4: Write to database (atomic — all or nothing)
  // Table must exist first — run `npm run db:push` if not yet created
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Use DELETE instead of TRUNCATE to avoid brief empty-table window
    // that could be cached as "no affinity" by the LRU cache (1hr TTL)
    await client.query('DELETE FROM query_service_affinities');

    let inserted = 0;
    for (const a of affinities.values()) {
      await client.query(
        `INSERT INTO query_service_affinities (normalized_query, service_id, click_score, vote_score)
         VALUES ($1, $2, $3, $4)`,
        [a.normalizedQuery, a.serviceId, a.clickScore, a.voteScore]
      );
      inserted++;
    }

    await client.query('COMMIT');
    console.log(`Inserted ${inserted} affinity records.`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }

  await pool.end();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
