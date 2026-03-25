/**
 * Hard Filters
 *
 * Pure filtering functions for search results.
 * These apply explicit UI constraints (e.g. gender filter dropdown),
 * not semantic boosts derived from query text.
 *
 * Include-compatible logic: null/untagged services always pass through.
 * Only services with a populated, incompatible tag are excluded.
 */

import type { LiteService } from './types';
import type { SearchFilters } from '@shared/routes';

export interface LocationFilterOpts {
  /** If true, skip location filtering entirely (crisis safety behavior). */
  skipAll?: boolean;
  /** Per-service bypass predicate. Services where this returns true bypass location filtering AND suppression. */
  skipForService?: (svc: LiteService) => boolean;
}

/**
 * Filter services by location.
 * When a user selects a city from the dropdown, exclude services clearly in other cities.
 * Services with province-wide, null/empty, online, or ambiguous locations pass through.
 *
 * @param opts.skipAll - If true, skip location filtering entirely (crisis safety).
 * @param opts.skipForService - Per-service bypass (used for indigenous services).
 */
export function filterByLocation(
  services: LiteService[],
  location: string | null | undefined,
  opts?: LocationFilterOpts,
): LiteService[] {
  // SAFETY: Never filter crisis results by location
  if (!location || opts?.skipAll) return services;

  // Split: bypassed services skip both location filtering and suppression
  const bypassed: LiteService[] = [];
  const rest: LiteService[] = [];
  if (opts?.skipForService) {
    for (const svc of services) {
      if (opts.skipForService(svc)) {
        bypassed.push(svc);
      } else {
        rest.push(svc);
      }
    }
  } else {
    rest.push(...services);
  }

  const loc = location.toLowerCase();
  const filtered = rest.filter(svc => {
    const svcLoc = (svc.location || '').toLowerCase().trim();
    if (!svcLoc) return true;
    if (svcLoc.includes(loc)) return true;
    if (svcLoc.includes('province-wide') || svcLoc.includes('alberta-wide') || svcLoc.includes('across alberta') || svcLoc.includes('canada-wide')) return true;
    if (svcLoc.includes('online') || svcLoc.includes('virtual') || svcLoc.includes('phone') || svcLoc.includes('telehealth')) return true;
    if (svcLoc === 'multiple locations') return true;
    return false;
  });

  const suppressed = suppressRedundantProvinceWide(filtered);
  return [...suppressed, ...bypassed];
}

const PROVINCE_WIDE_PATTERNS = ['province-wide', 'alberta-wide', 'across alberta'];
const TRAILING_LOCATION = /\s+(alberta|ab)$/i;

/**
 * Suppress province-wide services when a local counterpart is already in the results.
 * E.g., "Alcoholics Anonymous Alberta" is removed when "Alcoholics Anonymous Calgary" is present.
 * Matching: strip trailing "Alberta"/"AB" from the province-wide name, then check if any
 * non-province-wide service's name starts with that base name.
 */
function suppressRedundantProvinceWide(services: LiteService[]): LiteService[] {
  const isProvinceWide = (svc: LiteService) => {
    const loc = (svc.location || '').toLowerCase();
    return PROVINCE_WIDE_PATTERNS.some(p => loc.includes(p));
  };

  const provinceWide = services.filter(isProvinceWide);
  if (provinceWide.length === 0) return services;

  const local = services.filter(svc => !isProvinceWide(svc));
  if (local.length === 0) return services;

  const suppressed = new Set<string>();
  for (const pw of provinceWide) {
    const baseName = pw.name.replace(TRAILING_LOCATION, '').trim().toLowerCase();
    if (baseName.length < 3) continue; // safety: don't match on tiny base names
    if (local.some(l => l.name.toLowerCase().startsWith(baseName))) {
      suppressed.add(pw.id);
    }
  }

  if (suppressed.size === 0) return services;
  return services.filter(svc => !suppressed.has(svc.id));
}

export function applyHardFilters(services: LiteService[], filters: SearchFilters): LiteService[] {
  // Hoist category set outside loop — O(1) lookup per service instead of O(n)
  const cats = filters.categories?.length
    ? new Set(filters.categories.map(c => c.toLowerCase()))
    : null;

  return services.filter(svc => {
    // Categories: OR logic — service passes if its category matches ANY selected category
    if (cats && !cats.has(svc.category?.toLowerCase() ?? '')) return false;

    // Gender: exclude only the opposite restriction
    // Normalize DB values: "women" → "women_only", "men" → "men_only" (data inconsistency guard)
    if (filters.genderRestriction && filters.genderRestriction !== 'all') {
      let g = svc.genderRestriction;
      if (g === 'women') g = 'women_only';
      else if (g === 'men') g = 'men_only';
      if (g && g !== 'all' && g !== filters.genderRestriction) return false;
    }

    // Age: exclude incompatible age groups, keep null/all_ages/compatible
    if (filters.ageGroup && filters.ageGroup !== 'all_ages') {
      const a = svc.ageGroup;
      if (a && a !== 'all_ages') {
        if (a === 'youth_and_adult') {
          if (filters.ageGroup !== 'youth' && filters.ageGroup !== 'adult') return false;
        } else if (a !== filters.ageGroup) {
          return false;
        }
      }
    }

    // Service format: exclude only the opposite format, keep null and "both"
    // Normalize DB inconsistencies: "In-person"/"in-person"→"in_person", "virtual"→"online"
    if (filters.serviceFormat) {
      const rawF = svc.serviceFormat?.toLowerCase();
      const rawReq = filters.serviceFormat.toLowerCase();
      const normalize = (v: string) =>
        v.replace(/^in[- ]person$/i, 'in_person')
         .replace(/^virtual$/, 'online')
         .replace(/^hybrid$/, 'both')
         .replace(/^in_person_and_online$/, 'both');
      const f = rawF ? normalize(rawF) : rawF;
      const requested = normalize(rawReq);
      if (requested === 'both') {
        // "both" filter = no exclusion
      } else if (f && f !== requested && f !== 'both') {
        return false;
      }
    }

    // Languages: keep null/empty (untagged), only exclude populated arrays missing selected languages
    if (filters.languagesSupported && filters.languagesSupported.length > 0) {
      const svcLangs = svc.languagesSupported ?? [];
      if (svcLangs.length > 0 && !filters.languagesSupported.some(lang => svcLangs.includes(lang))) {
        return false;
      }
    }

    return true;
  });
}

