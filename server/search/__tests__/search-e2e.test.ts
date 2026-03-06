/**
 * E2E Search Pipeline Integration Tests
 *
 * Tests the full search pipeline against the live database.
 * Requires DATABASE_URL and AI_INTEGRATIONS_OPENAI_API_KEY env vars.
 */

import { describe, it, expect } from 'vitest';
import { search } from '../index';
import { analyzeQuery } from '../analyzer';
import type { SearchInput } from '../types';
import type { SearchFilters } from '@shared/routes';

const baseInput: Omit<SearchInput, 'query'> = {
  page: 1,
  pageSize: 20,
};

function makeInput(query: string, overrides: Partial<SearchInput> = {}): SearchInput {
  return { ...baseInput, query, ...overrides };
}

// ============================================================
// Intent Detection (synchronous analyzeQuery)
// ============================================================
describe('Intent Detection', () => {
  it('detects crisis intent for suicidal queries', () => {
    const analysis = analyzeQuery('I want to kill myself');
    expect(analysis.isCrisis).toBe(true);
    expect(analysis.intent).toBe('crisis');
  });

  it('detects domestic violence intent', () => {
    const analysis = analyzeQuery('my husband is hitting me');
    expect(analysis.intent).toBe('domestic_violence');
  });

  it('detects food insecurity intent', () => {
    const analysis = analyzeQuery('I need food for my family');
    expect(analysis.intent).toBe('food_insecurity');
  });

  it('detects substance abuse intent', () => {
    const analysis = analyzeQuery('I need help with my drinking problem');
    expect(analysis.intent).toBe('substance_abuse');
  });

  it('detects housing intent', () => {
    const analysis = analyzeQuery('I need emergency shelter tonight');
    expect(analysis.intent).toBe('housing_urgent');
  });

  it('detects mental health intent', () => {
    const analysis = analyzeQuery('I need a therapist for anxiety');
    expect(analysis.intent).toBe('mental_health');
  });
});

