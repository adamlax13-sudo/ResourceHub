# Exclusion System Consolidation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace scattered exclusion logic with consolidated detection, database boolean columns, and hard filtering to ensure queries like "addiction help not religious calgary" return zero 12-step or faith-based services.

**Architecture:** Add `is_faith_based` and `is_12_step` boolean columns to services table. Rewrite `detectExclusions()` to return structured `Exclusions` interface. Add `applyExclusionFilter()` for hard filtering. Remove penalty-based exclusion scoring.

**Tech Stack:** TypeScript, PostgreSQL, Drizzle ORM, Node.js scripts

---

## Task 1: Database Schema Migration

**Files:**
- Create: `migrations/add_exclusion_columns.sql`
- Modify: `shared/schema.ts:51-52`

**Step 1: Create SQL migration file**

```sql
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
```

**Step 2: Update shared/schema.ts**

Add after line 51 (`is24_7`):

```typescript
  isFaithBased: boolean("is_faith_based").default(false),
  is12Step: boolean("is_12_step").default(false),
```

**Step 3: Run migration**

Run: `psql $DATABASE_URL -f migrations/add_exclusion_columns.sql`
Expected: `ALTER TABLE`, `CREATE INDEX` (x2)

**Step 4: Verify migration**

Run: `psql $DATABASE_URL -c "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='services' AND column_name IN ('is_faith_based', 'is_12_step');"`
Expected: Shows both columns with boolean type and false default

**Step 5: Commit**

```bash
git add migrations/add_exclusion_columns.sql shared/schema.ts
git commit -m "feat(db): add is_faith_based and is_12_step columns for exclusion filtering"
```

---

## Task 2: Add Exclusions Interface to Types

**Files:**
- Modify: `server/search/types.ts:1-20`

**Step 1: Add Exclusions interface**

Add after the imports (around line 5):

```typescript
/**
 * Structured exclusion signals detected from user query.
 * Used for hard filtering services that don't match user preferences.
 */
export interface Exclusions {
  /** User wants non-religious services ("not religious", "secular") */
  religious: boolean;
  /** User wants non-12-step programs ("no 12-step", or implied by religious + addiction context) */
  twelveStep: boolean;
  /** User wants to exclude specific gender-restricted services */
  genderRestricted: 'men_only' | 'women_only' | null;
}
```

**Step 2: Update LiteService interface**

Find the `LiteService` interface (around line 68-79) and add after `age_group`:

```typescript
  /** True if service is faith-based */
  is_faith_based?: boolean;
  /** True if service uses 12-step methodology */
  is_12_step?: boolean;
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add server/search/types.ts
git commit -m "feat(types): add Exclusions interface and exclusion fields to LiteService"
```

---

## Task 3: Rewrite detectExclusions Function

**Files:**
- Modify: `server/search/strategies/detectors.ts:292-318`

**Step 1: Add import for QueryIntent**

At the top of the file (after line 13), add:

```typescript
import type { QueryIntent } from '../config';
import type { Exclusions } from '../types';
```

**Step 2: Replace detectExclusions function**

Replace lines 292-318 with:

