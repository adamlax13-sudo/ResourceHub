import { describe, it, expect } from 'vitest';
import { applySubIntentBoost, SUB_INTENT_CATEGORY_OVERRIDE } from '../sub-intent-boost';
import type { LiteService } from '../../../types';

describe('SUB_INTENT_CATEGORY_OVERRIDE', () => {
  it('narrows substance_abuse.gambling to Gambling Support only', () => {
    const override = SUB_INTENT_CATEGORY_OVERRIDE['substance_abuse.gambling'];
    expect(override).toBeDefined();
    expect(override!.has('Gambling Support')).toBe(true);
    expect(override!.size).toBe(1);
  });

  it('narrows substance_abuse.harm_reduction to Harm Reduction only', () => {
    const override = SUB_INTENT_CATEGORY_OVERRIDE['substance_abuse.harm_reduction'];
    expect(override).toBeDefined();
    expect(override!.has('Harm Reduction')).toBe(true);
  });

  it('narrows healthcare_access.hospital_er to Hospital & Emergency', () => {
    const override = SUB_INTENT_CATEGORY_OVERRIDE['healthcare_access.hospital_er'];
    expect(override!.has('Hospital & Emergency')).toBe(true);
  });
});

describe('applySubIntentBoost', () => {
  const makeService = (id: number, name: string, category: string, rrfScore: number) => ({
    id: String(id),
    name,
    category,
    rrfScore,
    description: name,
    location: 'Calgary',
    waitTimes: '',
  } as LiteService);

  it('boosts gambling services for substance_abuse.gambling sub-intent', () => {
    const services = [
      makeService(1, 'Gambling Support Program', 'Gambling Support', 1.0),
      makeService(2, 'Generic Addiction Treatment', 'Addiction Treatment', 1.0),
    ];
    const result = applySubIntentBoost(services, ['substance_abuse.gambling']);
    // Gambling service should be boosted higher (category match + text match)
    expect(result[0].rrfScore).toBeGreaterThan(result[1].rrfScore!);
  });

  it('returns services unchanged when no sub-intents', () => {
    const services = [makeService(1, 'Test', 'Addiction Treatment', 1.0)];
    const result = applySubIntentBoost(services, []);
    expect(result[0].rrfScore).toBe(1.0);
  });

  it('does not boost pinned services (null rrfScore)', () => {
    const services = [{ id: '1', name: 'Crisis Line', category: 'Crisis', description: '', location: '', waitTimes: '' } as LiteService];
    const result = applySubIntentBoost(services, ['substance_abuse.gambling']);
    expect(result[0].rrfScore).toBeUndefined();
  });

  it('boosts by text pattern match', () => {
    const services = [
      makeService(1, 'Naloxone Distribution', 'Harm Reduction', 1.0),
      makeService(2, 'General Counselling', 'Mental Health', 1.0),
    ];
    const result = applySubIntentBoost(services, ['substance_abuse.harm_reduction']);
    expect(result[0].rrfScore).toBeGreaterThan(1.0);
    expect(result[1].rrfScore).toBe(1.0);
  });
});
