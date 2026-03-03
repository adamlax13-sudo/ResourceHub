/**
 * Query Detectors Module
 *
 * Detects user preferences, context, and signals from query text.
 * All detect*() functions analyze raw query strings to extract:
 * - Demographics (gender, age group)
 * - Context (student, family, urgency)
 * - Preferences (language, community, exclusions)
 * - Service characteristics (substance type, organization)
 */

import { SEARCH_CONFIG } from '../config';
import type { SubstanceType, QueryIntent } from '../config';
import type { Exclusions } from '../types';

/**
 * Student context with optional specific institution
 */
export interface StudentContext {
  type: 'university' | 'college';
  institution: string | null; // e.g., 'ucalgary', 'ualberta', 'sait', etc.
}

/**
 * Age group detected from query
 */
export type AgeGroup = 'youth' | 'youth_and_adult' | 'adult' | 'senior';

/**
 * Age group detection result with confidence level
 */
export interface AgeGroupDetection {
  ageGroup: AgeGroup;
  confidence: 'high' | 'medium';
}

/**
 * Detect gender preference from query text
 * Returns 'women_only', 'men_only', or null
 */
export function detectGenderPreference(query: string): 'women_only' | 'men_only' | null {
  const q = query.toLowerCase();

  // Female-associated terms
  const femalePatterns = [
    /\b(mother|mom|mum|mama|mommy)\b/,
    /\b(pregnant|pregnancy|expecting)\b/,
    /\b(daughter|sister|wife|girlfriend)\b/,
    /\b(woman|women|female|girl)\b/,
    /\bi am a (mother|mom|woman|female)\b/,
    /\bas a (mother|mom|woman|female)\b/,
    /\b(postpartum|maternity|maternal)\b/,
  ];

  // Male-associated terms
  const malePatterns = [
    /\b(father|dad|daddy|papa)\b/,
    /\b(son|brother|husband|boyfriend)\b/,
    /\b(man|men|male|guy)\b/,
    /\bi am a (father|dad|man|male)\b/,
    /\bas a (father|dad|man|male)\b/,
  ];

  const isFemale = femalePatterns.some(p => p.test(q));
  const isMale = malePatterns.some(p => p.test(q));

  // If both or neither, no preference
  if (isFemale && !isMale) return 'women_only';
  if (isMale && !isFemale) return 'men_only';
  return null;
}

/**
 * Detect age group preference from query text with confidence level
 * Returns detection with confidence, or null if no age signal
 */
export function detectAgeGroup(query: string): AgeGroupDetection | null {
  const q = query.toLowerCase();

  // === HIGH CONFIDENCE PATTERNS (hard filter) ===

  // Adult — explicit, with exclusions for false positives
  // Exclude: "adult children of", "young adult", "adult family member"
  const hasAdult = /\badult\b/.test(q);
  const isAdultFalsePositive = /\badult\s+children\s+of\b/.test(q) ||
                               /\byoung\s+adult\b/.test(q) ||
                               /\badult\s+family\s+member\b/.test(q);
  if (hasAdult && !isAdultFalsePositive) {
    return { ageGroup: 'adult', confidence: 'high' };
  }

  // Youth — explicit youth service terms
  if (/\b(teen|teenager|adolescent)\s+(program|service|counselling|counseling|shelter|support)s?\b/.test(q)) {
    return { ageGroup: 'youth', confidence: 'high' };
  }

  // Senior — explicit senior terms
  if (/\b(senior|elderly|65\+|70\+)\s+(support|services?|care|program)s?\b/.test(q)) {
    return { ageGroup: 'senior', confidence: 'high' };
  }

  // === MEDIUM CONFIDENCE PATTERNS (-200 penalty) ===

  // University/college student → adult (not youth)
  if (/\b(university|college|campus|undergrad|graduate|masters|phd|doctoral|polytechnic)\b/.test(q) ||
      /\b(u of c|u of a|uofc|uofa|ucalgary|ualberta|mount royal|mru|sait|nait|macewan|bow valley|norquest)\b/.test(q)) {
    return { ageGroup: 'adult', confidence: 'medium' };
  }

  // Young adult → maps to youth_and_adult
  if (/\byoung\s+adult\b/.test(q)) {
    return { ageGroup: 'youth_and_adult', confidence: 'medium' };
  }

  // Family context — searching for someone else
  if (/\bmy\s+(son|daughter|teen|teenager|child)\b/.test(q)) {
    return { ageGroup: 'youth', confidence: 'medium' };
  }

  if (/\b(my|for\s+my)\s+(elderly|aging)\s+(parent|mom|dad|mother|father)\b/.test(q)) {
    return { ageGroup: 'senior', confidence: 'medium' };
  }

  // General youth patterns (medium confidence)
  if (/\b(teenager|teen|adolescent|youth)\b/.test(q) &&
      !/\b(my|our|for)\s+(son|daughter|child|teenager|teen)\b/.test(q)) {
    return { ageGroup: 'youth', confidence: 'medium' };
  }

  // General senior patterns (medium confidence)
  if (/\b(senior|elderly|aging|aged|older\s+adult)\b/.test(q)) {
    return { ageGroup: 'senior', confidence: 'medium' };
  }

  return null;
}

