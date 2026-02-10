-- Migration: Fix Edmonton Services Category
-- Reclassifies services from generic "Edmonton Services" to proper service-type categories
-- This improves search accuracy by making categories reflect actual service types

-- ============================================================================
-- 1. CRISIS & MENTAL HEALTH SERVICES
-- ============================================================================

-- Access 24/7 Edmonton - Mental health/addiction intake
UPDATE services
SET category = 'Mental Health & Crisis Services',
    service_type = 'mental_health',
    is_walk_in = TRUE
WHERE name ILIKE '%Access 24/7 Edmonton%'
  AND category = 'Edmonton Services';

-- CMHA Edmonton - Mental health programs
UPDATE services
SET category = 'Mental Health & Counselling',
    service_type = 'mental_health'
WHERE name ILIKE '%CMHA Edmonton%'
  AND category = 'Edmonton Services';

-- Mobile Crisis Adults Edmonton - Crisis response
UPDATE services
SET category = 'Mental Health & Crisis Services',
    service_type = 'crisis_line',
    is_24_7 = TRUE
WHERE name ILIKE '%Mobile Crisis Adults Edmonton%'
  AND category = 'Edmonton Services';

-- Mobile Crisis Children Edmonton - Youth crisis response
UPDATE services
SET category = 'Youth Mental Health Services',
    service_type = 'crisis_line',
    age_restriction = 'youth_12_24',
    demographic_tags = demographic_tags || '["youth"]'::jsonb
WHERE name ILIKE '%Mobile Crisis Children Edmonton%'
  AND category = 'Edmonton Services';

-- CASA Mental Health - Child/youth services
UPDATE services
SET category = 'Youth Mental Health Services',
    service_type = 'mental_health',
    age_restriction = 'youth_12_24',
    demographic_tags = demographic_tags || '["youth", "indigenous"]'::jsonb
WHERE name ILIKE '%CASA Mental Health%'
  AND category = 'Edmonton Services';

-- Envision Mind Care - Specialized mental health
UPDATE services
SET category = 'Mental Health & Counselling',
    service_type = 'mental_health'
WHERE name ILIKE '%Envision Mind Care%'
  AND category = 'Edmonton Services';

-- ============================================================================
-- 2. DETOX & ADDICTION TREATMENT
-- ============================================================================

-- George Spady Society Detox
UPDATE services
SET category = 'Detox & Medical Withdrawal Services',
    service_type = 'detox',
    is_24_7 = TRUE
WHERE name ILIKE '%George Spady%Detox%'
  AND category = 'Edmonton Services';

-- Boyle Street Community Services - Harm reduction
UPDATE services
SET category = 'Harm Reduction Services',
    service_type = 'harm_reduction',
    is_walk_in = TRUE
WHERE name ILIKE '%Boyle Street Community%'
  AND category = 'Edmonton Services';

-- Managed Alcohol Program
UPDATE services
SET category = 'Harm Reduction Services',
    service_type = 'harm_reduction'
WHERE name ILIKE '%Managed Alcohol Program%'
  AND category = 'Edmonton Services';

-- Henwood Treatment Centre - Residential treatment
UPDATE services
SET category = 'Residential Addiction Treatment',
    service_type = 'residential_treatment'
WHERE name ILIKE '%Henwood Treatment Centre%'
  AND category = 'Edmonton Services';

-- ============================================================================
-- 3. MEN'S RECOVERY PROGRAMS
-- ============================================================================

-- Breakout Recovery Community - Men's residential
UPDATE services
SET category = 'Mens Residential Recovery',
    service_type = 'residential_treatment',
    gender_restriction = 'men_only',
    demographic_tags = demographic_tags || '["men"]'::jsonb
WHERE name ILIKE '%Breakout Recovery%'
  AND category = 'Edmonton Services';

-- Jellinek Society - Men's alcoholism recovery
UPDATE services
SET category = 'Mens Residential Recovery',
    service_type = 'residential_treatment',
    gender_restriction = 'men_only',
    demographic_tags = demographic_tags || '["men"]'::jsonb
