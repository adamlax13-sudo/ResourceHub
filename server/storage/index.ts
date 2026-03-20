/**
 * Storage Facade
 *
 * Single entry point for all database operations. Delegates to domain
 * modules and wires cross-domain side effects between them.
 *
 * Domain modules extracted:
 * - SearchStorage: search cache, semantic/SQL search, confidence cache, aliases
 * - ServiceStorage: service CRUD, history, admin list/detail
 *
 * Remaining methods still live in DatabaseStorage (storage-impl.ts).
 */

import { DatabaseStorage } from './storage-impl';
import { SearchStorage } from './search-storage';
import { ServiceStorage, type ServiceSideEffects } from './service-storage';
import type { Service, ServiceHistory } from "@shared/schema";

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
  private _services = new ServiceStorage();

  /** Side-effect callbacks passed to ServiceStorage for cross-domain wiring */
  private get _serviceEffects(): ServiceSideEffects {
    return {
      invalidateConfidenceCache: () => this._search.invalidateConfidenceCache(),
      refreshSearchInfrastructure: (id, sid, changed) =>
        this._refreshSearchInfrastructure(id, sid, changed),
    };
  }

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

  // === Service domain delegation (with cross-domain side-effect wiring) ===

  override async createService(data: Partial<Service> & { name: string; category: string }): Promise<Service> {
    return this._services.createService(data);
  }

  override async updateService(id: number, changes: Partial<Service>, reason?: string): Promise<Service> {
    return this._services.updateService(id, changes, reason, this._serviceEffects);
  }

  override async deactivateService(id: number, reason: string): Promise<Service> {
    return this._services.deactivateService(id, reason, this._serviceEffects);
  }

  override async restoreService(id: number): Promise<Service> {
    return this._services.restoreService(id, this._serviceEffects);
  }

  override async getServiceHistory(serviceId: number): Promise<ServiceHistory[]> {
    return this._services.getServiceHistory(serviceId);
  }

  override async getAdminServices(params: Parameters<DatabaseStorage['getAdminServices']>[0]) {
    return this._services.getAdminServices(params);
  }

  override async getAdminServiceDetail(id: number): Promise<Service | null> {
    return this._services.getAdminServiceDetail(id);
  }

  override async bulkUpdateServices(ids: number[], changes: Partial<Service>, reason?: string): Promise<number> {
    return this._services.bulkUpdateServices(ids, changes, reason, this._serviceEffects);
  }

  override async bulkDeactivateServices(ids: number[], reason: string): Promise<number> {
    return this._services.bulkDeactivateServices(ids, reason, this._serviceEffects);
  }
}

/** Storage singleton — all route/service code imports this */
export const storage = new StorageFacade();