```typescript
/**
 * Detect exclusion signals from query text.
 * Returns structured Exclusions object for hard filtering.
 *
 * Key behavior: When religious === true AND query has addiction context,
 * automatically set twelveStep = true (12-step programs involve "higher power").
 */
export function detectExclusions(query: string, intent?: QueryIntent): Exclusions {
  const q = query.toLowerCase();

  // Detect religious exclusion signals
  const religious = /\b(not religious|non-?religious|secular|no.*religion|no.*faith|no.*church|no.*god|atheist|agnostic|secular only)\b/i.test(q);

  // Detect explicit 12-step exclusion
  let twelveStep = /\b(not.*12.*step|no.*12.*step|non.*12.*step|alternative to AA|alternative to NA|no AA|no NA|without.*12.*step)\b/i.test(q);

  // Auto-set twelveStep when religious exclusion + addiction context
  if (religious && !twelveStep) {
    const isAddictionContext =
      intent === 'substance_abuse' ||
      intent === 'family_addiction_support' ||
      /\b(addiction|recovery|rehab|detox|substance|drug|alcohol|sober|sobriety|clean|treatment|relapse)\b/i.test(q);

    if (isAddictionContext) {
      twelveStep = true;
      console.log(`[Exclusions] "not religious" + addiction context → auto-excluding 12-step programs`);
    }
  }

  // Detect gender exclusions
  let genderRestricted: 'men_only' | 'women_only' | null = null;
  if (/\b(not.*men only|no.*men|not just men|not.*male only|exclude.*men)\b/i.test(q)) {
    genderRestricted = 'men_only';
  } else if (/\b(not.*women only|no.*women|not just women|not.*female only|exclude.*women)\b/i.test(q)) {
    genderRestricted = 'women_only';
  }

  const exclusions: Exclusions = { religious, twelveStep, genderRestricted };

  // Log detected exclusions
  const detected: string[] = [];
  if (religious) detected.push('religious');
  if (twelveStep) detected.push('twelveStep');
  if (genderRestricted) detected.push(`gender:${genderRestricted}`);
  if (detected.length > 0) {
    console.log(`[Exclusions] Detected: ${detected.join(', ')}`);
  }

  return exclusions;
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add server/search/strategies/detectors.ts
git commit -m "feat(search): rewrite detectExclusions with structured return and auto 12-step"
```

---

## Task 4: Add applyExclusionFilter Function

**Files:**
- Modify: `server/search/strategies/filters.ts`

**Step 1: Add import at top of file**

After line 10 (`import { detectOrganizationSearch, extractOrganization } from './detectors';`), add:

```typescript
import type { Exclusions } from '../types';
```

**Step 2: Add applyExclusionFilter function**

Add after `filterByExclusions` function (after line 246):

```typescript
/**
 * Apply hard exclusion filters based on database boolean columns.
 * Services matching exclusion criteria are completely removed (not penalized).
 *
 * This is the primary exclusion mechanism - use database columns for reliable filtering.
 * The old filterByExclusions() is kept as fallback for services without column data.
 */
export function applyExclusionFilter(
  services: LiteService[],
  exclusions: Exclusions
): LiteService[] {
  // No exclusions detected = no filtering
  if (!exclusions.religious && !exclusions.twelveStep && !exclusions.genderRestricted) {
    return services;
  }

  const before = services.length;

  const filtered = services.filter(svc => {
    // Cast to access database columns
    const service = svc as any;

    // Filter faith-based services when religious exclusion detected
    if (exclusions.religious && service.is_faith_based === true) {
      return false;
    }

    // Filter 12-step services when twelveStep exclusion detected
    if (exclusions.twelveStep && service.is_12_step === true) {
      return false;
    }

    // Filter gender-restricted services
    if (exclusions.genderRestricted) {
      const svcGender = service.gender_restriction || service.genderRestriction;
      if (svcGender === exclusions.genderRestricted) {
        return false;
      }
    }

    // Fallback: text-based filtering for services without database flags
    // This catches services not yet classified by migration script
    const text = `${svc.name} ${svc.category} ${svc.description}`.toLowerCase();

    if (exclusions.religious && service.is_faith_based === undefined) {
      // Strong religious indicators - hard filter
      if (/\b(church|ministry|mission|evangelical|faith-?based|christian|catholic|baptist|lutheran|salvation army|dream centre|dream center)\b/i.test(text)) {
        return false;
      }
    }

    if (exclusions.twelveStep && service.is_12_step === undefined) {
      // 12-step indicators - hard filter
      if (/\b(12[\s-]?step|twelve[\s-]?step|\bAA\b|\bNA\b|\bCA\b|alcoholics anonymous|narcotics anonymous|higher power|celebrate recovery)\b/i.test(text)) {
        return false;
      }
    }

    return true;
  });

  const removed = before - filtered.length;
  if (removed > 0) {
    const reasons: string[] = [];
    if (exclusions.religious) reasons.push('faith-based');
    if (exclusions.twelveStep) reasons.push('12-step');
    if (exclusions.genderRestricted) reasons.push(`${exclusions.genderRestricted}`);
    console.log(`[ExclusionFilter] Removed ${removed} services (${reasons.join(', ')}): ${before} → ${filtered.length}`);
  }

  return filtered;
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add server/search/strategies/filters.ts
git commit -m "feat(search): add applyExclusionFilter for hard database-based filtering"
```

