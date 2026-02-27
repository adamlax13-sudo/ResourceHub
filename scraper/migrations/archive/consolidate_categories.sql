-- =============================================================================
-- ResourceHub Category Consolidation Migration
-- =============================================================================
-- This migration consolidates 51 categories down to ~28 standardized categories.
-- Run with: psql -d resourcehub -f consolidate_categories.sql
--
-- IMPORTANT: Create a backup before running!
-- pg_dump resourcehub > backup_before_category_migration.sql
-- =============================================================================

-- Start transaction
BEGIN;

-- =============================================================================
-- STEP 1: Consolidate duplicate categories (same thing, different names)
-- =============================================================================

-- Harm Reduction consolidation
UPDATE services SET category = 'Harm Reduction'
WHERE category = 'Harm Reduction Services';

-- LGBTQ2S+ consolidation
UPDATE services SET category = 'LGBTQ2S+ Services'
WHERE category = 'LGBTQ2S+ Support Services';

-- Detox consolidation
UPDATE services SET category = 'Detox & Withdrawal Management'
WHERE category IN (
  'Detoxification Programs',
  'Detox & Medical Withdrawal Services',
  'Stabilization & Withdrawal Management'
);

-- Residential Treatment consolidation
UPDATE services SET category = 'Residential Treatment'
WHERE category IN (
  'Licensed Residential Treatment - Calgary',
  'Residential Treatment Programs - Licensed Alberta',
  'Mens Residential Recovery',
  'Womens Residential Recovery',
  'Residential Addiction Treatment'
);

-- Food Banks consolidation
UPDATE services SET category = 'Food Banks & Meals'
WHERE category LIKE '%Food%'
  AND category NOT IN ('Food Banks & Meals')
  AND category LIKE '%Calgary%' OR category LIKE '%Edmonton%' OR category LIKE '%Provincial%';

-- =============================================================================
-- STEP 2: Mental Health & Counselling consolidation
-- Be careful - some categories should stay separate (Campus, Crisis, Eating Disorder)
-- =============================================================================

-- General Mental Health consolidation (NOT campus, NOT crisis, NOT eating disorder)
UPDATE services SET category = 'Mental Health & Counselling'
WHERE category IN (
  'Calgary Mental Health & Addiction',
  'Mental Health & Addiction Services',
  'Mental Health & Counselling',
  'Specialized Mental Health Treatment',
  'Affordable Counselling Services',
  'Calgary Low-Cost/Sliding Scale Counselling'
)
AND category NOT LIKE '%Campus%'
AND category NOT LIKE '%Crisis%'
AND category NOT LIKE '%Eating%';

-- Crisis Mental Health - keep separate
UPDATE services SET category = 'Crisis Mental Health'
WHERE category IN (
  'Calgary Mental Health Urgent Care',
  'Mental Health & Crisis Services'
);

-- =============================================================================
-- STEP 3: Fix misclassified services
-- =============================================================================

-- FASD services should be in Disability & Autism Support, not Family Addiction Support
UPDATE services SET category = 'Disability & Autism Support'
WHERE (
  name ILIKE '%FASD%'
  OR description ILIKE '%FASD%'
  OR description ILIKE '%Fetal Alcohol%'
)
AND category = 'Support for Family Members Affected by Addiction';

-- General shelters incorrectly in DV category (check descriptions)
-- Only move if description doesn't mention domestic violence or abuse
UPDATE services SET category = 'Emergency Shelter'
WHERE category = 'Domestic Violence & Womens Shelters'
AND description NOT ILIKE '%domestic violence%'
AND description NOT ILIKE '%abuse%'
AND description NOT ILIKE '%women fleeing%'
AND description NOT ILIKE '%intimate partner%';

-- Baby/parenting resources that are actually family emergency housing
UPDATE services SET category = 'Family Emergency Housing'
WHERE name IN (
  'Childrens Cottage - Brendas House',
  'Family Emergency Housing'
)
AND category = 'Baby & Parenting Resources';

-- =============================================================================
-- STEP 4: Extract location from category names
-- Add location field if not exists, then strip from category
-- =============================================================================

-- First, ensure we have a location column (if not exists)
-- This is idempotent - if column exists, nothing happens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'location'
  ) THEN
    ALTER TABLE services ADD COLUMN location VARCHAR(100);
  END IF;
END $$;

-- Set location based on category name
UPDATE services SET location = 'Calgary'
WHERE category LIKE '%Calgary%' AND (location IS NULL OR location = '');

UPDATE services SET location = 'Edmonton'
WHERE category LIKE '%Edmonton%' AND (location IS NULL OR location = '');

UPDATE services SET location = 'Provincial'
WHERE category LIKE '%Provincial%' AND (location IS NULL OR location = '');

-- Strip location from category names
UPDATE services SET category = REGEXP_REPLACE(category, ' - Calgary$', '')
WHERE category LIKE '%- Calgary';

