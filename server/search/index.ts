/**
 * Search Orchestrator
 *
 * Main entry point for all search operations.
 * Coordinates query analysis, strategy selection, and response formatting.
 */

// Cache version - increment this to invalidate all cached search results
// when making changes that affect search behavior
const CACHE_VERSION = 'v96'; // Bumped: location hard filter — exclude services from other cities

import { SEARCH_CONFIG } from './config';
import type {
  SearchInput,
  SearchResponse,
  SearchResult,
  LiteService,
  LiteServiceWithDebug,
  SearchType,
} from './types';
import { analyzeQuery, buildCacheKey } from './analyzer';
import { normalizeForCache } from '../helpers/keywords';
import { withTimeout, TIMEOUTS } from '../helpers/timeout';
import { ComprehensiveSearchStrategy } from './strategies/comprehensive';
import { pinCrisisService, boostCrisisServices, filterToCrisisOnly, buildCrisisResults, getCrisisServiceFull, isCrisisServiceId } from './crisis';
import { isPchadQuery, pinPchadService, getPchadServiceFull, isPchadServiceId } from './pchad';
import {
  isFamilyAddictionQuery,
  isTenantLegalQuery,
  pinAlAnonService,
  ensureLegalAidInResults,
} from './pinned';
import { storage } from '../storage';
import { createHash } from 'crypto';
import type { Service } from '@shared/schema';
import type { ServiceDetail } from '@shared/routes';
import { applyPreferenceBoosts } from './strategies/scoring/preference-boost';
import { applyFilterMatchBoosts } from './strategies/scoring/filter-match-boost';
import { applyDataQualityBoost } from './strategies/scoring/quality-boost';
import { applyHardFilters, filterByLocation } from './filters';
import { applyNegativePenalty } from './strategies/scoring/penalty';

// Single search strategy - comprehensive mode only
const searchStrategy = new ComprehensiveSearchStrategy();

// applyHardFilters is imported from ./filters (extracted for testability)

// In-memory services cache for generating database hash and active ID set
interface ServicesCacheData {
  hash: string;
  activeIds: Set<string>;
  lastFetched: number;
}
let servicesCacheData: ServicesCacheData | null = null;
let servicesCachePromise: Promise<ServicesCacheData> | null = null;

async function refreshServicesCache(): Promise<ServicesCacheData> {
  const now = Date.now();
  if (servicesCacheData && (now - servicesCacheData.lastFetched) < SEARCH_CONFIG.cache.servicesCacheTTL) {
    return servicesCacheData;
  }

  // Deduplicate concurrent callers — share a single in-flight fetch
  if (servicesCachePromise) {
    return servicesCachePromise;
  }

  servicesCachePromise = (async () => {
    try {
      const activeServices = await storage.getAllActiveServices();
      const latestUpdate = activeServices.length > 0
        ? Math.max(...activeServices.map((s: Service) => s.lastUpdated?.getTime() || 0))
        : 0;
      const hash = createHash('md5')
        .update(`${activeServices.length}-${latestUpdate}`)
        .digest('hex')
        .slice(0, 8);
      const activeIds = new Set(activeServices.map((s: Service) => s.serviceId));

      servicesCacheData = { hash, activeIds, lastFetched: Date.now() };
      return servicesCacheData;
    } catch (err) {
      if (servicesCacheData) return servicesCacheData;
      console.error('[SearchOrchestrator] Failed to load services cache and no prior cache available:', err);
      throw new Error('Services cache unavailable');
    } finally {
      servicesCachePromise = null;
    }
  })();

  return servicesCachePromise;
}

/**
 * Filter out deactivated services from cached/precomputed results.
 * This prevents stale caches from returning services that were deactivated
 * after the cache was populated.
 */
function filterActiveServices(services: LiteService[], activeIds: Set<string>): LiteService[] {
  if (activeIds.size === 0) {
    // Fail-closed: no active IDs means DB may be unreachable — return empty rather than stale data
    console.error('[Search] No active service IDs found — returning empty results');
    return [];
  }
  const filtered = services.filter(s => activeIds.has(s.id));
  if (filtered.length < services.length) {
    console.log(`[SearchOrchestrator] Filtered out ${services.length - filtered.length} inactive service(s) from cached results`);
  }
  return filtered;
}

/**
 * Main search function - the single entry point for all search requests.
 */
