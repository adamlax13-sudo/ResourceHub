/**
 * Search Configuration — Barrel Re-export
 *
 * Re-exports everything from submodules so existing imports
 * from './config' or '../config' continue to work unchanged.
 *
 * Submodules:
 *   - scoring.ts  — SCORING_CONFIG scoring thresholds and weight configurations
 *   - pinned.ts   — Crisis/pinning service configuration (988, PCHAD, etc.)
 *   - analysis.ts — SEARCH_CONFIG, query analysis patterns, type definitions
 */

export { SCORING_CONFIG } from './scoring';
export type { ScoringConfigType } from './scoring';

export {
  CRISIS_PINNED_SERVICE_ID,
  CRISIS_PINNED_SERVICE_LITE,
  CRISIS_PINNED_SERVICE_FULL,
  PCHAD_PINNED_SERVICE_ID,
  PCHAD_PINNED_SERVICE_LITE,
  PCHAD_PINNED_SERVICE_FULL,
} from './pinned';

export { SEARCH_CONFIG } from './analysis';
export type { SearchType, QueryIntent, SubstanceType, SearchConfigType } from './analysis';
