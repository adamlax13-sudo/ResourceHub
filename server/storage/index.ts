/**
 * Storage Facade
 *
 * Single entry point for all database operations. Delegates to domain
 * modules and wires cross-domain side effects between them.
 *
 * Domain modules extracted so far:
 * - SearchStorage: search cache, semantic/SQL search, confidence cache, aliases
 *
 * Remaining methods still live in DatabaseStorage (storage-impl.ts).
 */

import { DatabaseStorage } from './storage-impl';
import { SearchStorage } from './search-storage';

// Re-export types from the implementation
export type {
  IStorage,
  SemanticSearchResult,
  FastSearchResult,
  EnrichmentData,
} from './storage-impl';

export { DatabaseStorage } from './storage-impl';

/**
 * StorageFacade extends DatabaseStorage for backward compat, but
 * overrides extracted methods to delegate to domain modules.
 * Cross-domain side effects (e.g., updateService → invalidateConfidenceCache)
 * are wired here rather than buried inside domain modules.
 */
class StorageFacade extends DatabaseStorage {
  private _search = new SearchStorage();

  // === Search domain delegation ===

  override createSearch = this._search.createSearch.bind(this._search);
  override getSearchByQuery = this._search.getSearchByQuery.bind(this._search);
  override semanticSearch = this._search.semanticSearch.bind(this._search);
  override hasEmbeddings = this._search.hasEmbeddings.bind(this._search);
  override fastSearch = this._search.fastSearch.bind(this._search);
  override getEnrichmentsBatch = this._search.getEnrichmentsBatch.bind(this._search);
  override getConfidenceScores = this._search.getConfidenceScores.bind(this._search);
  override invalidateConfidenceCache = this._search.invalidateConfidenceCache.bind(this._search);
  override getServiceCoordinates = this._search.getServiceCoordinates.bind(this._search);
  override getAliasesForServices = this._search.getAliasesForServices.bind(this._search);
  override findServiceByAlias = this._search.findServiceByAlias.bind(this._search);
  override getAliasLookup = this._search.getAliasLookup.bind(this._search);
  override hasOptimizedSearch = this._search.hasOptimizedSearch.bind(this._search);
  override refreshSearchView = this._search.refreshSearchView.bind(this._search);
  override clearSearchCache = this._search.clearSearchCache.bind(this._search);
  override clearStaleSearches = this._search.clearStaleSearches.bind(this._search);
  override getPrecomputedSearch = this._search.getPrecomputedSearch.bind(this._search);
  override savePrecomputedSearch = this._search.savePrecomputedSearch.bind(this._search);
  override logFailedQuery = this._search.logFailedQuery.bind(this._search);
  override getTopFailedQueries = this._search.getTopFailedQueries.bind(this._search);
}

/** Storage singleton — all route/service code imports this */
export const storage = new StorageFacade();
