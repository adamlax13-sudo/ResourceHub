# Name-Match Boosting Design

**Date:** 2026-02-26
**Status:** Approved

## Problem

When users search for a specific service by name (e.g., "SMART Recovery", "CMHA", "Kids Help Phone"), that service doesn't always appear as the #1 result. The current name matching is embedded inside `boostByIntent()` and only fires when domain intents or preferences are detected. Alias handling uses a hardcoded 5-entry map instead of the existing `service_aliases` database table.

## Solution

Three changes to guarantee name-searched services rank #1.

### 1. New `boostByNameMatch()` function in `scoring.ts`

Runs on **every search**, before `boostByIntent()`. Three tiers:

| Tier | Condition | Boost | Example |
|------|-----------|-------|---------|
| Exact name | `query.toLowerCase() === service.name.toLowerCase()` | +500 | "Kids Help Phone" -> Kids Help Phone |
| Alias match | Query matches an alias in `service_aliases` DB table | +500 | "CMHA" -> Canadian Mental Health Association |
| Partial name | All query words (2+ non-stoplist) appear in service name | +250 | "help phone" -> Kids Help Phone |

**Partial match rules:**
- Requires at least 2 non-stoplist query words to all appear in the service name
- Single-word queries only trigger exact or alias match, never partial
- Uses the same stoplist as the existing name-match logic (common words like "help", "support", "calgary", etc.)

The function receives a pre-loaded alias lookup map (`Map<alias, serviceId>`) to avoid per-query DB hits.

### 2. Expand Tier 1 alias handling in `analyzer.ts`

Replace the hardcoded 5-alias map in `findAliasMatch()` (line 140) with the database-backed `getAliasLookup()`. The alias map is loaded once at startup and cached in memory.

### 3. Remove duplicate name-matching from `boostByIntent()`

The `directNameMatch.multiWord` (+500) and `directNameMatch.singleWord` (+100) logic in `scoring.ts:196-223` overlaps with the new function. Remove it to avoid double-boosting.

## Pipeline Order

Post-merge processing in `comprehensive.ts`:

```
1. applyExclusionFilter()       -- hard filter (unchanged)
2. applyAgeFilter()             -- hard filter (unchanged)
3. boostByNameMatch()     <- NEW -- exact/alias/partial name boosts
4. boostByIntent()              -- domain-specific boosts (name match removed)
5. applyNegativePenalty()        -- exclusion penalties (unchanged)
6. applyOrganizationDiversity()  -- diversity cap (unchanged)
```

## Config

New section in `SCORING_CONFIG` in `config.ts`:

```typescript
nameMatch: {
  exact: 500,       // Exact service name match (case-insensitive)
  alias: 500,       // Known alias match from service_aliases table
  partial: 250,     // All query words (2+ non-stoplist) appear in name
}
```

Remove the existing `directNameMatch` section since it's replaced by `nameMatch`.

## Alias Map Caching

- `ComprehensiveSearchStrategy` loads `getAliasLookup()` on first search, caches in memory
- Returns `Map<alias, serviceId>` for O(1) lookups
- Same map is passed to `findAliasMatch()` in analyzer and `boostByNameMatch()` in scoring
- No per-query DB calls

## Files Changed

- `server/search/config.ts` -- add `nameMatch` config, remove `directNameMatch`
- `server/search/strategies/scoring.ts` -- add `boostByNameMatch()`, remove old name-match logic from `boostByIntent()`
- `server/search/strategies/comprehensive.ts` -- wire `boostByNameMatch()` into pipeline, cache alias map
- `server/search/analyzer.ts` -- replace hardcoded alias map with cached DB lookup
