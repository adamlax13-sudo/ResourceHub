# ResourceHub Category Restructure Plan

## Executive Summary
Current state: 51 categories with significant overlap, inconsistency, and misclassification.
Proposed state: 25 standardized categories with corresponding search intents.

---

## Current Problems

### 1. Duplicate Categories (Same Thing, Different Names)
| Keep | Merge Into It |
|------|---------------|
| Harm Reduction | Harm Reduction Services |
| LGBTQ2S+ Services | LGBTQ2S+ Support Services |
| Detox & Withdrawal Management | Detoxification Programs, Detox & Medical Withdrawal Services, Stabilization & Withdrawal Management |
| Residential Addiction Treatment | Licensed Residential Treatment - Calgary, Residential Treatment Programs - Licensed Alberta, Mens Residential Recovery, Womens Residential Recovery, Residential Addiction Treatment |
| Food Banks & Emergency Food | Free Food Resources - Calgary, Free Food Resources - Edmonton, Provincial Food Resources, Food Banks & Emergency Food |
| Mental Health & Counselling | Calgary Mental Health & Addiction, Calgary Mental Health Urgent Care, Mental Health & Crisis Services, Mental Health & Addiction Services, Mental Health & Counselling, Specialized Mental Health Treatment, Affordable Counselling Services, Calgary Low-Cost/Sliding Scale Counselling |

### 2. Location Should Be Field, Not Category
**Remove location from category names:**
- "Calgary Mental Health & Addiction" → "Mental Health Services" + location: Calgary
- "Indigenous Services - Calgary" → "Indigenous Services" + location: Calgary
- "Free Food Resources - Edmonton" → "Food Banks" + location: Edmonton

### 3. Misclassified Services
| Service | Current Category | Should Be |
|---------|-----------------|-----------|
| FASD Services | Support for Family Members Affected by Addiction | Disability & FASD Support |
| Mustard Seed Womens | Domestic Violence & Womens Shelters | Emergency Shelter (Women) |
| YW Calgary Emergency Shelter | Domestic Violence & Womens Shelters | Emergency Shelter (Women) |
| Childrens Cottage - Brendas House | Baby & Parenting Resources | Family Emergency Housing |

---

## Proposed Category Taxonomy (25 Categories)

### TIER 1: Emergency & Crisis (High Priority)
| # | Category | Description | Search Intent |
|---|----------|-------------|---------------|
| 1 | **Crisis Lines** | 24/7 phone/text crisis support | `crisis` |
| 2 | **Emergency Shelter** | Immediate housing (men, women, family, youth) | `housing_urgent` |
| 3 | **Domestic Violence Support** | DV-specific shelters, hotlines, counselling | `domestic_violence` |
| 4 | **Food Banks & Meals** | Emergency food, food banks, meal programs | `food_insecurity` |

### TIER 2: Mental Health
| # | Category | Description | Search Intent |
|---|----------|-------------|---------------|
| 5 | **Mental Health Counselling** | Therapy, counselling, psychiatric services | `mental_health` |
| 6 | **Eating Disorder Services** | Specialized ED treatment and support | `mental_health` (+ boosting) |
| 7 | **Crisis Mental Health** | Urgent psychiatric care, crisis stabilization | `crisis` / `mental_health` |

### TIER 3: Addiction & Recovery
| # | Category | Description | Search Intent |
|---|----------|-------------|---------------|
| 8 | **Addiction Counselling** | Outpatient addiction treatment, counselling | `substance_abuse` |
| 9 | **Detox & Withdrawal** | Medical detox, withdrawal management | `substance_abuse` |
| 10 | **Residential Treatment** | Inpatient addiction recovery programs | `substance_abuse` |
| 11 | **Harm Reduction** | Safe consumption, naloxone, needle exchange | `substance_abuse` |
| 12 | **Gambling Support** | Gambling addiction treatment | `substance_abuse` (gambling) |
| 13 | **Recovery Support** | AA, NA, peer support, recovery housing | `substance_abuse` |
| 14 | **Family Addiction Support** | Al-Anon, Nar-Anon, CRAFT | `family_addiction_support` |