---

## Task 5: Integrate Filter into Search Pipeline

**Files:**
- Modify: `server/search/strategies/comprehensive.ts`

**Step 1: Add import for applyExclusionFilter**

Find the imports from './filters' (around line 34-36) and update to include:

```typescript
import {
  applyCategoryDiversity,
  applyOrganizationDiversity,
  applyExclusionFilter,
} from './filters';
```

**Step 2: Update detectExclusions import**

Update the import from './detectors' to include the function signature change:

```typescript
import {
  detectExclusions,
  // ... other imports
} from './detectors';
```

**Step 3: Apply exclusion filter after mergeResults**

Find the `mergeResults` call (around line 411) and the code immediately after it. After the line that gets `services` from mergeResults, add:

```typescript
    // Apply exclusion filter for hard filtering (must happen before scoring)
    const exclusions = detectExclusions(analysis.raw, analysis.intent);
    services = applyExclusionFilter(services, exclusions);
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add server/search/strategies/comprehensive.ts
git commit -m "feat(search): integrate applyExclusionFilter into search pipeline"
```

---

## Task 6: Remove Exclusion Penalties from Scoring

**Files:**
- Modify: `server/search/strategies/scoring.ts:861-892`

**Step 1: Remove exclusion penalty logic**

Find the exclusion penalty section (around lines 861-892). **Remove these specific blocks:**

- `if (exclusion === 'religious' && ...)` — penalty for religious services (-30)
- `if (exclusion === '12step' && ...)` — penalty for 12-step programs (-200)
- `if (exclusion === 'men_only' && ...)` — penalty for men-only services (-40)
- `if (exclusion === 'women_only' && ...)` — penalty for women-only services (-40)

Replace the removed penalty blocks with this comment:

```typescript
    // Note: Exclusion filtering (religious, 12-step, gender) is now handled by
    // applyExclusionFilter() in the pipeline. Services are hard-filtered, not penalized.
    // The old penalty-based approach is removed to ensure zero leakage.
    // Positive boosts for secular alternatives are preserved below.
```

**Step 2: KEEP these boost blocks (do NOT remove)**

The following boosts help rank good alternatives higher after excluded services are filtered out:

```typescript
// KEEP: Secular alternative boost when user has 12-step exclusion
if (exclusion === '12step') {
  if (/\b(SMART Recovery|cognitive behavio|evidence.?based|secular|non.?religious|harm reduction|medication.?assisted|MAT\b)\b/i.test(textLower)) {
    addFactor('exclusion.secularBoost', cfg.exclusion.secularBoost, `Secular/evidence-based alternative`);
  }
}

// KEEP: No-waitlist boost when user has waitlist exclusion
if (exclusion === 'waitlist') {
  if (/\b(walk.?in|no wait|immediate|same.?day|rapid access|no appointment|drop.?in|24\/7|open now)\b/i.test(textLower)) {
    addFactor('exclusion.noWaitlistBoost', cfg.exclusion.noWaitlistBoost, `Immediate access service`);
  }
}

// KEEP: Non-12-step query boosts (around lines 894-915)
// These boost SMART Recovery, evidence-based, MAT programs for explicit non-12-step queries
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add server/search/strategies/scoring.ts
git commit -m "refactor(search): remove exclusion penalties, keep secular alternative boosts"
```

---

## Task 7: Create Migration Script

**Files:**
- Create: `scripts/populate-exclusion-tags.ts`

**Step 1: Create the migration script**

