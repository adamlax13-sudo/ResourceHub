# Age Group Filter Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace ad-hoc -300 age penalty with proper filter pipeline using confidence-based detection and hard filtering.

**Architecture:** Add `age_group` column to services, update detector to return confidence levels, apply hard filter for high-confidence queries while using penalties for medium-confidence. Migration script backfills existing data.

**Tech Stack:** TypeScript, PostgreSQL, Drizzle ORM, Node.js scripts

---

## Task 1: Database Schema Migration

**Files:**
- Create: `migrations/add_age_group_column.sql`
- Modify: `shared/schema.ts:21-52`

**Step 1: Create SQL migration file**

```sql
-- migrations/add_age_group_column.sql
-- Add age_group column to services table for age-based filtering

ALTER TABLE services
ADD COLUMN IF NOT EXISTS age_group VARCHAR(20) DEFAULT 'all_ages'
CHECK (age_group IN ('youth', 'youth_and_adult', 'adult', 'senior', 'all_ages'));

-- Create index for fast filtering
CREATE INDEX IF NOT EXISTS idx_services_age_group ON services(age_group);

COMMENT ON COLUMN services.age_group IS 'Age group this service targets: youth (<25), youth_and_adult (16-35), adult (18+), senior (55+), all_ages (default)';
```

**Step 2: Update shared/schema.ts**

Add to the services table definition after line 51 (`is24_7`):

```typescript
  ageGroup: varchar("age_group", { length: 20 }).default('all_ages'),
```

**Step 3: Run migration**

Run: `psql $DATABASE_URL -f migrations/add_age_group_column.sql`
Expected: `ALTER TABLE`, `CREATE INDEX`

**Step 4: Verify migration**

Run: `psql $DATABASE_URL -c "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='services' AND column_name='age_group';"`
Expected: Shows `age_group | character varying | 'all_ages'`

**Step 5: Commit**

```bash
git add migrations/add_age_group_column.sql shared/schema.ts
git commit -m "feat(db): add age_group column to services table"
```

---

## Task 2: Update LiteService Type

**Files:**
- Modify: `server/search/types.ts:68-79`

**Step 1: Add age_group to LiteService interface**

After `is24_7?: boolean;` on line 78, add:

```typescript
  /** Age group this service targets */
  age_group?: 'youth' | 'youth_and_adult' | 'adult' | 'senior' | 'all_ages';
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add server/search/types.ts
git commit -m "feat(types): add age_group to LiteService interface"
```

---

## Task 3: Update Detector with Confidence Scoring

**Files:**
- Modify: `server/search/strategies/detectors.ts:59-99`

**Step 1: Add new types after line 21**

```typescript
/**
 * Age group detected from query
 */
export type AgeGroup = 'youth' | 'youth_and_adult' | 'adult' | 'senior';

/**
 * Age group detection result with confidence level
 */
export interface AgeGroupDetection {
  ageGroup: AgeGroup;
  confidence: 'high' | 'medium';
}
```

**Step 2: Replace detectAgeGroup function (lines 63-99)**

```typescript
/**
 * Detect age group preference from query text with confidence level
 * Returns detection with confidence, or null if no age signal
 */
export function detectAgeGroup(query: string): AgeGroupDetection | null {
  const q = query.toLowerCase();

  // === HIGH CONFIDENCE PATTERNS (hard filter) ===

  // Adult — explicit, with exclusions for false positives
  // Exclude: "adult children of", "young adult", "adult family member"
  const hasAdult = /\badult\b/.test(q);
  const isAdultFalsePositive = /\badult\s+children\s+of\b/.test(q) ||
                               /\byoung\s+adult\b/.test(q) ||
                               /\badult\s+family\s+member\b/.test(q);
  if (hasAdult && !isAdultFalsePositive) {
    return { ageGroup: 'adult', confidence: 'high' };
  }

  // Youth — explicit youth service terms
  if (/\b(teen|teenager|adolescent)\s+(program|service|counselling|counseling|shelter|support)s?\b/.test(q)) {
    return { ageGroup: 'youth', confidence: 'high' };
  }

  // Senior — explicit senior terms
  if (/\b(senior|elderly|65\+|70\+)\s+(support|services?|care|program)s?\b/.test(q)) {
    return { ageGroup: 'senior', confidence: 'high' };
  }

  // === MEDIUM CONFIDENCE PATTERNS (-200 penalty) ===

  // Young adult → maps to youth_and_adult
  if (/\byoung\s+adult\b/.test(q)) {
    return { ageGroup: 'youth_and_adult', confidence: 'medium' };
  }

  // Family context — searching for someone else
  if (/\bmy\s+(son|daughter|teen|teenager|child)\b/.test(q)) {
    return { ageGroup: 'youth', confidence: 'medium' };
  }

  if (/\b(my|for\s+my)\s+(elderly|aging)\s+(parent|mom|dad|mother|father)\b/.test(q)) {
    return { ageGroup: 'senior', confidence: 'medium' };
  }

  // General youth patterns (medium confidence)
  if (/\b(teenager|teen|adolescent|youth)\b/.test(q) &&
      !/\b(my|our|for)\s+(son|daughter|child|teenager|teen)\b/.test(q)) {
    return { ageGroup: 'youth', confidence: 'medium' };
  }

  // General senior patterns (medium confidence)
  if (/\b(senior|elderly|aging|aged|older\s+adult)\b/.test(q)) {
    return { ageGroup: 'senior', confidence: 'medium' };
  }

  return null;
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add server/search/strategies/detectors.ts
git commit -m "feat(search): add confidence scoring to detectAgeGroup"
```

