/**
 * Client-side reverse geocoding: find the nearest Alberta city from GPS coordinates.
 * Uses a static lookup table — no API call needed.
 */

interface CityCoord {
  name: string;     // matches ALBERTA_LOCATIONS value in Hero.tsx
  lat: number;
  lng: number;
}

const ALBERTA_CITIES: CityCoord[] = [
  { name: 'calgary', lat: 51.0447, lng: -114.0719 },
  { name: 'edmonton', lat: 53.5461, lng: -113.4937 },
  { name: 'red deer', lat: 52.2681, lng: -113.8112 },
  { name: 'lethbridge', lat: 49.6935, lng: -112.8418 },
  { name: 'medicine hat', lat: 50.0405, lng: -110.6764 },
  { name: 'grande prairie', lat: 55.1707, lng: -118.7946 },
  { name: 'fort mcmurray', lat: 56.7264, lng: -111.3803 },
  { name: 'airdrie', lat: 51.2917, lng: -114.0144 },
  { name: 'st albert', lat: 53.6301, lng: -113.6263 },
  { name: 'spruce grove', lat: 53.5451, lng: -113.9009 },
  { name: 'leduc', lat: 53.2594, lng: -113.5493 },
  { name: 'okotoks', lat: 50.7286, lng: -113.9811 },
  { name: 'cochrane', lat: 51.1893, lng: -114.4700 },
  { name: 'sherwood park', lat: 53.5232, lng: -113.3151 },
  { name: 'fort saskatchewan', lat: 53.7122, lng: -113.2133 },
  { name: 'camrose', lat: 53.0168, lng: -112.8341 },
  { name: 'lloydminster', lat: 53.2780, lng: -110.0050 },
  { name: 'cold lake', lat: 54.4642, lng: -110.1832 },
  { name: 'brooks', lat: 50.5642, lng: -111.8989 },
  { name: 'canmore', lat: 51.0884, lng: -115.3579 },
  { name: 'banff', lat: 51.1784, lng: -115.5708 },
];

// Max distance in km to snap to a city — beyond this, fall back to "All of Alberta"
const MAX_SNAP_DISTANCE_KM = 50;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Returns the nearest Alberta city name (matching ALBERTA_LOCATIONS values),
 * or '' (empty = "All of Alberta") if the user is >50km from any known city.
 */
export function nearestCity(lat: number, lng: number): string {
  let best = '';
  let bestDist = MAX_SNAP_DISTANCE_KM;

  for (const city of ALBERTA_CITIES) {
    const d = haversineKm(lat, lng, city.lat, city.lng);
    if (d < bestDist) {
      bestDist = d;
      best = city.name;
    }
  }

  return best;
}
