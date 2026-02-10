-- Migration: Add category improvements and eligibility tracking
-- Run this migration to improve service categorization

-- 1. Add new columns for better categorization
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_type VARCHAR(100);
ALTER TABLE services ADD COLUMN IF NOT EXISTS eligibility_tags JSONB DEFAULT '[]';
ALTER TABLE services ADD COLUMN IF NOT EXISTS demographic_tags JSONB DEFAULT '[]';
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_24_7 BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS is_walk_in BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS requires_referral BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS gender_restriction VARCHAR(50); -- 'women_only', 'men_only', 'all'
ALTER TABLE services ADD COLUMN IF NOT EXISTS age_restriction VARCHAR(100); -- 'youth_12_24', 'adult_18+', 'senior_55+', 'all'

-- 2. Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_service_type ON services(service_type);
CREATE INDEX IF NOT EXISTS idx_gender_restriction ON services(gender_restriction);
CREATE INDEX IF NOT EXISTS idx_is_24_7 ON services(is_24_7);

-- 3. Create GIN index for JSONB columns (for fast tag searches)
CREATE INDEX IF NOT EXISTS idx_eligibility_tags ON services USING GIN(eligibility_tags);
CREATE INDEX IF NOT EXISTS idx_demographic_tags ON services USING GIN(demographic_tags);

-- ============================================================================
-- FIX 1: Women's shelters in wrong categories
-- Move from generic shelter categories to "Domestic Violence & Womens Shelters"
-- ============================================================================

-- Mustard Seed Womens
UPDATE services
SET category = 'Domestic Violence & Womens Shelters',
    gender_restriction = 'women_only'
WHERE name ILIKE '%Mustard Seed Women%'
  AND category = 'Calgary Emergency Shelters & Homeless Services';

-- YW Calgary Emergency Shelter
UPDATE services
SET category = 'Domestic Violence & Womens Shelters',
    gender_restriction = 'women_only'
WHERE name ILIKE '%YW Calgary%'
  AND category = 'Calgary Emergency Shelters & Homeless Services';

-- WIN House Edmonton (if in Edmonton Services)
UPDATE services
SET category = 'Domestic Violence & Womens Shelters',
    gender_restriction = 'women_only'
WHERE name ILIKE '%WIN House%'
  AND category = 'Edmonton Services';

-- Lurana Shelter (if in Edmonton Services)
UPDATE services
SET category = 'Domestic Violence & Womens Shelters',
    gender_restriction = 'women_only'
WHERE name ILIKE '%Lurana%'
  AND category = 'Edmonton Services';

-- ============================================================================
-- FIX 2: Mark men's shelters appropriately
-- ============================================================================

UPDATE services
SET gender_restriction = 'men_only'
WHERE (
  description ILIKE '%mens shelter%'
  OR description ILIKE '%men''s shelter%'
  OR description ILIKE '%male shelter%'
  OR name ILIKE '%men%shelter%'
);

-- Alpha House Shelter - explicitly men's
UPDATE services
SET gender_restriction = 'men_only'
WHERE name ILIKE '%Alpha House Shelter%'
  AND description ILIKE '%mens%';

-- Salvation Army Centre of Hope - men's emergency
UPDATE services
SET gender_restriction = 'men_only'
WHERE name ILIKE '%Salvation Army Centre of Hope%';

-- ============================================================================
-- FIX 3: Fix location mismatches
-- Central Alberta Womens Emergency Shelter is in Lethbridge category but serves Central Alberta
-- ============================================================================

UPDATE services
SET category = 'Red Deer & Central Alberta',
    location = 'Central Alberta'
WHERE name ILIKE '%Central Alberta Womens Emergency Shelter%'
  AND category = 'Lethbridge Services';

-- ============================================================================
-- FIX 4: Set service_type for all services based on category/description
-- ============================================================================

-- Crisis Lines
UPDATE services SET service_type = 'crisis_line', is_24_7 = TRUE
WHERE category ILIKE '%crisis%' OR category ILIKE '%24/7%';

-- Emergency Shelters
UPDATE services SET service_type = 'emergency_shelter'
WHERE category ILIKE '%shelter%' OR category ILIKE '%homeless%';

-- Mental Health
UPDATE services SET service_type = 'mental_health'
WHERE category ILIKE '%mental health%' AND service_type IS NULL;

-- Addiction/Recovery
UPDATE services SET service_type = 'addiction_recovery'
WHERE (category ILIKE '%addiction%' OR category ILIKE '%recovery%' OR category ILIKE '%detox%')
  AND service_type IS NULL;

-- Counselling
UPDATE services SET service_type = 'counselling'
WHERE category ILIKE '%counselling%' AND service_type IS NULL;

-- Residential Treatment
UPDATE services SET service_type = 'residential_treatment'
WHERE category ILIKE '%residential%' OR category ILIKE '%treatment%';

-- Food Resources
UPDATE services SET service_type = 'food_resources'
WHERE category ILIKE '%food%';

-- Indigenous Services
UPDATE services SET service_type = 'indigenous_services'
WHERE category ILIKE '%indigenous%';

-- Youth Services
UPDATE services SET service_type = 'youth_services', age_restriction = 'youth_12_24'
WHERE category ILIKE '%youth%';

-- LGBTQ+ Services
UPDATE services SET service_type = 'lgbtq_services'
WHERE category ILIKE '%lgbtq%' OR category ILIKE '%2s%';

-- Domestic Violence
UPDATE services SET service_type = 'domestic_violence'
WHERE category ILIKE '%domestic%' OR category ILIKE '%violence%';

-- ============================================================================
-- FIX 5: Set demographic_tags based on eligibility
-- ============================================================================

