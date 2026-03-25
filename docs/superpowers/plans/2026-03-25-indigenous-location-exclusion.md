# Indigenous Location Exclusion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a search has indigenous intent, bypass location filtering for indigenous services so reserve/settlement-based services (Siksika, Tsuut'ina, etc.) appear regardless of selected city.

**Architecture:** New `server/search/indigenous.ts` module provides service identification and intent detection helpers. `filterByLocation` gets a split-then-merge approach for selective bypasses. A supplementary SQL query recovers indigenous services killed by location penalty. All changes are in the search pipeline — no DB schema or frontend changes.

**Tech Stack:** TypeScript, Vitest, existing search pipeline patterns

**Spec:** `docs/superpowers/specs/2026-03-24-indigenous-location-exclusion-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `server/search/indigenous.ts` | Create | Service identifier, intent helpers, nation name patterns |
| `server/search/__tests__/indigenous.test.ts` | Create | Tests for `isIndigenousService`, `isIndigenousIntent` |
| `server/search/filters.ts` | Modify | Update `filterByLocation` signature + split-merge bypass |
| `server/search/__tests__/hard-filters.test.ts` | Modify | Add tests for indigenous bypass in `filterByLocation` |
| `server/search/config/analysis.ts` | Modify | Add nation names to indigenous intent patterns |
| `server/search/__tests__/analyzer-intents.test.ts` | Modify | Add tests for "Siksika" etc. triggering indigenous intent |
| `server/search/index.ts` | Modify | Add `supplementIndigenousServices()`, wire bypass through pipeline |
| `server/search/strategies/post-filters.ts` | Modify | DRY up `filterChristianForIndigenous` to use `isIndigenousIntent` |

---

### Task 1: Create Indigenous Service Identifier

**Files:**
- Create: `server/search/__tests__/indigenous.test.ts`
- Create: `server/search/indigenous.ts`

- [ ] **Step 1: Write failing tests for `isIndigenousService`**

```typescript
// server/search/__tests__/indigenous.test.ts
import { describe, it, expect } from 'vitest';
import { isIndigenousService, isIndigenousIntent } from '../indigenous';

