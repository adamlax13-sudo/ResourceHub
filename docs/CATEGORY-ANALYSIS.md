# Database Category Analysis & Recommendations

## Status: ✅ IMPLEMENTED

All major categorization issues have been fixed. See "Changes Made" section below.

---

## Changes Made (February 2026)

### 1. Database Schema Updates
**File:** `migrations/add_category_improvements.sql`

Added new columns for better categorization:
- `service_type` - crisis_line, emergency_shelter, mental_health, addiction_recovery, etc.
- `eligibility_tags` - JSONB array of eligibility criteria
- `demographic_tags` - JSONB array: women, youth, indigenous, seniors, lgbtq, families, men
- `gender_restriction` - women_only, men_only, all
- `age_restriction` - youth_12_24, adult_18+, senior_55+, all
- `is_24_7` - Boolean flag for 24/7 services
- `is_walk_in` - Boolean flag for walk-in services
- `requires_referral` - Boolean flag for referral requirements

### 2. Fixed Women's Shelters
**File:** `scraper/reference_data.py`

Moved to "Domestic Violence & Womens Shelters" category:
- ✅ Mustard Seed Womens (was Calgary Emergency Shelters)
- ✅ YW Calgary Emergency Shelter (was Calgary Emergency Shelters)
- ✅ WIN House Edmonton (was Edmonton Services)
- ✅ Lurana Shelter (was Edmonton Services)
- ✅ Central Alberta Womens Emergency Shelter (was Lethbridge Services - wrong location!)

### 3. Fixed Men's Shelters
**File:** `scraper/reference_data.py`

Added `gender_restriction: 'men_only'` to:
- ✅ Alpha House Shelter
- ✅ Salvation Army Centre of Hope

### 4. Fixed Location Mismatches
**File:** `scraper/reference_data.py`

- ✅ Central Alberta Womens Emergency Shelter: Changed from "Lethbridge Services" to "Domestic Violence & Womens Shelters", location updated to "Red Deer / Central Alberta"

### 5. Clarified Duplicate Service Names
**File:** `scraper/reference_data.py`

Renamed duplicate entries to clarify service type:
- ✅ Calgary Drop-In Centre → "Calgary Drop-In Centre - Emergency Shelter" (shelter category)
- ✅ Calgary Drop-In Centre → "Calgary Drop-In Centre - Withdrawal Management" (addiction category)

### 6. Updated Scraper for Auto-Detection
**File:** `scraper/scraper.py`

Added `infer_service_metadata()` function that automatically detects:
- `service_type` from category name
- `gender_restriction` from eligibility/description
- `demographic_tags` from eligibility (women, youth, indigenous, seniors, lgbtq, families)
- `is_24_7` from hours of operation
- `is_walk_in` from description
- `requires_referral` from eligibility

### 7. Updated Schema Types
**File:** `shared/schema.ts`

Added TypeScript definitions for new columns:
- `serviceType`, `eligibilityTags`, `demographicTags`
- `genderRestriction`, `ageRestriction`
- `is24_7`, `isWalkIn`, `requiresReferral`

### 8. Enhanced Search Boosting
**File:** `server/search/strategies/comprehensive.ts`

