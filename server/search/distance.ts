/**
 * Distance calculation utilities for location-based search.
 * Uses Haversine formula — no PostGIS needed for ~500 services.
 */

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/** Returns distance in kilometers between two lat/lng points. */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Rounds coordinates to 3 decimal places (~110m precision) for privacy. */
export function reduceCoordPrecision(val: number): number {
  return Math.round(val * 1000) / 1000;
}

/** Format distance for display: <1km shows meters, <10km shows 1 decimal, >10km rounds. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export interface ServiceWithCoords {
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Attach distanceKm to each service. Services without coords get null.
 * Returns a new array (does not mutate input).
 */
export function attachDistances<T extends ServiceWithCoords>(
  services: T[],
  userLat: number,
  userLng: number,
): (T & { distanceKm: number | null })[] {
  return services.map(svc => {
    const distanceKm =
      svc.latitude != null && svc.longitude != null
        ? haversineDistance(userLat, userLng, svc.latitude, svc.longitude)
        : null;
    return { ...svc, distanceKm };
  });
}

/**
 * Sort by distance ascending. Services without distance go to the end.
 */
export function sortByDistance<T extends { distanceKm?: number | null }>(
  services: T[],
): T[] {
  return [...services].sort((a, b) => {
    if (a.distanceKm == null && b.distanceKm == null) return 0;
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  });
}

/**
 * Filter out services beyond maxKm. Keeps services without coords (online/phone).
 */
export function filterByMaxDistance<T extends { distanceKm?: number | null }>(
  services: T[],
  maxKm: number,
): T[] {
  return services.filter(svc => svc.distanceKm == null || svc.distanceKm <= maxKm);
}
