/**
 * Storage Facade
 *
 * Single entry point for all database operations. Currently delegates
 * everything to DatabaseStorage. As domain modules are extracted
 * (search, service, review, etc.), the facade will wire cross-domain
 * side effects between them.
 */

import { DatabaseStorage } from './storage-impl';

// Re-export types from the implementation
export type {
  IStorage,
  SemanticSearchResult,
  FastSearchResult,
  EnrichmentData,
} from './storage-impl';

export { DatabaseStorage } from './storage-impl';

/** Storage singleton — all route/service code imports this */
export const storage = new DatabaseStorage();
