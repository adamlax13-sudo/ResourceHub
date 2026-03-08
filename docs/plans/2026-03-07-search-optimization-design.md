# Search Optimization Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve search relevance, ranking, and completeness so users get the most relevant service listings for their needs.

**Architecture:** 4-phase approach (Baseline -> Diagnose -> Fix -> Verify) using the existing evaluation framework + a new non-AI deterministic evaluator. Fixes target the analyzer (typo correction, intent detection), scoring config (boost values), and test infrastructure.

**Tech Stack:** TypeScript, Vitest, PostgreSQL (pgvector), OpenAI embeddings, Anthropic Claude (evaluation)

## Problem Statement

Users are experiencing three categories of search quality issues:
1. **Wrong category** — queries return services from the wrong domain (e.g., "dental" corrected to "mental")
2. **Wrong ranking** — relevant services exist but are buried below less relevant ones
3. **Missing services** — known-good services don't appear in results for relevant queries

Last successful evaluation (Feb 26, 2026): **82/100 overall** across 25 queries, with 11/25 scoring below 80. Weakest areas: anxiety therapy (69), veteran PTSD (75), autism support (75), and several intents at 79.

## Known Issues (from evaluation + codebase review)

- **Typo correction bug**: "dental" -> "mental" (Levenshtein edit distance 1). No typo test cases exist.
- **Intent detection mismatches**: "LGBTQ counselling Calgary" detected as `mental_health` instead of `lgbtq_services`; "my son is addicted" detected as `substance_abuse` instead of `family_addiction_support`.
- **Duplicate results**: Multiple entries for same org in some queries (e.g., Centre for Sexuality in LGBTQ query).
- **Crisis service bleed**: Crisis services appear in non-crisis queries like "anxiety therapy no waitlist" (scored 69).
- **Performance**: 24/25 queries taking >1s in last evaluation run.
- **Expired ANTHROPIC_API_KEY**: Evaluation system has been non-functional since ~March 2026.
- **61 services with confidence_score=0**: Important services (Mental Health Help Line, SMART Recovery, 311) may be unfairly ranked.

## Approach: Baseline -> Diagnose -> Fix -> Verify

Four phases executed sequentially. Each phase has clear deliverables and exit criteria.

---

## Phase 1: Baseline — Capture Current State

### 1.1 Fix Evaluation Prerequisites
- Verify/update `ANTHROPIC_API_KEY` in `.env`
- Add a **non-AI fallback evaluator** that scores based on:
  - `mustInclude` service presence in results (binary pass/fail)
  - `mustExclude` service absence (binary pass/fail)
  - `expectedPatterns` keyword matching against result names/descriptions
  - Intent detection accuracy (expected vs detected)
  - Result count (zero-result = automatic fail)
- This allows evaluation to run without API costs and provides deterministic, reproducible scores

### 1.2 Expand Test Query Suite
Add missing query categories to `comprehensive_test_queries.ts`:

**Typo/misspelling queries:**
- "dental services" (must NOT be corrected to "mental")
- "counslling near me" (should correct to "counselling")
- "adiction help" (should correct to "addiction")
- "fud bank" (should correct to "food bank")
- "sheltr tonight" (should correct to "shelter")

**Natural language / colloquial queries:**
- "I just got out of jail and need somewhere to stay"
- "where can I get free food today"
- "my kid is out of control on drugs"
- "I think I might be autistic"
- "how do I apply for disability benefits"

**Multi-intent queries (complex):**
- "housing for women fleeing abuse" (housing + DV + gender)
- "indigenous youth addiction help" (already exists)
- "senior with dementia needs meals delivered"
- "pregnant teenager needs housing"

**Specific service name searches:**
- "SMART Recovery"
- "211"
- "Al-Anon"
- "Kids Help Phone"

**Queries where we know results are wrong:**
- "dental clinic" (currently returns mental health)
- Queries from the 69-79 scoring band in Feb 26 eval

### 1.3 Run Baseline Evaluation
- Run the non-AI evaluator against all queries (old + new)
- Run the Claude evaluator against all queries (if API key is valid)
- Store results as `baseline-YYYY-MM-DD.json` for before/after comparison
- Record per-intent average scores

### 1.4 Mine Search Analytics
- Query the `search_analytics` table for real user search patterns
- Identify top 20 most common searches not covered by test queries
- Identify zero-result queries from production logs
- Add representative real-user queries to the test suite

**Exit criteria:** Baseline scores captured for 80+ test queries across all intents. Non-AI evaluator functional.

---

## Phase 2: Diagnose — Find Root Causes

### 2.1 Build Diagnostic Script
Create `server/evaluation/diagnose_query.ts` that, for a given query, outputs:
- Analyzer output: detected intent, typo corrections applied, keywords extracted, negative terms
- SQL search results (pre-merge) with match reasons
- Semantic search results (pre-merge) with similarity scores
- RRF scores after merge
- All boosts/penalties applied with magnitudes and reasons
- Final ranking with score breakdown per service

Run against every query scoring below 80 in the baseline.

### 2.2 Categorize Failures
Group each failing query into root cause buckets:

| Bucket | Description | Example |
|--------|-------------|---------|
| **Analyzer bug** | Typo correction, intent misdetection | "dental" -> "mental" |
| **Scoring imbalance** | Right services found but wrong order | Crisis services in anxiety query |
| **Missing patterns** | Intent patterns don't cover query language | "LGBTQ counselling" -> mental_health |
| **Data gaps** | Service lacks tags/category/embeddings | Veteran services missing PTSD tags |
| **Dedup failure** | Same org appears multiple times | Centre for Sexuality x3 |
| **Performance** | Query takes >1s | 24/25 queries in last eval |

### 2.3 Produce Diagnosis Report
A markdown report mapping every failing query to its bucket, with the specific pipeline stage where things go wrong. This report drives Phase 3 prioritization.

**Exit criteria:** Every sub-80 query has a diagnosed root cause. Buckets are sized (how many queries per bucket).

---

## Phase 3: Fix — Grouped by Root Cause

Fixes are ordered by expected impact (most queries improved per fix).

### 3a. Analyzer Fixes
- **Typo correction safeguards**: Add exception list for valid words that are 1 edit distance from common domain terms (e.g., "dental" should not become "mental"). Consider minimum word length threshold for Levenshtein corrections.
- **Intent detection patterns**: Add/fix patterns in `config/analysis.ts` for misdetected intents:
  - LGBTQ patterns should fire before generic mental_health
  - Family addiction patterns ("my son/husband/wife is addicted") should detect `family_addiction_support`
  - Review intent priority ordering — more specific intents should be checked before generic ones