export async function search(input: SearchInput): Promise<SearchResponse> {
  const startTime = Date.now();

  // Normalize query for precomputed cache lookup
  const normalizedQuery = normalizeForCache(input.query);

  // Load active service IDs for filtering stale cache entries
  const servicesCache = await refreshServicesCache();
  const databaseHash = servicesCache.hash;

  // ============= CHECK PRECOMPUTED CACHE FIRST =============
  // Popular queries have precomputed results for instant response (<10ms)
  const precomputed = await storage.getPrecomputedSearch(normalizedQuery);
  if (precomputed && precomputed.results.length > 0) {
    console.log(`[SearchOrchestrator] Precomputed HIT for: "${normalizedQuery}" (${precomputed.resultCount} results)`);
    // Filter out any deactivated services from precomputed cache
    let services = filterActiveServices((precomputed.results as LiteService[]).map(s => ({ ...s })), servicesCache.activeIds);

    // For crisis queries, replace results entirely with all crisis lines from DB
    const analysis = analyzeQuery(input.query, input.location);
    const isEmergency = input.emergency === true;
    if (analysis.isCrisis || isEmergency) {
      const dbCrisisLines = await storage.getCrisisLines();
      services = buildCrisisResults(dbCrisisLines, analysis.location.specified || input.location || null);
    }
    if (isPchadQuery(input.query)) {
      pinPchadService(services);
    }
    if (isFamilyAddictionQuery(input.query)) {
      pinAlAnonService(services);
    }
    if (isTenantLegalQuery(input.query)) {
      ensureLegalAidInResults(services);
    }

    // Location hard filter — exclude services from other cities
    services = filterByLocation(services, analysis.location.specified || input.location);

    if (input.filters) {
      services = applyHardFilters(services, input.filters);
      services = applyPreferenceBoosts(services, input.filters);
      services = applyFilterMatchBoosts(services, input.filters);
    }

    // Data quality boost applies regardless of filters
    const precomputedConfScores = await storage.getConfidenceScores(services.map(s => s.id));
    services = applyDataQualityBoost(services, precomputedConfScores);

    // Apply negative term penalty for exclusion queries (e.g., "shelter not religious")
    if (analysis.negativeTerms?.length) {
      services = applyNegativePenalty(services, analysis.negativeTerms);
    }

    return formatResponse(services, '', input, startTime, true);
  }

  // Load alias map for query analysis
  const aliasMap = await storage.getAliasLookup();

  // Analyze the query
  const analysis = analyzeQuery(input.query, input.location, aliasMap);
  const intentLog = analysis.intents.secondary
    ? `${analysis.intent}(${analysis.intents.primary.confidence}), secondary: ${analysis.intents.secondary.intent}(${analysis.intents.secondary.confidence})`
    : `${analysis.intent}(${analysis.intents.primary.confidence})`;
  console.log(`[SearchOrchestrator] Query: "${input.query}", Intent: ${intentLog}, Location: ${analysis.location.specified || 'none'}`);

  // Check regular cache - include version, substance type, and secondary intent in key
  const substanceKey = analysis.substanceType ? `:sub:${analysis.substanceType}` : '';
  const secondaryKey = analysis.intents.secondary ? `:sec:${analysis.intents.secondary.intent}` : '';
  const cacheKey = `${CACHE_VERSION}:${buildCacheKey(analysis, 'comprehensive', databaseHash)}${substanceKey}${secondaryKey}`;
  const cached = await storage.getSearchByQuery(cacheKey);
  if (cached) {
    console.log(`[SearchOrchestrator] Cache HIT for: ${cacheKey.substring(0, 60)}...`);
    const cachedResults = cached.results as { services: LiteService[]; summary: string };
    // Filter out any deactivated services from cached results
    let services = filterActiveServices(cachedResults.services.map(s => ({ ...s })), servicesCache.activeIds);

    // For crisis queries, replace results entirely with all crisis lines from DB
    if (analysis.isCrisis || input.emergency) {
      const dbCrisisLines = await storage.getCrisisLines();
      services = buildCrisisResults(dbCrisisLines, analysis.location.specified || input.location || null);
    }
    if (isPchadQuery(input.query)) {
      pinPchadService(services);
    }
    if (isFamilyAddictionQuery(input.query)) {
      pinAlAnonService(services);
    }
    if (isTenantLegalQuery(input.query)) {
      ensureLegalAidInResults(services);
    }

    // Location hard filter — exclude services from other cities
    services = filterByLocation(services, analysis.location.specified || input.location);

    if (input.filters) {
      services = applyHardFilters(services, input.filters);
      services = applyPreferenceBoosts(services, input.filters);
      services = applyFilterMatchBoosts(services, input.filters);
    }

    // Data quality boost applies regardless of filters
    const cachedConfScores = await storage.getConfidenceScores(services.map(s => s.id));
    services = applyDataQualityBoost(services, cachedConfScores);

    // Apply negative term penalty for exclusion queries (e.g., "shelter not religious")
    if (analysis.negativeTerms?.length) {
      services = applyNegativePenalty(services, analysis.negativeTerms);
    }

    return formatResponse(services, cachedResults.summary, input, startTime, true);
  }
  console.log(`[SearchOrchestrator] Cache MISS - executing fresh search`);

  // Execute search with timeout protection
  const result = await withTimeout(
    searchStrategy.search(analysis, input),
    TIMEOUTS.SEARCH_TOTAL,
    'Search operation'
  );

  // ============= LOG FAILED QUERIES =============
  // Track zero-result queries for analysis and coverage improvement
  if (result.services.length === 0) {
    storage.logFailedQuery({
      query: input.query,
      queryNormalized: analysis.normalized,
      intent: analysis.intent,
      location: input.location,
    }).catch(() => {}); // Fire and forget, don't block response
    console.log(`[SearchOrchestrator] Zero results - logged as failed query`);
  }

  // Cache the UNFILTERED search results so future queries with different filters
  // still have the full result set to filter from.
  // Don't cache zero-result searches — they may be transient failures.
  // Cache BEFORE crisis/pinned replacement — cached path rebuilds these anyway.
  if (result.services.length > 0) {
    await storage.createSearch({
      query: cacheKey,
      results: { services: result.services, summary: result.summary },
    });
  }

  // Filter out deactivated services from fresh results (materialized view may be stale)
  result.services = filterActiveServices(result.services, servicesCache.activeIds);

  // For crisis queries, replace results entirely with all crisis lines from DB.
  // MUST run AFTER filterActiveServices — 988 is a synthetic service not in the DB,
  // so filterActiveServices would remove it if crisis replacement ran first.
  if (analysis.isCrisis || input.emergency) {
    const dbCrisisLines = await storage.getCrisisLines();
    result.services = buildCrisisResults(dbCrisisLines, analysis.location.specified || input.location || null);
    console.log(`[SearchOrchestrator] Crisis query - replaced with all crisis lines from DB`);
  }

  // Apply PCHAD pinning for parent/child addiction queries
  if (isPchadQuery(input.query)) {
    pinPchadService(result.services);
    console.log(`[SearchOrchestrator] PCHAD query - Protection of Children Abusing Drugs pinned to top`);
  }

  // Apply Al-Anon pinning for family addiction support queries
  if (isFamilyAddictionQuery(input.query)) {
    pinAlAnonService(result.services);
    console.log(`[SearchOrchestrator] Family addiction query - Al-Anon pinned to top`);
  }

  // Ensure legal aid is included for tenant/eviction legal queries
  if (isTenantLegalQuery(input.query)) {
    ensureLegalAidInResults(result.services);
    console.log(`[SearchOrchestrator] Tenant legal query - Legal aid service ensured in results`);
  }

  // Location hard filter — exclude services from other cities
  result.services = filterByLocation(result.services, analysis.location.specified || input.location);

  // Apply hard UI filters AFTER caching — filters are re-applied on cache hits too
  if (input.filters) {
    const beforeFilter = result.services.length;
    result.services = applyHardFilters(result.services, input.filters);
    result.services = applyPreferenceBoosts(result.services, input.filters);
    result.services = applyFilterMatchBoosts(result.services, input.filters);
    if (result.services.length < beforeFilter) {
      console.log(`[SearchOrchestrator] Hard filters applied: ${beforeFilter} → ${result.services.length} services`);
    }
  }

  // Data quality boost applies regardless of filters
  const freshConfScores = await storage.getConfidenceScores(result.services.map(s => s.id));
  result.services = applyDataQualityBoost(result.services, freshConfScores);

  return formatResponse(result.services, result.summary, input, startTime, false, result.searchType, result.servicesWithDebug);
}

