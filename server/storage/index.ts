/**
 * Storage Facade
 *
 * Single entry point for all database operations. Delegates to domain
 * modules and wires cross-domain side effects between them.
 *
 * Domain modules:
 * - SearchStorage: search cache, semantic/SQL search, confidence cache, aliases
 * - ServiceStorage: service CRUD, history, admin list/detail
 * - ReviewStorage: change request CRUD
 * - AnalyticsStorage: click tracking, search quality metrics, votes
 * - QualityStorage: data quality summary + issues
 * - DashboardStorage: dashboard stats, activity, scraper runs
 *
 * Remaining in DatabaseStorage (storage-impl.ts):
 * - Feedback, core service queries (getAllActiveServices, getCrisisLines, etc.)
 * - Enrichment CRUD (getEnrichmentsByServiceIds, upsertEnrichment, etc.)
 * - approveChangeRequest + bulkApproveChangeRequests (cross-domain orchestration)
 */

import { DatabaseStorage } from './storage-impl';
import { SearchStorage } from './search-storage';
import { ServiceStorage, type ServiceSideEffects } from './service-storage';
import { ReviewStorage } from './review-storage';
import { AnalyticsStorage } from './analytics-storage';
import { QualityStorage } from './quality-storage';
import { DashboardStorage } from './dashboard-storage';
import type { Service, ServiceHistory, ServiceChangeRequest, InsertServiceChangeRequest, ScraperLog } from "@shared/schema";

// Re-export types from the implementation
export type {
  IStorage,
  SemanticSearchResult,
  FastSearchResult,
  EnrichmentData,
} from './storage-impl';

export { DatabaseStorage } from './storage-impl';

const VALID_AGE_GROUPS = ['youth', 'youth_and_adult', 'adult', 'senior', 'all_ages', 'children_and_youth'] as const;

/** Normalize freeform ageGroup values from scrapers into valid enum values */
function normalizeAgeGroup(raw: string | null | undefined): string {
  if (!raw) return 'all_ages';
  const lower = raw.toLowerCase().trim();
  // Already valid
  if ((VALID_AGE_GROUPS as readonly string[]).includes(lower)) return lower;
  // Common variants
  if (lower === 'adults') return 'adult';
  if (lower === 'seniors') return 'senior';
  // Freeform detection based on keywords
  const hasChildren = /child/i.test(raw);
  const hasYouth = /youth|teen|adolesc/i.test(raw);
  const hasAdult = /adult/i.test(raw);
  const hasSenior = /senior|elder|older/i.test(raw);
  if (hasChildren && hasYouth && !hasAdult) return 'children_and_youth';
  if (hasChildren && !hasYouth && !hasAdult) return 'children_and_youth';
  if (hasYouth && hasAdult) return 'youth_and_adult';
  if (hasYouth && !hasAdult) return 'youth';
  if (hasSenior) return 'senior';
  if (hasAdult) return 'adult';
  // Multiple age ranges or unrecognized → all_ages
  return 'all_ages';
}

/**
 * StorageFacade extends DatabaseStorage for backward compat, but
 * overrides extracted methods to delegate to domain modules.
 * Cross-domain side effects (e.g., updateService → invalidateConfidenceCache)
 * are wired here rather than buried inside domain modules.
 */
class StorageFacade extends DatabaseStorage {
  private _search = new SearchStorage();
  private _services = new ServiceStorage();
  private _reviews = new ReviewStorage();
  private _analytics = new AnalyticsStorage();
  private _quality = new QualityStorage();
  private _dashboard = new DashboardStorage();

  /** Debounced search cache clear — coalesces rapid mutations (e.g. bulk updates) into one DB call */
  private _searchCacheClearTimer: ReturnType<typeof setTimeout> | null = null;
  private _debouncedClearSearchCache(): void {
    if (this._searchCacheClearTimer) return; // already scheduled
    this._searchCacheClearTimer = setTimeout(() => {
      this._searchCacheClearTimer = null;
      this._search.clearSearchCache();
    }, 100);
  }

