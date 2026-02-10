-- Migration: Remove Dead Columns (P1)
-- Removes: bookingUrl, dataSource, firstSeen, notes, searchText
-- CRITICAL: Updates search_vector trigger BEFORE dropping notes column

-- ============= STEP 1: Update search_vector trigger =============
-- Remove 'notes' from the search_vector calculation (was weight 'D')
-- This MUST happen before dropping the notes column

CREATE OR REPLACE FUNCTION services_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.eligibility, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============= STEP 2: Rebuild search_vector for all services =============
-- Recalculate without notes field

UPDATE services SET search_vector =
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(category, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(eligibility, '')), 'C');

-- ============= STEP 3: Drop dead columns from services table =============
-- These columns are never queried in the application

ALTER TABLE services DROP COLUMN IF EXISTS booking_url;
ALTER TABLE services DROP COLUMN IF EXISTS data_source;
ALTER TABLE services DROP COLUMN IF EXISTS first_seen;
ALTER TABLE services DROP COLUMN IF EXISTS notes;
ALTER TABLE services DROP COLUMN IF EXISTS search_text;

-- ============= STEP 4: Drop columns from service_history if exists =============

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_history') THEN
    ALTER TABLE service_history DROP COLUMN IF EXISTS booking_url;
    ALTER TABLE service_history DROP COLUMN IF EXISTS data_source;
  END IF;
END $$;

-- ============= STEP 5: Update materialized view if exists =============

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_service_search') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_service_search;
  END IF;
END $$;

-- ============= STEP 6: Update table statistics =============

ANALYZE services;

-- ============= VERIFICATION =============
-- Run this to verify columns were removed:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'services'
-- AND column_name IN ('booking_url', 'data_source', 'first_seen', 'notes', 'search_text');
-- Should return 0 rows
