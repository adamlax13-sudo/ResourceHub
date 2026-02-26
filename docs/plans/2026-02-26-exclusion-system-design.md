# Exclusion System Consolidation Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace scattered exclusion logic with consolidated detection and hard filtering using database boolean columns.

**Problem:** The "addiction help not religious calgary" query currently shows 12-step programs because:
1. Exclusion detection is fragmented across detectors.ts, filters.ts, and scoring.ts
2. `filterByExclusions` uses weak regex patterns that miss many services
3. Scoring penalties (-200) still allow excluded services to appear

**Solution:** Database boolean columns (`is_faith_based`, `is_12_step`) + consolidated `detectExclusions()` + hard filtering in `applyExclusionFilter()`.

---

## Architecture

### Exclusions Interface

```typescript
interface Exclusions {
  religious: boolean;      // "not religious", "secular", "no faith"
  twelveStep: boolean;     // "no 12-step" OR implied by religious + addiction context
  genderRestricted: 'men_only' | 'women_only' | null;
}
```

### Auto-Set Logic

When `religious === true`:
- Check if query intent is `substance_abuse` OR `family_addiction_support`
- OR query contains addiction keywords: `addiction|recovery|rehab|detox|substance|drug|alcohol|sober`
- If yes: automatically set `twelveStep = true`
- If no (e.g., "secular counselling"): leave `twelveStep` as detected

Rationale: 12-step programs involve "higher power" spiritual concepts. Users seeking non-religious addiction help expect zero 12-step results.

### Filter Pipeline

```
Query Analysis
     ↓
detectExclusions(query, intent) → Exclusions
     ↓
SQL Query (semantic + keyword search)
     ↓
applyExclusionFilter(services, exclusions) → filtered services
     ↓
Scoring (secular alternative boosts only - penalties removed)
     ↓
Final Results
```

### Scoring Changes

**REMOVE** from scoring.ts:
- Penalty for religious services when `exclusions.religious` (-30)
- Penalty for 12-step programs when `exclusions.twelveStep` (-200)
- Penalty for gender mismatches when `exclusions.genderRestricted` (-40)

**KEEP** in scoring.ts:
- Boost for secular alternatives (SMART Recovery, evidence-based, MAT) when `exclusions.twelveStep`
- Boost for immediate access services when `exclusions.waitlist`
- All non-12-step query boosts (lines 894-915)

Rationale: After hard filtering removes excluded services, boosts help rank the *right* alternatives higher.

---

## Database Schema

### New Columns

Add to `services` table:

```sql
is_faith_based BOOLEAN DEFAULT false,
is_12_step BOOLEAN DEFAULT false
```

Note: `gender_restriction VARCHAR(50)` already exists in schema.

### Indexes

```sql
CREATE INDEX idx_services_is_faith_based ON services(is_faith_based) WHERE is_faith_based = true;
CREATE INDEX idx_services_is_12_step ON services(is_12_step) WHERE is_12_step = true;
```

---

## Classification Patterns

### is_12_step = true

**Name patterns:**
- `AA`, `NA`, `CA`, `GA` (as standalone words)
- "Alcoholics Anonymous", "Narcotics Anonymous", "Cocaine Anonymous", "Gamblers Anonymous"
- "Celebrate Recovery"
- "12-step", "12 step", "twelve step"

**Description patterns:**
- "higher power"
- "step program"
- "anonymous fellowship"
- "AA meeting", "NA meeting"

### is_faith_based = true

**Name patterns:**
- church, ministry, mission, chapel
- Christian, Catholic, Baptist, Lutheran, Presbyterian, Pentecostal, Methodist, Evangelical
- Salvation Army, Dream Centre, Dream Center
- "faith-based", "faith based"

**Description patterns:**
- "prayer", "prayer group"
- "bible study", "scripture"
- "worship", "praise"
- "god" (in religious context, exclude "thank god" idioms)
- "Jesus", "Christ"
- "spiritual healing" (not "spiritual wellness" which is secular)

### Default: false

When patterns don't match, default to `false`. Better to under-classify than over-filter.

---

## Files to Modify

| File | Change |
|------|--------|
| `migrations/add_exclusion_columns.sql` | New: Schema migration |
| `shared/schema.ts` | Add `isFaithBased`, `is12Step` columns |
| `server/search/types.ts` | Add `Exclusions` interface, update `LiteService` |
| `server/search/strategies/detectors.ts` | Rewrite `detectExclusions()` with structured return |
| `server/search/strategies/filters.ts` | Add `applyExclusionFilter()` function |
| `server/search/strategies/comprehensive.ts` | Integrate filter into pipeline |
| `server/search/strategies/scoring.ts` | Remove exclusion penalties, KEEP secular alternative boosts |
| `scripts/populate-exclusion-tags.ts` | New: Backfill migration script |

---

## Test Cases

### Query: "addiction help not religious calgary"

**Should return:**
- SMART Recovery Calgary
- AHS Addiction & Mental Health
- Calgary Counselling Centre (secular)
- Access Mental Health (AHS)

**Should NOT return (hard filtered):**
- AA meetings (is_12_step = true)
- NA meetings (is_12_step = true)
- Celebrate Recovery (is_12_step = true, is_faith_based = true)
- Dream Centre Calgary (is_faith_based = true)
- Salvation Army ARC (is_faith_based = true)

### Query: "secular counselling calgary"

**Should filter:** `is_faith_based = true`
**Should NOT auto-filter:** `is_12_step` (not addiction context)

### Query: "women's shelter calgary" (no exclusion signals)

**Should return:** All results, no filtering applied

---

## Migration Plan

1. Run schema migration to add columns
2. Run backfill script to classify existing services
3. **Validate classification before proceeding:**
   - `SELECT name FROM services WHERE is_12_step = true ORDER BY name;`
     - Expect: AA, NA, CA, Celebrate Recovery variants
     - If < 5 results: patterns too narrow
     - If > 50 results: patterns too broad
   - `SELECT name FROM services WHERE is_faith_based = true ORDER BY name;`
     - Expect: Salvation Army, Dream Centre, church-based services
     - Same bounds check
   - `SELECT name FROM services WHERE is_faith_based = true AND is_12_step = false;`
     - Verify no misclassified services (e.g., "Mission" in address, not org name)
4. Fix patterns and re-run if validation fails
5. Deploy code changes
6. Verify with test queries
7. Manual review of edge cases

---

## Success Criteria

- [ ] "addiction help not religious calgary" returns zero 12-step or faith-based services
- [ ] SMART Recovery appears in top 5 for non-religious addiction queries
- [ ] No regression for queries without exclusion signals
- [ ] Migration script classifies 5-50 services as `is_12_step = true` (AA, NA, Celebrate Recovery)
- [ ] Migration script classifies 5-50 services as `is_faith_based = true` (Salvation Army, Dream Centre)
- [ ] No false positives in classification (address keywords, idioms)
