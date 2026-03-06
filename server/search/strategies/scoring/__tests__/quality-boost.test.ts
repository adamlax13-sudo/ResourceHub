import { describe, it, expect } from 'vitest';
import { applyDataQualityBoost } from '../quality-boost';
import type { LiteService } from '../../../types';

function makeSvc(overrides: Partial<LiteService> & { id: string }): LiteService {
  return {
    name: 'Test Service',
    category: 'Mental Health',
    description: 'A comprehensive mental health service providing counselling and support for individuals.',
    location: 'Calgary, AB',
    waitTimes: '',
    rrfScore: 1.0,
    ...overrides,
  };
}

describe('applyDataQualityBoost', () => {
  it('boosts high-confidence services above low-confidence ones at equal relevance', () => {
    const scores = new Map([['high', 90], ['low', 30]]);
    const results = [
      makeSvc({ id: 'low', rrfScore: 1.0 }),
      makeSvc({ id: 'high', rrfScore: 1.0 }),
    ];
    const boosted = applyDataQualityBoost(results, scores);
    expect(boosted[0].id).toBe('high');
  });

  it('does not remove any results — only reorders', () => {
    const scores = new Map([['a', 20], ['b', 95]]);
    const results = [
      makeSvc({ id: 'a' }),
      makeSvc({ id: 'b' }),
    ];
    const boosted = applyDataQualityBoost(results, scores);
    expect(boosted.length).toBe(2);
  });

  it('does not override large relevance differences', () => {
    const scores = new Map([['relevant', 30], ['quality', 95]]);
    const results = [
      makeSvc({ id: 'relevant', rrfScore: 2.0 }),
      makeSvc({ id: 'quality', rrfScore: 0.5 }),
    ];
    const boosted = applyDataQualityBoost(results, scores);
    expect(boosted[0].id).toBe('relevant');
  });

  it('uses description length as a quality signal', () => {
    const scores = new Map<string, number>();
    const results = [
      makeSvc({ id: 'short', description: 'Short.', rrfScore: 1.0 }),
      makeSvc({ id: 'rich', description: 'A detailed description with lots of useful information about the service, including hours, eligibility, and what to expect when you visit. This service provides comprehensive support.', rrfScore: 1.0 }),
    ];
    const boosted = applyDataQualityBoost(results, scores);
    expect(boosted[0].id).toBe('rich');
  });

  it('treats zero confidence as neutral (same as null)', () => {
    const scores = new Map([['zero', 0], ['low', 30]]);
    const results = [
      makeSvc({ id: 'zero', rrfScore: 1.0 }),
      makeSvc({ id: 'low', rrfScore: 1.0 }),
    ];
    const boosted = applyDataQualityBoost(results, scores);
    // Zero should NOT be penalized; low (30) gets a small penalty
    expect(boosted[0].id).toBe('zero');
  });

  it('treats missing confidence as neutral', () => {
    const scores = new Map<string, number>(); // empty map
    const results = [
      makeSvc({ id: 'unknown', rrfScore: 1.0 }),
      makeSvc({ id: 'known-low', rrfScore: 1.0 }),
    ];
    const scoresWithLow = new Map([['known-low', 30]]);
    const boosted = applyDataQualityBoost(results, scoresWithLow);
    expect(boosted[0].id).toBe('unknown');
  });

  it('returns empty array for empty input', () => {
    const result = applyDataQualityBoost([], new Map());
    expect(result).toEqual([]);
  });

  it('preserves pinned services (no rrfScore) at the top', () => {
    const scores = new Map([['regular', 90]]);
    const results = [
      makeSvc({ id: 'pinned-988', rrfScore: undefined as any }),
      makeSvc({ id: 'regular', rrfScore: 1.0 }),
      makeSvc({ id: 'another', rrfScore: 0.8 }),
    ];
    const boosted = applyDataQualityBoost(results, scores);
    expect(boosted[0].id).toBe('pinned-988');
    expect(boosted.length).toBe(3);
  });
});
