import { describe, it, expect } from 'vitest';
import { analyzeQuery } from '../analyzer';

describe('Intent Detection — Known Misdetections', () => {
  it('detects lgbtq_services for "LGBTQ counselling Calgary"', () => {
    const analysis = analyzeQuery('LGBTQ counselling Calgary', 'Calgary');
    expect(analysis.intent).toBe('lgbtq_services');
  });

  it('detects lgbtq_services for "trans healthcare support"', () => {
    const analysis = analyzeQuery('trans healthcare support');
    expect(analysis.intent).toBe('lgbtq_services');
  });

  it('detects lgbtq_services for "queer therapy"', () => {
    const analysis = analyzeQuery('queer therapy');
    expect(analysis.intent).toBe('lgbtq_services');
  });

  it('detects family_addiction_support for "my son is addicted to drugs what can I do"', () => {
    const analysis = analyzeQuery('my son is addicted to drugs what can I do');
    expect(analysis.intent).toBe('family_addiction_support');
  });

  it('detects family_addiction_support for "my husband is an alcoholic"', () => {
    const analysis = analyzeQuery('my husband is an alcoholic');
    expect(analysis.intent).toBe('family_addiction_support');
  });

  it('detects family_addiction_support for "living with an addict"', () => {
    const analysis = analyzeQuery('living with an addict');
    expect(analysis.intent).toBe('family_addiction_support');
  });

  it('detects family_addiction_support for "my kid is out of control on drugs"', () => {
    const analysis = analyzeQuery('my kid is out of control on drugs');
    expect(analysis.intent).toBe('family_addiction_support');
  });
});

describe('Intent Detection — Existing Intents (regression)', () => {
  it('detects crisis for "I want to kill myself"', () => {
    const analysis = analyzeQuery('I want to kill myself');
    expect(analysis.isCrisis).toBe(true);
    expect(analysis.intent).toBe('crisis');
  });

  it('detects domestic_violence for "my husband hits me"', () => {
    const analysis = analyzeQuery('my husband hits me I need to leave');
    expect(analysis.intent).toBe('domestic_violence');
  });

  it('detects substance_abuse for "help with alcohol addiction"', () => {
    const analysis = analyzeQuery('help with alcohol addiction Calgary', 'Calgary');
    expect(analysis.intent).toBe('substance_abuse');
  });

  it('detects mental_health for "free counselling Calgary"', () => {
    const analysis = analyzeQuery('free counselling Calgary', 'Calgary');
    expect(analysis.intent).toBe('mental_health');
  });

  it('detects housing_urgent for "emergency shelter tonight"', () => {
    const analysis = analyzeQuery('emergency shelter tonight Calgary');
    expect(analysis.intent).toBe('housing_urgent');
  });

  it('detects disability_support for "ADHD support for adults"', () => {
    const analysis = analyzeQuery('ADHD support for adults');
    expect(analysis.intent).toBe('disability_support');
  });

  it('detects newcomer_services for "newcomer settlement services"', () => {
    const analysis = analyzeQuery('newcomer settlement services');
    expect(analysis.intent).toBe('newcomer_services');
  });

  it('detects food_insecurity for "food bank near me"', () => {
    const analysis = analyzeQuery('food bank near downtown Edmonton', 'Edmonton');
    expect(analysis.intent).toBe('food_insecurity');
  });
});
