-- migrations/add_age_group_column.sql
-- Add age_group column to services table for age-based filtering

ALTER TABLE services
ADD COLUMN IF NOT EXISTS age_group VARCHAR(20) DEFAULT 'all_ages'
CHECK (age_group IN ('youth', 'youth_and_adult', 'adult', 'senior', 'all_ages'));

-- Create index for fast filtering
CREATE INDEX IF NOT EXISTS idx_services_age_group ON services(age_group);

COMMENT ON COLUMN services.age_group IS 'Age group this service targets: youth (<25), youth_and_adult (16-35), adult (18+), senior (55+), all_ages (default)';
