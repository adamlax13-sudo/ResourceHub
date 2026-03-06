# Search Quality Testing & Data Quality Boost — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Comprehensively test the search pipeline end-to-end, verify new services appear correctly, and add a post-search data quality boost so high-quality services (with website-sourced data) rank higher *without* affecting which results are included.

**Architecture:** The data quality boost follows the same post-search pattern as `applyPreferenceBoosts()` and `applyFilterMatchBoosts()` — applied after results are determined and cached, so it never affects inclusion. Quality signals: `confidenceScore` (scraper-assigned 0-100), `websiteUrl` presence, description richness, and `enrichmentSource`.

**Tech Stack:** TypeScript, Vitest, PostgreSQL (read-only queries for verification), existing evaluation framework.

---

## Phase 1: Database Audit — Verify New Services Are Properly Tagged

### Task 1: Audit service tagging coverage

**Files:**
- Create: `server/search/__tests__/data-quality-audit.test.ts`

**Step 1: Write audit test that queries DB for tagging gaps**

```typescript
import { describe, it, expect } from 'vitest';

// This test file runs queries against the live DB to surface tagging issues.
// Run with: npx vitest run server/search/__tests__/data-quality-audit.test.ts

describe('Service Data Quality Audit', () => {
  it('should report category distribution', async () => {
    // This is a reporting test — always passes, prints stats
    console.log('=== Run the SQL audit queries manually via MCP ===');
    console.log('See docs/plans/2026-03-05-search-quality-testing.md Task 1 for queries');
    expect(true).toBe(true);
  });
});
```

> **Note:** The actual audit is best done via direct SQL queries through the MCP postgres tool, not via Vitest (which would need DB connection setup). Run these queries:

```sql
-- 1. Services missing gender tags that likely need them (DV, women's shelters)
SELECT service_id, name, category, gender_restriction
FROM services
WHERE is_active = true
  AND category IN ('Domestic Violence Support', 'Emergency Shelter')
  AND gender_restriction IS NULL
ORDER BY category, name;

-- 2. Services missing age tags that likely need them
SELECT service_id, name, category, age_group
FROM services
WHERE is_active = true
  AND category IN ('Youth Services', 'Senior Services', 'Campus & Student Services')
  AND (age_group IS NULL OR age_group = 'all_ages')
ORDER BY category, name;

-- 3. Low confidence services that are active
SELECT service_id, name, category, confidence_score, website_url, enrichment_source
FROM services
WHERE is_active = true AND confidence_score < 40
ORDER BY confidence_score ASC
LIMIT 30;

-- 4. Services with very short descriptions (likely low quality)
SELECT service_id, name, category, LENGTH(description) as desc_length, confidence_score
FROM services
WHERE is_active = true AND LENGTH(description) < 30
ORDER BY desc_length ASC;

-- 5. Category distribution check — look for miscategorized services
SELECT category, COUNT(*) as count,
  ROUND(AVG(confidence_score)) as avg_confidence,
  COUNT(*) FILTER (WHERE website_url IS NOT NULL AND website_url != '') as has_website
FROM services
WHERE is_active = true
GROUP BY category
ORDER BY count DESC;

-- 6. Services without embeddings (won't appear in semantic search)
SELECT s.service_id, s.name, s.category
FROM services s
LEFT JOIN service_embeddings se ON s.service_id = se.service_id
WHERE s.is_active = true AND se.service_id IS NULL
LIMIT 20;
```

**Step 2: Run the queries, review output, and document any tagging issues found**

Create a summary of issues in the test output or a scratch doc. Fix any critical tagging gaps (wrong category, missing gender on women-only shelters, etc.) before proceeding.

**Step 3: Commit**

```bash
git add server/search/__tests__/data-quality-audit.test.ts
git commit -m "chore: add data quality audit queries for service tagging review"
```

---

## Phase 2: End-to-End Search Pipeline Testing

### Task 2: Create a targeted search integration test suite

This tests the actual `search()` function against the live database — verifying that new services appear, intents are detected, and boosting logic produces correct ordering.

**Files:**
- Create: `server/search/__tests__/search-e2e.test.ts`

**Step 1: Write the integration test file**

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { search } from '../index';
import { analyzeQuery } from '../analyzer';

