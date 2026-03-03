/**
 * Preference Boosting
 *
 * Applies soft scoring boosts for UI toggle filters (faith-based, 12-step, 24/7).
 * These are preferences, not constraints — matching services sort to the top
 * but non-matching services remain visible.
 *
 * Called after boostByIntent in the comprehensive search pipeline.
 */

import type { SearchFilters } from '@shared/routes';
import type { LiteService, LiteServiceWithDebug, ScoreExplanation } from '../../types';
import type { BoostOptions } from './name-match';
import { searchLog } from '../../logger';

// Multiplier applied to rrfScore for boolean DB match (strong signal)
const BOOLEAN_MATCH_MULTIPLIER = 1.5;
// Multiplier applied to rrfScore for text-pattern match (inferred signal)
const TEXT_MATCH_MULTIPLIER = 1.2;

/** Text patterns that indicate a faith-based service */
const FAITH_PATTERNS = /\b(faith[- ]based|spiritual|church|christian|prayer|bible|higher power|god|ministry|pastoral|religious|scripture|worship|mosque|synagogue|temple|imam|rabbi|chaplain)\b/i;

/** Text patterns that indicate a 12-step service */
const TWELVE_STEP_PATTERNS = /\b(12[- ]step|twelve[- ]step|alcoholics anonymous|\baa\b|narcotics anonymous|\bna\b|sponsor|step work|big book|gamblers anonymous|\bga\b|cocaine anonymous|\bca\b|celebrate recovery)\b/i;

/** Text patterns that indicate 24/7 availability */
const AVAILABILITY_247_PATTERNS = /\b(24\/7|24[- ]hours?|around the clock|always open|crisis line|anytime|never close[sd]?)\b/i;

interface PreferenceConfig {
  filterKey: 'isFaithBased' | 'is12Step' | 'is24_7';
  booleanField: 'isFaithBased' | 'is12Step' | 'is24_7';
  /** Also check the snake_case variant from DB rows */
  booleanFieldAlt: 'is_faith_based' | 'is_12_step' | 'is24_7';
  textPattern: RegExp;
  label: string;
}

const PREFERENCE_CONFIGS: PreferenceConfig[] = [
  {
    filterKey: 'isFaithBased',
    booleanField: 'isFaithBased',
    booleanFieldAlt: 'is_faith_based',
    textPattern: FAITH_PATTERNS,
    label: 'faith-based',
  },
  {
    filterKey: 'is12Step',
    booleanField: 'is12Step',
    booleanFieldAlt: 'is_12_step',
    textPattern: TWELVE_STEP_PATTERNS,
    label: '12-step',
  },
  {
    filterKey: 'is24_7',
    booleanField: 'is24_7',
    booleanFieldAlt: 'is24_7',
    textPattern: AVAILABILITY_247_PATTERNS,
    label: '24/7',
  },
];

/**
 * Apply preference boosts for active soft filters.
 *
 * Services matching a preference get their rrfScore multiplied:
 * - Tier 1 (boolean match in DB): 1.5x
 * - Tier 2 (text pattern match in description/name): 1.2x
 * - Tier 3 (no match): 1.0x (unchanged)
 *
 * Multiple active preferences stack multiplicatively.
 */
export function applyPreferenceBoosts(
  services: LiteService[],
  filters: SearchFilters,
  options?: BoostOptions,
): LiteService[] {
  // Determine which preferences are active
  const activePrefs = PREFERENCE_CONFIGS.filter(p => filters[p.filterKey] === true);
  if (activePrefs.length === 0) return services;

  const trackExplanations = options?.trackExplanations ?? false;
  const labels = activePrefs.map(p => p.label).join(', ');
  searchLog.debug(`[PreferenceBoost] Active preferences: ${labels}`);

  let boostCount = 0;

  const boosted = services.map(svc => {
    const text = `${svc.name} ${svc.category} ${svc.description}`;
    let multiplier = 1.0;
    const explanations: ScoreExplanation[] = [];

    for (const pref of activePrefs) {
      const svcAny = svc as any;
      const hasBooleanMatch =
        svc[pref.booleanField] === true || svcAny[pref.booleanFieldAlt] === true;

      if (hasBooleanMatch) {
        multiplier *= BOOLEAN_MATCH_MULTIPLIER;
        if (trackExplanations) {
          explanations.push({
            factor: `preference.${pref.label}.boolean`,
            value: BOOLEAN_MATCH_MULTIPLIER,
            reason: `DB ${pref.label} flag is true (${BOOLEAN_MATCH_MULTIPLIER}x)`,
          });
        }
      } else if (pref.textPattern.test(text)) {
        multiplier *= TEXT_MATCH_MULTIPLIER;
        if (trackExplanations) {
          explanations.push({
            factor: `preference.${pref.label}.text`,
            value: TEXT_MATCH_MULTIPLIER,
            reason: `Description matches ${pref.label} keywords (${TEXT_MATCH_MULTIPLIER}x)`,
          });
        }
      }
    }

    if (multiplier === 1.0) return svc;

    boostCount++;
    const newScore = (svc.rrfScore ?? 0) * multiplier;

    const result: LiteService = { ...svc, rrfScore: newScore };

    // Merge explanations into debug info if tracking
    if (trackExplanations && explanations.length > 0) {
      const withDebug = result as LiteServiceWithDebug;
      withDebug.scoreExplanation = [
        ...((svc as LiteServiceWithDebug).scoreExplanation ?? []),
        ...explanations,
      ];
    }

    return result;
  });

  // Re-sort by rrfScore descending so boosted services float to top
  boosted.sort((a, b) => (b.rrfScore ?? 0) - (a.rrfScore ?? 0));

  searchLog.debug(`[PreferenceBoost] Boosted ${boostCount}/${services.length} services`);

  return boosted;
}
