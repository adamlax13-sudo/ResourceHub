/**
 * Scoring Sensitivity Tests
 *
 * Measures the impact of each scoring module on result ordering.
 * For each module, we run a set of services through the module and check
 * how many services change position or score. This tells us which modules
 * are load-bearing vs. decorative.
 *
 * These are unit tests — no DB or API calls required.
 */

import { describe, it, expect } from 'vitest';
import { applySubIntentBoost } from '../sub-intent-boost';
import { applyDataQualityBoost } from '../quality-boost';
import { applyPreferenceBoosts } from '../preference-boost';
import { applyFilterMatchBoosts } from '../filter-match-boost';
import type { LiteService } from '../../../types';
import type { SearchFilters } from '@shared/routes';

// Generate a realistic set of services with varying scores and categories
function makeTestServices(): LiteService[] {
  const categories = [
    'Addiction Treatment', 'Mental Health & Counselling', 'Emergency Shelter',
    'Food Banks & Meals', 'Domestic Violence Support', 'Gambling Support',
    'Harm Reduction', 'Residential Treatment', 'Youth Services',
    'Healthcare Access', 'Legal Aid', 'Employment Services',
    'Indigenous Services', 'Recovery & Peer Support', 'Crisis Services',
  ];
  return categories.map((cat, i) => ({
    id: String(i + 1),
    name: `Test ${cat} Service`,
    category: cat,
    description: `A test service for ${cat.toLowerCase()} in Calgary`,
    location: 'Calgary',
    waitTimes: '',
    rrfScore: 50 - i * 2, // descending scores: 50, 48, 46, ...
    genderRestriction: null,
    ageGroup: null,
    isFaithBased: i === 3 ? true : null, // one faith-based service
    is12Step: i === 0 ? true : null,      // one 12-step service
    serviceFormat: i === 2 ? 'walk_in' : null,
    languagesSupported: i === 5 ? ['en', 'fr'] : null,
  }));
}

function getTop5Ids(services: LiteService[]): string[] {
  return [...services]
    .sort((a, b) => (b.rrfScore ?? 0) - (a.rrfScore ?? 0))
    .slice(0, 5)
    .map(s => s.id);
}

function countReordered(before: LiteService[], after: LiteService[]): number {
  const beforeIds = getTop5Ids(before);
  const afterIds = getTop5Ids(after);
  let changed = 0;
  for (let i = 0; i < 5; i++) {
    if (beforeIds[i] !== afterIds[i]) changed++;
  }
  return changed;
}

function countScoreChanges(before: LiteService[], after: LiteService[]): number {
  let changed = 0;
  for (let i = 0; i < before.length; i++) {
    if ((before[i].rrfScore ?? 0) !== (after[i].rrfScore ?? 0)) changed++;
  }
  return changed;
}