- **Regression test**: Unit test for every typo correction fix and every intent detection fix

### 3b. Scoring Rebalancing
- **Crisis bleed fix**: In `intent-boost.ts`, add negative boost for crisis-category services when query intent is non-crisis (e.g., general mental health, anxiety therapy)
- **Audit boost stacking**: Preference (1.8x) * filter-match (1.8x) * quality (1.25x) can compound to 4x. Verify this doesn't create runaway scores. Consider capping total post-search multiplier.
- **Tune underperforming intents**: Based on diagnosis, adjust boost values in `config/scoring.ts` for veteran, autism, grief, legal intents
- **confidence_score=0 audit**: Ensure the 61 services with score 0 aren't being penalized by quality boost (current code treats 0 as neutral — verify this is working)

### 3c. Pattern & Coverage Expansion
- Add domain patterns to `config/analysis.ts` for query language the analyzer doesn't recognize
- Expand substance/demographic detection for colloquial terms ("out of control on drugs", "I think I might be autistic")
- Add service alias mappings for common name variations ("Kids Help Phone", "211", "AA")

### 3d. Deduplication & Data Quality
- Review `applyCategoryDiversity()` and `applyOrganizationDiversity()` in `strategies/filters.ts` — tighten org-level dedup if same org appears 3+ times
- Audit services with missing embeddings (would cause semantic search misses)
- Check for services with wrong categories that cause them to appear in wrong intents

### 3e. Performance
- Profile slow queries to identify bottleneck (SQL? embedding generation? OpenAI API?)
- Review embedding cache hit rate (LRU 500 entries, 24hr TTL)
- Consider raising precomputed cache coverage for common queries

### 3f. Test Infrastructure
- Add regression unit tests for every analyzer fix (typo corrections, intent detection)
- Add "golden result" E2E tests: specific services that MUST appear in top N for key queries
- Expand `comprehensive_test_queries.ts` with queries discovered during diagnosis
- Ensure non-AI evaluator covers all new test cases

**Exit criteria:** All fixes implemented. All new unit/E2E tests passing. CACHE_VERSION bumped.

---

## Phase 4: Verify — Before/After Comparison

### 4.1 Re-run Full Evaluation
- Run non-AI evaluator against same baseline query set
- Run Claude evaluator (if API key valid) against same queries
- Generate comparison report: baseline vs post-fix, per-intent deltas

### 4.2 Regression Check
- Every intent that scored 80+ in baseline must still score 80+
- Any regression gets investigated and fixed before declaring done
- Run existing unit tests (`npm test`) and E2E tests

### 4.3 Cache & Deployment
- Bump `CACHE_VERSION` in `server/search/index.ts` to invalidate stale results
- Clear precomputed cache if scoring logic changed
- Verify live site search behavior after deploy

### 4.4 Final Report
Generate a summary showing:
- Overall score improvement (before/after)
- Per-intent score deltas
- Specific queries that improved
- List of all changes made (files modified, config values changed)
- New test coverage added

**Exit criteria:**
- All intents score >= 60 (minAcceptableScore)
- Average across intents >= 80 (targetScore)
- Zero regressions from baseline
- Known failing queries (dental, LGBTQ intent, family addiction intent) now pass
- Regression test suite covers every fix

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Overall eval score | 82/100 | 90/100 |
| Queries scoring 80+ | 14/25 (56%) | 80%+ of expanded suite |
| Queries scoring <60 | Unknown (need fresh baseline) | 0 |
| Intent detection accuracy | 23/25 (92%) | 98%+ |
| Typo correction accuracy | Unknown (no tests) | 100% (tested) |
| Search latency p95 | >1s | <500ms |

## Files That Will Be Modified

| File | Changes |
|------|---------|
| `server/search/config/analysis.ts` | Intent patterns, typo exceptions |
| `server/search/config/scoring.ts` | Boost/penalty value tuning |
| `server/search/strategies/scoring/intent-boost.ts` | Crisis bleed fix, intent boost adjustments |
| `server/search/strategies/filters.ts` | Org dedup tightening |
| `server/helpers/keywords.ts` | Typo correction safeguards |
| `server/search/index.ts` | CACHE_VERSION bump |
| `server/evaluation/comprehensive_test_queries.ts` | New test queries |
| `server/evaluation/evaluate_search.ts` | Non-AI fallback evaluator |
| `server/evaluation/diagnose_query.ts` | New diagnostic script |
| `server/search/__tests__/` | New regression tests |

## Out of Scope

- Adding new services to the database (data enrichment is a separate effort)
- Frontend search UI changes
- Embedding model changes (would require re-embedding all services)
- Scraper pipeline changes

---

## Implementation Plan

### Task 1: Build Non-AI Deterministic Evaluator

The existing evaluator (`server/evaluation/evaluate_search.ts`) requires `ANTHROPIC_API_KEY` which is expired. Build a deterministic scorer that works without any API.

**Files:**
- Create: `server/evaluation/deterministic_evaluator.ts`
- Test: `server/evaluation/__tests__/deterministic-evaluator.test.ts`

**Step 1: Write the test for the deterministic scorer**

