/**
 * Fix materialized view mv_service_search to include age_group, is_faith_based, is_12_step.
 *
 * BUG: The materialized view was missing these columns, so the optimized_search
 * function returned NULL for all three. This broke the hard filters — selecting
 * "adult" in the refinement panel had no effect because every SQL result had
 * age_group = NULL, which passes through the include-compatible filter.
 *
 * Changes:
 * 1. Recreate mv_service_search with age_group, is_faith_based, is_12_step
 * 2. Recreate all indexes (DROP CASCADE removes them)
 * 3. Update optimized_search to read from the view instead of returning NULL
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DRY_RUN = process.env.DRY_RUN !== 'false';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const client = await pool.connect();
  try {
    // Verify the bug exists
    const check = await client.query(`
      SELECT attname FROM pg_attribute
      WHERE attrelid = 'mv_service_search'::regclass AND attname = 'age_group' AND attnum > 0
    `);
    if (check.rows.length > 0) {
      console.log('✓ mv_service_search already has age_group column — no migration needed');
      return;
    }
    console.log('✗ mv_service_search is missing age_group — applying fix...');

    if (DRY_RUN) {
      console.log('\n[DRY RUN] Would execute the following changes:');
      console.log('  1. DROP MATERIALIZED VIEW mv_service_search CASCADE');
      console.log('  2. CREATE MATERIALIZED VIEW mv_service_search (with age_group, is_faith_based, is_12_step)');
      console.log('  3. Recreate 10 indexes');
      console.log('  4. UPDATE optimized_search function to use view columns');
      console.log('\nRun with DRY_RUN=false to apply.');
      return;
    }

    await client.query('BEGIN');

    // 1. Drop and recreate the materialized view with missing columns
    console.log('Dropping mv_service_search...');
    await client.query('DROP MATERIALIZED VIEW IF EXISTS mv_service_search CASCADE');

    console.log('Creating mv_service_search with filter columns...');
    await client.query(`
      CREATE MATERIALIZED VIEW mv_service_search AS
      SELECT
        id, service_id, name, category, description, location,
        contact, eligibility, phone, email, address,
        process_steps, wait_times, required_docs, hours_of_operation,
        languages_supported, service_format, website_url,
        confidence_score, is_active, last_checked, last_updated,
        tags, popularity_score, click_count,
        search_vector, is_24_7, gender_restriction,
        age_group, is_faith_based, is_12_step,
        latitude, longitude,
        lower(COALESCE(location, '')::text) AS location_lower,
        lower(COALESCE(name, '')::text || ' ' || COALESCE(category, '')::text || ' ' || COALESCE(description, '')) AS search_text_combined
      FROM services s
      WHERE is_active = true
    `);

    // 2. Recreate all indexes
    console.log('Recreating indexes...');
    await client.query('CREATE UNIQUE INDEX idx_mv_search_service_id ON mv_service_search (service_id)');
    await client.query('CREATE INDEX idx_mv_search_id ON mv_service_search (id)');
    await client.query('CREATE INDEX idx_mv_search_vector ON mv_service_search USING gin(search_vector)');
    await client.query('CREATE INDEX idx_mv_search_location ON mv_service_search (location_lower)');
    await client.query('CREATE INDEX idx_mv_search_text_trgm ON mv_service_search USING gin(search_text_combined gin_trgm_ops)');
    await client.query('CREATE INDEX idx_mv_search_name_trgm ON mv_service_search USING gin(name gin_trgm_ops)');
    await client.query('CREATE INDEX idx_mv_search_category ON mv_service_search (category)');
    await client.query('CREATE INDEX idx_mv_search_tags ON mv_service_search USING gin((tags::jsonb) jsonb_path_ops)');
    await client.query(`CREATE INDEX idx_mv_search_is_24_7 ON mv_service_search (is_24_7) WHERE is_24_7 = true`);
    await client.query(`CREATE INDEX idx_mv_search_gender ON mv_service_search (gender_restriction) WHERE gender_restriction IS NOT NULL`);

    // 3. Update optimized_search to use view columns instead of NULL
    console.log('Updating optimized_search function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION optimized_search(
        search_query text,
        detected_location text DEFAULT NULL,
        match_limit integer DEFAULT 50
      )
      RETURNS TABLE(
        service_id varchar, name varchar, category varchar, description text,
        location varchar, contact text, website_url text, eligibility text,
        process_steps json, wait_times varchar, required_docs json,
        phone varchar, email varchar, address text, tags json,
        relevance_score float, gender_restriction varchar,
        age_group varchar, is_faith_based boolean, is_12_step boolean,
        service_format varchar, languages_supported json
      )
      LANGUAGE plpgsql STABLE
      AS $function$
      DECLARE
        query_lower text := lower(trim(search_query));
        query_tsquery tsquery := plainto_tsquery('english', search_query);
        query_tsquery_or tsquery := to_tsquery('english',
          array_to_string(
            array(SELECT lexeme FROM unnest(tsvector_to_array(to_tsvector('english', search_query))) AS lexeme),
            ' | '
          )
        );
        loc_filter text := COALESCE(lower(trim(detected_location)), '');
      BEGIN
        RETURN QUERY
        WITH scored AS (
          SELECT
            s.service_id, s.name, s.category, s.description, s.location,
            s.contact, s.website_url, s.eligibility, s.process_steps,
            s.wait_times, s.required_docs, s.phone, s.email, s.address, s.tags,
            s.gender_restriction, s.age_group, s.is_faith_based, s.is_12_step,
            s.service_format, s.languages_supported,
            (
              COALESCE(ts_rank_cd(s.search_vector, query_tsquery_or, 32), 0) * 80 +
              COALESCE(ts_rank_cd(s.search_vector, query_tsquery, 32), 0) * 40 +
              COALESCE(similarity(s.search_text_combined, query_lower), 0) * 50 +
              CASE WHEN lower(s.name) LIKE '%' || query_lower || '%' THEN 80 ELSE 0 END +
              CASE WHEN lower(s.category) LIKE '%' || query_lower || '%' THEN 40 ELSE 0 END +
              CASE WHEN s.tags::text ILIKE '%' || query_lower || '%' THEN 30 ELSE 0 END +
              CASE
                WHEN loc_filter != '' AND s.location_lower LIKE '%' || loc_filter || '%' THEN 15
                WHEN loc_filter != '' AND (s.location_lower LIKE '%alberta%' OR s.location_lower LIKE '%province%') THEN 5
                WHEN loc_filter != '' THEN -30
                ELSE 0
              END +
              CASE
                WHEN COALESCE(s.click_count, 0) > 0 THEN LEAST(10 * LN(COALESCE(s.click_count, 0) + 1), 70)
                ELSE 0
              END +
              CASE
                WHEN s.last_updated > NOW() - INTERVAL '30 days' THEN 15
                WHEN s.last_updated > NOW() - INTERVAL '90 days' THEN 10
                WHEN s.last_updated < NOW() - INTERVAL '365 days' THEN -5
                ELSE 0
              END
            ) as score
          FROM mv_service_search s
          WHERE
            s.search_vector @@ query_tsquery_or
            OR s.search_text_combined % query_lower
            OR lower(s.name) LIKE '%' || query_lower || '%'
            OR s.tags::text ILIKE '%' || query_lower || '%'
        )
        SELECT
          sc.service_id, sc.name, sc.category, sc.description, sc.location,
          sc.contact, sc.website_url, sc.eligibility, sc.process_steps,
          sc.wait_times, sc.required_docs, sc.phone, sc.email, sc.address, sc.tags,
          sc.score as relevance_score,
          sc.gender_restriction,
          sc.age_group,
          sc.is_faith_based,
          sc.is_12_step,
          sc.service_format, sc.languages_supported
        FROM scored sc
        WHERE sc.score > 0
        ORDER BY sc.score DESC
        LIMIT match_limit;
      END;
      $function$
    `);

    await client.query('COMMIT');

    // Verify
    const verify = await client.query(`
      SELECT attname FROM pg_attribute
      WHERE attrelid = 'mv_service_search'::regclass AND attname = 'age_group' AND attnum > 0
    `);
    if (verify.rows.length > 0) {
      console.log('\n✓ Migration complete — mv_service_search now includes age_group, is_faith_based, is_12_step');
    } else {
      console.error('\n✗ Migration failed — age_group column not found');
    }

    // Spot-check: verify Hull Services youth service has age_group = 'youth'
    const spotCheck = await client.query(`
      SELECT service_id, name, age_group FROM mv_service_search
      WHERE name LIKE '%Hull Services%Youth%' LIMIT 2
    `);
    console.log('\nSpot check (should show age_group = youth):');
    spotCheck.rows.forEach(r => console.log(`  ${r.name}: age_group=${r.age_group}`));

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
