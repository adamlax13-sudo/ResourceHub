/**
 * Query Analyzer
 *
 * Single source of truth for query parsing, intent detection,
 * and location extraction. Consolidates logic that was previously
 * scattered across routes.ts.
 */

import { SEARCH_CONFIG } from './config';
import type { QueryAnalysis, QueryIntent } from './types';
import {
  extractLocationContext,
  ALBERTA_LOCATIONS,
  LOCATION_ALIASES,
} from '../helpers/locations';
import {
  extractKeywords,
  normalizeForCache,
  correctTypos,
  expandKeywords,
  stem,
} from '../helpers/keywords';

/**
 * Analyze a search query and extract all relevant information.
 * This is the single entry point for query analysis.
 */
export function analyzeQuery(
  query: string,
  userSelectedLocation?: string | null
): QueryAnalysis {
  // Normalize and correct typos
  const { corrected, corrections } = correctTypos(query);
  if (corrections.length > 0) {
    console.log(`[QueryAnalyzer] Typo corrections: ${corrections.join(', ')}`);
  }

  const normalized = normalizeForCache(corrected);

  // Extract keywords (non-stop words, non-location terms)
  const rawKeywords = extractKeywords(corrected);

  // Extract location context from query text
  const locationContext = extractLocationContext(corrected);

  // Effective location: user-selected takes precedence over query-extracted
  const effectiveLocation = userSelectedLocation?.trim().toLowerCase() ||
    locationContext.specifiedLocation;

  // Filter out location terms from keywords
  const keywords = rawKeywords.filter(kw =>
    !ALBERTA_LOCATIONS.has(kw) && !LOCATION_ALIASES[kw]
  );

  // Detect crisis
  const isCrisis = detectCrisis(normalized);

  // Find alias matches (e.g., "CMHA" -> service ID)
  const aliasMatch = findAliasMatch(rawKeywords);

  // Determine query intent
  const intent = determineIntent(keywords, effectiveLocation, isCrisis, aliasMatch, query);

  return {
    raw: query,
    normalized,
    keywords,
    intent,
    location: {
      specified: effectiveLocation,
      isProvinceWide: !effectiveLocation || locationContext.isProvinceWide,
    },
    isCrisis,
    aliasMatch,
  };
}

/**
 * Detect if query is crisis-related
 */
function detectCrisis(normalizedQuery: string): boolean {
  const lower = normalizedQuery.toLowerCase();
  return SEARCH_CONFIG.crisis.keywords.some(keyword =>
    lower.includes(keyword)
  );
}

/**
 * Find if any keyword matches a known service alias
 */
function findAliasMatch(keywords: string[]): string | null {
  // This would check against the service_aliases table
  // For now, check against common hardcoded aliases
  const KNOWN_ALIASES: Record<string, string> = {
    'cmha': 'cmha-calgary',
    '988': '988-suicide-crisis-helpline',
    'aa': 'alcoholics-anonymous',
    'na': 'narcotics-anonymous',
    '211': '211-alberta',
  };

  for (const kw of keywords) {
    const lower = kw.toLowerCase();
    if (KNOWN_ALIASES[lower]) {
      return KNOWN_ALIASES[lower];
    }
  }
  return null;
}

/**
 * Detect domain-specific intent from query patterns
 * Returns null if no specific domain intent detected
 */
function detectDomainIntent(query: string): QueryIntent | null {
  const patterns = SEARCH_CONFIG.domainPatterns;

  // Check domestic violence FIRST (safety priority)
  for (const pattern of patterns.domestic_violence) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: domestic_violence`);
      return 'domestic_violence';
    }
  }

  // Check housing urgent (urgent need)
  for (const pattern of patterns.housing_urgent) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: housing_urgent`);
      return 'housing_urgent';
    }
  }

  // Check food insecurity (basic need)
  for (const pattern of patterns.food_insecurity) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: food_insecurity`);
      return 'food_insecurity';
    }
  }

  // Check substance abuse patterns
  for (const pattern of patterns.substance_abuse) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: substance_abuse`);
      return 'substance_abuse';
    }
  }

  // Check mental health patterns
  for (const pattern of patterns.mental_health) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: mental_health`);
      return 'mental_health';
    }
  }

  return null;
}

/**
 * Determine the intent behind a query
 */
function determineIntent(
  keywords: string[],
  location: string | null,
  isCrisis: boolean,
  aliasMatch: string | null,
  rawQuery: string
): QueryIntent {
  // Crisis is highest priority
  if (isCrisis) {
    return 'crisis';
  }

  // Direct alias lookup (user searching for specific service)
  if (aliasMatch) {
    return 'alias';
  }

  // Check for domain-specific intents (substance abuse, mental health, housing)
  const domainIntent = detectDomainIntent(rawQuery);
  if (domainIntent) {
    return domainIntent;
  }

  // Location-only query (no topic keywords, just a city name)
  if (location && keywords.length === 0) {
    return 'location_only';
  }

  // General search
  return 'general';
}

/**
 * Build a cache key from query analysis and mode
 */
export function buildCacheKey(
  analysis: QueryAnalysis,
  mode: string,
  databaseHash: string
): string {
  const locationKey = analysis.location.specified
    ? `:loc:${analysis.location.specified}`
    : '';
  return `${databaseHash}:${mode}:${analysis.normalized}${locationKey}`;
}

/**
 * Get expanded keywords for broader matching
 */
export function getExpandedKeywords(analysis: QueryAnalysis): string[] {
  return expandKeywords(analysis.keywords);
}

/**
 * Get stemmed keywords for fuzzy matching
 */
export function getStemmedKeywords(keywords: string[]): Set<string> {
  const stemmed = new Set<string>();
  for (const kw of keywords) {
    stemmed.add(kw);
    const s = stem(kw);
    if (s !== kw && s.length >= 3) {
      stemmed.add(s);
    }
  }
  return stemmed;
}

// Re-export types for convenience
export type { QueryAnalysis, QueryIntent };