// ============================================================
// Result Relevance (full search pipeline)
// ============================================================
describe('Result Relevance', { timeout: 30_000 }, () => {
  it('returns crisis services for crisis queries', async () => {
    const res = await search(makeInput('I want to kill myself', { emergency: true }));
    expect(res.services.length).toBeGreaterThan(0);
    // Crisis services should be pinned at the top
    const topService = res.services[0];
    expect(
      topService.name.toLowerCase().includes('distress') ||
      topService.name.toLowerCase().includes('crisis') ||
      topService.name.toLowerCase().includes('988') ||
      topService.is24_7 === true
    ).toBe(true);
  });

  it('returns food-related services for food queries', async () => {
    const res = await search(makeInput('food bank near me'));
    expect(res.services.length).toBeGreaterThan(0);
    // Check that at least one top result is food-related
    const top5 = res.services.slice(0, 5);
    const foodRelated = top5.filter(s =>
      s.category.toLowerCase().includes('food') ||
      s.name.toLowerCase().includes('food') ||
      s.description.toLowerCase().includes('food') ||
      s.description.toLowerCase().includes('meal') ||
      s.description.toLowerCase().includes('hunger')
    );
    expect(foodRelated.length).toBeGreaterThanOrEqual(1);
  });

  it('returns DV services for domestic violence queries', async () => {
    const res = await search(makeInput('domestic violence help'));
    expect(res.services.length).toBeGreaterThan(0);
    const top5 = res.services.slice(0, 5);
    const dvRelated = top5.filter(s =>
      s.category.toLowerCase().includes('domestic') ||
      s.category.toLowerCase().includes('violence') ||
      s.name.toLowerCase().includes('shelter') ||
      s.description.toLowerCase().includes('domestic') ||
      s.description.toLowerCase().includes('abuse')
    );
    expect(dvRelated.length).toBeGreaterThanOrEqual(3);
  });

  it('returns addiction services for addiction queries', async () => {
    const res = await search(makeInput('drug addiction help'));
    expect(res.services.length).toBeGreaterThan(0);
    const top5 = res.services.slice(0, 5);
    const addictionRelated = top5.filter(s =>
      s.category.toLowerCase().includes('addiction') ||
      s.category.toLowerCase().includes('substance') ||
      s.category.toLowerCase().includes('recovery') ||
      s.description.toLowerCase().includes('addiction') ||
      s.description.toLowerCase().includes('recovery')
    );
    expect(addictionRelated.length).toBeGreaterThanOrEqual(2);
  });

  it('returns mental health services for mental health queries', async () => {
    const res = await search(makeInput('counselling for depression'));
    expect(res.services.length).toBeGreaterThan(0);
    const top5 = res.services.slice(0, 5);
    const mhRelated = top5.filter(s =>
      s.category.toLowerCase().includes('mental') ||
      s.category.toLowerCase().includes('counsel') ||
      s.description.toLowerCase().includes('counsel') ||
      s.description.toLowerCase().includes('mental health') ||
      s.description.toLowerCase().includes('depression')
    );
    expect(mhRelated.length).toBeGreaterThanOrEqual(3);
  });

  it('returns youth services for youth queries', async () => {
    const res = await search(makeInput('youth services'));
    expect(res.services.length).toBeGreaterThan(0);
    const top5 = res.services.slice(0, 5);
    const youthRelated = top5.filter(s =>
      s.category.toLowerCase().includes('youth') ||
      s.name.toLowerCase().includes('youth') ||
      s.description.toLowerCase().includes('youth') ||
      s.description.toLowerCase().includes('teen') ||
      s.description.toLowerCase().includes('young')
    );
    expect(youthRelated.length).toBeGreaterThanOrEqual(2);
  });

  it('returns shelter services for shelter queries', async () => {
    const res = await search(makeInput('emergency shelter'));
    expect(res.services.length).toBeGreaterThan(0);
    const top5 = res.services.slice(0, 5);
    const shelterRelated = top5.filter(s =>
      s.category.toLowerCase().includes('shelter') ||
      s.category.toLowerCase().includes('housing') ||
      s.name.toLowerCase().includes('shelter') ||
      s.description.toLowerCase().includes('shelter')
    );
    expect(shelterRelated.length).toBeGreaterThanOrEqual(2);
  });
});

// ============================================================
// Boosting Logic
// ============================================================
describe('Boosting Logic', { timeout: 30_000 }, () => {
  it('pins 988 crisis line for suicide-related queries', async () => {
    const res = await search(makeInput('suicide hotline'));
    expect(res.services.length).toBeGreaterThan(0);
    const top3 = res.services.slice(0, 3);
    const has988 = top3.some(s =>
      s.name.includes('988') ||
      s.phone?.includes('988') ||
      s.name.toLowerCase().includes('suicide') ||
      s.name.toLowerCase().includes('crisis')
    );
    expect(has988).toBe(true);
  });

  it('resolves CMHA alias to correct service', async () => {
    const analysis = analyzeQuery('CMHA');
    // CMHA should be recognized as an alias
    expect(
      analysis.aliasMatch !== null ||
      analysis.intent === 'alias' ||
      analysis.normalized.includes('cmha')
    ).toBe(true);

    const res = await search(makeInput('CMHA'));
    expect(res.services.length).toBeGreaterThan(0);
    const top3 = res.services.slice(0, 3);
    const hasCmha = top3.some(s =>
      s.name.toLowerCase().includes('cmha') ||
      s.name.toLowerCase().includes('canadian mental health')
    );
    expect(hasCmha).toBe(true);
  });

  it('penalizes services when negative terms are used', async () => {
    const analysis = analyzeQuery('addiction help not religious');
    expect(analysis.negativeTerms).toContain('religious');

    const res = await search(makeInput('addiction help not religious'));
    expect(res.services.length).toBeGreaterThan(0);
    // Faith-based services should be ranked lower or filtered out
    const top5 = res.services.slice(0, 5);
    const faithBased = top5.filter(s => s.isFaithBased === true || s.is_faith_based === true);
    expect(faithBased.length).toBeLessThanOrEqual(1);
  });

  it('boosts family support services for family addiction queries', async () => {
    const res = await search(makeInput('help for families of addicts'));
    expect(res.services.length).toBeGreaterThan(0);
    const top10 = res.services.slice(0, 10);
    const hasFamilySupport = top10.some(s =>
      s.name.toLowerCase().includes('al-anon') ||
      s.name.toLowerCase().includes('alanon') ||
      s.name.toLowerCase().includes('family') ||
      s.name.toLowerCase().includes('parent') ||
      s.description.toLowerCase().includes('family') ||
      s.description.toLowerCase().includes('parent')
    );
    expect(hasFamilySupport).toBe(true);
  });
});

