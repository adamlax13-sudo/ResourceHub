# Indigenous Location Exclusion — Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Problem:** Indigenous services located on First Nations reserves (Siksika, Tsuut'ina, etc.) and Metis settlements get excluded when a user selects a city like "Calgary" as their location filter. These services are valuable to anyone searching for indigenous resources regardless of which city they selected.

## Decision

When a search has indigenous intent, indigenous services bypass location filtering at both the SQL and post-cache levels. Non-indigenous services in the same result set are still location-filtered normally. Indigenous services are identified by a combination of category, tags (at DB level), and service name pattern matching against a curated list of Alberta First Nations, Metis settlements, and indigenous cultural markers.

## Components

### 1. Indigenous Service Identifier — `server/search/indigenous.ts`

New file. Single source of truth for indigenous service identification.

**Exports:**

- `INDIGENOUS_NAME_PATTERN` — compiled regex (module-level constant). Matches against service name only.
- `isIndigenousService(service: { name: string; category?: string }): boolean` — checks category then name pattern. No tag check (LiteService doesn't carry tags).
- `isIndigenousIntent(primaryIntent: string, secondaryIntent?: { intent: string; confidence: number }): boolean` — returns true when primary is `indigenous_services` OR secondary is `indigenous_services` with confidence >= 0.5.
- `INDIGENOUS_QUERY_PATTERN` — regex of nation/settlement names for intent detection, exported for use in `analysis.ts`.

**Category matching:** Checks if `service.category` case-insensitively contains `"indigenous"`. In the current database, the relevant category value is `"Indigenous Services"` (set via migration `add_category_improvements.sql`). Services categorized under other categories like "Healthcare" will not match via category — they are caught by name pattern instead.

**Name pattern covers:**

| Group | Terms |
|-------|-------|
| Generic | `indigenous`, `first nation(s?)`, `métis`/`metis`, `inuit`, `aboriginal` |
| Compound-only | `native friendship`, `native counselling`/`counseling` |
| Treaty 7 | `siksika`, `tsuut'ina`/`tsuu t'ina`, `piikani`, `kainai`, `blood tribe`, `stoney nakoda`/`stoney nation`, `blackfoot` |
| Treaty 6 | `ermineskin`, `samson cree`, `louis bull`, `enoch cree`, `alexander first nation`, `saddle lake`, `kehewin`, `frog lake` |
| Treaty 8 | `bigstone cree`, `woodland cree`, `dene tha'?`, `little red river`, `tallcree`, `mikisew`, `athabasca chipewyan`, `horse lake` |
| Metis (qualified) | `metis settlement`, `paddle prairie`, `gift lake`, `peavine metis`, `kikino metis`, `fishing lake metis` |
| Cultural | `friendship cent(?:re\|er)` |

**Excluded standalone terms:** `elizabeth` (Elizabeth Fry Society false positive), `buffalo lake` (geographic ambiguity), `stoney` (Stoney Trail road), `native` (too broad).

### 2. Intent Detection Update — `server/search/config/analysis.ts`

Add `INDIGENOUS_QUERY_PATTERN` (imported from `indigenous.ts`) to the `indigenous_services` intent pattern array. This ensures bare queries like "Siksika" or "Tsuut'ina wellness" trigger `indigenous_services` intent, which activates the location bypass.

Without this change, searching just "Siksika" would not trigger indigenous intent because existing patterns require compound phrases like "indigenous...services."

### 3. SQL-Level Bypass — Supplementary Query in `server/search/index.ts`

New function `supplementIndigenousServices()`. Follows the existing `supplementCategories()` pattern.

**Behavior:**
1. Only runs when `isIndigenousIntent()` returns true AND a location filter is active. When no location is set, all services already pass through unpenalized — the supplement would produce only duplicates and waste a DB round-trip.
2. Calls `optimized_search(query, NULL)` — same query, no location filter
3. Filters SQL results to only services where `isIndigenousService()` is true (at DB level, can also check tags since full service records are available)
4. Deduplicates by service ID against main results (keeps main version if duplicate — it has proper RRF score)
5. Converts new-only services to LiteService with their SQL relevance score preserved
6. Merges into result set

**Why not fetch all indigenous services blindly:** A query for "indigenous mental health Calgary" should surface Siksika Health Services but NOT Siksika Housing. Re-running the search query without location gives us indigenous services that are *relevant to the query* but were killed by the -100 location penalty.

**Pipeline position:** Runs after `filterByLocation`, before `applyHardFilters`. This is a new insertion point between the existing `filterByLocation` call and the `applyHardFilters` call. Hard filters (gender, age, service format) still apply to indigenous supplements. Runs in **both** the cached results path (after line ~492) and the fresh results path (after line ~632), same as how `supplementCategories` runs in both paths.

**Performance:** This re-runs `optimized_search` a second time (without location). For indigenous queries this roughly doubles SQL cost. Acceptable because: (a) it only fires when indigenous intent is detected (small fraction of queries), (b) the materialized view makes the query fast, and (c) it mirrors the cost of the initial search which is already within latency budget.

**Why not modify the SQL function:** The `optimized_search()` PostgreSQL function doesn't know about search intent. Adding intent awareness to SQL would couple the database function to application-layer concerns. The supplement pattern is already proven (used by `supplementCategories`) and keeps the SQL function generic.

### 4. Post-Cache Filter Update — `server/search/filters.ts`

Change `filterByLocation` signature:

```typescript
// Before
filterByLocation(services: LiteService[], location: string | null | undefined, isCrisis?: boolean): LiteService[]

// After
filterByLocation(services: LiteService[], location: string | null | undefined, opts?: {
  skipAll?: boolean;           // crisis behavior — skip filtering for everything
  skipForService?: (svc: LiteService) => boolean;  // selective bypass per service
}): LiteService[]
```

**Migration:** `isCrisis` boolean callers become `{ skipAll: isCrisis }`. Indigenous intent callers pass `{ skipForService: isIndigenousService }`. When both crisis and indigenous intent apply, `skipAll` takes precedence (crisis already skips everything). Both flags can be passed together: `{ skipAll: isCrisis, skipForService: isIndigenousService }`.

**Filtering logic:** Inside `filterByLocation`, services where `skipForService(svc)` returns true skip the location check (they pass through unconditionally). These services are collected separately and **also skip `suppressRedundantProvinceWide`** — they are added back after suppression runs on the remaining services. This threads the exemption cleanly without changing `suppressRedundantProvinceWide`'s signature.

Implementation sketch:
```
1. If skipAll → return all services (existing crisis behavior)
2. Split services into two sets:
   a. bypassed = services where skipForService(svc) returns true
   b. rest = remaining services
3. Filter `rest` by location (existing logic)
4. Run suppressRedundantProvinceWide on `rest` only
5. Return [...filtered rest, ...bypassed]
```

This keeps `suppressRedundantProvinceWide` as a private function with no signature changes.

**Three call sites in `index.ts`:**
- Line ~195: inside `supplementCategories()` — add optional `locationOpts` parameter to `supplementCategories` signature, pass through to `filterByLocation`
- Line ~492: cached results path — pass opts based on intent analysis
- Line ~632: fresh results path — pass opts based on intent analysis

### 5. Cache Version Bump

Bump `CACHE_VERSION` from `v166` to `v167` in `server/search/index.ts`. Required because this change affects which services appear for location-filtered indigenous queries. Also update the cache version reference in CLAUDE.md and MEMORY.md.

## What Does NOT Change

- `optimized_search()` SQL function — untouched
- `suppressRedundantProvinceWide()` — untouched (exemption handled by `filterByLocation` splitting bypassed services out before calling it)
- Crisis bypass behavior — unchanged
- `filterChristianForIndigenous` cultural safety filter — unchanged (but can import `isIndigenousIntent` to DRY up the logic)
- UI / frontend — no changes needed
- Database schema — no new columns or migrations
- LiteService type — no new fields

## Data Flow

```
Query: "indigenous mental health" + location: "Calgary"

1. Intent detection → indigenous_services (triggers bypass)
2. optimized_search("indigenous mental health", "calgary")
   → Returns Calgary services + any indigenous services that
     survived the -100 penalty (very strong matches only)
3. filterByLocation(results, "calgary", { skipForService: isIndigenousService })
   → Splits results: bypassed (indigenous) vs rest (non-indigenous)
   → Filters rest by location (removes non-Calgary services)
   → Runs suppressRedundantProvinceWide on rest only
   → Merges: [...filtered rest, ...bypassed indigenous]
4. supplementIndigenousServices(query, existingResults)
   → Only runs because location filter is active
   → Runs optimized_search("indigenous mental health", NULL)
   → Filters to isIndigenousService() matches only
   → Deduplicates against existing results
   → Adds Siksika Health, Tsuut'ina Wellness, etc. that were
     killed by -100 penalty in step 2
   → Note: these supplements skip suppression entirely since
     they were never passed through filterByLocation
5. applyHardFilters() → gender/age/format still applies to all
   (including indigenous supplements from step 4)
6. Scoring pipeline → intent boosts, sub-intent boosts, quality boosts
```

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| "Siksika" + Calgary | Nation name triggers indigenous intent → supplement finds Siksika services without location penalty → they appear in results |
| "indigenous mental health" + Calgary | Indigenous intent → Calgary MH services + indigenous MH services from all locations |
| "mental health" + Calgary | No indigenous intent → normal filtering, no bypass |
| Indigenous service already in Calgary | `isIndigenousService` returns true, bypass activates, but service already passes location filter — harmless no-op |
| "Elizabeth Fry Society" | Not matched by pattern (no standalone `elizabeth`) → correctly excluded from bypass |
| "Stoney Trail dental" | Not matched (no standalone `stoney`) → correctly excluded |
| Province-wide indigenous org + local non-indigenous counterpart | Indigenous service bypasses suppression (split out before `suppressRedundantProvinceWide` runs) → both appear |
| "indigenous women's shelter" + Calgary | Indigenous intent → supplement runs → gender hard filter still applies to supplements |
| Dual intent: "first nations addiction recovery" + Edmonton | Primary `substance_abuse`, secondary `indigenous_services` (confidence >= 0.5) → bypass activates |
| "indigenous services" + no location filter | No location set → `filterByLocation` returns all services immediately → supplement skipped (no-op, would only produce duplicates) → all indigenous services already in results |
| Cached indigenous query with location | Supplement runs on cached path too (same as fresh path) → cached results are complete |

## Design Decisions

1. **No database flag** — Indigenous identification is algorithmic (name + category pattern matching) rather than a stored `isIndigenous` boolean. This avoids a data migration and self-heals as new services are added with recognizable names. The trade-off is maintenance of the nation-name list, but these names are stable government-recognized entities.

2. **Supplement over SQL modification** — Re-running `optimized_search` without location filter is preferred over modifying the SQL function to accept an indigenous bypass flag. Keeps the SQL function generic and follows the existing `supplementCategories` pattern. The ~2x SQL cost for indigenous queries is acceptable given the small fraction of queries that trigger indigenous intent.

3. **Name-only matching on LiteService** — `LiteService` doesn't carry tags, so `isIndigenousService()` can only check name and category at the filter stage. Tag checking happens in the supplement query (which hits full DB records). This is acceptable because name + category covers the vast majority of cases.

4. **Nation name list is extensible** — The list is a flat array constant at the top of `indigenous.ts`, easy to add to. Doesn't need to be exhaustive on day one.

5. **Split-then-merge in filterByLocation** — Rather than threading `skipForService` into `suppressRedundantProvinceWide` (changing a private function's signature), we split bypassed services out before filtering and suppression, then merge them back. This keeps `suppressRedundantProvinceWide` untouched and makes the bypass behavior explicit.

6. **Skip supplement when no location filter** — When no location is selected, all services pass `filterByLocation` and receive no SQL location penalty. The supplement would only produce duplicates, so we skip it entirely to avoid a wasted DB query.
