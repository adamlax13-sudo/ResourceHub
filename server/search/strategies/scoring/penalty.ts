/**
 * Penalty / Demotion Module
 *
 * Contains penalty functions for search result ranking:
 * - Negative keyword penalties (semantic and direct term matching)
 * - Low quality / irrelevant service demotion
 */

import { SCORING_CONFIG } from '../../config';
import type { LiteService, LiteServiceWithDebug, ScoreExplanation } from '../../types';
import { searchLog } from '../../logger';
import type { BoostOptions } from './name-match';

/**
 * Apply penalty for services containing negative terms user wants to exclude
 * E.g., "shelter not religious" penalizes shelters with "religious" in their text
 * Handles semantic terms like "12_step" -> AA, NA, higher power, etc.
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
          searchLog.debug(`[NegativeKeyword] Penalizing "${service.name.substring(0, 40)}" (-${cfg.semanticMatch}) for "${term}" pattern match`);
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
          searchLog.debug(`[NegativeKeyword] Penalizing "${service.name.substring(0, 40)}" (-${cfg.directMatch}) for containing "${term}"`);
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