```typescript
// server/evaluation/__tests__/deterministic-evaluator.test.ts
import { describe, it, expect } from 'vitest';
import { scoreDeterministic } from '../deterministic_evaluator';

describe('Deterministic Evaluator', () => {
  const mockServices = [
    { name: '988 Suicide Crisis Helpline', category: 'crisis_services', description: 'National crisis line', location: 'Alberta-wide' },
    { name: 'Calgary Counselling Centre', category: 'mental_health', description: 'Affordable counselling', location: 'Calgary' },
  ];

  it('scores 100 for mustInclude when service is present', () => {
    const result = scoreDeterministic(
      { query: 'crisis help', intent: 'crisis', description: 'test', mustInclude: ['988 Suicide Crisis Helpline'] },
      mockServices as any,
      'crisis'
    );
    expect(result.scores.mustInclude).toBe(100);
  });

  it('scores 0 for mustInclude when service is missing', () => {
    const result = scoreDeterministic(
      { query: 'crisis help', intent: 'crisis', description: 'test', mustInclude: ['Nonexistent Service'] },
      mockServices as any,
      'crisis'
    );
    expect(result.scores.mustInclude).toBe(0);
  });

  it('scores 0 for mustExclude when excluded service is present', () => {
    const result = scoreDeterministic(
      { query: 'test', intent: 'crisis', description: 'test', mustExclude: ['988 Suicide Crisis Helpline'] },
      mockServices as any,
      'crisis'
    );
    expect(result.scores.mustExclude).toBe(0);
  });

  it('scores 100 for mustExclude when excluded service is absent', () => {
    const result = scoreDeterministic(
      { query: 'test', intent: 'mental_health', description: 'test', mustExclude: ['Salvation Army'] },
      mockServices as any,
      'mental_health'
    );
    expect(result.scores.mustExclude).toBe(100);
  });

  it('scores intent accuracy correctly', () => {
    const result = scoreDeterministic(
      { query: 'test', intent: 'crisis', description: 'test' },
      mockServices as any,
      'crisis' // detected matches expected
    );
    expect(result.scores.intentAccuracy).toBe(100);
  });

  it('scores 0 intent accuracy on mismatch', () => {
    const result = scoreDeterministic(
      { query: 'test', intent: 'lgbtq_services', description: 'test' },
      mockServices as any,
      'mental_health' // mismatch
    );
    expect(result.scores.intentAccuracy).toBe(0);
  });

  it('scores pattern match based on keyword hits', () => {
    const result = scoreDeterministic(
      { query: 'test', intent: 'crisis', description: 'test', expectedPatterns: ['crisis', 'helpline', 'missing'] },
      mockServices as any,
      'crisis'
    );
    // 2 of 3 patterns matched -> ~67
    expect(result.scores.patternMatch).toBeGreaterThan(60);
    expect(result.scores.patternMatch).toBeLessThan(70);
  });

  it('scores 0 overall when zero results', () => {
    const result = scoreDeterministic(
      { query: 'test', intent: 'crisis', description: 'test' },
      [],
      'crisis'
    );
    expect(result.scores.overall).toBe(0);
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `npx vitest run server/evaluation/__tests__/deterministic-evaluator.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the deterministic scorer**

```typescript
// server/evaluation/deterministic_evaluator.ts
import type { TestQuery } from './comprehensive_test_queries';

interface DeterministicScores {
  mustInclude: number;    // 0 or 100
  mustExclude: number;    // 0 or 100
  patternMatch: number;   // 0-100 based on keyword hit rate
  intentAccuracy: number; // 0 or 100
  hasResults: number;     // 0 or 100
  overall: number;        // weighted average
}

interface DeterministicResult {
  query: TestQuery;
  detectedIntent: string;
  resultCount: number;
  scores: DeterministicScores;
  failures: string[];
}

export function scoreDeterministic(
  testQuery: TestQuery,
  results: Array<{ name: string; category: string; description: string; location: string }>,
  detectedIntent: string
): DeterministicResult {
  const failures: string[] = [];

  // Zero results = automatic 0
  if (results.length === 0) {
    return {
      query: testQuery,
      detectedIntent,
      resultCount: 0,
      scores: { mustInclude: 0, mustExclude: 0, patternMatch: 0, intentAccuracy: 0, hasResults: 0, overall: 0 },
      failures: ['Zero results returned'],
    };
  }

  const hasResults = 100;

  // mustInclude: check if every required service appears in results
  let mustInclude = 100;
  if (testQuery.mustInclude && testQuery.mustInclude.length > 0) {
    const resultNames = results.map(r => r.name.toLowerCase());
    const missing = testQuery.mustInclude.filter(
      name => !resultNames.some(rn => rn.includes(name.toLowerCase()))
    );
    if (missing.length > 0) {
      mustInclude = 0;
      failures.push(`Missing required services: ${missing.join(', ')}`);
    }
  }

  // mustExclude: check that no excluded services appear
  let mustExclude = 100;
  if (testQuery.mustExclude && testQuery.mustExclude.length > 0) {
    const resultText = results.map(r => `${r.name} ${r.description}`).join(' ').toLowerCase();
    const present = testQuery.mustExclude.filter(
      name => resultText.includes(name.toLowerCase())
    );
    if (present.length > 0) {
      mustExclude = 0;
      failures.push(`Excluded services present: ${present.join(', ')}`);
    }
  }

  // patternMatch: what % of expectedPatterns appear in top 10 results
  let patternMatch = 100;
  if (testQuery.expectedPatterns && testQuery.expectedPatterns.length > 0) {
    const top10Text = results.slice(0, 10)
      .map(r => `${r.name} ${r.category} ${r.description}`)
      .join(' ')
      .toLowerCase();
    const hits = testQuery.expectedPatterns.filter(p => top10Text.includes(p.toLowerCase()));
    patternMatch = Math.round((hits.length / testQuery.expectedPatterns.length) * 100);
    const missed = testQuery.expectedPatterns.filter(p => !top10Text.includes(p.toLowerCase()));
    if (missed.length > 0) {
      failures.push(`Missing patterns: ${missed.join(', ')}`);
    }
  }

  // intentAccuracy
  const intentAccuracy = (testQuery.intent === detectedIntent || testQuery.intent === 'general') ? 100 : 0;
  if (intentAccuracy === 0) {
    failures.push(`Intent mismatch: expected "${testQuery.intent}", got "${detectedIntent}"`);
  }

  // Weighted overall: intentAccuracy 30%, mustInclude 25%, patternMatch 25%, mustExclude 10%, hasResults 10%
  const overall = Math.round(
    intentAccuracy * 0.30 +
    mustInclude * 0.25 +
    patternMatch * 0.25 +
    mustExclude * 0.10 +
    hasResults * 0.10
  );

  return {
    query: testQuery,
    detectedIntent,
    resultCount: results.length,
    scores: { mustInclude, mustExclude, patternMatch, intentAccuracy, hasResults, overall },
    failures,
  };
}
```

**Step 4: Run the test to verify it passes**

Run: `npx vitest run server/evaluation/__tests__/deterministic-evaluator.test.ts`
Expected: PASS (all 8 tests)

**Step 5: Commit**

```bash
git add server/evaluation/deterministic_evaluator.ts server/evaluation/__tests__/deterministic-evaluator.test.ts
git commit -m "feat(eval): add deterministic evaluator for API-free search scoring"
```

---

### Task 2: Add Typo Correction Tests and Fixes

The typo corrector in `server/helpers/keywords.ts` has a known bug: "dental" gets corrected to "mental". The `COMMON_MISSPELLINGS` map already has an identity entry for "dental" (line 56), but we need to verify it works and add test coverage.

**Files:**
- Create: `server/helpers/__tests__/keywords.test.ts`
- Modify: `server/helpers/keywords.ts` (add more identity mappings if needed)

**Step 1: Write the failing tests**