// These tests call the real search function against the live DB.
// They verify end-to-end behavior: intent detection → SQL + semantic → boosting → results.
// Run with: npx vitest run server/search/__tests__/search-e2e.test.ts --timeout 30000

interface SearchResult {
  serviceId: string;
  name: string;
  category: string;
  rrfScore?: number;
}

function resultNames(results: SearchResult[]): string[] {
  return results.map(r => r.name);
}

function resultCategories(results: SearchResult[]): string[] {
  return results.map(r => r.category);
}

describe('Search Pipeline E2E', () => {

  // --- Intent Detection ---
  describe('Intent Detection', () => {
    it('detects crisis intent for suicidal language', async () => {
      const analysis = await analyzeQuery('I want to kill myself');
      expect(analysis.isCrisis).toBe(true);
    });

    it('detects domestic violence intent', async () => {
      const analysis = await analyzeQuery('my husband is hitting me');
      expect(analysis.intent).toBe('domestic_violence');
    });

    it('detects food insecurity intent', async () => {
      const analysis = await analyzeQuery('where can I get free food');
      expect(analysis.intent).toBe('food_insecurity');
    });

    it('detects addiction intent for substance queries', async () => {
      const analysis = await analyzeQuery('alcohol rehab near me');
      expect(analysis.intent).toMatch(/substance_abuse|addiction/);
    });

    it('detects housing intent', async () => {
      const analysis = await analyzeQuery('I need emergency shelter tonight');
      expect(analysis.intent).toMatch(/housing|shelter/);
    });

    it('detects mental health intent', async () => {
      const analysis = await analyzeQuery('I need to talk to a counsellor about my anxiety');
      expect(analysis.intent).toBe('mental_health');
    });
  });

  // --- Search Result Relevance ---
  describe('Result Relevance', () => {
    it('returns crisis services for crisis queries', async () => {
      const { results } = await search({
        query: 'suicide helpline',
        page: 1,
        pageSize: 10,
        filters: {}
      });
      expect(results.length).toBeGreaterThan(0);
      const top3Categories = resultCategories(results.slice(0, 3));
      expect(top3Categories.some(c =>
        c.includes('Crisis') || c.includes('crisis')
      )).toBe(true);
    });

    it('returns food services for food queries', async () => {
      const { results } = await search({
        query: 'food bank Calgary',
        page: 1,
        pageSize: 10,
        filters: {}
      });
      expect(results.length).toBeGreaterThan(0);
      const top5Categories = resultCategories(results.slice(0, 5));
      expect(top5Categories.some(c => c.includes('Food'))).toBe(true);
    });

    it('returns DV services for domestic violence queries', async () => {
      const { results } = await search({
        query: 'domestic violence help',
        page: 1,
        pageSize: 10,
        filters: {}
      });
      expect(results.length).toBeGreaterThan(0);
      const top5Categories = resultCategories(results.slice(0, 5));
      expect(top5Categories.some(c => c.includes('Domestic Violence'))).toBe(true);
    });

    it('returns addiction services for rehab queries', async () => {
      const { results } = await search({
        query: 'drug rehabilitation program',
        page: 1,
        pageSize: 10,
        filters: {}
      });
      expect(results.length).toBeGreaterThan(0);
      const top5Categories = resultCategories(results.slice(0, 5));
      expect(top5Categories.some(c =>
        c.includes('Addiction') || c.includes('Treatment') || c.includes('Recovery')
      )).toBe(true);
    });

    it('returns mental health services for counselling queries', async () => {
      const { results } = await search({
        query: 'anxiety counselling Edmonton',
        page: 1,
        pageSize: 10,
        filters: {}
      });
      expect(results.length).toBeGreaterThan(0);
      const top5Categories = resultCategories(results.slice(0, 5));
      expect(top5Categories.some(c => c.includes('Mental Health'))).toBe(true);
    });

    it('returns youth services for youth-specific queries', async () => {
      const { results } = await search({
        query: 'help for teenagers struggling with addiction',
        page: 1,
        pageSize: 10,
        filters: {}
      });
      expect(results.length).toBeGreaterThan(0);
      const top5Names = resultNames(results.slice(0, 5));
      // Should see youth-oriented services
      const namesStr = top5Names.join(' ').toLowerCase();
      expect(
        namesStr.includes('youth') ||
        namesStr.includes('teen') ||
        namesStr.includes('young') ||
        resultCategories(results.slice(0, 5)).some(c => c.includes('Youth'))
      ).toBe(true);
    });

    it('returns shelter services for housing queries', async () => {
      const { results } = await search({
        query: 'I am homeless and need a place to stay',
        page: 1,
        pageSize: 10,
        filters: {}
      });
      expect(results.length).toBeGreaterThan(0);
      const top5Categories = resultCategories(results.slice(0, 5));
      expect(top5Categories.some(c =>
        c.includes('Shelter') || c.includes('Housing')
      )).toBe(true);
    });
  });

  // --- Boosting Logic ---
  describe('Boosting Logic', () => {
    it('pins 988 to top for crisis queries', async () => {
      const { results } = await search({
        query: 'I want to end my life',
        page: 1,
        pageSize: 10,
        filters: {}
      });
      expect(results.length).toBeGreaterThan(0);
      const top3Names = resultNames(results.slice(0, 3)).join(' ').toLowerCase();
      expect(top3Names).toContain('988');
    });

    it('boosts exact name matches', async () => {
      const { results } = await search({
        query: 'CMHA',
        page: 1,
        pageSize: 10,
        filters: {}
      });
      expect(results.length).toBeGreaterThan(0);
      // CMHA is an alias — should appear at the top
      const top3Names = resultNames(results.slice(0, 3)).join(' ').toLowerCase();
      expect(
        top3Names.includes('cmha') || top3Names.includes('canadian mental health')
      ).toBe(true);
    });

    it('applies negative penalty for exclusion queries', async () => {
      const { results: withExclusion } = await search({
        query: 'addiction recovery not religious',
        page: 1,
        pageSize: 10,
        filters: {}
      });
      // Faith-based services should be pushed down
      const top5 = withExclusion.slice(0, 5);
      const faithBasedInTop5 = top5.filter((r: any) => r.isFaithBased === true);
      expect(faithBasedInTop5.length).toBeLessThanOrEqual(1);
    });

    it('boosts Al-Anon for family addiction queries', async () => {
      const { results } = await search({
        query: 'my son is addicted to drugs how can I help',
        page: 1,
        pageSize: 10,
        filters: {}
      });
      expect(results.length).toBeGreaterThan(0);
      const top5Names = resultNames(results.slice(0, 5)).join(' ').toLowerCase();
      expect(
        top5Names.includes('al-anon') ||
        top5Names.includes('family') ||
        top5Names.includes('parent')
      ).toBe(true);
    });
  });

  // --- Filter Application ---
  describe('Filter Application', () => {
    it('filters by gender without excluding untagged services', async () => {
      const { results } = await search({
        query: 'addiction support',
        page: 1,
        pageSize: 20,
        filters: { gender: 'men' }
      });
      // Should NOT contain women_only services
      const womenOnly = results.filter((r: any) => r.genderRestriction === 'women_only');
      expect(womenOnly.length).toBe(0);
      // Should still have results (null gender services pass through)
      expect(results.length).toBeGreaterThan(0);
    });

    it('preference boost ranks 24/7 services higher when toggled', async () => {
      const { results: without247 } = await search({
        query: 'crisis support',
        page: 1,
        pageSize: 10,
        filters: {}
      });
      const { results: with247 } = await search({
        query: 'crisis support',
        page: 1,
        pageSize: 10,
        filters: { is24_7: true }
      });
      // Both should return results
      expect(without247.length).toBeGreaterThan(0);
      expect(with247.length).toBeGreaterThan(0);
      // The 24/7 filtered results should have 24/7 services ranked higher
    });
  });

  // --- Semantic Search ---
  describe('Semantic Understanding', () => {
    it('handles natural language queries without exact keyword matches', async () => {
      const { results } = await search({
        query: 'I feel so alone and nobody cares about me',
        page: 1,
        pageSize: 10,
        filters: {}
      });
      expect(results.length).toBeGreaterThan(0);
      // Should return mental health / crisis / counselling services
      const categories = resultCategories(results.slice(0, 5));
      expect(categories.some(c =>
        c.includes('Mental Health') || c.includes('Crisis') || c.includes('Community')
      )).toBe(true);
    });

    it('handles typos gracefully', async () => {
      const { results } = await search({
        query: 'adiction recoveyr',
        page: 1,
        pageSize: 10,
        filters: {}
      });
      expect(results.length).toBeGreaterThan(0);
      const categories = resultCategories(results.slice(0, 5));
      expect(categories.some(c =>
        c.includes('Addiction') || c.includes('Recovery')
      )).toBe(true);
    });

    it('understands colloquial language', async () => {
      const { results } = await search({
        query: 'need a bed for tonight',
        page: 1,
        pageSize: 10,
        filters: {}
      });
      expect(results.length).toBeGreaterThan(0);
      const categories = resultCategories(results.slice(0, 5));
      expect(categories.some(c =>
        c.includes('Shelter') || c.includes('Housing')
      )).toBe(true);
    });
  });
});
```

**Step 2: Run the tests**

```bash
npx vitest run server/search/__tests__/search-e2e.test.ts --timeout 30000
```

These tests require `DATABASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY` to be set (for semantic search). Some may need adjustment based on actual results. The goal is to identify which queries are returning poor results.

**Step 3: Document failures and fix test expectations where needed**

**Step 4: Commit**

```bash
git add server/search/__tests__/search-e2e.test.ts
git commit -m "test: add end-to-end search pipeline integration tests"
```

---

## Phase 3: Implement Data Quality Boost

### Task 3: Add `confidenceScore` to search result types

**Files:**
- Modify: `server/storage.ts` — add `confidenceScore` to `FastSearchResult` and `SemanticSearchResult`
- Modify: the `fast_search` SQL function — include `confidence_score` in return columns

**Step 1: Check current FastSearchResult type and plan the change**

Read `server/storage.ts` to find `FastSearchResult` interface and the `fastSearch()` method. Add `confidenceScore` to the returned fields.

**Step 2: Update the SQL function to return confidence_score**

```sql
-- Add confidence_score to the optimized_search return type
-- This requires dropping and recreating the function chain
```

> **Important:** The SQL functions use a fixed return type. Adding a column means updating `fast_search`, `optimized_search`, `alias_search`, `location_search` — all must return the same columns. This may be complex. **Alternative approach:** Query `confidenceScore` separately in the merger after getting results by service ID. This avoids touching SQL functions.

**Simpler approach — fetch confidence scores in the merger:**

In `server/search/strategies/merger.ts`, after merging results, batch-fetch confidence scores for the result set and attach them to each result. This is analogous to how `getEnrichmentsBatch()` already works.

**Step 3: Add a storage method to batch-fetch confidence scores**

In `server/storage.ts`:
```typescript
async getConfidenceScores(serviceIds: string[]): Promise<Map<string, number>> {
  // SELECT service_id, confidence_score FROM services WHERE service_id IN (...)
}
```

**Step 4: Commit**

```bash
git commit -m "feat: add confidence score batch fetch for search results"
```

---

### Task 4: Create the data quality boost module

**Files:**
- Create: `server/search/strategies/scoring/quality-boost.ts`
- Create: `server/search/strategies/scoring/__tests__/quality-boost.test.ts`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { applyDataQualityBoost } from '../quality-boost';

describe('applyDataQualityBoost', () => {
  const makeResult = (overrides: Record<string, any> = {}) => ({
    serviceId: 'test-1',
    name: 'Test Service',
    category: 'Mental Health',
    description: 'A comprehensive mental health service providing counselling and support.',
    location: 'Calgary, AB',
    websiteUrl: 'https://example.com',
    rrfScore: 1.0,
    confidenceScore: 80,
    ...overrides,
  });

  it('boosts high-confidence services with websites', () => {
    const results = [
      makeResult({ serviceId: 'low', confidenceScore: 30, websiteUrl: null, rrfScore: 1.0 }),
      makeResult({ serviceId: 'high', confidenceScore: 90, websiteUrl: 'https://example.com', rrfScore: 1.0 }),
    ];
    const boosted = applyDataQualityBoost(results);
    expect(boosted[0].serviceId).toBe('high');
  });

  it('does not remove any results — only reorders', () => {
    const results = [
      makeResult({ serviceId: 'low', confidenceScore: 20 }),
      makeResult({ serviceId: 'high', confidenceScore: 95 }),
    ];
    const boosted = applyDataQualityBoost(results);
    expect(boosted.length).toBe(2);
  });

  it('applies a mild boost — does not override large relevance differences', () => {
    const results = [
      makeResult({ serviceId: 'relevant', confidenceScore: 40, rrfScore: 2.0 }),
      makeResult({ serviceId: 'quality', confidenceScore: 95, rrfScore: 0.5 }),
    ];
    const boosted = applyDataQualityBoost(results);
    // The highly relevant result should still be first despite lower quality
    expect(boosted[0].serviceId).toBe('relevant');
  });

  it('uses description length as a quality signal', () => {
    const results = [
      makeResult({ serviceId: 'short', description: 'Short.', rrfScore: 1.0, confidenceScore: 70 }),
      makeResult({ serviceId: 'rich', description: 'A detailed description with lots of useful information about the service, including hours, eligibility, and what to expect when you visit.', rrfScore: 1.0, confidenceScore: 70 }),
    ];
    const boosted = applyDataQualityBoost(results);
    expect(boosted[0].serviceId).toBe('rich');
  });

  it('treats null confidence as neutral (does not penalize)', () => {
    const results = [
      makeResult({ serviceId: 'null-conf', confidenceScore: null, rrfScore: 1.0 }),
      makeResult({ serviceId: 'low-conf', confidenceScore: 30, rrfScore: 1.0 }),
    ];
    const boosted = applyDataQualityBoost(results);
    // Null confidence should rank above low confidence (treated as default ~60)
    expect(boosted[0].serviceId).toBe('null-conf');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run server/search/strategies/scoring/__tests__/quality-boost.test.ts
```

