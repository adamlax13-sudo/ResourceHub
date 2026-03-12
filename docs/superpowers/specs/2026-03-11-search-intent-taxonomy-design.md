# Search Intent Taxonomy & Quality Improvement Design

**Date:** 2026-03-11
**Status:** Approved
**Scope:** Intent detection, sub-intent taxonomy, keyword expansion, evaluation harness improvements

---

## Overview

ResourceHub's search pipeline (v137) scores 52/52 on CI and 89.3% (175/196) on the overnight harness. This design addresses the remaining 20 overnight failures and adds a principled sub-intent taxonomy layer to the intent detection system — inspired by how Google and Perplexity invest in deep query understanding before touching their index.

Two parallel workstreams:
1. **Quick fixes** — triage and patch known failures (keyword gaps, crisis over-triggering, family addiction routing, test expectation errors)
2. **Sub-intent taxonomy** — structured sub-intents per category, surfaced through both the regex layer and LLM layer

No database changes. No schema migrations. All work on a feature branch.

---

## Failure Triage

### Real Search Bugs (must fix)

| Query | Root Cause | Fix |
|---|---|---|
| `student mental health crisis` | "crisis" as service descriptor fires direct crisis path, replaces all results with helplines | Crisis descriptor guard in `analyzeQuery()` — override `isCrisis` after `detectCrisis()` + `determineIntent()` both run |
| `child custody lawyer free` | "child" triggers `youth_services` over `legal_aid` | LLM + regex disambiguation already handles this; confirm `isCustodyLegalQuery()` fires |
| `my kid is using drugs` | "kid" not in `isFamilyAddictionQuery()` regex — falls through to addiction treatment | Add `kid\|kids\|teen\|teenager` to the relationship list in the 3rd regex of `isFamilyAddictionQuery()` (line ~41). Note: `teen`/`teenager` also appear in the third-party crisis pattern in `detectCrisis()`. Family addiction routing takes priority — confirm `isFamilyAddictionQuery()` is evaluated before the crisis short-circuit in `index.ts` (it already is via `isPchadQuery` check ordering). |
| `NIHB mental health coverage` | NIHB not mapped to indigenous keywords | Add `nihb → indigenous, first nations` to KEYWORD_EXPANSIONS |
| `ESL classes free` | ESL not mapped to newcomer/language | Add `esl → english, newcomer, language` to KEYWORD_EXPANSIONS |
| `military family support` | "military" maps to veteran but "family" aspect lost | Add `military family` compound expansion |

### Test Expectation Issues (fix the test, not the search)

These queries return correct, relevant results. The test patterns check for exact words that don't appear in service names — they should check at category/intent level instead.

| Query | Bad Pattern | Better Pattern |
|---|---|---|
| `eviction help Alberta` | `"tenant"` | `"housing"` or `"Legal Aid"` |
| `baby formula and diapers help` | `"family"` | `"basic needs"` or `"material aid"` |
| `utility bill help can't pay power` | `"utility"` | `"financial"` or `"debt"` |
| `anger management classes` | `"anger management"` | `"counselling"` or `"mental health"` |
| `residential school survivors support` | `"residential school"` | `"Indigenous"` or `"healing"` |
| `foreign credential recognition` | `"credential"` | `"newcomer"` or `"settlement"` |

### Data Gaps (out of scope for this plan)

- `fentanyl overdose prevention` — no harm reduction services in DB. Flagged in `service-gaps-report.json`. Addressed by scraper, not search.

---

## Sub-Intent Taxonomy

### Design Principles

Each of the 24 top-level intents is a cluster of related-but-distinct user needs. Making sub-intents explicit allows:
- The **LLM layer** to score sub-intent matches at 90-100 (vs. intent-only matches capped at ~70)
- The **regex boost layer** to differentiate within an intent (e.g., `housing_urgent` → `emergency_shelter` vs. `eviction_defense`)
- The **keyword expansion layer** to map niche terms to the right sub-intent

