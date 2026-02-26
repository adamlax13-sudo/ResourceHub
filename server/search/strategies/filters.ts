/**
 * Filters Module
 *
 * Handles post-search filtering and diversity enforcement.
 * Includes category diversity, organization diversity, and result curation
 * to ensure balanced, relevant search results.
 */

import type { LiteService } from '../types';
import { detectOrganizationSearch, extractOrganization } from './detectors';
import type { AgeGroupDetection } from './detectors';

/**
 * Filter configuration for diversity settings
 */
export const FILTER_CONFIG = {
  categoryDiversity: {
    maxPerCategory: 3,   // Max services per category in top results
    topN: 15,            // Number of top results to apply diversity to
    lookAhead: 2,        // Multiplier for how far ahead to look for diverse results
  },
  orgDiversity: {
    maxPerOrg: 2,        // Max services per organization in top results
    topN: 10,            // Number of top results to apply diversity to
  },
};

/**
 * Apply category diversity for location-only queries
 * Ensures top results include a mix of different service categories
 * rather than being dominated by one type (e.g., mental health)
 */
export function applyCategoryDiversity(
  services: LiteService[],
  maxPerCategory: number = FILTER_CONFIG.categoryDiversity.maxPerCategory,
  topN: number = FILTER_CONFIG.categoryDiversity.topN
): LiteService[] {
  if (services.length <= topN) {
    return services;
  }

  const lookAhead = FILTER_CONFIG.categoryDiversity.lookAhead;
  const topResults = services.slice(0, Math.min(topN * lookAhead, services.length)); // Look at top 30 to find diversity
  const rest = services.slice(topN * lookAhead);

  // Normalize categories into broader groups
  function normalizeCategory(category: string): string {
    const lower = category.toLowerCase();
    if (/mental|counsell|therapy|depression|anxiety|crisis/i.test(lower)) return 'mental_health';
    if (/addiction|substance|alcohol|drug|recovery|detox/i.test(lower)) return 'addiction';
    if (/shelter|housing|homeless/i.test(lower)) return 'housing';
    if (/food|meal|hungry|pantry|bank/i.test(lower)) return 'food';
    if (/legal|lawyer|court/i.test(lower)) return 'legal';
    if (/employment|job|career/i.test(lower)) return 'employment';
    if (/senior|elderly|aging/i.test(lower)) return 'seniors';
    if (/youth|teen|child/i.test(lower)) return 'youth';
    if (/immigrant|refugee|newcomer/i.test(lower)) return 'newcomer';
    if (/family|parent|child/i.test(lower)) return 'family';
    if (/disability|accessibility/i.test(lower)) return 'disability';
    return 'general';
  }

  const categoryCounts = new Map<string, number>();
  const diversified: LiteService[] = [];
  const demoted: LiteService[] = [];

  for (const svc of topResults) {
    const normalizedCat = normalizeCategory(svc.category);
    const currentCount = categoryCounts.get(normalizedCat) || 0;

    if (currentCount < maxPerCategory) {
      diversified.push(svc);
      categoryCounts.set(normalizedCat, currentCount + 1);
    } else {
      demoted.push(svc);
    }

    // Stop once we have enough diverse results
    if (diversified.length >= topN) break;
  }

  console.log(`[CategoryDiversity] Top ${diversified.length} results from ${categoryCounts.size} categories`);

  return [...diversified, ...demoted, ...rest];
}

/**
 * Apply organization diversity - prevent too many results from same org in top results
 * Limits to max 2 services per organization in the top 10 results
 * EXCEPTION: If user is searching for a specific organization, don't limit that org
 */
export function applyOrganizationDiversity(
  services: LiteService[],
  rawQuery: string,
  maxPerOrg: number = FILTER_CONFIG.orgDiversity.maxPerOrg,
  topN: number = FILTER_CONFIG.orgDiversity.topN
): LiteService[] {
  if (services.length <= topN) {
    return services; // No need to diversify small result sets
  }

  // Check if user is searching for a specific organization
  const targetOrg = detectOrganizationSearch(rawQuery);

  const topResults = services.slice(0, topN);
  const rest = services.slice(topN);

  // Count organizations in top results
  const orgCounts = new Map<string, number>();
  const diversified: LiteService[] = [];
  const demoted: LiteService[] = [];

  for (const svc of topResults) {
    const org = extractOrganization(svc.name);
    const currentCount = orgCounts.get(org) || 0;

    // Skip diversity limiting if this is the target organization user searched for
    if (org === targetOrg || currentCount < maxPerOrg) {
      diversified.push(svc);
      orgCounts.set(org, currentCount + 1);
    } else {
      demoted.push(svc);
    }
  }

  // Log if any services were demoted for diversity
  if (demoted.length > 0) {
    console.log(`[OrgDiversity] Demoted ${demoted.length} services for organization diversity`);
  }

  // Return diversified top + demoted + rest
  return [...diversified, ...demoted, ...rest];
}

/**
 * Filter services by gender preference
 * Returns services that match the specified gender preference
 */
