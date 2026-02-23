-- Migration: Add Foreign Key Constraints
-- This migration adds referential integrity between tables
-- Run after ensuring all orphaned records are cleaned up

-- ============= SEARCH ANALYTICS =============
-- Add foreign key for clicked_service_id (nullable, SET NULL on delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_analytics_service'
    AND table_name = 'search_analytics'
  ) THEN
    -- First, clean up any orphaned references
    UPDATE search_analytics
    SET clicked_service_id = NULL
    WHERE clicked_service_id IS NOT NULL
    AND clicked_service_id NOT IN (SELECT service_id FROM services);

    -- Add the foreign key constraint
    ALTER TABLE search_analytics
    ADD CONSTRAINT fk_analytics_service
    FOREIGN KEY (clicked_service_id)
    REFERENCES services(service_id)
    ON DELETE SET NULL;

    RAISE NOTICE 'Added foreign key fk_analytics_service';
  ELSE
    RAISE NOTICE 'Foreign key fk_analytics_service already exists';
  END IF;
END $$;

-- Add index on clicked_service_id for faster joins
CREATE INDEX IF NOT EXISTS idx_analytics_clicked_service
ON search_analytics(clicked_service_id)
WHERE clicked_service_id IS NOT NULL;

-- ============= SERVICE ALIASES =============
-- Add foreign key for service_id (required, CASCADE on delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_alias_service'
    AND table_name = 'service_aliases'
  ) THEN
    -- First, clean up any orphaned references
    DELETE FROM service_aliases
    WHERE service_id NOT IN (SELECT service_id FROM services);

    -- Add the foreign key constraint
    ALTER TABLE service_aliases
    ADD CONSTRAINT fk_alias_service
    FOREIGN KEY (service_id)
    REFERENCES services(service_id)
    ON DELETE CASCADE;

    RAISE NOTICE 'Added foreign key fk_alias_service';
  ELSE
    RAISE NOTICE 'Foreign key fk_alias_service already exists';
  END IF;
END $$;

-- Remove duplicate aliases before adding unique constraint (keep the oldest one)
DELETE FROM service_aliases a
USING service_aliases b
WHERE a.id > b.id
  AND a.service_id = b.service_id
  AND lower(a.alias) = lower(b.alias);

-- Add unique constraint to prevent duplicate aliases for same service
CREATE UNIQUE INDEX IF NOT EXISTS uq_service_alias
ON service_aliases(service_id, lower(alias));

-- ============= AI SERVICE ENRICHMENTS =============
-- Add foreign key for service_id (required, CASCADE on delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_enrichment_service'
    AND table_name = 'ai_service_enrichments'
  ) THEN
    -- First, clean up any orphaned references
    DELETE FROM ai_service_enrichments
    WHERE service_id NOT IN (SELECT service_id FROM services);

    -- Add the foreign key constraint
    ALTER TABLE ai_service_enrichments
    ADD CONSTRAINT fk_enrichment_service
    FOREIGN KEY (service_id)
    REFERENCES services(service_id)
    ON DELETE CASCADE;

    RAISE NOTICE 'Added foreign key fk_enrichment_service';
  ELSE
    RAISE NOTICE 'Foreign key fk_enrichment_service already exists';
  END IF;
END $$;

-- ============= DEDUPLICATION LOG =============
-- Add foreign key for kept_service_id (required, SET NULL on delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_dedup_kept_service'
    AND table_name = 'deduplication_log'
  ) THEN
    -- Note: kept_service_id might reference deleted services, so we update to NULL
    UPDATE deduplication_log
    SET kept_service_id = 'DELETED'
    WHERE kept_service_id NOT IN (SELECT service_id FROM services);

    -- We don't add FK here since kept_service_id might reference deleted records
    -- This is intentional - the dedup log is historical
    RAISE NOTICE 'Skipped fk_dedup_kept_service - historical records may reference deleted services';
  END IF;
END $$;

-- Add index on kept_service_id for joins
CREATE INDEX IF NOT EXISTS idx_dedup_kept_service
ON deduplication_log(kept_service_id);

-- ============= SERVICE FEATURE ARCHIVE =============
-- Note: Archive table intentionally does NOT have FK constraints
-- as it stores historical data for deleted services

-- ============= VERIFY CONSTRAINTS =============
DO $$
DECLARE
  constraint_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
  AND table_schema = 'public'
  AND table_name IN ('search_analytics', 'service_aliases', 'ai_service_enrichments');

  RAISE NOTICE 'Total foreign key constraints added: %', constraint_count;
END $$;
