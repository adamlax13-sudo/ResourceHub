/**
 * Sub-Intent Boost Module
 *
 * Provides sub-intent-aware category overrides for trimToRelevant() rescue
 * and multiplicative scoring boosts for services matching detected sub-intents.
 */

import type { LiteService } from '../../types';

/**
 * When a sub-intent is detected, use this narrower category set
 * for trimToRelevant() rescue instead of the full parent intent's categories.
 */
export const SUB_INTENT_CATEGORY_OVERRIDE: Record<string, Set<string>> = {
  'substance_abuse.gambling':             new Set(['Gambling Support']),
  'substance_abuse.harm_reduction':       new Set(['Harm Reduction']),
  'substance_abuse.detox':                new Set(['Detox & Withdrawal']),
  'substance_abuse.residential_treatment': new Set(['Residential Treatment']),
  'healthcare_access.dental':             new Set(['Healthcare Access']),
  'healthcare_access.hospital_er':        new Set(['Hospital & Emergency']),
  'healthcare_access.walk_in_clinic':     new Set(['Healthcare Access']),
  'basic_needs.clothing':                 new Set(['Basic Needs & Material Aid']),
  'basic_needs.furniture':                new Set(['Basic Needs & Material Aid']),
  'food_insecurity.food_bank':            new Set(['Food Banks & Meals']),
  'food_insecurity.free_meals':           new Set(['Food Banks & Meals']),
  'grief_support.pregnancy_loss':         new Set(['Grief & Bereavement']),
  'grief_support.pet_loss':               new Set(['Grief & Bereavement']),
};

/**
 * Text patterns that identify services matching a specific sub-intent.
 * Used for multiplicative scoring boost.
 */
const SUB_INTENT_TEXT_PATTERNS: Record<string, RegExp> = {
  'substance_abuse.gambling':       /\b(?:gambling|gambler|gaming|wagering|casino|VLT|GameSense)\b/i,
  'substance_abuse.harm_reduction': /\b(?:harm reduction|naloxone|narcan|safe (?:supply|injection|consumption)|needle|overdose prevention)\b/i,
  'basic_needs.furniture':          /\b(?:furniture|household|home (?:starter|setup)|bed|mattress|appliance)\b/i,
  'basic_needs.clothing':           /\b(?:clothing|clothes|coat|jacket|thrift)\b/i,
  'community_social.adaptive_sports': /\b(?:adaptive|inclusive|wheelchair|para[- ]?sport|accessible (?:recreation|sport|fitness))\b/i,
  'senior_services.elder_abuse':    /\b(?:elder abuse|senior abuse|neglect.*(?:elderly|senior)|exploit.*(?:elderly|senior))\b/i,
  'grief_support.pet_loss':         /\b(?:pet|animal|companion animal).*(?:loss|grief|bereavement)\b/i,
};

const SUB_INTENT_BOOST = 1.15;

/**
 * Apply sub-intent-aware scoring boost to services.
 * Services matching a sub-intent's text pattern or category override get a multiplicative boost.
 */
export function applySubIntentBoost(services: LiteService[], subIntents: string[]): LiteService[] {
  if (!subIntents || subIntents.length === 0) return services;

  const activePatterns: RegExp[] = [];
  const activeCategoryOverrides: Set<string>[] = [];

  for (const si of subIntents) {
    const textPattern = SUB_INTENT_TEXT_PATTERNS[si];
    if (textPattern) activePatterns.push(textPattern);

    const catOverride = SUB_INTENT_CATEGORY_OVERRIDE[si];
    if (catOverride) activeCategoryOverrides.push(catOverride);
  }

  if (activePatterns.length === 0 && activeCategoryOverrides.length === 0) return services;

  return services.map(s => {
    if (s.rrfScore == null) return s; // pinned, skip

    const text = `${s.name} ${s.description || ''} ${s.category || ''}`;
    let boost = 1.0;

    // Text pattern match
    for (const pattern of activePatterns) {
      if (pattern.test(text)) {
        boost *= SUB_INTENT_BOOST;
        break; // one boost per service
      }
    }

    // Category match from override
    for (const catSet of activeCategoryOverrides) {
      if (s.category && catSet.has(s.category)) {
        boost *= SUB_INTENT_BOOST;
        break;
      }
    }

    if (boost === 1.0) return s;
    return { ...s, rrfScore: s.rrfScore * boost };
  });
}