---

## Task 4: Add applyAgeFilter Function

**Files:**
- Modify: `server/search/strategies/filters.ts` (add after line 191)

**Step 1: Add import at top of file (after line 10)**

```typescript
import type { AgeGroupDetection } from './detectors';
```

**Step 2: Add applyAgeFilter function after filterByAgeGroup (after line 191)**

```typescript
/**
 * Apply age-based filtering with confidence levels
 * High confidence: hard filter mismatched services
 * Medium confidence: no filtering (handled by scoring penalties)
 *
 * Key behaviors:
 * - all_ages services always pass through
 * - youth_and_adult passes for youth OR adult queries
 * - Services matching the detected age group pass through
 */
export function applyAgeFilter(
  services: LiteService[],
  detection: AgeGroupDetection | null
): LiteService[] {
  if (!detection) return services;  // No age signal = no filtering

  const { ageGroup, confidence } = detection;

  if (confidence === 'high') {
    const before = services.length;
    const filtered = services.filter(svc => {
      const serviceAgeGroup = (svc as any).age_group || 'all_ages';

      // all_ages always passes through
      if (serviceAgeGroup === 'all_ages') return true;

      // youth_and_adult passes for youth OR adult queries
      if (serviceAgeGroup === 'youth_and_adult' &&
          (ageGroup === 'youth' || ageGroup === 'adult')) return true;

      // Direct match passes
      if (ageGroup === 'youth' && serviceAgeGroup === 'youth') return true;
      if (ageGroup === 'adult' && serviceAgeGroup === 'adult') return true;
      if (ageGroup === 'senior' && serviceAgeGroup === 'senior') return true;

      return false;  // Remove mismatches
    });

    if (filtered.length < before) {
      console.log(`[AgeFilter] High confidence ${ageGroup}: filtered ${before - filtered.length} services (${before} → ${filtered.length})`);
    }

    return filtered;
  }

  // Medium confidence: no filtering, handled by scoring penalties
  return services;
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add server/search/strategies/filters.ts
git commit -m "feat(search): add applyAgeFilter with confidence-based filtering"
```

---

## Task 5: Update Scoring for Medium Confidence

**Files:**
- Modify: `server/search/config.ts:41-51`

**Step 1: Update ageGroup config values**

Replace lines 41-51:

```typescript
  // Age group boosts
  ageGroup: {
    youthMatch: 50,
    youthForSeniorPenalty: -100,
    youthForAdultPenalty: -50,
    adultForYouthPenalty: -200,      // Changed from -300 for medium confidence
    adultMatch: 100,
    adultForSeniorPenalty: -50,
    seniorMatch: 50,
    seniorYouthOnlyPenalty: -100,
    mediumConfidencePenalty: -200,   // New: penalty for medium confidence mismatches
  },
```

**Step 2: Verify no double-penalization**

After this change, the scoring logic in `scoring.ts` will have two paths:
- **Legacy path:** Uses `adultForYouthPenalty` etc. based on text pattern matching (existing code ~lines 266-289)
- **New path:** Should use `mediumConfidencePenalty` for medium-confidence age mismatches

For now, keep both — the legacy penalties apply when `detectAgeGroup()` returns medium confidence AND the service text matches age patterns. This is intentional layering, not double-penalization, because:
1. High-confidence queries → hard filter (no penalty needed)
2. Medium-confidence queries → `mediumConfidencePenalty` applies via the new filter pipeline
3. Legacy text-based penalties → still apply for edge cases where age is in service text but not in `age_group` column

