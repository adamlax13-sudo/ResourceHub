import { describe, it, expect } from 'vitest';
import { scoreDeterministic } from '../deterministic_evaluator';

describe('Deterministic Evaluator', () => {
  const mockServices = [
    { name: '988 Suicide Crisis Helpline', category: 'crisis_services', description: 'National crisis line', location: 'Alberta-wide' },
    { name: 'Calgary Counselling Centre', category: 'mental_health', description: 'Affordable counselling', location: 'Calgary' },
  ];

  it('scores 100 for mustInclude when service is present', () => {
    const result = scoreDeterministic(
      { query: 'crisis help', intent: 'crisis', description: 'test', mustInclude: ['988 Suicide Crisis Helpline'] },
      mockServices as any,
      'crisis'
    );
    expect(result.scores.mustInclude).toBe(100);
  });

  it('scores 0 for mustInclude when service is missing', () => {
    const result = scoreDeterministic(
      { query: 'crisis help', intent: 'crisis', description: 'test', mustInclude: ['Nonexistent Service'] },
      mockServices as any,
      'crisis'
    );
    expect(result.scores.mustInclude).toBe(0);
  });

  it('scores 0 for mustExclude when excluded service is present', () => {
    const result = scoreDeterministic(
      { query: 'test', intent: 'crisis', description: 'test', mustExclude: ['988 Suicide Crisis Helpline'] },
      mockServices as any,
      'crisis'
    );
    expect(result.scores.mustExclude).toBe(0);
  });

  it('scores 100 for mustExclude when excluded service is absent', () => {
    const result = scoreDeterministic(
      { query: 'test', intent: 'mental_health', description: 'test', mustExclude: ['Salvation Army'] },
      mockServices as any,
      'mental_health'
    );
    expect(result.scores.mustExclude).toBe(100);
  });

  it('scores intent accuracy correctly', () => {
    const result = scoreDeterministic(
      { query: 'test', intent: 'crisis', description: 'test' },
      mockServices as any,
      'crisis'
    );
    expect(result.scores.intentAccuracy).toBe(100);
  });

  it('scores 0 intent accuracy on mismatch', () => {
    const result = scoreDeterministic(
      { query: 'test', intent: 'lgbtq_services', description: 'test' },
      mockServices as any,
      'mental_health'
    );
    expect(result.scores.intentAccuracy).toBe(0);
  });

  it('scores pattern match based on keyword hits', () => {
    const result = scoreDeterministic(
      { query: 'test', intent: 'crisis', description: 'test', expectedPatterns: ['crisis', 'helpline', 'missing'] },
      mockServices as any,
      'crisis'
    );
    expect(result.scores.patternMatch).toBeGreaterThan(60);
    expect(result.scores.patternMatch).toBeLessThan(70);
  });

  it('scores 0 overall when zero results', () => {
    const result = scoreDeterministic(
      { query: 'test', intent: 'crisis', description: 'test' },
      [],
      'crisis'
    );
    expect(result.scores.overall).toBe(0);
  });
});
