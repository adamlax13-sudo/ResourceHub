import { describe, it, expect } from 'vitest';
import { applyFilterMatchBoosts } from '../filter-match-boost';
import type { LiteService } from '../../../types';
import type { SearchFilters } from '@shared/routes';

function makeSvc(overrides: Partial<LiteService> & { rrfScore: number }): LiteService {
  return {
    id: '1', name: 'Test', category: 'Addiction', description: '',
    location: '', waitTimes: '',
    genderRestriction: null, ageGroup: null,
    serviceFormat: null, languagesSupported: null,
    ...overrides,
  };
}

describe('applyFilterMatchBoosts', () => {
  it('boosts explicit gender match above untagged', () => {
    const filters: SearchFilters = { genderRestriction: 'men_only' };
    const svcs = [
      makeSvc({ id: '1', genderRestriction: null, rrfScore: 100 }),
      makeSvc({ id: '2', genderRestriction: 'men_only', rrfScore: 100 }),
    ];
    const result = applyFilterMatchBoosts(svcs, filters);
    const menSvc = result.find(s => s.id === '2')!;
    const nullSvc = result.find(s => s.id === '1')!;
    expect(menSvc.rrfScore).toBeGreaterThan(nullSvc.rrfScore!);
  });

  it('does not change scores when no filter-relevant fields active', () => {
    const filters: SearchFilters = { category: 'Addiction' };
    const svcs = [makeSvc({ id: '1', rrfScore: 100 })];
    const result = applyFilterMatchBoosts(svcs, filters);
    expect(result[0].rrfScore).toBe(100);
  });

  it('stacks multiple filter boosts', () => {
    const filters: SearchFilters = { genderRestriction: 'men_only', ageGroup: 'youth' };
    const svcs = [
      makeSvc({ id: '1', genderRestriction: 'men_only', ageGroup: 'youth', rrfScore: 100 }),
      makeSvc({ id: '2', genderRestriction: null, ageGroup: null, rrfScore: 100 }),
    ];
    const result = applyFilterMatchBoosts(svcs, filters);
    const bothMatch = result.find(s => s.id === '1')!;
    const noMatch = result.find(s => s.id === '2')!;
    expect(bothMatch.rrfScore).toBeGreaterThan(noMatch.rrfScore! * 1.2);
  });

  it('re-sorts by rrfScore descending', () => {
    const filters: SearchFilters = { genderRestriction: 'men_only' };
    const svcs = [
      makeSvc({ id: '1', genderRestriction: null, rrfScore: 110 }),
      makeSvc({ id: '2', genderRestriction: 'men_only', rrfScore: 100 }),
    ];
    const result = applyFilterMatchBoosts(svcs, filters);
    expect(result[0].id).toBe('2');
  });
});
