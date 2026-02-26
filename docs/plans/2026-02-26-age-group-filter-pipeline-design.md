# Age Group Filter Pipeline Design

**Date:** 2026-02-26
**Status:** Approved

## Overview

Redesign the ad-hoc age group handling (currently a -300 penalty on youth services for adult queries) into a proper filter pipeline with confidence-based filtering.

## Goals

1. High-confidence age queries should hard-filter mismatched services
2. Medium-confidence queries should apply penalties, not filters
3. Services with unknown age should default to `all_ages` and never be filtered
4. `youth_and_adult` services should pass through for both youth and adult queries

## Database Schema

Add `age_group` column to `services` table:

```sql
ALTER TABLE services
ADD COLUMN age_group VARCHAR(20) DEFAULT 'all_ages'
CHECK (age_group IN ('youth', 'youth_and_adult', 'adult', 'senior', 'all_ages'));
```

**Values:**
- `'youth'` — Services explicitly for under-25 (teens, children, young adults)
- `'youth_and_adult'` — Services spanning youth/adult boundary (e.g., 16-35, 18-30)
- `'adult'` — Services explicitly for adults 18+ that exclude youth
- `'senior'` — Services explicitly for 55/65+
- `'all_ages'` — Default. Services anyone can access, or age unknown

## Query Detector — Confidence Scoring

Update `detectAgeGroup()` in `detectors.ts` to return confidence:

```typescript
export type AgeGroup = 'youth' | 'youth_and_adult' | 'adult' | 'senior';

export interface AgeGroupDetection {
  ageGroup: AgeGroup;
  confidence: 'high' | 'medium';
}

export function detectAgeGroup(query: string): AgeGroupDetection | null
```

### High Confidence Patterns (Hard Filter)

```typescript
// Adult — with exclusions for false positives
// Exclude: "adult children of", "young adult", "adult family member"
/\badult\b(?!\s+(children\s+of|family\s+member))/.test(q) &&
!/\byoung\s+adult\b/.test(q)
→ { ageGroup: 'adult', confidence: 'high' }

// Youth — explicit youth service terms
/\b(teen|teenager|adolescent)\s+(program|service|counselling|shelter|support)\b/
→ { ageGroup: 'youth', confidence: 'high' }

// Senior — explicit senior terms
/\b(senior|elderly|65\+|70\+)\s+(support|services?|care|program)\b/
→ { ageGroup: 'senior', confidence: 'high' }
```

### Medium Confidence Patterns (-200 Penalty)

```typescript
// Young adult → maps to youth_and_adult
/\byoung\s+adult\b/
→ { ageGroup: 'youth_and_adult', confidence: 'medium' }

// Family context — searching for someone else
/\bmy\s+(son|daughter|teen|teenager|child)\b/
→ { ageGroup: 'youth', confidence: 'medium' }

/\b(my|for my)\s+(elderly|aging)\s+(parent|mom|dad)\b/
→ { ageGroup: 'senior', confidence: 'medium' }
```

## Filter Pipeline — `applyAgeFilter()`

New function in `filters.ts`:

```typescript
export function applyAgeFilter(
  services: LiteService[],
  detection: AgeGroupDetection | null
): LiteService[] {
  if (!detection) return services;  // No age signal = no filtering

  const { ageGroup, confidence } = detection;

  if (confidence === 'high') {
    // Hard filter: remove mismatched, keep all_ages
    return services.filter(svc => {
      if (svc.age_group === 'all_ages') return true;
      if (svc.age_group === 'youth_and_adult' &&
          (ageGroup === 'youth' || ageGroup === 'adult')) return true;
      if (ageGroup === 'youth' && svc.age_group === 'youth') return true;
      if (ageGroup === 'adult' && svc.age_group === 'adult') return true;
      if (ageGroup === 'senior' && svc.age_group === 'senior') return true;
      return false;  // Remove mismatches
    });
  }

  // Medium confidence: handled by scoring.ts with -200 penalty
  return services;
}
```

**Key behaviors:**
- `all_ages` always passes through (never filtered)
- `youth_and_adult` passes through for youth OR adult queries, filtered for senior
- High confidence: hard filter mismatches
- Medium confidence: -200 penalty in scoring.ts, no removal

## Migration Script

`scripts/populate-age-groups.ts`:

1. Query all services
2. For each service, analyze in priority order:
   - `eligibility` field (highest priority)
   - `name`
   - `description`
3. Pattern match for age indicators
4. Assign age_group, default to `'all_ages'` if uncertain
5. Log services that defaulted to `'all_ages'` for manual review

## Scraper Update

Update `EligibilityExtractor` to populate `age_group`. Map extracted `age_min`/`age_max` to enum:

```typescript
function mapAgeRangeToGroup(age_min: number | null, age_max: number | null): AgeGroup {
  // Check youth_and_adult first — meaningfully spans into adulthood
  // e.g., 16-35, 18-30 (age_max must be > 25 to qualify)
  if (age_min !== null && age_max !== null &&
      age_min < 22 && age_max > 25 && age_max <= 40) {
    return 'youth_and_adult';
  }

  // Youth — clearly youth-only, max is 25 or under
  // e.g., 12-24, 13-17, under 18
  if (age_max !== null && age_max <= 25 &&
      (age_min === null || age_min < 18)) {
    return 'youth';
  }

  // Senior — 55+ or 65+
  if (age_min !== null && age_min >= 55) {
    return 'senior';
  }

  // Adult — explicitly 18+ with no upper bound or high upper bound
  if (age_min !== null && age_min >= 18 &&
      (age_max === null || age_max > 40)) {
    return 'adult';
  }

  // Default — can't determine with confidence
  return 'all_ages';
}
```

**Examples:**
| age_min | age_max | Result |
|---------|---------|--------|
| 16 | 35 | `youth_and_adult` |
| 18 | 30 | `youth_and_adult` |
| 12 | 24 | `youth` |
| null | 18 | `youth` |
| 18 | null | `adult` |
| 65 | null | `senior` |
| null | null | `all_ages` |

## Test Queries

| Query | Expected Behavior |
|-------|-------------------|
| `"adult residential programs calgary"` | High confidence adult. Filter out youth-only. Show adult + all_ages + youth_and_adult |
| `"teen counselling edmonton"` | High confidence youth. Filter out adult-only, senior-only. Show youth + all_ages + youth_and_adult |
| `"senior supports red deer"` | High confidence senior. Filter out youth, youth_and_adult, adult. Show senior + all_ages |
| `"counselling calgary"` | No age signal. Show all services, no filtering |
| `"young adult housing"` | Medium confidence youth_and_adult. -200 penalty on mismatches, no hard filter |

## Files to Modify

1. `migrations/add_age_group_column.sql` — Schema change
2. `shared/schema.ts` — Add age_group to services table definition
3. `server/search/strategies/detectors.ts` — Update detectAgeGroup() with confidence
4. `server/search/strategies/filters.ts` — Add applyAgeFilter()
5. `server/search/strategies/scoring.ts` — Update medium-confidence penalty to -200
6. `server/search/strategies/comprehensive.ts` — Integrate filter into search pipeline
7. `scripts/populate-age-groups.ts` — Migration script (new file)
8. `scraper/extractors/eligibility_extractor.py` — Add age_group mapping
9. `scraper/scraper.py` — Persist age_group to database
