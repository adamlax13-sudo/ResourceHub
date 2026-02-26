/**
 * Scoring Module
 *
 * Contains all boost and penalty logic for search result ranking.
 * Boost values are configurable via SCORING_CONFIG in config.ts.
 * Includes intent-based boosting, RRF scoring, and negative keyword penalties.
 */

import { SCORING_CONFIG } from '../config';
import type { QueryIntent } from '../config';
import type { LiteService, LiteServiceWithDebug, QueryAnalysis, ScoreExplanation } from '../types';
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
  detectServiceSubstanceType,
} from './detectors';

// Re-export SCORING_CONFIG for backwards compatibility
export { SCORING_CONFIG };

// Alias for backwards compatibility (deprecated - use SCORING_CONFIG instead)
export const BOOST_CONFIG = SCORING_CONFIG;

// Cached reverse alias map (serviceId -> aliases), rebuilt only when forward map changes
let cachedReverseAliasMap: Map<string, Set<string>> | null = null;
let cachedAliasLookupRef: Map<string, string> | null = null;

function getReverseAliasMap(aliasLookup: Map<string, string>): Map<string, Set<string>> {
  if (cachedReverseAliasMap && cachedAliasLookupRef === aliasLookup) {
    return cachedReverseAliasMap;
  }
  const reverseMap = new Map<string, Set<string>>();
  aliasLookup.forEach((serviceId, alias) => {
    if (!reverseMap.has(serviceId)) {
      reverseMap.set(serviceId, new Set());
    }
    reverseMap.get(serviceId)!.add(alias);
  });
  cachedReverseAliasMap = reverseMap;
  cachedAliasLookupRef = aliasLookup;
  return reverseMap;
}

/**
 * Boost services by name/alias match. Runs BEFORE boostByIntent.
 *
 * Tiers:
 * 1. Exact name match (case-insensitive): +500
 * 2. Alias match (from service_aliases DB table): +500
 * 3. Partial name match (all 2+ non-stoplist query words in name): +250
 */
export function boostByNameMatch(
  services: LiteService[],
  rawQuery: string,
  aliasLookup: Map<string, string>,
  options?: BoostOptions
): LiteService[] {
  const cfg = SCORING_CONFIG;
  const trackExplanations = options?.trackExplanations ?? false;
  const queryLower = rawQuery.toLowerCase().trim();

  // Get cached reverse alias map: serviceId -> set of aliases
  const serviceAliases = getReverseAliasMap(aliasLookup);

  // Stoplist for partial match filtering
  const commonWordStoplist = new Set([
    'meals', 'meal', 'help', 'support', 'community', 'family', 'families',
    'service', 'services', 'center', 'centre', 'program', 'programs',
    'care', 'health', 'mental', 'housing', 'shelter', 'food', 'free',
    'counselling', 'counseling', 'therapy', 'group', 'groups', 'crisis',
    'emergency', 'assistance', 'resource', 'resources', 'outreach',
    'youth', 'adult', 'seniors', 'senior', 'women', 'men', 'children',
    'calgary', 'alberta', 'society', 'foundation', 'association',
  ]);

  // Pre-compute query words for partial matching
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
  const nonStoplistWords = queryWords.filter(w => !commonWordStoplist.has(w));

  const scored = services.map(svc => {
    let boost = 0;
    const explanations: ScoreExplanation[] = [];
    const nameLower = svc.name.toLowerCase();

    const addFactor = (factor: string, value: number, reason: string) => {
      boost += value;
      if (trackExplanations) {
        explanations.push({ factor, value, reason });
      }
    };

    // Tier 1: Exact name match
    if (queryLower === nameLower) {
      addFactor('nameMatch.exact', cfg.nameMatch.exact, `Exact name match: "${svc.name}"`);
      console.log(`[NameMatch] "${svc.name.substring(0, 40)}" +${cfg.nameMatch.exact} exact name match`);
    }
    // Tier 2: Alias match
    else if (serviceAliases.has(svc.id)) {
      const aliases = serviceAliases.get(svc.id)!;
      if (aliases.has(queryLower)) {
        addFactor('nameMatch.alias', cfg.nameMatch.alias, `Alias match: "${queryLower}" -> "${svc.name}"`);
        console.log(`[NameMatch] "${svc.name.substring(0, 40)}" +${cfg.nameMatch.alias} alias match for "${queryLower}"`);
      }
    }

    // Tier 3: Partial name match (requires 2+ non-stoplist words, ALL must appear in name)
    if (boost === 0 && nonStoplistWords.length >= 2) {
      const allMatch = nonStoplistWords.every(w => nameLower.includes(w));
      if (allMatch) {
        addFactor('nameMatch.partial', cfg.nameMatch.partial, `Partial name match: all ${nonStoplistWords.length} words in name`);
        console.log(`[NameMatch] "${svc.name.substring(0, 40)}" +${cfg.nameMatch.partial} partial match (${nonStoplistWords.join(', ')})`);
      }
    }

    return { svc, boost, explanations };
  });

  // Sort by boost (highest first) while preserving relative order for equal boosts
  scored.sort((a, b) => b.boost - a.boost);

  const boostedCount = scored.filter(s => s.boost > 0).length;
  if (boostedCount > 0) {
    console.log(`[NameMatch] ${boostedCount} services boosted by name match`);
  }

  // Return services with explanations attached if tracking is enabled
  if (trackExplanations) {
    return scored.map(s => ({
      ...s.svc,
      scoreExplanation: [
        ...((s.svc as LiteServiceWithDebug).scoreExplanation || []),
        ...s.explanations,
      ],
    })) as LiteServiceWithDebug[];
  }

  return scored.map(s => s.svc);
}

/**
 * Map query intent to expected service types and boost patterns
 */
export const INTENT_SERVICE_MAP: Partial<Record<QueryIntent, {
  serviceTypes: string[];
  categoryPatterns: RegExp;
  genderPreference?: 'women_only' | 'men_only';
}>> = {
  'domestic_violence': {
    serviceTypes: ['domestic_violence', 'emergency_shelter', 'crisis_line'],
    categoryPatterns: /domestic|violence|abuse|women'?s.*shelter|safe.*house|crisis.*line|victim|assault/i,
    genderPreference: 'women_only',
  },
  'food_insecurity': {
    serviceTypes: ['food_resources'],
    categoryPatterns: /food.*bank|pantry|meals|groceries|hunger|nutrition|hamper/i,
  },
  'housing_urgent': {
    serviceTypes: ['emergency_shelter'],
    categoryPatterns: /shelter|housing|homeless|beds|accommodation|emergency housing|drop-in/i,
  },
  'substance_abuse': {
    serviceTypes: ['addiction_recovery', 'residential_treatment'],
    categoryPatterns: /addiction|recovery|alcohol|drug|detox|rehab|sober|AA|NA|AADAC|peer support|treatment/i,
  },
  'mental_health': {
    serviceTypes: ['mental_health', 'counselling', 'crisis_line'],
    categoryPatterns: /mental|counselling|counseling|therapy|therapist|depression|anxiety|support|crisis|psycholog/i,
  },
  'disability_support': {
    serviceTypes: ['disability_services', 'support_groups', 'community_programs'],
    categoryPatterns: /autis|autism|ASD|asperger|disability|disabled|neurodivergent|neurodiverse|ADHD|ADD|developmental|sensory|AISH|PDD|accessibility|social skills|peer support|support group|life skills|independent living/i,
  },
  'grief_support': {
    serviceTypes: ['grief_support', 'bereavement', 'loss_support'],
    categoryPatterns: /grief|bereavement|loss|mourning|funeral|memorial|hospice|palliative|widow|death|dying|end.of.life/i,
  },
  'senior_services': {
    serviceTypes: ['senior_services', 'aging', 'elder_care'],
    categoryPatterns: /senior|elderly|aging|aged|older adult|65\+|retirement|dementia|alzheimer|home care|meals on wheels|geriatric/i,
  },
  'legal_aid': {
    serviceTypes: ['legal_aid', 'legal_services'],
    categoryPatterns: /legal|lawyer|attorney|court|custody|divorce|immigration|family law|tenant|housing rights|pro bono/i,
  },
  'employment_support': {
    serviceTypes: ['employment', 'job_training', 'career'],
    categoryPatterns: /employment|job|career|training|workforce|resume|interview|EI|apprentice|skills training/i,
  },
  'youth_services': {
    serviceTypes: ['youth_services', 'teen_support'],
    categoryPatterns: /youth|teen|adolescent|young adult|under 25|kids help|student|runaway/i,
  },
  'newcomer_services': {
    serviceTypes: ['newcomer', 'settlement', 'immigration'],
    categoryPatterns: /immigrant|refugee|newcomer|settlement|ESL|language|citizenship|sponsorship|asylum/i,
  },
  'family_addiction_support': {
    serviceTypes: ['family_support', 'addiction_family'],
    categoryPatterns: /al-?anon|nar-?anon|family.*support|loved one|concerned person|family.*addiction|intervention|codependent/i,
  },
  'financial_support': {
    serviceTypes: ['financial_services', 'debt_counseling'],
    categoryPatterns: /financial|debt|credit|bankruptcy|budget|money management|bills|collections|payday loan/i,
  },
  'caregiver_support': {
    serviceTypes: ['caregiver_support', 'respite'],
    categoryPatterns: /caregiver|respite|family caregiver|caring for|burnout|caregiver support/i,
  },
  'lgbtq_services': {
    serviceTypes: ['lgbtq_services', 'pride'],
    categoryPatterns: /lgbtq|lgbt|queer|trans|transgender|gay|lesbian|bisexual|non-?binary|pride|gender affirming|2slgbtq/i,
  },
  'indigenous_services': {
    serviceTypes: ['indigenous_services', 'first_nations'],
    categoryPatterns: /indigenous|first nations?|métis|metis|inuit|native|aboriginal|treaty|reserve|elder|ceremony|traditional healing/i,
  },
  'student_services': {
    serviceTypes: ['campus_services', 'student_support'],
    categoryPatterns: /campus|university|college|student|u of c|u of a|ucalgary|ualberta|mount royal|mru|sait|nait|macewan/i,
  },
  'parenting_support': {
    serviceTypes: ['parenting', 'baby_resources', 'family_support'],
    categoryPatterns: /pregnant|pregnancy|prenatal|postpartum|baby|infant|newborn|parenting|parent support|childcare|daycare|formula|diapers/i,
  },
  'veteran_services': {
    serviceTypes: ['veteran_services', 'military_support', 'trauma_services'],
    categoryPatterns: /veteran|military|armed forces|canadian forces|CAF|CFB|PTSD|post-?traumatic|trauma|operational stress|combat|deployment|VAC|veterans affairs|OSISS|legion|royal canadian legion/i,
  },
};

