/**
 * Crisis Service Handling
 *
 * Single place for all 988 crisis helpline pinning logic.
 * This consolidates what was previously duplicated in 4 different places.
 */

import { SEARCH_CONFIG } from './config';
import type { LiteService, FullService } from './types';
import type { Service } from '@shared/schema';

/**
 * Pin the 988 crisis service to the top of search results.
 * Modifies the array in place.
 *
 * @param services - Array of services to modify
 * @returns The modified array with 988 at the top
 */
export function pinCrisisService(services: LiteService[]): LiteService[] {
  const config = SEARCH_CONFIG.crisis;

  // Remove any existing 988 entries to avoid duplicates
  const filtered = services.filter(s =>
    !s.id?.includes('988') && !s.name?.toLowerCase().includes('988')
  );

  // Prepend the pinned crisis service
  filtered.unshift({ ...config.pinnedServiceLite } as LiteService);

  // Update the original array in place
  services.length = 0;
  services.push(...filtered);

  return services;
}

/**
 * Get the full 988 crisis service details
 */
export function getCrisisServiceFull(): FullService {
  const config = SEARCH_CONFIG.crisis.pinnedServiceFull;
  return {
    id: config.id,
    name: config.name,
    category: config.category,
    description: config.description,
    location: config.location,
    contact: config.contact,
    websiteUrl: config.websiteUrl,
    eligibility: config.eligibility,
    process: [...config.process],
    waitTimes: config.waitTimes,
    requiredDocs: [...config.requiredDocs],
    phone: config.phone,
    email: config.email,
    address: config.address,
  };
}

/**
 * Get the lite 988 crisis service for search results
 */
export function getCrisisServiceLite(): LiteService {
  return SEARCH_CONFIG.crisis.pinnedServiceLite as LiteService;
}

/**
 * Check if a service ID is the crisis service
 */
export function isCrisisServiceId(serviceId: string): boolean {
  return serviceId === SEARCH_CONFIG.crisis.pinnedServiceId;
}

/**
 * Detect if a query is crisis-related.
 * Checks both explicit keywords AND implicit patterns.
 */
export function isCrisisQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return SEARCH_CONFIG.crisis.keywords.some(keyword =>
    lower.includes(keyword)
  ) || SEARCH_CONFIG.crisis.implicitPatterns.some(pattern =>
    pattern.test(lower)
  );
}

// Categories that represent immediate crisis resources, ordered by priority.
// "Crisis Lines" (phone hotlines) first, then "Crisis Services" (response teams),
// then emergency shelters and domestic violence support.
const CRISIS_CATEGORY_PRIORITY: string[] = [
  'crisis lines',
  'crisis services',
  'domestic violence support',
  'emergency shelter',
];

/**
 * Check if a service category is crisis-related.
 */
function getCrisisCategoryRank(category: string): number {
  const lower = category.toLowerCase();
  for (let i = 0; i < CRISIS_CATEGORY_PRIORITY.length; i++) {
    if (lower.includes(CRISIS_CATEGORY_PRIORITY[i])) return i;
  }
  return -1;
}

/**
 * Filter results to ONLY crisis hotlines.
 * For crisis queries, users in distress need phone/text/chat numbers to call NOW —
 * not crisis nurseries, weather response teams, or DV intervention services.
 *
 * Keeps: 988 pinned service + "Crisis Lines" category ONLY.
 * Removes: everything else (including "Crisis Services" — too broad, includes nurseries etc.).
 *
 * Modifies the array in place.
 */
export function filterToCrisisOnly(services: LiteService[]): LiteService[] {
  if (services.length <= 1) return services;

  // Separate the pinned 988 service (index 0) from the rest
  const pinned = services[0];
  const isPinned988 = pinned.id?.includes('988');
  const rest = isPinned988 ? services.slice(1) : services;

  // Keep "Crisis Lines" category + any service with hotline-indicating name
  // (safety net for miscategorized crisis lines like "Distress Line (CMHA)")
  const crisisLines: LiteService[] = [];
  for (const svc of rest) {
    const cat = (svc.category || '').toLowerCase();
    const name = (svc.name || '').toLowerCase();
    if (
      cat.includes('crisis lines') ||
      (cat.includes('crisis') && /\b(line|helpline|hotline|distress)\b/.test(name))
    ) {
      crisisLines.push(svc);
    }
  }

  // Reassemble: pinned 988 → Crisis Lines only
  services.length = 0;
  if (isPinned988) services.push(pinned);
  services.push(...crisisLines);

  const droppedCount = rest.length - crisisLines.length;
  if (droppedCount > 0) {
    console.log(`[CrisisFilter] Filtered to crisis lines only: kept ${services.length}, dropped ${droppedCount} non-hotline services`);
  }

  return services;
}