**TODO for future cleanup:** Once `age_group` column is fully populated and trusted, remove the legacy text-based age penalties in `scoring.ts` lines 266-289.

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add server/search/config.ts
git commit -m "feat(search): add mediumConfidencePenalty for age group scoring"
```

---

## Task 6: Integrate Filter into Search Pipeline

**Files:**
- Modify: `server/search/strategies/comprehensive.ts`

**Step 1: Add import (after line 36)**

```typescript
import { applyAgeFilter } from './filters';
```

**Step 2: Update detectAgeGroup import (line 33)**

Change from:
```typescript
  detectAgeGroup,
```
To:
```typescript
  detectAgeGroup,
  type AgeGroupDetection,
```

**Step 3: Apply filter after mergeResults (around line 411)**

Find the line `let { services, searchType } = await mergeResults(` and add after the mergeResults call (before the boostByIntent call):

```typescript
    // Apply age-based filtering for high-confidence queries
    const ageDetection = detectAgeGroup(analysis.raw);
    services = applyAgeFilter(services, ageDetection);
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add server/search/strategies/comprehensive.ts
git commit -m "feat(search): integrate applyAgeFilter into search pipeline"
```

---

## Task 7: Create Migration Script

**Files:**
- Create: `scripts/populate-age-groups.ts`

**Step 1: Create the migration script**

```typescript
/**
 * Populate age_group column for existing services
 *
 * Analyzes eligibility, name, and description to determine age group.
 * Defaults to 'all_ages' when uncertain.
 * Logs services that defaulted for manual review.
 */
import 'dotenv/config';
import { Pool } from 'pg';

type AgeGroupValue = 'youth' | 'youth_and_adult' | 'adult' | 'senior' | 'all_ages';

interface Service {
  service_id: string;
  name: string;
  eligibility: string | null;
  description: string | null;
}

function mapAgeRangeToGroup(age_min: number | null, age_max: number | null): AgeGroupValue {
  // Check youth_and_adult first — meaningfully spans into adulthood
  if (age_min !== null && age_max !== null &&
      age_min < 22 && age_max > 25 && age_max <= 40) {
    return 'youth_and_adult';
  }

  // Youth — clearly youth-only, max is 25 or under
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

  return 'all_ages';
}

function extractAgeRange(text: string): { min: number | null; max: number | null } {
  const lower = text.toLowerCase();

  // Patterns to extract age ranges
  const patterns = [
    // "ages 12-24", "age 18-30"
    /ages?\s*(\d+)\s*[-–to]+\s*(\d+)/i,
    // "12 to 24 years"
    /(\d+)\s*to\s*(\d+)\s*years?/i,
    // "under 25", "under 18"
    /under\s*(\d+)/i,
    // "18+", "65+"
    /(\d+)\s*\+/,
    // "youth (12-24)"
    /youth\s*\(?(\d+)?\s*[-–]?\s*(\d+)?\)?/i,
    // "seniors 55+"
    /seniors?\s*(\d+)\s*\+?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern.source.includes('under')) {
        return { min: null, max: parseInt(match[1]) };
      }
      if (pattern.source.includes('\\+')) {
        return { min: parseInt(match[1]), max: null };
      }
      if (pattern.source.includes('senior')) {
        return { min: parseInt(match[1]) || 55, max: null };
      }
      const min = match[1] ? parseInt(match[1]) : null;
      const max = match[2] ? parseInt(match[2]) : null;
      if (min !== null || max !== null) {
        return { min, max };
      }
    }
  }

  return { min: null, max: null };
}

