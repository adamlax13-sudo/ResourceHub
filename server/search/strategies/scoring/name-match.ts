/**
 * Name Match Scoring
 *
 * Boost services by exact name, alias, or partial name match.
 * Runs BEFORE intent-based boosting in the search pipeline.
 */

import { SCORING_CONFIG } from '../../config';
import type { LiteService, LiteServiceWithDebug, ScoreExplanation } from '../../types';
import { searchLog } from '../../logger';

/** Options for boost functions */
export interface BoostOptions {
  /** Enable tracking of score explanations */
  trackExplanations?: boolean;
}

/** Result from boostByIntent with optional explanations */
export interface BoostResult {
  services: LiteService[];
  /** Services with score explanations (only when trackExplanations is true) */
  servicesWithExplanations?: LiteServiceWithDebug[];
}

// Cached reverse alias map (serviceId -> aliases), rebuilt only when forward map changes
let cachedReverseAliasMap: Map<string, Set<string>> | null = null;
let cachedAliasLookupRef: Map<string, string> | null = null;

function getReverseAliasMap(aliasLookup: Map<string, string>): Map<string, Set<string>> {
  if (cachedReverseAliasMap && cachedAliasLookupRef === aliasLookup) {
    return cachedReverseAliasMap;
  }
  const reverseMap = new Map<string, Set<string>>();
  aliasLookup.forEach((serviceId, alias) => {
    if (!reverseMap.has(serviceId)) {
      reverseMap.set(serviceId, new Set());
    }
    reverseMap.get(serviceId)!.add(alias);
  });
  cachedReverseAliasMap = reverseMap;
  cachedAliasLookupRef = aliasLookup;
  return reverseMap;
}

/**
 * Boost services by name/alias match. Runs BEFORE boostByIntent.
 *
 * Tiers:
 * 1. Exact name match (case-insensitive): +500
 * 2. Alias match (from service_aliases DB table): +500
 * 3. Partial name match (all 2+ non-stoplist query words in name): +250
 */
export function boostByNameMatch(
  services: LiteService[],
  rawQuery: string,
  aliasLookup: Map<string, string>,
  options?: BoostOptions
): LiteService[] {
  const cfg = SCORING_CONFIG;
  const trackExplanations = options?.trackExplanations ?? false;
  const queryLower = rawQuery.toLowerCase().trim();

  // Get cached reverse alias map: serviceId -> set of aliases
  const serviceAliases = getReverseAliasMap(aliasLookup);

  // Stoplist for partial match filtering
  const commonWordStoplist = new Set([
    'meals', 'meal', 'help', 'support', 'community', 'family', 'families',
    'service', 'services', 'center', 'centre', 'program', 'programs',
    'care', 'health', 'mental', 'housing', 'shelter', 'food', 'free',
    'counselling', 'counseling', 'therapy', 'group', 'groups', 'crisis',
    'emergency', 'assistance', 'resource', 'resources', 'outreach',
    'youth', 'adult', 'seniors', 'senior', 'women', 'men', 'children',
    'calgary', 'alberta', 'society', 'foundation', 'association',
  ]);

  // Pre-compute query words for partial matching
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  const nonStoplistWords = queryWords.filter(w => !commonWordStoplist.has(w));

  const scored = services.map(svc => {
    let boost = 0;
    const explanations: ScoreExplanation[] = [];
    const nameLower = svc.name.toLowerCase();

    const addFactor = (factor: string, value: number, reason: string) => {
      boost += value;
      if (trackExplanations) {
        explanations.push({ factor, value, reason });
      }
    };

    // Tier 1: Exact name match
    if (queryLower === nameLower) {
      addFactor('nameMatch.exact', cfg.nameMatch.exact, `Exact name match: "${svc.name}"`);
      searchLog.debug(`[NameMatch] "${svc.name.substring(0, 40)}" +${cfg.nameMatch.exact} exact name match`);
    }
    // Tier 2: Alias match
    else if (serviceAliases.has(svc.id)) {
      const aliases = serviceAliases.get(svc.id)!;
      if (aliases.has(queryLower)) {
        addFactor('nameMatch.alias', cfg.nameMatch.alias, `Alias match: "${queryLower}" -> "${svc.name}"`);
        searchLog.debug(`[NameMatch] "${svc.name.substring(0, 40)}" +${cfg.nameMatch.alias} alias match for "${queryLower}"`);
      }
    }

    // Tier 3: Partial name match (requires 2+ non-stoplist words, ALL must appear in name)
    if (boost === 0 && nonStoplistWords.length >= 2) {
      const allMatch = nonStoplistWords.every(w => nameLower.includes(w));
      if (allMatch) {
        addFactor('nameMatch.partial', cfg.nameMatch.partial, `Partial name match: all ${nonStoplistWords.length} words in name`);
        searchLog.debug(`[NameMatch] "${svc.name.substring(0, 40)}" +${cfg.nameMatch.partial} partial match (${nonStoplistWords.join(', ')})`);
      }
    }

    return { svc, boost, explanations };
  });

  // Sort by boost (highest first) while preserving relative order for equal boosts
  scored.sort((a, b) => b.boost - a.boost);

  const boostedCount = scored.filter(s => s.boost > 0).length;
  if (boostedCount > 0) {
    searchLog.debug(`[NameMatch] ${boostedCount} services boosted by name match`);
  }

  // Return services with explanations attached if tracking is enabled
  if (trackExplanations) {
    return scored.map(s => ({
      ...s.svc,
      scoreExplanation: [
        ...((s.svc as LiteServiceWithDebug).scoreExplanation || []),
        ...s.explanations,
      ],
    })) as LiteServiceWithDebug[];
  }

  return scored.map(s => s.svc);
}
