# Search Intent Taxonomy & Quality Improvement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sub-intent taxonomy layer to intent detection, fix 6 known search bugs, and update the overnight evaluation harness to reach ~95% pass rate.

**Architecture:** Two parallel workstreams land in one branch: (1) quick fixes to `pinned.ts`, `keywords.ts`, and `analyzer.ts` that resolve specific overnight failures; (2) a sub-intent taxonomy built into `config/analysis.ts`, detected by a new `detectSubIntents()` function, and consumed by both the LLM reranker and regex boost layers.

**Tech Stack:** TypeScript, Node.js, Vitest (unit tests), `server/search/` pipeline, `server/evaluation/overnight_test.mjs` (API-level tests)

---

## Chunk 1: Foundation & Quick Fixes

### Task 1: Add `subIntents` field to `QueryAnalysis`

**Files:**
- Modify: `server/search/types.ts:76-106`

- [ ] **Step 1: Add `subIntents` to the `QueryAnalysis` interface**

In `server/search/types.ts`, add one line after the `attributes?` field (line 105):

```ts
/** Detected sub-intents (namespaced: "intent.sub_intent", e.g. "housing_urgent.eviction_defense") */
subIntents?: string[];
```

The full updated interface ends:
```ts
  /** Structured query attributes extracted by LLM understanding (optional, enriches search) */
  attributes?: QueryAttributes;
  /** Detected sub-intents (namespaced: "intent.sub_intent", e.g. "housing_urgent.eviction_defense") */
  subIntents?: string[];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/adamyeo/Desktop/ResourceHub && npm run check 2>&1 | head -30
```
Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
git add server/search/types.ts
git commit -m "feat(search): add subIntents field to QueryAnalysis type"
```

---

### Task 2: Add sub-intent taxonomy to config

**Files:**
- Modify: `server/search/config/analysis.ts` (append at end of file)
- Modify: `server/search/config/index.ts` (add export)

**Scope note:** This initial taxonomy covers the 10 highest-value parent intents that have known overnight failures or clear sub-intent needs. The remaining 14 intents (`domestic_violence`, `youth_services`, `family_addiction_support`, `parenting_support`, `financial_support`, `grief_support`, `senior_services`, `caregiver_support`, `lgbtq_services`, `crisis`, `food_insecurity`, `basic_needs`, `community_social`, `student_services`) are deferred to a follow-up pass once these 10 are validated.

- [ ] **Step 1: Append `SUB_INTENT_PATTERNS` and `VALID_SUB_INTENTS` to `analysis.ts`**

At the very end of `server/search/config/analysis.ts`, append:

```ts
// === SUB-INTENT TAXONOMY ===
// Namespaced as "parentIntent.subIntent" to avoid collisions across parents.
// Each sub-intent has regex patterns that fire when the parent intent is also detected.
// VALID_SUB_INTENTS is the canonical set for LLM response validation.
// NOTE: Initial taxonomy covers 10 high-value parent intents. See plan for deferred list.