### TIER 4: Population-Specific Services
| # | Category | Description | Search Intent |
|---|----------|-------------|---------------|
| 15 | **Youth Services** | Services for youth/teens (12-24) | `youth_services` |
| 16 | **Senior Services** | Aging, elder care, dementia support | `senior_services` |
| 17 | **Indigenous Services** | First Nations, Métis, Inuit support | `indigenous_services` (NEW) |
| 18 | **LGBTQ2S+ Services** | Pride, trans healthcare, queer support | `lgbtq_services` |
| 19 | **Newcomer & Settlement** | Immigration, ESL, refugee services | `newcomer_services` |
| 20 | **Campus & Student Services** | University/college mental health | `student_services` (NEW) |

### TIER 5: Disability & Specialized
| # | Category | Description | Search Intent |
|---|----------|-------------|---------------|
| 21 | **Disability & Autism Support** | Autism, ADHD, developmental disabilities, AISH, PDD, FASD | `disability_support` |
| 22 | **Grief & Bereavement** | Loss support, hospice, funeral assistance | `grief_support` |
| 23 | **Caregiver Support** | Respite, caregiver burnout, family support | `caregiver_support` |

### TIER 6: Basic Needs & Navigation
| # | Category | Description | Search Intent |
|---|----------|-------------|---------------|
| 24 | **Financial Assistance** | Debt help, emergency funds, benefits | `financial_support` |
| 25 | **Legal Aid** | Free lawyers, court help, tenant rights | `legal_aid` |
| 26 | **Employment Services** | Job training, career counselling, EI help | `employment_support` |
| 27 | **Parenting & Family Resources** | Baby supplies, parenting support, family counselling | `parenting_support` (NEW) |
| 28 | **Clothing & Material Aid** | Free clothing, household items | `basic_needs` (NEW) |

---

## New Search Intents Needed

Based on the database, we need these additional intents:

### 1. `indigenous_services` (15+ services)
**Patterns:**
```regex
/\b(?:indigenous|first nations?|métis|metis|inuit|native|aboriginal)\b.*(?:services?|support|help)/i
/\b(?:treaty|reserve|band office|status)\b/i
/\b(?:elder|smudging|sweat lodge|ceremony|medicine wheel)\b/i
```

### 2. `student_services` (20 services)
**Patterns:**
```regex
/\b(?:student|university|college|campus)\b.*(?:counselling|mental health|support)/i
/\b(?:u of c|u of a|uofc|uofa|ucalgary|ualberta|mount royal|mru|sait|nait|macewan)\b/i
/\b(?:academic|exam|finals|stress|dorm|residence)\b/i
```

### 3. `parenting_support` (8 services)
**Patterns:**
```regex
/\b(?:pregnant|pregnancy|prenatal|postpartum|new mom|new parent|baby|infant|newborn)\b/i
/\b(?:parenting|parent support|single parent|teen parent)\b/i
/\b(?:formula|diapers|baby supplies|infant essentials)\b/i
```

### 4. `basic_needs` (General fallback for clothing, material aid)
**Patterns:**
```regex
/\b(?:clothing|clothes|shoes|winter jacket|coat)\b.*(?:need|help|free)/i
/\b(?:furniture|household|essentials|supplies)\b.*(?:need|help|free)/i
```

---

## Migration Script Pseudocode

