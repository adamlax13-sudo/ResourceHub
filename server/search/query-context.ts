/**
 * Consolidated Query Understanding
 *
 * Single entry point that runs all detector functions once and returns
 * enriched QueryContext fields. These are layered onto QueryAnalysis
 * so existing code keeps working.
 *
 * Reuses existing detect*() functions from strategies/detectors.ts.
 */

import type { QueryAnalysis } from './types';
import type { QueryIntent } from './config';
import {
  detectGenderPreference,
  detectAgeGroup,
  detectUrgency,
  detectFamilySituation,
  detectCommunityPreference,
  detectStudentContext,
  detectLanguagePreference,
  detectFamilyContext,
  detectExclusions,
} from './strategies/detectors';

// Third-party searcher patterns
const FAMILY_SEARCHER = /\b(?:my|our)\s+(?:\w+\s+)?(?:son|daughter|child|kid|teen|teenager|husband|wife|partner|spouse|parent|mother|father|mom|dad|brother|sister|sibling|grandparent|grandmother|grandfather)\b/i;
const PROFESSIONAL_SEARCHER = /\b(?:my\s+)?(?:client|patient|resident|student|referral)\s+(?:needs?|is|has|wants?|requires?)\b/i;
const THIRD_PARTY_YOUTH = /\b(?:my|our)\s+(?:son|daughter|child|kid|teen|teenager)\b/i;
const THIRD_PARTY_SENIOR = /\b(?:my|our)\s+(?:elderly|aging|aged|senior)\s+(?:parent|mother|father|mom|dad|grandparent)\b/i;
const THIRD_PARTY_FEMALE = /\b(?:my|our)\s+(?:\w+\s+)?(?:daughter|wife|mother|mom|sister|grandmother)\b/i;
const THIRD_PARTY_MALE = /\b(?:my|our)\s+(?:\w+\s+)?(?:son|husband|father|dad|brother|grandfather)\b/i;
const SELF_SEARCHER = /\b(?:I |I'm |I am |me |my |myself)\b/i;

// Implied needs mapping
const IMPLIED_NEEDS: Array<{ pattern: RegExp; needs: string[] }> = [
  { pattern: /\b(?:out of|released from|leaving|left)\s+(?:jail|prison|custody|incarcerat)/i, needs: ['housing', 'employment', 'reintegration'] },
  { pattern: /\b(?:fleeing|leaving|escaping)\s+(?:abuse|abuser|violence|violent)/i, needs: ['housing', 'safety_planning', 'crisis_support'] },
  { pattern: /\b(?:just|recently)\s+(?:arrived|immigrated|came to|moved to)\s+(?:canada|alberta|calgary|edmonton)/i, needs: ['settlement', 'language', 'employment'] },
  { pattern: /\b(?:aging out|aged out|leaving care|former foster|former ward)/i, needs: ['housing', 'employment', 'life_skills'] },
];

/**
 * Run all query detectors once and return enriched QueryContext fields.
 * Call this once per query, then merge results into QueryAnalysis.
 */
export function understandQuery(rawQuery: string, intent?: QueryIntent): Partial<QueryAnalysis> {
  const q = rawQuery;

  // Pre-compute all detector results
  const detections = {
    genderPref: detectGenderPreference(q),
    ageGroup: detectAgeGroup(q),
    urgency: detectUrgency(q),
    familySituations: detectFamilySituation(q),
    communityPref: detectCommunityPreference(q),
    studentContext: detectStudentContext(q),
    languagePref: detectLanguagePreference(q),
    familyContext: detectFamilyContext(q),
    exclusions: detectExclusions(q, intent),
  };

  // Determine searcher type
  let searcher: 'self' | 'family_member' | 'professional' | 'unknown' = 'unknown';
  if (PROFESSIONAL_SEARCHER.test(q)) {
    searcher = 'professional';
  } else if (FAMILY_SEARCHER.test(q)) {
    searcher = 'family_member';
  } else if (SELF_SEARCHER.test(q)) {
    searcher = 'self';
  }

  // Determine target person
  let ageGroup: 'youth' | 'adult' | 'senior' | 'unknown' = 'unknown';
  let ageConfidence: 'high' | 'medium' | 'low' = 'low';
  let gender: 'male' | 'female' | 'any' = 'any';

  if (searcher === 'family_member') {
    // Infer target from the family member mentioned
    if (THIRD_PARTY_YOUTH.test(q)) { ageGroup = 'youth'; ageConfidence = 'high'; }
    else if (THIRD_PARTY_SENIOR.test(q)) { ageGroup = 'senior'; ageConfidence = 'high'; }
    else { ageGroup = 'adult'; ageConfidence = 'medium'; }

    if (THIRD_PARTY_FEMALE.test(q)) gender = 'female';
    else if (THIRD_PARTY_MALE.test(q)) gender = 'male';
  } else {
    // Use standard age detector for self/professional/unknown
    if (detections.ageGroup) {
      ageGroup = detections.ageGroup.ageGroup === 'youth_and_adult' ? 'adult' : detections.ageGroup.ageGroup;
      ageConfidence = detections.ageGroup.confidence === 'high' ? 'high' : 'medium';
    }
    if (detections.genderPref === 'women_only') gender = 'female';
    else if (detections.genderPref === 'men_only') gender = 'male';
  }

  // Build contexts array from community preference
  const contexts: Array<'student' | 'newcomer' | 'indigenous' | 'veteran' | 'lgbtq' | 'unhoused'> = [];
  if (detections.communityPref === 'indigenous') contexts.push('indigenous');
  if (detections.communityPref === 'veteran') contexts.push('veteran');
  if (detections.communityPref === 'lgbtq') contexts.push('lgbtq');
  if (detections.communityPref === 'newcomer') contexts.push('newcomer');
  if (detections.studentContext) contexts.push('student');

  // Detect implied needs
  const impliedNeeds: string[] = [];
  for (const { pattern, needs } of IMPLIED_NEEDS) {
    if (pattern.test(q)) {
      impliedNeeds.push(...needs.filter(n => !impliedNeeds.includes(n)));
    }
  }
  // Third-party addiction → imply family support
  if (searcher === 'family_member' && /\b(?:addict(?:ed|ion)?|alcohol(?:ic|ism)?|drug|substance|drink(?:ing)?|using)\b/i.test(q)) {
    if (!impliedNeeds.includes('family_support')) impliedNeeds.push('family_support');
  }

  return {
    searcher,
    targetPerson: { ageGroup, ageConfidence, gender, contexts },
    impliedNeeds: impliedNeeds.length > 0 ? impliedNeeds : undefined,
    detections,
    resolvedBy: 'pattern',
  };
}
