/**
 * Query Understanding — single entry point for the analysis pipeline.
 *
 * Sequences: analyzeQuery (sync) → buildCacheKey → enhanceIntentWithLLM (async).
 * Returns sync base analysis for immediate cache lookup, plus an async promise
 * for LLM-enhanced analysis to merge on cache miss.
 */

import type { QueryAnalysis, BaseAnalysis } from './types';
import { analyzeQuery, buildCacheKey } from './analyzer';
import { enhanceIntentWithLLM } from './llm-intent';

export interface QueryUnderstandingResult {
  /** Synchronous analysis — safe for cache key computation */
  base: QueryAnalysis;
  /** Async LLM enhancement — resolves to base on failure */
  enhanced: Promise<QueryAnalysis>;
  /** Pre-computed cache key (includes version prefix) */
  cacheKey: string;
}

/**
 * Run the full query understanding pipeline.
 *
 * @param raw - User's raw search query
 * @param databaseHash - Current DB content hash for cache invalidation
 * @param cacheVersion - Cache version string (e.g., "v164")
 * @param location - Optional user-selected location
 * @param aliasLookup - Optional service alias map
 */
export function understandQuery(
  raw: string,
  databaseHash: string,
  cacheVersion: string,
  location?: string | null,
  aliasLookup?: Map<string, string>,
): QueryUnderstandingResult {
  // 1. Synchronous regex-based analysis (instant)
  const base = analyzeQuery(raw, location, aliasLookup);

  // 2. Cache key uses only sync fields — not blocked by LLM latency
  const cacheKey = `${cacheVersion}:${buildCacheKey(base, 'comprehensive', databaseHash)}`;

  // 3. Fire LLM enhancement in parallel — don't await
  const enhanced = enhanceIntentWithLLM(base);

  return { base, enhanced, cacheKey };
}