```sql
-- 1. Consolidate duplicate categories
UPDATE services SET category = 'Harm Reduction'
WHERE category = 'Harm Reduction Services';

UPDATE services SET category = 'LGBTQ2S+ Services'
WHERE category = 'LGBTQ2S+ Support Services';

UPDATE services SET category = 'Detox & Withdrawal Management'
WHERE category IN ('Detoxification Programs', 'Detox & Medical Withdrawal Services', 'Stabilization & Withdrawal Management');

UPDATE services SET category = 'Residential Treatment'
WHERE category LIKE '%Residential%Treatment%' OR category LIKE '%Residential Recovery%';

UPDATE services SET category = 'Food Banks & Meals'
WHERE category LIKE '%Food%' AND category != 'Food Banks & Meals';

UPDATE services SET category = 'Mental Health Counselling'
WHERE category LIKE '%Mental Health%' OR category LIKE '%Counselling%';

-- 2. Fix misclassified services
UPDATE services SET category = 'Disability & Autism Support'
WHERE name LIKE '%FASD%' OR description LIKE '%FASD%' OR description LIKE '%Fetal Alcohol%';

UPDATE services SET category = 'Emergency Shelter'
WHERE category = 'Domestic Violence & Womens Shelters'
AND description NOT LIKE '%domestic violence%'
AND description NOT LIKE '%abuse%';

-- 3. Extract location from category names
UPDATE services SET
  category = REGEXP_REPLACE(category, ' - Calgary$| - Edmonton$| - Provincial$', ''),
  location = CASE
    WHEN category LIKE '%Calgary%' THEN 'Calgary'
    WHEN category LIKE '%Edmonton%' THEN 'Edmonton'
    ELSE location
  END
WHERE category LIKE '%Calgary%' OR category LIKE '%Edmonton%' OR category LIKE '%Provincial%';
```

---

## Implementation Priority

### Phase 1: Add Missing Intents (Code changes)
1. Add `indigenous_services` intent → config.ts, analyzer.ts, comprehensive.ts
2. Add `student_services` intent → config.ts, analyzer.ts, comprehensive.ts
3. Add `parenting_support` intent → config.ts, analyzer.ts, comprehensive.ts

### Phase 2: Consolidate Categories (Database migration)
1. Create backup of services table
2. Run consolidation queries
3. Update reference_data.py to match new categories
4. Bump cache version

### Phase 3: Fix Misclassifications (Manual review + database)
1. Review each misclassified service
2. Update categories where needed
3. Re-scrape if needed to update from source

### Phase 4: Remove Location from Categories
1. Ensure all services have proper location field
2. Strip location suffixes from category names
3. Update search to filter by location field, not category

---

## Verification Queries

After migration, run these checks:

```sql
-- Check category distribution is reasonable
SELECT category, COUNT(*) FROM services GROUP BY category ORDER BY COUNT(*) DESC;

-- Check for orphaned categories (should be empty)
SELECT category FROM services WHERE category NOT IN (
  'Crisis Lines', 'Emergency Shelter', 'Domestic Violence Support', 'Food Banks & Meals',
  'Mental Health Counselling', 'Eating Disorder Services', 'Crisis Mental Health',
  'Addiction Counselling', 'Detox & Withdrawal', 'Residential Treatment', 'Harm Reduction',
  'Gambling Support', 'Recovery Support', 'Family Addiction Support',
  'Youth Services', 'Senior Services', 'Indigenous Services', 'LGBTQ2S+ Services',
  'Newcomer & Settlement', 'Campus & Student Services',
  'Disability & Autism Support', 'Grief & Bereavement', 'Caregiver Support',
  'Financial Assistance', 'Legal Aid', 'Employment Services',
  'Parenting & Family Resources', 'Clothing & Material Aid'
);

-- Check FASD services moved correctly
SELECT name, category FROM services WHERE name LIKE '%FASD%' OR description LIKE '%FASD%';
```

---

## Expected Outcomes

1. **Reduced categories:** 51 → 28 (46% reduction)
2. **Better search accuracy:** Intent-to-category mapping is 1:1 or 1:few
3. **Consistent naming:** No location in category names
4. **No misclassifications:** Services match their categories
5. **Complete intent coverage:** Every category has a search intent
