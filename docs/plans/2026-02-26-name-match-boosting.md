# Name-Match Boosting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure services searched by name always rank #1 via exact name, alias, and partial-name boosts applied early in the pipeline.

**Architecture:** Add `boostByNameMatch()` as a dedicated scoring step that runs before `boostByIntent()`. Replace the hardcoded 5-alias map in `analyzer.ts` with a cached database lookup. Remove the old `directNameMatch` logic from `boostByIntent()` to avoid double-boosting.

**Tech Stack:** TypeScript, PostgreSQL (service_aliases table), Drizzle ORM

---

### Task 1: Add `nameMatch` config section

**Files:**
- Modify: `server/search/config.ts:12-19`

**Step 1: Replace `directNameMatch` with `nameMatch` in SCORING_CONFIG**

In `server/search/config.ts`, replace the `directNameMatch` section (lines 13-19):

```typescript
// OLD (remove):
directNameMatch: {
  multiWord: 500,
  singleWord: 100,
  singleWordCommon: 20,
  minWords: 2,
},

// NEW (replace with):
nameMatch: {
  exact: 500,       // Exact service name match (case-insensitive)
  alias: 500,       // Known alias match from service_aliases table
  partial: 250,     // All query words (2+ non-stoplist) appear in name
},
```

**Step 2: Update any TypeScript references to `directNameMatch`**

Search for `directNameMatch` across the codebase and update references. The main reference is in `scoring.ts` which will be updated in Task 3.

**Step 3: Commit**

```bash
git add server/search/config.ts
git commit -m "refactor(config): replace directNameMatch with nameMatch scoring config"
```

---

### Task 2: Add `boostByNameMatch()` function to scoring.ts

**Files:**
- Modify: `server/search/strategies/scoring.ts`

**Step 1: Add the `boostByNameMatch` function**

Add this function after the imports and before `boostByIntent` (around line 30, after the `BOOST_CONFIG` alias):

```typescript
/**
 * Boost services by name/alias match. Runs BEFORE boostByIntent.
 *
 * Tiers:
 * 1. Exact name match (case-insensitive): +500
 * 2. Alias match (from service_aliases DB table): +500
 * 3. Partial name match (all 2+ non-stoplist query words in name): +250
 */
export function boostByNameMatch(
  services: LiteService[],
  rawQuery: string,
  aliasLookup: Map<string, string>,
  options?: BoostOptions
): LiteService[] {
  const cfg = SCORING_CONFIG;
  const trackExplanations = options?.trackExplanations ?? false;
  const queryLower = rawQuery.toLowerCase().trim();

  // Build reverse alias map: serviceId -> set of aliases
  const serviceAliases = new Map<string, Set<string>>();
  for (const [alias, serviceId] of aliasLookup) {
    if (!serviceAliases.has(serviceId)) {
      serviceAliases.set(serviceId, new Set());
    }
    serviceAliases.get(serviceId)!.add(alias);
  }

  // Stoplist for partial match filtering (same as existing)
  const commonWordStoplist = new Set([
    'meals', 'meal', 'help', 'support', 'community', 'family', 'families',
    'service', 'services', 'center', 'centre', 'program', 'programs',
    'care', 'health', 'mental', 'housing', 'shelter', 'food', 'free',
    'counselling', 'counseling', 'therapy', 'group', 'groups', 'crisis',
    'emergency', 'assistance', 'resource', 'resources', 'outreach',
    'youth', 'adult', 'seniors', 'senior', 'women', 'men', 'children',
    'calgary', 'alberta', 'society', 'foundation', 'association',
  ]);

  // Pre-compute query words for partial matching
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  const nonStoplistWords = queryWords.filter(w => !commonWordStoplist.has(w));

  return services.map(svc => {
    let boost = 0;
    const explanations: ScoreExplanation[] = [];
    const nameLower = svc.name.toLowerCase();

    const addFactor = (factor: string, value: number, reason: string) => {
      boost += value;
      if (trackExplanations) {
        explanations.push({ factor, value, reason });
      }
    };

    // Tier 1: Exact name match
    if (queryLower === nameLower) {
      addFactor('nameMatch.exact', cfg.nameMatch.exact, `Exact name match: "${svc.name}"`);
      console.log(`[NameMatch] "${svc.name.substring(0, 40)}" +${cfg.nameMatch.exact} exact name match`);
    }
    // Tier 2: Alias match
    else if (serviceAliases.has(svc.id)) {
      const aliases = serviceAliases.get(svc.id)!;
      if (aliases.has(queryLower)) {
        addFactor('nameMatch.alias', cfg.nameMatch.alias, `Alias match: "${queryLower}" -> "${svc.name}"`);
        console.log(`[NameMatch] "${svc.name.substring(0, 40)}" +${cfg.nameMatch.alias} alias match for "${queryLower}"`);
      }
    }

    // Tier 3: Partial name match (requires 2+ non-stoplist words, ALL must appear in name)
    if (boost === 0 && nonStoplistWords.length >= 2) {
      const allMatch = nonStoplistWords.every(w => nameLower.includes(w));
      if (allMatch) {
        addFactor('nameMatch.partial', cfg.nameMatch.partial, `Partial name match: all ${nonStoplistWords.length} words in name`);
        console.log(`[NameMatch] "${svc.name.substring(0, 40)}" +${cfg.nameMatch.partial} partial match (${nonStoplistWords.join(', ')})`);
      }
    }

    if (boost === 0) return svc;

    const result = {
      ...svc,
      score: (svc.score || 0) + boost,
    };
    if (trackExplanations) {
      (result as LiteServiceWithDebug).scoreExplanation = [
        ...((svc as LiteServiceWithDebug).scoreExplanation || []),
        ...explanations,
      ];
    }
    return result;
  }).sort((a, b) => (b.score || 0) - (a.score || 0));
}
```