```typescript
/**
 * Populate is_faith_based and is_12_step columns for existing services.
 *
 * Scans service name, description, and category for known patterns.
 * Defaults to false when uncertain (better to under-classify than over-filter).
 */
import 'dotenv/config';
import { Pool } from 'pg';

interface Service {
  service_id: string;
  name: string;
  description: string | null;
  category: string | null;
}

// 12-step program indicators
const TWELVE_STEP_NAME_PATTERNS = [
  /\b(AA|NA|CA|GA)\b/,  // Acronyms as standalone words
  /alcoholics\s*anonymous/i,
  /narcotics\s*anonymous/i,
  /cocaine\s*anonymous/i,
  /gamblers\s*anonymous/i,
  /celebrate\s*recovery/i,
  /12[\s-]?step/i,
  /twelve[\s-]?step/i,
];

const TWELVE_STEP_DESCRIPTION_PATTERNS = [
  /higher\s*power/i,
  /\bstep\s*program/i,
  /anonymous\s*fellowship/i,
  /\bAA\s*meeting/i,
  /\bNA\s*meeting/i,
  /working\s*the\s*steps/i,
  /12[\s-]?step/i,
];

// Faith-based service indicators
const FAITH_BASED_NAME_PATTERNS = [
  /\bchurch\b/i,
  /\bministry\b/i,
  /\bmission\b/i,
  /\bchapel\b/i,
  /\bchristian\b/i,
  /\bcatholic\b/i,
  /\bbaptist\b/i,
  /\blutheran\b/i,
  /\bpresbyterian\b/i,
  /\bpentecostal\b/i,
  /\bmethodist\b/i,
  /\bevangelical\b/i,
  /salvation\s*army/i,
  /dream\s*centre/i,
  /dream\s*center/i,
  /faith[\s-]?based/i,
  /mustard\s*seed/i,  // Known faith-based org in Alberta
];

const FAITH_BASED_DESCRIPTION_PATTERNS = [
  /\bprayer\b/i,
  /\bprayer\s*group/i,
  /\bbible\s*study/i,
  /\bscripture\b/i,
  /\bworship\b/i,
  /\bpraise\b/i,
  /\bjesus\b/i,
  /\bchrist\b/i,
  /\bspiritual\s*healing\b/i,
  /\bfaith[\s-]?based/i,
  /\bchristian\s*(counsell?ing|program|support)/i,
  /\bchurch[\s-]?based/i,
];

// Exclusion patterns - don't classify as faith-based
const FALSE_POSITIVE_PATTERNS = [
  /thank\s*god/i,  // Common expression, not religious service
  /god\s*forbid/i,
  /for\s*god'?s\s*sake/i,
];

function is12Step(name: string, description: string): boolean {
  // Check name patterns
  for (const pattern of TWELVE_STEP_NAME_PATTERNS) {
    if (pattern.test(name)) {
      return true;
    }
  }

  // Check description patterns
  for (const pattern of TWELVE_STEP_DESCRIPTION_PATTERNS) {
    if (pattern.test(description)) {
      return true;
    }
  }

  return false;
}

function isFaithBased(name: string, description: string): boolean {
  const text = `${name} ${description}`;

  // Check for false positives first
  for (const pattern of FALSE_POSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      // Has idiom but check if also has strong faith indicators
      let hasStrongIndicator = false;
      for (const namePattern of FAITH_BASED_NAME_PATTERNS) {
        if (namePattern.test(name)) {
          hasStrongIndicator = true;
          break;
        }
      }
      if (!hasStrongIndicator) {
        return false;
      }
    }
  }

  // Check name patterns
  for (const pattern of FAITH_BASED_NAME_PATTERNS) {
    if (pattern.test(name)) {
      return true;
    }
  }

  // Check description patterns
  for (const pattern of FAITH_BASED_DESCRIPTION_PATTERNS) {
    if (pattern.test(description)) {
      return true;
    }
  }

  return false;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Get all active services
    const { rows: services } = await pool.query<Service>(`
      SELECT service_id, name, description, category
      FROM services
      WHERE is_active = true
    `);

    console.log(`Processing ${services.length} services...\n`);

    const stats = {
      is12Step: 0,
      isFaithBased: 0,
      both: 0,
      neither: 0,
    };

    const classified: { serviceId: string; name: string; flags: string[] }[] = [];

    for (const service of services) {
      const name = service.name || '';
      const description = service.description || '';
      const category = service.category || '';
      const fullText = `${name} ${description} ${category}`;

      const flags: string[] = [];
      const is12StepFlag = is12Step(name, fullText);
      const isFaithBasedFlag = isFaithBased(name, fullText);

      if (is12StepFlag) flags.push('is_12_step');
      if (isFaithBasedFlag) flags.push('is_faith_based');

      // Update database
      await pool.query(
        'UPDATE services SET is_12_step = $1, is_faith_based = $2 WHERE service_id = $3',
        [is12StepFlag, isFaithBasedFlag, service.service_id]
      );

      // Track stats
      if (is12StepFlag && isFaithBasedFlag) {
        stats.both++;
      } else if (is12StepFlag) {
        stats.is12Step++;
      } else if (isFaithBasedFlag) {
        stats.isFaithBased++;
      } else {
        stats.neither++;
      }

      // Track classified services for review
      if (flags.length > 0) {
        classified.push({ serviceId: service.service_id, name: service.name, flags });
      }
    }

    console.log('=== Classification Results ===');
    console.log(`12-step only:      ${stats.is12Step}`);
    console.log(`Faith-based only:  ${stats.isFaithBased}`);
    console.log(`Both:              ${stats.both}`);
    console.log(`Neither:           ${stats.neither}`);
    console.log(`\nTotal:             ${services.length}`);

    console.log(`\n=== Classified Services (${classified.length}) ===`);
    console.log('Review these for accuracy:\n');

    // Group by flag type
    const twelveStepServices = classified.filter(s => s.flags.includes('is_12_step'));
    const faithBasedServices = classified.filter(s => s.flags.includes('is_faith_based'));

    if (twelveStepServices.length > 0) {
      console.log('--- 12-Step Programs ---');
      for (const svc of twelveStepServices.slice(0, 30)) {
        console.log(`  [${svc.flags.join(', ')}] ${svc.name.substring(0, 60)}`);
      }
      if (twelveStepServices.length > 30) {
        console.log(`  ... and ${twelveStepServices.length - 30} more`);
      }
    }

    if (faithBasedServices.length > 0) {
      console.log('\n--- Faith-Based Services ---');
      for (const svc of faithBasedServices.slice(0, 30)) {
        console.log(`  [${svc.flags.join(', ')}] ${svc.name.substring(0, 60)}`);
      }
      if (faithBasedServices.length > 30) {
        console.log(`  ... and ${faithBasedServices.length - 30} more`);
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
git add scripts/populate-exclusion-tags.ts
git commit -m "feat(scripts): add populate-exclusion-tags migration script"
```