/** Options for boost function */
export interface BoostOptions {
  /** Enable tracking of score explanations */
  trackExplanations?: boolean;
}

/** Result from boostByIntent with optional explanations */
export interface BoostResult {
  services: LiteService[];
  /** Services with score explanations (only when trackExplanations is true) */
  servicesWithExplanations?: LiteServiceWithDebug[];
}

/**
 * Boost services that match the detected intent, gender, age, urgency, family, and community preferences
 * Uses both service_type field (if available) and text pattern matching
 */
export function boostByIntent(
  services: LiteService[],
  intent: QueryIntent,
  rawQuery: string,
  analysis?: QueryAnalysis,
  options?: BoostOptions
): LiteService[] {
  const intentConfig = INTENT_SERVICE_MAP[intent];
  const cfg = SCORING_CONFIG;
  const trackExplanations = options?.trackExplanations ?? false;

  // Detect all preferences from query
  const genderPref = detectGenderPreference(rawQuery);
  const ageGroup = detectAgeGroup(rawQuery);
  const urgency = detectUrgency(rawQuery);
  const familySituations = detectFamilySituation(rawQuery);
  const communityPref = detectCommunityPreference(rawQuery);
  const studentContext = detectStudentContext(rawQuery);
  const languagePref = detectLanguagePreference(rawQuery);
  const familyContext = detectFamilyContext(rawQuery);
  const exclusions = detectExclusions(rawQuery, intent);

  // Log detected preferences
  const detections: string[] = [];
  if (genderPref) detections.push(`gender:${genderPref}`);
  if (ageGroup) detections.push(`age:${ageGroup}`);
  if (urgency) detections.push(`urgency:${urgency}`);
  if (familySituations.length > 0) detections.push(`family:${familySituations.join(',')}`);
  if (communityPref) detections.push(`community:${communityPref}`);
  if (studentContext) detections.push(`student:${studentContext.type}${studentContext.institution ? `:${studentContext.institution}` : ''}`);
  if (languagePref) detections.push(`language:${languagePref}`);
  if (familyContext) detections.push(`familyContext:${familyContext}`);
  const exclusionList: string[] = [];
  if (exclusions.religious) exclusionList.push('religious');
  if (exclusions.twelveStep) exclusionList.push('twelveStep');
  if (exclusions.genderRestricted) exclusionList.push(`gender:${exclusions.genderRestricted}`);
  if (exclusionList.length > 0) detections.push(`exclusions:${exclusionList.join(',')}`);
  if (detections.length > 0) {
    console.log(`[ComprehensiveSearch] Detected preferences: ${detections.join(', ')}`);
  }

  // Create a scored copy with multi-factor boosting
  const scored = services.map(svc => {
    let boost = 0;
    const explanations: ScoreExplanation[] = [];
    const text = `${svc.name} ${svc.category} ${svc.description}`;
    const textLower = text.toLowerCase();

    // Helper to add a scoring factor
    const addFactor = (factor: string, value: number, reason: string) => {
      boost += value;
      if (trackExplanations) {
        explanations.push({ factor, value, reason });
      }
    };

    // Intent-based boosting (if applicable)
    if (intentConfig) {
      if (intentConfig.categoryPatterns.test(text)) {
        addFactor('intent.categoryPattern', cfg.intent.categoryPattern, `Matches ${intent} category pattern`);
      }
      const category = svc.category.toLowerCase();
      if (intentConfig.serviceTypes.some(st => category.includes(st.replace('_', ' ')))) {
        addFactor('intent.categoryName', cfg.intent.categoryName, `Category matches ${intent} service type`);
      }
      if (['housing_urgent', 'domestic_violence'].includes(intent) && /24\/7|24 hour/i.test(text)) {
        addFactor('intent.urgentService', cfg.intent.urgentService, `24/7 service for urgent intent`);
      }
    }

    // Location-only boosting
    if (intent === 'location_only') {
      if (/\b(211|information|referral|directory|helpline|help line|community services)\b/i.test(textLower)) {
        addFactor('locationOnly.generalInfo', cfg.locationOnly.generalInfo, `General information/referral service`);
        console.log(`[LocationBoost] "${svc.name.substring(0, 40)}" +${cfg.locationOnly.generalInfo} for general information service`);
      }
      if (/\b(family|community|social services|resource|multi-?service|community centre|community center)\b/i.test(textLower)) {
        addFactor('locationOnly.multiService', cfg.locationOnly.multiService, `Multi-service agency`);
      }
      if (/\b(notary|immigration.*legal|residential treatment|detox|specific program)\b/i.test(textLower)) {
        addFactor('locationOnly.specializedPenalty', cfg.locationOnly.specializedPenalty, `Specialized service penalty for location-only query`);
      }
    }

    // Gender-based boosting
    if (genderPref) {
      const isWomensService = /women|woman|female|mother|girl|domestic violence|yw\s|ywca/i.test(textLower);
      const isMensService = /\bmen\b|male|father|\bmen'?s\b/i.test(textLower) && !isWomensService;
      const menOnlyIndicator = /men'?s.*shelter|men only|males only|for men\b/i.test(textLower);
      const womenOnlyIndicator = /women'?s.*shelter|women only|females only|for women\b/i.test(textLower);

      if (genderPref === 'women_only') {
        if (isWomensService || womenOnlyIndicator) addFactor('gender.matchBoost', cfg.gender.matchBoost, `Matches women-only preference`);
        if (menOnlyIndicator) addFactor('gender.mismatchPenalty', cfg.gender.mismatchPenalty, `Men-only service for women-only query`);
      } else if (genderPref === 'men_only') {
        if (isMensService || menOnlyIndicator) addFactor('gender.matchBoost', cfg.gender.matchBoost, `Matches men-only preference`);
        if (womenOnlyIndicator) addFactor('gender.mismatchPenalty', cfg.gender.mismatchPenalty, `Women-only service for men-only query`);
      }
    }

    // Age group boosting
    if (ageGroup) {
      const isYouthService = /youth|teen|adolescent|young|student|under 25|child|kids?|juvenile|minor|school/i.test(textLower);
      const isSeniorService = /senior|elderly|aging|aged|older adult|65\+|retirement|dementia|alzheimer/i.test(textLower);
      const isAdultService = /\badult\b/i.test(textLower);

      if (ageGroup === 'youth') {
        if (isYouthService) addFactor('ageGroup.youthMatch', cfg.ageGroup.youthMatch, `Youth service matches youth query`);
        if (isSeniorService) addFactor('ageGroup.youthForSeniorPenalty', cfg.ageGroup.youthForSeniorPenalty, `Senior service for youth query`);
        if (isAdultService && !isYouthService) addFactor('ageGroup.youthForAdultPenalty', cfg.ageGroup.youthForAdultPenalty, `Adult-only service for youth query`);
      } else if (ageGroup === 'adult') {
        if (isYouthService && !isAdultService) {
          addFactor('ageGroup.adultForYouthPenalty', cfg.ageGroup.adultForYouthPenalty, `Youth-only service for adult query`);
          console.log(`[AgeBoost] "${svc.name.substring(0, 40)}" ${cfg.ageGroup.adultForYouthPenalty} penalty for youth service (adult query)`);
        }
        if (isAdultService) {
          addFactor('ageGroup.adultMatch', cfg.ageGroup.adultMatch, `Adult service matches adult query`);
          console.log(`[AgeBoost] "${svc.name.substring(0, 40)}" +${cfg.ageGroup.adultMatch} for adult service (adult query)`);
        }
        if (isSeniorService) addFactor('ageGroup.adultForSeniorPenalty', cfg.ageGroup.adultForSeniorPenalty, `Senior service for adult query`);
      } else if (ageGroup === 'senior') {
        if (isSeniorService) addFactor('ageGroup.seniorMatch', cfg.ageGroup.seniorMatch, `Senior service matches senior query`);
        if (isYouthService && /only|exclusive/i.test(textLower)) addFactor('ageGroup.seniorYouthOnlyPenalty', cfg.ageGroup.seniorYouthOnlyPenalty, `Youth-only service for senior query`);
      }
    }

    // Urgency boosting
    if (urgency === 'immediate') {
      if (/24\/7|24 hour|walk-?in|emergency|crisis|immediate|no appointment|same day|drop-?in|open now/i.test(textLower)) {
        addFactor('urgency.immediateAccess', cfg.urgency.immediateAccess, `Immediate access service`);
      }
      if (/appointment required|waitlist|intake process|wait time|waiting list/i.test(textLower)) {
        addFactor('urgency.appointmentPenalty', cfg.urgency.appointmentPenalty, `Requires appointment for urgent query`);
      }
    }

    // "No waitlist" query boosting - applies noWaitlistBoost to walk-in/immediate access services
    const rawQueryLower = rawQuery.toLowerCase();
    const isNoWaitlistQuery = /\b(no wait|no waitlist|without wait|walk[\s-]?in|immediate|can'?t wait)\b/i.test(rawQueryLower);
    if (isNoWaitlistQuery) {
      if (/walk-?in|no appointment|same day|drop-?in|immediate access|no wait|open now|24\/7|24 hour/i.test(textLower)) {
        addFactor('exclusion.noWaitlistBoost', cfg.exclusion.noWaitlistBoost, `Walk-in/immediate access for no-waitlist query`);
        console.log(`[NoWaitlistBoost] "${svc.name.substring(0, 40)}" +${cfg.exclusion.noWaitlistBoost} for immediate access`);
      }
      // Penalize services that explicitly mention waitlists
      if (/waitlist|waiting list|wait time|intake process|referral required/i.test(textLower)) {
        addFactor('exclusion.waitlist', cfg.exclusion.waitlist, `Has waitlist for no-waitlist query`);
        console.log(`[NoWaitlistPenalty] "${svc.name.substring(0, 40)}" ${cfg.exclusion.waitlist} for waitlist mention`);
      }
    }

    // Disability/Autism boosting
    const queryLower = (analysis?.raw || rawQuery || '').toLowerCase();
    const isDisabilityQuery = /\b(autis|autism|autistic|ASD|asperger|ADHD|ADD|disability|disabled|neurodivergent|neurodiverse|on the spectrum|sensory|developmental|AISH|PDD)\b/i.test(queryLower);
    const isADHDQuery = /\b(ADHD|ADD|attention deficit|hyperactiv|executive function)\b/i.test(queryLower);
    const hasSocialIsolation = /\b(friend|friends|friendship|lonely|isolated|social|connect|relationship|alone)\b/i.test(queryLower);

    if (isDisabilityQuery) {
      if (/\b(autis|autism|autistic|ASD|asperger|on the spectrum)\b/i.test(textLower)) {
        addFactor('disability.autismMatch', cfg.disability.autismMatch, `Autism/ASD service match`);
        console.log(`[DisabilityBoost] "${svc.name.substring(0, 40)}" +${cfg.disability.autismMatch} for autism match`);
      }
      if (/\b(disability|disabled|AISH|PDD|developmental|persons with disabilities|accessibility|accommodations?)\b/i.test(textLower)) {
        addFactor('disability.disabilityServices', cfg.disability.disabilityServices, `Disability services match`);
        console.log(`[DisabilityBoost] "${svc.name.substring(0, 40)}" +${cfg.disability.disabilityServices} for disability services`);
      }
      if (/\b(neurodivergent|neurodiverse|ADHD|ADD|attention deficit|sensory processing|learning disability|executive function)\b/i.test(textLower)) {
        addFactor('disability.neurodivergentMatch', cfg.disability.neurodivergentMatch, `Neurodivergent service match`);
        console.log(`[DisabilityBoost] "${svc.name.substring(0, 40)}" +${cfg.disability.neurodivergentMatch} for neurodivergent match`);
      }
      if (hasSocialIsolation && /\b(social skills|social support|support group|peer support|life skills|community|friends|friendship|social program)\b/i.test(textLower)) {
        addFactor('disability.socialSupport', cfg.disability.socialSupport, `Social support for disability + isolation query`);
        console.log(`[DisabilityBoost] "${svc.name.substring(0, 40)}" +${cfg.disability.socialSupport} for social support (disability + isolation query)`);
      }
      if (/\b(support group|peer support|community program|drop-in|meetup)\b/i.test(textLower)) {
        addFactor('disability.supportGroup', cfg.disability.supportGroup, `Support group/peer support`);
      }
      if (boost === 0 && /\b(mental health|counselling|therapy|psycholog)\b/i.test(textLower)) {
        addFactor('disability.genericMentalHealthPenalty', cfg.disability.genericMentalHealthPenalty, `Generic mental health for disability query`);
        console.log(`[DisabilityBoost] "${svc.name.substring(0, 40)}" ${cfg.disability.genericMentalHealthPenalty} for generic mental health (disability query)`);
      }
    }

    // ADHD-specific boosting
    if (isADHDQuery) {
      if (/\b(ADHD|ADD|attention deficit|hyperactivity|executive function)\b/i.test(textLower)) {
        addFactor('adhd.adhdSpecific', cfg.adhd.adhdSpecific, `ADHD-specific service`);
        console.log(`[ADHDBoost] "${svc.name.substring(0, 40)}" +${cfg.adhd.adhdSpecific} for ADHD-specific`);
      }
      if (/\b(psychological.*assessment|psych.*assessment|neuropsych|cognitive assessment|diagnostic)\b/i.test(textLower)) {
        addFactor('adhd.assessmentServices', cfg.adhd.assessmentServices, `Assessment/diagnostic services`);
        console.log(`[ADHDBoost] "${svc.name.substring(0, 40)}" +${cfg.adhd.assessmentServices} for assessment services`);
      }
      if (/\b(coaching|life skills|executive.*coaching|organization|time management)\b/i.test(textLower)) {
        addFactor('adhd.coachingSkills', cfg.adhd.coachingSkills, `Coaching/skills training`);
        console.log(`[ADHDBoost] "${svc.name.substring(0, 40)}" +${cfg.adhd.coachingSkills} for coaching/skills`);
      }
      if (/\b(psychiatr|psychiatric|medication|prescription)\b/i.test(textLower)) {
        addFactor('adhd.psychiatry', cfg.adhd.psychiatry, `Psychiatric/medication services`);
        console.log(`[ADHDBoost] "${svc.name.substring(0, 40)}" +${cfg.adhd.psychiatry} for psychiatry`);
      }
      if (/\b(eating disorder|substance|addiction|domestic violence|shelter)\b/i.test(textLower)) {
        if (!/\b(ADHD|ADD|attention|neurodivergent)\b/i.test(textLower)) {
          addFactor('adhd.unrelatedPenalty', cfg.adhd.unrelatedPenalty, `Unrelated service for ADHD query`);
          console.log(`[ADHDBoost] "${svc.name.substring(0, 40)}" ${cfg.adhd.unrelatedPenalty} penalty (not ADHD related)`);
        }
      }
    }

    // Crisis query detection
    const isCrisisQuery = intent === 'crisis' || /\b(kill myself|suicide|want to die|end it all|don'?t want to (live|be here)|nobody.*miss me|no one.*care|burden|hopeless|give up|can'?t go on|not worth living|better off dead|cut myself|self-?harm)\b/i.test(queryLower);
    if (isCrisisQuery) {
      if (/\b(988|crisis|suicide|helpline|hotline|distress|prevention)\b/i.test(textLower)) {
        addFactor('crisis.crisisHelpline', cfg.crisis.crisisHelpline, `Crisis/suicide helpline service`);
        console.log(`[CrisisBoost] "${svc.name.substring(0, 40)}" +${cfg.crisis.crisisHelpline} for crisis services`);
      }
      if (/\bcris(is|es)\b/i.test(svc.category || '')) {
        addFactor('crisis.crisisCategory', cfg.crisis.crisisCategory, `Crisis category service`);
        console.log(`[CrisisBoost] "${svc.name.substring(0, 40)}" +${cfg.crisis.crisisCategory} for Crisis category`);
      }
      if (/\b(crisis.*line|crisis.*team|crisis.*support|mental.*crisis|immediate.*help|24.?7|24.*hour)\b/i.test(textLower)) {
        addFactor('crisis.crisisSupport', cfg.crisis.crisisSupport, `24/7 crisis support`);
        console.log(`[CrisisBoost] "${svc.name.substring(0, 40)}" +${cfg.crisis.crisisSupport} for crisis support`);
      }
      if (/\b(counsell?ing|mental health|therapy|psycholog)\b/i.test(textLower) && !/\b(grief|bereavement|loss|mourning)\b/i.test(textLower)) {
        addFactor('crisis.mentalHealthCrisis', cfg.crisis.mentalHealthCrisis, `Mental health service for crisis`);
      }
      if (/\b(grief|bereavement|loss|mourning|hospice|palliative|funeral|memorial|widows?|survivors of loss)\b/i.test(textLower) &&
          !/\b(crisis|suicide|helpline|hotline|distress)\b/i.test(textLower)) {
        addFactor('crisis.griefPenalty', cfg.crisis.griefPenalty, `Grief service for crisis query`);
        console.log(`[CrisisBoost] "${svc.name.substring(0, 40)}" ${cfg.crisis.griefPenalty} penalty for grief service (crisis query)`);
      }
      if (/\b(detox|rehab|residential treatment|recovery house)\b/i.test(textLower)) {
        addFactor('crisis.addictionTreatmentPenalty', cfg.crisis.addictionTreatmentPenalty, `Addiction treatment for crisis query`);
        console.log(`[CrisisBoost] "${svc.name.substring(0, 40)}" ${cfg.crisis.addictionTreatmentPenalty} penalty for addiction treatment (crisis query)`);
      }
      if (/\b(gambling|casino|lottery|gaming|wagering)\b/i.test(textLower)) {
        addFactor('crisis.gamblingPenalty', cfg.crisis.gamblingPenalty, `Gambling service for crisis query`);
        console.log(`[CrisisBoost] "${svc.name.substring(0, 40)}" ${cfg.crisis.gamblingPenalty} penalty for gambling service (crisis query)`);
      }
      if (/\b(day hospital|day program|outpatient program)\b/i.test(textLower) && !/\bcris(is|es)\b/i.test(textLower)) {
        addFactor('crisis.dayProgramPenalty', cfg.crisis.dayProgramPenalty, `Day program for crisis query`);
        console.log(`[CrisisBoost] "${svc.name.substring(0, 40)}" ${cfg.crisis.dayProgramPenalty} penalty for day program (crisis query)`);
      }
    }

    // Grief support boosting (only if NOT a crisis query)
    const isGriefQuery = !isCrisisQuery && /\b(grief|loss|died|passed away|mourning|bereavement|death of|widow|murdered|killed|homicide|suicide loss|overdose death|miscarriage|stillbirth|stillborn|infant loss|pregnancy loss|SIDS|pet died|dog died|cat died|put to sleep|drowned|accident|terminal|cancer|my dog|my cat|my pet)\b/i.test(queryLower);
    const isPetLossQuery = /\b(pet|dog|cat|animal).*(died|loss|passed|death|put to sleep|euthanized|put down)\b/i.test(queryLower) || /\b(died|lost|passed).*(pet|dog|cat|animal)\b/i.test(queryLower);
    const isMiscarriageQuery = /\b(miscarriage|stillbirth|stillborn|pregnancy loss|infant loss|SIDS|baby loss|lost the baby|baby died)\b/i.test(queryLower);
    const isViolentLossQuery = /\b(murder|murdered|killed|homicide|violent|suicide|overdose|accident|shooting|stabbing)\b/i.test(queryLower);
    if (isGriefQuery) {
      if (/\b(grief|bereavement|loss|mourning|hospice|palliative|widow|memorial|funeral|survivors?|violent loss)\b/i.test(textLower)) {
        addFactor('grief.generalGrief', cfg.grief.generalGrief, `Grief/bereavement service`);
        console.log(`[GriefBoost] "${svc.name.substring(0, 40)}" +${cfg.grief.generalGrief} for grief support`);
      }
      if (isMiscarriageQuery) {
        if (/\b(miscarriage|stillbirth|pregnancy loss|infant loss|perinatal|SIDS|baby loss|perinatal)\b/i.test(textLower)) {
          addFactor('grief.pregnancyInfantLoss', cfg.grief.pregnancyInfantLoss, `Pregnancy/infant loss support`);
          console.log(`[GriefBoost] "${svc.name.substring(0, 40)}" +${cfg.grief.pregnancyInfantLoss} for pregnancy/infant loss match`);
        }
        if (/\b(pregnancy|prenatal|postpartum|maternal|maternity)\b/i.test(textLower) && /\b(loss|grief|bereavement|support)\b/i.test(textLower)) {
          addFactor('grief.generalGrief', cfg.grief.generalGrief, `Pregnancy loss support`);
          console.log(`[GriefBoost] "${svc.name.substring(0, 40)}" +${cfg.grief.generalGrief} for pregnancy loss support`);
        }
      }
      if (isPetLossQuery) {
        if (/\b(pet loss|pet bereavement|pet grief|animal loss|companion animal)\b/i.test(textLower)) {
          addFactor('grief.petLoss', cfg.grief.petLoss, `Pet loss support`);
          console.log(`[GriefBoost] "${svc.name.substring(0, 40)}" +${cfg.grief.petLoss} for pet loss match`);
        }
        if (/\b(grief|bereavement|loss support|counsell?ing)\b/i.test(textLower)) {
          addFactor('grief.supportGroup', cfg.grief.supportGroup, `Grief support group`);
        }
        if (/\b(crisis line|shelter|housing|emergency|domestic violence)\b/i.test(textLower)) {
          addFactor('grief.crisisShelterPenalty', cfg.grief.crisisShelterPenalty, `Crisis/shelter for pet loss query`);
        }
      }
      if (isViolentLossQuery && /\b(violent loss|homicide|survivors|trauma|violent crime|victim)\b/i.test(textLower)) {
        addFactor('grief.violentLoss', cfg.grief.violentLoss, `Violent loss/homicide survivor support`);
        console.log(`[GriefBoost] "${svc.name.substring(0, 40)}" +${cfg.grief.violentLoss} for violent loss support`);
      }
      if (/\b(support group|peer support|counsell?ing)\b/i.test(textLower)) {
        addFactor('grief.supportGroup', cfg.grief.supportGroup, `Grief support/counselling`);
      }
      if (boost === 0 && /\b(mental health|counselling|therapy)\b/i.test(textLower)) {
        addFactor('grief.genericMentalHealthPenalty', cfg.grief.genericMentalHealthPenalty, `Generic mental health for grief query`);
      }
    }

    // Postpartum depression boosting
    const isPostpartumQuery = /\b(postpartum|post-?partum|PPD|perinatal|baby blues|new mom|after giving birth|after having a baby)\b/i.test(queryLower);
    if (isPostpartumQuery) {
      if (/\b(postpartum|post-?partum|PPD|perinatal|maternal|baby blues)\b/i.test(textLower)) {
        addFactor('postpartum.postpartumSpecific', cfg.postpartum.postpartumSpecific, `Postpartum-specific service`);
        console.log(`[PostpartumBoost] "${svc.name.substring(0, 40)}" +${cfg.postpartum.postpartumSpecific} for postpartum-specific`);
      }
      if (/\b(women'?s.*mental|maternal.*mental|women'?s.*health|perinatal.*program)\b/i.test(textLower)) {
        addFactor('postpartum.womensMentalHealth', cfg.postpartum.womensMentalHealth, `Women's mental health service`);
        console.log(`[PostpartumBoost] "${svc.name.substring(0, 40)}" +${cfg.postpartum.womensMentalHealth} for women's mental health`);
      }
      if (/\b(pregnancy|pregnant|birth|baby|newborn|infant|new mom|new mother)\b/i.test(textLower) && /\b(depression|anxiety|mental|counsell?ing|support)\b/i.test(textLower)) {
        addFactor('postpartum.pregnancyMentalHealth', cfg.postpartum.pregnancyMentalHealth, `Pregnancy + mental health service`);
        console.log(`[PostpartumBoost] "${svc.name.substring(0, 40)}" +${cfg.postpartum.pregnancyMentalHealth} for pregnancy + mental health`);
      }
      if (/\b(mental health|counsell?ing|therapy|depression|anxiety)\b/i.test(textLower)) {
        addFactor('postpartum.generalMentalHealth', cfg.postpartum.generalMentalHealth, `General mental health service`);
      }
      if (/\b(addiction|substance|alcohol|drug|shelter|homeless|detox|residential treatment)\b/i.test(textLower)) {
        if (!/\b(postpartum|perinatal|women'?s|maternal|pregnancy)\b/i.test(textLower)) {
          addFactor('postpartum.unrelatedPenalty', cfg.postpartum.unrelatedPenalty, `Unrelated service for postpartum query`);
          console.log(`[PostpartumBoost] "${svc.name.substring(0, 40)}" ${cfg.postpartum.unrelatedPenalty} penalty (not postpartum related)`);
        }
      }
    }

    // Senior services boosting
    const isSeniorQuery = /\b(senior|elderly|aging|aged|65\+|70\+|old parent|dementia|alzheimer|geriatric)\b/i.test(queryLower);
    if (isSeniorQuery) {
      if (/\b(senior|elderly|aging|older adult|65\+|retirement|dementia|alzheimer|home care|geriatric)\b/i.test(textLower)) {
        addFactor('senior.seniorServices', cfg.senior.seniorServices, `Senior/elderly service`);
        console.log(`[SeniorBoost] "${svc.name.substring(0, 40)}" +${cfg.senior.seniorServices} for senior services`);
      }
      if (/\b(meals on wheels|senior center|senior centre|elder|assisted living)\b/i.test(textLower)) {
        addFactor('senior.additionalSenior', cfg.senior.additionalSenior, `Additional senior service match`);
      }
      if (/\b(youth only|under 25|teen only|kids only|children only)\b/i.test(textLower)) {
        addFactor('senior.youthOnlyPenalty', cfg.senior.youthOnlyPenalty, `Youth-only service for senior query`);
      }
    }

    // Legal aid boosting
    const isLegalQuery = /\b(lawyer|legal|court|custody|divorce|immigration|tenant rights|charges)\b/i.test(queryLower);
    const isTenantEvictionQuery = /\b(tenant|eviction|evicted|getting evicted|being evicted|landlord|renter|rental|lease|rtdrs)\b/i.test(queryLower);
    const isUrgentEvictionQuery = isTenantEvictionQuery && /\b(tomorrow|tonight|today|urgent|emergency|need help|about to|going to be)\b/i.test(queryLower);
    if (isLegalQuery || isTenantEvictionQuery) {
      if (isTenantEvictionQuery) {
        if (/\b(tenant|eviction|landlord|renter|rental|housing.*rights|residential tenancies|rtdrs|lease)\b/i.test(textLower)) {
          addFactor('legal.tenantEviction', cfg.legal.tenantEviction, `Tenant/eviction legal service`);
          console.log(`[TenantLegalBoost] "${svc.name.substring(0, 40)}" +${cfg.legal.tenantEviction} for tenant/eviction legal`);
        }
        if (/\b(legal aid|pro bono|free legal|legal clinic|student legal|community legal)\b/i.test(textLower)) {
          addFactor('legal.legalAidEviction', cfg.legal.legalAidEviction, `Legal aid for eviction query`);
          console.log(`[TenantLegalBoost] "${svc.name.substring(0, 40)}" +${cfg.legal.legalAidEviction} for legal aid (eviction query)`);
        }
        if (/\b(housing|landlord.*tenant|residential|civil law|housing connect)\b/i.test(textLower)) {
          addFactor('legal.housingLegal', cfg.legal.housingLegal, `Housing legal service`);
          console.log(`[TenantLegalBoost] "${svc.name.substring(0, 40)}" +${cfg.legal.housingLegal} for housing legal`);
        }
        if (isUrgentEvictionQuery) {
          if (/\b(emergency.*legal|urgent.*legal|immediate|same.*day)\b/i.test(textLower)) {
            addFactor('legal.urgentEviction', cfg.legal.urgentEviction, `Urgent eviction legal service`);
            console.log(`[TenantLegalBoost] "${svc.name.substring(0, 40)}" +${cfg.legal.urgentEviction} for urgent eviction legal`);
          }
        }
        if (/\b(emergency shelter|homeless shelter|beds.*available|overnight|sleep)\b/i.test(textLower) &&
            !/\b(legal|rights|tenant|eviction)\b/i.test(textLower)) {
          addFactor('legal.shelterInTenantPenalty', cfg.legal.shelterInTenantPenalty, `Shelter for tenant rights query`);
          console.log(`[TenantLegalBoost] "${svc.name.substring(0, 40)}" ${cfg.legal.shelterInTenantPenalty} penalty for shelter (tenant rights query)`);
        }
      }
      if (/\b(legal aid|pro bono|free legal|low cost legal|lawyer referral)\b/i.test(textLower)) {
        addFactor('legal.legalAid', cfg.legal.legalAid, `Legal aid service`);
        console.log(`[LegalBoost] "${svc.name.substring(0, 40)}" +${cfg.legal.legalAid} for legal aid`);
      }
      if (/\b(lawyer|attorney|law.*society|legal.*services|court)\b/i.test(textLower)) {
        addFactor('legal.lawyerGeneral', cfg.legal.lawyerGeneral, `General legal/lawyer service`);
      }
    }

    // Penalize legal services in non-legal queries
    const isCounsellingQuery = /\b(counsell?ing|therapy|therap|mental health|depression|anxiety|support group)\b/i.test(queryLower);
    if (isCounsellingQuery && !isLegalQuery) {
      if (/\b(legal aid|pro bono|lawyer|law society|court|legal services)\b/i.test(textLower)) {
        addFactor('legal.legalInCounsellingPenalty', cfg.legal.legalInCounsellingPenalty, `Legal service for counselling query`);
        console.log(`[LegalPenalty] "${svc.name.substring(0, 40)}" ${cfg.legal.legalInCounsellingPenalty} for legal service in counselling query`);
      }
    }

    // Employment support boosting
    const isEmploymentQuery = /\b(job|employment|career|unemployed|laid off|fired|work|EI|resume)\b/i.test(queryLower);
    if (isEmploymentQuery) {
      if (/\b(employment|job.*training|career|workforce|resume|interview|employment services)\b/i.test(textLower)) {
        addFactor('employment.employmentSupport', cfg.employment.employmentSupport, `Employment support service`);
        console.log(`[EmploymentBoost] "${svc.name.substring(0, 40)}" +${cfg.employment.employmentSupport} for employment support`);
      }
      if (/\b(apprentice|skills training|job search|employment insurance|EI)\b/i.test(textLower)) {
        addFactor('employment.additionalEmployment', cfg.employment.additionalEmployment, `Additional employment service match`);
      }
    }

    // Youth services boosting
    const isYouthQuery = /\b(teen|teenager|adolescent|youth|young adult|my kid|my child|under 18|runaway)\b/i.test(queryLower);
    const isYouthShelterQuery = isYouthQuery && /\b(shelter|housing|homeless|place to stay|sleep)\b/i.test(queryLower);
    if (isYouthQuery) {
      if (isYouthShelterQuery && /\b(youth.*shelter|youth.*housing|teen.*shelter|runaway.*shelter|emergency.*shelter|shelter)\b/i.test(textLower)) {
        addFactor('youth.youthShelter', cfg.youth.youthShelter, `Youth shelter service`);
        console.log(`[YouthBoost] "${svc.name.substring(0, 40)}" +${cfg.youth.youthShelter} for youth shelter`);
      }
      if (/\b(youth|teen|adolescent|young adult|under 25|kids help phone|runaway)\b/i.test(textLower)) {
        addFactor('youth.youthServices', cfg.youth.youthServices, `Youth service`);
        console.log(`[YouthBoost] "${svc.name.substring(0, 40)}" +${cfg.youth.youthServices} for youth services`);
      }
      if (/\b(senior only|65\+|elderly only|seniors only)\b/i.test(textLower)) {
        addFactor('youth.seniorOnlyPenalty', cfg.youth.seniorOnlyPenalty, `Senior-only service for youth query`);
      }
      if (isYouthShelterQuery && !/\b(shelter|housing|residential|emergency)\b/i.test(textLower)) {
        addFactor('youth.nonShelterPenalty', cfg.youth.nonShelterPenalty, `Non-shelter for youth shelter query`);
      }
    }

    // Newcomer services boosting
    const isNewcomerQuery = /\b(newcomer|immigrant|refugee|new to canada|settlement|ESL|asylum|citizenship)\b/i.test(queryLower);
    if (isNewcomerQuery) {
      if (/\b(immigrant|refugee|newcomer|settlement|ESL|language|citizenship|sponsorship)\b/i.test(textLower)) {
        addFactor('newcomer.newcomerServices', cfg.newcomer.newcomerServices, `Newcomer/immigrant service`);
        console.log(`[NewcomerBoost] "${svc.name.substring(0, 40)}" +${cfg.newcomer.newcomerServices} for newcomer services`);
      }
      if (/\b(work permit|visa|immigration|asylum|refugee services)\b/i.test(textLower)) {
        addFactor('newcomer.additionalNewcomer', cfg.newcomer.additionalNewcomer, `Additional newcomer service match`);
      }
    }

    // Family addiction support boosting
    const isFamilyAddictionQuery =
      /\b(my|our).*(spouse|husband|wife|partner|parent|child|son|daughter|family|loved one).*(addict|alcohol|drug|drinking|using)\b/i.test(queryLower) ||
      /\b(al-?anon|nar-?anon)\b/i.test(queryLower) ||
      /\bliving with.*(addict|alcoholic|someone who|substance)\b/i.test(queryLower) ||
      /\b(loved one|family member|someone i (know|love|care)).*(addict|alcohol|drug)\b/i.test(queryLower) ||
      /\b(living with an addict|spouse.*addict|partner.*addict)\b/i.test(queryLower);
    if (isFamilyAddictionQuery) {
      if (/\b(al-?anon|nar-?anon)\b/i.test(textLower)) {
        addFactor('familyAddiction.alAnon', cfg.familyAddiction.alAnon, `Al-Anon/Nar-Anon service`);
        console.log(`[FamilyAddictionBoost] "${svc.name.substring(0, 40)}" +${cfg.familyAddiction.alAnon} for Al-Anon/Nar-Anon`);
      }
      if (/\b(family.*support|loved one.*support|concerned.*persons?|codependent|family.*addiction|support.*famil|family group)\b/i.test(textLower)) {
        addFactor('familyAddiction.familySupport', cfg.familyAddiction.familySupport, `Family addiction support service`);
        console.log(`[FamilyAddictionBoost] "${svc.name.substring(0, 40)}" +${cfg.familyAddiction.familySupport} for family addiction support`);
      }
      if (/\b(support group|peer support|meeting|fellowship)\b/i.test(textLower)) {
        addFactor('familyAddiction.supportGroup', cfg.familyAddiction.supportGroup, `Support group/peer support`);
        console.log(`[FamilyAddictionBoost] "${svc.name.substring(0, 40)}" +${cfg.familyAddiction.supportGroup} for support group`);
      }
      if (/\b(detox|rehab|residential treatment|treatment center|inpatient|recovery house|treatment program|withdrawal|outpatient treatment)\b/i.test(textLower)) {
        addFactor('familyAddiction.treatmentPenalty', cfg.familyAddiction.treatmentPenalty, `Treatment service for family support query`);
        console.log(`[FamilyAddictionBoost] "${svc.name.substring(0, 40)}" ${cfg.familyAddiction.treatmentPenalty} penalty for treatment (wrong target)`);
      }
      if (/\b(opioid|methadone|suboxone|naloxone|harm reduction|safer.*use|needle|syringe)\b/i.test(textLower)) {
        addFactor('familyAddiction.harmReductionPenalty', cfg.familyAddiction.harmReductionPenalty, `Harm reduction for family support query`);
        console.log(`[FamilyAddictionBoost] "${svc.name.substring(0, 40)}" ${cfg.familyAddiction.harmReductionPenalty} penalty for harm reduction (wrong target)`);
      }
    }

    // Financial support boosting
    const isFinancialQuery = /\b(debt|bills?|financial|money|can'?t afford|bankruptcy|collections?|credit)\b/i.test(queryLower);
    const isCreditCounsellingQuery = /\b(credit counsell?ing|credit.*help|debt.*counsel|financial.*counsel)\b/i.test(queryLower);
    if (isFinancialQuery) {
      if (/\b(credit counsell?ing|financial counsell?ing|debt.*counsell?ing|money management|budget.*counsel|debt relief)\b/i.test(textLower)) {
        addFactor('financial.creditCounselling', cfg.financial.creditCounselling, `Credit/financial counselling service`);
        console.log(`[FinancialBoost] "${svc.name.substring(0, 40)}" +${cfg.financial.creditCounselling} for credit/financial counselling`);
      }
      if (/\b(financial|debt|bankruptcy|money management|budget|financial literacy)\b/i.test(textLower)) {
        addFactor('financial.financialSupport', cfg.financial.financialSupport, `Financial support service`);
        console.log(`[FinancialBoost] "${svc.name.substring(0, 40)}" +${cfg.financial.financialSupport} for financial support`);
      }
      if (/\b(payday loan|collections?|bills|utilities assistance)\b/i.test(textLower)) {
        addFactor('financial.additional', cfg.financial.additional, `Additional financial service match`);
      }
      if (isCreditCounsellingQuery && /\b(mental health|psychological|therapy|psycholog|emotion|depression|anxiety)\b/i.test(textLower)) {
        if (!/\b(financial|debt|credit|money|budget)\b/i.test(textLower)) {
          addFactor('financial.mentalHealthPenalty', cfg.financial.mentalHealthPenalty, `Mental health for credit counselling query`);
          console.log(`[FinancialBoost] "${svc.name.substring(0, 40)}" ${cfg.financial.mentalHealthPenalty} penalty for mental health in credit query`);
        }
      }
    }

    // Caregiver support boosting
    const isCaregiverQuery = /\b(caregiver|caregiving|caring for|looking after|respite|burnout.*car|exhausted.*car)\b/i.test(queryLower);
    const isCaregiverBurnoutQuery = /\b(caregiver.*burnout|burnout.*caregiver|exhausted.*caregiver|caregiver.*stress|caregiver.*exhaust)\b/i.test(queryLower);
    if (isCaregiverQuery) {
      if (/\b(caregiver|respite|family caregiver|caregiver support|caregiver burnout)\b/i.test(textLower)) {
        addFactor('caregiver.caregiverSupport', cfg.caregiver.caregiverSupport, `Caregiver support service`);
        console.log(`[CaregiverBoost] "${svc.name.substring(0, 40)}" +${cfg.caregiver.caregiverSupport} for caregiver support`);
      }
      if (/\b(adult day|day program|respite care|respite service)\b/i.test(textLower)) {
        addFactor('caregiver.dayProgramRespite', cfg.caregiver.dayProgramRespite, `Day program/respite service`);
        console.log(`[CaregiverBoost] "${svc.name.substring(0, 40)}" +${cfg.caregiver.dayProgramRespite} for day program/respite`);
      }
      if (/\b(caring for|looking after|support for families|family support)\b/i.test(textLower)) {
        addFactor('caregiver.familySupport', cfg.caregiver.familySupport, `Family support service`);
      }
      if (isCaregiverBurnoutQuery) {
        if (/\b(counsell?ing|therapy|mental health|support group)\b/i.test(textLower) && /\b(caregiver|family|stress)\b/i.test(textLower)) {
          addFactor('caregiver.caregiverCounselling', cfg.caregiver.caregiverCounselling, `Caregiver counselling service`);
          console.log(`[CaregiverBoost] "${svc.name.substring(0, 40)}" +${cfg.caregiver.caregiverCounselling} for caregiver counselling`);
        }
        if (/\b(bereavement|grief counsell?ing|loss of|mourning)\b/i.test(textLower) && !/\b(caregiver|respite)\b/i.test(textLower)) {
          addFactor('caregiver.griefPenalty', cfg.caregiver.griefPenalty, `Grief service for caregiver burnout query`);
          console.log(`[CaregiverBoost] "${svc.name.substring(0, 40)}" ${cfg.caregiver.griefPenalty} penalty for grief (burnout query)`);
        }
      }
    }

    // LGBTQ+ services boosting
    const isLgbtqQuery = /\b(lgbtq|lgbt|queer|trans|transgender|gay|lesbian|bisexual|non-?binary|coming out|pride|2slgbtq)\b/i.test(queryLower);
    const isLgbtqSeniorQuery = isLgbtqQuery && /\b(senior|elderly|aging|older|65\+|retirement)\b/i.test(queryLower);
    const isLgbtqHousingQuery = isLgbtqQuery && /\b(housing|shelter|place to stay|home|living)\b/i.test(queryLower);
    if (isLgbtqQuery) {
      if (/\b(lgbtq|lgbt|queer|trans|transgender|gay|lesbian|bisexual|non-?binary|pride|2slgbtq)\b/i.test(textLower)) {
        addFactor('lgbtq.lgbtqServices', cfg.lgbtq.lgbtqServices, `LGBTQ+ service`);
        console.log(`[LGBTQBoost] "${svc.name.substring(0, 40)}" +${cfg.lgbtq.lgbtqServices} for LGBTQ+ services`);
      }
      if (/\b(gender affirming|hormone therapy|coming out|pride center|pride centre)\b/i.test(textLower)) {
        addFactor('lgbtq.genderAffirming', cfg.lgbtq.genderAffirming, `Gender affirming service`);
      }
      if (isLgbtqSeniorQuery) {
        if (/\b(senior|elderly|aging|older adult|65\+)\b/i.test(textLower) && /\b(lgbtq|lgbt|queer|trans|gay|lesbian|pride)\b/i.test(textLower)) {
          addFactor('lgbtq.lgbtqSenior', cfg.lgbtq.lgbtqSenior, `LGBTQ+ senior service`);
          console.log(`[LGBTQBoost] "${svc.name.substring(0, 40)}" +${cfg.lgbtq.lgbtqSenior} for LGBTQ+ senior services`);
        }
        if (/\b(senior|elderly).*\b(housing|living|care)\b/i.test(textLower)) {
          addFactor('lgbtq.seniorHousing', cfg.lgbtq.seniorHousing, `Senior housing for LGBTQ+ query`);
          console.log(`[LGBTQBoost] "${svc.name.substring(0, 40)}" +${cfg.lgbtq.seniorHousing} for senior housing (LGBTQ query)`);
        }
        if (/\b(youth only|under 25|teen|young adult)\b/i.test(textLower)) {
          addFactor('lgbtq.youthOnlyPenalty', cfg.lgbtq.youthOnlyPenalty, `Youth-only for LGBTQ+ senior query`);
          console.log(`[LGBTQBoost] "${svc.name.substring(0, 40)}" ${cfg.lgbtq.youthOnlyPenalty} penalty for youth-only (senior query)`);
        }
      }
      if (isLgbtqHousingQuery) {
        if (/\b(housing|shelter|residence|supportive housing|safe house)\b/i.test(textLower)) {
          addFactor('lgbtq.lgbtqHousing', cfg.lgbtq.lgbtqHousing, `LGBTQ+ housing service`);
          console.log(`[LGBTQBoost] "${svc.name.substring(0, 40)}" +${cfg.lgbtq.lgbtqHousing} for LGBTQ+ housing`);
        }
      }
    }

    // Veteran/military services boosting
    const isVeteranQuery = /\b(veteran|veterans?|military|armed forces|canadian forces|ex-?military|former military|CAF|CFB|deployed|served|combat)\b/i.test(queryLower);
    const isVeteranPTSDQuery = isVeteranQuery && /\b(PTSD|post-?traumatic|trauma)\b/i.test(queryLower);
    const isHomelessVeteranQuery = isVeteranQuery && /\b(homeless|shelter|housing|nowhere.*stay|no.*home|street)\b/i.test(queryLower);
    if (isVeteranQuery) {
      if (/\b(veteran|veterans?|VAC|veterans affairs|OSISS|OSI-CAN|operational stress|legion|royal canadian legion|VETS Canada|wounded warriors)\b/i.test(textLower)) {
        addFactor('veteran.veteranServices', cfg.veteran.veteranServices, `Veteran service`);
        console.log(`[VeteranBoost] "${svc.name.substring(0, 40)}" +${cfg.veteran.veteranServices} for veteran services`);
      }
      if (/\b(military|armed forces|canadian forces|CAF|CFB|combat|deployment|service member|first responder)\b/i.test(textLower)) {
        addFactor('veteran.militaryServices', cfg.veteran.militaryServices, `Military service`);
        console.log(`[VeteranBoost] "${svc.name.substring(0, 40)}" +${cfg.veteran.militaryServices} for military services`);
      }
      if (/\b(PTSD|post-?traumatic|traumatic stress|combat stress|operational stress)\b/i.test(textLower)) {
        addFactor('veteran.ptsdServices', cfg.veteran.ptsdServices, `PTSD/trauma service`);
        console.log(`[VeteranBoost] "${svc.name.substring(0, 40)}" +${cfg.veteran.ptsdServices} for PTSD services`);
      }
      if (/\b(peer support|support group)\b/i.test(textLower)) {
        addFactor('veteran.peerSupport', cfg.veteran.peerSupport, `Peer support service`);
      }
      if (isHomelessVeteranQuery) {
        if (/\b(veteran|military)\b/i.test(textLower) && /\b(housing|shelter|homeless|supportive housing)\b/i.test(textLower)) {
          addFactor('veteran.homelessVeteranHousing', cfg.veteran.homelessVeteranHousing, `Homeless veteran housing`);
          console.log(`[HomelessVeteranBoost] "${svc.name.substring(0, 40)}" +${cfg.veteran.homelessVeteranHousing} for homeless veteran housing`);
        }
        if (/\b(emergency shelter|homeless shelter|housing.*first|supportive housing|transitional housing|shelter)\b/i.test(textLower)) {
          addFactor('veteran.generalShelter', cfg.veteran.generalShelter, `General shelter for veteran query`);
          console.log(`[HomelessVeteranBoost] "${svc.name.substring(0, 40)}" +${cfg.veteran.generalShelter} for shelter (homeless veteran query)`);
        }
      } else {
        if (isVeteranPTSDQuery && /\b(sexual assault|sexual violence|rape|sexual abuse|SART|women'?s.*trauma)\b/i.test(textLower)) {
          addFactor('veteran.sexualViolencePenalty', cfg.veteran.sexualViolencePenalty, `Sexual violence for veteran PTSD query`);
          console.log(`[VeteranBoost] "${svc.name.substring(0, 40)}" ${cfg.veteran.sexualViolencePenalty} penalty for sexual violence (not veteran trauma)`);
        }
        if (isVeteranPTSDQuery && /\b(domestic violence|domestic abuse|intimate partner|spousal abuse|abusive relationship|women'?s shelter|battered|family violence)\b/i.test(textLower)) {
          addFactor('veteran.domesticViolencePenalty', cfg.veteran.domesticViolencePenalty, `Domestic violence for veteran PTSD query`);
          console.log(`[VeteranBoost] "${svc.name.substring(0, 40)}" ${cfg.veteran.domesticViolencePenalty} penalty for domestic violence (not veteran trauma)`);
        }
        if (isVeteranPTSDQuery && /\b(women'?s|for women|female only|women only)\b/i.test(textLower) &&
            !/\b(veteran|military)\b/i.test(textLower)) {
          addFactor('veteran.womenSpecificPenalty', cfg.veteran.womenSpecificPenalty, `Women-specific for veteran query`);
          console.log(`[VeteranBoost] "${svc.name.substring(0, 40)}" ${cfg.veteran.womenSpecificPenalty} penalty for women-specific (veteran query)`);
        }
      }
    }

    // Family situation boosting
    if (familySituations.length > 0) {
      for (const situation of familySituations) {
        if (situation === 'single_parent') {
          if (/single parent|single mom|single dad|sole parent|family|child|parenting/i.test(textLower)) {
            addFactor('familySituation.singleParent', cfg.familySituation.singleParent, `Single parent service match`);
          }
        }
        if (situation === 'family_legal') {
          if (/legal|court|mediation|family services|custody|divorce|lawyer|law/i.test(textLower)) {
            addFactor('familySituation.familyLegal', cfg.familySituation.familyLegal, `Family legal service match`);
          }
        }
        if (situation === 'pregnancy') {
          if (/prenatal|maternity|infant|baby|parenting|newborn|pregnancy|pregnant|postpartum|maternal/i.test(textLower)) {
            addFactor('familySituation.pregnancy', cfg.familySituation.pregnancy, `Pregnancy/parenting service match`);
          }
        }
        if (situation === 'family_general') {
          if (/family|families|parent|child|kids/i.test(textLower)) {
            addFactor('familySituation.familyGeneral', cfg.familySituation.familyGeneral, `General family service match`);
          }
        }
      }
    }

    // Community preference boosting
    if (communityPref) {
      if (communityPref === 'indigenous') {
        if (/indigenous|first nations?|aboriginal|native|metis|m[eé]tis|inuit|fnmi/i.test(textLower)) {
          addFactor('community.match', cfg.community.match, `Indigenous community match`);
        }
      }
      if (communityPref === 'newcomer') {
        if (/immigrant|refugee|newcomer|settlement|new canadian|esl|language|citizenship/i.test(textLower)) {
          addFactor('community.match', cfg.community.match, `Newcomer community match`);
        }
      }
      if (communityPref === 'lgbtq') {
        if (/lgbtq|lgbt|pride|queer|trans|gay|lesbian|2slgbtq|two-spirit|non-?binary/i.test(textLower)) {
          addFactor('community.match', cfg.community.match, `LGBTQ+ community match`);
        }
      }
      if (communityPref === 'veteran') {
        if (/veteran|military|armed forces|canadian forces|vac\b|legion/i.test(textLower)) {
          addFactor('community.match', cfg.community.match, `Veteran community match`);
        }
      }
    }

    // Student/University boosting
    if (studentContext) {
      const institutionServicePatterns: Record<string, RegExp> = {
        ucalgary: /\b(ucalgary|u of c|uofc|ucrc|university of calgary|uc wellness|uc counselling)\b/i,
        ualberta: /\b(ualberta|u of a|uofa|university of alberta|ua wellness|ua counselling)\b/i,
        mru: /\b(mount royal|mru)\b/i,
        ulethbridge: /\b(lethbridge|uleth|u of l)\b/i,
        macewan: /\b(macewan)\b/i,
        athabasca: /\b(athabasca)\b/i,
        sait: /\b(sait|southern alberta institute)\b/i,
        nait: /\b(nait|northern alberta institute)\b/i,
        bowvalley: /\b(bow valley)\b/i,
        norquest: /\b(norquest)\b/i,
        olds: /\b(olds college)\b/i,
        reddeer: /\b(red deer)\b/i,
      };

      const isStudentService = /student|university|campus|college|wellness.*centre|counsell?ing.*centre|student.*services/i.test(textLower);
      const isYouthService = /youth|young adult|18-24|18-25|under 25/i.test(textLower);

      if (studentContext.institution) {
        const institutionPattern = institutionServicePatterns[studentContext.institution];
        if (institutionPattern && institutionPattern.test(textLower)) {
          addFactor('student.institutionMatch', cfg.student.institutionMatch, `${studentContext.institution} institution match`);
          console.log(`[StudentBoost] "${svc.name.substring(0, 40)}" boosted for ${studentContext.institution} (institution match)`);
        } else if (isStudentService) {
          addFactor('student.genericStudent', cfg.student.genericStudent, `Generic student service`);
        }
      } else if (isStudentService) {
        addFactor('student.studentService', cfg.student.studentService, `Student service`);
        console.log(`[StudentBoost] "${svc.name.substring(0, 40)}" boosted as student service`);
      } else if (isYouthService) {
        addFactor('student.youthService', cfg.student.youthService, `Youth service for student query`);
      }
    }

    // Language preference boosting
    if (languagePref) {
      const langBoostPatterns: Record<string, RegExp> = {
        spanish: /\b(spanish|español|hispanic|latino|latina)\b/i,
        french: /\b(french|français|francophone|bilingual)\b/i,
        arabic: /\b(arabic|arab|muslim)\b/i,
        mandarin: /\b(mandarin|chinese|cantonese|asian)\b/i,
        punjabi: /\b(punjabi|sikh|south asian)\b/i,
        tagalog: /\b(tagalog|filipino|philippines)\b/i,
        vietnamese: /\b(vietnamese|viet)\b/i,
        ukrainian: /\b(ukrainian|ukrain)\b/i,
        hindi: /\b(hindi|indian|south asian)\b/i,
        urdu: /\b(urdu|pakistan)\b/i,
        korean: /\b(korean)\b/i,
        nonEnglish: /\b(multilingual|interpreter|translation|multiple languages)\b/i,
      };

      const langPattern = langBoostPatterns[languagePref];
      if (langPattern && langPattern.test(textLower)) {
        addFactor('language.langMatch', cfg.language.langMatch, `${languagePref} language match`);
        console.log(`[LanguageBoost] "${svc.name.substring(0, 40)}" boosted for ${languagePref}`);
      }
      if (/\b(interpreter|multilingual|translation|multiple languages)\b/i.test(textLower)) {
        addFactor('language.multilingual', cfg.language.multilingual, `Multilingual service`);
      }
    }

    // Family context boosting
    if (familyContext) {
      const isFamilySupportService = /\b(family support|family services|loved ones|concerned persons|al-?anon|nar-?anon|family counsell?ing|parent support|caregiver|coping)\b/i.test(textLower);
      const isInterventionService = /\b(intervention|family therapy|family program)\b/i.test(textLower);

      if (isFamilySupportService) {
        addFactor('familyContext.familySupport', cfg.familyContext.familySupport, `Family support service`);
        console.log(`[FamilyBoost] "${svc.name.substring(0, 40)}" boosted as family support`);
      }
      if (isInterventionService) {
        addFactor('familyContext.intervention', cfg.familyContext.intervention, `Intervention/family therapy service`);
      }
    }

    // Exclusion signal boosts (penalties removed - now handled by applyExclusionFilter)
    // Note: Exclusion filtering (religious, 12-step, gender) is now handled by
    // applyExclusionFilter() in the pipeline. Services are hard-filtered, not penalized.
    // The old penalty-based approach is removed to ensure zero leakage.
    // Positive boosts for secular alternatives are preserved below.

    // KEPT: Secular alternative boost when user has 12-step exclusion
    if (exclusions.twelveStep) {
      if (/\b(SMART Recovery|cognitive behavio|evidence.?based|secular|non.?religious|harm reduction|medication.?assisted|MAT\b)\b/i.test(textLower)) {
        addFactor('exclusion.secularBoost', cfg.exclusion.secularBoost, `Secular/evidence-based alternative`);
        console.log(`[SecularBoost] "${svc.name.substring(0, 40)}" +${cfg.exclusion.secularBoost} for secular alternative`);
      }
    }

    // Extra boost for non-12-step recovery queries
    const isNon12StepQuery = /\b(no.*12.*step|not.*12.*step|non.*12.*step|alternative to AA|alternative to NA|no AA|no NA|without.*12.*step)\b/i.test(queryLower);
    if (isNon12StepQuery) {
      if (/SMART/i.test(svc.name) || /\bSMART\b/i.test(textLower)) {
        addFactor('non12Step.smartRecovery', cfg.non12Step.smartRecovery, `SMART Recovery (exact match)`);
        console.log(`[Non12StepBoost] "${svc.name.substring(0, 40)}" +${cfg.non12Step.smartRecovery} for SMART Recovery (exact match)`);
      }
      if (/\b(medication.?assisted|MAT\b|suboxone|methadone|harm reduction|evidence.?based|CBT|cognitive|secular)\b/i.test(textLower)) {
        addFactor('non12Step.evidenceBased', cfg.non12Step.evidenceBased, `Evidence-based treatment`);
        console.log(`[Non12StepBoost] "${svc.name.substring(0, 40)}" +${cfg.non12Step.evidenceBased} for evidence-based treatment`);
      }
      const isYouthQueryLocal = /\b(youth|teen|adolescent|young|under 18|minor|child)\b/i.test(queryLower);
      if (!isYouthQueryLocal && /\b(youth|adolescent|teen|young people|children|kids|under 18|minor)\b/i.test(textLower)) {
        addFactor('non12Step.youthPenalty', cfg.non12Step.youthPenalty, `Youth-specific for adult query`);
        console.log(`[Non12StepBoost] "${svc.name.substring(0, 40)}" ${cfg.non12Step.youthPenalty} for youth-specific (not requested)`);
      }
      if (/\b(residential|treatment centre|treatment center|recovery house)\b/i.test(textLower) &&
          !/\b(SMART|secular|evidence.?based|non.?12|MAT|harm reduction)\b/i.test(textLower)) {
        addFactor('non12Step.unclearMethodology', cfg.non12Step.unclearMethodology, `Unclear methodology`);
        console.log(`[Non12StepBoost] "${svc.name.substring(0, 40)}" ${cfg.non12Step.unclearMethodology} for unclear methodology`);
      }
    }

    // Indigenous services boosting
    if (intent === 'indigenous_services') {
      if (/\b(indigenous|first nations?|métis|metis|inuit|native|aboriginal)\b/i.test(textLower)) {
        addFactor('indigenous.indigenousService', cfg.indigenous.indigenousService, `Indigenous service`);
        console.log(`[IndigenousBoost] "${svc.name.substring(0, 40)}" boosted as indigenous service`);
      }
      if (/\b(elder|ceremony|smudging|sweat lodge|traditional healing|medicine wheel)\b/i.test(textLower)) {
        addFactor('indigenous.traditionalHealing', cfg.indigenous.traditionalHealing, `Traditional healing service`);
      }
      if (/\b(treaty|reserve|band|status|nihb|jordan'?s principle)\b/i.test(textLower)) {
        addFactor('indigenous.treatyReserve', cfg.indigenous.treatyReserve, `Treaty/reserve service`);
      }
    }

    // Parenting/baby support boosting
    if (intent === 'parenting_support') {
      const isChildcareCostsQuery = /\b(childcare.*cost|daycare.*cost|childcare.*help|daycare.*help|childcare.*afford|childcare.*subsid|daycare.*subsid|afford.*childcare|afford.*daycare)\b/i.test(queryLower);

      if (/\b(pregnant|pregnancy|prenatal|postpartum|baby|infant|newborn|parenting|parent support)\b/i.test(textLower)) {
        addFactor('parenting.parentingSupport', cfg.parenting.parentingSupport, `Parenting support service`);
        console.log(`[ParentingBoost] "${svc.name.substring(0, 40)}" boosted as parenting support`);
      }
      if (/\b(formula|diapers|baby supplies|car seat|crib|stroller|breastfeeding|lactation)\b/i.test(textLower)) {
        addFactor('parenting.babySupplies', cfg.parenting.babySupplies, `Baby supplies service`);
      }
      if (/\b(single parent|teen parent|young parent)\b/i.test(textLower)) {
        addFactor('parenting.parentType', cfg.parenting.parentType, `Parent type match`);
      }
      if (/\b(childcare|daycare|child care)\b/i.test(textLower)) {
        addFactor('parenting.childcare', cfg.parenting.childcare, `Childcare service`);
        console.log(`[ParentingBoost] "${svc.name.substring(0, 40)}" +${cfg.parenting.childcare} for childcare`);
      }
      if (/\b(childcare.*subsid|daycare.*subsid|subsid.*childcare|subsid.*daycare|childcare.*assist|daycare.*assist|childcare.*afford|ACCB|child.*benefit)\b/i.test(textLower)) {
        addFactor('parenting.childcareSubsidy', cfg.parenting.childcareSubsidy, `Childcare subsidy/assistance`);
        console.log(`[ParentingBoost] "${svc.name.substring(0, 40)}" +${cfg.parenting.childcareSubsidy} for childcare subsidy/assistance`);
      }
      if (isChildcareCostsQuery) {
        if (/\b(financial|subsidy|benefit|assistance|affordable|low cost|free|help.*pay)\b/i.test(textLower)) {
          addFactor('parenting.financialChildcare', cfg.parenting.financialChildcare, `Financial childcare help`);
          console.log(`[ParentingBoost] "${svc.name.substring(0, 40)}" +${cfg.parenting.financialChildcare} for financial childcare help`);
        }
        if (/\b(diapers|formula|breastfeeding|car seat|crib)\b/i.test(textLower) && !/\b(childcare|daycare)\b/i.test(textLower)) {
          addFactor('parenting.babySuppliesPenalty', cfg.parenting.babySuppliesPenalty, `Baby supplies for childcare cost query`);
        }
      }
    }

    // Student services boosting (when intent is student_services)
    if (intent === 'student_services') {
      const isUCalgaryQuery = /\b(u of c|uofc|ucalgary|university of calgary)\b/i.test(queryLower);
      const isUAlbertaQuery = /\b(u of a|uofa|ualberta|university of alberta)\b/i.test(queryLower);
      const isMRUQuery = /\b(mount royal|mru)\b/i.test(queryLower);

      if (isUCalgaryQuery && /\b(ucalgary|university of calgary|u of c|calgary)\b/i.test(textLower) && /\b(student|campus|wellness|counsell)/i.test(textLower)) {
        addFactor('studentServices.universityMatch', cfg.studentServices.universityMatch, `UCalgary-specific service`);
        console.log(`[StudentIntentBoost] "${svc.name.substring(0, 40)}" +${cfg.studentServices.universityMatch} for UCalgary-specific service`);
      } else if (isUAlbertaQuery && /\b(ualberta|university of alberta|u of a)\b/i.test(textLower) && /\b(student|campus|wellness|counsell)/i.test(textLower)) {
        addFactor('studentServices.universityMatch', cfg.studentServices.universityMatch, `UAlberta-specific service`);
        console.log(`[StudentIntentBoost] "${svc.name.substring(0, 40)}" +${cfg.studentServices.universityMatch} for UAlberta-specific service`);
      } else if (isMRUQuery && /\b(mount royal|mru)\b/i.test(textLower)) {
        addFactor('studentServices.universityMatch', cfg.studentServices.universityMatch, `MRU-specific service`);
        console.log(`[StudentIntentBoost] "${svc.name.substring(0, 40)}" +${cfg.studentServices.universityMatch} for MRU-specific service`);
      }

      if (/\b(campus|university|college|student)\b/i.test(textLower) && /\b(counsell?ing|wellness|mental health|support|services)\b/i.test(textLower)) {
        addFactor('studentServices.campusService', cfg.studentServices.campusService, `Campus service`);
        console.log(`[StudentIntentBoost] "${svc.name.substring(0, 40)}" +${cfg.studentServices.campusService} for campus service`);
      }

      if (/\b(student.*counsell?ing|student.*wellness|student.*services|campus.*health|campus.*mental)\b/i.test(textLower)) {
        addFactor('studentServices.studentCounselling', cfg.studentServices.studentCounselling, `Student counselling/wellness`);
      }

      if ((isUCalgaryQuery || isUAlbertaQuery || isMRUQuery) &&
          !/\b(campus|university|college|student|u of c|u of a|ucalgary|ualberta|mru|mount royal)\b/i.test(textLower)) {
        addFactor('studentServices.nonCampusPenalty', cfg.studentServices.nonCampusPenalty, `Non-campus for university query`);
        console.log(`[StudentIntentBoost] "${svc.name.substring(0, 40)}" ${cfg.studentServices.nonCampusPenalty} for non-campus service (university query)`);
      }

      if (isUCalgaryQuery && /\b(ualberta|university of alberta|u of a|edmonton)\b/i.test(textLower)) {
        addFactor('studentServices.wrongUniversityPenalty', cfg.studentServices.wrongUniversityPenalty, `Wrong university (UAlberta for UCalgary query)`);
        console.log(`[StudentIntentBoost] "${svc.name.substring(0, 40)}" ${cfg.studentServices.wrongUniversityPenalty} for wrong university (UCalgary query, UAlberta service)`);
      }
      if (isUAlbertaQuery && /\b(ucalgary|university of calgary|u of c)\b/i.test(textLower)) {
        addFactor('studentServices.wrongUniversityPenalty', cfg.studentServices.wrongUniversityPenalty, `Wrong university (UCalgary for UAlberta query)`);
        console.log(`[StudentIntentBoost] "${svc.name.substring(0, 40)}" ${cfg.studentServices.wrongUniversityPenalty} for wrong university (UAlberta query, UCalgary service)`);
      }

      const isGeneralMentalHealthQuery = /\b(mental health|counsell?ing|therapy|depression|anxiety|stress)\b/i.test(queryLower) &&
                                         !/\b(addiction|substance|alcohol|drug|recovery)\b/i.test(queryLower);
      if (isGeneralMentalHealthQuery && /\b(addiction|substance|harm reduction|detox|recovery|alcohol|drug)\b/i.test(textLower)) {
        addFactor('studentServices.addictionFocusPenalty', cfg.studentServices.addictionFocusPenalty, `Addiction focus for mental health query`);
        console.log(`[StudentIntentBoost] "${svc.name.substring(0, 40)}" ${cfg.studentServices.addictionFocusPenalty} for addiction focus (general mental health query)`);
      }
    }

    // Substance-specific boosting (for substance_abuse intent)
    if (intent === 'substance_abuse' && analysis?.substanceType) {
      const querySubstance = analysis.substanceType;
      const serviceSubstance = detectServiceSubstanceType(svc.name, svc.description, svc.category);

      if (serviceSubstance) {
        console.log(`[SubstanceBoost] "${svc.name.substring(0, 40)}" → ${serviceSubstance}, query wants: ${querySubstance}`);
      }

      if (querySubstance && serviceSubstance) {
        if (querySubstance === serviceSubstance) {
          addFactor('substance.exactMatch', cfg.substance.exactMatch, `Exact substance match (${querySubstance})`);
          if (/peer|support|anonymous|12.?step|meeting/i.test(textLower)) {
            addFactor('substance.peerSupport', cfg.substance.peerSupport, `Peer support for substance`);
          }
        }
        else if (serviceSubstance === 'general' && querySubstance !== 'general') {
          addFactor('substance.generalPenalty', cfg.substance.generalPenalty, `General service for specific substance query`);
        }
        else if (querySubstance === 'general' && serviceSubstance !== 'general') {
          addFactor('substance.generalServiceBoost', cfg.substance.generalServiceBoost, `Specific substance for general query`);
        }
        else if (querySubstance !== serviceSubstance) {
          addFactor('substance.mismatchPenalty', cfg.substance.mismatchPenalty, `Substance mismatch (${serviceSubstance} for ${querySubstance} query)`);
        }
      }
    }

    return { svc, boost, explanations };
  });

  // Sort by boost (highest first) while preserving relative order for equal scores
  scored.sort((a, b) => b.boost - a.boost);

  const boostedCount = scored.filter(s => s.boost > 0).length;
  const penalizedCount = scored.filter(s => s.boost < 0).length;
  console.log(`[ComprehensiveSearch] Intent boosting for ${intent}: ${boostedCount} boosted, ${penalizedCount} penalized`);

  // Return services with explanations attached if tracking is enabled
  if (trackExplanations) {
    return scored.map(s => ({
      ...s.svc,
      scoreExplanation: s.explanations,
    })) as LiteServiceWithDebug[];
  }

  return scored.map(s => s.svc);
}

/**
 * Compute Reciprocal Rank Fusion (RRF) score for hybrid SQL + semantic ranking
 * Higher scores = better ranking. Services appearing in both sources score highest.
 */
export function computeRRFScore(sqlRank: number | null, semanticRank: number | null, k: number = SCORING_CONFIG.rrf.k): number {
  let score = 0;
  if (sqlRank !== null) {
    score += 1 / (k + sqlRank);
  }
  if (semanticRank !== null) {
    score += 1 / (k + semanticRank);
  }
  return score;
}

/**
 * Apply penalty for services containing negative terms user wants to exclude
 * E.g., "shelter not religious" penalizes shelters with "religious" in their text
 * Handles semantic terms like "12_step" → AA, NA, higher power, etc.
 */
export function applyNegativePenalty(
  services: LiteService[],
  negativeTerms: string[],
  options?: BoostOptions
): LiteService[] {
  if (negativeTerms.length === 0) return services;

  const cfg = SCORING_CONFIG.negativeKeyword;
  const trackExplanations = options?.trackExplanations ?? false;

  // Map semantic negative terms to patterns that should be penalized
  const semanticPatterns: Record<string, RegExp> = {
    '12_step': /\b(12[\s-]?step|twelve[\s-]?step|AA\b|NA\b|CA\b|alcoholics\s*anonymous|narcotics\s*anonymous|cocaine\s*anonymous|higher\s*power|step\s*program|steps?\s*(?:1|2|3|4|5|6|7|8|9|10|11|12)\b)/i,
    'religious': /\b(religious|faith[\s-]?based|christian|church|ministry|spiritual|god|prayer|bible|jesus|christ|evangelical|catholic|baptist|methodist|lutheran|presbyterian|pentecostal|salvation\s*army|rescue\s*mission|dream\s*centre|dream\s*center|life\s*centre|mission\s*centre|12[\s-]?step|AA\b|NA\b|CA\b|alcoholics\s*anonymous|narcotics\s*anonymous|higher\s*power)\b/i,
    'faith_based': /\b(faith[\s-]?based|religious|spiritual|christian|church|ministry|god|prayer|dream\s*centre|dream\s*center)\b/i,
  };

  // Deduplicate negative terms
  const uniqueTerms = negativeTerms.filter((term, index) => negativeTerms.indexOf(term) === index);

  const scored = services.map(service => {
    let penalty = 0;
    const explanations: ScoreExplanation[] = [];
    const searchText = `${service.name} ${service.description} ${service.category}`.toLowerCase();

    // Get existing explanations if present
    const existingExplanations = (service as LiteServiceWithDebug).scoreExplanation || [];

    for (const term of uniqueTerms) {
      // Check if this is a semantic term with expanded patterns
      const pattern = semanticPatterns[term];
      if (pattern) {
        if (pattern.test(searchText)) {
          penalty += cfg.semanticMatch;
          if (trackExplanations) {
            explanations.push({
              factor: 'negativeKeyword.semanticMatch',
              value: -cfg.semanticMatch,
              reason: `Matches excluded "${term}" pattern`
            });
          }
          console.log(`[NegativeKeyword] Penalizing "${service.name.substring(0, 40)}" (-${cfg.semanticMatch}) for "${term}" pattern match`);
        }
      } else {
        // Direct term match
        if (searchText.includes(term)) {
          penalty += cfg.directMatch;
          if (trackExplanations) {
            explanations.push({
              factor: 'negativeKeyword.directMatch',
              value: -cfg.directMatch,
              reason: `Contains excluded term "${term}"`
            });
          }
          console.log(`[NegativeKeyword] Penalizing "${service.name.substring(0, 40)}" (-${cfg.directMatch}) for containing "${term}"`);
        }
      }
    }

    return { service, penalty, explanations: [...existingExplanations, ...explanations] };
  });

  // Sort by penalty (lower is better), maintaining original order for equal penalties
  scored.sort((a, b) => a.penalty - b.penalty);

  // Return services with explanations attached if tracking is enabled
  if (trackExplanations) {
    return scored.map(s => ({
      ...s.service,
      scoreExplanation: s.explanations,
    })) as LiteServiceWithDebug[];
  }

  return scored.map(s => s.service);
}