describe('isIndigenousService', () => {
  // Category match
  it('matches category "Indigenous Services"', () => {
    expect(isIndigenousService({ name: 'Some Program', category: 'Indigenous Services' })).toBe(true);
  });
  it('matches category case-insensitively', () => {
    expect(isIndigenousService({ name: 'Some Program', category: 'indigenous services' })).toBe(true);
  });
  it('does not match unrelated category', () => {
    expect(isIndigenousService({ name: 'Calgary Clinic', category: 'Healthcare' })).toBe(false);
  });

  // Treaty 7 nations
  it('matches "Siksika Health Services"', () => {
    expect(isIndigenousService({ name: 'Siksika Health Services' })).toBe(true);
  });
  it('matches "Tsuut\'ina Nation Wellness"', () => {
    expect(isIndigenousService({ name: "Tsuut'ina Nation Wellness" })).toBe(true);
  });
  it('matches "Tsuu T\'ina Family Services"', () => {
    expect(isIndigenousService({ name: "Tsuu T'ina Family Services" })).toBe(true);
  });
  it('matches "Piikani Nation Health"', () => {
    expect(isIndigenousService({ name: 'Piikani Nation Health' })).toBe(true);
  });
  it('matches "Kainai Community Health"', () => {
    expect(isIndigenousService({ name: 'Kainai Community Health' })).toBe(true);
  });
  it('matches "Blood Tribe Department of Health"', () => {
    expect(isIndigenousService({ name: 'Blood Tribe Department of Health' })).toBe(true);
  });
  it('matches "Stoney Nakoda Family Services"', () => {
    expect(isIndigenousService({ name: 'Stoney Nakoda Family Services' })).toBe(true);
  });
  it('matches "Blackfoot Family Lodge"', () => {
    expect(isIndigenousService({ name: 'Blackfoot Family Lodge' })).toBe(true);
  });

  // Treaty 6 nations
  it('matches "Ermineskin Cree Nation Health"', () => {
    expect(isIndigenousService({ name: 'Ermineskin Cree Nation Health' })).toBe(true);
  });
  it('matches "Saddle Lake Cree Nation"', () => {
    expect(isIndigenousService({ name: 'Saddle Lake Cree Nation' })).toBe(true);
  });
  it('matches "Alexander First Nation"', () => {
    expect(isIndigenousService({ name: 'Alexander First Nation Health' })).toBe(true);
  });

  // Treaty 8 nations
  it('matches "Mikisew Cree First Nation"', () => {
    expect(isIndigenousService({ name: 'Mikisew Cree First Nation' })).toBe(true);
  });
  it('matches "Dene Tha\' First Nation"', () => {
    expect(isIndigenousService({ name: "Dene Tha' First Nation" })).toBe(true);
  });
  it('matches "Athabasca Chipewyan First Nation"', () => {
    expect(isIndigenousService({ name: 'Athabasca Chipewyan First Nation' })).toBe(true);
  });

  // Metis
  it('matches "Paddle Prairie Metis Settlement"', () => {
    expect(isIndigenousService({ name: 'Paddle Prairie Metis Settlement' })).toBe(true);
  });
  it('matches "Gift Lake Metis Settlement"', () => {
    expect(isIndigenousService({ name: 'Gift Lake Metis Settlement' })).toBe(true);
  });

  // Generic indigenous terms
  it('matches "Indigenous Family Support"', () => {
    expect(isIndigenousService({ name: 'Indigenous Family Support' })).toBe(true);
  });
  it('matches "First Nations Health Consortium"', () => {
    expect(isIndigenousService({ name: 'First Nations Health Consortium' })).toBe(true);
  });
  it('matches "Métis Nation of Alberta"', () => {
    expect(isIndigenousService({ name: 'Métis Nation of Alberta' })).toBe(true);
  });

  // Cultural markers
  it('matches "Edmonton Friendship Centre"', () => {
    expect(isIndigenousService({ name: 'Edmonton Friendship Centre' })).toBe(true);
  });
  it('matches "Native Friendship Centre"', () => {
    expect(isIndigenousService({ name: 'Native Friendship Centre' })).toBe(true);
  });
  it('matches "Native Counselling Services"', () => {
    expect(isIndigenousService({ name: 'Native Counselling Services' })).toBe(true);
  });

  // FALSE POSITIVES — must NOT match
  it('does NOT match "Elizabeth Fry Society"', () => {
    expect(isIndigenousService({ name: 'Elizabeth Fry Society' })).toBe(false);
  });
  it('does NOT match "Stoney Trail Dental Clinic"', () => {
    expect(isIndigenousService({ name: 'Stoney Trail Dental Clinic' })).toBe(false);
  });
  it('does NOT match "Buffalo Lake Campground"', () => {
    expect(isIndigenousService({ name: 'Buffalo Lake Campground' })).toBe(false);
  });
  it('does NOT match "Native Plant Society"', () => {
    expect(isIndigenousService({ name: 'Native Plant Society' })).toBe(false);
  });
  it('does NOT match "Calgary Mental Health Clinic"', () => {
    expect(isIndigenousService({ name: 'Calgary Mental Health Clinic' })).toBe(false);
  });
});

