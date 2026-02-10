/**
 * Crisis Service Handling
 *
 * Single place for all 988 crisis helpline pinning logic.
 * This consolidates what was previously duplicated in 4 different places.
 */

import { SEARCH_CONFIG } from './config';
import type { LiteService, FullService } from './types';

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
  filtered.unshift(config.pinnedServiceLite as LiteService);

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
 * Detect if a query is crisis-related
 */
export function isCrisisQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return SEARCH_CONFIG.crisis.keywords.some(keyword =>
    lower.includes(keyword)
  );
}