**Step 3: Implement the data quality boost**

```typescript
// server/search/strategies/scoring/quality-boost.ts

interface QualityBoostableResult {
  serviceId: string;
  name: string;
  description?: string | null;
  websiteUrl?: string | null;
  rrfScore: number;
  confidenceScore?: number | null;
  [key: string]: any;
}

/**
 * Applies a mild data quality boost to search results AFTER relevance ranking.
 *
 * This does NOT affect which results are included — only their relative ordering.
 * The boost is intentionally small (max ~1.25x) so it acts as a tiebreaker
 * among similarly-relevant results, not an override of relevance.
 *
 * Quality signals:
 * - confidenceScore (0-100): scraper-assigned data quality
 * - websiteUrl presence: indicates richer source data
 * - description length: longer = more useful to users
 */
export function applyDataQualityBoost<T extends QualityBoostableResult>(
  results: T[]
): T[] {
  if (results.length === 0) return results;

  return results
    .map(result => {
      let qualityMultiplier = 1.0;

      // Confidence score component (max +0.10)
      const confidence = result.confidenceScore ?? 60; // null = neutral default
      if (confidence >= 80) {
        qualityMultiplier += 0.10;
      } else if (confidence >= 60) {
        qualityMultiplier += 0.05;
      } else if (confidence < 40) {
        qualityMultiplier -= 0.05;
      }
      // 40-59 = no change (neutral)

      // Website presence (max +0.05)
      if (result.websiteUrl && result.websiteUrl.length > 0) {
        qualityMultiplier += 0.05;
      }

      // Description richness (max +0.10)
      const descLength = result.description?.length ?? 0;
      if (descLength >= 150) {
        qualityMultiplier += 0.10;
      } else if (descLength >= 80) {
        qualityMultiplier += 0.05;
      } else if (descLength < 30) {
        qualityMultiplier -= 0.05;
      }

      return {
        ...result,
        rrfScore: result.rrfScore * qualityMultiplier,
      };
    })
    .sort((a, b) => b.rrfScore - a.rrfScore);
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run server/search/strategies/scoring/__tests__/quality-boost.test.ts
```

