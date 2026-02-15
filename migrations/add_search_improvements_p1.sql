-- Search Improvements P1/P2 Migration
-- Adds: Query-Service Affinity, Search Quality Metrics, Phonetic Index

-- ============= QUERY-SERVICE AFFINITY =============
-- Learn which services perform best for which query patterns
CREATE TABLE IF NOT EXISTS query_service_affinity (
  id SERIAL PRIMARY KEY,
  query_pattern TEXT NOT NULL,        -- Normalized pattern: "addiction", "shelter calgary"
  service_id VARCHAR(255) NOT NULL,
  click_count INT DEFAULT 0,
  impression_count INT DEFAULT 0,
  affinity_score FLOAT DEFAULT 0,     -- click_count / impression_count * recency
  last_clicked TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(query_pattern, service_id)
);

CREATE INDEX IF NOT EXISTS idx_affinity_pattern ON query_service_affinity(query_pattern);
CREATE INDEX IF NOT EXISTS idx_affinity_score ON query_service_affinity(affinity_score DESC);

-- Function to update affinity on click
CREATE OR REPLACE FUNCTION update_query_affinity(
  p_query_pattern TEXT,
  p_service_id VARCHAR(255)
) RETURNS void AS $$
BEGIN
  INSERT INTO query_service_affinity (query_pattern, service_id, click_count, last_clicked)
  VALUES (p_query_pattern, p_service_id, 1, NOW())
  ON CONFLICT (query_pattern, service_id) DO UPDATE SET
    click_count = query_service_affinity.click_count + 1,
    last_clicked = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to record impressions (called when services appear in results)
CREATE OR REPLACE FUNCTION record_query_impressions(
  p_query_pattern TEXT,
  p_service_ids VARCHAR(255)[]
) RETURNS void AS $$
BEGIN
  INSERT INTO query_service_affinity (query_pattern, service_id, impression_count)
  SELECT p_query_pattern, unnest(p_service_ids), 1
  ON CONFLICT (query_pattern, service_id) DO UPDATE SET
    impression_count = query_service_affinity.impression_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to compute affinity scores (run periodically via cron or after N clicks)
CREATE OR REPLACE FUNCTION compute_affinity_scores() RETURNS void AS $$
BEGIN
  UPDATE query_service_affinity
  SET affinity_score =
    CASE
      WHEN impression_count > 5 THEN
        (click_count::float / impression_count) *
        EXP(-EXTRACT(EPOCH FROM (NOW() - COALESCE(last_clicked, updated_at))) / (30 * 86400))
      ELSE 0
    END;
END;
$$ LANGUAGE plpgsql;

-- ============= SEARCH QUALITY METRICS =============
-- Track search quality signals for optimization and A/B testing
CREATE TABLE IF NOT EXISTS search_quality_metrics (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255),
  query TEXT NOT NULL,
  query_normalized TEXT NOT NULL,
  result_count INT NOT NULL,
  first_click_position INT,           -- Position of first clicked result (1-indexed)
  click_count INT DEFAULT 0,          -- Total clicks on this search
  dwell_time_ms INT,                  -- Time spent on clicked service page
  reformulated BOOLEAN DEFAULT FALSE, -- Did user search again within 30s?
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quality_session ON search_quality_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_quality_created ON search_quality_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quality_query ON search_quality_metrics(query_normalized);

-- Function to get quality report
CREATE OR REPLACE FUNCTION get_search_quality_report(p_days INT DEFAULT 7)
RETURNS TABLE (
  total_searches BIGINT,
  avg_first_click FLOAT,
  reformulation_rate FLOAT,
  zero_result_rate FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_searches,
    AVG(first_click_position)::FLOAT as avg_first_click,
    AVG(CASE WHEN reformulated THEN 1 ELSE 0 END)::FLOAT as reformulation_rate,
    AVG(CASE WHEN result_count = 0 THEN 1 ELSE 0 END)::FLOAT as zero_result_rate
  FROM search_quality_metrics
  WHERE created_at > NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============= PHONETIC INDEX =============
-- Add column for precomputed phonetic codes (for fast matching)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'name_phonetic'
  ) THEN
    ALTER TABLE services ADD COLUMN name_phonetic TEXT;
  END IF;
END $$;