  /** Side-effect callbacks passed to ServiceStorage for cross-domain wiring */
  private get _serviceEffects(): ServiceSideEffects {
    return {
      invalidateConfidenceCache: () => this._search.invalidateConfidenceCache(),
      refreshSearchInfrastructure: (id, sid, changed) =>
        this._refreshSearchInfrastructure(id, sid, changed),
      invalidateTranslations: async (serviceId) => {
        const { invalidateTranslations } = await import('../translation/index');
        await invalidateTranslations(serviceId);
      },
      invalidateSearchCache: () => this._debouncedClearSearchCache(),
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
  override getServiceLastChecked = this._search.getServiceLastChecked.bind(this._search);
  override getServiceCoordsAndFreshness = this._search.getServiceCoordsAndFreshness.bind(this._search);
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

  // === Review domain delegation ===

  override createChangeRequest = this._reviews.createChangeRequest.bind(this._reviews);
  override getChangeRequests = this._reviews.getChangeRequests.bind(this._reviews);
  override getChangeRequestById = this._reviews.getChangeRequestById.bind(this._reviews);
  override updateChangeRequest = this._reviews.updateChangeRequest.bind(this._reviews);
  override rejectChangeRequest = this._reviews.rejectChangeRequest.bind(this._reviews);

  // approveChangeRequest orchestrates across domains (review + service CRUD),
  // so it lives on the facade to ensure it calls the facade's overridden
  // createService/updateService/deactivateService (with proper side effects).
  override async approveChangeRequest(id: number, reviewedBy?: string): Promise<Service> {
    const req = await this.getChangeRequestById(id);
    if (!req) throw new Error(`Change request with id ${id} not found`);
    if (req.status !== 'pending') throw new Error(`Change request ${id} is not pending (status: ${req.status})`);

    let resultService: Service;
    const proposed = req.proposedChanges as Record<string, any>;

    // Normalize ageGroup to valid enum values before DB insert/update
    if (proposed.ageGroup !== undefined) {
      proposed.ageGroup = normalizeAgeGroup(proposed.ageGroup);
    }

    switch (req.changeType) {
      case 'create': {
        resultService = await this.createService({
          name: proposed.name,
          category: proposed.category,
          ...proposed,
        });
        break;
      }
      case 'update': {
        if (!req.serviceId) throw new Error(`Change request ${id} has no serviceId for update`);
        const allowedFields = new Set([
          'name', 'category', 'description', 'location', 'eligibility',
          'processSteps', 'waitTimes', 'requiredDocs', 'hoursOfOperation',
          'languagesSupported', 'serviceFormat', 'websiteUrl', 'phone', 'email',
          'address', 'genderRestriction', 'ageGroup', 'isFaithBased', 'is12Step',
          'is24_7', 'tags', 'confidenceScore',
        ]);
        const constrainedFields = new Set(['ageGroup', 'genderRestriction']);
        const updateFields: Record<string, any> = { isActive: true };
        for (const [key, val] of Object.entries(proposed)) {
          if (!allowedFields.has(key) || val === undefined) continue;
          if (constrainedFields.has(key) && val === '') {
            updateFields[key] = null;
          } else {
            updateFields[key] = val;
          }
        }
        resultService = await this.updateService(req.serviceId!, updateFields as Partial<Service>);
        break;
      }
      case 'deactivate': {
        if (!req.serviceId) throw new Error(`Change request ${id} has no serviceId for deactivation`);
        resultService = await this.deactivateService(req.serviceId!, proposed.reason || 'Approved via review queue');
        break;
      }
      case 'review':
        throw new Error(`Review requests (id ${id}) cannot be approved directly — edit the service and resolve the review manually`);
      default:
        throw new Error(`Unknown changeType: ${req.changeType}`);
    }

    await this.updateChangeRequest(id, {
      status: 'approved',
      reviewedAt: new Date(),
      reviewedBy: reviewedBy ?? 'admin',
    });

    return resultService;
  }

  override async bulkApproveChangeRequests(ids: number[], reviewedBy?: string): Promise<number> {
    let successCount = 0;
    for (const id of ids) {
      try {
        await this.approveChangeRequest(id, reviewedBy);
        successCount++;
      } catch (err) {
        console.warn(`[Admin] bulkApproveChangeRequests: failed to approve ${id}:`, err);
      }
    }
    return successCount;
  }

  // === Analytics domain delegation ===

  override trackSearchClick = this._analytics.trackSearchClick.bind(this._analytics);
  override getClickCountForService = this._analytics.getClickCountForService.bind(this._analytics);
  override getPopularSearches = this._analytics.getPopularSearches.bind(this._analytics);
  override getPopularQueries = this._analytics.getPopularQueries.bind(this._analytics);
  override getQueryAffinities = this._analytics.getQueryAffinities.bind(this._analytics);
  override createServiceVote = this._analytics.createServiceVote.bind(this._analytics);
  override recordSearchQuality = this._analytics.recordSearchQuality.bind(this._analytics);
  override updateSearchQuality = this._analytics.updateSearchQuality.bind(this._analytics);
  override getSearchQualityReport = this._analytics.getSearchQualityReport.bind(this._analytics);
  override updateSearchQualityBySession = this._analytics.updateSearchQualityBySession.bind(this._analytics);

  // === Quality domain delegation ===

  override getQualitySummary = this._quality.getQualitySummary.bind(this._quality);
  override getQualityIssues = this._quality.getQualityIssues.bind(this._quality);

  // === Dashboard domain delegation ===

  override getDashboardStats = this._dashboard.getDashboardStats.bind(this._dashboard);
  override getRecentActivity = this._dashboard.getRecentActivity.bind(this._dashboard);
  override getScraperRuns = this._dashboard.getScraperRuns.bind(this._dashboard);
  override getScraperRunById = this._dashboard.getScraperRunById.bind(this._dashboard);
}

/** Storage singleton — all route/service code imports this */
export const storage = new StorageFacade();
