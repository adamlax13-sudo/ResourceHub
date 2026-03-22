/**
 * Add is_24_7 to optimized_search, fast_search, alias_search, and location_search return types.
 *
 * BUG: is_24_7 was present in the materialized view but never returned by the
 * SQL search functions. This meant the preference boost for "24/7 available"
 * could never use the DB boolean field — only weaker text-pattern matching.
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
    if (DRY_RUN) {
      console.log('[DRY RUN] Would update optimized_search, fast_search, alias_search, location_search to include is_24_7');
      console.log('Run with DRY_RUN=false to apply.');
      return;
    }

    await client.query('BEGIN');

    // Drop existing functions (return type is changing, can't just CREATE OR REPLACE)
    console.log('Dropping existing functions...');
    await client.query('DROP FUNCTION IF EXISTS fast_search(text, text, boolean, integer)');
    await client.query('DROP FUNCTION IF EXISTS optimized_search(text, text, integer)');
    await client.query('DROP FUNCTION IF EXISTS alias_search(text)');
    await client.query('DROP FUNCTION IF EXISTS location_search(text, integer)');

    // 1. Update optimized_search to include is_24_7 in CTE and output
    console.log('Updating optimized_search...');
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
        is_24_7 boolean,
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
            s.is_24_7, s.service_format, s.languages_supported,
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
          sc.gender_restriction, sc.age_group, sc.is_faith_based, sc.is_12_step,
          sc.is_24_7, sc.service_format, sc.languages_supported
        FROM scored sc
        WHERE sc.score > 0
        ORDER BY sc.score DESC
        LIMIT match_limit;
      END;
      $function$
    `);

    // 2. Update fast_search wrapper to include is_24_7
    console.log('Updating fast_search...');
    await client.query(`
      CREATE OR REPLACE FUNCTION fast_search(
        search_query text,
        detected_location text DEFAULT NULL,
        is_location_only boolean DEFAULT false,
        match_limit integer DEFAULT 50
      )
      RETURNS TABLE(
        service_id varchar, name varchar, category varchar, description text,
        location varchar, contact text, website_url text, eligibility text,
        process_steps json, wait_times varchar, required_docs json,
        phone varchar, email varchar, address text, tags json,
        relevance_score float, gender_restriction varchar,
        age_group varchar, is_faith_based boolean, is_12_step boolean,
        is_24_7 boolean,
        service_format varchar, languages_supported json
      )
      LANGUAGE plpgsql STABLE
      AS $function$
      BEGIN
        IF EXISTS (SELECT 1 FROM service_aliases WHERE lower(alias) = lower(trim(search_query))) THEN
          RETURN QUERY SELECT * FROM alias_search(search_query);
          RETURN;
        END IF;
        IF is_location_only AND detected_location IS NOT NULL THEN
          RETURN QUERY SELECT * FROM location_search(detected_location, match_limit);
          RETURN;
        END IF;
        RETURN QUERY SELECT * FROM optimized_search(search_query, detected_location, match_limit);
      END;
      $function$
    `);

    // 3. Update alias_search to include is_24_7
    console.log('Updating alias_search...');
    await client.query(`
      CREATE OR REPLACE FUNCTION alias_search(alias_query text)
      RETURNS TABLE(
        service_id varchar, name varchar, category varchar, description text,
        location varchar, contact text, website_url text, eligibility text,
        process_steps json, wait_times varchar, required_docs json,
        phone varchar, email varchar, address text, tags json,
        relevance_score float, gender_restriction varchar,
        age_group varchar, is_faith_based boolean, is_12_step boolean,
        is_24_7 boolean,
        service_format varchar, languages_supported json
      )
      LANGUAGE plpgsql STABLE
      AS $function$
      BEGIN
        RETURN QUERY
        SELECT
          s.service_id, s.name, s.category, s.description, s.location,
          s.contact, s.website_url, s.eligibility, s.process_steps,
          s.wait_times, s.required_docs, s.phone, s.email, s.address, s.tags,
          500.0 as relevance_score,
          s.gender_restriction, s.age_group, s.is_faith_based, s.is_12_step,
          s.is_24_7, s.service_format, s.languages_supported
        FROM mv_service_search s
        JOIN service_aliases a ON a.service_id = s.service_id
        WHERE lower(a.alias) = lower(trim(alias_query));
      END;
      $function$
    `);

    // 4. Update location_search to include is_24_7
    console.log('Updating location_search...');
    await client.query(`
      CREATE OR REPLACE FUNCTION location_search(location_query text, match_limit integer DEFAULT 100)
      RETURNS TABLE(
        service_id varchar, name varchar, category varchar, description text,
        location varchar, contact text, website_url text, eligibility text,
        process_steps json, wait_times varchar, required_docs json,
        phone varchar, email varchar, address text, tags json,
        relevance_score float, gender_restriction varchar,
        age_group varchar, is_faith_based boolean, is_12_step boolean,
        is_24_7 boolean,
        service_format varchar, languages_supported json
      )
      LANGUAGE plpgsql STABLE
      AS $function$
      DECLARE
        loc_query TEXT;
      BEGIN
        loc_query := lower(trim(location_query));
        RETURN QUERY
        SELECT
          s.service_id, s.name, s.category, s.description, s.location,
          s.contact, s.website_url, s.eligibility, s.process_steps,
          s.wait_times, s.required_docs, s.phone, s.email, s.address, s.tags,
          (
            CASE
              WHEN s.location_lower LIKE '%' || loc_query || '%' THEN 100
              WHEN s.location_lower LIKE '%alberta%' OR s.location_lower LIKE '%province%' THEN 50
              ELSE 0
            END +
            CASE
              WHEN COALESCE(s.click_count, 0) > 0 THEN LEAST(10 * LN(COALESCE(s.click_count, 0) + 1), 70)
              ELSE 0
            END +
            CASE
              WHEN s.last_updated > NOW() - INTERVAL '30 days' THEN 15
              WHEN s.last_updated > NOW() - INTERVAL '90 days' THEN 10
              ELSE 0
            END +
            CASE WHEN s.description IS NOT NULL AND length(s.description) > 50 THEN 20 ELSE 0 END +
            CASE WHEN s.website_url IS NOT NULL AND s.website_url != '' THEN 15 ELSE 0 END +
            CASE WHEN s.phone IS NOT NULL AND s.phone != '' THEN 10 ELSE 0 END +
            CASE WHEN s.process_steps IS NOT NULL AND json_array_length(s.process_steps) > 0 THEN 10 ELSE 0 END
          )::FLOAT as relevance_score,
          s.gender_restriction, s.age_group, s.is_faith_based, s.is_12_step,
          s.is_24_7, s.service_format, s.languages_supported
        FROM mv_service_search s
        WHERE
          s.location_lower LIKE '%' || loc_query || '%'
          OR s.location_lower LIKE '%alberta%'
          OR s.location_lower LIKE '%province%'
        ORDER BY relevance_score DESC
        LIMIT match_limit;
      END;
      $function$
    `);

    await client.query('COMMIT');

    // Verify
    const verify = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'services' AND column_name = 'is_24_7'
    `);
    console.log(verify.rows.length > 0
      ? '✓ All search functions updated to return is_24_7'
      : '✗ Verification failed');

    // Spot check
    const spot = await client.query(`
      SELECT service_id, name, is_24_7 FROM mv_service_search WHERE is_24_7 = true LIMIT 3
    `);
    console.log(`\nSpot check (${spot.rows.length} 24/7 services found):`);
    spot.rows.forEach(r => console.log(`  ${r.name}: is_24_7=${r.is_24_7}`));

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
