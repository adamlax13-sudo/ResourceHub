-- Optimized Search Migration
-- Replaces in-memory filtering with index-backed SQL queries
-- Two-stage search: fast SQL ranking, then optional AI enhancement

-- ============= 1. ADDITIONAL INDEXES FOR PERFORMANCE =============

-- Composite index for active services with location (common filter)
CREATE INDEX IF NOT EXISTS idx_services_active_location
ON services(is_active, lower(location))
WHERE is_active = true;

-- Partial index for active services only (smaller, faster)
CREATE INDEX IF NOT EXISTS idx_services_active
ON services(service_id)
WHERE is_active = true;

-- Index for tags - for tag-based filtering
-- Note: tags is JSON type, cast to JSONB for indexing
CREATE INDEX IF NOT EXISTS idx_services_tags
ON services USING GIN((tags::jsonb) jsonb_path_ops);

-- Composite index for sorting by quality metrics
CREATE INDEX IF NOT EXISTS idx_services_ranking
ON services(is_active, click_count DESC, popularity_score DESC, last_updated DESC)
WHERE is_active = true;

-- ============= 2. MATERIALIZED VIEW FOR SEARCH =============
-- Pre-compute searchable text + location for faster queries
-- Refresh after scraper runs

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_service_search AS
SELECT
  s.service_id,
  s.name,
  s.category,
  s.description,
  s.location,
  s.contact,
  s.website_url,
  s.eligibility,
  s.process_steps,
  s.wait_times,
  s.required_docs,
  s.phone,
  s.email,
  s.address,
  s.tags,
  s.click_count,
  s.popularity_score,
  s.last_updated,
  s.search_vector,
  -- Pre-compute lowercase location for filtering
  lower(COALESCE(s.location, '')) as location_lower,
  -- Combined text for trigram search
  lower(COALESCE(s.name, '') || ' ' || COALESCE(s.category, '') || ' ' || COALESCE(s.description, '')) as search_text_combined
FROM services s
WHERE s.is_active = true;