---

## Task 8: Run Migration Script

**Step 1: Run the migration**

Run: `npx tsx scripts/populate-exclusion-tags.ts`
Expected: Output showing classification results and list of classified services

**Step 2: Verify distribution**

Run: `psql $DATABASE_URL -c "SELECT is_12_step, is_faith_based, COUNT(*) FROM services GROUP BY is_12_step, is_faith_based ORDER BY count DESC;"`
Expected: Shows distribution matching script output

**Step 3: Validate 12-step classification**

Run: `psql $DATABASE_URL -c "SELECT name FROM services WHERE is_12_step = true ORDER BY name;"`

**Validation criteria:**
- Expect to see: AA, NA, CA, Celebrate Recovery variants
- **If fewer than 5 results:** Patterns are too narrow — review `TWELVE_STEP_NAME_PATTERNS` and `TWELVE_STEP_DESCRIPTION_PATTERNS`, add missing patterns
- **If more than 50 results:** Patterns are too broad — check for false positives, tighten patterns

**Step 4: Validate faith-based classification**

Run: `psql $DATABASE_URL -c "SELECT name FROM services WHERE is_faith_based = true ORDER BY name;"`

**Validation criteria:**
- Expect to see: Salvation Army, Dream Centre, church-based services
- **If fewer than 5 results:** Patterns are too narrow
- **If more than 50 results:** Patterns are too broad

**Step 5: Check for misclassified pure faith-based services**