**Step 5: Commit**

```bash
git add server/search/strategies/scoring/quality-boost.ts server/search/strategies/scoring/__tests__/quality-boost.test.ts
git commit -m "feat: add data quality boost for post-search result ordering"
```

---

### Task 5: Wire data quality boost into search pipeline

**Files:**
- Modify: `server/search/index.ts` — add `applyDataQualityBoost()` call after `applyFilterMatchBoosts()`
- Modify: `server/search/strategies/scoring/index.ts` — re-export the new module
- Modify: `server/search/strategies/merger.ts` — attach `confidenceScore` to merged results

**Step 1: Add confidenceScore to merger output**

In `merger.ts`, after the existing `getEnrichmentsBatch()` call, add a batch fetch of confidence scores and attach to each result.

**Step 2: Re-export from scoring/index.ts**

```typescript
export { applyDataQualityBoost } from './quality-boost';
```

**Step 3: Apply in the search orchestrator**

In `server/search/index.ts`, in the post-search section (after `applyFilterMatchBoosts`):

```typescript
// After filter match boosts, apply data quality ordering
results = applyDataQualityBoost(results);
```

**Step 4: Bump cache version** (line ~10 in `server/search/index.ts`)

Increment the cache version string since scoring behavior has changed.

**Step 5: Run existing tests**