-- Indexes on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_search_service_id ON mv_service_search(service_id);
CREATE INDEX IF NOT EXISTS idx_mv_search_vector ON mv_service_search USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_mv_search_location ON mv_service_search(location_lower);
CREATE INDEX IF NOT EXISTS idx_mv_search_text_trgm ON mv_service_search USING GIN(search_text_combined gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_mv_search_tags ON mv_service_search USING GIN((tags::jsonb) jsonb_path_ops);

-- Function to refresh materialized view (call after scraper)
CREATE OR REPLACE FUNCTION refresh_search_view() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_service_search;
END;
$$ LANGUAGE plpgsql;

-- ============= 3. OPTIMIZED SEARCH FUNCTION =============
-- Single SQL query that uses all indexes, returns ranked results
-- Supports: full-text, trigram fuzzy, location filtering, tag matching

CREATE OR REPLACE FUNCTION optimized_search(
  search_query TEXT,
  location_filter TEXT DEFAULT NULL,
  match_limit INT DEFAULT 50
)
RETURNS TABLE (
  service_id VARCHAR(255),
  name VARCHAR(500),
  category VARCHAR(255),
  description TEXT,
  location VARCHAR(500),
  contact TEXT,
  website_url TEXT,
  eligibility TEXT,
  process_steps JSONB,
  wait_times VARCHAR(255),
  required_docs JSONB,
  phone VARCHAR(100),
  email VARCHAR(255),
  address TEXT,
  tags JSONB,
  relevance_score FLOAT
) AS $$
DECLARE
  query_tsquery tsquery;
  query_lower TEXT;
  location_lower TEXT;
BEGIN
  -- Normalize inputs
  query_lower := lower(trim(search_query));
  location_lower := lower(trim(COALESCE(location_filter, '')));

  -- Build tsquery for full-text search (handles multi-word queries)
  query_tsquery := plainto_tsquery('english', search_query);

  RETURN QUERY
  WITH scored AS (
    SELECT
      s.service_id,
      s.name,
      s.category,
      s.description,
      s.location,
      s.contact,
      s.website_url,
      s.eligibility,
      s.process_steps,
      s.wait_times,
      s.required_docs,
      s.phone,
      s.email,
      s.address,
      s.tags,
      (
        -- Full-text search score (0-1, weighted by field importance)
        COALESCE(ts_rank_cd(s.search_vector, query_tsquery, 32), 0) * 100 +

        -- Trigram similarity for fuzzy matching (handles typos)
        COALESCE(similarity(s.search_text_combined, query_lower), 0) * 50 +

        -- Exact name match bonus
        CASE WHEN lower(s.name) LIKE '%' || query_lower || '%' THEN 80 ELSE 0 END +

        -- Exact category match bonus
        CASE WHEN lower(s.category) LIKE '%' || query_lower || '%' THEN 40 ELSE 0 END +

        -- Tag match bonus (check if any tag contains the query)
        CASE WHEN s.tags::text ILIKE '%' || query_lower || '%' THEN 30 ELSE 0 END +

        -- Location match bonus
        CASE
          WHEN location_lower != '' AND s.location_lower LIKE '%' || location_lower || '%' THEN 60
          WHEN location_lower != '' AND (s.location_lower LIKE '%alberta%' OR s.location_lower LIKE '%province%') THEN 30
          WHEN location_lower != '' THEN -100  -- Penalty for wrong location
          ELSE 0
        END +

        -- Popularity boost (capped)
        LEAST(COALESCE(s.click_count, 0) * 2, 30) +

        -- Recency boost
        CASE
          WHEN s.last_updated > NOW() - INTERVAL '30 days' THEN 15
          WHEN s.last_updated > NOW() - INTERVAL '90 days' THEN 10
          WHEN s.last_updated < NOW() - INTERVAL '365 days' THEN -5
          ELSE 0
        END
      ) as score
    FROM mv_service_search s
    WHERE
      -- Must match at least one search criteria
      (
        s.search_vector @@ query_tsquery  -- Full-text match
        OR s.search_text_combined % query_lower  -- Trigram similarity > threshold
        OR lower(s.name) LIKE '%' || query_lower || '%'  -- Name contains query
        OR s.tags::text ILIKE '%' || query_lower || '%'  -- Tag match
      )
  )
  SELECT
    sc.service_id,
    sc.name,
    sc.category,
    sc.description,
    sc.location,
    sc.contact,
    sc.website_url,
    sc.eligibility,
    sc.process_steps,
    sc.wait_times,
    sc.required_docs,
    sc.phone,
    sc.email,
    sc.address,
    sc.tags,
    sc.score as relevance_score
  FROM scored sc
  WHERE sc.score > 0  -- Only positive scores
  ORDER BY sc.score DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============= 4. LOCATION-ONLY SEARCH FUNCTION =============
-- For queries like "calgary" or "fort mcmurray" without topic keywords
-- Returns all services in that location, ranked by quality

CREATE OR REPLACE FUNCTION location_search(
  location_query TEXT,
  match_limit INT DEFAULT 100
)
RETURNS TABLE (
  service_id VARCHAR(255),
  name VARCHAR(500),
  category VARCHAR(255),
  description TEXT,
  location VARCHAR(500),
  contact TEXT,
  website_url TEXT,
  eligibility TEXT,
  process_steps JSONB,
  wait_times VARCHAR(255),
  required_docs JSONB,
  phone VARCHAR(100),
  email VARCHAR(255),
  address TEXT,
  tags JSONB,
  relevance_score FLOAT
) AS $$
DECLARE
  location_lower TEXT;
BEGIN
  location_lower := lower(trim(location_query));

  RETURN QUERY
  SELECT
    s.service_id,
    s.name,
    s.category,
    s.description,
    s.location,
    s.contact,
    s.website_url,
    s.eligibility,
    s.process_steps,
    s.wait_times,
    s.required_docs,
    s.phone,
    s.email,
    s.address,
    s.tags,
    (
      -- Location match score
      CASE
        WHEN s.location_lower LIKE '%' || location_lower || '%' THEN 100
        WHEN s.location_lower LIKE '%alberta%' OR s.location_lower LIKE '%province%' THEN 50
        ELSE 0
      END +
      -- Quality metrics
      LEAST(COALESCE(s.click_count, 0) * 2, 30) +
      CASE
        WHEN s.last_updated > NOW() - INTERVAL '30 days' THEN 15
        WHEN s.last_updated > NOW() - INTERVAL '90 days' THEN 10
        ELSE 0
      END +
      -- Data completeness bonus
      CASE WHEN s.description IS NOT NULL AND length(s.description) > 50 THEN 20 ELSE 0 END +
      CASE WHEN s.website_url IS NOT NULL AND s.website_url != '' THEN 15 ELSE 0 END +
      CASE WHEN s.phone IS NOT NULL AND s.phone != '' THEN 10 ELSE 0 END +
      CASE WHEN s.process_steps IS NOT NULL AND jsonb_array_length(s.process_steps) > 0 THEN 10 ELSE 0 END
    )::FLOAT as relevance_score
  FROM mv_service_search s
  WHERE
    s.location_lower LIKE '%' || location_lower || '%'
    OR s.location_lower LIKE '%alberta%'
    OR s.location_lower LIKE '%province%'
  ORDER BY relevance_score DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============= 5. ALIAS SEARCH FUNCTION =============
-- Fast lookup by service alias (CMHA, AA, NA, etc.)

CREATE OR REPLACE FUNCTION alias_search(
  alias_query TEXT
)
RETURNS TABLE (
  service_id VARCHAR(255),
  name VARCHAR(500),
  category VARCHAR(255),
  description TEXT,
  location VARCHAR(500),
  contact TEXT,
  website_url TEXT,
  eligibility TEXT,
  process_steps JSONB,
  wait_times VARCHAR(255),
  required_docs JSONB,
  phone VARCHAR(100),
  email VARCHAR(255),
  address TEXT,
  tags JSONB,
  relevance_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.service_id,
    s.name,
    s.category,
    s.description,
    s.location,
    s.contact,
    s.website_url,
    s.eligibility,
    s.process_steps,
    s.wait_times,
    s.required_docs,
    s.phone,
    s.email,
    s.address,
    s.tags,
    500.0 as relevance_score  -- High score for alias matches
  FROM mv_service_search s
  JOIN service_aliases a ON a.service_id = s.service_id
  WHERE lower(a.alias) = lower(trim(alias_query));
END;
$$ LANGUAGE plpgsql STABLE;

-- ============= 6. COMBINED FAST SEARCH =============
-- Single entry point that chooses the right search strategy

CREATE OR REPLACE FUNCTION fast_search(
  search_query TEXT,
  detected_location TEXT DEFAULT NULL,
  is_location_only BOOLEAN DEFAULT FALSE,
  match_limit INT DEFAULT 50
)
RETURNS TABLE (
  service_id VARCHAR(255),
  name VARCHAR(500),
  category VARCHAR(255),
  description TEXT,
  location VARCHAR(500),
  contact TEXT,
  website_url TEXT,
  eligibility TEXT,
  process_steps JSONB,
  wait_times VARCHAR(255),
  required_docs JSONB,
  phone VARCHAR(100),
  email VARCHAR(255),
  address TEXT,
  tags JSONB,
  relevance_score FLOAT
) AS $$
BEGIN
  -- First, check for alias match
  IF EXISTS (SELECT 1 FROM service_aliases WHERE lower(alias) = lower(trim(search_query))) THEN
    RETURN QUERY SELECT * FROM alias_search(search_query);
    RETURN;
  END IF;

  -- Location-only query
  IF is_location_only AND detected_location IS NOT NULL THEN
    RETURN QUERY SELECT * FROM location_search(detected_location, match_limit);
    RETURN;
  END IF;

  -- Regular search with optional location filter
  RETURN QUERY SELECT * FROM optimized_search(search_query, detected_location, match_limit);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============= 7. BATCH ENRICHMENT LOOKUP =============
-- Single query to get all enrichments for a list of service IDs
-- Avoids N+1 queries

CREATE OR REPLACE FUNCTION get_enrichments_batch(
  service_ids VARCHAR(255)[]
)
RETURNS TABLE (
  service_id VARCHAR(255),
  service_name VARCHAR(500),
  ai_description TEXT,
  ai_category VARCHAR(255),
  ai_process_steps JSONB,
  ai_eligibility TEXT,
  ai_wait_times VARCHAR(255),
  ai_required_docs JSONB,
  ai_location TEXT,
  ai_contact TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.service_id,
    e.service_name,
    e.ai_description,
    e.ai_category,
    e.ai_process_steps,
    e.ai_eligibility,
    e.ai_wait_times,
    e.ai_required_docs,
    e.ai_location,
    e.ai_contact
  FROM ai_service_enrichments e
  WHERE e.service_id = ANY(service_ids);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============= 8. ANALYZE TABLES =============
-- Update statistics for query planner
ANALYZE services;
ANALYZE service_aliases;
ANALYZE ai_service_enrichments;