/**
 * Detect if query mentions student/university context
 * Returns the institution type and specific institution if mentioned
 */
export function detectStudentContext(query: string): StudentContext | null {
  const q = query.toLowerCase();

  // Specific institution patterns - order matters (most specific first)
  const institutionPatterns: { pattern: RegExp; institution: string; type: 'university' | 'college' }[] = [
    // University of Calgary
    { pattern: /\b(u of c|uofc|ucalgary|university of calgary|u of calgary)\b/, institution: 'ucalgary', type: 'university' },
    // University of Alberta
    { pattern: /\b(u of a|uofa|ualberta|university of alberta|u of alberta)\b/, institution: 'ualberta', type: 'university' },
    // Mount Royal University
    { pattern: /\b(mount royal|mru|mount royal university)\b/, institution: 'mru', type: 'university' },
    // University of Lethbridge
    { pattern: /\b(u of l|uleth|lethbridge university|university of lethbridge)\b/, institution: 'ulethbridge', type: 'university' },
    // MacEwan University
    { pattern: /\b(macewan|macewan university)\b/, institution: 'macewan', type: 'university' },
    // Athabasca University
    { pattern: /\b(athabasca|athabasca university|au)\b/, institution: 'athabasca', type: 'university' },
    // SAIT
    { pattern: /\b(sait|southern alberta institute)\b/, institution: 'sait', type: 'college' },
    // NAIT
    { pattern: /\b(nait|northern alberta institute)\b/, institution: 'nait', type: 'college' },
    // Bow Valley College
    { pattern: /\b(bow valley|bow valley college)\b/, institution: 'bowvalley', type: 'college' },
    // NorQuest College
    { pattern: /\b(norquest|norquest college)\b/, institution: 'norquest', type: 'college' },
    // Olds College
    { pattern: /\b(olds college)\b/, institution: 'olds', type: 'college' },
    // Red Deer Polytechnic
    { pattern: /\b(red deer|red deer college|red deer polytechnic)\b/, institution: 'reddeer', type: 'college' },
  ];

  // Check for specific institution first
  for (const { pattern, institution, type } of institutionPatterns) {
    if (pattern.test(q)) {
      return { type, institution };
    }
  }

  // General university patterns (no specific institution)
  const universityPatterns = [
    /\b(university|undergrad|graduate|masters|phd|doctoral)\b/,
    /\b(eng student|engineering student|law student|med student)\b/,
    /\b(campus|dorm|residence|tuition|prof|professor)\b/,
  ];

  // General college patterns
  const collegePatterns = [
    /\b(college|polytechnic|technical school|trade school)\b/,
  ];

  // General student patterns
  const studentPatterns = [
    /\b(student|studying|enrolled|semester|exams|finals)\b/,
  ];

  if (universityPatterns.some(p => p.test(q))) return { type: 'university', institution: null };
  if (collegePatterns.some(p => p.test(q))) return { type: 'college', institution: null };
  if (studentPatterns.some(p => p.test(q))) return { type: 'university', institution: null };

  return null;
}

