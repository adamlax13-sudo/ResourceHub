/**
 * Search Orchestrator
 *
 * Main entry point for all search operations.
 * Coordinates query analysis, strategy selection, and response formatting.
 */

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

  // Check cache - include substance type in key to bust cache for new boosting logic
  const substanceKey = analysis.substanceType ? `:sub:${analysis.substanceType}` : '';
  const cacheKey = buildCacheKey(analysis, 'comprehensive', databaseHash) + substanceKey;
  const cached = await storage.getSearchByQuery(cacheKey);
  if (cached) {
    console.log(`[SearchOrchestrator] Cache HIT for: ${cacheKey.substring(0, 60)}...`);
    const cachedResults = cached.results as { services: LiteService[]; summary: string };
    return formatResponse(cachedResults.services, cachedResults.summary, input, startTime, true);
  }
  console.log(`[SearchOrchestrator] Cache MISS - executing fresh search`);

  // Execute search
  const result = await searchStrategy.search(analysis, input);

  // Apply crisis pinning if needed (single place!)
  if (analysis.isCrisis) {
    pinCrisisService(result.services);
    console.log(`[SearchOrchestrator] Crisis query - 988 pinned to top`);
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

  // Use enrichment data if available, otherwise fall back to service data
  const enrichmentSteps = parseArrayField(enrichment?.aiProcessSteps);
  const serviceSteps = parseArrayField(service.processSteps);
  const processSteps = enrichmentSteps.length > 0 ? enrichmentSteps : serviceSteps;

  const enrichmentDocs = parseArrayField(enrichment?.aiRequiredDocs);
  const serviceDocs = parseArrayField(service.requiredDocs);
  const requiredDocs = enrichmentDocs.length > 0 ? enrichmentDocs : serviceDocs;

  // Prefer address over location for more complete info
  const displayLocation = service.address || enrichment?.aiLocation || service.location || '';

  // For expanded view, prefer original description (full text) over AI summary
  // Only use AI description if original is missing/empty
  const originalDesc = service.description || '';
  const aiDesc = enrichment?.aiDescription || '';
  const description = originalDesc.length > 0 ? originalDesc : aiDesc;

  return {
    id: service.serviceId,
    name: service.name,
    category: enrichment?.aiCategory || service.category,
    description,
    location: displayLocation,
    contact: enrichment?.aiContact || service.contact || '',
    websiteUrl: service.websiteUrl || '',
    eligibility: enrichment?.aiEligibility || service.eligibility || '',
    process: processSteps,
    waitTimes: enrichment?.aiWaitTimes || service.waitTimes || '',
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
export type { SearchInput, SearchResponse, LiteService } from './types';
