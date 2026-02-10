-- Migration: Handle Duplicate Services
-- Deactivates duplicate services while keeping the best one from each group
-- Logs all changes for audit purposes

-- ============= STEP 1: Create deduplication log table =============

CREATE TABLE IF NOT EXISTS deduplication_log (
  id SERIAL PRIMARY KEY,
  kept_service_id VARCHAR(255) NOT NULL,
  removed_service_id VARCHAR(255) NOT NULL,
  duplicate_type VARCHAR(50) NOT NULL,
  match_value TEXT,
  reason TEXT,
  deduplicated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dedup_log_kept ON deduplication_log(kept_service_id);
CREATE INDEX IF NOT EXISTS idx_dedup_log_removed ON deduplication_log(removed_service_id);
CREATE INDEX IF NOT EXISTS idx_dedup_log_date ON deduplication_log(deduplicated_at);

-- ============= STEP 2: Identify and log exact name duplicates =============
-- First, log what will be deduplicated

INSERT INTO deduplication_log (kept_service_id, removed_service_id, duplicate_type, match_value, reason)
WITH ranked_duplicates AS (
  SELECT
    service_id,
    name,
    lower(trim(name)) as normalized_name,
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim(name))
      ORDER BY
        -- Prefer: more complete data, higher clicks, more recent
        (CASE WHEN description IS NOT NULL AND length(description) > 50 THEN 10 ELSE 0 END +
         CASE WHEN website_url IS NOT NULL AND website_url != '' THEN 5 ELSE 0 END +
         CASE WHEN phone IS NOT NULL AND phone != '' THEN 3 ELSE 0 END +
         CASE WHEN address IS NOT NULL AND address != '' THEN 2 ELSE 0 END +
         COALESCE(click_count, 0)) DESC,
        last_updated DESC NULLS LAST,
        id ASC
    ) as rank
  FROM services
  WHERE is_active = true
),
duplicates AS (
  SELECT
    normalized_name,
    MAX(CASE WHEN rank = 1 THEN service_id END) as kept_id,
    array_agg(service_id ORDER BY rank) as all_ids
  FROM ranked_duplicates
  GROUP BY normalized_name
  HAVING COUNT(*) > 1
)
SELECT
  d.kept_id,
  unnest(d.all_ids[2:]) as removed_id,
  'EXACT_NAME',
  d.normalized_name,
  'Deactivated during automated deduplication - kept service with most complete data'
FROM duplicates d;

-- ============= STEP 3: Deactivate duplicate services =============

UPDATE services s
SET
  is_active = FALSE,
  last_updated = CURRENT_TIMESTAMP
FROM deduplication_log dl
WHERE s.service_id = dl.removed_service_id
  AND dl.deduplicated_at > NOW() - INTERVAL '1 minute'
  AND s.is_active = true;

-- ============= STEP 4: Report deduplication results =============

DO $$
DECLARE
  deactivated_count INTEGER;
  duplicate_groups INTEGER;
BEGIN
  SELECT COUNT(*) INTO deactivated_count
  FROM deduplication_log
  WHERE deduplicated_at > NOW() - INTERVAL '1 minute';

  SELECT COUNT(DISTINCT kept_service_id) INTO duplicate_groups
  FROM deduplication_log
  WHERE deduplicated_at > NOW() - INTERVAL '1 minute';

  RAISE NOTICE 'Deduplication complete: % services deactivated from % duplicate groups',
    deactivated_count, duplicate_groups;
END $$;

-- ============= STEP 5: Refresh materialized view =============

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_service_search') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_service_search;
  END IF;
END $$;

-- ============= STEP 6: Update statistics =============

ANALYZE services;

-- ============= VERIFICATION =============
-- Check deduplication results:
-- SELECT duplicate_type, COUNT(*) as count FROM deduplication_log GROUP BY duplicate_type;
--
-- View what was deduplicated:
-- SELECT kept_service_id, removed_service_id, match_value
-- FROM deduplication_log
-- ORDER BY deduplicated_at DESC LIMIT 20;
--
-- Verify no more exact name duplicates:
-- SELECT lower(trim(name)), COUNT(*)
-- FROM services WHERE is_active = true
-- GROUP BY lower(trim(name)) HAVING COUNT(*) > 1;
-- Should return 0 rows
