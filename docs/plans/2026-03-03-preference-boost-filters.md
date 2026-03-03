# Preference Boost Filters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert toggle filters (faith-based, 12-step, 24/7) from hard exclusions to scoring boosts so they prioritize matching services without hiding relevant results.

**Architecture:** New `applyPreferenceBoosts()` function in the scoring pipeline. Removes three boolean checks from `applyHardFilters()`. Inserted after `boostByIntent` in both Tier 2 and Tier 3 search paths. Uses both DB boolean fields and text-pattern matching on descriptions.

**Tech Stack:** TypeScript, existing scoring/boost pipeline patterns

---

### Task 1: Create preference-boost.ts

**Files:**
- Create: `server/search/strategies/scoring/preference-boost.ts`

**Step 1: Create the preference boost module**

```typescript
/**
 * Preference Boosting
 *
 * Applies soft scoring boosts for UI toggle filters (faith-based, 12-step, 24/7).
 * These are preferences, not constraints — matching services sort to the top
 * but non-matching services remain visible.
 *
 * Called after boostByIntent in the comprehensive search pipeline.
 */

import type { SearchFilters } from '@shared/routes';
import type { LiteService, LiteServiceWithDebug, ScoreExplanation } from '../../types';
import type { BoostOptions } from './name-match';
import { searchLog } from '../../logger';

// Multiplier applied to rrfScore for boolean DB match (strong signal)
const BOOLEAN_MATCH_MULTIPLIER = 1.5;
// Multiplier applied to rrfScore for text-pattern match (inferred signal)
const TEXT_MATCH_MULTIPLIER = 1.2;

/** Text patterns that indicate a faith-based service */
const FAITH_PATTERNS = /\b(faith[- ]based|spiritual|church|christian|prayer|bible|higher power|god|ministry|pastoral|religious|scripture|worship|mosque|synagogue|temple|imam|rabbi|chaplain)\b/i;

/** Text patterns that indicate a 12-step service */
const TWELVE_STEP_PATTERNS = /\b(12[- ]step|twelve[- ]step|alcoholics anonymous|\baa\b|narcotics anonymous|\bna\b|sponsor|step work|big book|gamblers anonymous|\bga\b|cocaine anonymous|\bca\b|celebrate recovery)\b/i;

/** Text patterns that indicate 24/7 availability */
const AVAILABILITY_247_PATTERNS = /\b(24\/7|24[- ]hours?|around the clock|always open|crisis line|anytime|never close[sd]?)\b/i;

interface PreferenceConfig {
  filterKey: 'isFaithBased' | 'is12Step' | 'is24_7';
  booleanField: 'isFaithBased' | 'is12Step' | 'is24_7';
  /** Also check the snake_case variant from DB rows */
  booleanFieldAlt: 'is_faith_based' | 'is_12_step' | 'is24_7';
  textPattern: RegExp;
  label: string;
}

const PREFERENCE_CONFIGS: PreferenceConfig[] = [
  {
    filterKey: 'isFaithBased',
    booleanField: 'isFaithBased',
    booleanFieldAlt: 'is_faith_based',
    textPattern: FAITH_PATTERNS,
    label: 'faith-based',
  },
  {
    filterKey: 'is12Step',
    booleanField: 'is12Step',
    booleanFieldAlt: 'is_12_step',
    textPattern: TWELVE_STEP_PATTERNS,
    label: '12-step',
  },
  {
    filterKey: 'is24_7',
    booleanField: 'is24_7',
    booleanFieldAlt: 'is24_7',
    textPattern: AVAILABILITY_247_PATTERNS,
    label: '24/7',
  },
];

/**
 * Apply preference boosts for active soft filters.
 *
 * Services matching a preference get their rrfScore multiplied:
 * - Tier 1 (boolean match in DB): 1.5x
 * - Tier 2 (text pattern match in description/name): 1.2x
 * - Tier 3 (no match): 1.0x (unchanged)
 *
 * Multiple active preferences stack multiplicatively.
 */
export function applyPreferenceBoosts(
  services: LiteService[],
  filters: SearchFilters,
  options?: BoostOptions,
): LiteService[] {
  // Determine which preferences are active
  const activePrefs = PREFERENCE_CONFIGS.filter(p => filters[p.filterKey] === true);
  if (activePrefs.length === 0) return services;

  const trackExplanations = options?.trackExplanations ?? false;
  const labels = activePrefs.map(p => p.label).join(', ');
  searchLog.debug(`[PreferenceBoost] Active preferences: ${labels}`);

  let boostCount = 0;

  const boosted = services.map(svc => {
    const text = `${svc.name} ${svc.category} ${svc.description}`;
    let multiplier = 1.0;
    const explanations: ScoreExplanation[] = [];

    for (const pref of activePrefs) {
      const svcAny = svc as any;
      const hasBooleanMatch =
        svc[pref.booleanField] === true || svcAny[pref.booleanFieldAlt] === true;

      if (hasBooleanMatch) {
        multiplier *= BOOLEAN_MATCH_MULTIPLIER;
        if (trackExplanations) {
          explanations.push({
            factor: `preference.${pref.label}.boolean`,
            value: BOOLEAN_MATCH_MULTIPLIER,
            reason: `DB ${pref.label} flag is true (${BOOLEAN_MATCH_MULTIPLIER}x)`,
          });
        }
      } else if (pref.textPattern.test(text)) {
        multiplier *= TEXT_MATCH_MULTIPLIER;
        if (trackExplanations) {
          explanations.push({
            factor: `preference.${pref.label}.text`,
            value: TEXT_MATCH_MULTIPLIER,
            reason: `Description matches ${pref.label} keywords (${TEXT_MATCH_MULTIPLIER}x)`,
          });
        }
      }
    }

    if (multiplier === 1.0) return svc;

    boostCount++;
    const newScore = (svc.rrfScore ?? 0) * multiplier;

    const result: LiteService = { ...svc, rrfScore: newScore };

    // Merge explanations into debug info if tracking
    if (trackExplanations && explanations.length > 0) {
      const withDebug = result as LiteServiceWithDebug;
      withDebug.scoreExplanation = [
        ...((svc as LiteServiceWithDebug).scoreExplanation ?? []),
        ...explanations,
      ];
    }

    return result;
  });

  // Re-sort by rrfScore descending so boosted services float to top
  boosted.sort((a, b) => (b.rrfScore ?? 0) - (a.rrfScore ?? 0));

  searchLog.debug(`[PreferenceBoost] Boosted ${boostCount}/${services.length} services`);

  return boosted;
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to preference-boost.ts

**Step 3: Commit**

```bash
git add server/search/strategies/scoring/preference-boost.ts
git commit -m "feat(search): add preference boost scoring module