```typescript
// server/helpers/__tests__/keywords.test.ts
import { describe, it, expect } from 'vitest';
import { correctTypos, correctQueryPhonetic, findClosestKeyword } from '../keywords';

describe('correctTypos', () => {
  it('does NOT correct "dental" to "mental"', () => {
    const { corrected } = correctTypos('dental services');
    expect(corrected).toContain('dental');
    expect(corrected).not.toContain('mental');
  });

  it('does NOT correct "rental" to "mental"', () => {
    const { corrected } = correctTypos('rental assistance');
    expect(corrected).toContain('rental');
  });

  it('does NOT correct "hopeless" to "homeless"', () => {
    const { corrected } = correctTypos('feeling hopeless');
    expect(corrected).toContain('hopeless');
  });

  it('corrects "addicton" to "addiction"', () => {
    const { corrected, corrections } = correctTypos('addicton help');
    expect(corrected).toContain('addiction');
    expect(corrections.length).toBe(1);
  });

  it('corrects "councelling" to "counselling"', () => {
    const { corrected } = correctTypos('councelling near me');
    expect(corrected).toContain('counselling');
  });

  it('corrects "sheltar" to "shelter"', () => {
    const { corrected } = correctTypos('sheltar tonight');
    expect(corrected).toContain('shelter');
  });

  it('corrects "anxeity" to "anxiety"', () => {
    const { corrected } = correctTypos('anxeity treatment');
    expect(corrected).toContain('anxiety');
  });

  it('does not modify already correct words', () => {
    const { corrected, corrections } = correctTypos('addiction counselling shelter');
    expect(corrected).toBe('addiction counselling shelter');
    expect(corrections.length).toBe(0);
  });

  it('skips words shorter than 4 chars', () => {
    const { corrected } = correctTypos('I am sad');
    expect(corrected).toBe('i am sad');
  });
});

describe('correctQueryPhonetic', () => {
  it('corrects "fud bank" to "food bank"', () => {
    const { corrected } = correctQueryPhonetic('fud bank');
    expect(corrected).toContain('food');
  });

  it('corrects "sheltr" to "shelter"', () => {
    const { corrected } = correctQueryPhonetic('sheltr tonight');
    expect(corrected).toContain('shelter');
  });

  it('does not alter correct words', () => {
    const { corrected, corrections } = correctQueryPhonetic('food bank');
    expect(corrected).toBe('food bank');
    expect(corrections.length).toBe(0);
  });
});

describe('findClosestKeyword', () => {
  it('does NOT match "dental" to any keyword', () => {
    const match = findClosestKeyword('dental');
    // "dental" is in COMMON_MISSPELLINGS as identity -> returns "dental" not "mental"
    // findClosestKeyword should return null (no fuzzy match) or "dental" itself
    expect(match).not.toBe('mental');
  });
});
```

**Step 2: Run the test to check current behavior**

Run: `npx vitest run server/helpers/__tests__/keywords.test.ts`
Expected: Most should PASS because of the existing identity mappings. If any fail, we fix them in Step 3.

**Step 3: Add any missing identity mappings**

Review `findClosestKeyword` — it only checks `COMMON_MISSPELLINGS` and then does Levenshtein against `KEYWORD_EXPANSIONS` keys. The word "dental" is 1 edit distance from "mental" (a `KEYWORD_EXPANSIONS` key). The identity mapping in `COMMON_MISSPELLINGS` is checked first (line 156), so "dental" returns "dental" before reaching Levenshtein. Verify this by checking if `findClosestKeyword('dental')` returns `'dental'` or `null`.

If `findClosestKeyword` returns `'mental'` for `'dental'`, add this guard in `server/helpers/keywords.ts:findClosestKeyword` (line 152-173):

```typescript
export function findClosestKeyword(input: string, maxDistance: number = 2): string | null {
  const inputLower = input.toLowerCase();

  // First check exact misspellings dictionary (includes identity mappings)
  if (COMMON_MISSPELLINGS[inputLower]) {
    return COMMON_MISSPELLINGS[inputLower];
  }

  // Then try fuzzy matching against known keywords
  const knownKeywords = Object.keys(KEYWORD_EXPANSIONS);
  let bestMatch: string | null = null;
  let bestDistance = maxDistance + 1;

  for (const keyword of knownKeywords) {
    const distance = levenshteinDistance(inputLower, keyword);
    if (distance <= maxDistance && distance < bestDistance) {
      bestDistance = distance;
      bestMatch = keyword;
    }
  }
  return bestMatch;
}
```

Note: `correctTypos` (line 178-202) checks `COMMON_MISSPELLINGS` first (line 186), so "dental" -> "dental" (identity) returns before reaching `findClosestKeyword`. The bug was already fixed. Our tests confirm this.

If additional false corrections are found (e.g., other valid English words within edit distance 2 of domain keywords), add identity mappings to `COMMON_MISSPELLINGS` in the same pattern as line 56.

**Step 4: Run tests to verify all pass**

Run: `npx vitest run server/helpers/__tests__/keywords.test.ts`
Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add server/helpers/__tests__/keywords.test.ts server/helpers/keywords.ts
git commit -m "test: add typo correction regression tests, verify dental/mental fix"
```

---

### Task 3: Add Intent Detection Tests and Fixes

Two known intent misdetections: "LGBTQ counselling Calgary" -> `mental_health` (should be `lgbtq_services`), "my son is addicted to drugs" -> `substance_abuse` (should be `family_addiction_support`).

**Files:**
- Create: `server/search/__tests__/analyzer-intents.test.ts`
- Modify: `server/search/config/analysis.ts` (intent patterns)

**Step 1: Write the failing intent detection tests**

```typescript
// server/search/__tests__/analyzer-intents.test.ts
import { describe, it, expect } from 'vitest';
import { analyzeQuery } from '../analyzer';

describe('Intent Detection — Known Misdetections', () => {
  it('detects lgbtq_services for "LGBTQ counselling Calgary"', () => {
    const analysis = analyzeQuery('LGBTQ counselling Calgary', 'Calgary');
    expect(analysis.intent).toBe('lgbtq_services');
  });

  it('detects lgbtq_services for "trans healthcare support"', () => {
    const analysis = analyzeQuery('trans healthcare support');
    expect(analysis.intent).toBe('lgbtq_services');
  });

  it('detects family_addiction_support for "my son is addicted to drugs what can I do"', () => {
    const analysis = analyzeQuery('my son is addicted to drugs what can I do');
    expect(analysis.intent).toBe('family_addiction_support');
  });

  it('detects family_addiction_support for "my husband is an alcoholic"', () => {
    const analysis = analyzeQuery('my husband is an alcoholic');
    expect(analysis.intent).toBe('family_addiction_support');
  });

  it('detects family_addiction_support for "living with an addict"', () => {
    const analysis = analyzeQuery('living with an addict');
    expect(analysis.intent).toBe('family_addiction_support');
  });
});