Run: `psql $DATABASE_URL -c "SELECT name FROM services WHERE is_faith_based = true AND is_12_step = false ORDER BY name;"`

**Validation criteria:**
- These are pure faith-based services (not 12-step)
- Verify none are misclassified (e.g., a service with "Mission" in the address, not the org name)
- Check for false positives like "Mission Street" addresses or "Christ" as part of a person's name

**Step 6: If any results look wrong**

1. Fix the patterns in `scripts/populate-exclusion-tags.ts`
2. Re-run: `npx tsx scripts/populate-exclusion-tags.ts`
3. Repeat validation steps 3-5
4. **Do NOT proceed to Task 9 until classification is accurate**

**Step 7: Spot check known services**

Run: `psql $DATABASE_URL -c "SELECT name, is_12_step, is_faith_based FROM services WHERE name ILIKE '%AA%' OR name ILIKE '%celebrate%' OR name ILIKE '%salvation%' OR name ILIKE '%SMART%' LIMIT 15;"`

Expected:
- AA services: `is_12_step = true`
- Celebrate Recovery: `is_12_step = true`, `is_faith_based = true`
- Salvation Army: `is_faith_based = true`
- SMART Recovery: `is_12_step = false`, `is_faith_based = false`

---

## Task 9: Test the Integration

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test exclusion query**

Run: `curl "http://localhost:5000/api/search?q=addiction+help+not+religious+calgary" | jq '.services[].name'`

Expected:
- SMART Recovery appears
- AHS services appear
- Zero AA/NA meetings
- Zero Celebrate Recovery
- Zero Salvation Army addiction programs

**Step 3: Test no-exclusion query**

Run: `curl "http://localhost:5000/api/search?q=addiction+support+calgary" | jq '.services[].name'`

Expected: Mix of all services including AA, faith-based

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "test: verify exclusion filtering works end-to-end"
```

---

## Task 10: Update Test Script

**Files:**
- Modify: `scripts/test-search-queries.ts`

**Step 1: Add exclusion test queries**

Add to the queries array:

```typescript
  // Exclusion system tests
  'addiction help not religious calgary',
  'secular counselling edmonton',
  'recovery support no 12 step calgary',
```

**Step 2: Add exclusion flag logging**

After the service name output, add:

```typescript
      if ((svc as any).is_12_step) console.log('    [12-STEP]');
      if ((svc as any).is_faith_based) console.log('    [FAITH-BASED]');
```

**Step 3: Run tests**

Run: `npx tsx scripts/test-search-queries.ts`
Expected:
- "addiction help not religious calgary" shows no [12-STEP] or [FAITH-BASED] tags
- Secular alternatives like SMART Recovery appear

**Step 4: Commit**

```bash
git add scripts/test-search-queries.ts
git commit -m "test: add exclusion system test queries"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `migrations/add_exclusion_columns.sql` | New: Schema migration for boolean columns |
| `shared/schema.ts` | Add `isFaithBased`, `is12Step` column definitions |
| `server/search/types.ts` | Add `Exclusions` interface, update `LiteService` |
| `server/search/strategies/detectors.ts` | Rewrite `detectExclusions()` with structured return |
| `server/search/strategies/filters.ts` | Add `applyExclusionFilter()` function |
| `server/search/strategies/comprehensive.ts` | Integrate filter into pipeline |
| `server/search/strategies/scoring.ts` | Remove exclusion penalties |
| `scripts/populate-exclusion-tags.ts` | New: Backfill migration script |
| `scripts/test-search-queries.ts` | Add exclusion test queries |

---

## Success Criteria

- [ ] `psql` shows `is_faith_based` and `is_12_step` columns exist
- [ ] Migration script correctly classifies AA, NA, Celebrate Recovery as `is_12_step = true`
- [ ] Migration script correctly classifies Salvation Army, Dream Centre as `is_faith_based = true`
- [ ] "addiction help not religious calgary" returns SMART Recovery in top 5
- [ ] "addiction help not religious calgary" returns zero 12-step or faith-based services
- [ ] "secular counselling" filters faith-based but not 12-step (no auto-set)
- [ ] Queries without exclusion signals return full results (no regression)