export function filterByGender(
  services: LiteService[],
  genderPref: 'women_only' | 'men_only' | null
): LiteService[] {
  if (!genderPref) return services;

  return services.filter(svc => {
    const text = `${svc.name} ${svc.category} ${svc.description}`.toLowerCase();

    if (genderPref === 'women_only') {
      // Include women's services, exclude men-only
      const menOnlyIndicator = /men'?s.*shelter|men only|males only|for men\b/i.test(text);
      return !menOnlyIndicator;
    } else if (genderPref === 'men_only') {
      // Include men's services, exclude women-only
      const womenOnlyIndicator = /women'?s.*shelter|women only|females only|for women\b/i.test(text);
      return !womenOnlyIndicator;
    }

    return true;
  });
}

/**
 * Filter services by age group
 * Returns services that match the specified age group preference
 */
export function filterByAgeGroup(
  services: LiteService[],
  ageGroup: 'youth' | 'adult' | 'senior' | null
): LiteService[] {
  if (!ageGroup) return services;

  return services.filter(svc => {
    const text = `${svc.name} ${svc.category} ${svc.description}`.toLowerCase();

    if (ageGroup === 'youth') {
      // Exclude senior-only services
      const seniorOnlyIndicator = /senior only|65\+ only|elderly only|seniors only/i.test(text);
      return !seniorOnlyIndicator;
    } else if (ageGroup === 'adult') {
      // Exclude youth-only and senior-only services
      const youthOnlyIndicator = /youth only|under 18 only|teen only|children only|kids only/i.test(text);
      const seniorOnlyIndicator = /senior only|65\+ only|elderly only|seniors only/i.test(text);
      return !youthOnlyIndicator && !seniorOnlyIndicator;
    } else if (ageGroup === 'senior') {
      // Exclude youth-only services
      const youthOnlyIndicator = /youth only|under 18 only|teen only|children only|kids only/i.test(text);
      return !youthOnlyIndicator;
    }

    return true;
  });
}

/**
 * Filter services based on exclusion signals
 * Removes services that match user's exclusion preferences
 */
export function filterByExclusions(
  services: LiteService[],
  exclusions: string[]
): LiteService[] {
  if (exclusions.length === 0) return services;

  return services.filter(svc => {
    const text = `${svc.name} ${svc.category} ${svc.description}`.toLowerCase();

    for (const exclusion of exclusions) {
      if (exclusion === 'religious') {
        // Strong religious indicators that should be excluded
        if (/\b(church service|bible study|prayer group|worship|evangelical|ministry|mission)\b/i.test(text)) {
          return false;
        }
      }

      if (exclusion === '12step') {
        // 12-step program indicators
        if (/\b(12[\s-]?step|twelve[\s-]?step|AA\b|NA\b|CA\b|alcoholics anonymous|narcotics anonymous|higher power)\b/i.test(text)) {
          return false;
        }
      }

      if (exclusion === 'men_only') {
        if (/\b(men only|males only|for men\b|men'?s only)\b/i.test(text)) {
          return false;
        }
      }

      if (exclusion === 'women_only') {
        if (/\b(women only|females only|for women\b|women'?s only)\b/i.test(text)) {
          return false;
        }
      }

      if (exclusion === 'paid') {
        // Don't filter, just deprioritize - this is handled in scoring
        // Filtering would remove too many relevant services
      }

      if (exclusion === 'waitlist') {
        // Don't filter, just deprioritize - this is handled in scoring
        // Filtering would remove too many relevant services
      }
    }

    return true;
  });
}

/**
 * Limit results to a maximum count
 * Simple utility for capping result sets
 */
export function limitResults(services: LiteService[], maxResults: number): LiteService[] {
  return services.slice(0, maxResults);
}

/**
 * Remove duplicate services based on service ID
 * Ensures each service appears only once in results
 */
export function deduplicateServices(services: LiteService[]): LiteService[] {
  const seen = new Set<string>();
  return services.filter(svc => {
    if (seen.has(svc.id)) {
      return false;
    }
    seen.add(svc.id);
    return true;
  });
}

/**
 * Apply age-based filtering with confidence levels
 * High confidence: hard filter mismatched services
 * Medium confidence: no filtering (handled by scoring penalties)
 *
 * Key behaviors:
 * - all_ages services always pass through
 * - youth_and_adult passes for youth OR adult queries
 * - Services matching the detected age group pass through
 */
export function applyAgeFilter(
  services: LiteService[],
  detection: AgeGroupDetection | null
): LiteService[] {
  if (!detection) return services;  // No age signal = no filtering

  const { ageGroup, confidence } = detection;

  if (confidence === 'high') {
    const before = services.length;
    const filtered = services.filter(svc => {
      const serviceAgeGroup = (svc as any).age_group || 'all_ages';

      // all_ages always passes through
      if (serviceAgeGroup === 'all_ages') return true;

      // youth_and_adult passes for youth OR adult queries
      if (serviceAgeGroup === 'youth_and_adult' &&
          (ageGroup === 'youth' || ageGroup === 'adult')) return true;

      // Direct match passes
      if (ageGroup === 'youth' && serviceAgeGroup === 'youth') return true;
      if (ageGroup === 'adult' && serviceAgeGroup === 'adult') return true;
      if (ageGroup === 'senior' && serviceAgeGroup === 'senior') return true;

      return false;  // Remove mismatches
    });

    if (filtered.length < before) {
      console.log(`[AgeFilter] High confidence ${ageGroup}: filtered ${before - filtered.length} services (${before} → ${filtered.length})`);
    }

    return filtered;
  }

  // Medium confidence: no filtering, handled by scoring penalties
  return services;
}