describe('Intent Detection — Existing Intents (regression)', () => {
  it('detects crisis for "I want to kill myself"', () => {
    const analysis = analyzeQuery('I want to kill myself');
    expect(analysis.isCrisis).toBe(true);
    expect(analysis.intent).toBe('crisis');
  });

  it('detects domestic_violence for "my husband hits me"', () => {
    const analysis = analyzeQuery('my husband hits me I need to leave');
    expect(analysis.intent).toBe('domestic_violence');
  });

  it('detects substance_abuse for "help with alcohol addiction"', () => {
    const analysis = analyzeQuery('help with alcohol addiction Calgary', 'Calgary');
    expect(analysis.intent).toBe('substance_abuse');
  });

  it('detects mental_health for "free counselling Calgary"', () => {
    const analysis = analyzeQuery('free counselling Calgary', 'Calgary');
    expect(analysis.intent).toBe('mental_health');
  });

  it('detects housing_urgent for "emergency shelter tonight"', () => {
    const analysis = analyzeQuery('emergency shelter tonight Calgary');
    expect(analysis.intent).toBe('housing_urgent');
  });

  it('detects disability_support for "ADHD support for adults"', () => {
    const analysis = analyzeQuery('ADHD support for adults');
    expect(analysis.intent).toBe('disability_support');
  });

  it('detects veteran_services for "PTSD support for veterans"', () => {
    const analysis = analyzeQuery('PTSD support for veterans');
    expect(analysis.intent).toBe('veteran_services');
  });

  it('detects newcomer_services for "newcomer settlement services"', () => {
    const analysis = analyzeQuery('newcomer settlement services');
    expect(analysis.intent).toBe('newcomer_services');
  });

  it('detects food_insecurity for "food bank near me"', () => {
    const analysis = analyzeQuery('food bank near downtown Edmonton', 'Edmonton');
    expect(analysis.intent).toBe('food_insecurity');
  });
});
```

**Step 2: Run the tests to see which fail**

Run: `npx vitest run server/search/__tests__/analyzer-intents.test.ts`
Expected: The "Known Misdetections" tests will likely fail. The regression tests should pass.

**Step 3: Fix intent detection in `server/search/config/analysis.ts`**

This is the large config file (~870 lines) that contains `domainPatterns` — the regex patterns used by the analyzer to detect intent. The fix requires:

1. Find the `lgbtq` domain patterns section and ensure LGBTQ keywords (`lgbtq`, `trans`, `queer`, `gay`, `lesbian`, `bisexual`, `nonbinary`, `gender identity`, `coming out`, `pride`) are checked **before** the broader `mental_health` patterns
2. Find the `family_addiction` patterns and ensure family-member-plus-addiction patterns (`my son|daughter|husband|wife|partner|parent .* addict|drug|alcohol|substance`, `living with an addict`, `family member .* addiction`) are checked **before** generic `substance_abuse`

The analyzer in `server/search/analyzer.ts` iterates through `domainPatterns` in order. The fix is to ensure more specific intents (lgbtq_services, family_addiction_support) appear earlier in the pattern list than generic intents (mental_health, substance_abuse).

Read `server/search/config/analysis.ts`, find the `domainPatterns` object, and verify/fix ordering. Also add any missing patterns.

**Step 4: Run tests to verify all pass**

Run: `npx vitest run server/search/__tests__/analyzer-intents.test.ts`
Expected: PASS (all tests including the previously-failing misdetections)

**Step 5: Run full existing test suite to check for regressions**

Run: `npx vitest run server/search/__tests__/`
Expected: All existing tests still pass

**Step 6: Commit**

```bash
git add server/search/__tests__/analyzer-intents.test.ts server/search/config/analysis.ts
git commit -m "fix: correct intent detection for LGBTQ and family addiction queries"
```

---

### Task 4: Expand Test Query Suite

Add ~25 new test queries to `server/evaluation/comprehensive_test_queries.ts` covering gaps identified in the design: typo queries, natural language, multi-intent, and specific service name searches.

**Files:**
- Modify: `server/evaluation/comprehensive_test_queries.ts`

**Step 1: Add new query sections**

Open `server/evaluation/comprehensive_test_queries.ts` and add the following sections before the closing `];` of the `COMPREHENSIVE_QUERIES` array (before line 660):

```typescript
  // ===========================================
  // TYPO & MISSPELLING QUERIES
  // ===========================================
  {
    query: "dental services",
    intent: "general",
    description: "Must NOT be corrected to 'mental' — valid word",
    mustExclude: ["mental health"],
  },
  {
    query: "counslling near me",
    intent: "mental_health",
    description: "Typo: should correct to counselling",
    expectedPatterns: ["counselling", "therapy", "mental health"],
  },
  {
    query: "adiction help",
    intent: "substance_abuse",
    description: "Typo: should correct to addiction",
    expectedPatterns: ["addiction", "recovery", "treatment"],
  },
  {
    query: "fud bank",
    intent: "food_insecurity",
    description: "Phonetic typo: should correct to food bank",
    expectedPatterns: ["food", "bank", "hamper"],
  },
  {
    query: "sheltr tonight",
    intent: "housing_urgent",
    description: "Phonetic typo: should correct to shelter",
    expectedPatterns: ["shelter", "emergency", "housing"],
  },

  // ===========================================
  // NATURAL LANGUAGE / COLLOQUIAL QUERIES
  // ===========================================
  {
    query: "I just got out of jail and need somewhere to stay",
    intent: "housing_urgent",
    description: "Reentry housing need",
    expectedPatterns: ["shelter", "housing", "transitional"],
  },
  {
    query: "where can I get free food today",
    intent: "food_insecurity",
    description: "Immediate food need",
    expectedPatterns: ["food", "meal", "hamper"],
  },
  {
    query: "my kid is out of control on drugs",
    intent: "family_addiction_support",
    description: "Parent seeking help for child substance abuse",
    expectedPatterns: ["PCHAD", "family", "parent", "addiction"],
  },
  {
    query: "I think I might be autistic",
    intent: "disability_support",
    description: "Self-identification autism query",
    expectedPatterns: ["autism", "assessment", "support"],
  },
  {
    query: "how do I apply for disability benefits",
    intent: "disability_support",
    description: "Benefits navigation query",
    expectedPatterns: ["AISH", "disability", "benefits"],
  },

  // ===========================================
  // MULTI-INTENT / COMPLEX QUERIES
  // ===========================================
  {
    query: "housing for women fleeing abuse",
    intent: "domestic_violence",
    description: "DV + housing + gender intersection",
    expectedPatterns: ["shelter", "women", "domestic violence", "abuse"],
  },
  {
    query: "senior with dementia needs meals delivered",
    intent: "senior_services",
    description: "Senior + food + dementia intersection",
    expectedPatterns: ["senior", "meals", "delivery", "dementia"],
  },
  {
    query: "pregnant teenager needs housing",
    intent: "housing_urgent",
    description: "Youth + pregnancy + housing intersection",
    expectedPatterns: ["housing", "youth", "pregnancy", "support"],
  },

  // ===========================================
  // SPECIFIC SERVICE NAME SEARCHES
  // ===========================================
  {
    query: "SMART Recovery",
    intent: "substance_abuse",
    description: "Specific service name lookup",
    mustInclude: ["SMART Recovery"],
  },
  {
    query: "211",
    intent: "general",
    description: "211 information line lookup",
    expectedPatterns: ["211", "information"],
  },
  {
    query: "Al-Anon",
    intent: "family_addiction_support",
    description: "Specific family support service lookup",
    expectedPatterns: ["Al-Anon"],
  },
  {
    query: "Kids Help Phone",
    intent: "youth_services",
    description: "Specific youth crisis service lookup",
    expectedPatterns: ["Kids Help Phone"],
  },