### Structure

Sub-intents are defined in `server/search/config.ts` as a new `subIntents` map, structured identically to `categoryIndicators`. Sub-intent names are **namespaced** with their parent intent to avoid collisions when the same concept (e.g., `eviction_defense`, `credential_recognition`) appears under multiple parents:

```ts
subIntents: {
  housing_urgent: {
    'housing_urgent.emergency_shelter': [/\bemergency shelter\b/i, /\bnowhere to sleep\b/i, ...],
    'housing_urgent.eviction_defense': [/\bevict/i, /\btenant rights\b/i, ...],
    'housing_urgent.transitional_housing': [/\btransitional\b/i, /\bhalfway house\b/i, ...],
    'housing_urgent.affordable_housing': [/\baffordable\b/i, /\bsubsidized\b/i, /\brent geared\b/i, ...],
  },
  legal_aid: {
    'legal_aid.eviction_defense': [/\bevict/i, /\btenant rights\b/i, ...],  // same signals, different namespace
    'legal_aid.family_court': [/\bcustody\b/i, /\bvisitation\b/i, ...],
    // ...
  },
  // ...
}
```

`QueryAnalysis` gains `subIntents?: string[]` — an array of namespaced sub-intent strings (e.g., `["housing_urgent.eviction_defense", "legal_aid.eviction_defense"]`). Sub-intents live on `QueryAnalysis` only, **not** inside `QueryAttributes` — the reranker and boost layers read from `analysis.subIntents` directly.

A `VALID_SUB_INTENTS` set is defined in `server/search/config.ts` alongside the `subIntents` taxonomy map (so the source of truth is in one place). It is imported into `llm-intent.ts` alongside the existing imports from `config.ts`. Unknown sub-intent strings returned by the LLM are filtered against `VALID_SUB_INTENTS` before merging into `analysis.subIntents`, consistent with how `VALID_FORMATS` and `VALID_URGENCY` work today.

`detectSubIntents()` in `analyzer.ts`:
- Input: `corrected` query string (same as `detectServiceAttributes()`)
- Guard: only runs when `analysis.intent !== 'general'`
- Orphaned sub-intents (sub-intent fires but parent intent not detected) are dropped

### Full Taxonomy

| Intent | Sub-Intents |
|---|---|
| `housing_urgent` | `emergency_shelter`, `eviction_defense`, `transitional_housing`, `affordable_housing`, `youth_housing` |
| `substance_abuse` | `detox`, `residential_treatment`, `harm_reduction`, `outpatient`, `gambling`, `cannabis` |
| `healthcare_access` | `dental`, `walk_in_clinic`, `hospital_er`, `prescription_coverage`, `disability_equipment` |
| `mental_health` | `counselling`, `psychiatry`, `eating_disorder`, `trauma`, `anger_management`, `postpartum` |
| `indigenous_services` | `residential_school_survivor`, `nihb_coverage`, `cultural_healing`, `language_preservation` |
| `newcomer_services` | `esl_language`, `credential_recognition`, `settlement`, `refugee`, `interpretation` |
| `legal_aid` | `family_court`, `eviction_defense`, `restraining_order`, `immigration_law`, `criminal_court` |
| `employment_support` | `job_search`, `resume_help`, `credential_recognition`, `barrier_employment`, `apprenticeship` |
| `veteran_services` | `ptsd_trauma`, `military_family`, `transition_support`, `benefits_navigation` |
| `disability_support` | `aish_application`, `mobility_aids`, `autism_support`, `acquired_brain_injury` |
| `domestic_violence` | `emergency_escape`, `sexual_assault`, `stalking`, `coercive_control` |
| `youth_services` | `runaway_youth`, `youth_mental_health`, `youth_shelter`, `youth_addiction` |
| `family_addiction_support` | `al_anon`, `nar_anon`, `family_counselling`, `codependency` |
| `parenting_support` | `postpartum`, `single_parent`, `teen_parent`, `kinship_care` |
| `financial_support` | `debt_counselling`, `emergency_funds`, `benefits_navigation`, `tax_assistance` |
| `grief_support` | `bereavement`, `suicide_loss`, `perinatal_loss`, `anticipatory_grief` |
| `senior_services` | `homecare`, `dementia_support`, `senior_housing`, `isolation_support` |
| `caregiver_support` | `respite`, `burnout`, `caregiver_counselling` |
| `lgbtq_services` | `gender_affirming_care`, `coming_out_support`, `lgbtq_youth`, `lgbtq_seniors` |
| `crisis` | `suicidal_ideation`, `self_harm`, `third_party_crisis` |
| `food_insecurity` | `food_bank`, `community_meals`, `baby_supplies`, `cultural_food` |
| `basic_needs` | `clothing`, `hygiene`, `transportation`, `phone_internet` |
| `community_social` | `isolation`, `social_connection`, `peer_support`, `volunteering` |
| `student_services` | `campus_mental_health`, `student_housing`, `student_food_bank`, `academic_support` |