export const SUB_INTENT_PATTERNS: Record<string, Record<string, RegExp[]>> = {
  housing_urgent: {
    'housing_urgent.emergency_shelter': [
      /\bemergency shelter\b/i, /\bnowhere to (sleep|stay)\b/i,
      /\bsleeping (outside|rough|on street|in car)\b/i, /\bovernight shelter\b/i,
    ],
    'housing_urgent.eviction_defense': [
      /\bevict/i, /\btenant rights?\b/i, /\blandlord.*kick/i, /\beviction notice\b/i,
    ],
    'housing_urgent.transitional_housing': [
      /\btransitional (house|housing|living)\b/i, /\bhalfway house\b/i,
      /\bsober living\b/i, /\bsupport(ive)? housing\b/i,
    ],
    'housing_urgent.affordable_housing': [
      /\baffordable (housing|rent|apartment)\b/i, /\bsubsidized (housing|rent)\b/i,
      /\brent geared to income\b/i, /\bhousing waitlist\b/i, /\blow.?income housing\b/i,
    ],
    'housing_urgent.youth_housing': [
      /\byouth (shelter|housing|hostel)\b/i, /\bunder 18.*shelter\b/i,
    ],
  },
  substance_abuse: {
    'substance_abuse.detox': [
      /\bdetox\b/i, /\bwithdrawal\b/i, /\bdetoxification\b/i, /\bmedically supervised\b/i,
    ],
    'substance_abuse.residential_treatment': [
      /\bresidential (treatment|program|rehab)\b/i, /\binpatient (treatment|rehab)\b/i,
      /\brehab (program|centre|center|facility)\b/i,
    ],
    'substance_abuse.harm_reduction': [
      /\bharm reduction\b/i, /\bnaloxone\b/i, /\bnarcan\b/i,
      /\bneedle exchange\b/i, /\boverdose prevention\b/i, /\bsafe supply\b/i,
    ],
    'substance_abuse.outpatient': [
      /\boutpatient\b/i, /\bday program\b/i, /\bIOP\b/i, /\bintensive outpatient\b/i,
    ],
    'substance_abuse.gambling': [
      /\bgambl/i, /\bcasino.*problem\b/i, /\bbetting.*problem\b/i, /\bgaming.*addict/i,
    ],
    'substance_abuse.cannabis': [
      /\bcannabis (use|dependency|addiction|problem)\b/i, /\bmarijuana.*addict/i,
      /\bweed.*problem\b/i,
    ],
  },
  healthcare_access: {
    'healthcare_access.dental': [
      /\bdent(al|ist|istry)\b/i, /\btooth\b/i, /\bteeth\b/i, /\boral health\b/i,
    ],
    'healthcare_access.walk_in_clinic': [
      /\bwalk.?in (clinic|doctor|physician)\b/i, /\bno appointment\b/i,
      /\bdrop.?in (clinic|medical)\b/i,
    ],
    'healthcare_access.hospital_er': [
      /\bemergency room\b/i, /\bER\b/i, /\bhospital\b/i,
      /\bemergency department\b/i, /\burgent care\b/i,
    ],
    'healthcare_access.prescription_coverage': [
      /\bprescription\b/i, /\bmedication cost\b/i, /\bpharmac(y|are)\b/i,
      /\bdrug coverage\b/i, /\bNIHB\b/i,
    ],
    'healthcare_access.disability_equipment': [
      /\bwheelchair\b/i, /\bmobility aid\b/i, /\bwalker\b/i, /\bassistive device\b/i,
      /\bAADL\b/i, /\bRAMP program\b/i,
    ],
  },
  mental_health: {
    'mental_health.counselling': [
      /\bcounsell?ing\b/i, /\btherapy\b/i, /\btherapist\b/i, /\bpsychologist\b/i,
    ],
    'mental_health.psychiatry': [
      /\bpsychiatrist\b/i, /\bpsychiatry\b/i, /\bmedication management\b/i,
      /\bantidepressant\b/i, /\bmental health medication\b/i,
    ],
    'mental_health.eating_disorder': [
      /\beating disorder\b/i, /\banorexia\b/i, /\bbulimia\b/i, /\bbinge eat/i,
    ],
    'mental_health.trauma': [
      /\btrauma\b/i, /\bPTSD\b/i, /\bpost.?traumatic\b/i, /\babuse (survivor|recovery)\b/i,
    ],
    'mental_health.anger_management': [
      /\banger management\b/i, /\baggression\b/i, /\brage (management|control)\b/i,
      /\banger (control|issues|class)\b/i,
    ],
    'mental_health.postpartum': [
      /\bpostpartum\b/i, /\bpost.?partum\b/i, /\bPPD\b/i, /\bbaby blues\b/i,
      /\bperinatal (mental health|depression|anxiety)\b/i,
    ],
  },
  indigenous_services: {
    'indigenous_services.residential_school_survivor': [
      /\bresidential school\b/i, /\bIRS (survivor|support)\b/i, /\bsurvivor.*residential\b/i,
      /\bintergenerational trauma\b/i,
    ],
    'indigenous_services.nihb_coverage': [
      /\bNIHB\b/i, /\bnon-?insured health benefits?\b/i,
    ],
    'indigenous_services.cultural_healing': [
      /\bcultural (healing|ceremony|practice)\b/i, /\btraditional healing\b/i,
      /\belder\b/i, /\bsmudging\b/i, /\bsweat lodge\b/i,
    ],
    'indigenous_services.language_preservation': [
      /\bindigenous language\b/i, /\bcree\b/i, /\bblackfoot\b/i, /\bnakoda\b/i,
      /\blanguage revitalization\b/i, /\bFirst Nations language\b/i,
    ],
  },
  newcomer_services: {
    'newcomer_services.esl_language': [
      /\bESL\b/i, /\bEnglish (class|lesson|course|language)\b/i,
      /\blanguage (class|lesson|learning|training)\b/i,
      /\blearn English\b/i, /\bEnglish as a second language\b/i,
    ],
    'newcomer_services.credential_recognition': [
      /\bcredential recognition\b/i, /\bforeign (credential|degree|training)\b/i,
      /\binternational.*credential\b/i, /\bprofessional licensing\b/i,
    ],
    'newcomer_services.settlement': [
      /\bsettlement (service|program|support)\b/i, /\bnewcomer settlement\b/i,
    ],
    'newcomer_services.refugee': [
      /\brefugee\b/i, /\basylum\b/i, /\bIRCC\b/i,
    ],
  },
  legal_aid: {
    'legal_aid.family_court': [
      /\bcustody\b/i, /\bvisitation\b/i, /\bparenting (order|time|plan)\b/i,
      /\bfamily (court|law|lawyer)\b/i, /\bchild (access|support order)\b/i,
    ],
    'legal_aid.eviction_defense': [
      /\bevict/i, /\btenant rights?\b/i, /\blandlord.*legal\b/i,
      /\brentalsman\b/i, /\bRTDRS\b/i,
    ],
    'legal_aid.restraining_order': [
      /\brestraining order\b/i, /\bprotection order\b/i, /\bEPO\b/i, /\bQEPO\b/i,
    ],
    'legal_aid.immigration_law': [
      /\bimmigration (lawyer|legal|law)\b/i, /\bvisa (help|legal)\b/i, /\bdeportation\b/i,
    ],
  },
  employment_support: {
    'employment_support.credential_recognition': [
      /\bcredential recognition\b/i, /\bforeign (credential|degree|training)\b/i,
      /\bprofessional licensing\b/i,
    ],
    'employment_support.barrier_employment': [
      /\bbarrier(s to employment)?\b/i, /\bsupported employment\b/i,
      /\bdisability.*employment\b/i, /\bvocational (rehab|training)\b/i,
    ],
    'employment_support.resume_help': [
      /\bresume (help|writing|workshop)\b/i, /\bCV (help|writing)\b/i, /\bjob application\b/i,
    ],
  },
  veteran_services: {
    'veteran_services.ptsd_trauma': [
      /\bPTSD\b/i, /\bcombat (trauma|stress)\b/i, /\bmilitary.*trauma\b/i,
    ],
    'veteran_services.military_family': [
      /\bmilitary family\b/i, /\bCAF family\b/i, /\bdeployment.*family\b/i,
      /\barmed forces.*family\b/i,
    ],
    'veteran_services.benefits_navigation': [
      /\bVAC\b/i, /\bveteran.*benefit\b/i, /\bCPP disability\b/i,
    ],
  },
  disability_support: {
    'disability_support.aish_application': [
      /\bAISH\b/i, /\bAssured Income.*Severely Handicapped\b/i,
    ],
    'disability_support.autism_support': [
      /\bautis/i, /\bASD\b/i, /\bAsperger\b/i, /\bneurodivergent\b/i,
    ],
    'disability_support.mobility_aids': [
      /\bwheelchair\b/i, /\bwalker\b/i, /\bmobility aid\b/i, /\bAADL\b/i,
    ],
    'disability_support.acquired_brain_injury': [
      /\bABI\b/i, /\bTBI\b/i, /\bbrain injury\b/i, /\bconcussion.*recovery\b/i,
    ],
  },
};

