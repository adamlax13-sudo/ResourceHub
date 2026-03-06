/**
 * Query Analyzer
 *
 * Single source of truth for query parsing, intent detection,
 * and location extraction. Consolidates logic that was previously
 * scattered across routes.ts.
 */

import { SEARCH_CONFIG } from './config';
import type { QueryAnalysis, QueryIntent, SubstanceType, IntentResult, ScoredIntent } from './types';
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
  correctQueryPhonetic,
} from '../helpers/keywords';
import { scrubPii } from '../helpers/pii';

/**
 * Analyze a search query and extract all relevant information.
 * This is the single entry point for query analysis.
 */
export function analyzeQuery(
  query: string,
  userSelectedLocation?: string | null,
  aliasLookup?: Map<string, string>
): QueryAnalysis {
  // Strip PII (phone numbers, addresses, postal codes, emails) before any downstream processing.
  // The raw query is preserved as analysis.raw for display purposes.
  const sanitized = scrubPii(query);

  // Normalize and correct typos (Levenshtein-based)
  const { corrected, corrections } = correctTypos(sanitized);
  if (corrections.length > 0) {
    console.log(`[QueryAnalyzer] Typo corrections: ${corrections.join(', ')}`);
  }

  // Apply phonetic corrections (catches "fud bank" → "food bank")
  const { corrected: phoneticCorrected, corrections: phoneticCorrections } = correctQueryPhonetic(corrected);
  if (phoneticCorrections.length > 0) {
    console.log(`[QueryAnalyzer] Phonetic corrections: ${phoneticCorrections.join(', ')}`);
  }

  const normalized = normalizeForCache(phoneticCorrected);

  // Extract negative terms (words user wants to exclude)
  const negativeTerms = extractNegativeTerms(sanitized);

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
  const aliasMatch = findAliasMatch(rawKeywords, aliasLookup);

  // Determine query intent(s) with confidence scores
  const intents = determineIntent(keywords, effectiveLocation, isCrisis, aliasMatch, sanitized);
  const intent = intents.primary.intent; // Backward compat

  // Detect specific substance type if any intent is substance_abuse
  const hasSubstanceIntent = intent === 'substance_abuse' ||
    intents.secondary?.intent === 'substance_abuse' ||
    intents.tertiary?.intent === 'substance_abuse';
  const substanceType = hasSubstanceIntent ? detectSubstanceType(sanitized) : null;
  if (substanceType) {
    console.log(`[QueryAnalyzer] Substance type detected: ${substanceType}`);
  }

  return {
    raw: query,
    normalized,
    keywords,
    intent,
    intents,
    location: {
      specified: effectiveLocation,
      isProvinceWide: !effectiveLocation || locationContext.isProvinceWide,
    },
    isCrisis,
    aliasMatch,
    substanceType,
    negativeTerms,
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
 * Find if any keyword matches a known service alias.
 * Uses database-backed alias lookup when available, falls back to hardcoded map.
 */
function findAliasMatch(keywords: string[], aliasLookup?: Map<string, string>): string | null {
  // Fallback aliases for when DB lookup isn't available (e.g., precomputed path)
  const FALLBACK_ALIASES: Record<string, string> = {
    'cmha': 'cmha-calgary',
    '988': '988-suicide-crisis-helpline',
    'aa': 'alcoholics-anonymous',
    'na': 'narcotics-anonymous',
    '211': '211-alberta',
  };

  // Check individual keywords
  for (const kw of keywords) {
    const lower = kw.toLowerCase();
    if (aliasLookup) {
      const serviceId = aliasLookup.get(lower);
      if (serviceId) return serviceId;
    }
    if (FALLBACK_ALIASES[lower]) {
      return FALLBACK_ALIASES[lower];
    }
  }

  // Check multi-word combinations (e.g., "kids help phone" as full phrase)
  if (aliasLookup && keywords.length > 1) {
    const fullPhrase = keywords.join(' ').toLowerCase();
    const phraseMatch = aliasLookup.get(fullPhrase);
    if (phraseMatch) return phraseMatch;
  }

  return null;
}

// === MULTI-INTENT CONFIDENCE SCORING ===

/** Internal type for raw intent scores before normalization */
interface IntentScore {
  intent: QueryIntent;
  score: number;
  matchCount: number;
}

/** Mapping from categoryIndicator keys to QueryIntent values */
const INDICATOR_TO_INTENT: Record<string, { intent: QueryIntent; requiresDistress: boolean }> = {
  housing: { intent: 'housing_urgent', requiresDistress: true },
  food: { intent: 'food_insecurity', requiresDistress: true },
  mental_health: { intent: 'mental_health', requiresDistress: false },
  disability: { intent: 'disability_support', requiresDistress: false },
  domestic_violence: { intent: 'domestic_violence', requiresDistress: false },
  financial: { intent: 'financial_support', requiresDistress: true },
  legal: { intent: 'legal_aid', requiresDistress: true },
  student: { intent: 'student_services', requiresDistress: true },
  grief: { intent: 'grief_support', requiresDistress: false },
  senior: { intent: 'senior_services', requiresDistress: false },
  youth: { intent: 'youth_services', requiresDistress: true },
  newcomer: { intent: 'newcomer_services', requiresDistress: false },
  family_addiction: { intent: 'family_addiction_support', requiresDistress: false },
  caregiver: { intent: 'caregiver_support', requiresDistress: false },
  lgbtq: { intent: 'lgbtq_services', requiresDistress: false },
  indigenous: { intent: 'indigenous_services', requiresDistress: false },
  parenting: { intent: 'parenting_support', requiresDistress: false },
  community_social: { intent: 'community_social', requiresDistress: false },
};

/**
 * Score all domain intents independently instead of first-match.
 * Each intent is scored based on how many of its patterns match the query.
 * Returns all intents with score > 0, sorted by score descending.
 */
function scoreAllDomainIntents(query: string): IntentScore[] {
  const patterns = SEARCH_CONFIG.domainPatterns;
  const substancePatterns = SEARCH_CONFIG.substancePatterns;
  const categoryIndicators = SEARCH_CONFIG.categoryIndicators;
  const q = query.toLowerCase();
  const hasDistress = SEARCH_CONFIG.distressIndicators.test(q);

  const scores = new Map<QueryIntent, IntentScore>();

  function addScore(intent: QueryIntent, points: number) {
    const existing = scores.get(intent);
    if (existing) {
      existing.score += points;
      existing.matchCount += 1;
    } else {
      scores.set(intent, { intent, score: points, matchCount: 1 });
    }
  }

  // Phase 1: Domain pattern matching - test ALL intent pattern groups
  // Use lowercased query for consistency (domain patterns have /i flag but this is safer)
  const domainKeys = Object.keys(patterns) as Array<keyof typeof patterns>;
  for (const domain of domainKeys) {
    const domainPatternList = patterns[domain];
    for (const pattern of domainPatternList) {
      if (pattern.test(q)) {
        addScore(domain as QueryIntent, 1.0);
      }
    }
  }

  // Phase 2: Category indicator matching (weaker signals)
  for (const [key, config] of Object.entries(INDICATOR_TO_INTENT)) {
    const indicators = categoryIndicators[key as keyof typeof categoryIndicators];
    if (!indicators) continue;
    const matched = (indicators as readonly RegExp[]).some((p: RegExp) => p.test(q));
    if (matched) {
      if (config.requiresDistress && !hasDistress) {
        addScore(config.intent, 0.3);
      } else {
        addScore(config.intent, 0.6);
      }
    }
  }

  // Phase 3: Substance indicator fallback
  const hasSubstanceIndicator =
    substancePatterns.alcohol.some(p => p.test(q)) ||
    substancePatterns.opioid.some(p => p.test(q)) ||
    substancePatterns.stimulant.some(p => p.test(q)) ||
    substancePatterns.cannabis.some(p => p.test(q)) ||
    substancePatterns.gambling.some(p => p.test(q));

  if (hasSubstanceIndicator) {
    addScore('substance_abuse', hasDistress ? 0.7 : 0.4);
  }

  // Phase 4: DV compound check (relationship + violence terms)
  const hasDVIndicator = categoryIndicators.domestic_violence?.some(p => p.test(q));
  const hasRelationship = /\b(partner|husband|wife|boyfriend|girlfriend|spouse|ex|he|she)\b/i.test(q);
  const hasViolence = /\b(hit|hurt|abuse|violent|attack|threat|scar|afraid|escape|safe)\b/i.test(q);
  if (hasDVIndicator && hasRelationship && hasViolence) {
    addScore('domestic_violence', 0.8);
  }

  return Array.from(scores.values())
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

/**
 * Convert raw scores to 0-1 confidence values using sigmoid normalization.
 * confidence = score / (score + k), where k=1.5 controls steepness.
 *
 * Mapping: 1.0 → 0.40, 2.0 → 0.57, 3.0 → 0.67, 4.0 → 0.73
 */
function normalizeToConfidence(scores: IntentScore[]): ScoredIntent[] {
  const k = 1.5;
  return scores.map(s => ({
    intent: s.intent,
    confidence: Math.round((s.score / (s.score + k)) * 100) / 100,
  }));
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
 * Determine the intent(s) behind a query with confidence scores.
 * Returns an IntentResult with primary and optional secondary/tertiary intents.
 */
function determineIntent(
  keywords: string[],
  location: string | null,
  isCrisis: boolean,
  aliasMatch: string | null,
  rawQuery: string
): IntentResult {
  // Crisis short-circuits (safety priority)
  if (isCrisis) {
    return { primary: { intent: 'crisis', confidence: 1.0 } };
  }

  // Alias short-circuits (UX)
  if (aliasMatch) {
    return { primary: { intent: 'alias', confidence: 1.0 } };
  }

  // Score all domain intents independently
  const scores = scoreAllDomainIntents(rawQuery);
  const confidences = normalizeToConfidence(scores);

  if (confidences.length === 0) {
    // Location-only or general
    if (location && keywords.length === 0) {
      return { primary: { intent: 'location_only', confidence: 0.9 } };
    }
    return { primary: { intent: 'general', confidence: 0.5 } };
  }

  const result: IntentResult = {
    primary: confidences[0],
  };

  // Include secondary if confidence is meaningful (>= 0.2) and
  // at least 40% of primary's confidence (not noise)
  const minConfidence = 0.2;
  const minRatio = 0.4;

  if (confidences.length >= 2 &&
      confidences[1].confidence >= minConfidence &&
      confidences[1].confidence >= confidences[0].confidence * minRatio) {
    result.secondary = confidences[1];
  }

  if (confidences.length >= 3 &&
      confidences[2].confidence >= minConfidence &&
      confidences[2].confidence >= confidences[0].confidence * minRatio) {
    result.tertiary = confidences[2];
  }

  // Log multi-intent detection
  if (result.secondary) {
    const parts = [`primary: ${result.primary.intent}(${result.primary.confidence})`];
    parts.push(`secondary: ${result.secondary.intent}(${result.secondary.confidence})`);
    if (result.tertiary) {
      parts.push(`tertiary: ${result.tertiary.intent}(${result.tertiary.confidence})`);
    }
    console.log(`[QueryAnalyzer] Multi-intent detected: ${parts.join(', ')}`);
  } else {
    console.log(`[QueryAnalyzer] Domain intent detected: ${result.primary.intent}(${result.primary.confidence})`);
  }

  return result;
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

/**
 * Extract negative terms from query (words user wants to exclude)
 * Handles patterns like "not X", "without X", "no X", "except X"
 * Also handles multi-word phrases like "12 step", "faith based"
 */
function extractNegativeTerms(query: string): string[] {
  const negatives: string[] = [];
  const q = query.toLowerCase();

  // Check for known multi-word negative phrases first
  const knownPhrases = [
    { pattern: /\bno\s+12[\s-]?step/i, term: '12_step' },
    { pattern: /\bnot?\s+12[\s-]?step/i, term: '12_step' },
    { pattern: /\bwithout\s+12[\s-]?step/i, term: '12_step' },
    { pattern: /\bnon[\s-]?12[\s-]?step/i, term: '12_step' },
    { pattern: /\bnot?\s+religious/i, term: 'religious' },
    { pattern: /\bnot?\s+faith[\s-]?based/i, term: 'faith_based' },
    { pattern: /\bsecular\b/i, term: 'religious' },
    { pattern: /\bnon[\s-]?religious/i, term: 'religious' },
    { pattern: /\bnon[\s-]?faith/i, term: 'faith_based' },
  ];

  for (const { pattern, term } of knownPhrases) {
    if (pattern.test(q)) {
      negatives.push(term);
    }
  }

  // Patterns: "not X", "without X", "no X", "except X", "excluding X", "avoid X"
  const patterns = [
    /\b(?:not|without|except|excluding|avoid)\s+(\w+)/gi,
    /\bno\s+(\w+)(?:\s+(?:services?|programs?|places?))?/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(q)) !== null) {
      const term = match[1].toLowerCase();
      // Skip common false positives and terms that indicate NEED rather than exclusion
      // "no food" means they need food, not that they want to exclude food services
      const skipTerms = [
        // General false positives
        'one', 'way', 'idea', 'more', 'longer', 'problem', '12',
        // Terms that indicate NEED when preceded by "no" (e.g., "no food" = needs food)
        'food', 'money', 'home', 'place', 'shelter', 'help', 'where', 'job',
        'income', 'support', 'friends', 'family', 'insurance', 'bed', 'housing',
        'sleep', 'resources', 'options', 'choice', 'hope', 'energy', 'motivation',
        // Common nouns that don't make sense as exclusions
        'point', 'reason', 'clue', 'idea',
      ];
      if (!skipTerms.includes(term)) {
        if (!negatives.includes(term)) {
          negatives.push(term);
        }
      }
    }
  }

  // Handle "X-free" patterns: "drug-free", "alcohol-free"
  // Safelist: compound terms where "-free" means accessible/without/dietary, not exclusion
  const freeSafelist = new Set([
    'barrier', 'gluten', 'interest', 'toll', 'cost', 'rent', 'debt',
    'drug', 'smoke', 'alcohol', 'judgment', 'stigma', 'fee', 'charge',
  ]);
  const freePattern = /\b(\w+)[- ]free\b/gi;
  let match;
  while ((match = freePattern.exec(q)) !== null) {
    const captured = match[1].toLowerCase();
    if (!freeSafelist.has(captured)) {
      negatives.push(captured);
    }
  }

  if (negatives.length > 0) {
    console.log(`[QueryAnalyzer] Negative terms detected: ${negatives.join(', ')}`);
  }

  return negatives.slice(0, 10);
}

// Re-export types for convenience
export type { QueryAnalysis, QueryIntent, SubstanceType, IntentResult, ScoredIntent };
