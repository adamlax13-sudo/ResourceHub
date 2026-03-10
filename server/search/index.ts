/**
 * Search Orchestrator
 *
 * Main entry point for all search operations.
 * Coordinates query analysis, strategy selection, and response formatting.
 */

// Cache version - increment this to invalidate all cached search results
// when making changes that affect search behavior
const CACHE_VERSION = 'v107'; // Bumped: tag quality fixes + multi-category filter

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
import { enhanceIntentWithLLM } from './llm-intent';
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
import type { QueryIntent } from './config';
import { applyNegativePenalty } from './strategies/scoring/penalty';
import { applyClickAffinityBoost } from './strategies/scoring/click-affinity-boost';
import { attachDistances, sortByDistance, filterByMaxDistance } from './distance';

// Single search strategy - comprehensive mode only
const searchStrategy = new ComprehensiveSearchStrategy();

/**
 * Attach coordinates to services (always — needed for map view).
 * When user coordinates are provided, also compute distances and optionally sort/filter.
 */
async function applyDistanceProcessing(
  services: LiteService[],
  input: SearchInput,
): Promise<LiteService[]> {
  // Always fetch coordinates so the map view can render pins
  const coords = await storage.getServiceCoordinates(services.map(s => s.id));

  let result: LiteService[] = services.map(s => {
    const c = coords.get(s.id);
    return { ...s, latitude: c?.lat ?? null, longitude: c?.lng ?? null };
  });

  // Compute distances only when user location is provided
  if (input.userLat != null && input.userLng != null) {
    result = attachDistances(result, input.userLat, input.userLng);

    if (input.maxDistanceKm != null) {
      result = filterByMaxDistance(result, input.maxDistanceKm);
    }

    if (input.sortByDistance) {
      result = sortByDistance(result);
    }
  }

  return result;
}

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
    // SAFETY: skip location filter for crisis queries so 988 and hotlines always show
    const isCrisisPrecomputed = analysis.isCrisis || isEmergency;
    services = filterByLocation(services, analysis.location.specified || input.location, isCrisisPrecomputed);

    if (input.filters && !isCrisisPrecomputed) {
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

    // Click-through affinity boost — also on precomputed path
    services = await applyClickAffinityBoost(services, normalizedQuery);

    // Distance processing — attach distances, filter, sort
    services = await applyDistanceProcessing(services, input);

    return formatResponse(services, '', input, startTime, true, undefined, undefined, analysis.intent);
  }

  // Load alias map for query analysis
  const aliasMap = await storage.getAliasLookup();

  // Analyze the query (regex-based, then enhance with LLM)
  let analysis = analyzeQuery(input.query, input.location, aliasMap);
  analysis = await enhanceIntentWithLLM(analysis);

  // SAFETY: If LLM escalated to crisis, ensure isCrisis flag is synced
  // (applyLLMIntents sets it, but this is a belt-and-suspenders guard)
  if (analysis.intent === 'crisis' && !analysis.isCrisis) {
    analysis = { ...analysis, isCrisis: true };
    console.log(`[SearchOrchestrator] SAFETY: Synced isCrisis=true after LLM crisis escalation`);
  }

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
    // SAFETY: skip location filter for crisis queries so 988 and hotlines always show
    const isCrisisCached = analysis.isCrisis || !!input.emergency;
    services = filterByLocation(services, analysis.location.specified || input.location, isCrisisCached);

    if (input.filters && !isCrisisCached) {
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

    // Click-through affinity boost — also on cached path
    // Use normalizedQuery (raw input) to match how clicks are stored in search_analytics
    services = await applyClickAffinityBoost(services, normalizedQuery);

    // Distance processing — attach distances, filter, sort
    services = await applyDistanceProcessing(services, input);

    return formatResponse(services, cachedResults.summary, input, startTime, true, undefined, undefined, analysis.intent);
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
  // SAFETY: skip location filter for crisis queries so 988 and hotlines always show
  const isCrisisFresh = analysis.isCrisis || !!input.emergency;
  result.services = filterByLocation(result.services, analysis.location.specified || input.location, isCrisisFresh);

  // Apply hard UI filters AFTER caching — filters are re-applied on cache hits too
  // SAFETY: skip hard filters for crisis queries — never filter out crisis hotlines
  if (input.filters && !isCrisisFresh) {
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

  // Click-through affinity boost — learn from user behavior over time
  // Use normalizedQuery (raw input) to match how clicks are stored in search_analytics
  result.services = await applyClickAffinityBoost(result.services, normalizedQuery);

  // Distance processing — attach distances, filter, sort
  result.services = await applyDistanceProcessing(result.services, input);

  return formatResponse(result.services, result.summary, input, startTime, false, result.searchType, result.servicesWithDebug, analysis.intent);
}

/**
 * Trim results to the number of truly relevant services.
 * Uses a relative score threshold: services scoring below 25% of the top score
 * are considered irrelevant tail results. Pinned services (no rrfScore) are
 * always preserved. Result count is clamped to [MIN_RESULTS, MAX_RESULTS]
 * with DEFAULT_RESULTS as the cap when scores are unavailable.
 */
const RELEVANCE_THRESHOLD = 0.20; // 20% of top score
const MIN_RESULTS = 13;
const MAX_RESULTS = 50;
const DEFAULT_RESULTS = 30;

// Map intents to DB category names for category-aware rescue during trimming.
// Uses exact category name matching (not the description-oriented patterns from
// INTENT_SERVICE_MAP, which miss categories like "Residential Treatment").
const INTENT_CATEGORY_NAMES: Partial<Record<QueryIntent, Set<string>>> = {
  substance_abuse: new Set(['Addiction Treatment', 'Detox & Withdrawal', 'Harm Reduction', 'Residential Treatment', 'Recovery & Peer Support']),
  mental_health: new Set(['Mental Health & Counselling', 'Crisis Services', 'Crisis Lines']),
  domestic_violence: new Set(['Domestic Violence Support', 'Human Trafficking Support']),
  food_insecurity: new Set(['Food Banks & Meals']),
  housing_urgent: new Set(['Emergency Shelter', 'Affordable Housing', 'Supportive Housing', 'Transitional Housing']),
  disability_support: new Set(['Disability & Autism Support']),
  grief_support: new Set(['Grief & Bereavement']),
  senior_services: new Set(['Senior Services']),
  legal_aid: new Set(['Legal Aid', 'Criminal Justice Reintegration']),
  employment_support: new Set(['Employment Services']),
  youth_services: new Set(['Youth Services']),
  newcomer_services: new Set(['Newcomer & Settlement']),
  lgbtq_services: new Set(['LGBTQ2S+ Services']),
  indigenous_services: new Set(['Indigenous Services']),
  veteran_services: new Set(['Veterans Services']),
  healthcare_access: new Set(['Healthcare Access', 'Sexual Health Services']),
  student_services: new Set(['Campus & Student Services']),
  parenting_support: new Set(['Family & Parenting Support']),
  crisis: new Set(['Crisis Services', 'Crisis Lines']),
  financial_support: new Set(['Financial Counselling & Debt Help']),
};

function trimToRelevant(services: LiteService[], intent?: QueryIntent): LiteService[] {
  if (services.length <= MIN_RESULTS) return services;

  // Separate pinned services (no rrfScore) — always included
  const pinned = services.filter(s => s.rrfScore == null);
  const scored = services.filter(s => s.rrfScore != null);

  if (scored.length === 0) {
    // No scores available — likely legacy cached data or all crisis results.
    // If few services, they're probably crisis results — return as-is.
    // Otherwise cap at DEFAULT_RESULTS to avoid showing an irrelevant tail.
    if (services.length <= DEFAULT_RESULTS) {
      return services;
    }
    console.log(`[SearchOrchestrator] Relevance trim: ${services.length} → ${DEFAULT_RESULTS} (no scores, applying default cap)`);
    return services.slice(0, DEFAULT_RESULTS);
  }

  const topScore = Math.max(...scored.map(s => s.rrfScore!));
  if (topScore <= 0) return services.slice(0, DEFAULT_RESULTS);

  const cutoff = topScore * RELEVANCE_THRESHOLD;
  const relevantScored = scored.filter(s => s.rrfScore! >= cutoff);

  // Clamp the count of scored results to [MIN_RESULTS - pinned, MAX_RESULTS - pinned]
  const pinnedCount = pinned.length;
  const minScored = Math.max(0, MIN_RESULTS - pinnedCount);
  const maxScored = Math.max(0, MAX_RESULTS - pinnedCount);
  const cappedCount = Math.max(minScored, Math.min(relevantScored.length, maxScored));

  // Take the top cappedCount scored results (they're already sorted by score/distance)
  const trimmedScored = scored.slice(0, cappedCount);
  const keptIds = new Set(trimmedScored.map(s => s.id));

  // Category-aware preservation: rescue services whose category matches the
  // query intent but fell below the score cutoff. These are core results that
  // the user is looking for — generic services shouldn't crowd them out.
  let rescued: LiteService[] = [];
  const categorySet = intent ? INTENT_CATEGORY_NAMES[intent] : undefined;
  if (categorySet) {
    rescued = scored.filter(s =>
      !keptIds.has(s.id) && s.category && categorySet.has(s.category)
    );
    // Cap total results (kept + rescued) at MAX_RESULTS
    const rescueSlots = Math.max(0, MAX_RESULTS - pinnedCount - trimmedScored.length);
    if (rescued.length > rescueSlots) rescued = rescued.slice(0, rescueSlots);
  }

  const combined = [...pinned, ...trimmedScored, ...rescued];

  const rescueLog = rescued.length > 0 ? `, ${rescued.length} rescued by category` : '';
  console.log(`[SearchOrchestrator] Relevance trim: ${services.length} → ${combined.length} (${pinned.length} pinned, ${relevantScored.length} relevant of ${scored.length} scored, cutoff=${cutoff.toFixed(4)}${rescueLog})`);

  return combined;
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
  servicesWithDebug?: LiteServiceWithDebug[],
  intent?: QueryIntent
): SearchResponse {
  // Trim to relevant results before pagination
  services = trimToRelevant(services, intent);
  if (servicesWithDebug) {
    // Keep debug array in sync — trim to same IDs
    const keptIds = new Set(services.map(s => s.id));
    servicesWithDebug = servicesWithDebug.filter(s => keptIds.has(s.id));
  }

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