/**
 * Detect urgency level from query text
 * Returns 'immediate' or null
 */
export function detectUrgency(query: string): 'immediate' | null {
  const q = query.toLowerCase();

  // Immediate urgency patterns
  const immediatePatterns = [
    /\b(right now|tonight|this minute|immediately|asap)\b/,
    /\bneed\s+.{0,20}\s*now\b/,
    /\bhelp\s+.{0,20}\s*now\b/,
    /\b(this evening|this morning)\b/,
    /\b(emergency|urgent|crisis)\b/,
    /\b(about to|going to|will)\s+(be|become|get)\s+(evicted|kicked out|homeless)\b/,
    /\b(nowhere to go|no place to stay|no where to sleep)\b/,
    /\b(today|same day)\b/,
  ];

  if (immediatePatterns.some(p => p.test(q))) return 'immediate';
  return null;
}

/**
 * Detect family situation from query text
 * Returns array of detected situations
 */
export function detectFamilySituation(query: string): string[] {
  const q = query.toLowerCase();
  const situations: string[] = [];

  // Single parent patterns
  if (/\b(single\s+(parent|mom|dad|mother|father)|raising\s+.{0,10}\s*alone|sole custody|only parent)\b/.test(q)) {
    situations.push('single_parent');
  }

  // Custody/divorce patterns
  if (/\b(custody|divorce|separation|visitation|family court|child access|co-parenting)\b/.test(q)) {
    situations.push('family_legal');
  }

  // Pregnancy/newborn patterns
  if (/\b(pregnant|pregnancy|expecting|newborn|infant|baby|postpartum|prenatal|maternity)\b/.test(q)) {
    situations.push('pregnancy');
  }

  // Parent with children general
  if (/\b(with\s+(my\s+)?(kids?|children|child)|parent(ing)?|family)\b/.test(q) && situations.length === 0) {
    situations.push('family_general');
  }

  return situations;
}

/**
 * Detect community/cultural preference from query text
 * Returns community identifier or null
 */
export function detectCommunityPreference(query: string): string | null {
  const q = query.toLowerCase();

  // Indigenous patterns
  if (/\b(indigenous|first nations?|metis|m[eé]tis|inuit|aboriginal|native|fnmi)\b/.test(q)) {
    return 'indigenous';
  }

  // Newcomer/immigrant patterns
  if (/\b(newcomer|refugee|immigrant|asylum|visa|settlement|new to canada|esl)\b/.test(q)) {
    return 'newcomer';
  }

  // LGBTQ2S+ patterns
  if (/\b(lgbtq|lgbt|gay|lesbian|trans|transgender|queer|2slgbtq|2s|two-spirit|bisexual|non-?binary)\b/.test(q)) {
    return 'lgbtq';
  }

  // Veteran patterns
  if (/\b(veteran|military|armed forces|ex-military|former military|canadian forces)\b/.test(q)) {
    return 'veteran';
  }

  return null;
}

/**
 * Detect language preference from query text
 * Returns language code or null
 */
export function detectLanguagePreference(query: string): string | null {
  const langPatterns = SEARCH_CONFIG.languagePatterns;

  for (const [lang, pattern] of Object.entries(langPatterns)) {
    if (pattern.test(query)) {
      return lang;
    }
  }
  return null;
}

/**
 * Detect family/loved one context - searching on behalf of someone else
 * Returns type of relationship or null
 */
export function detectFamilyContext(query: string): 'immediate' | 'extended' | 'concerned' | null {
  const q = query.toLowerCase();
  const patterns = SEARCH_CONFIG.familyContextPatterns;

  // Check immediate family first (highest priority)
  if (patterns.immediateFamily.some(p => p.test(q))) {
    return 'immediate';
  }

  // Check extended family/loved ones
  if (patterns.extendedFamily.some(p => p.test(q))) {
    return 'extended';
  }

  // Check concerned person patterns
  if (patterns.concernedPerson.some(p => p.test(q))) {
    return 'concerned';
  }

  return null;
}

