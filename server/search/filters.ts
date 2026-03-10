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

/**
 * Filter services by location.
 * When a user selects a city from the dropdown, exclude services clearly in other cities.
 * Services with province-wide, null/empty, online, or ambiguous locations pass through.
 *
 * @param isCrisis - If true, skip location filtering entirely. Crisis services (988, distress lines)
 *   must ALWAYS be shown regardless of location filter — this is a life-safety requirement.
 */
export function filterByLocation(services: LiteService[], location: string | null | undefined, isCrisis?: boolean): LiteService[] {
  // SAFETY: Never filter crisis results by location — someone in crisis needs 988 and hotlines
  // regardless of what city they selected in the dropdown
  if (!location || isCrisis) return services;
  const loc = location.toLowerCase();
  const filtered = services.filter(svc => {
    const svcLoc = (svc.location || '').toLowerCase().trim();
    // No location data → could be available anywhere → keep
    if (!svcLoc) return true;
    // Contains the specified city → keep
    if (svcLoc.includes(loc)) return true;
    // Province-wide / Alberta-wide / Canada-wide → keep
    // Must distinguish "Alberta-wide" from "Fort McMurray, Alberta T9H" (just a province in address)
    if (svcLoc.includes('province-wide') || svcLoc.includes('alberta-wide') || svcLoc.includes('across alberta') || svcLoc.includes('canada-wide')) return true;
    // Online/virtual/phone services → keep
    if (svcLoc.includes('online') || svcLoc.includes('virtual') || svcLoc.includes('phone') || svcLoc.includes('telehealth')) return true;
    // Bare "Multiple locations" with no city qualifier → could include any city → keep
    if (svcLoc === 'multiple locations') return true;
    // Everything else is clearly in a different city → exclude
    return false;
  });
  return suppressRedundantProvinceWide(filtered);
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
    if (filters.genderRestriction && filters.genderRestriction !== 'all') {
      const g = svc.genderRestriction;
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
    if (filters.serviceFormat) {
      const f = svc.serviceFormat?.toLowerCase();
      const requested = filters.serviceFormat.toLowerCase();
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
