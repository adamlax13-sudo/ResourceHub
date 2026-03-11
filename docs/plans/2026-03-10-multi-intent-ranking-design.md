# Multi-Intent Ranking Fix

**Date:** 2026-03-10
**Problem:** When queries have both a primary and secondary intent (e.g., "indigenous addictions recovery services" → substance_abuse + indigenous_services), services matching BOTH intents aren't prioritized. Indigenous-specific addiction services appear at positions 6-27 instead of top 5.

**Root causes:**
1. LLM reranker system prompt mentions secondary intent but gives no scoring guidance for dual-match
2. Intent boosting treats each intent independently — no bonus for matching both
3. Category rescue in trimToRelevant only checks primary intent categories
4. Secondary intent confidence not included in LLM prompt

## Changes

### 1. LLM Reranker System Prompt (`server/search/strategies/scoring/llm-rerank.ts`)

Add rule 5: "SECONDARY INTENT AMPLIFIES RELEVANCE. When a secondary intent is detected, services matching BOTH primary and secondary intents should score 90-100. Services matching only the primary should cap around 70 unless exceptionally relevant."

Include confidence scores in intent context: `Intent: substance_abuse (0.9), Secondary: indigenous_services (0.7)`.

### 2. Dual-Match Bonus (`server/search/strategies/scoring/intent-boost.ts`)

After the per-intent loop (line 245), count how many distinct intents each service matched via categoryPatterns. If 2+, apply `cfg.intent.dualIntentMatch` bonus (~+15). Generic — works for any intent combination.

### 3. Config Addition (`server/search/config.ts`)

Add `dualIntentMatch: 15` to `SCORING_CONFIG.intent`.

### 4. Category Rescue Includes Secondary Intent (`server/search/index.ts`)

- Add `indigenous_services: new Set(['Indigenous Services'])` to `INTENT_CATEGORY_NAMES`
- Change `trimToRelevant` to accept optional `secondaryIntent` parameter
- Merge primary + secondary category sets for rescue
- Pass secondary intent through all `formatResponse` call sites
- Bump `CACHE_VERSION` to v113

### 5. Secondary Intent Confidence in LLM Prompt (`server/search/strategies/scoring/llm-rerank.ts`)

Change intent context from `Intent: substance_abuse, Secondary: indigenous_services` to `Intent: substance_abuse (0.9), Secondary: indigenous_services (0.7)`.

## Files Modified

| File | Change |
|------|--------|
| `server/search/strategies/scoring/llm-rerank.ts` | System prompt rule 5 + confidence in prompt |
| `server/search/strategies/scoring/intent-boost.ts` | Generic dual-match bonus |
| `server/search/config.ts` | `dualIntentMatch` config value |
| `server/search/index.ts` | Category rescue + trimToRelevant secondary intent + cache bump |

## Expected Outcome

For "indigenous addictions recovery services":
- Top 5: NNADAP, Poundmaker's Lodge, Sunrise Healing Lodge, Bonnyville Rehab, Walking Eagle AA
- 6-15: Other Indigenous healing + best general addiction services
- 15+: General addiction services as backfill

Applies generically to ALL multi-intent queries (e.g., "youth mental health" → mental_health + youth_services).