/**
 * Detect exclusion signals from query text.
 * Returns structured Exclusions object for hard filtering.
 *
 * Key behavior: When religious === true AND query has addiction context,
 * automatically set twelveStep = true (12-step programs involve "higher power").
 */
export function detectExclusions(query: string, intent?: QueryIntent): Exclusions {
  const q = query.toLowerCase();

  // Detect religious exclusion signals
  const religious = /\b(not religious|non-?religious|secular|no.*religion|no.*faith|no.*church|no.*god|atheist|agnostic|secular only)\b/i.test(q);

  // Detect explicit 12-step exclusion
  let twelveStep = /\b(not.*12.*step|no.*12.*step|non.*12.*step|alternative to AA|alternative to NA|no AA|no NA|without.*12.*step)\b/i.test(q);

  // Auto-set twelveStep when religious exclusion + addiction context
  if (religious && !twelveStep) {
    const isAddictionContext =
      intent === 'substance_abuse' ||
      intent === 'family_addiction_support' ||
      /\b(addiction|recovery|rehab|detox|substance|drug|alcohol|sober|sobriety|clean|treatment|relapse)\b/i.test(q);

    if (isAddictionContext) {
      twelveStep = true;
      console.log(`[Exclusions] "not religious" + addiction context → auto-excluding 12-step programs`);
    }
  }

  // Detect gender exclusions
  let genderRestricted: 'men_only' | 'women_only' | null = null;
  if (/\b(not.*men only|no.*men|not just men|not.*male only|exclude.*men)\b/i.test(q)) {
    genderRestricted = 'men_only';
  } else if (/\b(not.*women only|no.*women|not just women|not.*female only|exclude.*women)\b/i.test(q)) {
    genderRestricted = 'women_only';
  }

  const exclusions: Exclusions = { religious, twelveStep, genderRestricted };

  // Log detected exclusions
  const detected: string[] = [];
  if (religious) detected.push('religious');
  if (twelveStep) detected.push('twelveStep');
  if (genderRestricted) detected.push(`gender:${genderRestricted}`);
  if (detected.length > 0) {
    console.log(`[Exclusions] Detected: ${detected.join(', ')}`);
  }

  return exclusions;
}

/**
 * Detect what substance a service specializes in based on its name/description/category
 * Returns 'general' for services that handle all addictions (residential treatment, etc.)
 */
export function detectServiceSubstanceType(name: string, description: string, category: string): SubstanceType {
  const text = `${name} ${description} ${category}`.toLowerCase();
  const indicators = SEARCH_CONFIG.serviceSubstanceIndicators;

  // EXCLUDE family support services from alcohol matching
  // These help family members of people with addiction, NOT the person seeking help:
  // - Al-Anon: Support for families/friends of alcoholics
  // - Adult Children of Alcoholics: Support for people whose parents had alcohol problems
  // - FASD services: Support for Fetal Alcohol Spectrum Disorder
  const isFamilySupportService = /\b(al-?anon|adult\s*children\s*of\s*alcoholic|fetal\s*alcohol|fasd\b|family\s*groups?\b.*alcohol)/i.test(text);

  // Check specific substances first (more specific = higher priority)
  // Skip alcohol match if this is a family support service
  if (!isFamilySupportService && indicators.alcohol.test(text)) return 'alcohol';
  if (indicators.opioid.test(text)) return 'opioid';
  if (indicators.stimulant.test(text)) return 'stimulant';
  if (indicators.cannabis.test(text)) return 'cannabis';
  if (indicators.gambling.test(text)) return 'gambling';

  // Check if it's a general addiction service
  if (indicators.general.test(text)) return 'general';

  return null;
}

/**
 * Detect if user is searching specifically for an organization's services
 * Returns the organization key if detected, null otherwise
 */