---

## Data Flow

```
Query
  → correctTypos() + scrubPii()
  → analyzeQuery()
      → detectCrisis()
      → determineIntent()
      → detectSubIntents()  ← NEW: regex pass, populates analysis.subIntents
      ← [FIX] crisis descriptor guard applied here — after both detectCrisis()
         and determineIntent() run, override isCrisis=false if query uses
         "crisis" as a service descriptor (see Crisis Descriptor Guard section)
  → enhanceIntentWithLLM()
      → LLM returns intents + attributes + subIntents?: string[]  ← NEW field
      → LLM subIntents merged into analysis.subIntents
  → llmRerank() [Tier 3]
      → prompt includes subIntents context
      → extended rule 5: primary + sub-intent match → 90-100
  → boostByIntent() [Tier 2 cached]
      → INTENT_SERVICE_MAP categoryPatterns extended per sub-intent
```

No new API calls. No new DB tables. Sub-intents are in-memory metadata.

---

## Files Changed

| File | Change |
|---|---|
| `server/search/config.ts` | Add `subIntents` map alongside `categoryIndicators` |
| `server/search/types.ts` | Add `subIntents?: string[]` to `QueryAnalysis` only (not `QueryAttributes`) |
| `server/search/analyzer.ts` | Add `detectSubIntents()` + crisis descriptor guard in `determineIntent()` |
| `server/search/llm-intent.ts` | Add `subIntents?: string[]` to LLM response schema + system prompt instruction |
| `server/search/strategies/scoring/llm-rerank.ts` | Pass `subIntents` in reranker prompt, extend rule 5 |
| `server/search/strategies/scoring/intent-boost.ts` | Extend `INTENT_SERVICE_MAP` categoryPatterns per sub-intent |
| `server/search/pinned.ts` | Fix `isFamilyAddictionQuery`: add `kid\|kids\|teen\|teenager` |
| `server/search/index.ts` | Bump `CACHE_VERSION` to `v138` |
| `server/helpers/keywords.ts` | Add expansions: `nihb`, `esl`, `military family` |
| `server/evaluation/overnight_test.mjs` | Fix 6 bad test patterns + add ~15 new sub-intent test queries |

---

## Evaluation Changes

### Test Pattern Quality Standard

`expectedPatterns` must match one of:
- A **category name** (e.g., `"Housing"`, `"Legal Aid"`) — most reliable
- A **service-type descriptor** common in descriptions (e.g., `"shelter"`, `"counselling"`)
- A **known service name** for `mustInclude` assertions

Never a narrow keyword dependent on exact wording in service names.

### New Sub-Intent Test Queries (overnight harness only)