describe('isIndigenousIntent', () => {
  it('returns true for primary indigenous_services', () => {
    expect(isIndigenousIntent('indigenous_services')).toBe(true);
  });
  it('returns true for secondary indigenous_services with high confidence', () => {
    expect(isIndigenousIntent('mental_health', { intent: 'indigenous_services', confidence: 0.7 })).toBe(true);
  });
  it('returns false for secondary with low confidence', () => {
    expect(isIndigenousIntent('mental_health', { intent: 'indigenous_services', confidence: 0.3 })).toBe(false);
  });
  it('returns false for unrelated intent', () => {
    expect(isIndigenousIntent('mental_health')).toBe(false);
  });
  it('returns true at exactly 0.5 confidence threshold', () => {
    expect(isIndigenousIntent('housing_urgent', { intent: 'indigenous_services', confidence: 0.5 })).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/search/__tests__/indigenous.test.ts`
Expected: FAIL — module `../indigenous` does not exist

- [ ] **Step 3: Implement `server/search/indigenous.ts`**

```typescript
// server/search/indigenous.ts
/**
 * Indigenous Service Identifier
 *
 * Single source of truth for identifying indigenous services
 * and detecting indigenous search intent.
 */

// Alberta First Nations and Metis settlement names for pattern matching.
// Flat array — easy to extend as new services are added.
const NATION_NAMES = [
  // Treaty 7
  'siksika', 'tsuut\'ina', 'tsuu t\'ina', 'piikani', 'kainai',
  'blood tribe', 'stoney nakoda', 'stoney nation', 'blackfoot',
  // Treaty 6
  'ermineskin', 'samson cree', 'louis bull', 'enoch cree',
  'alexander first nation', 'saddle lake', 'kehewin', 'frog lake',
  // Treaty 8
  'bigstone cree', 'woodland cree', 'dene tha', 'little red river',
  'tallcree', 'mikisew', 'athabasca chipewyan', 'horse lake',
  // Metis settlements (qualified to avoid false positives)
  'metis settlement', 'paddle prairie', 'gift lake',
  'peavine metis', 'kikino metis', 'fishing lake metis',
];

// Build regex from nation names — escape special chars, join with |
const escapedNations = NATION_NAMES.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

/**
 * Compiled regex for matching indigenous service names.
 * Matches:
 * - Generic indigenous terms (standalone or compound)
 * - Nation/settlement names from the curated list
 * - Cultural markers (friendship centre, native counselling)
 *
 * Does NOT match standalone: "elizabeth", "buffalo lake", "stoney", "native"
 */
export const INDIGENOUS_NAME_PATTERN = new RegExp(
  '\\b(?:' + [
    // Generic terms
    'indigenous',
    'first nations?',
    'm[eé]tis',
    'inuit',
    'aboriginal',
    // Compound-only terms (require specific following word)
    'native friendship',
    'native counselling',
    'native counseling',
    // Cultural markers
    'friendship cent(?:re|er)',
    // Nation/settlement names
    ...escapedNations,
  ].join('|') + ')\\b',
  'i'
);

/**
 * Regex for query-level indigenous intent detection.
 * Includes nation names so bare queries like "Siksika" trigger indigenous intent.
 * Exported for use in analysis.ts intent patterns.
 */
export const INDIGENOUS_QUERY_PATTERN = new RegExp(
  '\\b(?:' + escapedNations.join('|') + ')\\b',
  'i'
);

/**
 * Check if a service is indigenous-focused.
 * Checks category first (fast path), then name pattern.
 * No tag check — LiteService doesn't carry tags.
 * For DB-level checks with tags, use isIndigenousServiceWithTags().
 */
export function isIndigenousService(service: { name: string; category?: string | null }): boolean {
  // Category check (fast path)
  if (service.category && service.category.toLowerCase().includes('indigenous')) {
    return true;
  }
  // Name pattern check
  return INDIGENOUS_NAME_PATTERN.test(service.name);
}

/**
 * Check if a service is indigenous-focused, including tag check.
 * Use this when full service records (with tags) are available (e.g., DB query results).
 */
const INDIGENOUS_TAG_VALUES = new Set(['indigenous', 'first nations', 'métis', 'metis', 'inuit']);

export function isIndigenousServiceWithTags(
  service: { name: string; category?: string | null; tags?: any }
): boolean {
  if (isIndigenousService(service)) return true;
  // Tag check — handle various jsonb formats
  if (service.tags) {
    try {
      const tags = typeof service.tags === 'string' ? JSON.parse(service.tags) : service.tags;
      if (Array.isArray(tags)) {
        return tags.some(t => {
          const val = (typeof t === 'string' ? t : t?.name || t?.value || '').toLowerCase();
          return INDIGENOUS_TAG_VALUES.has(val);
        });
      }
    } catch {
      // Malformed tags — skip
    }
  }
  return false;
}

/**
 * Check if search intent indicates an indigenous query.
 * Matches the same logic used by filterChristianForIndigenous.
 */
export function isIndigenousIntent(
  primaryIntent: string,
  secondaryIntent?: { intent: string; confidence: number },
): boolean {
  return (
    primaryIntent === 'indigenous_services' ||
    (secondaryIntent?.intent === 'indigenous_services' &&
      secondaryIntent.confidence >= 0.5)
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/search/__tests__/indigenous.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/search/indigenous.ts server/search/__tests__/indigenous.test.ts
git commit -m "feat(search): add indigenous service identifier module"
```

---

### Task 2: Update `filterByLocation` Signature and Bypass Logic

**Files:**
- Modify: `server/search/filters.ts:23-45`
- Modify: `server/search/__tests__/hard-filters.test.ts`

- [ ] **Step 1: Write failing tests for the new bypass behavior**

Add to `server/search/__tests__/hard-filters.test.ts`:

```typescript
import { isIndigenousService } from '../indigenous';

describe('filterByLocation — indigenous service bypass', () => {
  it('keeps indigenous service from different city when skipForService provided', () => {
    const svcs = [
      makeSvc({ id: '1', name: 'Siksika Health Services', location: 'Siksika Nation' }),
      makeSvc({ id: '2', name: 'Calgary Clinic', location: 'Calgary' }),
      makeSvc({ id: '3', name: 'Edmonton Shelter', location: 'Edmonton' }),
    ];
    const result = filterByLocation(svcs, 'calgary', { skipForService: isIndigenousService });
    expect(result.map(s => s.id)).toEqual(expect.arrayContaining(['1', '2']));
    expect(result.map(s => s.id)).not.toContain('3');
  });

  it('skipAll still works (crisis behavior)', () => {
    const svcs = [
      makeSvc({ id: '1', name: 'Edmonton Service', location: 'Edmonton' }),
    ];
    const result = filterByLocation(svcs, 'calgary', { skipAll: true });
    expect(result.map(s => s.id)).toEqual(['1']);
  });

  it('bypassed indigenous services skip province-wide suppression', () => {
    const svcs = [
      makeSvc({ id: '1', name: 'Indigenous Wellness Alberta', location: 'Alberta (province-wide)', category: 'Indigenous Services' }),
      makeSvc({ id: '2', name: 'Indigenous Wellness Calgary', location: 'Calgary', category: 'Indigenous Services' }),
    ];
    const result = filterByLocation(svcs, 'calgary', { skipForService: isIndigenousService });
    // Both should survive — indigenous services exempt from suppression
    expect(result.map(s => s.id)).toEqual(expect.arrayContaining(['1', '2']));
  });

  it('non-indigenous province-wide is still suppressed normally', () => {
    const svcs = [
      makeSvc({ id: '1', name: 'Alcoholics Anonymous Alberta', location: 'Alberta (province-wide)' }),
      makeSvc({ id: '2', name: 'Alcoholics Anonymous Calgary', location: 'Calgary' }),
      makeSvc({ id: '3', name: 'Siksika Health Services', location: 'Siksika Nation' }),
    ];
    const result = filterByLocation(svcs, 'calgary', { skipForService: isIndigenousService });
    // AA Alberta suppressed by AA Calgary, Siksika kept
    expect(result.map(s => s.id)).toEqual(expect.arrayContaining(['2', '3']));
    expect(result.map(s => s.id)).not.toContain('1');
  });

  it('backward compatible: isCrisis boolean still works via skipAll', () => {
    // This tests that existing callers can be migrated
    const svcs = [
      makeSvc({ id: '1', name: 'Edmonton Service', location: 'Edmonton' }),
    ];
    const result = filterByLocation(svcs, 'calgary', { skipAll: true });
    expect(result).toHaveLength(1);
  });

  it('no opts behaves same as before', () => {
    const svcs = [
      makeSvc({ id: '1', name: 'Calgary Clinic', location: 'Calgary' }),
      makeSvc({ id: '2', name: 'Edmonton Shelter', location: 'Edmonton' }),
    ];
    const result = filterByLocation(svcs, 'calgary');
    expect(result.map(s => s.id)).toEqual(['1']);
  });
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `npx vitest run server/search/__tests__/hard-filters.test.ts`
Expected: New indigenous bypass tests FAIL (filterByLocation doesn't accept opts object yet)

- [ ] **Step 3: Update `filterByLocation` implementation**

Replace the existing `filterByLocation` function in `server/search/filters.ts` (lines 15-45):

```typescript
/**
 * Options for filterByLocation behavior.
 */
export interface LocationFilterOpts {
  /** If true, skip location filtering entirely (crisis safety behavior). */
  skipAll?: boolean;
  /** Per-service predicate — services where this returns true bypass location filtering AND suppression. */
  skipForService?: (svc: LiteService) => boolean;
}

/**
 * Filter services by location.
 * When a user selects a city from the dropdown, exclude services clearly in other cities.
 * Services with province-wide, null/empty, online, or ambiguous locations pass through.
 *
 * @param opts.skipAll - If true, skip location filtering entirely. Crisis services (988, distress lines)
 *   must ALWAYS be shown regardless of location filter — this is a life-safety requirement.
 * @param opts.skipForService - Per-service bypass predicate. Services where this returns true
 *   skip both location filtering and province-wide suppression (used for indigenous services).
 */
export function filterByLocation(
  services: LiteService[],
  location: string | null | undefined,
  opts?: LocationFilterOpts,
): LiteService[] {
  // SAFETY: Never filter crisis results by location — someone in crisis needs 988 and hotlines
  // regardless of what city they selected in the dropdown
  if (!location || opts?.skipAll) return services;

  // Split: bypassed services skip both location filtering and suppression
  const bypassed: LiteService[] = [];
  const rest: LiteService[] = [];
  if (opts?.skipForService) {
    for (const svc of services) {
      if (opts.skipForService(svc)) {
        bypassed.push(svc);
      } else {
        rest.push(svc);
      }
    }
  } else {
    rest.push(...services);
  }

  const loc = location.toLowerCase();
  const filtered = rest.filter(svc => {
    const svcLoc = (svc.location || '').toLowerCase().trim();
    // No location data → could be available anywhere → keep
    if (!svcLoc) return true;
    // Contains the specified city → keep
    if (svcLoc.includes(loc)) return true;
    // Province-wide / Alberta-wide / Canada-wide → keep
    if (svcLoc.includes('province-wide') || svcLoc.includes('alberta-wide') || svcLoc.includes('across alberta') || svcLoc.includes('canada-wide')) return true;
    // Online/virtual/phone services → keep
    if (svcLoc.includes('online') || svcLoc.includes('virtual') || svcLoc.includes('phone') || svcLoc.includes('telehealth')) return true;
    // Bare "Multiple locations" with no city qualifier → could include any city → keep
    if (svcLoc === 'multiple locations') return true;
    // Everything else is clearly in a different city → exclude
    return false;
  });

  // Suppression only runs on non-bypassed services
  const suppressed = suppressRedundantProvinceWide(filtered);
  return [...suppressed, ...bypassed];
}
```

- [ ] **Step 4: Run ALL filter tests to verify pass + no regressions**

Run: `npx vitest run server/search/__tests__/hard-filters.test.ts`
Expected: All tests PASS (both new and existing)

- [ ] **Step 5: Commit**

```bash
git add server/search/filters.ts server/search/__tests__/hard-filters.test.ts
git commit -m "feat(search): add selective location bypass to filterByLocation"
```

---

### Task 3: Add Nation Names to Intent Detection

**Files:**
- Modify: `server/search/config/analysis.ts:526-533`
- Modify: `server/search/__tests__/analyzer-intents.test.ts`

- [ ] **Step 1: Write failing intent detection tests**

Add to `server/search/__tests__/analyzer-intents.test.ts`:

```typescript
describe('Intent Detection — Indigenous nation names', () => {
  it('detects indigenous_services for "Siksika"', () => {
    const analysis = analyzeQuery('Siksika');
    expect(analysis.intent).toBe('indigenous_services');
  });

  it('detects indigenous_services for "Tsuut\'ina wellness"', () => {
    const analysis = analyzeQuery("Tsuut'ina wellness");
    expect(analysis.intent).toBe('indigenous_services');
  });

  it('detects indigenous_services for "Blackfoot health services"', () => {
    const analysis = analyzeQuery('Blackfoot health services');
    expect(analysis.intent).toBe('indigenous_services');
  });

  it('detects indigenous_services for "Kainai community"', () => {
    const analysis = analyzeQuery('Kainai community');
    expect(analysis.intent).toBe('indigenous_services');
  });

  it('detects indigenous_services for "Ermineskin Cree"', () => {
    const analysis = analyzeQuery('Ermineskin Cree');
    expect(analysis.intent).toBe('indigenous_services');
  });

  it('detects indigenous_services for "Mikisew Cree First Nation"', () => {
    const analysis = analyzeQuery('Mikisew Cree First Nation');
    expect(analysis.intent).toBe('indigenous_services');
  });

  it('detects indigenous_services for "friendship centre"', () => {
    const analysis = analyzeQuery('friendship centre');
    expect(analysis.intent).toBe('indigenous_services');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/search/__tests__/analyzer-intents.test.ts`
Expected: New nation name tests FAIL

- [ ] **Step 3: Add `INDIGENOUS_QUERY_PATTERN` to intent patterns**

In `server/search/config/analysis.ts`, add import and append to `indigenous_services` patterns (around line 526):

```typescript
// Add import at top of file
import { INDIGENOUS_QUERY_PATTERN } from '../indigenous';
```

Then add `INDIGENOUS_QUERY_PATTERN` to the `indigenous_services` array (after the existing patterns at line 532):

```typescript
    indigenous_services: [
      /\b(?:indigenous|first nations?|métis|metis|inuit|native|aboriginal).*(?:services?|support|help|resources?)/i,
      /\b(?:treaty|reserve|band office|status card|status indian)\b/i,
      /\b(?:elder|smudging|sweat lodge|ceremony|medicine wheel|traditional healing)\b/i,
      /\b(?:residential school|sixties scoop|MMIWG|missing.*murdered.*indigenous)\b/i,
      /\b(?:indigenous|native|aboriginal).*(?:mental health|addiction|healing|wellness)\b/i,
      /\b(?:jordan'?s principle|nihb|non-?insured health benefits)\b/i,
      INDIGENOUS_QUERY_PATTERN,  // Nation/settlement names trigger indigenous intent
    ],
```

- [ ] **Step 4: Run tests to verify pass + no regressions**

Run: `npx vitest run server/search/__tests__/analyzer-intents.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/search/config/analysis.ts server/search/__tests__/analyzer-intents.test.ts
git commit -m "feat(search): add nation names to indigenous intent detection"
```

---

### Task 4: Wire Bypass Through Search Pipeline

**Files:**
- Modify: `server/search/index.ts:10,163-210,488-499,628-644`
- Modify: `server/search/strategies/post-filters.ts:272-279`

- [ ] **Step 1: Add imports to `server/search/index.ts`**

Add at the import section (around line 42-44):

```typescript
import { isIndigenousService, isIndigenousServiceWithTags, isIndigenousIntent } from './indigenous';
import type { LocationFilterOpts } from './filters';
```

- [ ] **Step 2: Bump cache version**

In `server/search/index.ts` line 10, change:

```typescript
const CACHE_VERSION = 'v167';
```

- [ ] **Step 3: Update `supplementCategories` to accept location filter opts**

Change the `supplementCategories` function signature (line 163) to accept opts:

```typescript
async function supplementCategories(
  services: LiteService[],
  filters: SearchFilters,
  location: string | null | undefined,
  locationOpts?: LocationFilterOpts,
): Promise<LiteService[]> {
```

And update the `filterByLocation` call inside it (line 195):

```typescript
  supplements = filterByLocation(supplements, location, locationOpts);
```

- [ ] **Step 4: Create `supplementIndigenousServices` function**

Add after `supplementCategories` (around line 210):

```typescript
/**
 * Supplementary query to recover indigenous services killed by SQL location penalty.
 * Re-runs fastSearch without location filter, keeps only indigenous matches,
 * deduplicates against existing results.
 *
 * Only runs when:
 * - Indigenous intent is detected (primary or secondary)
 * - A location filter is active (otherwise no services were penalized)
 */
async function supplementIndigenousServices(
  services: LiteService[],
  query: string,
  location: string | null | undefined,
  analysis: QueryAnalysis,
): Promise<LiteService[]> {
  // Only supplement when indigenous intent + location filter active
  if (!isIndigenousIntent(analysis.intent, analysis.intents.secondary)) return services;
  if (!location) return services;

  const existingIds = new Set(services.map(s => s.id));

  try {
    // Re-run search WITHOUT location filter to recover penalized services
    const unfiltered = await storage.fastSearch(query, null, false, 50);

    // Keep only indigenous services not already in results
    const indigenous = unfiltered
      .filter(r => !existingIds.has(r.serviceId) && isIndigenousServiceWithTags(r))
      .map(r => ({
        id: r.serviceId,
        name: r.name,
        category: r.category,
        description: (r.description || '').slice(0, 300),
        location: r.address || r.location || '',
        waitTimes: r.waitTimes || '',
        phone: r.phone || undefined,
        is24_7: r.is24_7 ?? undefined,
        genderRestriction: r.genderRestriction ?? null,
        ageGroup: r.ageGroup ?? null,
        isFaithBased: r.isFaithBased ?? null,
        is12Step: r.is12Step ?? null,
        serviceFormat: r.serviceFormat ?? null,
        languagesSupported: r.languagesSupported ?? null,
        // Preserve SQL relevance as a rough rrfScore for ranking
        rrfScore: r.relevanceScore / 200, // Normalize to ~0-1 range
      } as LiteService));

    if (indigenous.length > 0) {
      console.log(`[SearchOrchestrator] Indigenous supplement: +${indigenous.length} services recovered from location penalty`);
    }
    return [...services, ...indigenous];
  } catch (err) {
    console.warn('[SearchOrchestrator] Indigenous supplement failed:', err);
    return services;
  }
}
```

- [ ] **Step 5: Wire bypass into cached results path**

Update `server/search/index.ts` around line 490-499. Replace:

```typescript
    services = filterByLocation(services, analysis.location.specified || input.location, isDirectCrisisCached);
```

With:

```typescript
    const cachedLocationOpts: LocationFilterOpts = { skipAll: isDirectCrisisCached };
    if (isIndigenousIntent(analysis.intent, analysis.intents.secondary)) {
      cachedLocationOpts.skipForService = isIndigenousService;
    }
    services = filterByLocation(services, analysis.location.specified || input.location, cachedLocationOpts);

    // Recover indigenous services killed by SQL location penalty
    services = await supplementIndigenousServices(services, analysis.corrected, analysis.location.specified || input.location, analysis);
```

And update the `supplementCategories` call (line 499) to pass opts:

```typescript
      services = await supplementCategories(services, cachedFilters, analysis.location.specified || input.location, cachedLocationOpts);
```

- [ ] **Step 6: Wire bypass into fresh results path**

Update `server/search/index.ts` around line 630-642. Replace:

```typescript
  result.services = filterByLocation(result.services, analysis.location.specified || input.location, isDirectCrisisFresh);
```

With:

```typescript
  const freshLocationOpts: LocationFilterOpts = { skipAll: isDirectCrisisFresh };
  if (isIndigenousIntent(analysis.intent, analysis.intents.secondary)) {
    freshLocationOpts.skipForService = isIndigenousService;
  }
  result.services = filterByLocation(result.services, analysis.location.specified || input.location, freshLocationOpts);

  // Recover indigenous services killed by SQL location penalty
  result.services = await supplementIndigenousServices(result.services, analysis.corrected, analysis.location.specified || input.location, analysis);
```

And update the `supplementCategories` call (line 642) to pass opts:

```typescript
    result.services = await supplementCategories(result.services, freshFilters, analysis.location.specified || input.location, freshLocationOpts);
```

- [ ] **Step 7: DRY up `filterChristianForIndigenous`**

In `server/search/strategies/post-filters.ts`, replace the inline check (lines 272-279):

```typescript
import { isIndigenousIntent } from '../indigenous';

export function filterChristianForIndigenous(
  services: LiteService[],
  primaryIntent: string,
  secondaryIntent?: { intent: string; confidence: number },
): LiteService[] {
  if (!isIndigenousIntent(primaryIntent, secondaryIntent)) return services;
```

- [ ] **Step 8: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 9: Run all search tests**

Run: `npx vitest run server/search/`
Expected: All tests PASS

- [ ] **Step 10: Commit**

```bash
git add server/search/index.ts server/search/strategies/post-filters.ts
git commit -m "feat(search): wire indigenous location bypass through search pipeline"
```

---

### Task 5: Integration Verification

**Files:**
- No new files — manual verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS, no regressions

- [ ] **Step 2: Run TypeScript check**

Run: `npm run check`
Expected: No errors

- [ ] **Step 3: Test with dev server (if DB available)**

Run: `npm run dev`

Test queries:
1. Search "Siksika" with Calgary selected → should see Siksika services
2. Search "indigenous mental health" with Calgary selected → should see indigenous services from all locations + Calgary mental health services
3. Search "mental health" with Calgary selected → should NOT show out-of-city indigenous services (no indigenous intent)
4. Search "indigenous services" with NO location → should show all indigenous services (no supplement needed)

- [ ] **Step 4: Update CLAUDE.md cache version reference**

Update the cache version reference in CLAUDE.md from v158 to v167 (in the "Search Architecture — Design Decisions" section, search for "Cache version").

- [ ] **Step 5: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: update cache version reference to v167"
```