**Step 2: Export it**

The function is already exported via the `export` keyword. Verify it's accessible from `comprehensive.ts`.

**Step 3: Commit**

```bash
git add server/search/strategies/scoring.ts
git commit -m "feat(scoring): add boostByNameMatch function for exact/alias/partial name boosting"
```

---

### Task 3: Remove old name-matching logic from `boostByIntent()`

**Files:**
- Modify: `server/search/strategies/scoring.ts:196-223`

**Step 1: Remove the `directNameMatch` block**

In `boostByIntent()`, delete lines 196-223 (the entire block from `// Direct name match boost` through the closing `}`). This includes:
- The `commonWordStoplist` set
- The `queryWords` and `nameMatchCount` logic
- The `directNameMatch.multiWord`, `directNameMatch.singleWord`, and `directNameMatch.singleWordCommon` boost applications

The next line after deletion should be `// Intent-based boosting (if applicable)` (currently line 225).

**Step 2: Verify no remaining references to `directNameMatch`**

Run: `grep -r "directNameMatch" server/`

Expected: No matches (config was updated in Task 1).

**Step 3: Commit**

```bash
git add server/search/strategies/scoring.ts
git commit -m "refactor(scoring): remove duplicate directNameMatch logic from boostByIntent"
```

---

### Task 4: Cache alias map and wire `boostByNameMatch` into pipeline

**Files:**
- Modify: `server/search/strategies/comprehensive.ts`

**Step 1: Add import for `boostByNameMatch`**

At `comprehensive.ts:41`, add `boostByNameMatch` to the import from `./scoring`:

```typescript
import {
  boostByIntent,
  boostByNameMatch,
  applyNegativePenalty,
  type BoostOptions,
} from './scoring';
```

**Step 2: Add cached alias map**

After the `embeddingCache` declaration (around line 64), add:

```typescript
// Cached alias lookup map: alias -> serviceId (loaded once from DB)
let aliasLookupCache: Map<string, string> | null = null;

async function getAliasLookup(): Promise<Map<string, string>> {
  if (!aliasLookupCache) {
    aliasLookupCache = await storage.getAliasLookup();
    console.log(`[ComprehensiveSearch] Loaded ${aliasLookupCache.size} aliases from database`);
  }
  return aliasLookupCache;
}
```

**Step 3: Wire `boostByNameMatch` into the Tier 3 (full hybrid) pipeline**

In the `search()` method, after age filtering (line 423) and before intent boosting (line 433), add the name match boost:

```typescript
    // Apply age-based filtering for high-confidence queries
    const ageDetection = detectAgeGroup(analysis.raw);
    services = applyAgeFilter(services, ageDetection);

    // Apply name-match boosting (before intent boosting so it's not diluted)
    const aliasMap = await getAliasLookup();
    services = boostByNameMatch(services, analysis.raw, aliasMap, boostOptions);

    // Apply intent-based boosting for domain intents or when any preference is detected
```

