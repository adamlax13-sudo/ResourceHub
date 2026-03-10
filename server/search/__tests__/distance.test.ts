import { describe, it, expect } from 'vitest';
import {
  haversineDistance,
  reduceCoordPrecision,
  formatDistance,
  attachDistances,
  sortByDistance,
  filterByMaxDistance,
} from '../distance';

describe('haversineDistance', () => {
  it('returns ~300km for Calgary to Edmonton', () => {
    // Calgary: 51.0447, -114.0719  Edmonton: 53.5461, -113.4937
    const d = haversineDistance(51.0447, -114.0719, 53.5461, -113.4937);
    expect(d).toBeGreaterThan(270);
    expect(d).toBeLessThan(310);
  });

  it('returns 0 for same point', () => {
    expect(haversineDistance(51.0, -114.0, 51.0, -114.0)).toBe(0);
  });

  it('handles equator and prime meridian', () => {
    const d = haversineDistance(0, 0, 0, 1);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });

  it('handles antipodal points (~20000km)', () => {
    const d = haversineDistance(0, 0, 0, 180);
    expect(d).toBeGreaterThan(20000);
    expect(d).toBeLessThan(20100);
  });
});

describe('reduceCoordPrecision', () => {
  it('rounds to 3 decimal places', () => {
    expect(reduceCoordPrecision(51.04476)).toBe(51.045);
    expect(reduceCoordPrecision(-114.07190)).toBe(-114.072);
  });
});

describe('formatDistance', () => {
  it('shows meters under 1km', () => {
    expect(formatDistance(0.8)).toBe('800 m');
    expect(formatDistance(0.15)).toBe('150 m');
  });

  it('shows 1 decimal between 1-10km', () => {
    expect(formatDistance(3.24)).toBe('3.2 km');
    expect(formatDistance(9.99)).toBe('10.0 km');
  });

  it('drops decimal over 10km', () => {
    expect(formatDistance(15.7)).toBe('16 km');
    expect(formatDistance(300.1)).toBe('300 km');
  });
});

describe('attachDistances', () => {
  const services = [
    { id: 1, latitude: 51.0447, longitude: -114.0719 },
    { id: 2, latitude: null, longitude: null },
    { id: 3, latitude: 53.5461, longitude: -113.4937 },
  ];

  it('computes distance for services with coords', () => {
    const result = attachDistances(services, 51.0, -114.0);
    expect(result[0].distanceKm).toBeGreaterThan(0);
    expect(result[0].distanceKm).toBeLessThan(10);
    expect(result[2].distanceKm).toBeGreaterThan(270);
  });

  it('returns null for services without coords', () => {
    const result = attachDistances(services, 51.0, -114.0);
    expect(result[1].distanceKm).toBeNull();
  });

  it('does not mutate input', () => {
    const result = attachDistances(services, 51.0, -114.0);
    expect((services[0] as any).distanceKm).toBeUndefined();
    expect(result).not.toBe(services);
  });
});

describe('sortByDistance', () => {
  it('sorts ascending with nulls at end', () => {
    const input = [
      { id: 1, distanceKm: 50 },
      { id: 2, distanceKm: null },
      { id: 3, distanceKm: 5 },
    ];
    const sorted = sortByDistance(input);
    expect(sorted.map(s => s.id)).toEqual([3, 1, 2]);
  });
});

describe('filterByMaxDistance', () => {
  it('keeps services within range and null-distance services', () => {
    const input = [
      { id: 1, distanceKm: 5 },
      { id: 2, distanceKm: null },
      { id: 3, distanceKm: 50 },
    ];
    const filtered = filterByMaxDistance(input, 10);
    expect(filtered.map(s => s.id)).toEqual([1, 2]);
  });
});