/**
 * Format the final response with pagination
 */
function formatResponse(
  services: LiteService[],
  summary: string,
  input: SearchInput,
  startTime: number,
  cached: boolean,
  searchType?: SearchType,
  servicesWithDebug?: LiteServiceWithDebug[]
): SearchResponse {
  const totalResults = services.length;
  const totalPages = Math.ceil(totalResults / input.pageSize);
  const startIndex = (input.page - 1) * input.pageSize;
  const paginatedServices = services.slice(startIndex, startIndex + input.pageSize);

  // When debug mode is enabled, return services with score explanations
  const isDebugEnabled = process.env.ENABLE_DEBUG_SEARCH === 'true' && input.debug;
  const responseServices = isDebugEnabled && servicesWithDebug
    ? servicesWithDebug.slice(startIndex, startIndex + input.pageSize)
    : paginatedServices;

  return {
    services: responseServices,
    summary,
    pagination: {
      page: input.page,
      pageSize: input.pageSize,
      totalResults,
      totalPages,
      hasNextPage: input.page < totalPages,
      hasPreviousPage: input.page > 1,
    },
    searchTimeMs: Date.now() - startTime,
    cached,
    searchType,
  };
}

// ServiceDetail type re-exported from @shared/routes (Zod schema is the source of truth)
export type { ServiceDetail };