function detectAgeGroupFromText(text: string): AgeGroupValue {
  const lower = text.toLowerCase();

  // First try to extract numeric age range
  const range = extractAgeRange(text);
  if (range.min !== null || range.max !== null) {
    return mapAgeRangeToGroup(range.min, range.max);
  }

  // Pattern-based detection

  // Youth indicators
  const youthPatterns = [
    /\b(youth|teen|teenager|adolescent|children|kids?|juvenile|minor)\s*(only|program|service|shelter)/i,
    /\bfor\s+(youth|teens?|children|kids)\b/i,
    /\b(under\s*18|under\s*25)\b/i,
    /\b(young\s+people|young\s+person)\b/i,
  ];

  // Adult indicators (explicit adult-only)
  const adultPatterns = [
    /\badults?\s*(only|program|service)/i,
    /\bfor\s+adults\b/i,
    /\b18\s*\+\s*(only|years)/i,
    /\bmust\s+be\s+18/i,
  ];

  // Senior indicators
  const seniorPatterns = [
    /\b(senior|elderly|older\s+adult)s?\s*(only|program|service|care)/i,
    /\bfor\s+(seniors?|elderly)/i,
    /\b(55|60|65)\s*\+/i,
    /\b(geriatric|aging)/i,
  ];

  // Young adult indicators (spans youth/adult)
  const youngAdultPatterns = [
    /\byoung\s+adult/i,
    /\b(16|17|18)\s*[-–to]+\s*(30|35|40)\b/i,
    /\btransitional\s+(age|housing)/i,
  ];

  // Check young adult first (spans boundary)
  for (const pattern of youngAdultPatterns) {
    if (pattern.test(lower)) {
      return 'youth_and_adult';
    }
  }

  // Check specific age groups
  for (const pattern of youthPatterns) {
    if (pattern.test(lower)) {
      return 'youth';
    }
  }

  for (const pattern of seniorPatterns) {
    if (pattern.test(lower)) {
      return 'senior';
    }
  }

  for (const pattern of adultPatterns) {
    if (pattern.test(lower)) {
      return 'adult';
    }
  }

  return 'all_ages';
}