WHERE name ILIKE '%Jellinek Society%'
  AND category = 'Edmonton Services';

-- Our House Edmonton - Men's long-term residential
UPDATE services
SET category = 'Mens Residential Recovery',
    service_type = 'residential_treatment',
    gender_restriction = 'men_only',
    demographic_tags = demographic_tags || '["men"]'::jsonb
WHERE name ILIKE '%Our House Edmonton%'
  AND category = 'Edmonton Services';

-- Recovery Acres Society - Men's recovery
UPDATE services
SET category = 'Mens Residential Recovery',
    service_type = 'residential_treatment',
    gender_restriction = 'men_only',
    demographic_tags = demographic_tags || '["men"]'::jsonb
WHERE name ILIKE '%Recovery Acres%'
  AND category = 'Edmonton Services';

-- Urban Manor Housing Society - Men's supportive housing
UPDATE services
SET category = 'Mens Supportive Housing',
    service_type = 'supportive_housing',
    gender_restriction = 'men_only',
    demographic_tags = demographic_tags || '["men"]'::jsonb
WHERE name ILIKE '%Urban Manor Housing%'
  AND category = 'Edmonton Services';

-- ============================================================================
-- 4. WOMEN'S RECOVERY PROGRAMS
-- ============================================================================

-- Wellspring by Hope Mission - Women's residential
UPDATE services
SET category = 'Womens Residential Recovery',
    service_type = 'residential_treatment',
    gender_restriction = 'women_only',
    demographic_tags = demographic_tags || '["women"]'::jsonb
WHERE name ILIKE '%Wellspring%Hope Mission%'
  AND category = 'Edmonton Services';

-- McDougall House - Women's residential treatment
UPDATE services
SET category = 'Womens Residential Recovery',
    service_type = 'residential_treatment',
    gender_restriction = 'women_only',
    demographic_tags = demographic_tags || '["women"]'::jsonb
WHERE name ILIKE '%McDougall House%'
  AND category = 'Edmonton Services';

-- ============================================================================
-- 5. EMERGENCY SHELTER & HOUSING
-- ============================================================================

-- Hope Mission Edmonton - Emergency shelter + recovery
UPDATE services
SET category = 'Emergency Shelter & Housing',
    service_type = 'emergency_shelter',
    is_24_7 = TRUE
WHERE name ILIKE '%Hope Mission Edmonton%'
  AND category = 'Edmonton Services';

-- YESS - Youth emergency shelter
UPDATE services
SET category = 'Youth Emergency Shelter',
    service_type = 'emergency_shelter',
    age_restriction = 'youth_12_24',
    is_24_7 = TRUE,
    demographic_tags = demographic_tags || '["youth"]'::jsonb
WHERE name ILIKE '%YESS%'
  AND category = 'Edmonton Services';

-- Edmonton Navigation and Support Centre - Multi-service hub
UPDATE services
SET category = 'Social Services Navigation',
    service_type = 'navigation_services',
    is_walk_in = TRUE
WHERE name ILIKE '%Edmonton Navigation%Support Centre%'
  AND category = 'Edmonton Services';

-- ============================================================================
-- 6. COUNSELLING SERVICES
-- ============================================================================

-- YWCA Edmonton Counselling
UPDATE services
SET category = 'Affordable Counselling Services',
    service_type = 'counselling'
WHERE name ILIKE '%YWCA Edmonton Counselling%'
  AND category = 'Edmonton Services';

-- The Family Centre
UPDATE services
SET category = 'Family Counselling Services',
    service_type = 'counselling',
    demographic_tags = demographic_tags || '["families"]'::jsonb
WHERE name ILIKE '%Family Centre%'
  AND category = 'Edmonton Services';

-- ============================================================================
-- 7. LGBTQ2S+ SERVICES
-- ============================================================================

-- Pride Centre of Edmonton
UPDATE services
SET category = 'LGBTQ2S+ Support Services',
    service_type = 'lgbtq_services',
    demographic_tags = demographic_tags || '["lgbtq"]'::jsonb
