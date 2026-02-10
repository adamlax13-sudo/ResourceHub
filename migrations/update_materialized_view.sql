-- Migration: Update Materialized View
-- Recreates mv_service_search without the removed columns
-- Run this AFTER all other migrations

-- ============= STEP 1: Drop existing materialized view =============

DROP MATERIALIZED VIEW IF EXISTS mv_service_search;

-- ============= STEP 2: Recreate materialized view =============
-- Excludes removed columns: booking_url, data_source, first_seen, notes, search_text
-- Excludes archived columns: service_type, eligibility_tags, demographic_tags, age_restriction, is_walk_in, requires_referral

CREATE MATERIALIZED VIEW mv_service_search AS
SELECT
  s.id,
  s.service_id,
  s.name,
  s.category,
  s.description,
  s.location,
  s.contact,
  s.eligibility,
  s.phone,
  s.email,
  s.address,
  s.process_steps,
  s.wait_times,
  s.required_docs,
  s.hours_of_operation,
  s.languages_supported,
  s.service_format,
  s.website_url,
  s.confidence_score,
  s.is_active,
  s.last_checked,
  s.last_updated,
  s.tags,
  s.popularity_score,
  s.click_count,
  s.search_vector,
  s.is_24_7,
  s.gender_restriction,
  -- Pre-computed search fields
  lower(COALESCE(s.location, '')) as location_lower,
  lower(COALESCE(s.name, '') || ' ' || COALESCE(s.category, '') || ' ' || COALESCE(s.description, '')) as search_text_combined
FROM services s
WHERE s.is_active = true;

-- ============= STEP 3: Recreate indexes =============

CREATE UNIQUE INDEX idx_mv_search_service_id ON mv_service_search(service_id);
CREATE INDEX idx_mv_search_id ON mv_service_search(id);
CREATE INDEX idx_mv_search_vector ON mv_service_search USING GIN(search_vector);
CREATE INDEX idx_mv_search_location ON mv_service_search(location_lower);
CREATE INDEX idx_mv_search_text_trgm ON mv_service_search USING GIN(search_text_combined gin_trgm_ops);
CREATE INDEX idx_mv_search_name_trgm ON mv_service_search USING GIN(name gin_trgm_ops);
CREATE INDEX idx_mv_search_category ON mv_service_search(category);
CREATE INDEX idx_mv_search_is_24_7 ON mv_service_search(is_24_7) WHERE is_24_7 = true;
CREATE INDEX idx_mv_search_gender ON mv_service_search(gender_restriction) WHERE gender_restriction IS NOT NULL;

-- Index for tags (JSONB)
CREATE INDEX idx_mv_search_tags ON mv_service_search USING GIN((tags::jsonb) jsonb_path_ops);

-- ============= STEP 4: Update refresh function =============

CREATE OR REPLACE FUNCTION refresh_search_view() RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_service_search;
END;
$$ LANGUAGE plpgsql;

-- ============= STEP 5: Update statistics =============

ANALYZE mv_service_search;

-- ============= VERIFICATION =============
-- Check materialized view exists and has data:
-- SELECT COUNT(*) FROM mv_service_search;
--
-- Check all indexes created:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'mv_service_search';
--
-- Test search still works:
-- SELECT * FROM mv_service_search WHERE search_text_combined ILIKE '%mental health%' LIMIT 5;
