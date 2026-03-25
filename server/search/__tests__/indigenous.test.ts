import { describe, it, expect } from 'vitest';
import { isIndigenousService, isIndigenousIntent } from '../indigenous';

describe('isIndigenousService', () => {
  // Category match
  it('matches category "Indigenous Services"', () => {
    expect(isIndigenousService({ name: 'Some Program', category: 'Indigenous Services' })).toBe(true);
  });
  it('matches category case-insensitively', () => {
    expect(isIndigenousService({ name: 'Some Program', category: 'indigenous services' })).toBe(true);
  });
  it('does not match unrelated category', () => {
    expect(isIndigenousService({ name: 'Calgary Clinic', category: 'Healthcare' })).toBe(false);
  });

  // Treaty 7 nations
  it('matches "Siksika Health Services"', () => {
    expect(isIndigenousService({ name: 'Siksika Health Services' })).toBe(true);
  });
  it('matches "Tsuut\'ina Nation Wellness"', () => {
    expect(isIndigenousService({ name: "Tsuut'ina Nation Wellness" })).toBe(true);
  });
  it('matches "Tsuu T\'ina Family Services"', () => {
    expect(isIndigenousService({ name: "Tsuu T'ina Family Services" })).toBe(true);
  });
  it('matches "Piikani Nation Health"', () => {
    expect(isIndigenousService({ name: 'Piikani Nation Health' })).toBe(true);
  });
  it('matches "Kainai Community Health"', () => {
    expect(isIndigenousService({ name: 'Kainai Community Health' })).toBe(true);
  });
  it('matches "Blood Tribe Department of Health"', () => {
    expect(isIndigenousService({ name: 'Blood Tribe Department of Health' })).toBe(true);
  });
  it('matches "Stoney Nakoda Family Services"', () => {
    expect(isIndigenousService({ name: 'Stoney Nakoda Family Services' })).toBe(true);
  });
  it('matches "Blackfoot Family Lodge"', () => {
    expect(isIndigenousService({ name: 'Blackfoot Family Lodge' })).toBe(true);
  });

  // Treaty 6 nations
  it('matches "Ermineskin Cree Nation Health"', () => {
    expect(isIndigenousService({ name: 'Ermineskin Cree Nation Health' })).toBe(true);
  });
  it('matches "Saddle Lake Cree Nation"', () => {
    expect(isIndigenousService({ name: 'Saddle Lake Cree Nation' })).toBe(true);
  });
  it('matches "Alexander First Nation"', () => {
    expect(isIndigenousService({ name: 'Alexander First Nation Health' })).toBe(true);
  });

  // Treaty 8 nations
  it('matches "Mikisew Cree First Nation"', () => {
    expect(isIndigenousService({ name: 'Mikisew Cree First Nation' })).toBe(true);
  });
  it('matches "Dene Tha\' First Nation"', () => {
    expect(isIndigenousService({ name: "Dene Tha' First Nation" })).toBe(true);
  });
  it('matches "Athabasca Chipewyan First Nation"', () => {
    expect(isIndigenousService({ name: 'Athabasca Chipewyan First Nation' })).toBe(true);
  });

  // Metis
  it('matches "Paddle Prairie Metis Settlement"', () => {
    expect(isIndigenousService({ name: 'Paddle Prairie Metis Settlement' })).toBe(true);
  });
  it('matches "Gift Lake Metis Settlement"', () => {
    expect(isIndigenousService({ name: 'Gift Lake Metis Settlement' })).toBe(true);
  });

  // Generic indigenous terms
  it('matches "Indigenous Family Support"', () => {
    expect(isIndigenousService({ name: 'Indigenous Family Support' })).toBe(true);
  });
  it('matches "First Nations Health Consortium"', () => {
    expect(isIndigenousService({ name: 'First Nations Health Consortium' })).toBe(true);
  });
  it('matches "Métis Nation of Alberta"', () => {
    expect(isIndigenousService({ name: 'Métis Nation of Alberta' })).toBe(true);
  });

  // Cultural markers
  it('matches "Edmonton Friendship Centre"', () => {
    expect(isIndigenousService({ name: 'Edmonton Friendship Centre' })).toBe(true);
  });
  it('matches "Native Friendship Centre"', () => {
    expect(isIndigenousService({ name: 'Native Friendship Centre' })).toBe(true);
  });
  it('matches "Native Counselling Services"', () => {
    expect(isIndigenousService({ name: 'Native Counselling Services' })).toBe(true);
  });

  // FALSE POSITIVES — must NOT match
  it('does NOT match "Elizabeth Fry Society"', () => {
    expect(isIndigenousService({ name: 'Elizabeth Fry Society' })).toBe(false);
  });
  it('does NOT match "Stoney Trail Dental Clinic"', () => {
    expect(isIndigenousService({ name: 'Stoney Trail Dental Clinic' })).toBe(false);
  });
  it('does NOT match "Buffalo Lake Campground"', () => {
    expect(isIndigenousService({ name: 'Buffalo Lake Campground' })).toBe(false);
  });
  it('does NOT match "Native Plant Society"', () => {
    expect(isIndigenousService({ name: 'Native Plant Society' })).toBe(false);
  });
  it('does NOT match "Calgary Mental Health Clinic"', () => {
    expect(isIndigenousService({ name: 'Calgary Mental Health Clinic' })).toBe(false);
  });
});

describe('isIndigenousIntent', () => {
  it('returns true for primary indigenous_services', () => {
    expect(isIndigenousIntent('indigenous_services')).toBe(true);
  });
  it('returns true for secondary indigenous_services with high confidence', () => {
    expect(isIndigenousIntent('mental_health', { intent: 'indigenous_services', confidence: 0.7 })).toBe(true);
  });
  it('returns false for secondary with low confidence', () => {
    expect(isIndigenousIntent('mental_health', { intent: 'indigenous_services', confidence: 0.3 })).toBe(false);
  });
  it('returns false for unrelated intent', () => {
    expect(isIndigenousIntent('mental_health')).toBe(false);
  });
  it('returns true at exactly 0.5 confidence threshold', () => {
    expect(isIndigenousIntent('housing_urgent', { intent: 'indigenous_services', confidence: 0.5 })).toBe(true);
  });
});
