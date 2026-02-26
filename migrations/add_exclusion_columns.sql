-- migrations/add_exclusion_columns.sql
-- Add boolean columns for exclusion-based filtering

ALTER TABLE services
ADD COLUMN IF NOT EXISTS is_faith_based BOOLEAN DEFAULT false;

ALTER TABLE services
ADD COLUMN IF NOT EXISTS is_12_step BOOLEAN DEFAULT false;

-- Partial indexes for fast filtering (only index true values)
CREATE INDEX IF NOT EXISTS idx_services_is_faith_based ON services(is_faith_based) WHERE is_faith_based = true;
CREATE INDEX IF NOT EXISTS idx_services_is_12_step ON services(is_12_step) WHERE is_12_step = true;

COMMENT ON COLUMN services.is_faith_based IS 'True if service is primarily faith-based (church, ministry, religious organization)';
COMMENT ON COLUMN services.is_12_step IS 'True if service uses 12-step program methodology (AA, NA, Celebrate Recovery)';