Adds applyPreferenceBoosts() for soft filter boosting.
Supports faith-based, 12-step, and 24/7 preferences with
both DB boolean matching (1.5x) and text pattern matching (1.2x)."
```

---

### Task 2: Export from scoring barrel

**Files:**
- Modify: `server/search/strategies/scoring/index.ts`

**Step 1: Add export**

Add this line at the end of `server/search/strategies/scoring/index.ts`:

```typescript
export * from './preference-boost';
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add server/search/strategies/scoring/index.ts
git commit -m "feat(search): export preference boost from scoring barrel"
```

---

### Task 3: Remove soft filters from applyHardFilters

**Files:**
- Modify: `server/search/index.ts:72-74`

**Step 1: Remove the three boolean filter lines**

In `server/search/index.ts`, find lines 72-74 inside `applyHardFilters()`:

```typescript
    if (filters.is24_7 === true && !svc.is24_7) return false;
    if (filters.isFaithBased === true && !svc.isFaithBased) return false;
    if (filters.is12Step === true && !svc.is12Step) return false;
```

Delete all three lines.

Also update the JSDoc comment at line 48 to reflect the change. Replace:

```typescript
 * - Boolean filters (is24_7, isFaithBased, is12Step) only applied when value is true
```

with:

```typescript
 * - Boolean preferences (is24_7, isFaithBased, is12Step) are handled by applyPreferenceBoosts, not here
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add server/search/index.ts
git commit -m "refactor(search): remove soft filters from applyHardFilters

