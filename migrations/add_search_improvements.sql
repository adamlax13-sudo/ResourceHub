-- Search Improvements Migration
-- Adds full-text search, trigram fuzzy matching, search analytics, and service aliases

-- ============= 1. ENABLE REQUIRED EXTENSIONS =============
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For fuzzy/typo matching

-- ============= 2. FULL-TEXT SEARCH =============
-- Add tsvector column for fast full-text search
ALTER TABLE services ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate search_vector with weighted content (name most important)
UPDATE services SET search_vector =
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(category, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(eligibility, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(notes, '')), 'D');

-- Create GIN index for fast full-text lookup
CREATE INDEX IF NOT EXISTS idx_services_search_vector ON services USING GIN(search_vector);

-- Create trigger to auto-update search_vector on insert/update
CREATE OR REPLACE FUNCTION services_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.eligibility, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.notes, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS services_search_update ON services;
CREATE TRIGGER services_search_update
  BEFORE INSERT OR UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION services_search_vector_update();

-- ============= 3. TRIGRAM INDEXES FOR FUZZY MATCHING =============
-- Enable fuzzy search on name and description
CREATE INDEX IF NOT EXISTS idx_services_name_trgm ON services USING GIN(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_services_desc_trgm ON services USING GIN(description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_services_category_trgm ON services USING GIN(category gin_trgm_ops);

-- ============= 4. POPULARITY/CLICK TRACKING ON SERVICES =============
ALTER TABLE services ADD COLUMN IF NOT EXISTS popularity_score INTEGER DEFAULT 0;
ALTER TABLE services ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;

-- ============= 5. SEARCH ANALYTICS TABLE =============
CREATE TABLE IF NOT EXISTS search_analytics (
  id SERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  clicked_service_id VARCHAR(255),
  click_position INTEGER,
  session_id VARCHAR(255),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_query ON search_analytics(normalized_query);
CREATE INDEX IF NOT EXISTS idx_analytics_clicked ON search_analytics(clicked_service_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON search_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON search_analytics(session_id);

-- ============= 6. SERVICE ALIASES TABLE =============
-- For handling acronyms, common names, and known misspellings
CREATE TABLE IF NOT EXISTS service_aliases (
  id SERIAL PRIMARY KEY,
  service_id VARCHAR(255) NOT NULL,
  alias VARCHAR(255) NOT NULL,
  alias_type VARCHAR(50) DEFAULT 'common_name', -- 'acronym', 'common_name', 'misspelling'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alias_name ON service_aliases(lower(alias));
CREATE INDEX IF NOT EXISTS idx_alias_service ON service_aliases(service_id);

-- ============= 7. SEED COMMON ALIASES =============
-- Insert aliases only for services that exist in the database
-- Using a safer approach that checks for existence
DO $$
BEGIN
  -- 988 Suicide Crisis Helpline aliases
  IF EXISTS (SELECT 1 FROM services WHERE service_id = '988-suicide-crisis-helpline') THEN
    INSERT INTO service_aliases (service_id, alias, alias_type) VALUES
      ('988-suicide-crisis-helpline', 'suicide hotline', 'common_name'),
      ('988-suicide-crisis-helpline', 'crisis line', 'common_name'),
      ('988-suicide-crisis-helpline', 'suicide prevention', 'common_name'),
      ('988-suicide-crisis-helpline', '988', 'acronym')
    ON CONFLICT DO NOTHING;
  END IF;

  -- 211 Alberta aliases
  IF EXISTS (SELECT 1 FROM services WHERE service_id = '211-alberta') THEN
    INSERT INTO service_aliases (service_id, alias, alias_type) VALUES
      ('211-alberta', '211', 'acronym'),
      ('211-alberta', 'two one one', 'common_name')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Try to find and alias CMHA services
  IF EXISTS (SELECT 1 FROM services WHERE name ILIKE '%CMHA%Calgary%' OR service_id ILIKE '%cmha%calgary%') THEN
    INSERT INTO service_aliases (service_id, alias, alias_type)
    SELECT service_id, 'CMHA', 'acronym'
    FROM services WHERE (name ILIKE '%CMHA%Calgary%' OR service_id ILIKE '%cmha%calgary%') AND is_active = true
    LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;

  -- Try to find and alias AA services
  IF EXISTS (SELECT 1 FROM services WHERE name ILIKE '%Alcoholics Anonymous%') THEN
    INSERT INTO service_aliases (service_id, alias, alias_type)
    SELECT service_id, 'AA', 'acronym'
    FROM services WHERE name ILIKE '%Alcoholics Anonymous%' AND is_active = true
    LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;

  -- Try to find and alias NA services
  IF EXISTS (SELECT 1 FROM services WHERE name ILIKE '%Narcotics Anonymous%') THEN
    INSERT INTO service_aliases (service_id, alias, alias_type)
    SELECT service_id, 'NA', 'acronym'
    FROM services WHERE name ILIKE '%Narcotics Anonymous%' AND is_active = true
    LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;

  -- Try to find and alias SMART Recovery services
  IF EXISTS (SELECT 1 FROM services WHERE name ILIKE '%SMART Recovery%') THEN
    INSERT INTO service_aliases (service_id, alias, alias_type)
    SELECT service_id, 'SMART', 'acronym'
    FROM services WHERE name ILIKE '%SMART Recovery%' AND is_active = true
    LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============= 8. FUNCTION FOR FUZZY SEARCH =============
-- Returns services matching a query with similarity scoring
CREATE OR REPLACE FUNCTION fuzzy_search_services(search_query TEXT, limit_count INTEGER DEFAULT 50)
RETURNS TABLE (
  service_id VARCHAR(255),
  name VARCHAR(500),
  similarity_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.service_id,
    s.name,
    GREATEST(
      similarity(s.name, search_query),
      similarity(COALESCE(s.description, ''), search_query) * 0.5,
      similarity(COALESCE(s.category, ''), search_query) * 0.7
    ) AS similarity_score
  FROM services s
  WHERE s.is_active = true
    AND (
      s.name % search_query
      OR s.description % search_query
      OR s.category % search_query
    )
  ORDER BY similarity_score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ============= 9. FUNCTION FOR FULL-TEXT SEARCH =============
CREATE OR REPLACE FUNCTION fulltext_search_services(search_query TEXT, limit_count INTEGER DEFAULT 50)
RETURNS TABLE (
  service_id VARCHAR(255),
  name VARCHAR(500),
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.service_id,
    s.name,
    ts_rank(s.search_vector, plainto_tsquery('english', search_query)) AS rank
  FROM services s
  WHERE s.is_active = true
    AND s.search_vector @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ============= 10. UPDATE POPULARITY SCORES =============
-- Run this periodically to update popularity based on clicks
CREATE OR REPLACE FUNCTION update_service_popularity() RETURNS void AS $$
BEGIN
  UPDATE services s SET
    click_count = COALESCE(clicks.cnt, 0),
    popularity_score = COALESCE(clicks.cnt, 0) * 10 +
                       COALESCE(s.confidence_score, 100) +
                       CASE WHEN s.website_url IS NOT NULL AND s.website_url != '' THEN 20 ELSE 0 END +
                       CASE WHEN s.contact IS NOT NULL AND s.contact != '' THEN 15 ELSE 0 END
  FROM (
    SELECT clicked_service_id, COUNT(*) as cnt
    FROM search_analytics
    WHERE clicked_service_id IS NOT NULL
    GROUP BY clicked_service_id
  ) clicks
  WHERE s.service_id = clicks.clicked_service_id;
END;
$$ LANGUAGE plpgsql;
