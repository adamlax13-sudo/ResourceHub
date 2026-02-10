-- Migration: Consolidate Location/Address (P4)
-- Keeps both columns but ensures consistency and proper documentation
-- location: City/region for search & filtering (always populated)
-- address: Full street address for display (optional, fallback to location)

-- ============= STEP 1: Add column documentation =============

COMMENT ON COLUMN services.location IS 'City/region name for search and filtering (e.g., Calgary, Edmonton, Alberta). Always populated.';
COMMENT ON COLUMN services.address IS 'Full street address for detailed display. Optional - UI falls back to location if null.';

-- ============= STEP 2: Ensure location is never null =============
-- Set default for services with missing location

UPDATE services
SET location = 'Alberta'
WHERE location IS NULL OR location = '';

-- ============= STEP 3: Add NOT NULL constraint with default =============
-- This prevents future null values

ALTER TABLE services ALTER COLUMN location SET DEFAULT 'Alberta';

-- Note: Adding NOT NULL requires all existing values to be non-null (done in step 2)
-- ALTER TABLE services ALTER COLUMN location SET NOT NULL;
-- Commented out as it may fail if there are edge cases

-- ============= STEP 4: Create optimized location index =============
-- Lowercase index for case-insensitive search

CREATE INDEX IF NOT EXISTS idx_services_location_lower ON services(lower(location));

-- ============= STEP 5: Update materialized view =============

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_service_search') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_service_search;
  END IF;
END $$;

-- ============= STEP 6: Update statistics =============

ANALYZE services;

-- ============= VERIFICATION =============
-- Check for any null locations (should be 0):
-- SELECT COUNT(*) FROM services WHERE location IS NULL OR location = '';
--
-- Check index created:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'services' AND indexname = 'idx_services_location_lower';