isFaithBased, is12Step, and is24_7 are now handled by
applyPreferenceBoosts as scoring boosts instead of hard exclusions."
```

---

### Task 4: Wire preference boosts into Tier 2 path

**Files:**
- Modify: `server/search/strategies/comprehensive.ts:326-336`

**Step 1: Add import**

In `server/search/strategies/comprehensive.ts`, add `applyPreferenceBoosts` to the scoring import block (around line 40-45). Change:

```typescript
import {
  boostByIntent,
  boostByNameMatch,
  applyNegativePenalty,
  type BoostOptions,
} from './scoring';
```

to:

```typescript
import {
  boostByIntent,
  boostByNameMatch,
  applyNegativePenalty,
  applyPreferenceBoosts,
  type BoostOptions,
} from './scoring';
```

**Step 2: Insert preference boost call in Tier 2 path**

Find the Tier 2 early-exit path around line 326-336. After the `boostByIntent` call and before `applyOrganizationDiversity`, add the preference boost. Change:

```typescript
      // Apply minimal intent boosting and return early
      const boosted = boostByIntent(nameMatched, analysis.intent, analysis.raw, analysis, boostOptions);
      let final = analysis.negativeTerms?.length
        ? applyNegativePenalty(boosted, analysis.negativeTerms, boostOptions)
        : boosted;

      // Apply category diversity for location-only queries to ensure mixed results
      if (analysis.intent === 'location_only') {
        final = applyCategoryDiversity(final);
      }

      const finalServices = applyOrganizationDiversity(final, analysis.raw);
```

to:

```typescript
      // Apply minimal intent boosting and return early
      const boosted = boostByIntent(nameMatched, analysis.intent, analysis.raw, analysis, boostOptions);
      let final = analysis.negativeTerms?.length
        ? applyNegativePenalty(boosted, analysis.negativeTerms, boostOptions)
        : boosted;

      // Apply preference boosts for soft UI filters (faith-based, 12-step, 24/7)
      if (input.filters) {
        final = applyPreferenceBoosts(final, input.filters, boostOptions);
      }

      // Apply category diversity for location-only queries to ensure mixed results
      if (analysis.intent === 'location_only') {
        final = applyCategoryDiversity(final);
      }

      const finalServices = applyOrganizationDiversity(final, analysis.raw);
```

**Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add server/search/strategies/comprehensive.ts
git commit -m "feat(search): wire preference boosts into Tier 2 search path"
```

---

### Task 5: Wire preference boosts into Tier 3 path

**Files:**
- Modify: `server/search/strategies/comprehensive.ts:457-468`

**Step 1: Insert preference boost call in Tier 3 path**

Find the Tier 3 full search path around line 457-468. After `boostByIntent` and `applyNegativePenalty`, but before `applyOrganizationDiversity`, add the preference boost. Change:

```typescript
    // Apply negative keyword penalty (e.g., "shelter not religious")
    if (analysis.negativeTerms && analysis.negativeTerms.length > 0) {
      services = applyNegativePenalty(services, analysis.negativeTerms, boostOptions);
    }

    // Apply organization diversity to prevent monopoly in top results
    // Pass query so we can skip limiting when user searches for specific org
    services = applyOrganizationDiversity(services, analysis.raw);
```

to:

```typescript
    // Apply negative keyword penalty (e.g., "shelter not religious")
    if (analysis.negativeTerms && analysis.negativeTerms.length > 0) {
      services = applyNegativePenalty(services, analysis.negativeTerms, boostOptions);
    }

    // Apply preference boosts for soft UI filters (faith-based, 12-step, 24/7)
    if (input.filters) {
      services = applyPreferenceBoosts(services, input.filters, boostOptions);
    }

    // Apply organization diversity to prevent monopoly in top results
    // Pass query so we can skip limiting when user searches for specific org
    services = applyOrganizationDiversity(services, analysis.raw);
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add server/search/strategies/comprehensive.ts
git commit -m "feat(search): wire preference boosts into Tier 3 search path"
```

---

### Task 6: Manual smoke test

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test the fix**

1. Search "i can't stop drinking"
2. Note the number of results (should be ~20-30)
3. Open RefinePanel → toggle "Faith-based" ON
4. Verify results are NOT reduced to 1 — should still show many results
5. Verify faith-based services (e.g., Adara Recovery Centre) appear at/near the top
6. Verify 12-step programs mentioning "Higher Power" or spiritual content appear above secular programs
7. Toggle "12-step program" ON additionally — verify results still plentiful, 12-step + faith-based services dominate top positions

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(search): convert toggle filters to preference boosts

Toggle filters (faith-based, 12-step, 24/7) now boost matching services
to the top instead of excluding non-matching ones. Uses both DB boolean
fields and text-pattern matching on descriptions to catch services
missed by sparse boolean data.

Hard filters (gender, age, category, format, language) remain unchanged."
```