**Step 4: Wire `boostByNameMatch` into the Tier 2 (high-confidence SQL) early return path**

In the Tier 2 path (around line 307), add `boostByNameMatch` before `boostByIntent`:

```typescript
      // Apply name-match boosting first
      const aliasMap = await getAliasLookup();
      const nameMatched = boostByNameMatch(services, analysis.raw, aliasMap, boostOptions);

      // Apply minimal boosting and return early
      const boosted = boostByIntent(nameMatched, analysis.intent, analysis.raw, analysis, boostOptions);
```

**Step 5: Commit**

```bash
git add server/search/strategies/comprehensive.ts
git commit -m "feat(search): wire boostByNameMatch into search pipeline before intent boosting"
```

---

### Task 5: Replace hardcoded alias map in analyzer.ts with DB lookup

**Files:**
- Modify: `server/search/analyzer.ts:137-155`

**Step 1: Update `findAliasMatch` to accept an alias map parameter**

Replace the function at lines 137-155:

```typescript
/**
 * Find if any keyword matches a known service alias
 */
function findAliasMatch(keywords: string[], aliasLookup?: Map<string, string>): string | null {
  if (!aliasLookup || aliasLookup.size === 0) return null;

  for (const kw of keywords) {
    const lower = kw.toLowerCase();
    const serviceId = aliasLookup.get(lower);
    if (serviceId) {
      return serviceId;
    }
  }

  // Also check multi-word combinations (e.g., "kids help phone" as full phrase)
  const fullPhrase = keywords.join(' ').toLowerCase();
  const phraseMatch = aliasLookup.get(fullPhrase);
  if (phraseMatch) {
    return phraseMatch;
  }

  return null;
}
```

**Step 2: Update `analyzeQuery` signature to accept alias map**

Change the function signature at line 29:

```typescript
export function analyzeQuery(
  query: string,
  userSelectedLocation?: string | null,
  aliasLookup?: Map<string, string>
): QueryAnalysis {
```

And update the call to `findAliasMatch` inside `analyzeQuery` to pass the alias map. Find the line where `findAliasMatch(keywords)` is called and change it to `findAliasMatch(keywords, aliasLookup)`.

**Step 3: Update callers of `analyzeQuery`**

In `server/search/index.ts`, update the two calls to `analyzeQuery` (lines 87 and 108). The one on line 108 is the main search path — pass the alias map there. Line 87 is the precomputed path where alias lookup isn't critical, so pass nothing (the parameter is optional).

At the top of the `search()` function in `index.ts` (before line 108), load the alias map:

```typescript
// Load alias map for query analysis
const aliasMap = await storage.getAliasLookup();
const analysis = analyzeQuery(input.query, input.location, aliasMap);
```

Note: This duplicates the alias loading. To avoid that, export `getAliasLookup` from `comprehensive.ts` or create a shared cache. For simplicity, `storage.getAliasLookup()` is fast (single DB query) and the comprehensive strategy also caches it. This is acceptable.

**Step 4: Commit**

```bash
git add server/search/analyzer.ts server/search/index.ts
git commit -m "refactor(analyzer): replace hardcoded alias map with database-backed lookup"
```

---

### Task 6: Verify and test

**Files:**
- None (manual verification)

**Step 1: Build and check for TypeScript errors**

Run: `npx tsc --noEmit`

Expected: No errors.

**Step 2: Start the dev server and test name searches**

Run: `npm run dev`

Test these queries in the browser/API:
1. **Exact name match:** Search "SMART Recovery" — should be #1
2. **Alias match:** Search "CMHA" — Canadian Mental Health Association should be #1
3. **Alias match:** Search "AA" — Alcoholics Anonymous should be #1
4. **Partial name match:** Search "Kids Help" — Kids Help Phone should be #1
5. **Single common word (no partial boost):** Search "help" — should NOT give any service a +250 partial boost
6. **General query:** Search "food bank" — should still return relevant food services

**Step 3: Check console logs**

Look for `[NameMatch]` log lines showing the boosts being applied correctly.

**Step 4: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: address issues found during name-match testing"
```
