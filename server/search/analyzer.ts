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
  correctQueryPhonetic,
} from '../helpers/keywords';

/**
 * Analyze a search query and extract all relevant information.
 * This is the single entry point for query analysis.
 */
export function analyzeQuery(
  query: string,
  userSelectedLocation?: string | null
): QueryAnalysis {
  // Normalize and correct typos (Levenshtein-based)
  const { corrected, corrections } = correctTypos(query);
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
  const negativeTerms = extractNegativeTerms(query);

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

  // PRE-CHECK: If query explicitly mentions food/meals, prioritize food_insecurity
  // even if it also mentions "homeless" (e.g., "free meals for homeless")
  const isFoodQuery = /\b(meals?|food|hungry|eat|groceries|food bank|pantry|soup kitchen|hamper)\b/i.test(query);
  if (isFoodQuery) {
    for (const pattern of patterns.food_insecurity) {
      if (pattern.test(query)) {
        console.log(`[QueryAnalyzer] Domain intent detected: food_insecurity (food-specific query)`);
        return 'food_insecurity';
      }
    }
  }

  // PRE-CHECK: If query explicitly mentions veteran/military, prioritize veteran_services
  // even if it also mentions "homeless" or housing (e.g., "homeless veteran with PTSD")
  const isVeteranQuery = /\b(veteran|veterans?|military|armed forces|ex-?military|former military|CAF|PTSD.*(?:combat|military|veteran)|(?:combat|military|veteran).*PTSD)\b/i.test(query);
  if (isVeteranQuery) {
    for (const pattern of patterns.veteran_services) {
      if (pattern.test(query)) {
        console.log(`[QueryAnalyzer] Domain intent detected: veteran_services (veteran-specific query)`);
        return 'veteran_services';
      }
    }
  }

  // PRE-CHECK: If query explicitly mentions indigenous, prioritize indigenous_services
  // even if it also mentions addiction or other services
  const isIndigenousQuery = /\b(indigenous|first nations?|métis|metis|inuit|native|aboriginal)\b/i.test(query);
  if (isIndigenousQuery) {
    for (const pattern of patterns.indigenous_services) {
      if (pattern.test(query)) {
        console.log(`[QueryAnalyzer] Domain intent detected: indigenous_services (indigenous-specific query)`);
        return 'indigenous_services';
      }
    }
  }

  // PRE-CHECK: If query mentions tenant rights or eviction in legal context, prioritize legal_aid
  // before housing_urgent (e.g., "tenant rights eviction" vs "getting evicted need shelter")
  const isLegalEvictionQuery = /\b(tenant rights|eviction.*(?:legal|help|lawyer|rights)|(?:legal|lawyer|rights).*eviction)\b/i.test(query);
  if (isLegalEvictionQuery) {
    for (const pattern of patterns.legal_aid) {
      if (pattern.test(query)) {
        console.log(`[QueryAnalyzer] Domain intent detected: legal_aid (eviction legal query)`);
        return 'legal_aid';
      }
    }
  }

  // Check housing urgent (urgent need)
  for (const pattern of patterns.housing_urgent) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: housing_urgent`);
      return 'housing_urgent';
    }
  }

  // Check food insecurity (basic need) - for queries that weren't caught by pre-check
  for (const pattern of patterns.food_insecurity) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: food_insecurity`);
      return 'food_insecurity';
    }
  }

  // Check family addiction support patterns FIRST (before substance_abuse)
  // This ensures "my husband is an alcoholic" routes to family support (Al-Anon), not treatment
  for (const pattern of patterns.family_addiction_support) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: family_addiction_support`);
      return 'family_addiction_support';
    }
  }

  // Check substance abuse patterns
  for (const pattern of patterns.substance_abuse) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: substance_abuse`);
      return 'substance_abuse';
    }
  }

  // Check LGBTQ+ services patterns (identity-specific needs)
  for (const pattern of patterns.lgbtq_services) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: lgbtq_services`);
      return 'lgbtq_services';
    }
  }

  // Check veteran/military services patterns
  for (const pattern of patterns.veteran_services) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: veteran_services`);
      return 'veteran_services';
    }
  }

  // Check legal aid patterns
  for (const pattern of patterns.legal_aid) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: legal_aid`);
      return 'legal_aid';
    }
  }

  // Check employment support patterns
  for (const pattern of patterns.employment_support) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: employment_support`);
      return 'employment_support';
    }
  }

  // Check financial support patterns
  for (const pattern of patterns.financial_support) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: financial_support`);
      return 'financial_support';
    }
  }

  // Check grief support patterns
  for (const pattern of patterns.grief_support) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: grief_support`);
      return 'grief_support';
    }
  }

  // Check caregiver support patterns
  for (const pattern of patterns.caregiver_support) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: caregiver_support`);
      return 'caregiver_support';
    }
  }

  // Check senior services patterns
  for (const pattern of patterns.senior_services) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: senior_services`);
      return 'senior_services';
    }
  }

  // Check youth services patterns
  for (const pattern of patterns.youth_services) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: youth_services`);
      return 'youth_services';
    }
  }

  // Check newcomer services patterns
  for (const pattern of patterns.newcomer_services) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: newcomer_services`);
      return 'newcomer_services';
    }
  }

  // Check disability support patterns FIRST (before mental_health)
  // This ensures autism + social difficulty queries get proper disability routing
  for (const pattern of patterns.disability_support) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: disability_support`);
      return 'disability_support';
    }
  }

  // Check student services patterns BEFORE mental_health
  // This ensures "UCalgary mental health" routes to student_services not general mental_health
  for (const pattern of patterns.student_services) {
    if (pattern.test(query)) {
      console.log(`[QueryAnalyzer] Domain intent detected: student_services`);
      return 'student_services';
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

  // Check family addiction indicators (Al-Anon, Nar-Anon)
  if (categoryIndicators.family_addiction?.some(p => p.test(q))) {
    console.log(`[QueryAnalyzer] Domain intent detected: family_addiction_support (via family addiction indicator)`);
    return 'family_addiction_support';
  }

  // Check LGBTQ+ indicators
  if (categoryIndicators.lgbtq?.some(p => p.test(q))) {
    console.log(`[QueryAnalyzer] Domain intent detected: lgbtq_services (via LGBTQ indicator)`);
    return 'lgbtq_services';
  }

  // Check legal indicators
  if (categoryIndicators.legal?.some(p => p.test(q)) && hasDistress) {
    console.log(`[QueryAnalyzer] Domain intent detected: legal_aid (via legal indicator)`);
    return 'legal_aid';
  }

  // Check financial indicators
  if (categoryIndicators.financial?.some(p => p.test(q)) && hasDistress) {
    console.log(`[QueryAnalyzer] Domain intent detected: financial_support (via financial indicator)`);
    return 'financial_support';
  }

  // Check grief indicators
  if (categoryIndicators.grief?.some(p => p.test(q))) {
    console.log(`[QueryAnalyzer] Domain intent detected: grief_support (via grief indicator)`);
    return 'grief_support';
  }

  // Check caregiver indicators
  if (categoryIndicators.caregiver?.some(p => p.test(q))) {
    console.log(`[QueryAnalyzer] Domain intent detected: caregiver_support (via caregiver indicator)`);
    return 'caregiver_support';
  }

  // Check senior indicators
  if (categoryIndicators.senior?.some(p => p.test(q))) {
    console.log(`[QueryAnalyzer] Domain intent detected: senior_services (via senior indicator)`);
    return 'senior_services';
  }

  // Check youth indicators
  if (categoryIndicators.youth?.some(p => p.test(q)) && hasDistress) {
    console.log(`[QueryAnalyzer] Domain intent detected: youth_services (via youth indicator)`);
    return 'youth_services';
  }

  // Check newcomer indicators
  if (categoryIndicators.newcomer?.some(p => p.test(q))) {
    console.log(`[QueryAnalyzer] Domain intent detected: newcomer_services (via newcomer indicator)`);
    return 'newcomer_services';
  }

  // Check indigenous indicators
  if (categoryIndicators.indigenous?.some(p => p.test(q))) {
    console.log(`[QueryAnalyzer] Domain intent detected: indigenous_services (via indigenous indicator)`);
    return 'indigenous_services';
  }

  // Check student/campus indicators
  if (categoryIndicators.student?.some(p => p.test(q)) && hasDistress) {
    console.log(`[QueryAnalyzer] Domain intent detected: student_services (via student indicator + distress)`);
    return 'student_services';
  }

  // Check parenting indicators
  if (categoryIndicators.parenting?.some(p => p.test(q))) {
    console.log(`[QueryAnalyzer] Domain intent detected: parenting_support (via parenting indicator)`);
    return 'parenting_support';
  }

  // Check mental health indicators (even without explicit distress - symptoms are distress)
  if (categoryIndicators.mental_health.some(p => p.test(q))) {
    console.log(`[QueryAnalyzer] Domain intent detected: mental_health (via mental health indicator)`);
    return 'mental_health';
  }

  // Check disability/neurodivergent indicators - route to disability_support
  // These queries need specialized disability services, not generic mental health
  if (categoryIndicators.disability?.some(p => p.test(q))) {
    console.log(`[QueryAnalyzer] Domain intent detected: disability_support (via disability indicator)`);
    return 'disability_support';
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
  const freePattern = /\b(\w+)[- ]free\b/gi;
  let match;
  while ((match = freePattern.exec(q)) !== null) {
    negatives.push(match[1].toLowerCase());
  }

  if (negatives.length > 0) {
    console.log(`[QueryAnalyzer] Negative terms detected: ${negatives.join(', ')}`);
  }

  return negatives;
}

// Re-export types for convenience
export type { QueryAnalysis, QueryIntent, SubstanceType };