describe('Scoring module sensitivity analysis', () => {
  describe('sub-intent boost', () => {
    it('affects services when gambling sub-intent is active', () => {
      const services = makeTestServices();
      const result = applySubIntentBoost(services, ['substance_abuse.gambling']);
      const changes = countScoreChanges(services, result);
      // Gambling Support (id=6) should be boosted
      expect(changes).toBeGreaterThan(0);
      const gamblingBefore = services.find(s => s.category === 'Gambling Support')!;
      const gamblingAfter = result.find(s => s.category === 'Gambling Support')!;
      expect(gamblingAfter.rrfScore!).toBeGreaterThan(gamblingBefore.rrfScore!);
    });

    it('is a no-op when no sub-intents are active', () => {
      const services = makeTestServices();
      const result = applySubIntentBoost(services, []);
      const changes = countScoreChanges(services, result);
      expect(changes).toBe(0);
    });

    it('does not change top-5 ordering for unrelated sub-intents', () => {
      const services = makeTestServices();
      // basic_needs.pet_support is unlikely to match any of our test categories
      const result = applySubIntentBoost(services, ['basic_needs.pet_support']);
      const reordered = countReordered(services, result);
      expect(reordered).toBe(0);
    });
  });

  describe('data quality boost', () => {
    it('differentiates services by confidence score', () => {
      const services = makeTestServices();
      // Simulate confidence scores: give low-ranked services high confidence
      const confScores = new Map<string, number>();
      services.forEach((s, i) => {
        confScores.set(s.id, i < 5 ? 30 : 95); // top 5 low confidence, rest high
      });
      const result = applyDataQualityBoost(services, confScores);
      const changes = countScoreChanges(services, result);
      expect(changes).toBeGreaterThan(0);
    });

    it('is neutral when all services have equal confidence', () => {
      const services = makeTestServices();
      const confScores = new Map<string, number>();
      services.forEach(s => confScores.set(s.id, 80));
      const result = applyDataQualityBoost(services, confScores);
      // All services get the same boost factor, so relative ordering is preserved
      const reordered = countReordered(services, result);
      expect(reordered).toBe(0);
    });
  });

  describe('preference boost', () => {
    it('boosts faith-based services when preference is active', () => {
      const services = makeTestServices();
      const filters: SearchFilters = { isFaithBased: true };
      const result = applyPreferenceBoosts(services, filters);
      const faithBefore = services.find(s => s.isFaithBased)!;
      const faithAfter = result.find(s => s.isFaithBased)!;
      expect(faithAfter.rrfScore!).toBeGreaterThan(faithBefore.rrfScore!);
    });

    it('is a no-op when no preferences are set', () => {
      const services = makeTestServices();
      const result = applyPreferenceBoosts(services, {});
      const changes = countScoreChanges(services, result);
      expect(changes).toBe(0);
    });
  });

  describe('filter-match boost', () => {
    it('boosts services matching serviceFormat filter', () => {
      const services = makeTestServices();
      const filters: SearchFilters = { serviceFormat: 'walk_in' };
      const result = applyFilterMatchBoosts(services, filters);
      const walkInBefore = services.find(s => s.serviceFormat === 'walk_in')!;
      const walkInAfter = result.find(s => s.serviceFormat === 'walk_in')!;
      expect(walkInAfter.rrfScore!).toBeGreaterThan(walkInBefore.rrfScore!);
    });

    it('is a no-op when no filters are set', () => {
      const services = makeTestServices();
      const result = applyFilterMatchBoosts(services, {});
      const changes = countScoreChanges(services, result);
      expect(changes).toBe(0);
    });
  });

  describe('module impact summary', () => {
    it('sub-intent boost promotes gambling service into top-5', () => {
      const services = makeTestServices();

      // Sub-intent: should promote Gambling Support (id=6, initial rank #6) into top 5
      const withSubIntent = applySubIntentBoost(services, ['substance_abuse.gambling']);
      const subIntentReorder = countReordered(services, withSubIntent);

      // Gambling Support should have moved up
      expect(subIntentReorder).toBeGreaterThan(0);

      // Verify the gambling service specifically got boosted
      const gamblingAfter = withSubIntent.find(s => s.category === 'Gambling Support')!;
      const gamblingBefore = services.find(s => s.category === 'Gambling Support')!;
      expect(gamblingAfter.rrfScore!).toBeGreaterThan(gamblingBefore.rrfScore!);
    });

    it('quality boost with divergent confidence reshuffles results', () => {
      const services = makeTestServices();

      // Give bottom-ranked services high confidence, top-ranked low
      const confScores = new Map<string, number>();
      services.forEach((s, i) => confScores.set(s.id, i < 5 ? 20 : 95));
      const withQuality = applyDataQualityBoost(services, confScores);
      const qualityChanges = countScoreChanges(services, withQuality);

      // All services should have changed scores (different confidence levels)
      expect(qualityChanges).toBeGreaterThan(0);
    });
  });
});
