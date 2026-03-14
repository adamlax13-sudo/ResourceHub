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

// === Sub-Intent Detection Tests ===

describe('Sub-Intent Detection — domestic_violence', () => {
  it('detects domestic_violence.sexual_assault for "I was raped"', () => {
    const analysis = analyzeQuery('I was raped and need help');
    expect(analysis.subIntents).toContain('domestic_violence.sexual_assault');
  });

  it('detects domestic_violence.stalking for "my ex is stalking me"', () => {
    const analysis = analyzeQuery('my ex is stalking me');
    expect(analysis.subIntents).toContain('domestic_violence.stalking');
  });

  it('detects domestic_violence.human_trafficking for "human trafficking help"', () => {
    const analysis = analyzeQuery('human trafficking support');
    expect(analysis.subIntents).toContain('domestic_violence.human_trafficking');
  });

  it('detects domestic_violence.safety_planning for "safety plan for leaving abuser"', () => {
    const analysis = analyzeQuery('I need a safety plan to leave my abuser');
    expect(analysis.subIntents).toContain('domestic_violence.safety_planning');
  });
});

describe('Sub-Intent Detection — financial_support', () => {
  it('detects financial_support.debt_counselling for "drowning in debt"', () => {
    const analysis = analyzeQuery('drowning in debt need help');
    expect(analysis.subIntents).toContain('financial_support.debt_counselling');
  });

  it('detects financial_support.utility_arrears for "can\'t pay electric bill"', () => {
    const analysis = analyzeQuery("can't pay my electric bill");
    expect(analysis.subIntents).toContain('financial_support.utility_arrears');
  });

  it('detects financial_support.tax_clinic for "tax help filing"', () => {
    const analysis = analyzeQuery('need help filing my taxes low income');
    expect(analysis.subIntents).toContain('financial_support.tax_clinic');
  });
});

describe('Sub-Intent Detection — grief_support', () => {
  it('detects grief_support.violent_loss for "murdered family member"', () => {
    const analysis = analyzeQuery('my brother was murdered');
    expect(analysis.subIntents).toContain('grief_support.violent_loss');
  });

  it('detects grief_support.pet_loss for "my dog died"', () => {
    const analysis = analyzeQuery('my dog died and I am devastated');
    expect(analysis.subIntents).toContain('grief_support.pet_loss');
  });

  it('detects grief_support.pregnancy_loss for "miscarriage support"', () => {
    const analysis = analyzeQuery('miscarriage support group');
    expect(analysis.subIntents).toContain('grief_support.pregnancy_loss');
  });

  it('detects grief_support.suicide_loss for "lost my friend to suicide"', () => {
    const analysis = analyzeQuery('lost my friend to suicide');
    expect(analysis.subIntents).toContain('grief_support.suicide_loss');
  });
});

describe('Sub-Intent Detection — senior_services', () => {
  it('detects senior_services.home_care for "home care for elderly mother"', () => {
    const analysis = analyzeQuery('home care for elderly mother');
    expect(analysis.subIntents).toContain('senior_services.home_care');
  });

  it('detects senior_services.dementia for "dementia support"', () => {
    const analysis = analyzeQuery('dementia support group Calgary');
    expect(analysis.subIntents).toContain('senior_services.dementia');
  });

  it('detects senior_services.elder_abuse for "elder abuse help"', () => {
    const analysis = analyzeQuery('elder abuse help what do I do');
    expect(analysis.subIntents).toContain('senior_services.elder_abuse');
  });
});

describe('Sub-Intent Detection — Remaining Intents', () => {
  it('detects community_social.social_connection for "lonely need friends"', () => {
    const analysis = analyzeQuery('I am lonely and need friends');
    expect(analysis.subIntents).toContain('community_social.social_connection');
  });

  it('detects community_social.recreation for "community recreation programs"', () => {
    const analysis = analyzeQuery('community recreation programs');
    expect(analysis.subIntents).toContain('community_social.recreation');
  });

  it('detects youth_services.runaway for "runaway teen"', () => {
    const analysis = analyzeQuery('runaway teen needs help');
    expect(analysis.subIntents).toContain('youth_services.runaway');
  });

  it('detects parenting_support.prenatal for "prenatal classes"', () => {
    const analysis = analyzeQuery('prenatal classes for expecting parents');
    expect(analysis.subIntents).toContain('parenting_support.prenatal');
  });

  it('detects food_insecurity.food_bank for "food bank near me"', () => {
    const analysis = analyzeQuery('food bank near me');
    expect(analysis.subIntents).toContain('food_insecurity.food_bank');
  });

  it('detects basic_needs.furniture for "free furniture"', () => {
    const analysis = analyzeQuery('free furniture for my apartment');
    expect(analysis.subIntents).toContain('basic_needs.furniture');
  });

  it('detects student_services.campus_counselling for "university counselling"', () => {
    const analysis = analyzeQuery('university counselling services');
    expect(analysis.subIntents).toContain('student_services.campus_counselling');
  });

  it('detects lgbtq_services.trans_healthcare for "trans healthcare"', () => {
    const analysis = analyzeQuery('trans healthcare support');
    expect(analysis.subIntents).toContain('lgbtq_services.trans_healthcare');
  });

  it('detects caregiver_support.respite for "respite care"', () => {
    const analysis = analyzeQuery('respite care for my mom');
    expect(analysis.subIntents).toContain('caregiver_support.respite');
  });

  it('detects family_addiction_support.parent_of_addict for "my son is addicted"', () => {
    const analysis = analyzeQuery('my son is addicted to drugs what can I do');
    expect(analysis.subIntents).toContain('family_addiction_support.parent_of_addict');
  });
});
