/**
 * Click-Affinity Boost
 *
 * Applies a small multiplicative boost (1.1x-1.3x) to services that users
 * have historically clicked/upvoted for similar queries.
 *
 * Data comes from the query_service_affinities table, computed weekly
 * by scripts/compute-click-affinities.mjs.
 */

import type { LiteService } from '../../types';
import { LRUCache } from 'lru-cache';
import { storage } from '../../../storage';

// Cache affinity lookups to avoid repeated DB queries
const affinityCache = new LRUCache<string, Map<string, number>>({
  max: 500,
  ttl: 1000 * 60 * 60, // 1 hour
});

// Max boost to prevent any single service from dominating
const MAX_BOOST = 1.3;
const MIN_BOOST = 1.0;

/**
 * Apply click-affinity boost to services based on historical user behavior.
 * Services with high affinity for this query get a small score multiplier.
 */
export async function applyClickAffinityBoost(
  services: LiteService[],
  normalizedQuery: string
): Promise<LiteService[]> {
  if (!normalizedQuery || services.length === 0) return services;

  try {
    // Check cache first
    let affinityMap = affinityCache.get(normalizedQuery);

    if (!affinityMap) {
      // Query database for affinities
      const affinities = await storage.getQueryAffinities(normalizedQuery);
      affinityMap = new Map<string, number>();
      for (const a of affinities) {
        // Combined score: 70% click, 30% vote (clicks are more reliable signal)
        const combined = (a.clickScore ?? 0) * 0.7 + (a.voteScore ?? 0) * 0.3;
        affinityMap.set(a.serviceId, combined);
      }
      affinityCache.set(normalizedQuery, affinityMap);
    }

    // No affinity data for this query
    if (affinityMap.size === 0) return services;

    // Apply boost
    let boostedCount = 0;
    const result = services.map(svc => {
      const serviceId = String(svc.id);
      const affinity = affinityMap!.get(serviceId);
      if (affinity && affinity > 0) {
        const boost = Math.min(MAX_BOOST, MIN_BOOST + affinity * 0.3);
        boostedCount++;
        return { ...svc, rrfScore: (svc.rrfScore ?? 50) * boost };
      }
      return svc;
    });

    if (boostedCount > 0) {
      console.log(`[ClickAffinity] Boosted ${boostedCount} services for "${normalizedQuery.substring(0, 20)}..."`);
    }

    return result;
  } catch {
    // Silently fall through — affinity data is a nice-to-have
    return services;
  }
}
