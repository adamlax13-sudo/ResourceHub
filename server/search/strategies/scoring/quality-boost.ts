/**
 * Data Quality Boost
 *
 * Applied AFTER relevance ranking to promote high-quality services.
 * Never affects result inclusion — only reorders.
 * Max multiplier ~1.25x so relevance always dominates.
 */

import type { LiteService } from '../../types';

/**
 * Apply a mild data quality boost. High-quality services (good confidence scores,
 * websites, rich descriptions) rank higher among similarly-relevant results.
 *
 * IMPORTANT: confidence_score of 0 or null is treated as NEUTRAL (not penalized).
 * Many important services have score 0 because the scraper hasn't fully scored them.
 */
export function applyDataQualityBoost(services: LiteService[], confidenceScores: Map<string, number>): LiteService[] {
  if (services.length === 0) return services;

  // Preserve pinned services at the top. Pinned services (988, PCHAD, Al-Anon)
  // are prepended by crisis/pinned modules and have no rrfScore. They must not
  // be reordered by the quality boost.
  const pinned: LiteService[] = [];
  const rankable: LiteService[] = [];
  for (const s of services) {
    if (s.rrfScore == null || s.rrfScore === 0) {
      pinned.push(s);
    } else {
      rankable.push(s);
    }
  }

  const boosted = rankable
    .map(service => {
      let qualityMultiplier = 1.0;

      // Confidence score component (max +0.10)
      const confidence = confidenceScores.get(service.id);
      // Treat null/undefined/0 as neutral — don't penalize unscored services
      if (confidence && confidence > 0) {
        if (confidence >= 80) {
          qualityMultiplier += 0.10;
        } else if (confidence >= 60) {
          qualityMultiplier += 0.05;
        } else if (confidence < 40) {
          // Only penalize explicitly low scores (not 0/null)
          qualityMultiplier -= 0.03;
        }
      }

      // Description richness (max +0.10)
      const descLength = service.description?.length ?? 0;
      if (descLength >= 150) {
        qualityMultiplier += 0.10;
      } else if (descLength >= 80) {
        qualityMultiplier += 0.05;
      } else if (descLength < 30 && descLength > 0) {
        qualityMultiplier -= 0.03;
      }

      return {
        ...service,
        rrfScore: (service.rrfScore ?? 0) * qualityMultiplier,
      };
    })
    .sort((a, b) => (b.rrfScore ?? 0) - (a.rrfScore ?? 0));

  return [...pinned, ...boosted];
}
