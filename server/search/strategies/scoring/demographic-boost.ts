/**
 * Demographic Boosting
 *
 * Helper functions for age, gender, student, community, language,
 * and family context boosting. Called by boostByIntent in intent-boost.ts.
 */

import { SCORING_CONFIG } from '../../config';
import type { LiteService } from '../../types';
import { searchLog } from '../../logger';
import type { StudentContext } from '../detectors';

/** Callback type used to accumulate scoring factors */
export type AddFactorFn = (factor: string, value: number, reason: string) => void;

/**
 * Apply gender-based boosting/penalties to a service.
 */
export function applyGenderBoost(
  textLower: string,
  genderPref: string,
  addFactor: AddFactorFn,
): void {
  const cfg = SCORING_CONFIG;
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

/**
 * Apply age group boosting/penalties to a service.
 */
export function applyAgeGroupBoost(
  svc: LiteService,
  textLower: string,
  ageGroup: { ageGroup: string },
  addFactor: AddFactorFn,
): void {
  const cfg = SCORING_CONFIG;
  const isYouthService = /youth|teen|adolescent|young|student|under 25|child|kids?|juvenile|minor|school/i.test(textLower);
  const isSeniorService = /senior|elderly|aging|aged|older adult|65\+|retirement|dementia|alzheimer/i.test(textLower);
  const isAdultService = /\badult\b/i.test(textLower);

  if (ageGroup.ageGroup === 'youth') {
    if (isYouthService) addFactor('ageGroup.youthMatch', cfg.ageGroup.youthMatch, `Youth service matches youth query`);
    if (isSeniorService) addFactor('ageGroup.youthForSeniorPenalty', cfg.ageGroup.youthForSeniorPenalty, `Senior service for youth query`);
    if (isAdultService && !isYouthService) addFactor('ageGroup.youthForAdultPenalty', cfg.ageGroup.youthForAdultPenalty, `Adult-only service for youth query`);
  } else if (ageGroup.ageGroup === 'adult') {
    if (isYouthService && !isAdultService) {
      addFactor('ageGroup.adultForYouthPenalty', cfg.ageGroup.adultForYouthPenalty, `Youth-only service for adult query`);
      searchLog.debug(`[AgeBoost] "${svc.name.substring(0, 40)}" ${cfg.ageGroup.adultForYouthPenalty} penalty for youth service (adult query)`);
    }
    if (isAdultService) {
      addFactor('ageGroup.adultMatch', cfg.ageGroup.adultMatch, `Adult service matches adult query`);
      searchLog.debug(`[AgeBoost] "${svc.name.substring(0, 40)}" +${cfg.ageGroup.adultMatch} for adult service (adult query)`);
    }
    if (isSeniorService) addFactor('ageGroup.adultForSeniorPenalty', cfg.ageGroup.adultForSeniorPenalty, `Senior service for adult query`);
  } else if (ageGroup.ageGroup === 'senior') {
    if (isSeniorService) addFactor('ageGroup.seniorMatch', cfg.ageGroup.seniorMatch, `Senior service matches senior query`);
    if (isYouthService && /only|exclusive/i.test(textLower)) addFactor('ageGroup.seniorYouthOnlyPenalty', cfg.ageGroup.seniorYouthOnlyPenalty, `Youth-only service for senior query`);
  }
}

/**
 * Apply urgency boosting/penalties to a service.
 */
export function applyUrgencyBoost(
  textLower: string,
  urgency: string,
  addFactor: AddFactorFn,
): void {
  const cfg = SCORING_CONFIG;
  if (urgency === 'immediate') {
    if (/24\/7|24 hour|walk-?in|emergency|crisis|immediate|no appointment|same day|drop-?in|open now/i.test(textLower)) {
      addFactor('urgency.immediateAccess', cfg.urgency.immediateAccess, `Immediate access service`);
    }
    if (/appointment required|waitlist|intake process|wait time|waiting list/i.test(textLower)) {
      addFactor('urgency.appointmentPenalty', cfg.urgency.appointmentPenalty, `Requires appointment for urgent query`);
    }
  }
}

/**
 * Apply "no waitlist" query boosting/penalties to a service.
 */
export function applyNoWaitlistBoost(
  svc: LiteService,
  textLower: string,
  rawQuery: string,
  addFactor: AddFactorFn,
): void {
  const cfg = SCORING_CONFIG;
  const rawQueryLower = rawQuery.toLowerCase();
  const isNoWaitlistQuery = /\b(no wait|no waitlist|without wait|walk[\s-]?in|immediate|can'?t wait)\b/i.test(rawQueryLower);
  if (isNoWaitlistQuery) {
    if (/walk-?in|no appointment|same day|drop-?in|immediate access|no wait|open now|24\/7|24 hour/i.test(textLower)) {
      addFactor('exclusion.noWaitlistBoost', cfg.exclusion.noWaitlistBoost, `Walk-in/immediate access for no-waitlist query`);
      searchLog.debug(`[NoWaitlistBoost] "${svc.name.substring(0, 40)}" +${cfg.exclusion.noWaitlistBoost} for immediate access`);
    }
    // Penalize services that explicitly mention waitlists
    if (/waitlist|waiting list|wait time|intake process|referral required/i.test(textLower)) {
      addFactor('exclusion.waitlist', cfg.exclusion.waitlist, `Has waitlist for no-waitlist query`);
      searchLog.debug(`[NoWaitlistPenalty] "${svc.name.substring(0, 40)}" ${cfg.exclusion.waitlist} for waitlist mention`);
    }
  }
}

/**
 * Apply family situation boosting to a service.
 */
export function applyFamilySituationBoost(
  textLower: string,
  familySituations: string[],
  addFactor: AddFactorFn,
): void {
  const cfg = SCORING_CONFIG;
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

/**
 * Apply community preference boosting to a service.
 */
export function applyCommunityBoost(
  textLower: string,
  communityPref: string,
  addFactor: AddFactorFn,
): void {
  const cfg = SCORING_CONFIG;
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

/**
 * Apply student/university boosting to a service.
 */
export function applyStudentBoost(
  svc: LiteService,
  textLower: string,
  studentContext: StudentContext,
  addFactor: AddFactorFn,
): void {
  const cfg = SCORING_CONFIG;
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
      searchLog.debug(`[StudentBoost] "${svc.name.substring(0, 40)}" boosted for ${studentContext.institution} (institution match)`);
    } else if (isStudentService) {
      addFactor('student.genericStudent', cfg.student.genericStudent, `Generic student service`);
    }
  } else if (isStudentService) {
    addFactor('student.studentService', cfg.student.studentService, `Student service`);
    searchLog.debug(`[StudentBoost] "${svc.name.substring(0, 40)}" boosted as student service`);
  } else if (isYouthService) {
    addFactor('student.youthService', cfg.student.youthService, `Youth service for student query`);
  }
}

/**
 * Apply language preference boosting to a service.
 */
export function applyLanguageBoost(
  svc: LiteService,
  textLower: string,
  languagePref: string,
  addFactor: AddFactorFn,
): void {
  const cfg = SCORING_CONFIG;
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
    searchLog.debug(`[LanguageBoost] "${svc.name.substring(0, 40)}" boosted for ${languagePref}`);
  }
  if (/\b(interpreter|multilingual|translation|multiple languages)\b/i.test(textLower)) {
    addFactor('language.multilingual', cfg.language.multilingual, `Multilingual service`);
  }
}

/**
 * Apply family context boosting to a service.
 */
export function applyFamilyContextBoost(
  svc: LiteService,
  textLower: string,
  familyContext: string,
  addFactor: AddFactorFn,
): void {
  const cfg = SCORING_CONFIG;
  const isFamilySupportService = /\b(family support|family services|loved ones|concerned persons|al-?anon|nar-?anon|family counsell?ing|parent support|caregiver|coping)\b/i.test(textLower);
  const isInterventionService = /\b(intervention|family therapy|family program)\b/i.test(textLower);

  if (isFamilySupportService) {
    addFactor('familyContext.familySupport', cfg.familyContext.familySupport, `Family support service`);
    searchLog.debug(`[FamilyBoost] "${svc.name.substring(0, 40)}" boosted as family support`);
  }
  if (isInterventionService) {
    addFactor('familyContext.intervention', cfg.familyContext.intervention, `Intervention/family therapy service`);
  }
}