function determineAgeGroup(service: Service): { ageGroup: AgeGroupValue; source: string } {
  // Priority 1: eligibility field
  if (service.eligibility) {
    const fromEligibility = detectAgeGroupFromText(service.eligibility);
    if (fromEligibility !== 'all_ages') {
      return { ageGroup: fromEligibility, source: 'eligibility' };
    }
  }

  // Priority 2: name
  const fromName = detectAgeGroupFromText(service.name);
  if (fromName !== 'all_ages') {
    return { ageGroup: fromName, source: 'name' };
  }

  // Priority 3: description
  if (service.description) {
    const fromDescription = detectAgeGroupFromText(service.description);
    if (fromDescription !== 'all_ages') {
      return { ageGroup: fromDescription, source: 'description' };
    }
  }

  return { ageGroup: 'all_ages', source: 'default' };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Get all services
    const { rows: services } = await pool.query<Service>(`
      SELECT service_id, name, eligibility, description
      FROM services
      WHERE is_active = true
    `);

    console.log(`Processing ${services.length} services...\n`);

    const stats = {
      youth: 0,
      youth_and_adult: 0,
      adult: 0,
      senior: 0,
      all_ages: 0,
    };

    const defaultedServices: { serviceId: string; name: string }[] = [];

    for (const service of services) {
      const { ageGroup, source } = determineAgeGroup(service);

      await pool.query(
        'UPDATE services SET age_group = $1 WHERE service_id = $2',
        [ageGroup, service.service_id]
      );

      stats[ageGroup]++;

      if (source === 'default') {
        defaultedServices.push({ serviceId: service.service_id, name: service.name });
      }
    }

    console.log('=== Age Group Distribution ===');
    console.log(`youth:           ${stats.youth}`);
    console.log(`youth_and_adult: ${stats.youth_and_adult}`);
    console.log(`adult:           ${stats.adult}`);
    console.log(`senior:          ${stats.senior}`);
    console.log(`all_ages:        ${stats.all_ages}`);
    console.log(`\nTotal:           ${services.length}`);

    if (defaultedServices.length > 0) {
      console.log(`\n=== Services Defaulted to all_ages (${defaultedServices.length}) ===`);
      console.log('Review these manually to verify age group:\n');
      for (const svc of defaultedServices.slice(0, 50)) {
        console.log(`  - ${svc.serviceId}: ${svc.name}`);
      }
      if (defaultedServices.length > 50) {
        console.log(`  ... and ${defaultedServices.length - 50} more`);
      }
    }

  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add scripts/populate-age-groups.ts
git commit -m "feat(scripts): add populate-age-groups migration script"
```

---

## Task 8: Run Migration Script

**Step 1: Run the migration**

Run: `npx tsx scripts/populate-age-groups.ts`
Expected: Output showing distribution of age groups and list of defaulted services

**Step 2: Verify data**

Run: `psql $DATABASE_URL -c "SELECT age_group, COUNT(*) FROM services GROUP BY age_group ORDER BY count DESC;"`
Expected: Shows distribution matching script output

**Step 3: Commit any manual fixes if needed**

---

## Task 9: Update Test Script

**Files:**
- Modify: `scripts/test-search-queries.ts`

**Step 1: Update test queries**

Replace the queries array (lines 8-12):

```typescript
  const queries = [
    // High confidence adult - should filter out youth-only
    'adult residential programs calgary',
    // High confidence youth - should filter out adult-only, senior-only
    'teen counselling edmonton',
    // High confidence senior - should filter out youth, youth_and_adult, adult
    'senior supports red deer',
    // No age signal - should show all
    'counselling calgary',
    // Medium confidence - should apply penalty, not filter
    'young adult housing calgary',
    // False positive test - should NOT trigger adult filter
    'adult children of alcoholics calgary',
  ];
```

**Step 2: Add age group logging**

After line 24 (`console.log('  *', svc.name);`), add:

```typescript
      console.log('    Age Group:', (svc as any).age_group || 'N/A');
```

**Step 3: Run tests**

Run: `npx tsx scripts/test-search-queries.ts`
Expected:
- "adult residential programs" shows no youth-only services
- "teen counselling" shows no adult-only or senior services
- "counselling calgary" shows mix of all age groups
- "adult children of alcoholics" shows Al-Anon services (not filtered as adult)

**Step 4: Commit**

```bash
git add scripts/test-search-queries.ts
git commit -m "test: update search test queries for age group filtering"
```

---

## Task 10: Update Scraper (Python)

**Files:**
- Modify: `scraper/extractors/eligibility_extractor.py`
- Modify: `scraper/scraper.py` (if needed for persistence)

**Step 1: Add age_group mapping to EligibilityCriteria class**

After line 37 in eligibility_extractor.py, add:

```python
    age_group: Optional[str] = None  # 'youth', 'youth_and_adult', 'adult', 'senior', 'all_ages'
```

**Step 2: Add mapping function after EligibilityCriteria class (around line 73)**

```python
def map_age_range_to_group(age_min: Optional[int], age_max: Optional[int]) -> str:
    """Map age_min/age_max to age_group enum value."""
    # Check youth_and_adult first — meaningfully spans into adulthood
    if age_min is not None and age_max is not None:
        if age_min < 22 and age_max > 25 and age_max <= 40:
            return 'youth_and_adult'

    # Youth — clearly youth-only, max is 25 or under
    if age_max is not None and age_max <= 25:
        if age_min is None or age_min < 18:
            return 'youth'

    # Senior — 55+ or 65+
    if age_min is not None and age_min >= 55:
        return 'senior'

    # Adult — explicitly 18+ with no upper bound or high upper bound
    if age_min is not None and age_min >= 18:
        if age_max is None or age_max > 40:
            return 'adult'

    return 'all_ages'
```

**Step 3: Update to_text or add compute_age_group method**

Add method to EligibilityCriteria class:

```python
    def compute_age_group(self) -> str:
        """Compute age_group from age_min/age_max."""
        if self.age_group:
            return self.age_group
        return map_age_range_to_group(self.age_min, self.age_max)
```

**Step 4: Update _merge_results to compute age_group (around line 443)**

After the age fields merge, add:

```python
        # Compute age_group from merged age range
        result.age_group = map_age_range_to_group(result.age_min, result.age_max)
```

**Step 5: Commit**

```bash
git add scraper/extractors/eligibility_extractor.py
git commit -m "feat(scraper): add age_group computation to EligibilityExtractor"
```

---

## Task 11: Final Integration Test

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test queries manually**

```bash
# Adult query - should not show youth shelters
curl "http://localhost:5000/api/search?q=adult+residential+programs+calgary" | jq '.services[].name'

# Youth query - should not show senior services
curl "http://localhost:5000/api/search?q=teen+counselling+edmonton" | jq '.services[].name'

# Senior query - should only show senior + all_ages
curl "http://localhost:5000/api/search?q=senior+supports+red+deer" | jq '.services[].name'

# No age signal - should show everything
curl "http://localhost:5000/api/search?q=counselling+calgary" | jq '.services[].name'
```

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete age group filter pipeline implementation"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `migrations/add_age_group_column.sql` | New: Schema migration |
| `shared/schema.ts` | Add ageGroup field |
| `server/search/types.ts` | Add age_group to LiteService |
| `server/search/strategies/detectors.ts` | Update detectAgeGroup with confidence |
| `server/search/strategies/filters.ts` | Add applyAgeFilter function |
| `server/search/config.ts` | Add mediumConfidencePenalty |
| `server/search/strategies/comprehensive.ts` | Integrate filter into pipeline |
| `scripts/populate-age-groups.ts` | New: Migration script |
| `scripts/test-search-queries.ts` | Update test queries |
| `scraper/extractors/eligibility_extractor.py` | Add age_group mapping |