/**
 * Get full service details by ID (for expanded view)
 */
export async function getServiceDetails(serviceId: string): Promise<ServiceDetail | null> {
  // Handle 988 crisis service specially
  if (isCrisisServiceId(serviceId)) {
    return getCrisisServiceFull();
  }

  // Handle PCHAD service specially
  if (isPchadServiceId(serviceId)) {
    return getPchadServiceFull();
  }

  const { service, enrichment } = await storage.getServiceById(serviceId);

  if (!service) {
    return null;
  }

  // Helper to parse JSON array fields, normalizing objects to strings
  const parseArrayField = (value: unknown): string[] => {
    let arr: unknown[] | null = null;
    if (Array.isArray(value) && value.length > 0) {
      arr = value;
    } else if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) arr = parsed;
      } catch { /* ignore */ }
    }
    if (!arr) return [];

    // Normalize each element: objects like {action, details} become strings
    return arr
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          // Process step objects: {step, action, details}
          const action = obj.action || obj.name || obj.title || '';
          const details = obj.details || obj.description || '';
          if (action && details) return `${action} — ${details}`;
          if (action) return String(action);
          if (details) return String(details);
          // Last resort: join all string values
          const vals = Object.values(obj).filter(v => typeof v === 'string' && v.trim());
          if (vals.length > 0) return vals.join(' — ');
        }
        return '';
      })
      .filter((s) => s.length > 0);
  };

  // "Fill gaps only" logic: service data wins, AI only fills empty fields
  // This ensures existing data is NEVER overwritten by AI enrichment

  // Process steps: service data wins
  const serviceSteps = parseArrayField(service.processSteps);
  const enrichmentSteps = parseArrayField(enrichment?.aiProcessSteps);
  const processSteps = serviceSteps.length > 0 ? serviceSteps : enrichmentSteps;

  // Required docs: service data wins
  const serviceDocs = parseArrayField(service.requiredDocs);
  const enrichmentDocs = parseArrayField(enrichment?.aiRequiredDocs);
  const requiredDocs = serviceDocs.length > 0 ? serviceDocs : enrichmentDocs;

  // Location: prefer address > location > AI location
  const displayLocation = service.address || service.location || enrichment?.aiLocation || '';

  // Description: service data wins (original full text over AI summary)
  const originalDesc = service.description || '';
  const aiDesc = enrichment?.aiDescription || '';
  const description = originalDesc.length > 0 ? originalDesc : aiDesc;

  // Category: service data wins
  const category = service.category?.trim()
    ? service.category
    : (enrichment?.aiCategory || service.category);

  // Eligibility: service data wins
  const eligibility = service.eligibility?.trim()
    ? service.eligibility
    : (enrichment?.aiEligibility || service.eligibility || '');

  // Wait times: service data wins
  const waitTimes = service.waitTimes?.trim()
    ? service.waitTimes
    : (enrichment?.aiWaitTimes || service.waitTimes || '');

  // Contact: service data wins (phone or contact field)
  const contact = (service.contact?.trim() || service.phone?.trim())
    ? (service.contact || '')
    : (enrichment?.aiContact || service.contact || '');

  return {
    id: service.serviceId,
    name: service.name,
    category,
    description,
    location: displayLocation,
    contact,
    websiteUrl: service.websiteUrl || '',
    eligibility,
    process: processSteps,
    waitTimes,
    requiredDocs: requiredDocs,
    phone: service.phone || '',
    email: service.email || '',
    address: displayLocation,
    hoursOfOperation: service.hoursOfOperation || undefined,
  };
}

// Export types and utilities
export { SEARCH_CONFIG } from './config';
export { analyzeQuery } from './analyzer';
export { pinCrisisService, isCrisisQuery } from './crisis';
export { pinPchadService, isPchadQuery } from './pchad';
export { pinAlAnonService, isFamilyAddictionQuery, ensureLegalAidInResults, isTenantLegalQuery } from './pinned';
export type { SearchInput, SearchResponse, LiteService } from './types';
