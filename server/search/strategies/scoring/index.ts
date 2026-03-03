/**
 * Scoring Module — Barrel Export
 *
 * Re-exports all scoring functions and types from submodules.
 * Preserves existing import paths: './scoring' and '../strategies/scoring'.
 */

export { SCORING_CONFIG } from '../../config';
export * from './name-match';
export * from './intent-boost';
export * from './demographic-boost';
export * from './penalty';
export * from './preference-boost';