| Sub-Intent | Query | Expected Patterns |
|---|---|---|
| `harm_reduction` | `"where to get naloxone in Edmonton"` | Routing test only — validates `substance_abuse` intent with `harm_reduction` sub-intent fires correctly. No `expectedPatterns` until harm reduction services are in DB (flagged in `service-gaps-report.json`). |
| `residential_school_survivor` | `"residential school survivors support"` | `["Indigenous", "healing", "trauma"]` |
| `nihb_coverage` | `"NIHB mental health coverage"` | `["Indigenous", "First Nations", "health"]` |
| `esl_language` | `"ESL classes free"` | `["newcomer", "settlement", "language"]` |
| `anger_management` | `"anger management classes"` | `["counselling", "mental health"]` |
| `eviction_defense` | `"eviction help Alberta"` | `["housing", "Legal Aid"]` |
| `military_family` | `"military family support"` | `["veteran", "military", "family"]` |
| `credential_recognition` | `"foreign credential recognition"` | `["newcomer", "employment", "settlement"]` |
| `postpartum` | `"postpartum depression support"` | `["mental health", "postpartum", "counselling"]` |
| `baby_supplies` | `"baby formula and diapers help"` | `["basic needs", "material aid"]` |
| `aish_application` | `"help with AISH application"` | `["AISH", "disability", "benefits"]` |
| `family_court` | `"child custody lawyer free"` | `["legal", "family", "court"]` |
| `student_mental_health` | `"student mental health crisis"` | `["student", "campus", "mental health"]` |
| `utility_help` | `"utility bill help can't pay power"` | `["financial", "debt"]` |

New sub-intent tests go into the **overnight harness only** until stable, then promote to CI.

### CI Thresholds (unchanged)

- Overall: ≥ 85
- Critical intents (crisis, DV, housing_urgent): ≥ 90
- Per-intent minimum: ≥ 60
- Max failures scoring < 50: 5

---

## Crisis Descriptor Guard (detailed)

**Problem:** `"student mental health crisis"` contains "crisis" → fires direct crisis path → replaces all results with 988/helplines.

**Architecture:** `detectCrisis()` runs first in `analyzeQuery()` and returns `{ isCrisis, isThirdParty }`. `determineIntent()` is called next and receives the crisis result. The guard must be applied *after* both functions run, inside `analyzeQuery()`, which is the only place that can override `isCrisis` before returning `QueryAnalysis`.

**Fix logic — applied in `analyzeQuery()` after `detectCrisis()` + `determineIntent()`:**

```
if isCrisis=true
   AND no first-person distress signals in query
     (no: "I", "me", "myself", "want to die", "kill myself", "end my life", "self-harm", etc.)
   AND "crisis" appears only as a descriptor, not as self-referential ideation — matched by EITHER:
     (a) forward compound noun: /\bcrisis\s+(centre|center|counsell|service|support|line|help|team|unit|worker)\b/i
     (b) trailing descriptor:   /\b(mental health|student|financial|housing|emotional|youth)\s+crisis\b/i
   AND at least one non-crisis intent scored above 'general'
THEN: override isCrisis = false in the returned QueryAnalysis
      (detectCrisis result is unchanged; only analysis.isCrisis is overridden)
```

Pattern (b) is what fixes the motivating failure: `"student mental health crisis"` matches `/\bmental health\s+crisis\b/i` and `"student"` is a non-crisis intent signal. Both patterns must be checked — either match is sufficient to trigger the override.

This preserves the safety-critical path for genuine ideation while allowing service-seeking queries that use "crisis" descriptively. The override is applied in `analyzeQuery()` before returning — no changes needed to `detectCrisis()` or `determineIntent()` signatures.

**Interaction with precomputed cache:** Bumping to `v138` is sufficient to invalidate any precomputed cache entries where the crisis descriptor guard would change routing — cache keys include `CACHE_VERSION` so a miss triggers a fresh search.

---

## Constraints

- No database changes
- No changes pushed directly to `main` — all work on a feature branch
- No new OpenAI API call types — `subIntents` is an additional field in the existing LLM call
- Backward compatible — `subIntents` is optional; if absent, all existing paths behave identically
- Cache version bumped to invalidate stale results