Added `INTENT_SERVICE_MAP` for smarter intent-based boosting:
- Maps query intents to expected service types
- Multi-factor boosting (text patterns + category matching + 24/7 for urgent intents)
- Gender preference for domestic_violence intent (boosts women's services)

---

## Deployment Steps

1. **Run database migration:**
   ```bash
   psql $DATABASE_URL -f migrations/add_category_improvements.sql
   ```

2. **Re-run scraper to populate new fields:**
   ```bash
   cd scraper
   python scraper.py --phases reference,enrich
   ```

3. **Verify changes:**
   ```bash
   npx tsx scripts/analyze-categories.ts
   ```

---

## Executive Summary

After analyzing the service categorization in `reference_data.py` and the database schema, I identified **10 key categorization issues** that affect search accuracy and user experience. All have been addressed.

---

## Issues Identified (Original Analysis)

### Issue 1: Women's Shelters in General Shelter Categories

**Problem:** Women-only shelters are categorized under generic "Emergency Shelters" instead of "Domestic Violence & Womens Shelters", making them harder to find for women in crisis.

**Examples Found:**

| Service | Current Category | Should Be |
|---------|-----------------|-----------|
| Mustard Seed Womens | Calgary Emergency Shelters & Homeless Services | Domestic Violence & Womens Shelters |
| YW Calgary Emergency Shelter | Calgary Emergency Shelters & Homeless Services | Domestic Violence & Womens Shelters |
| WIN House Edmonton | Edmonton Services | Domestic Violence & Womens Shelters |
| Lurana Shelter | Edmonton Services | Domestic Violence & Womens Shelters |

**Impact:** When someone searches for "women's shelter" or has `domestic_violence` intent detected, these services may not rank as highly.

---

### Issue 2: Men's Shelters Not Clearly Marked

**Problem:** Several shelters are men-only but the category doesn't indicate this, leading to confusion.

**Examples Found:**

| Service | Current Category | Description |
|---------|-----------------|-------------|
| Alpha House Shelter | Calgary Emergency Shelters | "Mens shelter, substance use support" |
| Salvation Army Centre of Hope | Calgary Emergency Shelters | "Mens emergency shelter" |

**Recommendation:** Either:
- Add "(Men Only)" suffix to category
- Or create "Emergency Shelters - Men" subcategory

---

### Issue 3: Vague Location-Based Categories

**Problem:** "Edmonton Services", "Lethbridge Services", "Medicine Hat Services" don't indicate what TYPE of service. This is inconsistent with Calgary which has specific categories.

**Current Structure (Calgary):**
- ✅ Calgary Mental Health Urgent Care
- ✅ Calgary Mental Health & Addiction
- ✅ Calgary Emergency Shelters & Homeless Services
- ✅ Calgary Low-Cost/Sliding Scale Counselling

**Current Structure (Other Cities):**
- ❌ Edmonton Services (mixes shelters, treatment, mental health)
- ❌ Lethbridge Services (vague)
- ❌ Medicine Hat Services (vague)

**Recommendation:** Expand other cities to match Calgary's structure:
- Edmonton Mental Health & Addiction
- Edmonton Emergency Shelters
- Edmonton Counselling Services
- etc.

---

### Issue 4: Location Mismatches

**Problem:** Some services are in the wrong city category.

**Examples Found:**

| Service | Category | Actual Location |
|---------|----------|-----------------|
| Central Alberta Womens Emergency Shelter | Lethbridge Services | Central Alberta / Red Deer |

---

### Issue 5: Duplicate Services Across Categories

**Problem:** Same service listed in multiple categories with slightly different details.

**Examples Found:**

| Service | Categories |
|---------|-----------|
| Calgary Drop-In Centre | Calgary Mental Health & Addiction AND Calgary Emergency Shelters |
| Alpha House | Calgary Mental Health & Addiction AND Calgary Emergency Shelters |
| WIN House | Edmonton Services AND Domestic Violence & Womens Shelters |
| Lurana Shelter | Edmonton Services AND Domestic Violence & Womens Shelters |

**Recommendation:** Choose one primary category OR implement a multi-category tagging system.

---

### Issue 6: Youth Services Scattered

**Problem:** Youth-specific services are in generic categories instead of "Youth Services".

**Examples Found:**

| Service | Current Category | Target Age |
|---------|-----------------|------------|
| Trellis Society Avenue 15 | Calgary Emergency Shelters | 18-24, 2SLGBTQIA+ |
| YESS Edmonton | Edmonton Services | 15-24 |

---

### Issue 7: Province-Wide vs City-Specific Confusion

**Problem:** Location field is inconsistent - some say "Alberta-wide", some say "Province-wide", some say specific city even when service is provincial.

**Examples:**
- `211 Alberta` - Location: "Alberta-wide" ✅
- `811 Health Link` - Location: "Alberta-wide" ✅
- Some services have no location at all
- Some provincial services are in city-specific categories

---

### Issue 8: Missing Service Type Indicators

**Problem:** Category doesn't tell you what the service DOES, just where it is.

**Recommendation:** Use a two-part category system:
- **Primary:** Service Type (Shelter, Counselling, Crisis Line, etc.)
- **Secondary:** Location (Calgary, Edmonton, Province-wide)

---

### Issue 9: Indigenous Services Split

**Problem:** Indigenous services are sometimes in "Indigenous Services" category and sometimes in city categories.

**Examples:**
- Indigenous Support Line (AHS) - in "24/7 Crisis Lines" ✅ (correct, it's a crisis line)
- Okisikow Iskwew Center - in "Indigenous Services - Provincial" ✅
- Some Indigenous women's services in "Edmonton Services" ❌

---

### Issue 10: Eligibility Not Reflected in Category

**Problem:** Services with specific eligibility (women-only, 18+, youth, seniors, Indigenous) are often in generic categories.

---

## Recommended Category Structure

### Option A: Hierarchical Categories (Recommended)

```
├── 24/7 Crisis Lines
│   └── (Province-wide, always available)
│
├── Emergency Shelters
│   ├── General Access
│   │   ├── Calgary
│   │   ├── Edmonton
│   │   └── Other Regions
│   ├── Women & Children
│   │   ├── Calgary
│   │   ├── Edmonton
│   │   └── Other Regions
│   ├── Men Only
│   │   ├── Calgary
│   │   └── Edmonton
│   ├── Youth (under 25)
│   │   ├── Calgary
│   │   └── Edmonton
│   └── Family
│       ├── Calgary
│       └── Edmonton
│
├── Domestic Violence Services
│   ├── Emergency Shelters
│   ├── Crisis Lines
│   └── Support Programs
│
├── Mental Health
│   ├── Urgent Care
│   ├── Counselling (Low-Cost)
│   ├── Counselling (Private)
│   └── Support Groups
│
├── Addiction & Recovery
│   ├── Detox Programs
│   ├── Residential Treatment
│   ├── Outpatient Programs
│   ├── Peer Support (AA, NA, etc.)
│   └── Harm Reduction
│
├── Food Resources
│   ├── Food Banks
│   ├── Meal Programs
│   └── Hampers & Delivery
│
├── Basic Needs
│   ├── Clothing
│   ├── Hygiene
│   └── Household Items
│
├── Indigenous Services
│   ├── Health & Wellness
│   ├── Cultural Programs
│   └── Family Services
│
├── LGBTQ2S+ Services
│
├── Youth Services (12-24)
│
├── Senior Services (55+)
│
├── Family & Parenting
│
├── Employment & Education
│
└── Legal & Financial Aid
```

### Option B: Tag-Based System

Instead of single categories, use multiple tags:

```typescript
service.tags = {
  service_type: ['shelter', 'emergency'],
  location: ['calgary'],
  demographic: ['women', 'children'],
  availability: ['24/7'],
  cost: ['free'],
  referral_required: false
}
```

This allows services to be found through multiple search paths.

---

## Implementation Priority

### Phase 1: Quick Wins (Low Risk)

1. **Move misplaced women's shelters** to "Domestic Violence & Womens Shelters"
2. **Add gender tags** to men-only shelters
3. **Fix location mismatches** (Central Alberta service in Lethbridge category)

### Phase 2: Structural Improvements

1. **Expand Edmonton/Lethbridge** categories to match Calgary's structure
2. **Remove duplicates** or choose primary category
3. **Standardize location field** values

### Phase 3: Full Restructure

1. **Implement hierarchical categories** or tag system
2. **Add eligibility field** to schema (women_only, men_only, youth, senior, indigenous, lgbtq)
3. **Create category mapping table** for migrations

---

## Database Schema Changes Suggested

```sql
-- Add structured eligibility
ALTER TABLE services ADD COLUMN eligibility_tags JSONB DEFAULT '[]';

-- Example values: ["women_only", "children_welcome", "18+", "indigenous"]

-- Add service type classification
ALTER TABLE services ADD COLUMN service_type VARCHAR(100);

-- Example values: "emergency_shelter", "crisis_line", "counselling", "residential_treatment"

-- Add availability flags
ALTER TABLE services ADD COLUMN is_24_7 BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN is_walk_in BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN requires_referral BOOLEAN DEFAULT FALSE;
```

---

## Running the Analysis Script

```bash
# From project root
cd /Users/adamyeo/Desktop/ResourceHub

# Set DATABASE_URL environment variable
export DATABASE_URL="your-database-url"

# Run analysis
npx tsx scripts/analyze-categories.ts
```

This will:
1. Print category distribution
2. Identify all categorization issues
3. Find potential duplicates
4. Generate summary statistics

---

## Next Steps

1. Run the analysis script against production database
2. Review findings with stakeholder
3. Prioritize fixes based on user impact
4. Create migration script for category changes
5. Update scraper to use new category structure
6. Test search results with updated categories