export function detectOrganizationSearch(query: string): string | null {
  const q = query.toLowerCase();

  // Organization search patterns - when user explicitly wants org's services
  const orgSearchPatterns = [
    { pattern: /\b(ahs|alberta health services?)\b.*\b(program|service|clinic|centre|center)s?\b/i, org: 'ahs' },
    { pattern: /\b(cmha|canadian mental health)\b.*\b(program|service|location)s?\b/i, org: 'cmha' },
    { pattern: /\bywca\b.*\b(program|service|shelter)s?\b/i, org: 'ywca' },
    { pattern: /\bymca\b.*\b(program|service|centre)s?\b/i, org: 'ymca' },
    { pattern: /\bsalvation army\b.*\b(program|service|shelter|location)s?\b/i, org: 'salvation_army' },
    { pattern: /\bwoods homes\b.*\b(program|service)s?\b/i, org: 'woods_homes' },
    { pattern: /\bcups\b.*\b(program|service|clinic)s?\b/i, org: 'cups' },
    { pattern: /\bdistress centre\b.*\b(program|service|line)s?\b/i, org: 'distress_centre' },
    // Also match when org name is the main search term
    { pattern: /^(ahs|alberta health services?)\s*(programs?|services?)?$/i, org: 'ahs' },
    { pattern: /^(cmha|canadian mental health)\s*(programs?|services?)?$/i, org: 'cmha' },
    { pattern: /^ywca\s*(programs?|services?)?$/i, org: 'ywca' },
    { pattern: /^ymca\s*(programs?|services?)?$/i, org: 'ymca' },
    { pattern: /^salvation army\s*(programs?|services?)?$/i, org: 'salvation_army' },
    { pattern: /^woods homes?\s*(programs?|services?)?$/i, org: 'woods_homes' },
    { pattern: /^cups\s*(programs?|services?)?$/i, org: 'cups' },
    { pattern: /^distress centre\s*(programs?|services?)?$/i, org: 'distress_centre' },
  ];

  for (const { pattern, org } of orgSearchPatterns) {
    if (pattern.test(q)) {
      console.log(`[OrgDiversity] Organization search detected: ${org}`);
      return org;
    }
  }

  return null;
}

/**
 * Extract organization name from service name
 * Tries to identify the organization by common patterns
 */
export function extractOrganization(serviceName: string): string {
  const name = serviceName.toLowerCase();

  // Common organization patterns in Alberta
  const orgPatterns = [
    { pattern: /\bcmha\b|canadian mental health/i, org: 'cmha' },
    { pattern: /\bywca\b/i, org: 'ywca' },
    { pattern: /\bymca\b/i, org: 'ymca' },
    { pattern: /\bsalvation army\b/i, org: 'salvation_army' },
    { pattern: /\bcalgary.*counselling/i, org: 'calgary_counselling' },
    { pattern: /\bahs\b|alberta health services/i, org: 'ahs' },
    { pattern: /\bcatholic.*services|catholic.*charities/i, org: 'catholic_services' },
    { pattern: /\bunited way\b/i, org: 'united_way' },
    { pattern: /\bdistress centre\b/i, org: 'distress_centre' },
    { pattern: /\bwoods homes\b/i, org: 'woods_homes' },
    { pattern: /\balpha house\b/i, org: 'alpha_house' },
    { pattern: /\bcalgary urban project society\b|cups\b/i, org: 'cups' },
    { pattern: /\bdrop-?in.*centre\b|drop-?in.*shelter/i, org: 'drop_in_centre' },
    { pattern: /\bmustard seed\b/i, org: 'mustard_seed' },
    { pattern: /\binn from the cold\b/i, org: 'inn_from_cold' },
  ];

  for (const { pattern, org } of orgPatterns) {
    if (pattern.test(name)) {
      return org;
    }
  }

  // Fallback: use first 2-3 significant words as org identifier
  const words = name.split(/\s+/).filter(w => w.length > 2 && !['the', 'and', 'for', 'of'].includes(w));
  return words.slice(0, 2).join('_') || 'unknown';
}
