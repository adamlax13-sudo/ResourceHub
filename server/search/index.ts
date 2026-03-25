/**
 * Search Orchestrator
 *
 * Main entry point for all search operations.
 * Coordinates query analysis, strategy selection, and response formatting.
 */

// Cache version - increment this to invalidate all cached search results
// when making changes that affect search behavior
const CACHE_VERSION = 'v167';

import { SEARCH_CONFIG } from './config';
import type {
  SearchInput,
  SearchResponse,
  SearchResult,
  LiteService,
  LiteServiceWithDebug,
  SearchType,
  QueryAnalysis,
  QueryUnderstanding,
} from './types';
import { understandQuery } from './understand';
import { withTimeout, TIMEOUTS } from '../helpers/timeout';
import { ComprehensiveSearchStrategy } from './strategies/comprehensive';
import { pinCrisisService, buildCrisisResults, getCrisisServiceFull, isCrisisServiceId } from './crisis';
import { isPchadQuery, pinPchadService, getPchadServiceFull, isPchadServiceId } from './pchad';
import {
  isFamilyAddictionQuery,
  isTenantLegalQuery,
  isCustodyLegalQuery,
  pinAlAnonService,
  ensureLegalAidInResults,
} from './pinned';
import { storage } from '../storage';
import { createHash } from 'crypto';
import type { Service } from '@shared/schema';
import type { ServiceDetail, SearchFilters } from '@shared/routes';
import { applyPreferenceBoosts } from './strategies/scoring/preference-boost';
import { applyFilterMatchBoosts } from './strategies/scoring/filter-match-boost';
import { applyDataQualityBoost } from './strategies/scoring/quality-boost';
import { applyHardFilters, filterByLocation } from './filters';
import { isIndigenousService, isIndigenousServiceWithTags, isIndigenousIntent } from './indigenous';
import type { LocationFilterOpts } from './filters';
import type { QueryIntent } from './config';
import { applyNegativePenalty } from './strategies/scoring/penalty';
import { applySubIntentBoost, SUB_INTENT_CATEGORY_OVERRIDE } from './strategies/scoring/sub-intent-boost';
import { attachDistances, sortByDistance, filterByMaxDistance } from './distance';

// Single search strategy - comprehensive mode only
const searchStrategy = new ComprehensiveSearchStrategy();

/**
 * Lightweight per-stage timing tracker.
 * Logged as structured JSON at the end of each search for observability.
 */
interface SearchTimings {
  analysis_ms: number;
  cache_lookup_ms: number;
  search_ms: number;
  scoring_ms: number;
  distance_ms: number;
  total_ms: number;
}

function logTimings(query: string, tier: string, timings: SearchTimings) {
  console.log(`[SearchPerf] ${JSON.stringify({ query: query.substring(0, 50), tier, stages: timings })}`);
}

/**
 * In-memory cache hit/miss counters, logged periodically.
 * Exported for the admin search-quality endpoint.
 */
export const cacheStats = {
  hits: 0,
  misses: 0,
  recentMisses: [] as string[], // last 20 cache-miss queries (candidates for precomputation)
  lastReset: Date.now(),
};

const DEBUG_SEARCH = process.env.DEBUG_SEARCH === 'true';

/**
 * Log the impact of a scoring module when DEBUG_SEARCH is enabled.
 * Compares scores before/after to show how many services were affected and by how much.
 */
function logScoringImpact(module: string, before: LiteService[], after: LiteService[]) {
  if (!DEBUG_SEARCH) return;
  let affected = 0;
  let totalBoost = 0;
  for (let i = 0; i < before.length && i < after.length; i++) {
    const bScore = before[i].rrfScore ?? 0;
    const aScore = after[i].rrfScore ?? 0;
    if (bScore !== aScore && bScore > 0) {
      affected++;
      totalBoost += aScore / bScore;
    }
  }
  const avgBoost = affected > 0 ? (totalBoost / affected).toFixed(3) : 'n/a';
  console.log(`[ScoringDebug] ${JSON.stringify({ module, services_affected: affected, avg_boost: avgBoost })}`);
}

