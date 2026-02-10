-- Migration: Archive Feature Columns (P2)
-- Archives: serviceType, eligibilityTags, demographicTags, ageRestriction, isWalkIn, requiresReferral
-- These columns are populated by scraper but never queried - text pattern matching is used instead

-- ============= STEP 1: Create archive table =============
-- Stores feature data for potential future use

CREATE TABLE IF NOT EXISTS service_feature_archive (
  id SERIAL PRIMARY KEY,
  service_id VARCHAR(255) NOT NULL,
  service_type VARCHAR(100),
  eligibility_tags JSONB DEFAULT '[]',
  demographic_tags JSONB DEFAULT '[]',
  age_restriction VARCHAR(100),
  is_walk_in BOOLEAN DEFAULT FALSE,
  requires_referral BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_service_feature_archive_service
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE CASCADE,
  CONSTRAINT uq_service_feature_archive_service_id UNIQUE (service_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_archive_service_id ON service_feature_archive(service_id);

-- ============= STEP 2: Copy data to archive =============
-- Only archive services that have data in these columns

INSERT INTO service_feature_archive (
  service_id,
  service_type,
  eligibility_tags,
  demographic_tags,
  age_restriction,
  is_walk_in,
  requires_referral
)
SELECT
  service_id,
  service_type,
  COALESCE(eligibility_tags, '[]'::jsonb),
  COALESCE(demographic_tags, '[]'::jsonb),
  age_restriction,
  COALESCE(is_walk_in, false),
  COALESCE(requires_referral, false)
FROM services
WHERE is_active = true
  AND (
    service_type IS NOT NULL
    OR (eligibility_tags IS NOT NULL AND eligibility_tags != '[]'::jsonb)
    OR (demographic_tags IS NOT NULL AND demographic_tags != '[]'::jsonb)
    OR age_restriction IS NOT NULL
    OR is_walk_in = true
    OR requires_referral = true
  )
ON CONFLICT (service_id) DO UPDATE SET
  service_type = EXCLUDED.service_type,
  eligibility_tags = EXCLUDED.eligibility_tags,
  demographic_tags = EXCLUDED.demographic_tags,
  age_restriction = EXCLUDED.age_restriction,
  is_walk_in = EXCLUDED.is_walk_in,
  requires_referral = EXCLUDED.requires_referral,
  archived_at = CURRENT_TIMESTAMP;

-- ============= STEP 3: Drop indexes on archived columns =============
-- These indexes are no longer needed

DROP INDEX IF EXISTS idx_service_type;
DROP INDEX IF EXISTS idx_eligibility_tags;
DROP INDEX IF EXISTS idx_demographic_tags;

-- ============= STEP 4: Drop columns from main table =============
-- Keep is_24_7 and gender_restriction as they ARE used in search

ALTER TABLE services DROP COLUMN IF EXISTS service_type;
ALTER TABLE services DROP COLUMN IF EXISTS eligibility_tags;
ALTER TABLE services DROP COLUMN IF EXISTS demographic_tags;
ALTER TABLE services DROP COLUMN IF EXISTS age_restriction;
ALTER TABLE services DROP COLUMN IF EXISTS is_walk_in;
ALTER TABLE services DROP COLUMN IF EXISTS requires_referral;

-- ============= STEP 5: Refresh materialized view =============

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_service_search') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_service_search;
  END IF;
END $$;

-- ============= STEP 6: Update statistics =============

ANALYZE services;
ANALYZE service_feature_archive;

-- ============= STEP 7: Create backward-compatibility view (optional) =============
-- Uncomment if you need to query with the old column structure

-- CREATE OR REPLACE VIEW v_services_with_features AS
-- SELECT
--   s.*,
--   fa.service_type,
--   fa.eligibility_tags,
--   fa.demographic_tags,
--   fa.age_restriction,
--   fa.is_walk_in,
--   fa.requires_referral
-- FROM services s
-- LEFT JOIN service_feature_archive fa ON s.service_id = fa.service_id;

-- ============= VERIFICATION =============
-- Check archived data:
-- SELECT COUNT(*) FROM service_feature_archive;
--
-- Verify columns removed:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'services'
-- AND column_name IN ('service_type', 'eligibility_tags', 'demographic_tags', 'age_restriction', 'is_walk_in', 'requires_referral');
-- Should return 0 rows