-- Women
UPDATE services
SET demographic_tags = demographic_tags || '["women"]'::jsonb
WHERE (eligibility ILIKE '%women%' OR name ILIKE '%women%' OR description ILIKE '%women%')
  AND NOT demographic_tags @> '["women"]'::jsonb;

-- Youth
UPDATE services
SET demographic_tags = demographic_tags || '["youth"]'::jsonb,
    age_restriction = COALESCE(age_restriction, 'youth_12_24')
WHERE (eligibility ILIKE '%youth%' OR eligibility ILIKE '%ages 15%' OR eligibility ILIKE '%18-24%')
  AND NOT demographic_tags @> '["youth"]'::jsonb;

-- Indigenous
UPDATE services
SET demographic_tags = demographic_tags || '["indigenous"]'::jsonb
WHERE (eligibility ILIKE '%indigenous%' OR eligibility ILIKE '%first nation%' OR name ILIKE '%indigenous%')
  AND NOT demographic_tags @> '["indigenous"]'::jsonb;

-- Seniors
UPDATE services
SET demographic_tags = demographic_tags || '["seniors"]'::jsonb,
    age_restriction = COALESCE(age_restriction, 'senior_55+')
WHERE (eligibility ILIKE '%senior%' OR eligibility ILIKE '%60+%' OR eligibility ILIKE '%55+%')
  AND NOT demographic_tags @> '["seniors"]'::jsonb;

-- LGBTQ+
UPDATE services
SET demographic_tags = demographic_tags || '["lgbtq"]'::jsonb
WHERE (eligibility ILIKE '%lgbtq%' OR eligibility ILIKE '%2slgbtq%' OR description ILIKE '%2slgbtq%')
  AND NOT demographic_tags @> '["lgbtq"]'::jsonb;

-- Families
UPDATE services
SET demographic_tags = demographic_tags || '["families"]'::jsonb
WHERE (eligibility ILIKE '%famil%' OR name ILIKE '%family%' OR description ILIKE '%children%')
  AND NOT demographic_tags @> '["families"]'::jsonb;

-- ============================================================================
-- FIX 6: Set 24/7 flag for all appropriate services
-- ============================================================================

UPDATE services SET is_24_7 = TRUE
WHERE hours_of_operation ILIKE '%24/7%'
   OR hours_of_operation ILIKE '%24 hour%'
   OR description ILIKE '%24/7%'
   OR wait_times ILIKE '%24/7%';

-- ============================================================================
-- FIX 7: Set walk-in flag
-- ============================================================================

UPDATE services SET is_walk_in = TRUE
WHERE description ILIKE '%walk-in%'
   OR description ILIKE '%walk in%'
   OR description ILIKE '%no appointment%'
   OR description ILIKE '%drop-in%';

-- ============================================================================
-- FIX 8: Mark referral requirements
-- ============================================================================

UPDATE services SET requires_referral = TRUE
WHERE eligibility ILIKE '%referral%'
   OR description ILIKE '%requires referral%'
   OR description ILIKE '%doctor referral%';

UPDATE services SET requires_referral = FALSE
WHERE description ILIKE '%no referral%'
   OR description ILIKE '%self-referral%';

-- ============================================================================
-- FIX 9: Handle potential duplicates by deactivating older entries
-- Keep the one in the more specific category
-- ============================================================================

-- For services that exist in both generic and specific categories,
-- prefer the one in the more specific category

-- Calgary Drop-In Centre duplicate - keep the one in shelters category
UPDATE services
SET is_active = FALSE, notes = 'Duplicate - see Calgary Emergency Shelters entry'
WHERE name ILIKE '%Calgary Drop-In Centre%'
  AND category = 'Calgary Mental Health & Addiction';

-- Alpha House duplicate - keep the one in shelters category
UPDATE services
SET is_active = FALSE, notes = 'Duplicate - see Calgary Emergency Shelters entry'
WHERE name = 'Alpha House Calgary'
  AND category = 'Calgary Mental Health & Addiction';

-- ============================================================================
-- Verification queries (run these to check the migration)
-- ============================================================================

-- Check women's shelters are properly categorized
-- SELECT name, category, gender_restriction FROM services WHERE gender_restriction = 'women_only';

-- Check men's shelters
-- SELECT name, category, gender_restriction FROM services WHERE gender_restriction = 'men_only';

-- Check service types distribution
-- SELECT service_type, COUNT(*) FROM services WHERE is_active = TRUE GROUP BY service_type ORDER BY COUNT(*) DESC;

-- Check demographic tags distribution
-- SELECT demographic_tags, COUNT(*) FROM services WHERE is_active = TRUE GROUP BY demographic_tags;

-- Find any remaining duplicates
-- SELECT name, COUNT(*) as cnt FROM services WHERE is_active = TRUE GROUP BY name HAVING COUNT(*) > 1;

COMMENT ON COLUMN services.service_type IS 'Primary service type: crisis_line, emergency_shelter, mental_health, addiction_recovery, counselling, residential_treatment, food_resources, indigenous_services, youth_services, lgbtq_services, domestic_violence';
COMMENT ON COLUMN services.eligibility_tags IS 'JSONB array of eligibility criteria tags';
COMMENT ON COLUMN services.demographic_tags IS 'JSONB array: women, youth, indigenous, seniors, lgbtq, families, men';
COMMENT ON COLUMN services.gender_restriction IS 'Gender restriction: women_only, men_only, all, or NULL';
COMMENT ON COLUMN services.age_restriction IS 'Age restriction: youth_12_24, adult_18+, senior_55+, all, or NULL';