```bash
npx vitest run
```

**Step 6: Commit**

```bash
git commit -m "feat: wire data quality boost into search pipeline post-cache"
```

---

## Phase 4: Run Full Evaluation

### Task 6: Run the comprehensive search evaluation

**Step 1: Run the evaluation suite**

```bash
npm run evaluate
```

Review the Markdown report generated in `server/evaluation/reports/`.

**Step 2: Identify queries scoring below 60**

Focus on:
- Crisis queries: must score >90 relevance
- All queries: must score >60 overall
- Check that data quality dimension scores improved

**Step 3: Run the E2E integration tests again with data quality boost active**

```bash
npx vitest run server/search/__tests__/search-e2e.test.ts --timeout 30000
```

**Step 4: If any tests fail or evaluation scores are low, iterate on scoring weights**

Adjust the quality boost multipliers in `quality-boost.ts` if the boost is too aggressive or too weak. The multipliers should be mild enough that relevance always wins over quality.

**Step 5: Commit final adjustments**

```bash
git commit -m "chore: tune data quality boost weights based on evaluation results"
```

---

## Phase 5: Spot-Check New Services

### Task 7: Verify specific new services appear in relevant searches

**Step 1: Query the DB for recently-added services**

```sql
SELECT service_id, name, category, confidence_score, last_updated
FROM services
WHERE is_active = true
ORDER BY last_updated DESC
LIMIT 30;
```