WHERE name ILIKE '%Pride Centre%Edmonton%'
  AND category = 'Edmonton Services';

-- ============================================================================
-- 8. FOOD RESOURCES
-- ============================================================================

-- Edmonton's Food Bank
UPDATE services
SET category = 'Food Banks & Emergency Food',
    service_type = 'food_resources'
WHERE name ILIKE '%Edmonton%Food Bank%'
  AND category = 'Edmonton Services';

-- ============================================================================
-- 9. CATCH-ALL: Any remaining Edmonton Services → General Social Services
-- ============================================================================

-- For any that weren't specifically addressed above, move to General Social Services
UPDATE services
SET category = 'General Social Services - Edmonton'
WHERE category = 'Edmonton Services';

-- ============================================================================
-- 10. LETHBRIDGE SERVICES - Reclassify generic category
-- ============================================================================

-- Lethbridge Train Station (Recovery Alberta) - Outpatient
UPDATE services
SET category = 'Mental Health & Addiction Services',
    service_type = 'mental_health',
    is_walk_in = TRUE
WHERE name ILIKE '%Lethbridge Train Station%Recovery Alberta%'
  AND category = 'Lethbridge Services';

-- Lethbridge Provincial Building - Community addiction/psychiatric
UPDATE services
SET category = 'Mental Health & Addiction Services',
    service_type = 'mental_health'
WHERE name ILIKE '%Lethbridge Provincial Building%'
  AND category = 'Lethbridge Services';

-- CMHA Lethbridge - Crisis/outreach
UPDATE services
SET category = 'Mental Health & Crisis Services',
    service_type = 'crisis_line'
WHERE name ILIKE '%CMHA Lethbridge%'
  AND category = 'Lethbridge Services';

-- Alpha House Lethbridge Shelter - Emergency shelter
UPDATE services
SET category = 'Emergency Shelter & Housing',
    service_type = 'emergency_shelter',
    is_24_7 = TRUE
WHERE name ILIKE '%Alpha House Lethbridge%'
  AND category = 'Lethbridge Services';

-- Lethbridge Wellness Shelter - Stabilization
UPDATE services
SET category = 'Stabilization & Withdrawal Management',
    service_type = 'stabilization'
WHERE name ILIKE '%Lethbridge Wellness Shelter%'
  AND category = 'Lethbridge Services';

-- Lethbridge Recovery Centre - Detox
UPDATE services
SET category = 'Detox & Medical Withdrawal Services',
    service_type = 'detox'
WHERE name ILIKE '%Lethbridge Recovery Centre%'
  AND category = 'Lethbridge Services';

-- Fresh Start Recovery Lethbridge - Men's residential
UPDATE services
SET category = 'Mens Residential Recovery',
    service_type = 'residential_treatment',
    gender_restriction = 'men_only',
    demographic_tags = demographic_tags || '["men"]'::jsonb
WHERE name ILIKE '%Fresh Start Recovery Lethbridge%'
  AND category = 'Lethbridge Services';

-- Iikaisskini Indigenous Services - Indigenous cultural healing
UPDATE services
SET category = 'Indigenous Wellness Services',
    service_type = 'indigenous_services',
    demographic_tags = demographic_tags || '["indigenous"]'::jsonb
WHERE name ILIKE '%Iikaisskini%'
  AND category = 'Lethbridge Services';

-- Catch-all for remaining Lethbridge Services
UPDATE services
SET category = 'General Social Services - Lethbridge'
WHERE category = 'Lethbridge Services';

-- ============================================================================
-- VERIFICATION QUERIES (uncomment to check results)
-- ============================================================================

-- Check no services remain in "Edmonton Services"
-- SELECT COUNT(*) FROM services WHERE category = 'Edmonton Services';

-- Check the new category distribution
-- SELECT category, COUNT(*) FROM services WHERE location ILIKE '%Edmonton%' GROUP BY category ORDER BY COUNT(*) DESC;

-- Check service_type was set
-- SELECT name, category, service_type FROM services WHERE location ILIKE '%Edmonton%' AND service_type IS NOT NULL ORDER BY category;
