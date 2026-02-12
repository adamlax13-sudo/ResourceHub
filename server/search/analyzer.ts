/**
 * Query Analyzer
 *
 * Single source of truth for query parsing, intent detection,
 * and location extraction. Consolidates logic that was previously
 * scattered across routes.ts.
 */

import { SEARCH_CONFIG } from './config';
import type { QueryAnalysis, QueryIntent, SubstanceType } from './types';
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
  // Handle comma-separated multiple locations
  // Ensure we return null (not undefined or empty string) when no location is specified
  // This makes the search Alberta-wide by default
  const userLocation = userSelectedLocation?.trim().toLowerCase();
  const effectiveLocation = (userLocation && userLocation.length > 0)
    ? userLocation
    : (locationContext.specifiedLocation || null);

  // Debug log for location handling
  if (!effectiveLocation) {
    console.log(`[QueryAnalyzer] No location specified - searching Alberta-wide`);
  }

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

  // Detect specific substance type for substance_abuse intent
  const substanceType = intent === 'substance_abuse' ? detectSubstanceType(query) : null;
  if (substanceType) {
    console.log(`[QueryAnalyzer] Substance type detected: ${substanceType}`);
  }

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
    substanceType,
  };
}

/**
 * Detect if query is crisis-related
 * Checks both explicit keywords AND implicit patterns for suicidal ideation
 */
function detectCrisis(normalizedQuery: string): boolean {
  const lower = normalizedQuery.toLowerCase();

  // Check explicit crisis keywords first
  const hasExplicitCrisis = SEARCH_CONFIG.crisis.keywords.some(keyword =>
    lower.includes(keyword)
  );

  if (hasExplicitCrisis) {
    return true;
  }

  // Check implicit crisis patterns (subtle expressions of suicidal ideation)
  const hasImplicitCrisis = SEARCH_CONFIG.crisis.implicitPatterns.some(pattern =>
    pattern.test(lower)
  );

  if (hasImplicitCrisis) {
    console.log(`[QueryAnalyzer] Implicit crisis detected in query`);
  }

  return hasImplicitCrisis;
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
  const substancePatterns = SEARCH_CONFIG.substancePatterns;

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

  // === FALLBACK: Category indicators + distress detection ===
  // If explicit patterns didn't match, check for category terms + distress signals
  const q = query.toLowerCase();
  const categoryIndicators = SEARCH_CONFIG.categoryIndicators;
  const distressPattern = SEARCH_CONFIG.distressIndicators;
  const hasDistress = distressPattern.test(q);

  // Check substance/gambling indicators (betting sites, drug names, etc.)
  const hasSubstanceIndicator =
    substancePatterns.alcohol.some(p => p.test(q)) ||
    substancePatterns.opioid.some(p => p.test(q)) ||
    substancePatterns.stimulant.some(p => p.test(q)) ||
    substancePatterns.cannabis.some(p => p.test(q)) ||
    substancePatterns.gambling.some(p => p.test(q));

  if (hasSubstanceIndicator && hasDistress) {
    console.log(`[QueryAnalyzer] Domain intent detected: substance_abuse (via substance + distress)`);
    return 'substance_abuse';
  }

  // Check housing indicators
  if (categoryIndicators.housing.some(p => p.test(q)) && hasDistress) {
    console.log(`[QueryAnalyzer] Domain intent detected: housing_urgent (via housing + distress)`);
    return 'housing_urgent';
  }

  // Check food indicators
  if (categoryIndicators.food.some(p => p.test(q)) && hasDistress) {
    console.log(`[QueryAnalyzer] Domain intent detected: food_insecurity (via food + distress)`);
    return 'food_insecurity';
  }

  // Check mental health indicators (even without explicit distress - symptoms are distress)
  if (categoryIndicators.mental_health.some(p => p.test(q))) {
    console.log(`[QueryAnalyzer] Domain intent detected: mental_health (via mental health indicator)`);
    return 'mental_health';
  }

  // Check domestic violence indicators
  const hasDVIndicator = categoryIndicators.domestic_violence.some(p => p.test(q));
  // DV needs both relationship terms AND violence/safety terms
  const hasRelationship = /\b(partner|husband|wife|boyfriend|girlfriend|spouse|ex|he|she)\b/i.test(q);
  const hasViolence = /\b(hit|hurt|abuse|violent|attack|threat|scar|afraid|escape|safe)\b/i.test(q);
  if (hasDVIndicator && (hasRelationship && hasViolence)) {
    console.log(`[QueryAnalyzer] Domain intent detected: domestic_violence (via DV indicator)`);
    return 'domestic_violence';
  }

  return null;
}

/**
 * Detect specific substance mentioned in query
 * Returns the most specific substance type found, or 'general' for generic addiction queries
 */
function detectSubstanceType(query: string): SubstanceType {
  const patterns = SEARCH_CONFIG.substancePatterns;
  const q = query.toLowerCase();

  // Check each substance type in order of specificity
  if (patterns.alcohol.some(p => p.test(q))) return 'alcohol';
  if (patterns.opioid.some(p => p.test(q))) return 'opioid';
  if (patterns.stimulant.some(p => p.test(q))) return 'stimulant';
  if (patterns.cannabis.some(p => p.test(q))) return 'cannabis';
  if (patterns.gambling.some(p => p.test(q))) return 'gambling';

  // Check if it's a general addiction query (mentions addiction but no specific substance)
  if (/\b(addict|addiction|recovery|sober|relapse)\b/i.test(q)) return 'general';

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
export type { QueryAnalysis, QueryIntent, SubstanceType };