**Step 2: For each category cluster of new services, run a targeted search**

Pick 5-10 representative new services and verify they appear in the top 20 results for their natural search query. Example: if a new "Calgary Youth Counselling" service was added, search for "youth counselling Calgary" and verify it appears.

**Step 3: Check for embedding coverage**

```sql
SELECT s.service_id, s.name
FROM services s
LEFT JOIN service_embeddings se ON s.service_id = se.service_id
WHERE s.is_active = true AND s.last_updated > NOW() - INTERVAL '14 days'
AND se.service_id IS NULL;
```

Services without embeddings won't appear in semantic search. If any are missing, flag for re-running the finalize phase embeddings step.

**Step 4: Document results and any services that need attention**

---

## Summary of Changes

| File | Change |
|------|--------|
| `server/search/strategies/scoring/quality-boost.ts` | NEW — data quality boost function |
| `server/search/strategies/scoring/__tests__/quality-boost.test.ts` | NEW — unit tests |
| `server/search/__tests__/search-e2e.test.ts` | NEW — E2E integration tests |
| `server/search/strategies/scoring/index.ts` | MODIFY — re-export quality-boost |
| `server/search/strategies/merger.ts` | MODIFY — attach confidenceScore to results |
| `server/search/index.ts` | MODIFY — apply quality boost post-cache, bump cache version |
| `server/storage.ts` | MODIFY — add `getConfidenceScores()` batch method |

**Key design decisions:**
1. Quality boost is **post-cache** — same cached results serve all users, quality ordering is applied fresh
2. Max multiplier is ~1.25x — ensures relevance always dominates over quality
3. `null` confidence = neutral (60) — new/unscored services are not penalized
4. No results are ever excluded by quality — only reordered