UPDATE services SET category = REGEXP_REPLACE(category, ' - Edmonton$', '')
WHERE category LIKE '%- Edmonton';

UPDATE services SET category = REGEXP_REPLACE(category, ' - Provincial$', '')
WHERE category LIKE '%- Provincial';

-- =============================================================================
-- STEP 5: Standardize remaining category names
-- =============================================================================

-- Indigenous Services standardization
UPDATE services SET category = 'Indigenous Services'
WHERE category LIKE '%Indigenous%' OR category LIKE '%First Nation%';

-- Campus Services standardization
UPDATE services SET category = 'Campus & Student Services'
WHERE category LIKE '%Campus%' OR category LIKE '%University%' OR category LIKE '%College%';

-- Senior Services standardization
UPDATE services SET category = 'Senior Services'
WHERE category LIKE '%Senior%' OR category LIKE '%Elderly%' OR category LIKE '%Aging%';

-- Youth Services standardization
UPDATE services SET category = 'Youth Services'
WHERE category LIKE '%Youth%' AND category NOT LIKE '%Residential%';

-- =============================================================================
-- STEP 6: Rename categories to standard taxonomy
-- =============================================================================

-- Tier 1: Emergency & Crisis
UPDATE services SET category = 'Crisis Lines' WHERE category = '24/7 Crisis Lines';
UPDATE services SET category = 'Emergency Shelter' WHERE category = 'Emergency Shelters';
UPDATE services SET category = 'Domestic Violence Support' WHERE category = 'Domestic Violence & Womens Shelters';

-- Tier 3: Addiction & Recovery
UPDATE services SET category = 'Addiction Counselling' WHERE category IN ('Addiction Recovery Services', 'Outpatient Addiction Treatment');
UPDATE services SET category = 'Recovery Support' WHERE category IN ('Recovery & Peer Support', 'Sober Living & Recovery Housing');
UPDATE services SET category = 'Gambling Support' WHERE category LIKE '%Gambling%';

-- Tier 4: Population-Specific
UPDATE services SET category = 'Newcomer & Settlement' WHERE category LIKE '%Newcomer%' OR category LIKE '%Settlement%' OR category LIKE '%Refugee%';

-- Tier 5: Disability & Specialized
UPDATE services SET category = 'Grief & Bereavement' WHERE category LIKE '%Grief%' OR category LIKE '%Bereavement%';
UPDATE services SET category = 'Caregiver Support' WHERE category LIKE '%Caregiver%' OR category LIKE '%Respite%';

-- Tier 6: Basic Needs & Navigation
UPDATE services SET category = 'Financial Assistance' WHERE category LIKE '%Financial%' OR category LIKE '%Debt%';
UPDATE services SET category = 'Legal Aid' WHERE category LIKE '%Legal%';
UPDATE services SET category = 'Employment Services' WHERE category LIKE '%Employment%' OR category LIKE '%Job%';
UPDATE services SET category = 'Parenting & Family Resources' WHERE category LIKE '%Baby%' OR category LIKE '%Parenting%';
UPDATE services SET category = 'Clothing & Material Aid' WHERE category LIKE '%Clothing%' OR category LIKE '%Material%';

-- Commit transaction
COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES
-- Run these after migration to verify success
-- =============================================================================

-- Check category distribution
-- SELECT category, COUNT(*) as count FROM services GROUP BY category ORDER BY count DESC;

-- Check for orphaned/unexpected categories
-- SELECT DISTINCT category FROM services WHERE category NOT IN (
--   'Crisis Lines', 'Emergency Shelter', 'Domestic Violence Support', 'Food Banks & Meals',
--   'Mental Health & Counselling', 'Eating Disorder Services', 'Crisis Mental Health',
--   'Addiction Counselling', 'Detox & Withdrawal Management', 'Residential Treatment', 'Harm Reduction',
--   'Gambling Support', 'Recovery Support', 'Family Addiction Support',
--   'Youth Services', 'Senior Services', 'Indigenous Services', 'LGBTQ2S+ Services',
--   'Newcomer & Settlement', 'Campus & Student Services',
--   'Disability & Autism Support', 'Grief & Bereavement', 'Caregiver Support',
--   'Financial Assistance', 'Legal Aid', 'Employment Services',
--   'Parenting & Family Resources', 'Clothing & Material Aid'
-- );

-- Verify FASD moved correctly
-- SELECT name, category FROM services WHERE name ILIKE '%FASD%' OR description ILIKE '%FASD%';

-- Verify DV shelters still correct
-- SELECT name, category FROM services WHERE category = 'Domestic Violence Support';

-- =============================================================================
-- ROLLBACK SCRIPT (if needed)
-- =============================================================================
-- To rollback, restore from backup:
-- psql -d resourcehub < backup_before_category_migration.sql