/**
 * Reorder search results so crisis-category services appear first.
 * Services are grouped: Crisis Lines → Crisis Services → Domestic Violence → Emergency Shelter → rest.
 * Within each group the original relevance order is preserved.
 * The 988 pinned service (index 0) is left in place.
 *
 * Modifies the array in place.
 */
export function boostCrisisServices(services: LiteService[]): LiteService[] {
  if (services.length <= 1) return services;

  // Keep 988 pinned at index 0 (it was already placed there by pinCrisisService)
  const pinned = services[0];
  if (!pinned.id?.includes('988')) {
    console.warn('[CrisisBoost] Expected 988 at index 0 but got:', pinned.id);
    return services;
  }
  const rest = services.slice(1);

  // Partition into crisis-category and non-crisis
  const crisisGroups: LiteService[][] = CRISIS_CATEGORY_PRIORITY.map(() => []);
  const nonCrisis: LiteService[] = [];

  for (const svc of rest) {
    const rank = getCrisisCategoryRank(svc.category || '');
    if (rank >= 0) {
      crisisGroups[rank].push(svc);
    } else {
      nonCrisis.push(svc);
    }
  }

  // Reassemble: pinned 988 → crisis groups in priority order → everything else
  services.length = 0;
  services.push(pinned);
  for (const group of crisisGroups) {
    services.push(...group);
  }
  services.push(...nonCrisis);

  return services;
}

/**
 * Build crisis-only results from DB Crisis Lines.
 * For crisis queries, we don't rely on search relevance — we show ALL crisis hotlines.
 * Returns: pinned 988 + all Crisis Lines from the database, sorted by location relevance.
 *
 * Sort order: local city match → province-wide → Canada-wide → other cities.
 */
export function buildCrisisResults(dbCrisisLines: Service[], userLocation: string | null): LiteService[] {
  const config = SEARCH_CONFIG.crisis;
  const results: LiteService[] = [];

  // Pin 988 first
  results.push({ ...config.pinnedServiceLite } as LiteService);

  // Convert DB services to LiteService (skip 988 since it's already pinned)
  const lines: LiteService[] = [];
  for (const s of dbCrisisLines) {
    if (s.serviceId.includes('988') || s.name?.toLowerCase().includes('988')) continue;
    lines.push({
      id: s.serviceId,
      name: s.name || '',
      category: s.category || '',
      description: s.description || '',
      location: s.location || '',
      waitTimes: s.waitTimes || '',
      phone: s.phone || undefined,
      is24_7: s.is24_7 ?? undefined,
    });
  }

  // Sort by location relevance
  const loc = (userLocation || '').toLowerCase();
  lines.sort((a, b) => locationRank(a.location, loc) - locationRank(b.location, loc));

  results.push(...lines);
  console.log(`[CrisisResults] Built crisis results: ${results.length} services (988 + ${lines.length} crisis lines, location: ${userLocation || 'none'})`);
  return results;
}

/** Rank a service location relative to the user's selected city. Lower = better. */
function locationRank(serviceLocation: string, userCity: string): number {
  const loc = serviceLocation.toLowerCase();
  // City match (e.g., "Calgary" in "Calgary" or in service name/location)
  if (userCity && loc.includes(userCity)) return 0;
  // Province-wide
  if (loc.includes('alberta') && !loc.includes('edmonton') && !loc.includes('calgary') && !loc.includes('lethbridge') && !loc.includes('red deer')) return 1;
  // Canada-wide
  if (loc.includes('canada')) return 2;
  // Other specific city
  return 3;
}
