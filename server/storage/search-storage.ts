/**
 * SearchStorage — search-related methods with private caches.
 *
 * Owns: confidence score cache, alias lookup cache, search cache ops,
 * semantic search, fast SQL search, infrastructure refresh.
 */

import { db } from "../db";
import {
  searches, services, serviceAliases, aiServiceEnrichments,
  type Search, type Service, type AiServiceEnrichment,
} from "@shared/schema";
import { eq, inArray, isNotNull, sql } from "drizzle-orm";
import { LRUCache } from "lru-cache";

import type { SemanticSearchResult, FastSearchResult, EnrichmentData } from './storage-impl';

// ============= CONFIDENCE CACHE =============

const CONFIDENCE_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const ALIAS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export class SearchStorage {
  // Confidence score cache (bounded LRU — defensive against DB growth on long-running instances)
  private _confidenceCache: LRUCache<string, number> | null = null;
  private _confidenceCacheTime = 0;
  private _confidenceCachePromise: Promise<LRUCache<string, number>> | null = null;

  // Alias lookup cache (bounded LRU)
  private _aliasLookupCache: LRUCache<string, string> | null = null;
  private _aliasLookupCacheTime = 0;

  // ============= SEARCH CACHE =============

  async createSearch(insertSearch: { query: string; results: any }): Promise<Search> {
    const [search] = await db.insert(searches).values(insertSearch).returning();
    return search;
  }

  async getSearchByQuery(query: string): Promise<Search | undefined> {
    const [search] = await db.select().from(searches).where(eq(searches.query, query));
    return search;
  }

  // ============= SEMANTIC SEARCH =============

  async semanticSearch(
    queryEmbedding: number[],
    matchThreshold: number = 0.3,
    matchCount: number = 20,
    location: string | null = null
  ): Promise<SemanticSearchResult[]> {
    if (!Array.isArray(queryEmbedding) || !queryEmbedding.every(v => typeof v === 'number' && isFinite(v))) {
      throw new Error('Invalid embedding: expected array of finite numbers');
    }

    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    let locationFilter: ReturnType<typeof sql>;
    if (location && location.trim()) {
      const locations = location.split(',').map(l => l.trim().toLowerCase()).filter(l => l);
      if (locations.length === 1) {
        locationFilter = sql`AND (
          location ILIKE ${'%' + locations[0] + '%'}
          OR location ILIKE '%alberta-wide%'
          OR location ILIKE '%province-wide%'
          OR location ILIKE '%canada-wide%'
          OR location ILIKE '%nationwide%'
          OR location ILIKE '%all of alberta%'
          OR location ILIKE '%across alberta%'
          OR location = 'Alberta'
          OR location = 'Province of Alberta'
          OR location IS NULL
          OR location = ''
        )`;
      } else if (locations.length > 1) {
        const locationClauses = locations.map(l => sql`location ILIKE ${'%' + l + '%'}`);
        locationFilter = sql`AND (
          ${sql.join(locationClauses, sql` OR `)}
          OR location ILIKE '%alberta-wide%'
          OR location ILIKE '%province-wide%'
          OR location ILIKE '%canada-wide%'
          OR location ILIKE '%nationwide%'
          OR location ILIKE '%all of alberta%'
          OR location ILIKE '%across alberta%'
          OR location = 'Alberta'
          OR location = 'Province of Alberta'
          OR location IS NULL
          OR location = ''
        )`;
      } else {
        locationFilter = sql`AND TRUE`;
      }
    } else {
      locationFilter = sql`AND TRUE`;
    }

    const result = await db.execute(sql`
      SELECT
        service_id as "serviceId",
        name,
        category,
        description,
        location,
        contact,
        website_url as "websiteUrl",
        eligibility,
        process_steps as "processSteps",
        wait_times as "waitTimes",
        required_docs as "requiredDocs",
        phone,
        email,
        address,
        gender_restriction as "genderRestriction",
        age_group as "ageGroup",
        is_faith_based as "isFaithBased",
        is_12_step as "is12Step",
        is_24_7 as "is24_7",
        service_format as "serviceFormat",
        languages_supported as "languagesSupported",
        1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM services
      WHERE is_active = true
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${embeddingStr}::vector) > ${matchThreshold}
        ${locationFilter}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${matchCount}
    `);

    return result.rows as unknown as SemanticSearchResult[];
  }

  async hasEmbeddings(): Promise<boolean> {
    const result = await db.execute(sql`
      SELECT EXISTS(
        SELECT 1 FROM services WHERE embedding IS NOT NULL LIMIT 1
      ) as has_embeddings
    `);
    return (result.rows[0] as any)?.has_embeddings === true;
  }

  // ============= FAST SQL SEARCH =============

  async fastSearch(
    query: string,
    location: string | null = null,
    isLocationOnly: boolean = false,
    limit: number = 50
  ): Promise<FastSearchResult[]> {
    try {
      const result = await db.execute(sql`
        SELECT * FROM fast_search(
          ${query},
          ${location},
          ${isLocationOnly},
          ${limit}
        )
      `);

      return (result.rows as any[]).map(row => ({
        serviceId: row.service_id,
        name: row.name,
        category: row.category,
        description: row.description,
        location: row.location,
        contact: row.contact,
        websiteUrl: row.website_url,
        eligibility: row.eligibility,
        processSteps: row.process_steps,
        waitTimes: row.wait_times,
        requiredDocs: row.required_docs,
        phone: row.phone,
        email: row.email,
        address: row.address,
        tags: row.tags,
        relevanceScore: parseFloat(row.relevance_score) || 0,
        genderRestriction: row.gender_restriction ?? null,
        ageGroup: row.age_group ?? null,
        isFaithBased: row.is_faith_based ?? null,
        is12Step: row.is_12_step ?? null,
        is24_7: row.is_24_7 ?? null,
        serviceFormat: row.service_format ?? null,
        languagesSupported: (row.languages_supported as string[] | null) ?? null,
      }));
    } catch (err) {
      console.warn('[FastSearch] Optimized function not available, using fallback');
      return this.fallbackSearch(query, location, limit);
    }
  }

  private async fallbackSearch(
    query: string,
    location: string | null,
    limit: number
  ): Promise<FastSearchResult[]> {
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of', 'and', 'or', 'in', 'on', 'at', 'for', 'my', 'i', 'me', 'we', 'you', 'he', 'she', 'it', 'they']);
    const keywords = query.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length >= 3 && !stopWords.has(w));

    const searchTerms = keywords.length > 0 ? keywords : [query.toLowerCase()];

    const keywordConditions = searchTerms.map(term => {
      const pattern = '%' + term + '%';
      return sql`(lower(name) LIKE ${pattern} OR lower(category) LIKE ${pattern} OR lower(description) LIKE ${pattern} OR tags::text ILIKE ${pattern})`;
    });

    const keywordScoring = searchTerms.map(term => {
      const pattern = '%' + term + '%';
      return sql`(CASE WHEN lower(name) LIKE ${pattern} THEN 100 ELSE 0 END + CASE WHEN lower(category) LIKE ${pattern} THEN 50 ELSE 0 END + CASE WHEN lower(description) LIKE ${pattern} THEN 30 ELSE 0 END + CASE WHEN tags::text ILIKE ${pattern} THEN 40 ELSE 0 END)`;
    });

    let locationFilter = sql``;
    if (location) {
      const locations = location.split(',').map(l => l.trim().toLowerCase()).filter(l => l);
      if (locations.length === 1) {
        const locPattern = '%' + locations[0] + '%';
        locationFilter = sql`AND (lower(location) LIKE ${locPattern}
          OR lower(location) LIKE '%alberta-wide%'
          OR lower(location) LIKE '%province-wide%'
          OR lower(location) LIKE '%canada-wide%'
          OR lower(location) LIKE '%nationwide%'
          OR lower(location) LIKE '%all of alberta%'
          OR lower(location) LIKE '%across alberta%'
          OR lower(location) = 'alberta'
          OR lower(location) = 'province of alberta'
          OR location IS NULL OR location = '')`;
      } else if (locations.length > 1) {
        const locationClauses = locations.map(l => sql`lower(location) LIKE ${'%' + l + '%'}`);
        locationFilter = sql`AND (${sql.join(locationClauses, sql` OR `)}
          OR lower(location) LIKE '%alberta-wide%'
          OR lower(location) LIKE '%province-wide%'
          OR lower(location) LIKE '%canada-wide%'
          OR lower(location) LIKE '%nationwide%'
          OR lower(location) LIKE '%all of alberta%'
          OR lower(location) LIKE '%across alberta%'
          OR lower(location) = 'alberta'
          OR lower(location) = 'province of alberta'
          OR location IS NULL OR location = '')`;
      }
    }

    console.log(`[FallbackSearch] Keywords: ${searchTerms.join(', ')}, Location: ${location || 'Alberta-wide'}`);

    const result = await db.execute(sql`
      SELECT
        service_id,
        name,
        category,
        description,
        location,
        contact,
        website_url,
        eligibility,
        process_steps,
        wait_times,
        required_docs,
        phone,
        email,
        address,
        tags,
        gender_restriction,
        age_group,
        is_faith_based,
        is_12_step,
        is_24_7,
        service_format,
        languages_supported,
        (${sql.join(keywordScoring, sql` + `)} + COALESCE(click_count, 0) * 2) as relevance_score
      FROM services
      WHERE is_active = true
        AND (${sql.join(keywordConditions, sql` OR `)})
        ${locationFilter}
      ORDER BY relevance_score DESC
      LIMIT ${limit}
    `);

    return (result.rows as any[]).map(row => ({
      serviceId: row.service_id,
      name: row.name,
      category: row.category,
      description: row.description,
      location: row.location,
      contact: row.contact,
      websiteUrl: row.website_url,
      eligibility: row.eligibility,
      processSteps: row.process_steps,
      waitTimes: row.wait_times,
      requiredDocs: row.required_docs,
      phone: row.phone,
      email: row.email,
      address: row.address,
      tags: row.tags,
      relevanceScore: parseFloat(row.relevance_score) || 0,
      genderRestriction: row.gender_restriction ?? null,
      ageGroup: row.age_group ?? null,
      isFaithBased: row.is_faith_based ?? null,
      is12Step: row.is_12_step ?? null,
      is24_7: row.is_24_7 ?? null,
      serviceFormat: row.service_format ?? null,
      languagesSupported: (row.languages_supported as string[] | null) ?? null,
    }));
  }

  // ============= ENRICHMENT BATCH =============

  async getEnrichmentsBatch(serviceIds: string[]): Promise<Map<string, EnrichmentData>> {
    if (serviceIds.length === 0) return new Map();

    const result = await db
      .select({
        serviceId: aiServiceEnrichments.serviceId,
        serviceName: aiServiceEnrichments.serviceName,
        aiDescription: aiServiceEnrichments.aiDescription,
        aiCategory: aiServiceEnrichments.aiCategory,
        aiProcessSteps: aiServiceEnrichments.aiProcessSteps,
        aiEligibility: aiServiceEnrichments.aiEligibility,
        aiWaitTimes: aiServiceEnrichments.aiWaitTimes,
        aiRequiredDocs: aiServiceEnrichments.aiRequiredDocs,
        aiLocation: aiServiceEnrichments.aiLocation,
        aiContact: aiServiceEnrichments.aiContact,
      })
      .from(aiServiceEnrichments)
      .where(inArray(aiServiceEnrichments.serviceId, serviceIds));

    const map = new Map<string, EnrichmentData>();
    for (const row of result) {
      map.set(row.serviceId, {
        serviceId: row.serviceId,
        serviceName: row.serviceName,
        aiDescription: row.aiDescription,
        aiCategory: row.aiCategory,
        aiProcessSteps: row.aiProcessSteps,
        aiEligibility: row.aiEligibility,
        aiWaitTimes: row.aiWaitTimes,
        aiRequiredDocs: row.aiRequiredDocs,
        aiLocation: row.aiLocation,
        aiContact: row.aiContact,
      });
    }
    return map;
  }

  // ============= CONFIDENCE SCORES =============

  async getConfidenceScores(serviceIds: string[]): Promise<Map<string, number>> {
    if (serviceIds.length === 0) return new Map();

    const now = Date.now();
    if (!this._confidenceCache || (now - this._confidenceCacheTime) > CONFIDENCE_CACHE_TTL) {
      if (!this._confidenceCachePromise) {
        this._confidenceCachePromise = (async () => {
          try {
            const result = await db
              .select({
                serviceId: services.serviceId,
                confidenceScore: services.confidenceScore,
              })
              .from(services)
              .where(isNotNull(services.confidenceScore));
            const map = new LRUCache<string, number>({ max: 5000 });
            for (const row of result) {
              if (row.confidenceScore !== null) {
                map.set(row.serviceId, row.confidenceScore);
              }
            }
            this._confidenceCache = map;
            this._confidenceCacheTime = Date.now();
            return map;
          } finally {
            this._confidenceCachePromise = null;
          }
        })();
      }
      await this._confidenceCachePromise;
    }

    const full = this._confidenceCache!;
    const map = new Map<string, number>();
    for (const id of serviceIds) {
      const score = full.get(id);
      if (score !== undefined) map.set(id, score);
    }
    return map;
  }

  invalidateConfidenceCache(): void {
    this._confidenceCache = null;
    this._confidenceCacheTime = 0;
  }

  // ============= COORDINATES =============

  async getServiceCoordinates(serviceIds: string[]): Promise<Map<string, { lat: number; lng: number }>> {
    if (serviceIds.length === 0) return new Map();

    const result = await db
      .select({
        serviceId: services.serviceId,
        latitude: services.latitude,
        longitude: services.longitude,
      })
      .from(services)
      .where(inArray(services.serviceId, serviceIds));

    const map = new Map<string, { lat: number; lng: number }>();
    for (const row of result) {
      if (row.latitude != null && row.longitude != null) {
        map.set(row.serviceId, { lat: row.latitude, lng: row.longitude });
      }
    }
    return map;
  }

  // ============= SERVICE COORDINATES + FRESHNESS (combined query) =============

  /** Batch-fetch coordinates AND lastChecked in a single DB query to avoid extra round-trip */
  async getServiceCoordsAndFreshness(serviceIds: string[]): Promise<{
    coords: Map<string, { lat: number; lng: number }>;
    freshness: Map<string, string>;
  }> {
    if (serviceIds.length === 0) return { coords: new Map(), freshness: new Map() };

    const result = await db
      .select({
        serviceId: services.serviceId,
        latitude: services.latitude,
        longitude: services.longitude,
        lastChecked: services.lastChecked,
      })
      .from(services)
      .where(inArray(services.serviceId, serviceIds));

    const coords = new Map<string, { lat: number; lng: number }>();
    const freshness = new Map<string, string>();
    for (const row of result) {
      if (row.latitude != null && row.longitude != null) {
        coords.set(row.serviceId, { lat: row.latitude, lng: row.longitude });
      }
      if (row.lastChecked) {
        freshness.set(row.serviceId, row.lastChecked.toISOString());
      }
    }
    return { coords, freshness };
  }

  async getServiceLastChecked(serviceIds: string[]): Promise<Map<string, string>> {
    const { freshness } = await this.getServiceCoordsAndFreshness(serviceIds);
    return freshness;
  }

  // ============= SERVICE ALIASES =============

  async getAliasesForServices(): Promise<Map<string, string[]>> {
    const aliases = await db.select().from(serviceAliases);
    const map = new Map<string, string[]>();
    for (const alias of aliases) {
      const existing = map.get(alias.serviceId) || [];
      existing.push(alias.alias.toLowerCase());
      map.set(alias.serviceId, existing);
    }
    return map;
  }

  async findServiceByAlias(alias: string): Promise<string | null> {
    const result = await db
      .select({ serviceId: serviceAliases.serviceId })
      .from(serviceAliases)
      .where(sql`lower(${serviceAliases.alias}) = ${alias.toLowerCase()}`)
      .limit(1);
    return result[0]?.serviceId ?? null;
  }

  async getAliasLookup(): Promise<Map<string, string>> {
    const now = Date.now();
    if (this._aliasLookupCache && (now - this._aliasLookupCacheTime) < ALIAS_CACHE_TTL) {
      // Convert LRU entries to plain Map for interface compatibility
      return new Map(this._aliasLookupCache.entries());
    }
    const aliases = await db.select().from(serviceAliases);
    const lru = new LRUCache<string, string>({ max: 5000 });
    for (const alias of aliases) {
      lru.set(alias.alias.toLowerCase(), alias.serviceId);
    }
    this._aliasLookupCache = lru;
    this._aliasLookupCacheTime = Date.now();
    return new Map(lru.entries());
  }

  // ============= SEARCH INFRASTRUCTURE =============

  async hasOptimizedSearch(): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT EXISTS(
          SELECT 1 FROM pg_matviews WHERE matviewname = 'mv_service_search'
        ) as has_view
      `);
      return (result.rows[0] as any)?.has_view === true;
    } catch {
      return false;
    }
  }

  async refreshSearchView(): Promise<void> {
    try {
      await db.execute(sql`SELECT refresh_search_view()`);
      console.log('[Search] Materialized view refreshed');
    } catch (err) {
      console.warn('[Search] Failed to refresh materialized view:', err);
    }
  }

  async clearSearchCache(): Promise<void> {
    try {
      await db.delete(searches);
      console.log('[Search] Search cache cleared');
    } catch (err) {
      console.warn('[Search] Failed to clear search cache:', err);
    }
  }

  async clearStaleSearches(maxAgeDays: number = 7): Promise<number> {
    try {
      const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
      const deleted = await db.delete(searches).where(
        sql`${searches.createdAt} < ${cutoff}`
      ).returning();
      const count = deleted.length;
      if (count > 0) {
        console.log(`[Search] Cleared ${count} stale cache entries (older than ${maxAgeDays} days)`);
      }
      return count;
    } catch (err) {
      console.warn('[Search] Failed to clear stale searches:', err);
      return 0;
    }
  }

  // ============= PRECOMPUTED SEARCH CACHE =============

  async getPrecomputedSearch(queryNormalized: string): Promise<{ results: any[]; resultCount: number } | null> {
    try {
      const result = await db.execute(sql`
        SELECT results, result_count
        FROM precomputed_searches
        WHERE query_normalized = ${queryNormalized.toLowerCase().trim()}
          AND computed_at > NOW() - INTERVAL '24 hours'
      `);

      if (result.rows.length === 0) return null;

      const row = result.rows[0] as any;
      return {
        results: row.results,
        resultCount: row.result_count,
      };
    } catch {
      // Table may not exist yet
      return null;
    }
  }

  async savePrecomputedSearch(queryNormalized: string, results: any[], resultCount: number): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO precomputed_searches (query_normalized, results, result_count, computed_at)
        VALUES (${queryNormalized.toLowerCase().trim()}, ${JSON.stringify(results)}, ${resultCount}, NOW())
        ON CONFLICT (query_normalized) DO UPDATE SET
          results = EXCLUDED.results,
          result_count = EXCLUDED.result_count,
          computed_at = NOW()
      `);
    } catch (err) {
      console.warn('[PrecomputedSearch] Failed to save:', err);
    }
  }

  // ============= FAILED QUERY LOGGING =============

  async logFailedQuery(data: {
    query: string;
    queryNormalized: string;
    intent: string;
    location?: string | null;
  }): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO failed_queries (query, query_normalized, intent, location)
        VALUES (${data.query}, ${data.queryNormalized}, ${data.intent}, ${data.location || null})
        ON CONFLICT (query_normalized, COALESCE(location, '')) DO UPDATE SET
          count = failed_queries.count + 1,
          last_seen = NOW()
      `);
    } catch (err) {
      // Table may not exist yet - silently fail
      console.warn('[FailedQuery] Failed to log:', err);
    }
  }

  async getTopFailedQueries(limit: number = 50): Promise<{
    query: string;
    queryNormalized: string;
    intent: string;
    location: string | null;
    count: number;
    firstSeen: Date;
    lastSeen: Date;
  }[]> {
    try {
      const result = await db.execute(sql`
        SELECT query, query_normalized, intent, location, count, first_seen, last_seen
        FROM failed_queries
        ORDER BY count DESC, last_seen DESC
        LIMIT ${limit}
      `);

      return (result.rows as any[]).map(row => ({
        query: row.query,
        queryNormalized: row.query_normalized,
        intent: row.intent,
        location: row.location,
        count: row.count,
        firstSeen: row.first_seen,
        lastSeen: row.last_seen,
      }));
    } catch (err) {
      console.error('[storage] getTopFailedQueries error:', err);
      return [];
    }
  }
}
