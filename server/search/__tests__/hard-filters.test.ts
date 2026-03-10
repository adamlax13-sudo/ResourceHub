import { describe, it, expect } from 'vitest';
import { applyHardFilters } from '../filters';
import type { LiteService } from '../types';
import type { SearchFilters } from '@shared/routes';

function makeSvc(overrides: Partial<LiteService> = {}): LiteService {
  return {
    id: '1', name: 'Test', category: 'Addiction', description: '',
    location: '', waitTimes: '',
    genderRestriction: null, ageGroup: null,
    serviceFormat: null, languagesSupported: null,
    ...overrides,
  };
}

describe('applyHardFilters', () => {
  describe('genderRestriction', () => {
    const menFilter: SearchFilters = { genderRestriction: 'men_only' };
    const womenFilter: SearchFilters = { genderRestriction: 'women_only' };

    it('keeps men_only services when filtering for men', () => {
      const svcs = [makeSvc({ id: '1', genderRestriction: 'men_only' })];
      expect(applyHardFilters(svcs, menFilter)).toHaveLength(1);
    });

    it('keeps null/untagged services when filtering for men', () => {
      const svcs = [makeSvc({ id: '1', genderRestriction: null })];
      expect(applyHardFilters(svcs, menFilter)).toHaveLength(1);
    });

    it('keeps "all" services when filtering for men', () => {
      const svcs = [makeSvc({ id: '1', genderRestriction: 'all' })];
      expect(applyHardFilters(svcs, menFilter)).toHaveLength(1);
    });

    it('removes women_only services when filtering for men', () => {
      const svcs = [makeSvc({ id: '1', genderRestriction: 'women_only' })];
      expect(applyHardFilters(svcs, menFilter)).toHaveLength(0);
    });

    it('removes men_only services when filtering for women', () => {
      const svcs = [makeSvc({ id: '1', genderRestriction: 'men_only' })];
      expect(applyHardFilters(svcs, womenFilter)).toHaveLength(0);
    });

    it('keeps women_only services when filtering for women', () => {
      const svcs = [makeSvc({ id: '1', genderRestriction: 'women_only' })];
      expect(applyHardFilters(svcs, womenFilter)).toHaveLength(1);
    });

    it('keeps "all" services when filtering for women', () => {
      const svcs = [makeSvc({ id: '1', genderRestriction: 'all' })];
      expect(applyHardFilters(svcs, womenFilter)).toHaveLength(1);
    });

    it('keeps null/untagged services when filtering for women', () => {
      const svcs = [makeSvc({ id: '1', genderRestriction: null })];
      expect(applyHardFilters(svcs, womenFilter)).toHaveLength(1);
    });
  });

  describe('ageGroup', () => {
    const youthFilter: SearchFilters = { ageGroup: 'youth' };
    const adultFilter: SearchFilters = { ageGroup: 'adult' };
    const seniorFilter: SearchFilters = { ageGroup: 'senior' };

    it('keeps youth services for youth filter', () => {
      const svcs = [makeSvc({ ageGroup: 'youth' })];
      expect(applyHardFilters(svcs, youthFilter)).toHaveLength(1);
    });

    it('keeps youth_and_adult for youth filter', () => {
      const svcs = [makeSvc({ ageGroup: 'youth_and_adult' })];
      expect(applyHardFilters(svcs, youthFilter)).toHaveLength(1);
    });

    it('keeps null/untagged for youth filter', () => {
      const svcs = [makeSvc({ ageGroup: null })];
      expect(applyHardFilters(svcs, youthFilter)).toHaveLength(1);
    });

    it('keeps all_ages for youth filter', () => {
      const svcs = [makeSvc({ ageGroup: 'all_ages' })];
      expect(applyHardFilters(svcs, youthFilter)).toHaveLength(1);
    });

    it('removes senior-only for youth filter', () => {
      const svcs = [makeSvc({ ageGroup: 'senior' })];
      expect(applyHardFilters(svcs, youthFilter)).toHaveLength(0);
    });

    it('removes adult-only for youth filter', () => {
      const svcs = [makeSvc({ ageGroup: 'adult' })];
      expect(applyHardFilters(svcs, youthFilter)).toHaveLength(0);
    });

    it('keeps youth_and_adult for adult filter', () => {
      const svcs = [makeSvc({ ageGroup: 'youth_and_adult' })];
      expect(applyHardFilters(svcs, adultFilter)).toHaveLength(1);
    });

    it('removes youth_and_adult for senior filter', () => {
      const svcs = [makeSvc({ ageGroup: 'youth_and_adult' })];
      expect(applyHardFilters(svcs, seniorFilter)).toHaveLength(0);
    });
  });

  describe('serviceFormat', () => {
    const inPersonFilter: SearchFilters = { serviceFormat: 'in-person' };
    const onlineFilter: SearchFilters = { serviceFormat: 'online' };
    const bothFilter: SearchFilters = { serviceFormat: 'both' };

    it('keeps in-person for in-person filter', () => {
      const svcs = [makeSvc({ serviceFormat: 'in-person' })];
      expect(applyHardFilters(svcs, inPersonFilter)).toHaveLength(1);
    });

    it('keeps "both" for in-person filter', () => {
      const svcs = [makeSvc({ serviceFormat: 'both' })];
      expect(applyHardFilters(svcs, inPersonFilter)).toHaveLength(1);
    });

    it('keeps null/untagged for in-person filter', () => {
      const svcs = [makeSvc({ serviceFormat: null })];
      expect(applyHardFilters(svcs, inPersonFilter)).toHaveLength(1);
    });

    it('removes online-only for in-person filter', () => {
      const svcs = [makeSvc({ serviceFormat: 'online' })];
      expect(applyHardFilters(svcs, inPersonFilter)).toHaveLength(0);
    });

    it('removes in-person for online filter', () => {
      const svcs = [makeSvc({ serviceFormat: 'in-person' })];
      expect(applyHardFilters(svcs, onlineFilter)).toHaveLength(0);
    });

    it('keeps everything for "both" filter', () => {
      const svcs = [
        makeSvc({ id: '1', serviceFormat: 'in-person' }),
        makeSvc({ id: '2', serviceFormat: 'online' }),
        makeSvc({ id: '3', serviceFormat: null }),
      ];
      expect(applyHardFilters(svcs, bothFilter)).toHaveLength(3);
    });
  });

  describe('languagesSupported', () => {
    const frenchFilter: SearchFilters = { languagesSupported: ['French'] };

    it('keeps services that include the selected language', () => {
      const svcs = [makeSvc({ languagesSupported: ['English', 'French'] })];
      expect(applyHardFilters(svcs, frenchFilter)).toHaveLength(1);
    });

    it('keeps services with null/empty languages (untagged)', () => {
      const svcs = [makeSvc({ languagesSupported: null })];
      expect(applyHardFilters(svcs, frenchFilter)).toHaveLength(1);
    });

    it('keeps services with empty array languages', () => {
      const svcs = [makeSvc({ languagesSupported: [] })];
      expect(applyHardFilters(svcs, frenchFilter)).toHaveLength(1);
    });

    it('removes services with populated array that lacks selected language', () => {
      const svcs = [makeSvc({ languagesSupported: ['English'] })];
      expect(applyHardFilters(svcs, frenchFilter)).toHaveLength(0);
    });
  });

  describe('categories', () => {
    it('keeps services matching a single selected category', () => {
      const svcs = [
        makeSvc({ id: '1', category: 'Mental Health & Counselling' }),
        makeSvc({ id: '2', category: 'Addiction Treatment' }),
      ];
      const result = applyHardFilters(svcs, { categories: ['Mental Health & Counselling'] });
      expect(result.map(s => s.id)).toEqual(['1']);
    });

    it('keeps services matching any selected category (OR logic)', () => {
      const svcs = [
        makeSvc({ id: '1', category: 'Mental Health & Counselling' }),
        makeSvc({ id: '2', category: 'Addiction Treatment' }),
        makeSvc({ id: '3', category: 'Housing' }),
      ];
      const result = applyHardFilters(svcs, { categories: ['Mental Health & Counselling', 'Addiction Treatment'] });
      expect(result.map(s => s.id)).toEqual(['1', '2']);
    });

    it('matches categories case-insensitively', () => {
      const svcs = [makeSvc({ id: '1', category: 'Mental Health & Counselling' })];
      const result = applyHardFilters(svcs, { categories: ['mental health & counselling'] });
      expect(result).toHaveLength(1);
    });

    it('does not filter when categories is undefined', () => {
      const svcs = [makeSvc({ id: '1' }), makeSvc({ id: '2' })];
      expect(applyHardFilters(svcs, {})).toHaveLength(2);
    });

    it('does not filter when categories is empty array', () => {
      const svcs = [makeSvc({ id: '1' }), makeSvc({ id: '2' })];
      expect(applyHardFilters(svcs, { categories: [] })).toHaveLength(2);
    });

    it('excludes services not in selected categories', () => {
      const svcs = [
        makeSvc({ id: '1', category: 'Housing' }),
        makeSvc({ id: '2', category: 'Food Banks & Meals' }),
      ];
      const result = applyHardFilters(svcs, { categories: ['Crisis Services'] });
      expect(result).toHaveLength(0);
    });
  });

  describe('combined filters', () => {
    it('applies men + youth together correctly', () => {
      const filters: SearchFilters = { genderRestriction: 'men_only', ageGroup: 'youth' };
      const svcs = [
        makeSvc({ id: '1', genderRestriction: 'men_only', ageGroup: 'youth' }),
        makeSvc({ id: '2', genderRestriction: null, ageGroup: null }),
        makeSvc({ id: '3', genderRestriction: 'women_only', ageGroup: 'youth' }),
        makeSvc({ id: '4', genderRestriction: 'men_only', ageGroup: 'senior' }),
      ];
      const result = applyHardFilters(svcs, filters);
      expect(result.map(s => s.id)).toEqual(['1', '2']);
    });

    it('applies categories + gender together correctly', () => {
      const filters: SearchFilters = { categories: ['Mental Health & Counselling'], genderRestriction: 'women_only' };
      const svcs = [
        makeSvc({ id: '1', category: 'Mental Health & Counselling', genderRestriction: 'women_only' }),
        makeSvc({ id: '2', category: 'Mental Health & Counselling', genderRestriction: 'men_only' }),
        makeSvc({ id: '3', category: 'Addiction Treatment', genderRestriction: 'women_only' }),
        makeSvc({ id: '4', category: 'Mental Health & Counselling', genderRestriction: null }),
      ];
      const result = applyHardFilters(svcs, filters);
      expect(result.map(s => s.id)).toEqual(['1', '4']);
    });
  });
});