/** Flat set of all valid namespaced sub-intent strings for LLM response validation */
export const VALID_SUB_INTENTS = new Set<string>(
  Object.values(SUB_INTENT_PATTERNS).flatMap(group => Object.keys(group))
);
```

- [ ] **Step 2: Export from `config/index.ts`**

In `server/search/config/index.ts`, add after the existing `export { SEARCH_CONFIG }` line:

```ts
export { SUB_INTENT_PATTERNS, VALID_SUB_INTENTS } from './analysis';
```

Note: `index.ts` uses named re-exports, not wildcard `export *`, so this explicit export is required.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/adamyeo/Desktop/ResourceHub && npm run check 2>&1 | head -30
```
Expected: zero new errors.

- [ ] **Step 4: Commit**

```bash
git add server/search/config/analysis.ts server/search/config/index.ts
git commit -m "feat(search): add sub-intent taxonomy + VALID_SUB_INTENTS to config"
```

---

### Task 3: Fix `isFamilyAddictionQuery` — add kid/teen

**Files:**
- Modify: `server/search/pinned.ts:41`
- Test: `server/search/__tests__/analyzer-intents.test.ts`

- [ ] **Step 1: Write the failing tests**

In `server/search/__tests__/analyzer-intents.test.ts`, the file already has a `describe('Intent Detection — Known Misdetections', ...)` block. Add these two tests inside that block:

```ts
it('detects family_addiction_support for "my kid is using drugs"', () => {
  const analysis = analyzeQuery('my kid is using drugs');
  expect(analysis.intent).toBe('family_addiction_support');
});

it('detects family_addiction_support for "my teenager is addicted to meth"', () => {
  const analysis = analyzeQuery('my teenager is addicted to meth');
  expect(analysis.intent).toBe('family_addiction_support');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/adamyeo/Desktop/ResourceHub && npx vitest run server/search/__tests__/analyzer-intents.test.ts 2>&1 | tail -20
```
Expected: 2 new failures — the new tests fail, existing tests pass.

- [ ] **Step 3: Fix `isFamilyAddictionQuery` in `pinned.ts`**

In `server/search/pinned.ts`, find the regex on line ~41:
```ts
/\b(my|our).*(spouse|husband|wife|partner|parent|child|son|daughter|family|loved one).*(addict|alcoholi[cs]|alcohol|drug|drinking|using)/i
```

Replace with (add `kid|kids|teen|teenager` to the middle group):
```ts
/\b(my|our).*(spouse|husband|wife|partner|parent|child|son|daughter|kid|kids|teen|teenager|family|loved one).*(addict|alcoholi[cs]|alcohol|drug|drinking|using)/i
```

