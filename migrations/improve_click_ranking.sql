-- Improve Click-Based Ranking
-- Changes click_count scoring from linear (capped at 30) to logarithmic (more nuanced)
-- Also adds click recency tracking for future use

-- ============= UPDATE OPTIMIZED_SEARCH FUNCTION =============
-- Replace the existing function with improved click scoring

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
  process_steps JSON,
  wait_times VARCHAR(255),
  required_docs JSON,
  phone VARCHAR(100),
  email VARCHAR(255),
  address TEXT,
  tags JSON,
  relevance_score FLOAT
) AS $$
DECLARE
  query_tsquery tsquery;
  query_lower TEXT;
  loc_filter TEXT;
BEGIN
  -- Normalize inputs
  query_lower := lower(trim(search_query));
  loc_filter := lower(trim(COALESCE(location_filter, '')));

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
          WHEN loc_filter != '' AND s.location_lower LIKE '%' || loc_filter || '%' THEN 60
          WHEN loc_filter != '' AND (s.location_lower LIKE '%alberta%' OR s.location_lower LIKE '%province%') THEN 30
          WHEN loc_filter != '' THEN -100  -- Penalty for wrong location
          ELSE 0
        END +

        -- IMPROVED: Logarithmic popularity boost (better scaling for popular services)
        -- Previously: LEAST(click_count * 2, 30) - capped too early
        -- Now: log scale that rewards popularity but doesn't dominate
        -- 1 click = 10pts, 10 clicks = 30pts, 100 clicks = 50pts, 1000 clicks = 70pts
        CASE
          WHEN COALESCE(s.click_count, 0) > 0 THEN
            LEAST(10 * LN(COALESCE(s.click_count, 0) + 1), 70)
          ELSE 0
        END +

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

-- ============= UPDATE LOCATION_SEARCH FUNCTION =============
-- Apply same improved click scoring

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
  process_steps JSON,
  wait_times VARCHAR(255),
  required_docs JSON,
  phone VARCHAR(100),
  email VARCHAR(255),
  address TEXT,
  tags JSON,
  relevance_score FLOAT
) AS $$
DECLARE
  loc_query TEXT;
BEGIN
  loc_query := lower(trim(location_query));

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
        WHEN s.location_lower LIKE '%' || loc_query || '%' THEN 100
        WHEN s.location_lower LIKE '%alberta%' OR s.location_lower LIKE '%province%' THEN 50
        ELSE 0
      END +
      -- IMPROVED: Logarithmic popularity boost
      CASE
        WHEN COALESCE(s.click_count, 0) > 0 THEN
          LEAST(10 * LN(COALESCE(s.click_count, 0) + 1), 70)
        ELSE 0
      END +
      -- Recency boost
      CASE
        WHEN s.last_updated > NOW() - INTERVAL '30 days' THEN 15
        WHEN s.last_updated > NOW() - INTERVAL '90 days' THEN 10
        ELSE 0
      END +
      -- Data completeness bonus
      CASE WHEN s.description IS NOT NULL AND length(s.description) > 50 THEN 20 ELSE 0 END +
      CASE WHEN s.website_url IS NOT NULL AND s.website_url != '' THEN 15 ELSE 0 END +
      CASE WHEN s.phone IS NOT NULL AND s.phone != '' THEN 10 ELSE 0 END +
      CASE WHEN s.process_steps IS NOT NULL AND json_array_length(s.process_steps) > 0 THEN 10 ELSE 0 END
    )::FLOAT as relevance_score
  FROM mv_service_search s
  WHERE
    s.location_lower LIKE '%' || loc_query || '%'
    OR s.location_lower LIKE '%alberta%'
    OR s.location_lower LIKE '%province%'
  ORDER BY relevance_score DESC
  LIMIT match_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============= ADD CLICK TRACKING IMPROVEMENTS =============
-- Add last_clicked timestamp for recency-weighted CTR (future enhancement)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'last_clicked'
  ) THEN
    ALTER TABLE services ADD COLUMN last_clicked TIMESTAMP;
  END IF;
END $$;

-- Function to increment click count with timestamp
CREATE OR REPLACE FUNCTION increment_service_click(p_service_id VARCHAR(255))
RETURNS void AS $$
BEGIN
  UPDATE services
  SET click_count = COALESCE(click_count, 0) + 1,
      last_clicked = NOW()
  WHERE service_id = p_service_id;
END;
$$ LANGUAGE plpgsql;
