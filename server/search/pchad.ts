/**
 * PCHAD (Protection of Children Abusing Drugs) Service Handling
 *
 * Similar to crisis pinning - when a parent/guardian is searching for help
 * with their child's substance abuse, PCHAD should be prioritized.
 * PCHAD is an Alberta program that allows parents to get help for minors
 * struggling with addiction.
 */

import { SEARCH_CONFIG } from './config';
import type { LiteService, FullService } from './types';

/**
 * Detect if a query is about a child/youth with substance abuse issues
 * Returns true if the query indicates a parent/guardian seeking help for their child's addiction
 */
export function isPchadQuery(query: string): boolean {
  const lower = query.toLowerCase();
  const patterns = SEARCH_CONFIG.pchad.patterns;

  return patterns.some(pattern => pattern.test(lower));
}

/**
 * Pin the PCHAD service to the top of search results.
 * Modifies the array in place.
 *
 * @param services - Array of services to modify
 * @returns The modified array with PCHAD at the top
 */
export function pinPchadService(services: LiteService[]): LiteService[] {
  const config = SEARCH_CONFIG.pchad;

  // Remove any existing PCHAD entries to avoid duplicates
  const filtered = services.filter(s =>
    !s.id?.toLowerCase().includes('pchad') &&
    !s.name?.toLowerCase().includes('pchad') &&
    !s.name?.toLowerCase().includes('protection of children abusing drugs')
  );

  // Prepend the pinned PCHAD service
  filtered.unshift({ ...config.pinnedServiceLite } as LiteService);

  // Update the original array in place
  services.length = 0;
  services.push(...filtered);

  return services;
}

/**
 * Get the full PCHAD service details
 */
export function getPchadServiceFull(): FullService {
  const config = SEARCH_CONFIG.pchad.pinnedServiceFull;
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
 * Check if a service ID is the PCHAD service
 */
export function isPchadServiceId(serviceId: string): boolean {
  return serviceId === SEARCH_CONFIG.pchad.pinnedServiceId;
}