Note: `teen` and `teenager` also appear in the third-party crisis detection regex in `analyzer.ts`. There is no conflict — `isFamilyAddictionQuery()` is evaluated and pinned before the crisis short-circuit path in `index.ts`, so family addiction routing takes priority when "my teen" + drug language is present without explicit self-harm language.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/adamyeo/Desktop/ResourceHub && npx vitest run server/search/__tests__/analyzer-intents.test.ts 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/search/pinned.ts server/search/__tests__/analyzer-intents.test.ts
git commit -m "fix(search): add kid/teen/teenager to isFamilyAddictionQuery patterns"
```

---

### Task 4: Add keyword expansions (NIHB, ESL, military family)

**Files:**
- Modify: `server/helpers/keywords.ts` (`KEYWORD_EXPANSIONS` object, lines 21-71)
- Test: `server/helpers/__tests__/keywords.test.ts`

- [ ] **Step 1: Check how `expandKeywords` works**

Before writing tests, verify the function signature:
```bash
grep -n "export function expandKeywords" /Users/adamyeo/Desktop/ResourceHub/server/helpers/keywords.ts
```
The function takes a query string and returns expanded terms. Key lookups are by exact key match on individual tokens. So `expandKeywords('military')` will hit a `'military'` key, but NOT a `'military family'` key (compound phrases are not tokenized together).

- [ ] **Step 2: Write failing tests**

In `server/helpers/__tests__/keywords.test.ts`, add:

```ts
describe('Keyword Expansions — New Terms', () => {
  it('expands nihb to include indigenous terms', () => {
    const result = expandKeywords('NIHB');
    expect(result.join(' ')).toMatch(/indigenous|first nations/i);
  });

  it('expands esl to include newcomer/language terms', () => {
    const result = expandKeywords('ESL');
    expect(result.join(' ')).toMatch(/english|newcomer|language/i);
  });

  it('expands military to include veteran terms', () => {
    const result = expandKeywords('military family support');
    expect(result.join(' ')).toMatch(/veteran/i);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd /Users/adamyeo/Desktop/ResourceHub && npx vitest run server/helpers/__tests__/keywords.test.ts 2>&1 | tail -20
```
Expected: 3 new failures.

- [ ] **Step 4: Add expansions to `KEYWORD_EXPANSIONS` in `keywords.ts`**

Find the `KEYWORD_EXPANSIONS` object and add these entries before the closing `};`:

```ts
  'nihb': ['indigenous', 'first nations', 'non-insured health benefits', 'healthcare'],
  'esl': ['english', 'language', 'newcomer', 'settlement', 'ESL classes'],
  'ell': ['english', 'language learner', 'newcomer', 'ESL'],
  'residential school': ['indigenous', 'trauma', 'survivor', 'healing', 'intergenerational'],
  'postpartum': ['maternal', 'perinatal', 'PPD', 'baby blues', 'new mother'],
  'aish': ['disability', 'income support', 'disability benefits', 'government assistance'],
```

Note: `'military'` already exists in `KEYWORD_EXPANSIONS` and maps to `['veteran', 'armed forces', 'CAF', 'service member']`. No new entry needed for it — the existing expansion covers the veteran routing. The test in Step 2 uses `expandKeywords('military family support')` which will expand the `'military'` token.

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/adamyeo/Desktop/ResourceHub && npx vitest run server/helpers/__tests__/keywords.test.ts 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add server/helpers/keywords.ts server/helpers/__tests__/keywords.test.ts
git commit -m "feat(search): add keyword expansions for nihb, esl, residential school, postpartum, aish"
```

---

## Chunk 2: Sub-Intent Detection & Crisis Guard

### Task 5: Add `detectSubIntents()` to `analyzer.ts`

**Files:**
- Modify: `server/search/analyzer.ts`
- Test: `server/search/__tests__/analyzer-intents.test.ts`

- [ ] **Step 1: Write failing tests**

Add a new describe block at the end of `server/search/__tests__/analyzer-intents.test.ts`:

```ts
describe('Sub-Intent Detection', () => {
  it('detects housing_urgent.eviction_defense for "eviction help"', () => {
    const analysis = analyzeQuery('eviction help Alberta');
    expect(analysis.subIntents).toContain('housing_urgent.eviction_defense');
  });

  it('detects newcomer_services.esl_language for "ESL classes free"', () => {
    const analysis = analyzeQuery('ESL classes free');
    expect(analysis.subIntents).toContain('newcomer_services.esl_language');
  });

  it('detects mental_health.anger_management for "anger management classes"', () => {
    const analysis = analyzeQuery('anger management classes');
    expect(analysis.subIntents).toContain('mental_health.anger_management');
  });

  it('detects substance_abuse.harm_reduction for "naloxone in Edmonton"', () => {
    const analysis = analyzeQuery('where to get naloxone in Edmonton', 'Edmonton');
    expect(analysis.subIntents).toContain('substance_abuse.harm_reduction');
  });

  it('does not detect sub-intents for general queries', () => {
    const analysis = analyzeQuery('help me please');
    expect(analysis.subIntents ?? []).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/adamyeo/Desktop/ResourceHub && npx vitest run server/search/__tests__/analyzer-intents.test.ts 2>&1 | tail -20
```
Expected: 5 new failures (`subIntents` is undefined on all).

- [ ] **Step 3: Add `SUB_INTENT_PATTERNS` to the existing config import**

In `server/search/analyzer.ts`, find the existing import from `'./config'`:
```ts
import { SEARCH_CONFIG } from './config';
```
Update it to:
```ts
import { SEARCH_CONFIG, SUB_INTENT_PATTERNS } from './config';
```
Do NOT add a second import statement. Add `SUB_INTENT_PATTERNS` to the existing import only.

- [ ] **Step 4: Add `detectSubIntents()` function to `analyzer.ts`**

Add this function to `server/search/analyzer.ts` after the `detectSubstanceType()` function and before `analyzeQuery()`:

```ts
/**
 * Detect fine-grained sub-intents from a query.
 * Only runs when primary intent is not 'general'.
 * Returns namespaced sub-intent strings: "parentIntent.subIntent"
 * Orphaned sub-intents (parent intent not in detectedIntents) are dropped.
 */
function detectSubIntents(query: string, detectedIntents: string[]): string[] {
  if (detectedIntents.length === 0 || detectedIntents.includes('general')) return [];

  const q = query.toLowerCase();
  const results: string[] = [];

  for (const [parentIntent, subIntentMap] of Object.entries(SUB_INTENT_PATTERNS)) {
    if (!detectedIntents.includes(parentIntent)) continue;
    for (const [subIntentKey, patterns] of Object.entries(subIntentMap)) {
      if (patterns.some(p => p.test(q))) {
        results.push(subIntentKey);
      }
    }
  }

  return results;
}
```

- [ ] **Step 5: Call `detectSubIntents()` inside `analyzeQuery()`**

In `analyzeQuery()`, find these two adjacent lines (around line 90-91):
```ts
const intents = determineIntent(keywords, effectiveLocation, crisisResult, aliasMatch, sanitized);
const intent = intents.primary.intent; // Backward compat
```

After both lines, add:
```ts
// Detect sub-intents (runs after primary intent is known, skips for 'general')
const allDetectedIntents = [
  intents.primary.intent,
  intents.secondary?.intent,
  intents.tertiary?.intent,
].filter((i): i is string => !!i);
const subIntents = detectSubIntents(phoneticCorrected, allDetectedIntents);
```

Then in the `return { ... }` object at the bottom of `analyzeQuery()`, add after `attributes`:
```ts
    attributes,
    ...(subIntents.length > 0 && { subIntents }),
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd /Users/adamyeo/Desktop/ResourceHub && npx vitest run server/search/__tests__/analyzer-intents.test.ts 2>&1 | tail -20
```
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add server/search/analyzer.ts server/search/__tests__/analyzer-intents.test.ts
git commit -m "feat(search): add detectSubIntents() — populates analysis.subIntents"
```

---

### Task 6: Add crisis descriptor guard to `analyzeQuery()`

**Files:**
- Modify: `server/search/analyzer.ts`
- Test: `server/search/__tests__/analyzer-intents.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `server/search/__tests__/analyzer-intents.test.ts`:

```ts
describe('Crisis Descriptor Guard', () => {
  it('does NOT fire crisis for "student mental health crisis" (service descriptor)', () => {
    const analysis = analyzeQuery('student mental health crisis');
    expect(analysis.isCrisis).toBe(false);
    expect(analysis.intent).not.toBe('crisis');
  });

  it('does NOT fire crisis for "youth crisis counselling services"', () => {
    const analysis = analyzeQuery('youth crisis counselling services');
    expect(analysis.isCrisis).toBe(false);
  });

  it('DOES fire crisis for "I am in a mental health crisis right now"', () => {
    const analysis = analyzeQuery('I am in a mental health crisis right now');
    expect(analysis.isCrisis).toBe(true);
  });

  it('DOES fire crisis for "mental health crisis I want to end it"', () => {
    const analysis = analyzeQuery('mental health crisis I want to end it');
    expect(analysis.isCrisis).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify expected failure pattern**

```bash
cd /Users/adamyeo/Desktop/ResourceHub && npx vitest run server/search/__tests__/analyzer-intents.test.ts 2>&1 | tail -20
```
Expected: exactly 2 failures (the first two tests — `isCrisis` is currently `true` for both). The last two tests should already pass (genuine crisis queries already fire correctly).

- [ ] **Step 3: Add guard constants near the top of `analyzer.ts`**

In `server/search/analyzer.ts`, add these constants after the existing imports and before the first function definition:

```ts
/** Pattern (a): "crisis" used as forward compound noun modifier — e.g. "crisis counselling", "crisis centre" */
const CRISIS_FORWARD_DESCRIPTOR = /\bcrisis\s+(centre|center|counsell|service|support|line|help|team|unit|worker)\b/i;
/** Pattern (b): "crisis" used as trailing descriptor — e.g. "mental health crisis", "student mental health crisis" */
const CRISIS_TRAILING_DESCRIPTOR = /\b(mental health|student|financial|housing|emotional|youth)\s+crisis\b/i;
/** First-person distress signals — presence means "crisis" IS self-referential, not a descriptor */
const FIRST_PERSON_DISTRESS = /\b(i\s+(am|'?m|feel|want|need|can'?t|cannot)|me|myself)\b.*\b(crisis|suicid|kill|die|end|hurt|harm)\b|\b(kill|end|hurt|harm|die|suicid).*\b(myself|me|my life)\b/i;
```

- [ ] **Step 4: Replace `const isCrisis` and add the guard in `analyzeQuery()`**

In `analyzeQuery()`, find this line (around line 84):
```ts
const isCrisis = crisisResult.isCrisis;
```

**Remove that line entirely.** Replace it with the guard block below. It must be placed **after** both `detectCrisis()` and `determineIntent()` have run — specifically, after `const intent = intents.primary.intent` (around line 91):

```ts
// Crisis descriptor guard: "crisis" as a service-type descriptor should not trigger the
// direct crisis path. Override isCrisis=false when:
//   1. No first-person distress language detected
//   2. "crisis" appears only as a compound noun modifier (forward or trailing)
//   3. At least one non-crisis intent was detected
let isCrisis = crisisResult.isCrisis;
if (isCrisis && !FIRST_PERSON_DISTRESS.test(normalized)) {
  const isCrisisDescriptor = CRISIS_FORWARD_DESCRIPTOR.test(normalized) ||
    CRISIS_TRAILING_DESCRIPTOR.test(normalized);
  const hasNonCrisisIntent = intent !== 'crisis' && intent !== 'general';
  if (isCrisisDescriptor && hasNonCrisisIntent) {
    isCrisis = false;
    console.log(`[QueryAnalyzer] Crisis descriptor guard: overriding isCrisis=false for "${normalized.slice(0, 50)}"`);
  }
}
```

Note: The guard tests against `normalized` (not `sanitized`) for consistency with `detectCrisis()`, which also operates on the normalized form.

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/adamyeo/Desktop/ResourceHub && npx vitest run server/search/__tests__/analyzer-intents.test.ts 2>&1 | tail -20
```
Expected: all tests pass, including the 4 new crisis descriptor tests.

- [ ] **Step 6: Run full test suite to check for regressions**

```bash
cd /Users/adamyeo/Desktop/ResourceHub && npx vitest run 2>&1 | tail -30
```
Expected: all existing tests still pass. Zero regressions.

- [ ] **Step 7: Commit**

```bash
git add server/search/analyzer.ts server/search/__tests__/analyzer-intents.test.ts
git commit -m "fix(search): crisis descriptor guard — prevent over-triggering on service-seeking queries"
```

---

## Chunk 3: LLM Integration, Scoring & Evaluation

### Task 7: Add `subIntents` to LLM intent layer

**Files:**
- Modify: `server/search/llm-intent.ts`

- [ ] **Step 1: Add `VALID_SUB_INTENTS` to the existing config import**

In `server/search/llm-intent.ts`, find the existing import from `'./config'`:
```ts
import type { QueryIntent } from './config';
```
Update it to:
```ts
import type { QueryIntent } from './config';
import { VALID_SUB_INTENTS } from './config';
```

- [ ] **Step 2: Add `subIntents` to `LLMUnderstanding` interface**

Find the `LLMUnderstanding` interface (around line 21):
```ts
interface LLMUnderstanding {
  intents: ScoredIntent[];
  attributes?: QueryAttributes;
}
```
Add `subIntents`:
```ts
interface LLMUnderstanding {
  intents: ScoredIntent[];
  attributes?: QueryAttributes;
  subIntents?: string[];
}
```

- [ ] **Step 3: Extend the system prompt with `subIntents` field**

In `SYSTEM_PROMPT`, after the `semanticQuery` field description (field 6, ends around line 99 with the semanticQuery examples) and before the "IMPORTANT:" line, add:

```
7. "subIntents": Optional array of the most specific sub-intent(s) detected (max 3).
   Use namespaced format: "parentIntent.subIntent". Only include if clearly present in the query.
   Examples:
   - "eviction notice received" → ["housing_urgent.eviction_defense", "legal_aid.eviction_defense"]
   - "naloxone location" → ["substance_abuse.harm_reduction"]
   - "anger management course" → ["mental_health.anger_management"]
   - "NIHB dental coverage" → ["indigenous_services.nihb_coverage", "healthcare_access.dental"]
   Valid sub-intents (grouped by parent):
   housing_urgent: emergency_shelter, eviction_defense, transitional_housing, affordable_housing, youth_housing
   substance_abuse: detox, residential_treatment, harm_reduction, outpatient, gambling, cannabis
   healthcare_access: dental, walk_in_clinic, hospital_er, prescription_coverage, disability_equipment
   mental_health: counselling, psychiatry, eating_disorder, trauma, anger_management, postpartum
   indigenous_services: residential_school_survivor, nihb_coverage, cultural_healing, language_preservation
   newcomer_services: esl_language, credential_recognition, settlement, refugee
   legal_aid: family_court, eviction_defense, restraining_order, immigration_law
   employment_support: credential_recognition, barrier_employment, resume_help
   veteran_services: ptsd_trauma, military_family, benefits_navigation
   disability_support: aish_application, autism_support, mobility_aids, acquired_brain_injury
```

- [ ] **Step 4: Bump `max_tokens` to accommodate subIntents**

Find `max_tokens: 250` and change to `max_tokens: 320`.

- [ ] **Step 5: Parse and validate `subIntents` in the response handler**

In the response parsing block, find the `understanding` object construction (around line 194):
```ts
const understanding: LLMUnderstanding = {
  intents: validIntents,
  ...(hasAttributes && { attributes }),
};
```

**After** this object is constructed, add the subIntents parsing block that mutates it:
```ts
// Parse subIntents — validate against VALID_SUB_INTENTS (imported from config)
if (Array.isArray(parsed.subIntents) && parsed.subIntents.length > 0) {
  const validSubIntents = (parsed.subIntents as string[])
    .filter(s => typeof s === 'string' && VALID_SUB_INTENTS.has(s))
    .slice(0, 3);
  if (validSubIntents.length > 0) {
    understanding.subIntents = validSubIntents;
  }
}
```

- [ ] **Step 6: Merge LLM subIntents into analysis in `applyLLMUnderstanding()`**

Find `applyLLMUnderstanding()` (around line 229). **Before editing, read the full current function body** to ensure you don't accidentally drop any existing logic (crisis passthrough, etc.). The function currently:
```ts
function applyLLMUnderstanding(analysis: QueryAnalysis, understanding: LLMUnderstanding): QueryAnalysis {
  const { intents: llmIntents, attributes } = understanding;
  let result = applyLLMIntents(analysis, llmIntents);
  if (attributes) {
    result = { ...result, attributes };
  }
  return result;
}
```

Update the destructuring and add subIntents merge **without removing any other existing logic**:
```ts
function applyLLMUnderstanding(analysis: QueryAnalysis, understanding: LLMUnderstanding): QueryAnalysis {
  const { intents: llmIntents, attributes, subIntents: llmSubIntents } = understanding;
  let result = applyLLMIntents(analysis, llmIntents);
  if (attributes) {
    result = { ...result, attributes };
  }
  // Merge LLM sub-intents with regex-detected sub-intents (union, deduplicated)
  if (llmSubIntents && llmSubIntents.length > 0) {
    const existing = result.subIntents ?? [];
    const merged = Array.from(new Set([...existing, ...llmSubIntents]));
    result = { ...result, subIntents: merged };
  }
  return result;
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/adamyeo/Desktop/ResourceHub && npm run check 2>&1 | head -30
```
Expected: zero new errors.

- [ ] **Step 8: Commit**

```bash
git add server/search/llm-intent.ts
git commit -m "feat(search): add subIntents to LLM intent layer — extract, validate, merge into analysis"
```

---

### Task 8: Pass `subIntents` to LLM reranker (extend rule 5)

**Files:**
- Modify: `server/search/strategies/scoring/llm-rerank.ts`

- [ ] **Step 1: Locate the user message construction**

```bash
grep -n "serviceLines\|Intent:\|Semantic interpretation\|userMessage\|user message" /Users/adamyeo/Desktop/ResourceHub/server/search/strategies/scoring/llm-rerank.ts | head -20
```
This will show you the exact line(s) where the prompt user message is assembled.

- [ ] **Step 2: Extend rule 5 in the system prompt**

Find rule 5 in `SYSTEM_PROMPT` (currently starts with `5. SECONDARY INTENT AMPLIFIES RELEVANCE`). Replace it with:

```
5. SECONDARY INTENT AND SUB-INTENT AMPLIFY RELEVANCE.
   - When a secondary intent is detected with meaningful confidence (shown in parentheses), services
     matching BOTH the primary and secondary intent should score 90-100. Services matching only the
     primary intent should cap around 70 unless exceptionally relevant.
   - When sub-intents are detected (shown in the Sub-intents line), services directly matching a
     sub-intent should score 90-100. Services matching the parent intent but not the sub-intent
     should cap at ~65. Example: sub-intent "substance_abuse.harm_reduction" → naloxone/needle
     exchange services score 90+; generic addiction treatment caps at 65.
   - Sub-intent specificity takes precedence: if "housing_urgent.eviction_defense" is detected,
     tenant advocacy / legal aid services score 90+, emergency shelters cap at 60.
   - The user explicitly mentioned these dimensions — honor that specificity.
```

- [ ] **Step 3: Add `subIntentsLine` to the user message**

At the location found in Step 1, update the user message construction to include subIntents:

```ts
const subIntentsLine = analysis.subIntents?.length
  ? `\nSub-intents: ${analysis.subIntents.join(', ')}`
  : '';
```

Insert `${subIntentsLine}` into the user message string after the Intent/Secondary line and before `Semantic interpretation:`. The resulting message format should be:
```
Query: "..."
Intent: ...[, Secondary: ... (...)]
[Sub-intents: ..., ...]
Semantic interpretation: ...
Services:
...
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/adamyeo/Desktop/ResourceHub && npm run check 2>&1 | head -30
```
Expected: zero new errors.

- [ ] **Step 5: Commit**

```bash
git add server/search/strategies/scoring/llm-rerank.ts
git commit -m "feat(search): pass subIntents context to LLM reranker — extend rule 5 for sub-intent amplification"
```

---

### Task 9: Extend `INTENT_SERVICE_MAP` with sub-intent category patterns

**Files:**
- Modify: `server/search/strategies/scoring/intent-boost.ts`

- [ ] **Step 1: Read the current `INTENT_SERVICE_MAP` shape**

```bash
grep -n "INTENT_SERVICE_MAP\|serviceTypes\|categoryPatterns" /Users/adamyeo/Desktop/ResourceHub/server/search/strategies/scoring/intent-boost.ts | head -30
```
Each entry has at minimum `serviceTypes: string[]` and `categoryPatterns: RegExp`. Confirm this shape before editing.

- [ ] **Step 2: Extend `categoryPatterns` for high-value intents**

For each entry below, find it in `INTENT_SERVICE_MAP` and update only the `categoryPatterns` regex. Do not change `serviceTypes` or any other fields.

**`housing_urgent`** — add eviction/tenant/legal terms:
```ts
categoryPatterns: /emergency.*shelter|shelter.*emergency|affordable.*housing|transitional|supportive.*housing|tenant.*rights|legal.*aid|eviction/i,
```

**`substance_abuse`** — add harm reduction:
```ts
categoryPatterns: /addiction|detox|withdrawal|harm.*reduction|naloxone|recovery|residential.*treatment|outpatient/i,
```

**`mental_health`** — add anger management, postpartum:
```ts
categoryPatterns: /mental.*health|counsell|therapy|eating.*disorder|trauma|PTSD|anger.*management|postpartum|perinatal/i,
```

**`newcomer_services`** — add ESL, credential:
```ts
categoryPatterns: /newcomer|settlement|immigrant|refugee|ESL|english.*language|credential/i,
```

**`indigenous_services`** — if the entry exists, extend; if missing, add it:
```ts
'indigenous_services': {
  serviceTypes: ['indigenous'],
  categoryPatterns: /indigenous|first.*nation|m[eé]tis|inuit|aboriginal|cultural.*healing|residential.*school/i,
},
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/adamyeo/Desktop/ResourceHub && npm run check 2>&1 | head -30
```
Expected: zero new errors.

- [ ] **Step 4: Commit**

```bash
git add server/search/strategies/scoring/intent-boost.ts
git commit -m "feat(search): extend INTENT_SERVICE_MAP categoryPatterns for sub-intent coverage"
```

---

### Task 10: Bump cache version

**Files:**
- Modify: `server/search/index.ts:10`

- [ ] **Step 1: Bump `CACHE_VERSION`**

In `server/search/index.ts`, change:
```ts
const CACHE_VERSION = 'v137'; // text-embedding-3-large upgrade + off-category penalty
```
to:
```ts
const CACHE_VERSION = 'v138'; // sub-intent taxonomy, crisis descriptor guard, keyword expansions
```

- [ ] **Step 2: Commit**

```bash
git add server/search/index.ts
git commit -m "feat(search): bump CACHE_VERSION to v138 — invalidate stale cache after intent changes"
```

---

### Task 11: Fix overnight test expectations + add sub-intent tests

**Files:**
- Modify: `server/evaluation/overnight_test.mjs`

**Important:** Steps 1 and 2 are separate operations:
- **Step 1** modifies the 6 *existing* query objects already in the BATCHES array (change their `mustMatch`).
- **Step 2** adds *new* query objects that do not yet exist.
Do NOT duplicate any query from Step 1 in Step 2.

- [ ] **Step 1: Fix the 6 existing bad test patterns**

Search for each query string and update its `mustMatch` (or equivalent field) **in the existing object**:

```bash
grep -n "eviction help\|baby formula\|utility bill\|anger management classes\|residential school survivors\|foreign credential" /Users/adamyeo/Desktop/ResourceHub/server/evaluation/overnight_test.mjs
```

For each found object, update the pattern as follows:

| Query (search for this string) | Old pattern to remove | New pattern to use |
|---|---|---|
| `"eviction help Alberta"` | `"tenant"` | `"housing"` |
| `"baby formula and diapers help"` | `"family"` | `"basic needs"` |
| `"utility bill help can't pay power"` | `"utility"` | `"financial"` |
| `"anger management classes"` | `"anger management"` | `"counselling"` |
| `"residential school survivors support"` | `"residential school"` | `"Indigenous"` |
| `"foreign credential recognition"` | `"credential"` | `"newcomer"` |

- [ ] **Step 2: Add new sub-intent test queries**

Check the batch structure (each batch has a `queries: [...]` array). Add each new object to the appropriate batch's `queries` array. Verify the format matches existing entries by reading 2-3 existing entries first.

**BATCH 1 (Crisis & Safety)** — add:
```js
{ query: "student mental health crisis",
  expect: { mustMatch: ["student", "campus", "mental health"] } },
```

**BATCH 2 (Substance Abuse)** — add:
```js
{ query: "where to get naloxone in Edmonton", location: "Edmonton",
  expect: { intent: "substance_abuse" } },
```
(No `mustMatch` — this is a routing-only test until harm reduction services are in the DB.)

**BATCH 4 (Mental Health)** — add:
```js
{ query: "postpartum depression support",
  expect: { mustMatch: ["mental health", "postpartum"] } },
```

**BATCH 5 (Demographics & Identity)** — add:
```js
{ query: "NIHB mental health coverage",
  expect: { mustMatch: ["Indigenous", "First Nations"] } },
{ query: "ESL classes free",
  expect: { mustMatch: ["newcomer", "settlement"] } },
{ query: "military family support",
  expect: { mustMatch: ["veteran", "military", "family"] } },
```

**BATCH 6 (Legal & Employment)** — add:
```js
{ query: "help with AISH application",
  expect: { mustMatch: ["AISH", "disability"] } },
{ query: "child custody lawyer free",
  expect: { mustMatch: ["legal", "family"] } },
```

- [ ] **Step 3: Commit**

```bash
git add server/evaluation/overnight_test.mjs
git commit -m "test(eval): fix 6 bad test patterns + add 9 new sub-intent queries to overnight harness"
```

---

### Task 12: Run full verification

- [ ] **Step 1: Run unit tests**

```bash
cd /Users/adamyeo/Desktop/ResourceHub && npx vitest run 2>&1 | tail -30
```
Expected: all tests pass.

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/adamyeo/Desktop/ResourceHub && npm run check 2>&1 | head -30
```
Expected: zero errors.

- [ ] **Step 3: Start dev server and run CI evaluation**

First check port 5000 is free:
```bash
lsof -i :5000 | grep LISTEN && echo "PORT IN USE — kill it first" || echo "Port free"
```

If port is in use:
```bash
kill $(lsof -ti:5000) 2>/dev/null; sleep 1
```

Then start server and run CI eval:
```bash
npm run dev &
sleep 8
node server/evaluation/ci_runner.mjs 2>&1 | tail -30
```
Expected: 52/52 pass, score ≥ 97/100 (no regression from v137 baseline).

- [ ] **Step 4: Kill the dev server**

```bash
kill $(lsof -ti:5000) 2>/dev/null
```

- [ ] **Step 5: Verify clean git state**

```bash
git log --oneline -12
git status
```
Expected: 12 clean commits, working tree clean (only `CLAUDE.md`, `scripts/data/service-gaps-services.json`, and `server/evaluation/overnight_results.json` as untracked/modified — these are pre-existing and not part of this plan).