// ============================================================
// Filter Application
// ============================================================
describe('Filter Application', { timeout: 30_000 }, () => {
  it('filters results by gender restriction', async () => {
    const filters: SearchFilters = { genderRestriction: 'women_only' };
    const res = await search(makeInput('addiction recovery', { filters }));
    expect(res.services.length).toBeGreaterThan(0);
    // No men_only services should appear
    const menOnly = res.services.filter(s => s.genderRestriction === 'men_only');
    expect(menOnly.length).toBe(0);
  });

  it('boosts 24/7 services when is24_7 filter is set', async () => {
    const filters: SearchFilters = { is24_7: true };
    const res = await search(makeInput('crisis support', { filters }));
    expect(res.services.length).toBeGreaterThan(0);
    // Top results should be crisis/distress lines (24/7 services)
    // Note: is24_7 may not be populated in LiteService; check by name pattern
    const top5 = res.services.slice(0, 5);
    const hasCrisisLine = top5.some(s =>
      s.name.toLowerCase().includes('distress') ||
      s.name.toLowerCase().includes('crisis') ||
      s.name.toLowerCase().includes('help line') ||
      s.name.toLowerCase().includes('helpline') ||
      s.name.toLowerCase().includes('211')
    );
    expect(hasCrisisLine).toBe(true);
  });
});

// ============================================================
// Semantic Understanding
// ============================================================
describe('Semantic Understanding', { timeout: 30_000 }, () => {
  it('understands natural language queries', async () => {
    const res = await search(makeInput('I have nowhere to sleep tonight'));
    expect(res.services.length).toBeGreaterThan(0);
    const top5 = res.services.slice(0, 5);
    const shelterRelated = top5.filter(s =>
      s.category.toLowerCase().includes('shelter') ||
      s.category.toLowerCase().includes('housing') ||
      s.name.toLowerCase().includes('shelter') ||
      s.description.toLowerCase().includes('shelter') ||
      s.description.toLowerCase().includes('housing') ||
      s.description.toLowerCase().includes('sleep')
    );
    expect(shelterRelated.length).toBeGreaterThanOrEqual(2);
  });

  it('handles typos gracefully', async () => {
    // "counceling" should be corrected to "counselling" and return mental health results
    const analysis = analyzeQuery('counceling for depression');
    expect(analysis.normalized).toContain('counsell');

    const res = await search(makeInput('counceling for depression'));
    expect(res.services.length).toBeGreaterThan(0);
    const top5 = res.services.slice(0, 5);
    const mhRelated = top5.filter(s =>
      s.category.toLowerCase().includes('mental') ||
      s.category.toLowerCase().includes('counsel') ||
      s.name.toLowerCase().includes('counsel') ||
      s.description.toLowerCase().includes('counsel')
    );
    expect(mhRelated.length).toBeGreaterThanOrEqual(1);
  });

  it('understands colloquial language', async () => {
    const res = await search(makeInput('I need a place to stay tonight'));
    expect(res.services.length).toBeGreaterThan(0);
    const top5 = res.services.slice(0, 5);
    const shelterRelated = top5.filter(s =>
      s.category.toLowerCase().includes('shelter') ||
      s.category.toLowerCase().includes('housing') ||
      s.name.toLowerCase().includes('shelter') ||
      s.description.toLowerCase().includes('shelter') ||
      s.description.toLowerCase().includes('housing')
    );
    expect(shelterRelated.length).toBeGreaterThanOrEqual(1);
  });
});
