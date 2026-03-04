# Include-Compatible Filters Design

**Date:** 2026-03-03
**Problem:** Hard filters in `applyHardFilters()` use strict equality, causing most services to be excluded when filtering by gender, age, format, or language. For example, "i think i have a problem with drinking" + Men-only filter returns only 1 result (Alpha House Shelter) because all general/untagged services are removed — even though they serve men too.

**Root Cause:** The gender filter (`server/search/index.ts:59-61`) checks `svc.genderRestriction !== "men_only"`, which excludes services with `null` or `"all"` gender restriction. Similar issues exist for serviceFormat and languagesSupported.

## Approach

Change hard filters from "exact match" to "include-compatible": keep services that match the filter OR have no data for that field. Only exclude explicitly incompatible services. Add a small scoring boost for explicit matches so they rank above general/untagged services.

## Filter Logic Changes

### Gender (`genderRestriction`)

**Current:** `svc.genderRestriction !== filters.genderRestriction` → remove.
**New:**

| UI filter | Keep | Remove |
|-----------|------|--------|
| `men_only` | `"men_only"`, `"all"`, `null` | `"women_only"` |
| `women_only` | `"women_only"`, `"all"`, `null` | `"men_only"` |

### Age (`ageGroup`)

**Current:** Partial handling — `null` defaults to `"all_ages"`, `"youth_and_adult"` handled.
**New:**

| UI filter | Keep | Remove |
|-----------|------|--------|
| `youth` | `"youth"`, `"youth_and_adult"`, `"all_ages"`, `null` | `"adult"`, `"senior"` |
| `adult` | `"adult"`, `"youth_and_adult"`, `"all_ages"`, `null` | `"youth"`, `"senior"` |
| `senior` | `"senior"`, `"all_ages"`, `null` | `"youth"`, `"adult"`, `"youth_and_adult"` |

### Service Format (`serviceFormat`)

**Current:** Strict equality, `null` excluded.
**New:**

| UI filter | Keep | Remove |
|-----------|------|--------|
| `in-person` | `"in-person"`, `"both"`, `null` | `"online"` |
| `online` | `"online"`, `"both"`, `null` | `"in-person"` |
| `both` | everything | nothing |

### Languages (`languagesSupported`)

**Current:** Requires overlap with selected languages. Empty arrays excluded.
**New:** If service has empty/null language array → keep (untagged ≠ unsupported). If populated → require overlap.

### Category

**No change.** Category is explicit scoping; strict match is correct.

## Explicit-Match Boost

After hard filtering, apply a 1.15x score multiplier to services that *explicitly* match the filter value. Untagged/general services get no boost (1.0x). This ensures men-specific services rank above general ones when filtering for men.

| Match type | Multiplier | Example |
|-----------|-----------|---------|
| Explicit match | 1.15x | `genderRestriction === "men_only"` when filter is men |
| Compatible (null/all) | 1.0x | `genderRestriction === null` when filter is men |

Multiple filter boosts stack multiplicatively (e.g., men + youth explicit match = 1.15 * 1.15 ≈ 1.32x).

## Testing Plan

For each filter field, verify:
1. Explicit-match services pass and rank higher
2. Null/untagged services pass through
3. Incompatible services are excluded
4. Multiple filters combine correctly

**Test queries:**
- `"i think i have a problem with drinking"` + men → addiction services with men-specific first
- `"counseling for teens"` + youth → counseling services with youth-specific first
- `"online therapy"` + online format → online/both services, exclude in-person only
- `"addiction help"` + men + youth → services compatible with young men

## Files Modified

| File | Change |
|------|--------|
| `server/search/index.ts` | Rewrite `applyHardFilters()` with include-compatible logic |
| `server/search/strategies/scoring/filter-match-boost.ts` | New: `applyFilterMatchBoosts(services, filters)` |
| `server/search/strategies/comprehensive.ts` | Call `applyFilterMatchBoosts()` after preference boosts |

## No Changes Needed

- Frontend (RefinePanel UI stays identical)
- Database schema
- API schema (`shared/routes.ts`)
- Preference boost system (faith-based, 12-step, 24/7 unchanged)