function trackCacheHit(hit: boolean, query: string) {
  if (hit) {
    cacheStats.hits++;
  } else {
    cacheStats.misses++;
    cacheStats.recentMisses.push(query);
    if (cacheStats.recentMisses.length > 20) cacheStats.recentMisses.shift();
  }

  // Log summary every 100 searches
  const total = cacheStats.hits + cacheStats.misses;
  if (total > 0 && total % 100 === 0) {
    const rate = ((cacheStats.hits / total) * 100).toFixed(1);
    console.log(`[CacheStats] ${cacheStats.hits}/${total} hits (${rate}%) since ${new Date(cacheStats.lastReset).toISOString()}`);
  }
}

/**
 * Attach pre-fetched coordinates to services and compute distances.
 * Coordinates are fetched in parallel with confidence scores before this call.
 */
function applyDistanceWithCoords(
  services: LiteService[],
  input: SearchInput,
  coords: Map<string, { lat: number; lng: number }>,
): LiteService[] {
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

/**
 * Supplement filtered results with DB services when category filters are active.
 *
 * The search cache stores top results ranked by query relevance. When a user
 * selects a category filter (e.g., "Emergency Shelter"), the cache may contain
 * very few services from that category — even though many exist in the DB.
 *
 * This function fetches services from the DB matching the selected categories,
 * applies location + remaining hard filters, and merges them into results.
 * Supplements get no rrfScore so they sort after search-ranked results.
 */
const SUPPLEMENT_THRESHOLD = 15; // Only supplement if fewer than this many results after filtering

async function supplementCategories(
  services: LiteService[],
  filters: SearchFilters,
  location: string | null | undefined,
  locationOpts?: LocationFilterOpts,
): Promise<LiteService[]> {
  if (!filters.categories?.length) return services;
  if (services.length >= SUPPLEMENT_THRESHOLD) return services;

  const existingIds = new Set(services.map(s => s.id));

  // Fetch ALL active services in the selected categories from DB
  const dbServices = await storage.getServicesByCategories(filters.categories);

  // Convert Service → LiteService (minimal fields needed for display)
  let supplements: LiteService[] = dbServices.map(s => ({
    id: s.serviceId,
    name: s.name,
    category: s.category,
    description: (s.description || '').slice(0, 300),
    location: s.address || s.location || '',
    waitTimes: s.waitTimes || '',
    phone: s.phone || undefined,
    genderRestriction: s.genderRestriction ?? null,
    ageGroup: s.ageGroup ?? null,
    isFaithBased: s.isFaithBased ?? null,
    is12Step: s.is12Step ?? null,
    serviceFormat: s.serviceFormat ?? null,
    languagesSupported: (s.languagesSupported as string[] | null) ?? null,
    // No rrfScore — supplements sort after search-ranked results
  }));

  // Apply location filter to supplements
  supplements = filterByLocation(supplements, location, locationOpts);

  // Apply non-category hard filters (gender, age, etc.)
  const { categories: _cats, ...otherFilters } = filters;
  const hasOtherFilters = Object.values(otherFilters).some(v => v !== undefined);
  if (hasOtherFilters) {
    supplements = applyHardFilters(supplements, otherFilters as SearchFilters);
  }

  // Remove duplicates (already in search results)
  const newServices = supplements.filter(s => !existingIds.has(s.id));
  if (newServices.length === 0) return services;

  console.log(`[SearchOrchestrator] Category supplement: +${newServices.length} services from DB (${filters.categories.join(', ')})`);
  return [...services, ...newServices];
}

/**
 * Supplementary query to recover indigenous services killed by SQL location penalty.
 * Re-runs fastSearch without location filter, keeps only indigenous matches,
 * deduplicates against existing results.
 *
 * Only runs when indigenous intent is detected AND a location filter is active.
 */
async function supplementIndigenousServices(
  services: LiteService[],
  query: string,
  location: string | null | undefined,
  analysis: QueryAnalysis,
): Promise<LiteService[]> {
  if (!isIndigenousIntent(analysis.intent, analysis.intents.secondary)) return services;
  if (!location) return services;

  const existingIds = new Set(services.map(s => s.id));

  try {
    const unfiltered = await storage.fastSearch(query, null, false, 50);

    const indigenous = unfiltered
      .filter(r => !existingIds.has(r.serviceId) && isIndigenousServiceWithTags(r))
      .map(r => ({
        id: r.serviceId,
        name: r.name,
        category: r.category,
        description: (r.description || '').slice(0, 300),
        location: r.address || r.location || '',
        waitTimes: r.waitTimes || '',
        phone: r.phone || undefined,
        is24_7: r.is24_7 ?? undefined,
        genderRestriction: r.genderRestriction ?? null,
        ageGroup: r.ageGroup ?? null,
        isFaithBased: r.isFaithBased ?? null,
        is12Step: r.is12Step ?? null,
        serviceFormat: r.serviceFormat ?? null,
        languagesSupported: r.languagesSupported ?? null,
        rrfScore: r.relevanceScore / 200,
      } as LiteService));

    if (indigenous.length > 0) {
      console.log(`[SearchOrchestrator] Indigenous supplement: +${indigenous.length} services recovered from location penalty`);
    }
    return [...services, ...indigenous];
  } catch (err) {
    console.warn('[SearchOrchestrator] Indigenous supplement failed:', err);
    return services;
  }
}

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
 * Trigram similarity between two strings (Jaccard coefficient on character trigrams).
 */
function trigramSimilarity(a: string, b: string): number {
  const buildTrigrams = (s: string): Set<string> => {
    const t = new Set<string>();
    const lower = s.toLowerCase();
    for (let i = 0; i <= lower.length - 3; i++) t.add(lower.slice(i, i + 3));
    return t;
  };
  const ta = buildTrigrams(a);
  const tb = buildTrigrams(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  Array.from(ta).forEach(t => { if (tb.has(t)) intersection++; });
  const union = ta.size + tb.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * When the top result strongly matches the query by name, fetch sibling services
 * from the same organization and insert them near the top.
 * e.g., searching "CMHA" shows CMHA — Counselling, CMHA — Peer Support, etc.
 */
async function insertOrgSiblings(services: LiteService[], query: string): Promise<LiteService[]> {
  if (services.length < 2) return services;

  const top = services[0];
  if (!top.rrfScore || !top.name) return services;

  // Check trigram similarity between query and top result name
  // Threshold 0.5 = strong name match only (e.g., "CMHA" matching "CMHA — Programs")
  const similarity = trigramSimilarity(query, top.name);
  if (similarity < 0.5) return services;

  // Check if top result is significantly ahead of #2 (strong match signal)
  const second = services[1];
  const secondScore = second.rrfScore ?? 0;
  if (top.rrfScore < secondScore * 1.3) return services;

  // Extract org name: split on " — " delimiter
  const delimiter = ' — ';
  const delimIdx = top.name.indexOf(delimiter);
  if (delimIdx < 0) return services;

  const orgName = top.name.slice(0, delimIdx).trim();
  if (orgName.length < 3) return services;

  try {
    const siblings = await storage.getServicesByOrg(orgName);
    if (siblings.length <= 1) return services;

    // Build sibling LiteService entries
    const existingIds = new Set(services.map(s => s.id));
    const siblingLite: LiteService[] = siblings
      .filter(s => !existingIds.has(s.serviceId) && s.serviceId !== top.id)
      .map(s => ({
        id: s.serviceId,
        name: s.name,
        category: s.category || '',
        description: (s.description || '').slice(0, 300),
        location: s.address || s.location || '',
        waitTimes: s.waitTimes || '',
        phone: s.phone || undefined,
        genderRestriction: s.genderRestriction ?? null,
        ageGroup: s.ageGroup ?? null,
        isFaithBased: s.isFaithBased ?? null,
        is12Step: s.is12Step ?? null,
        serviceFormat: s.serviceFormat ?? null,
        languagesSupported: (s.languagesSupported as string[] | null) ?? null,
        // Score slightly below top match so they rank right after it
        rrfScore: (top.rrfScore ?? 50) * 0.9,
      }));

    if (siblingLite.length === 0) return services;

    // Insert: top match first, then siblings, then rest of results
    const rest = services.slice(1);
    console.log(`[SearchOrchestrator] Org siblings: "${orgName}" → +${siblingLite.length} services`);
    return [top, ...siblingLite, ...rest];
  } catch (err) {
    console.warn('[SearchOrchestrator] Sibling fetch failed:', err instanceof Error ? err.message : err);
    return services;
  }
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
 * Build a lightweight query understanding summary for the frontend.
 */
function buildQueryUnderstanding(analysis: QueryAnalysis): QueryUnderstanding {
  const understanding: QueryUnderstanding = {};

  // Human-readable intent name
  const intentLabel = analysis.intent.replace(/_/g, ' ');
  if (intentLabel !== 'general') {
    understanding.intent = intentLabel;
  }

  // Pass through structured attributes
  if (analysis.attributes) {
    const attrs: QueryUnderstanding['attributes'] = {};
    if (analysis.attributes.demographic) attrs.demographic = analysis.attributes.demographic;
    if (analysis.attributes.serviceFormat?.length) attrs.serviceFormat = analysis.attributes.serviceFormat;
    if (analysis.attributes.serviceType) attrs.serviceType = analysis.attributes.serviceType;
    if (analysis.attributes.urgency) attrs.urgency = analysis.attributes.urgency;
    if (Object.keys(attrs).length > 0) understanding.attributes = attrs;
  }

  // Location
  if (analysis.location.specified) {
    understanding.location = analysis.location.specified;
  }

  return understanding;
}

/**
 * Derive implicit hard filters from LLM-extracted demographic attributes.
 * When the user types "mens addiction services", the LLM extracts demographic: "men"
 * but this was never converted to a genderRestriction filter — so women-only services leaked through.
 *
 * Only applies when the user hasn't already set the corresponding UI filter.
 */
function deriveImplicitFilters(attributes: import('./types').QueryAttributes | undefined, existingFilters?: SearchFilters): SearchFilters | undefined {
  if (!attributes?.demographic) return existingFilters;

  const demo = attributes.demographic.toLowerCase();
  const derived: SearchFilters = {};

  // Gender: map demographic to genderRestriction (only if UI filter not already set)
  if (!existingFilters?.genderRestriction || existingFilters.genderRestriction === 'all') {
    if (/\b(men|male|father|dad|husband|boy)\b/.test(demo) && !/\b(women|woman|female)\b/.test(demo)) {
      derived.genderRestriction = 'men_only';
    } else if (/\b(women|woman|female|mother|mom|girl)\b/.test(demo) && !/\b(men|male)\b/.test(demo)) {
      derived.genderRestriction = 'women_only';
    }
  }

  // Age: map demographic to ageGroup (only if UI filter not already set)
  if (!existingFilters?.ageGroup || existingFilters.ageGroup === 'all_ages') {
    if (/\b(youth|teen|adolescent|teenager|young|child|kid|juvenile|minor)\b/.test(demo)) {
      derived.ageGroup = 'youth';
    } else if (/\b(senior|elderly|older adult|aging|aged|retired|retiree)\b/.test(demo)) {
      derived.ageGroup = 'senior';
    }
  }

  if (Object.keys(derived).length === 0) return existingFilters;

  const merged = { ...existingFilters, ...derived };
  const derivedLabels = Object.entries(derived).map(([k, v]) => `${k}=${v}`).join(', ');
  console.log(`[SearchOrchestrator] Implicit filters from demographic "${attributes.demographic}": ${derivedLabels}`);
  return merged;
}

/**
 * Main search function - the single entry point for all search requests.
 */
export async function search(input: SearchInput): Promise<SearchResponse> {
  const startTime = Date.now();

  const timings: Partial<SearchTimings> = {};

  // Load active service IDs for filtering stale cache entries
  const servicesCache = await refreshServicesCache();
  const databaseHash = servicesCache.hash;

  // Load alias map for query analysis
  const aliasMap = await storage.getAliasLookup();

  // Analyze query + fire LLM enhancement in parallel + compute cache key
  const analysisStart = Date.now();
  const understanding = understandQuery(input.query, databaseHash, CACHE_VERSION, input.location, aliasMap);
  let analysis = understanding.base;
  const llmIntentPromise = understanding.enhanced;
  const cacheKey = understanding.cacheKey;
  timings.analysis_ms = Date.now() - analysisStart;

  const intentLog = analysis.intents.secondary
    ? `${analysis.intent}(${analysis.intents.primary.confidence}), secondary: ${analysis.intents.secondary.intent}(${analysis.intents.secondary.confidence})`
    : `${analysis.intent}(${analysis.intents.primary.confidence})`;
  console.log(`[SearchOrchestrator] Query: "${input.query}", Intent: ${intentLog}, Location: ${analysis.location.specified || 'none'}`);

  // Check regular cache — key uses only regex-derived fields (no LLM-dependent fields)
  const cacheStart = Date.now();
  const cached = await storage.getSearchByQuery(cacheKey);
  timings.cache_lookup_ms = Date.now() - cacheStart;
  if (cached) {
    // Cache hit — don't need LLM enhancement, but must drain the promise to avoid unhandled rejection
    llmIntentPromise.catch(() => {});
    console.log(`[SearchOrchestrator] Cache HIT for: ${cacheKey.substring(0, 60)}...`);
    const cachedResults = cached.results as { services: LiteService[]; summary: string };
    // Filter out any deactivated services from cached results
    let services = filterActiveServices(cachedResults.services.map(s => ({ ...s })), servicesCache.activeIds);

    // For crisis queries: direct crisis replaces results, situational crisis pins 988
    const isDirectCrisisCached = analysis.intent === 'crisis' || !!input.emergency;
    if (isDirectCrisisCached) {
      const dbCrisisLines = await storage.getCrisisLines();
      services = buildCrisisResults(dbCrisisLines, analysis.location.specified || input.location || null);
    } else if (analysis.isCrisis) {
      // Situational crisis (DV, homelessness): pin 988, keep search results
      pinCrisisService(services);
    }
    if (isPchadQuery(input.query)) {
      pinPchadService(services);
    }
    if (isFamilyAddictionQuery(input.query)) {
      pinAlAnonService(services);
    }
    if (isTenantLegalQuery(input.query) || isCustodyLegalQuery(input.query)) {
      ensureLegalAidInResults(services);
    }

    // Location hard filter — exclude services from other cities
    // SAFETY: skip location filter for direct crisis so 988 and hotlines always show
    const cachedLocationOpts: LocationFilterOpts = isDirectCrisisCached ? { skipAll: true } : {};
    if (isIndigenousIntent(analysis.intent, analysis.intents.secondary)) {
      cachedLocationOpts.skipForService = isIndigenousService;
    }
    services = filterByLocation(services, analysis.location.specified || input.location, cachedLocationOpts);

    // Recover indigenous services killed by SQL location penalty
    services = await supplementIndigenousServices(services, analysis.corrected, analysis.location.specified || input.location, analysis);

    // Merge implicit demographic filters from query text with explicit UI filters
    const scoringStart = Date.now();
    const cachedFilters = deriveImplicitFilters(analysis.attributes, input.filters) || input.filters;
    if (cachedFilters && !isDirectCrisisCached) {
      services = applyHardFilters(services, cachedFilters);
      services = await supplementCategories(services, cachedFilters, analysis.location.specified || input.location, cachedLocationOpts);
      services = applyPreferenceBoosts(services, cachedFilters);
      services = applyFilterMatchBoosts(services, cachedFilters);
    }

    // Fetch confidence scores + coordinates in parallel (independent DB queries)
    const serviceIds = services.map(s => s.id);
    const [cachedConfScores, cachedCoords] = await Promise.all([
      storage.getConfidenceScores(serviceIds),
      storage.getServiceCoordinates(serviceIds),
    ]);

    // Data quality boost applies regardless of filters
    const beforeQualityCached = DEBUG_SEARCH ? [...services] : services;
    services = applyDataQualityBoost(services, cachedConfScores);
    logScoringImpact('quality-boost', beforeQualityCached, services);

    // Apply negative term penalty for exclusion queries (e.g., "shelter not religious")
    if (analysis.negativeTerms?.length) {
      services = applyNegativePenalty(services, analysis.negativeTerms);
    }

    // Sub-intent scoring boost
    const beforeSubIntentCached = DEBUG_SEARCH ? [...services] : services;
    services = applySubIntentBoost(services, analysis.subIntents || []);
    logScoringImpact('sub-intent-boost', beforeSubIntentCached, services);
    timings.scoring_ms = Date.now() - scoringStart;

    // Distance processing — use pre-fetched coordinates
    const distStart = Date.now();
    services = applyDistanceWithCoords(services, input, cachedCoords);
    timings.distance_ms = Date.now() - distStart;

    timings.search_ms = 0; // cache hit — no search executed
    timings.total_ms = Date.now() - startTime;
    logTimings(input.query, 'cached', timings as SearchTimings);
    trackCacheHit(true, input.query);

    const cachedUnderstanding = buildQueryUnderstanding(analysis);
    return formatResponse(services, cachedResults.summary, input, startTime, true, undefined, undefined, analysis.intent, analysis.intents.secondary?.intent, analysis.subIntents, analysis.impliedNeeds, cachedUnderstanding);
  }
  console.log(`[SearchOrchestrator] Cache MISS - executing fresh search`);
  trackCacheHit(false, input.query);

  // Await LLM intent enhancement (already running in parallel since before cache check).
  // This enriches analysis with better intents, attributes, and semantic query for search.
  analysis = await llmIntentPromise;

  // SAFETY: If LLM escalated to crisis, ensure isCrisis flag is synced
  if (analysis.intent === 'crisis' && !analysis.isCrisis) {
    analysis = { ...analysis, isCrisis: true };
    console.log(`[SearchOrchestrator] SAFETY: Synced isCrisis=true after LLM crisis escalation`);
  }

  const attrLog = analysis.attributes
    ? `, Attrs: ${JSON.stringify(analysis.attributes)}`.slice(0, 120)
    : '';
  if (attrLog) {
    console.log(`[SearchOrchestrator] LLM enhanced: Intent: ${analysis.intent}${attrLog}`);
  }

  // Execute search with timeout protection
  const searchStart = Date.now();
  const result = await withTimeout(
    searchStrategy.search(analysis, input),
    TIMEOUTS.SEARCH_TOTAL,
    'Search operation'
  );
  timings.search_ms = Date.now() - searchStart;

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

  // Similar services: when top result strongly matches the query by name,
  // fetch sibling services from the same organization and insert them at top.
  result.services = await insertOrgSiblings(result.services, input.query);

  // For crisis queries: direct crisis replaces results, situational crisis pins 988.
  // MUST run AFTER filterActiveServices — 988 is a synthetic service not in the DB,
  // so filterActiveServices would remove it if crisis replacement ran first.
  const isDirectCrisisFresh = analysis.intent === 'crisis' || !!input.emergency;
  if (isDirectCrisisFresh) {
    const dbCrisisLines = await storage.getCrisisLines();
    result.services = buildCrisisResults(dbCrisisLines, analysis.location.specified || input.location || null);
    console.log(`[SearchOrchestrator] Direct crisis query - replaced with all crisis lines from DB`);
  } else if (analysis.isCrisis) {
    pinCrisisService(result.services);
    console.log(`[SearchOrchestrator] Situational crisis - pinned 988, keeping ${result.services.length} service results`);
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
  // SAFETY: skip location filter for direct crisis so 988 and hotlines always show
  const freshLocationOpts: LocationFilterOpts = isDirectCrisisFresh ? { skipAll: true } : {};
  if (isIndigenousIntent(analysis.intent, analysis.intents.secondary)) {
    freshLocationOpts.skipForService = isIndigenousService;
  }
  result.services = filterByLocation(result.services, analysis.location.specified || input.location, freshLocationOpts);

  // Recover indigenous services killed by SQL location penalty
  result.services = await supplementIndigenousServices(result.services, analysis.corrected, analysis.location.specified || input.location, analysis);

  // Apply hard filters AFTER caching — filters are re-applied on cache hits too
  // Merge implicit demographic filters from query text with explicit UI filters
  // SAFETY: skip hard filters for direct crisis — never filter out crisis hotlines
  const freshScoringStart = Date.now();
  const freshFilters = deriveImplicitFilters(analysis.attributes, input.filters) || input.filters;
  if (freshFilters && !isDirectCrisisFresh) {
    const beforeFilter = result.services.length;
    result.services = applyHardFilters(result.services, freshFilters);
    result.services = await supplementCategories(result.services, freshFilters, analysis.location.specified || input.location, freshLocationOpts);
    result.services = applyPreferenceBoosts(result.services, freshFilters);
    result.services = applyFilterMatchBoosts(result.services, freshFilters);
    if (result.services.length < beforeFilter) {
      console.log(`[SearchOrchestrator] Hard filters applied: ${beforeFilter} → ${result.services.length} services`);
    }
  }

  // Fetch confidence scores + coordinates in parallel (independent DB queries)
  const freshServiceIds = result.services.map(s => s.id);
  const [freshConfScores, freshCoords] = await Promise.all([
    storage.getConfidenceScores(freshServiceIds),
    storage.getServiceCoordinates(freshServiceIds),
  ]);

  // Data quality boost applies regardless of filters
  const beforeQuality = DEBUG_SEARCH ? [...result.services] : result.services;
  result.services = applyDataQualityBoost(result.services, freshConfScores);
  logScoringImpact('quality-boost', beforeQuality, result.services);

  // Sub-intent scoring boost
  const beforeSubIntent = DEBUG_SEARCH ? [...result.services] : result.services;
  result.services = applySubIntentBoost(result.services, analysis.subIntents || []);
  logScoringImpact('sub-intent-boost', beforeSubIntent, result.services);
  timings.scoring_ms = Date.now() - freshScoringStart;

  // Distance processing — use pre-fetched coordinates
  const freshDistStart = Date.now();
  result.services = applyDistanceWithCoords(result.services, input, freshCoords);
  timings.distance_ms = Date.now() - freshDistStart;

  timings.total_ms = Date.now() - startTime;
  logTimings(input.query, 'fresh', timings as SearchTimings);

  const freshUnderstanding = buildQueryUnderstanding(analysis);
  return formatResponse(result.services, result.summary, input, startTime, false, result.searchType, result.servicesWithDebug, analysis.intent, analysis.intents.secondary?.intent, analysis.subIntents, analysis.impliedNeeds, freshUnderstanding);
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
  substance_abuse: new Set(['Addiction Treatment', 'Detox & Withdrawal', 'Harm Reduction', 'Residential Treatment', 'Recovery & Peer Support', 'Gambling Support']),
  mental_health: new Set(['Mental Health & Counselling', 'Crisis Services', 'Crisis Lines', 'Eating Disorder Services', 'Trauma & PTSD Support']),
  domestic_violence: new Set(['Domestic Violence Support', 'Human Trafficking Support', 'Trauma & PTSD Support']),
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
  indigenous_services: new Set(['Indigenous Services', 'Trauma & PTSD Support']),
  veteran_services: new Set(['Veterans Services', 'Trauma & PTSD Support']),
  healthcare_access: new Set(['Healthcare Access', 'Sexual Health Services', 'Hospital & Emergency']),
  student_services: new Set(['Campus & Student Services']),
  parenting_support: new Set(['Family & Parenting Support']),
  crisis: new Set(['Crisis Services', 'Crisis Lines']),
  financial_support: new Set(['Financial Counselling & Debt Help']),
  community_social: new Set(['Community & Social Connection']),
  basic_needs: new Set(['Basic Needs & Material Aid', 'Food Banks & Meals', 'Transportation Assistance']),
  family_addiction_support: new Set(['Family & Parenting Support', 'Recovery & Peer Support']),
  caregiver_support: new Set(['Family & Parenting Support', 'Senior Services']),
  criminal_justice: new Set(['Criminal Justice Reintegration']),
};

// Map implied needs to categories for rescue
const NEED_CATEGORY_MAP: Record<string, string[]> = {
  'housing': ['Emergency Shelter', 'Affordable Housing', 'Transitional Housing', 'Supportive Housing'],
  'employment': ['Employment Services'],
  'reintegration': ['Criminal Justice Reintegration'],
  'criminal_justice': ['Criminal Justice Reintegration'],
  'family_support': ['Family & Parenting Support', 'Recovery & Peer Support'],
  'settlement': ['Newcomer & Settlement'],
  'language': ['Newcomer & Settlement'],
  'crisis_support': ['Crisis Services', 'Crisis Lines'],
  'safety_planning': ['Domestic Violence Support'],
  'life_skills': ['Community & Social Connection'],
  'pet_support': ['Basic Needs & Material Aid'],
  'financial_support': ['Financial Counselling & Debt Help'],
  'legal_aid': ['Legal Aid'],
  'healthcare_access': ['Healthcare Access'],
  'transportation': ['Transportation Assistance'],
  'food_insecurity': ['Food Banks & Meals'],
  'community_social': ['Community & Social Connection'],
  'mental_health': ['Mental Health & Counselling'],
};

function trimToRelevant(services: LiteService[], intent?: QueryIntent, secondaryIntent?: QueryIntent, subIntents?: string[], impliedNeeds?: string[]): LiteService[] {
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
  const aboveCutoff = scored.filter(s => s.rrfScore! >= cutoff);
  const belowCutoff = scored.filter(s => s.rrfScore! < cutoff);

  const pinnedCount = pinned.length;
  const maxScored = Math.max(0, MAX_RESULTS - pinnedCount);

  // Category-aware rescue: pull in on-category services that fell below the
  // score cutoff. These are core results the user is looking for.
  // Merge primary + secondary intent category sets so both are rescued.
  let rescued: LiteService[] = [];
  const primarySet = intent ? INTENT_CATEGORY_NAMES[intent] : undefined;
  const secondarySet = secondaryIntent ? INTENT_CATEGORY_NAMES[secondaryIntent] : undefined;
  let categorySet: Set<string> | undefined;
  if (primarySet && secondarySet) {
    categorySet = new Set<string>();
    primarySet.forEach(v => categorySet!.add(v));
    secondarySet.forEach(v => categorySet!.add(v));
  } else {
    categorySet = primarySet ?? secondarySet;
  }
  // Narrow category rescue when sub-intents provide overrides
  if (subIntents && subIntents.length > 0 && categorySet) {
    const overrideSets: Set<string>[] = [];
    for (const si of subIntents) {
      const override = SUB_INTENT_CATEGORY_OVERRIDE[si];
      if (override) overrideSets.push(override);
    }
    if (overrideSets.length > 0) {
      categorySet = new Set<string>();
      for (const os of overrideSets) {
        os.forEach(v => categorySet!.add(v));
      }
    }
  }
  // Expand rescue set with implied needs categories
  if (impliedNeeds && impliedNeeds.length > 0) {
    if (!categorySet) categorySet = new Set<string>();
    for (const need of impliedNeeds) {
      const cats = NEED_CATEGORY_MAP[need];
      if (cats) cats.forEach(c => categorySet!.add(c));
    }
  }
  if (categorySet) {
    const aboveCutoffIds = new Set(aboveCutoff.map(s => s.id));
    rescued = belowCutoff.filter(s =>
      !aboveCutoffIds.has(s.id) && s.category && categorySet.has(s.category)
    );
  }

  // Build result: above-cutoff first, then rescued category matches, then
  // minimum-fill padding from remaining below-cutoff (non-rescued) services.
  // Rescued services COUNT toward MIN_RESULTS so they replace irrelevant
  // padding rather than adding to it.
  const rescuedIds = new Set(rescued.map(s => s.id));
  const fillerPool = belowCutoff.filter(s => !rescuedIds.has(s.id));

  const relevantCount = aboveCutoff.length + rescued.length;
  const minTotal = Math.max(0, MIN_RESULTS - pinnedCount);
  const fillNeeded = Math.max(0, minTotal - relevantCount);
  const filler = fillerPool.slice(0, fillNeeded);

  // Cap everything at MAX_RESULTS
  const allScored = [...aboveCutoff, ...rescued, ...filler].slice(0, maxScored);
  const combined = [...pinned, ...allScored];

  const rescueLog = rescued.length > 0 ? `, ${rescued.length} rescued by category` : '';
  const fillLog = filler.length > 0 ? `, ${filler.length} minimum-fill` : '';
  console.log(`[SearchOrchestrator] Relevance trim: ${services.length} → ${combined.length} (${pinned.length} pinned, ${aboveCutoff.length} above cutoff, cutoff=${cutoff.toFixed(4)}${rescueLog}${fillLog})`);

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
  intent?: QueryIntent,
  secondaryIntent?: QueryIntent,
  subIntents?: string[],
  impliedNeeds?: string[],
  queryUnderstanding?: import('./types').QueryUnderstanding,
): SearchResponse {
  // Trim to relevant results before pagination (rescue categories from both intents)
  services = trimToRelevant(services, intent, secondaryIntent, subIntents, impliedNeeds);
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
    queryUnderstanding,
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
export { pinAlAnonService, isFamilyAddictionQuery, ensureLegalAidInResults, isTenantLegalQuery, isCustodyLegalQuery } from './pinned';
export type { SearchInput, SearchResponse, LiteService } from './types';
// Deploy trigger: 1773874987
