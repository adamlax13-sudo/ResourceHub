# Preference Boost Filters Design

**Date:** 2026-03-03
**Problem:** Toggle filters (faith-based, 12-step, 24/7) in the RefinePanel use hard exclusion, reducing results to near-zero when few services have the matching boolean in the DB. For example, "i can't stop drinking" + faith-based filter returns only 1 result instead of showing all relevant addiction services with faith-based ones prioritized.

## Approach

Convert toggle filters from hard exclusions to preference boosts. Services matching the preference sort to the top; everything else remains visible below.

## Filter Classification

### Hard Filters (remain as exclusions)
- `genderRestriction` — constraint by nature
- `ageGroup` — constraint by nature
- `category` — explicit category scoping
- `serviceFormat` — logistics constraint (in-person vs online)
- `languagesSupported` — accessibility constraint

### Soft Filters (become preference boosts)
- `isFaithBased` — preference, not constraint
- `is12Step` — preference, not constraint
- `is24_7` — preference, not constraint

## Scoring Model

Three tiers for each active soft filter:

| Tier | Condition | Multiplier | Example |
|------|-----------|------------|---------|
| 1 | Boolean field is `true` in DB | ~1.5x | `is_faith_based = true` |
| 2 | Text pattern match in description/name | ~1.2x | Description mentions "spiritual", "church", "Higher Power" |
| 3 | No match | 1.0x (unchanged) | Secular counseling program |

### Text-Match Keywords

**Faith-based:** faith, spiritual, church, Christian, prayer, Bible, Higher Power, God, ministry, pastoral, religious, scripture, worship

**12-step:** 12-step, twelve step, AA, Alcoholics Anonymous, NA, Narcotics Anonymous, sponsor, step work, Big Book

**24/7:** 24/7, 24 hours, around the clock, always open, crisis line, anytime

### Multiple Filters

Boosts stack multiplicatively. Faith-based + 12-step: services matching both get ~2.25x (1.5 x 1.5).

## Architecture

### New File
- `server/search/strategies/scoring/preference-boost.ts` — `applyPreferenceBoosts(services, filters)` function with keyword dictionaries. Follows `demographic-boost.ts` pattern.

### Modified Files
1. **`server/search/index.ts`** — Remove `isFaithBased`, `is12Step`, `is24_7` from `applyHardFilters()`
2. **`server/search/strategies/comprehensive.ts`** — Add `applyPreferenceBoosts()` after `boostByIntent`, before `applyOrganizationDiversity` in both Tier 2 and Tier 3 paths

### No Changes Needed
- Frontend (RefinePanel UI stays identical)
- Database schema
- API schema (`shared/routes.ts`)
- Type definitions (`server/search/types.ts`)

## Edge Cases
- **Cached results:** Preference boosts applied post-cache (same as current hard filters)
- **Debug mode:** Adds entries to `scoreExplanation` array
- **Data sparsity:** Text matching catches services missed by boolean fields