```

**Step 2: Run type check to verify no syntax errors**

Run: `npx tsc --noEmit server/evaluation/comprehensive_test_queries.ts`
(Or just: `npm run check`)
Expected: No type errors

**Step 3: Commit**

```bash
git add server/evaluation/comprehensive_test_queries.ts
git commit -m "feat(eval): expand test query suite with typo, natural language, and name queries"
```

---

### Task 5: Build Baseline Runner Script

Create a script that runs the deterministic evaluator against all test queries and saves results for before/after comparison.

**Files:**
- Create: `server/evaluation/run_baseline.ts`

**Step 1: Implement the baseline runner**

```typescript
// server/evaluation/run_baseline.ts
#!/usr/bin/env npx tsx
/**
 * Run deterministic baseline evaluation and save results.
 * Usage: npx tsx server/evaluation/run_baseline.ts
 */
import 'dotenv/config';
import { search } from '../search/index.js';
import { analyzeQuery } from '../search/analyzer.js';
import { COMPREHENSIVE_QUERIES, getCategoryDistribution } from './comprehensive_test_queries.js';
import { scoreDeterministic } from './deterministic_evaluator.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const reportDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  console.log(`Running deterministic baseline: ${COMPREHENSIVE_QUERIES.length} queries\n`);
  console.log('Intent distribution:', getCategoryDistribution());

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const testQuery of COMPREHENSIVE_QUERIES) {
    try {
      const startTime = Date.now();
      const searchResponse = await search({
        query: testQuery.query,
        location: testQuery.location,
        page: 1,
        pageSize: 20,
      });
      const searchTimeMs = Date.now() - startTime;

      const analysis = analyzeQuery(testQuery.query, testQuery.location);
      const score = scoreDeterministic(testQuery, searchResponse.services as any, analysis.intent);

      const status = score.scores.overall >= 80 ? 'PASS' : score.scores.overall >= 60 ? 'WARN' : 'FAIL';
      const icon = status === 'PASS' ? '[OK]' : status === 'WARN' ? '[!!]' : '[XX]';
      console.log(`${icon} ${score.scores.overall}/100 | ${searchTimeMs}ms | "${testQuery.query}" (${analysis.intent})`);

      if (score.failures.length > 0) {
        score.failures.forEach(f => console.log(`     -> ${f}`));
      }

      if (score.scores.overall >= 60) passed++;
      else failed++;

      results.push({ ...score, searchTimeMs });
    } catch (error) {
      console.log(`[ERR] "${testQuery.query}": ${error}`);
      failed++;
    }
  }

  // Summary
  const overallAvg = Math.round(results.reduce((s, r) => s + r.scores.overall, 0) / results.length);
  const intentAvg = Math.round(results.reduce((s, r) => s + r.scores.intentAccuracy, 0) / results.length);
  const avgTime = Math.round(results.reduce((s, r) => s + r.searchTimeMs, 0) / results.length);

  console.log('\n' + '='.repeat(60));
  console.log(`BASELINE SUMMARY`);
  console.log('='.repeat(60));
  console.log(`Queries: ${results.length} | Passed (>=60): ${passed} | Failed (<60): ${failed}`);
  console.log(`Overall avg: ${overallAvg}/100 | Intent accuracy: ${intentAvg}% | Avg latency: ${avgTime}ms`);

  // Per-intent breakdown
  const byIntent: Record<string, number[]> = {};
  results.forEach(r => {
    const intent = r.query.intent;
    if (!byIntent[intent]) byIntent[intent] = [];
    byIntent[intent].push(r.scores.overall);
  });
  console.log('\nPer-intent averages:');
  for (const [intent, scores] of Object.entries(byIntent).sort((a, b) => {
    const avgA = a[1].reduce((s, v) => s + v, 0) / a[1].length;
    const avgB = b[1].reduce((s, v) => s + v, 0) / b[1].length;
    return avgA - avgB;
  })) {
    const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    const icon = avg >= 80 ? '[OK]' : avg >= 60 ? '[!!]' : '[XX]';
    console.log(`  ${icon} ${intent}: ${avg}/100 (${scores.length} queries)`);
  }

  // Save report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `baseline-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalQueries: results.length,
    overallAvg,
    intentAvg,
    avgLatencyMs: avgTime,
    passed,
    failed,
    byIntent: Object.fromEntries(
      Object.entries(byIntent).map(([k, v]) => [k, Math.round(v.reduce((s, x) => s + x, 0) / v.length)])
    ),
    results,
  }, null, 2));

  console.log(`\nReport saved: ${reportPath}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
```

**Step 2: Add npm script**

In `package.json`, add to `"scripts"`:
```json
"evaluate:baseline": "tsx server/evaluation/run_baseline.ts"
```

**Step 3: Commit**

```bash
git add server/evaluation/run_baseline.ts package.json
git commit -m "feat(eval): add deterministic baseline runner script"
```

---

### Task 6: Build Diagnostic Script

Create a script that traces a single query through the pipeline and shows exactly where/why ranking goes wrong.

**Files:**
- Create: `server/evaluation/diagnose_query.ts`

**Step 1: Implement the diagnostic script**

```typescript
// server/evaluation/diagnose_query.ts
#!/usr/bin/env npx tsx
/**
 * Diagnose a single search query — shows what the pipeline does at each stage.
 * Usage: npx tsx server/evaluation/diagnose_query.ts "query text here"
 */
import 'dotenv/config';
import { search } from '../search/index.js';
import { analyzeQuery } from '../search/analyzer.js';

async function main() {
  const query = process.argv.slice(2).join(' ');
  if (!query) {
    console.error('Usage: npx tsx server/evaluation/diagnose_query.ts "query text"');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log(`DIAGNOSING: "${query}"`);
  console.log('='.repeat(60));

  // Stage 1: Query Analysis
  console.log('\n--- STAGE 1: Query Analysis ---');
  const analysis = analyzeQuery(query);
  console.log(`  Raw query:      "${analysis.raw}"`);
  console.log(`  Normalized:     "${analysis.normalized}"`);
  console.log(`  Intent:         ${analysis.intent}`);
  console.log(`  Is crisis:      ${analysis.isCrisis}`);
  console.log(`  Keywords:       [${analysis.keywords.join(', ')}]`);
  console.log(`  Location:       ${analysis.location || '(none — Alberta-wide)'}`);
  console.log(`  Negative terms: [${analysis.negativeTerms?.join(', ') || ''}]`);
  if (analysis.substanceType) console.log(`  Substance type: ${analysis.substanceType}`);
  if (analysis.aliasMatch) console.log(`  Alias match:    ${analysis.aliasMatch}`);

  // Stage 2: Full Search (with debug)
  console.log('\n--- STAGE 2: Search Results ---');
  const startTime = Date.now();
  const response = await search({
    query,
    page: 1,
    pageSize: 20,
    debug: true,
  });
  const searchTimeMs = Date.now() - startTime;

  console.log(`  Search time:    ${searchTimeMs}ms`);
  console.log(`  Total results:  ${response.services.length}`);
  console.log(`  Cached:         ${response.cached}`);
  console.log(`  Search type:    ${response.searchType || 'unknown'}`);

  // Stage 3: Result Details
  console.log('\n--- STAGE 3: Top 15 Results ---');
  response.services.slice(0, 15).forEach((s, i) => {
    const score = (s as any).rrfScore?.toFixed(4) || 'pinned';
    console.log(`  ${String(i + 1).padStart(2)}. [${score}] ${s.name}`);
    console.log(`      Category: ${s.category} | Location: ${s.location}`);
    console.log(`      Desc: ${(s.description || '').substring(0, 100)}...`);
    if ((s as any).scoreExplanation) {
      console.log(`      Boosts: ${JSON.stringify((s as any).scoreExplanation)}`);
    }
  });

  // Stage 4: Summary
  console.log('\n--- STAGE 4: Summary ---');
  console.log(`  ${response.summary || '(no summary)'}`);

  console.log('\n' + '='.repeat(60));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
```

**Step 2: Add npm script**

In `package.json`, add to `"scripts"`:
```json
"diagnose": "tsx server/evaluation/diagnose_query.ts"
```

**Step 3: Commit**

```bash
git add server/evaluation/diagnose_query.ts package.json
git commit -m "feat(eval): add single-query diagnostic script"
```

---

### Task 7: Run Baseline and Diagnose Failing Queries

This is a manual/interactive task. Run the baseline, review results, and run diagnostics on every failing query.

**Step 1: Run the baseline**

Run: `npm run evaluate:baseline`

Review the output. Note:
- Which intents are scoring below 80
- Which specific queries are failing and why
- Search latency per query

**Step 2: Diagnose each failing query**

For every query scoring below 60, run:
```bash
npm run diagnose "the failing query text"
```

Record the root cause for each in a diagnosis report.

**Step 3: Categorize failures into buckets**

Create `server/evaluation/reports/diagnosis-YYYY-MM-DD.md` with a table:

| Query | Score | Root Cause Bucket | Details |
|-------|-------|-------------------|---------|
| ... | ... | analyzer_bug / scoring_imbalance / missing_pattern / data_gap / dedup | ... |

**Step 4: Commit the diagnosis report**

```bash
git add server/evaluation/reports/diagnosis-*.md
git commit -m "docs: add search diagnosis report for baseline failures"
```

---

### Task 8: Fix Scoring — Crisis Bleed and Boost Stacking

Based on the Feb 26 eval, "anxiety therapy no waitlist" scored 69 because crisis services appeared in non-crisis results.

**Files:**
- Modify: `server/search/strategies/scoring/intent-boost.ts`
- Modify: `server/search/config/scoring.ts`
- Test: `server/search/__tests__/analyzer-intents.test.ts` (add scoring assertions)

**Step 1: Write the test**

Add to `server/search/__tests__/analyzer-intents.test.ts`:

```typescript
describe('Scoring — Crisis Bleed Prevention', () => {
  it('does not rank crisis services in top 5 for "anxiety therapy no waitlist"', async () => {
    const res = await search(makeInput('anxiety therapy no waitlist'));
    const top5 = res.services.slice(0, 5);
    const crisisServices = top5.filter(s =>
      s.category?.toLowerCase().includes('crisis') &&
      !s.category?.toLowerCase().includes('mental')
    );
    // Crisis-only services should not dominate a non-crisis mental health query
    expect(crisisServices.length).toBeLessThanOrEqual(1);
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `set -a && source .env && set +a && npx vitest run server/search/__tests__/analyzer-intents.test.ts`
Expected: FAIL if crisis services are still bleeding into anxiety results

**Step 3: Fix the crisis bleed**

In `server/search/strategies/scoring/intent-boost.ts`, find the mental_health intent boost section. Add a penalty for crisis-category-only services when the query intent is non-crisis mental health:

Add to `server/search/config/scoring.ts`:
```typescript
// Mental health (non-crisis) penalties
mentalHealth: {
  crisisOnlyPenalty: -150,  // Penalize crisis-only services in non-crisis MH queries
},
```

The exact code change depends on how intent-boost.ts structures its mental_health case. Read the file, find the mental_health handler, and add a check:
```typescript
// Inside mental_health intent boost:
if (service.category?.toLowerCase() === 'crisis_services' &&
    !service.description?.toLowerCase().includes('anxiety') &&
    !service.description?.toLowerCase().includes('therapy')) {
  score += SCORING_CONFIG.mentalHealth.crisisOnlyPenalty;
}
```

**Step 4: Run the test to verify it passes**

Run: `set -a && source .env && set +a && npx vitest run server/search/__tests__/analyzer-intents.test.ts`
Expected: PASS

**Step 5: Run full test suite for regressions**

Run: `npm test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add server/search/strategies/scoring/intent-boost.ts server/search/config/scoring.ts server/search/__tests__/analyzer-intents.test.ts
git commit -m "fix(search): penalize crisis services in non-crisis mental health queries"
```

---

### Task 9: Add Golden Result E2E Tests

Add "must appear in top N" tests for critical service+query pairs.

**Files:**
- Modify: `server/search/__tests__/search-e2e.test.ts`

**Step 1: Add golden result tests**

Append to `server/search/__tests__/search-e2e.test.ts`:

```typescript
// ============================================================
// Golden Result Tests — specific services MUST appear for key queries
// ============================================================
describe('Golden Results', { timeout: 30_000 }, () => {
  it('returns 988 in top 3 for suicide queries', async () => {
    const res = await search(makeInput('I want to kill myself', { emergency: true }));
    const top3Names = res.services.slice(0, 3).map(s => s.name);
    const has988 = top3Names.some(n => n.includes('988'));
    expect(has988).toBe(true);
  });

  it('returns SMART Recovery in top 10 for "SMART Recovery"', async () => {
    const res = await search(makeInput('SMART Recovery'));
    const top10Names = res.services.slice(0, 10).map(s => s.name.toLowerCase());
    const hasSmart = top10Names.some(n => n.includes('smart recovery'));
    expect(hasSmart).toBe(true);
  });

  it('does not return mental health for "dental services"', async () => {
    const analysis = analyzeQuery('dental services');
    // Intent should NOT be mental_health
    expect(analysis.intent).not.toBe('mental_health');
    // Normalized query should still contain "dental"
    expect(analysis.normalized).toContain('dental');
  });

  it('returns family support services for "my son is addicted"', async () => {
    const res = await search(makeInput('my son is addicted to drugs what can I do'));
    const top10 = res.services.slice(0, 10);
    const hasFamily = top10.some(s =>
      s.name.toLowerCase().includes('al-anon') ||
      s.name.toLowerCase().includes('pchad') ||
      s.name.toLowerCase().includes('family') ||
      s.description.toLowerCase().includes('family')
    );
    expect(hasFamily).toBe(true);
  });
});
```

**Step 2: Run the tests**

Run: `set -a && source .env && set +a && npx vitest run server/search/__tests__/search-e2e.test.ts`
Expected: PASS (after Tasks 2-3 intent fixes are in place)

**Step 3: Commit**

```bash
git add server/search/__tests__/search-e2e.test.ts
git commit -m "test: add golden result E2E tests for critical query+service pairs"
```

---

### Task 10: Mine Search Analytics for Real User Queries

Query the production database for real user search patterns to discover queries we're not testing.

**Step 1: Query search analytics**

Use the PostgreSQL MCP server to run:
```sql
SELECT query, COUNT(*) as count
FROM search_analytics
GROUP BY query
ORDER BY count DESC
LIMIT 30;
```

And zero-result queries:
```sql
SELECT query, COUNT(*) as count
FROM search_analytics
WHERE results_count = 0
GROUP BY query
ORDER BY count DESC
LIMIT 20;
```

**Step 2: Review results and add representative queries**

For each common real-user query not already in the test suite, add it to `comprehensive_test_queries.ts` with the appropriate intent and expected patterns.

**Step 3: Commit**

```bash
git add server/evaluation/comprehensive_test_queries.ts
git commit -m "feat(eval): add real user queries from search analytics to test suite"
```

---

### Task 11: Tune Scoring Config Based on Diagnosis

After running the baseline and diagnosis (Task 7), tune boost/penalty values in `server/search/config/scoring.ts` for underperforming intents.

**Files:**
- Modify: `server/search/config/scoring.ts`

**Step 1: Review diagnosis report**

Read `server/evaluation/reports/diagnosis-*.md` from Task 7. Identify which intents have scoring_imbalance as the root cause.

**Step 2: Adjust scoring values**

Common tuning targets (exact values depend on diagnosis findings):
- Veteran: If veteran services are being outranked, increase `veteran.veteranServices` (currently 500) or `veteran.ptsdServices` (currently 200)
- Autism: If autism results are being diluted by generic disability, increase `disability.autismMatch` (currently 150)
- Grief: If grief results include too many crisis services, increase `grief.crisisShelterPenalty` (currently -100)

**Step 3: Run baseline to verify improvement**

Run: `npm run evaluate:baseline`
Compare per-intent scores with the baseline from Task 7.

**Step 4: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add server/search/config/scoring.ts
git commit -m "fix(search): tune scoring config for underperforming intents"
```

---

### Task 12: Bump Cache Version and Run Final Verification

After all fixes are in place, invalidate the search cache and run the final evaluation.

**Files:**
- Modify: `server/search/index.ts` (line 10 — CACHE_VERSION)

**Step 1: Bump CACHE_VERSION**

In `server/search/index.ts` line 10, change:
```typescript
const CACHE_VERSION = 'v85';
```
to:
```typescript
const CACHE_VERSION = 'v86'; // Bumped: search optimization — intent fixes, scoring tuning, crisis bleed fix
```

**Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 3: Run deterministic baseline for final scores**

Run: `npm run evaluate:baseline`

Compare with the baseline from Task 7. Verify:
- Overall average improved
- No intent regressed
- Previously-failing queries (dental, LGBTQ intent, family addiction) now pass

**Step 4: Run E2E tests**

Run: `set -a && source .env && set +a && npx vitest run server/search/__tests__/`
Expected: All tests pass including new golden result tests

**Step 5: Commit**

```bash
git add server/search/index.ts
git commit -m "chore: bump CACHE_VERSION to v86 for search optimization changes"
```

---

### Task 13: Generate Final Comparison Report

**Step 1: Create comparison summary**

Compare the two baseline reports (Task 7 vs Task 12) and create a summary:

```markdown
# Search Optimization Results

## Before/After

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| Overall avg | X/100 | Y/100 | +Z |
| Queries passing (>=60) | A/N | B/N | +C |
| Intent accuracy | X% | Y% | +Z% |
| Avg latency | Xms | Yms | -Zms |

## Per-Intent Deltas
(table of each intent's before/after scores)

## Fixes Applied
(list of all changes)

## New Test Coverage
(count of new test queries and unit tests)
```

Save to `server/evaluation/reports/optimization-summary-YYYY-MM-DD.md`.

**Step 2: Commit**

```bash
git add server/evaluation/reports/optimization-summary-*.md
git commit -m "docs: add search optimization before/after comparison report"
```
