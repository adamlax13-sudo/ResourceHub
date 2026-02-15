-- Search Quick Wins Migration
-- 1. Precomputed popular queries for instant results
-- 2. Failed query logging for coverage analysis

-- ============= PRECOMPUTED SEARCHES =============
-- Cache results for popular queries to serve instantly (<10ms)

CREATE TABLE IF NOT EXISTS precomputed_searches (
  query_normalized TEXT PRIMARY KEY,
  results JSONB NOT NULL,
  result_count INT NOT NULL DEFAULT 0,
  computed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_precomputed_computed_at
ON precomputed_searches(computed_at);

-- ============= FAILED QUERIES =============
-- Track queries that return zero results for analysis

CREATE TABLE IF NOT EXISTS failed_queries (
  id SERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  query_normalized TEXT NOT NULL,
  intent VARCHAR(50),
  location VARCHAR(255),
  count INT DEFAULT 1,
  first_seen TIMESTAMP DEFAULT NOW(),
  last_seen TIMESTAMP DEFAULT NOW()
);

-- Unique constraint on normalized query + location
CREATE UNIQUE INDEX IF NOT EXISTS idx_failed_queries_unique
ON failed_queries(query_normalized, COALESCE(location, ''));

-- Index for analysis queries
CREATE INDEX IF NOT EXISTS idx_failed_queries_count
ON failed_queries(count DESC);

CREATE INDEX IF NOT EXISTS idx_failed_queries_last_seen
ON failed_queries(last_seen DESC);

-- ============= HELPER FUNCTIONS =============

-- Get precomputed search results
CREATE OR REPLACE FUNCTION get_precomputed_search(search_query TEXT)
RETURNS TABLE (
  results JSONB,
  result_count INT,
  computed_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ps.results,
    ps.result_count,
    ps.computed_at
  FROM precomputed_searches ps
  WHERE ps.query_normalized = lower(trim(search_query))
    AND ps.computed_at > NOW() - INTERVAL '24 hours';  -- Only use if fresh
END;
$$ LANGUAGE plpgsql STABLE;

-- Upsert failed query (increment count if exists)
CREATE OR REPLACE FUNCTION log_failed_query(
  p_query TEXT,
  p_query_normalized TEXT,
  p_intent VARCHAR(50),
  p_location VARCHAR(255)
)
RETURNS void AS $$
BEGIN
  INSERT INTO failed_queries (query, query_normalized, intent, location)
  VALUES (p_query, p_query_normalized, p_intent, NULLIF(p_location, ''))
  ON CONFLICT (query_normalized, COALESCE(location, '')) DO UPDATE SET
    count = failed_queries.count + 1,
    last_seen = NOW();
END;
$$ LANGUAGE plpgsql;

-- Get top failed queries for analysis
CREATE OR REPLACE FUNCTION get_top_failed_queries(p_limit INT DEFAULT 50)
RETURNS TABLE (
  query TEXT,
  query_normalized TEXT,
  intent VARCHAR(50),
  location VARCHAR(255),
  count INT,
  first_seen TIMESTAMP,
  last_seen TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fq.query,
    fq.query_normalized,
    fq.intent,
    fq.location,
    fq.count,
    fq.first_seen,
    fq.last_seen
  FROM failed_queries fq
  ORDER BY fq.count DESC, fq.last_seen DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
