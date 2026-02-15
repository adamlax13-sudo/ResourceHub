/**
 * Search Orchestrator
 *
 * Main entry point for all search operations.
 * Coordinates query analysis, strategy selection, and response formatting.
 */

// Cache version - increment this to invalidate all cached search results
// when making changes that affect search behavior
const CACHE_VERSION = 'v4';

import { SEARCH_CONFIG } from './config';
import type {
  SearchInput,
  SearchResponse,
  SearchResult,
  LiteService,
  SearchType,
} from './types';
import { analyzeQuery, buildCacheKey } from './analyzer';
import { ComprehensiveSearchStrategy } from './strategies/comprehensive';
import { pinCrisisService, getCrisisServiceFull, isCrisisServiceId } from './crisis';
import { isPchadQuery, pinPchadService, getPchadServiceFull, isPchadServiceId } from './pchad';
import { storage } from '../storage';
import { createHash } from 'crypto';
import type { Service } from '@shared/schema';

// Single search strategy - comprehensive mode only
const searchStrategy = new ComprehensiveSearchStrategy();

// In-memory services cache for generating database hash
interface ServicesCacheData {
  hash: string;
  lastFetched: number;
}
let servicesCacheData: ServicesCacheData | null = null;

async function getDatabaseHash(): Promise<string> {
  const now = Date.now();
  if (servicesCacheData && (now - servicesCacheData.lastFetched) < SEARCH_CONFIG.cache.servicesCacheTTL) {
    return servicesCacheData.hash;
  }

  try {
    const services = await storage.getAllActiveServices();
    const latestUpdate = services.length > 0
      ? Math.max(...services.map((s: Service) => s.lastUpdated?.getTime() || 0))
      : 0;
    const hash = createHash('md5')
      .update(`${services.length}-${latestUpdate}`)
      .digest('hex')
      .slice(0, 8);

    servicesCacheData = { hash, lastFetched: now };
    return hash;
  } catch {
    return 'default';
  }
}

/**
 * Main search function - the single entry point for all search requests.
 */
export async function search(input: SearchInput): Promise<SearchResponse> {
  const startTime = Date.now();

  // Get database hash for cache key
  const databaseHash = await getDatabaseHash();

  // Analyze the query
  const analysis = analyzeQuery(input.query, input.location);
  console.log(`[SearchOrchestrator] Query: "${input.query}", Intent: ${analysis.intent}, Location: ${analysis.location.specified || 'none'}`);

  // Check cache - include version and substance type in key to bust cache for new features
  const substanceKey = analysis.substanceType ? `:sub:${analysis.substanceType}` : '';
  const cacheKey = `${CACHE_VERSION}:${buildCacheKey(analysis, 'comprehensive', databaseHash)}${substanceKey}`;
  const cached = await storage.getSearchByQuery(cacheKey);
  if (cached) {
    console.log(`[SearchOrchestrator] Cache HIT for: ${cacheKey.substring(0, 60)}...`);
    const cachedResults = cached.results as { services: LiteService[]; summary: string };
    const services = [...cachedResults.services]; // Clone to avoid mutating cache

    // Apply pinning even for cached results
    if (analysis.isCrisis) {
      pinCrisisService(services);
    }
    if (isPchadQuery(input.query)) {
      pinPchadService(services);
    }

    return formatResponse(services, cachedResults.summary, input, startTime, true);
  }
  console.log(`[SearchOrchestrator] Cache MISS - executing fresh search`);

  // Execute search
  const result = await searchStrategy.search(analysis, input);

  // Apply crisis pinning if needed (single place!)
  if (analysis.isCrisis) {
    pinCrisisService(result.services);
    console.log(`[SearchOrchestrator] Crisis query - 988 pinned to top`);
  }

  // Apply PCHAD pinning for parent/child addiction queries
  if (isPchadQuery(input.query)) {
    pinPchadService(result.services);
    console.log(`[SearchOrchestrator] PCHAD query - Protection of Children Abusing Drugs pinned to top`);
  }

  // Cache the results
  await storage.createSearch({
    query: cacheKey,
    results: { services: result.services, summary: result.summary },
  });

  return formatResponse(result.services, result.summary, input, startTime, false, result.searchType);
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
  searchType?: SearchType
): SearchResponse {
  const totalResults = services.length;
  const totalPages = Math.ceil(totalResults / input.pageSize);
  const startIndex = (input.page - 1) * input.pageSize;
  const paginatedServices = services.slice(startIndex, startIndex + input.pageSize);

  return {
    services: paginatedServices,
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

/**
 * Get full service details by ID (for expanded view)
 */
export async function getServiceDetails(serviceId: string): Promise<any> {
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

  // Helper to parse JSON array fields
  const parseArrayField = (value: unknown): string[] => {
    if (Array.isArray(value) && value.length > 0) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch { /* ignore */ }
    }
    return [];
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
  };
}

// Export types and utilities
export { SEARCH_CONFIG } from './config';
export { analyzeQuery } from './analyzer';
export { pinCrisisService, isCrisisQuery } from './crisis';
export { pinPchadService, isPchadQuery } from './pchad';
export type { SearchInput, SearchResponse, LiteService } from './types';
