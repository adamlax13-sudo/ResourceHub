import { describe, it, expect } from 'vitest';
import { computeQueryContext } from '../query-context';

describe('computeQueryContext — searcher vs targetPerson', () => {
  it('detects self-search for "I need help with drugs"', () => {
    const ctx = computeQueryContext('I need help with drugs');
    expect(ctx.searcher).toBe('self');
    // No age signal in query — stays unknown
    expect(ctx.targetPerson?.ageGroup).toBe('unknown');
  });

  it('detects family_member search for "my son needs help with drugs"', () => {
    const ctx = computeQueryContext('my son needs help with drugs');
    expect(ctx.searcher).toBe('family_member');
    expect(ctx.targetPerson?.ageGroup).toBe('youth');
  });

  it('detects family_member search for "my elderly mother needs care"', () => {
    const ctx = computeQueryContext('my elderly mother needs home care');
    expect(ctx.searcher).toBe('family_member');
    expect(ctx.targetPerson?.ageGroup).toBe('senior');
    expect(ctx.targetPerson?.gender).toBe('female');
  });

  it('detects professional search for "client needs shelter"', () => {
    const ctx = computeQueryContext('my client needs a shelter tonight');
    expect(ctx.searcher).toBe('professional');
  });

  it('detects unknown for ambiguous queries', () => {
    const ctx = computeQueryContext('food bank near me');
    expect(ctx.searcher).toBe('unknown');
  });

  it('detects male target for "my husband is drinking"', () => {
    const ctx = computeQueryContext('my husband is drinking too much');
    expect(ctx.searcher).toBe('family_member');
    expect(ctx.targetPerson?.gender).toBe('male');
    expect(ctx.targetPerson?.ageGroup).toBe('adult');
  });
});

describe('computeQueryContext — impliedNeeds', () => {
  it('implies housing + employment for "just got out of jail"', () => {
    const ctx = computeQueryContext('I just got out of jail');
    expect(ctx.impliedNeeds).toContain('housing');
    expect(ctx.impliedNeeds).toContain('employment');
  });

  it('implies family_support for third-party addiction queries', () => {
    const ctx = computeQueryContext('my husband is an alcoholic');
    expect(ctx.impliedNeeds).toContain('family_support');
  });

  it('implies housing for fleeing abuse', () => {
    const ctx = computeQueryContext('I am fleeing abuse');
    expect(ctx.impliedNeeds).toContain('housing');
    expect(ctx.impliedNeeds).toContain('safety_planning');
  });

  it('returns undefined impliedNeeds when none detected', () => {
    const ctx = computeQueryContext('free counselling');
    expect(ctx.impliedNeeds).toBeUndefined();
  });
});

describe('computeQueryContext — pre-computed detections', () => {
  it('caches all detector results in detections field', () => {
    const ctx = computeQueryContext('free counselling for women in Calgary');
    expect(ctx.detections).toBeDefined();
    expect(ctx.detections!.genderPref).toBe('women_only');
  });

  it('detects student context', () => {
    const ctx = computeQueryContext('university counselling services');
    expect(ctx.detections).toBeDefined();
    expect(ctx.detections!.studentContext).toBeTruthy();
    expect(ctx.targetPerson?.contexts).toContain('student');
  });

  it('always provides resolvedBy field', () => {
    const ctx = computeQueryContext('help');
    expect(ctx.resolvedBy).toBe('pattern');
  });
});
