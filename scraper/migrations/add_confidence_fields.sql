-- Add confidence scoring and source tracking fields to services table
-- Run: psql $DATABASE_URL -f migrations/add_confidence_fields.sql

-- Confidence score (0-100)
ALTER TABLE services ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT 50;

-- Field source tracking (JSON mapping field -> source URL)
ALTER TABLE services ADD COLUMN IF NOT EXISTS field_sources JSONB DEFAULT '{}';

-- Source URLs (array of URLs data was extracted from)
ALTER TABLE services ADD COLUMN IF NOT EXISTS source_urls JSONB DEFAULT '[]';

-- Flag for services that need manual review
ALTER TABLE services ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;

-- Content hash for change detection
ALTER TABLE services ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

-- ETag for HTTP caching
ALTER TABLE services ADD COLUMN IF NOT EXISTS etag VARCHAR(255);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_services_confidence ON services(confidence_score);
CREATE INDEX IF NOT EXISTS idx_services_needs_review ON services(needs_review) WHERE needs_review = TRUE;

-- Update existing services with default confidence score based on completeness
UPDATE services SET confidence_score =
    CASE
        WHEN description IS NOT NULL AND LENGTH(description) > 50
             AND eligibility IS NOT NULL AND LENGTH(eligibility) > 20
             AND (phone IS NOT NULL OR email IS NOT NULL)
             AND process_steps IS NOT NULL AND jsonb_array_length(COALESCE(process_steps, '[]'::jsonb)) > 0
        THEN 80
        WHEN description IS NOT NULL AND LENGTH(description) > 20
             AND (phone IS NOT NULL OR email IS NOT NULL OR contact IS NOT NULL)
        THEN 60
        ELSE 40
    END
WHERE confidence_score IS NULL OR confidence_score = 50;

COMMENT ON COLUMN services.confidence_score IS 'Data quality score 0-100. High (80+), Medium (60-79), Low (<60)';
COMMENT ON COLUMN services.field_sources IS 'JSON mapping field names to source URLs for auditing';
COMMENT ON COLUMN services.needs_review IS 'Flag for services requiring manual review due to low confidence';
