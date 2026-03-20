import { db } from "../db";
import { searches, feedback, services, aiServiceEnrichments, searchAnalytics, serviceAliases, serviceVotes, serviceHistory, serviceChangeRequests, scraperLogs, type Search, type Feedback, type Service, type AiServiceEnrichment, type SearchAnalytics, type ServiceAlias, type ServiceHistory, type ServiceChangeRequest, type InsertServiceChangeRequest, type ScraperLog } from "@shared/schema";

import { eq, or, ilike, and, desc, asc, inArray, sql, isNull, isNotNull, lt, gte, count as drizzleCount, type SQL } from "drizzle-orm";

type InsertFeedback = typeof feedback.$inferInsert;

// Result type for semantic search
export interface SemanticSearchResult {
  serviceId: string;
  name: string;
  category: string;
  description: string | null;
  location: string | null;
  contact: string | null;
  websiteUrl: string | null;
  eligibility: string | null;
  processSteps: any;
  waitTimes: string | null;
  requiredDocs: any;
  phone: string | null;
  email: string | null;
  address: string | null;
  similarity: number;
  genderRestriction?: string | null;
  ageGroup?: string | null;
  isFaithBased?: boolean | null;
  is12Step?: boolean | null;
  serviceFormat?: string | null;
  languagesSupported?: string[] | null;
}

// Result type for optimized SQL search (Stage 1)
export interface FastSearchResult {
  serviceId: string;
  name: string;
  category: string;
  description: string | null;
  location: string | null;
  contact: string | null;
  websiteUrl: string | null;
  eligibility: string | null;
  processSteps: any;
  waitTimes: string | null;
  requiredDocs: any;
  phone: string | null;
  email: string | null;
  address: string | null;
  tags: any;
  relevanceScore: number;
  genderRestriction?: string | null;
  ageGroup?: string | null;
  isFaithBased?: boolean | null;
  is12Step?: boolean | null;
  serviceFormat?: string | null;
  languagesSupported?: string[] | null;
}

// Enrichment data for Stage 2
export interface EnrichmentData {
  serviceId: string;
  serviceName: string;
  aiDescription: string;
  aiCategory: string | null;
  aiProcessSteps: any;
  aiEligibility: string | null;
  aiWaitTimes: string | null;
  aiRequiredDocs: any;
  aiLocation: string | null;
  aiContact: string | null;
}

export interface IStorage {
  createSearch(search: { query: string; results: any }): Promise<Search>;
  getSearchByQuery(query: string): Promise<Search | undefined>;

  createFeedback(feedbackData: InsertFeedback): Promise<Feedback>;
  getAllFeedback(): Promise<Feedback[]>;

  // Service queries
  getAllActiveServices(): Promise<Service[]>;
  searchServices(searchTerm: string): Promise<Service[]>;

  // Semantic (embedding) search
  semanticSearch(queryEmbedding: number[], matchThreshold?: number, matchCount?: number, location?: string | null): Promise<SemanticSearchResult[]>;
  hasEmbeddings(): Promise<boolean>;

  // AI enrichment cache
  getEnrichmentsByServiceIds(serviceIds: string[]): Promise<Map<string, AiServiceEnrichment>>;
  upsertEnrichment(enrichment: {
    serviceId: string;
    serviceName: string;
    aiDescription: string;
    aiCategory?: string | null;
    aiProcessSteps: any;
    aiEligibility?: string | null;
    aiWaitTimes?: string | null;
    aiRequiredDocs?: any;
    aiLocation?: string | null;
    aiContact?: string | null;
  }): Promise<void>;

  // Persist enrichment data to services table (fills empty fields only)
  persistEnrichmentToService(serviceId: string, enrichment: AiServiceEnrichment): Promise<number>;

  // Get all enrichments for backfill processing
  getAllEnrichments(): Promise<AiServiceEnrichment[]>;

  // Search analytics and click tracking
  trackSearchClick(data: {
    query: string;
    normalizedQuery: string;
    resultCount: number;
    clickedServiceId?: string;
    clickPosition?: number;
    sessionId?: string;
    userAgent?: string;
  }): Promise<void>;
  getClickCountForService(serviceId: string): Promise<number>;
  getPopularSearches(limit?: number): Promise<{ query: string; count: number }[]>;

  // Click-through affinities
  getQueryAffinities(normalizedQuery: string): Promise<{ serviceId: string; clickScore: number; voteScore: number }[]>;

  // Service aliases
  getAliasesForServices(): Promise<Map<string, string[]>>;
  findServiceByAlias(alias: string): Promise<string | null>;

  // Get full service details by ID (for lazy loading expanded view)
  getServiceById(serviceId: string): Promise<{
    service: Service | null;
    enrichment: AiServiceEnrichment | null;
  }>;

  // ============= OPTIMIZED TWO-STAGE SEARCH =============
  // Stage 1: Fast SQL-based search (uses indexes)
  fastSearch(query: string, location?: string | null, isLocationOnly?: boolean, limit?: number): Promise<FastSearchResult[]>;

  // Batch enrichment lookup (avoids N+1)
  getEnrichmentsBatch(serviceIds: string[]): Promise<Map<string, EnrichmentData>>;

  // Category-based service lookup (for supplementing filtered results)
  getServicesByCategories(categories: string[]): Promise<Service[]>;

  // Batch confidence score lookup for data quality boosting
  getConfidenceScores(serviceIds: string[]): Promise<Map<string, number>>;

  // Batch coordinate lookup for distance calculations
  getServiceCoordinates(serviceIds: string[]): Promise<Map<string, { lat: number; lng: number }>>;

  // Popular queries for autocomplete suggestions
  getPopularQueries(limit: number, days: number): Promise<string[]>;

  // Fetch active services from same organization (by name prefix before " — ")
  getServicesByOrg(orgPrefix: string): Promise<Service[]>;

  // Check if materialized view exists (for graceful fallback)
  hasOptimizedSearch(): Promise<boolean>;

  // Refresh materialized view (call after scraper)
  refreshSearchView(): Promise<void>;

  // Clear search cache (call after service changes)
  clearSearchCache(): Promise<void>;

  // Clear stale search cache entries older than maxAgeDays
  clearStaleSearches(maxAgeDays?: number): Promise<number>;

  // ============= PRECOMPUTED SEARCH CACHE =============
  getPrecomputedSearch(queryNormalized: string): Promise<{ results: any[]; resultCount: number } | null>;
  savePrecomputedSearch(queryNormalized: string, results: any[], resultCount: number): Promise<void>;

  // ============= FAILED QUERY LOGGING =============
  logFailedQuery(data: { query: string; queryNormalized: string; intent: string; location?: string | null }): Promise<void>;
  getTopFailedQueries(limit?: number): Promise<{ query: string; queryNormalized: string; intent: string; location: string | null; count: number; firstSeen: Date; lastSeen: Date }[]>;

  // ============= SERVICE VOTES =============
  createServiceVote(serviceId: string, vote: 'up' | 'down', queryContext?: string): Promise<void>;

  // ============= ADMIN: SERVICE CRUD =============
  createService(data: Partial<Service> & { name: string; category: string }): Promise<Service>;
  updateService(id: number, changes: Partial<Service>): Promise<Service>;
  deactivateService(id: number, reason: string): Promise<Service>;
  restoreService(id: number): Promise<Service>;
  getServiceHistory(serviceId: number): Promise<ServiceHistory[]>;
  getAdminServices(params: {
    q?: string;
    category?: string;
    status?: 'active' | 'inactive' | 'all';
    location?: string;
    hasEmbedding?: boolean;
    hasGeocoding?: boolean;
    enrichmentSource?: string;
    page?: number;
    limit?: number;
    sort?: 'name' | 'category' | 'confidence' | 'lastUpdated' | 'enrichmentSource';
    order?: 'asc' | 'desc';
  }): Promise<{ services: Service[]; total: number }>;
  getAdminServiceDetail(id: number): Promise<Service | null>;

  // ============= ADMIN: BULK OPERATIONS =============
  bulkUpdateServices(ids: number[], changes: Partial<Service>, reason?: string): Promise<number>;
  bulkDeactivateServices(ids: number[], reason: string): Promise<number>;

  // ============= ADMIN: REVIEW QUEUE =============
  createChangeRequest(data: InsertServiceChangeRequest): Promise<ServiceChangeRequest>;
  getChangeRequests(params: {
    status?: string;
    source?: string;
    changeType?: string;
    batchId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ requests: ServiceChangeRequest[]; total: number }>;
  getChangeRequestById(id: number): Promise<ServiceChangeRequest | null>;
  updateChangeRequest(id: number, changes: Partial<ServiceChangeRequest>): Promise<ServiceChangeRequest>;
  approveChangeRequest(id: number, reviewedBy?: string): Promise<Service>;
  rejectChangeRequest(id: number, reason: string, reviewedBy?: string): Promise<void>;
  bulkApproveChangeRequests(ids: number[], reviewedBy?: string): Promise<number>;

  // ============= ADMIN: QUALITY =============
  getQualitySummary(): Promise<Record<string, number>>;
  getQualityIssues(params: {
    page?: number;
    limit?: number;
    fieldFilter?: string;
    severityFilter?: string;
  }): Promise<{ issues: { service: Service; severity: string; missingFields: string[] }[]; total: number }>;

  // ============= ADMIN: DASHBOARD =============
  getDashboardStats(): Promise<{ activeServices: number; pendingReviews: number; searchesToday: number; qualityScore: number }>;
  getRecentActivity(limit?: number): Promise<ServiceHistory[]>;

  // ============= ADMIN: SCRAPER =============
  getScraperRuns(params: { page?: number; limit?: number }): Promise<{ runs: ScraperLog[]; total: number }>;
  getScraperRunById(id: number): Promise<ScraperLog | null>;
}

export class DatabaseStorage implements IStorage {
  async createSearch(insertSearch: { query: string; results: any }): Promise<Search> {
    const [search] = await db.insert(searches).values(insertSearch).returning();
    return search;
  }

  async getSearchByQuery(query: string): Promise<Search | undefined> {
    const [search] = await db.select().from(searches).where(eq(searches.query, query));
    return search;
  }

  async createFeedback(feedbackData: InsertFeedback): Promise<Feedback> {
    const [newFeedback] = await db.insert(feedback).values(feedbackData).returning();
    return newFeedback;
  }

  async getAllFeedback(): Promise<Feedback[]> {
    return await db.select().from(feedback);
  }

  // Service methods
  async getAllActiveServices(): Promise<Service[]> {
    return await db
      .select()
      .from(services)
      .where(eq(services.isActive, true))
      .orderBy(desc(services.lastChecked));
  }

  async getCrisisLines(): Promise<Service[]> {
    return await db
      .select()
      .from(services)
      .where(
        and(
          eq(services.isActive, true),
          eq(services.category, 'Crisis Lines')
        )
      )
      .orderBy(services.name);
  }

  async getServicesByCategories(categories: string[]): Promise<Service[]> {
    if (categories.length === 0) return [];
    return await db
      .select()
      .from(services)
      .where(
        and(
          eq(services.isActive, true),
          inArray(services.category, categories)
        )
      )
      .orderBy(services.name);
  }

  async searchServices(searchTerm: string): Promise<Service[]> {
    const term = `%${searchTerm}%`;
    return await db
      .select()
      .from(services)
      .where(
        and(
          eq(services.isActive, true),
          or(
            ilike(services.name, term),
            ilike(services.description, term),
            ilike(services.category, term),
            ilike(services.location, term),
            ilike(services.contact, term)
          )
        )
      )
      .orderBy(desc(services.lastChecked));
  }

  // Get full service details by ID (for lazy loading modal/expanded view)
  // Only returns active services — deactivated services are treated as not found
  async getServiceById(serviceId: string): Promise<{
    service: Service | null;
    enrichment: AiServiceEnrichment | null;
  }> {
    // Fetch service and enrichment in parallel
    const [serviceResult, enrichmentResult] = await Promise.all([
      db.select().from(services).where(
        and(eq(services.serviceId, serviceId), eq(services.isActive, true))
      ).limit(1),
      db.select().from(aiServiceEnrichments).where(eq(aiServiceEnrichments.serviceId, serviceId)).limit(1),
    ]);

    return {
      service: serviceResult[0] || null,
      enrichment: serviceResult[0] ? (enrichmentResult[0] || null) : null,
    };
  }

  // ============= SEMANTIC (EMBEDDING) SEARCH =============
  async semanticSearch(
    queryEmbedding: number[],
    matchThreshold: number = 0.3,
    matchCount: number = 20,
    location: string | null = null
  ): Promise<SemanticSearchResult[]> {
    // Validate embedding before SQL interpolation
    if (!Array.isArray(queryEmbedding) || !queryEmbedding.every(v => typeof v === 'number' && isFinite(v))) {
      throw new Error('Invalid embedding: expected array of finite numbers');
    }

    // Convert embedding array to PostgreSQL vector format
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Build location filter - handle comma-separated multiple locations
    // When no location is specified (Alberta-wide), we explicitly include all services
    // by not adding any location restriction
    let locationFilter: ReturnType<typeof sql>;

    if (location && location.trim()) {
      const locations = location.split(',').map(l => l.trim().toLowerCase()).filter(l => l);
      if (locations.length === 1) {
        // Single location - include specified location + province-wide services
        // IMPORTANT: Don't match "%alberta%" - that matches every address like "Calgary, Alberta"
        // Instead, match specific province-wide patterns
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
        // Multiple locations - match any of them using parameterized queries
        // Build safe SQL conditions using sql template literals
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
        // Empty locations array after filtering - Alberta-wide search
        locationFilter = sql`AND TRUE`;
      }
    } else {
      // Alberta-wide search: no location restriction
      // Use explicit AND TRUE to avoid empty SQL fragment issues
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

  // AI enrichment methods
  async getEnrichmentsByServiceIds(serviceIds: string[]): Promise<Map<string, AiServiceEnrichment>> {
    if (serviceIds.length === 0) return new Map();

    const enrichments = await db
      .select()
      .from(aiServiceEnrichments)
      .where(inArray(aiServiceEnrichments.serviceId, serviceIds));

    const map = new Map<string, AiServiceEnrichment>();
    for (const e of enrichments) {
      map.set(e.serviceId, e);
    }
    return map;
  }

  async upsertEnrichment(enrichment: {
    serviceId: string;
    serviceName: string;
    aiDescription: string;
    aiCategory?: string | null;
    aiProcessSteps: any;
    aiEligibility?: string | null;
    aiWaitTimes?: string | null;
    aiRequiredDocs?: any;
    aiLocation?: string | null;
    aiContact?: string | null;
  }): Promise<void> {
    await db
      .insert(aiServiceEnrichments)
      .values({
        serviceId: enrichment.serviceId,
        serviceName: enrichment.serviceName,
        aiDescription: enrichment.aiDescription,
        aiCategory: enrichment.aiCategory || null,
        aiProcessSteps: enrichment.aiProcessSteps,
        aiEligibility: enrichment.aiEligibility || null,
        aiWaitTimes: enrichment.aiWaitTimes || null,
        aiRequiredDocs: enrichment.aiRequiredDocs || null,
        aiLocation: enrichment.aiLocation || null,
        aiContact: enrichment.aiContact || null,
      })
      .onConflictDoUpdate({
        target: aiServiceEnrichments.serviceId,
        set: {
          serviceName: enrichment.serviceName,
          aiDescription: enrichment.aiDescription,
          aiCategory: enrichment.aiCategory || null,
          aiProcessSteps: enrichment.aiProcessSteps,
          aiEligibility: enrichment.aiEligibility || null,
          aiWaitTimes: enrichment.aiWaitTimes || null,
          aiRequiredDocs: enrichment.aiRequiredDocs || null,
          aiLocation: enrichment.aiLocation || null,
          aiContact: enrichment.aiContact || null,
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Persist enrichment data to the services table for empty fields only.
   * This reduces future enrichment lookups by making service data complete.
   * Returns the number of fields that were updated.
   * SECURITY: Uses transaction to ensure atomic read-modify-write
   */
  async persistEnrichmentToService(
    serviceId: string,
    enrichment: AiServiceEnrichment
  ): Promise<number> {
    // Import the helper here to avoid circular dependencies
    const { buildEnrichmentUpdate } = await import('../helpers/enrichment');

    // Use transaction for atomic read-modify-write
    return await db.transaction(async (tx) => {
      // Fetch current service state within transaction
      const [service] = await tx.select().from(services)
        .where(eq(services.serviceId, serviceId));

      if (!service) {
        console.warn(`[Enrichment] Service ${serviceId} not found, skipping persist`);
        return 0;
      }

      // Build update object with only empty fields
      const updates = buildEnrichmentUpdate(service, enrichment);

      if (!updates) {
        return 0;
      }

      // Update the service with enrichment data
      await tx.update(services)
        .set({ ...updates, lastUpdated: new Date() })
        .where(eq(services.serviceId, serviceId));

      const fieldCount = Object.keys(updates).length;
      console.log(`[Enrichment] Persisted ${fieldCount} fields to service ${serviceId}: ${Object.keys(updates).join(', ')}`);

      return fieldCount;
    });
  }

  /**
   * Get all enrichments for backfill processing
   */
  async getAllEnrichments(): Promise<AiServiceEnrichment[]> {
    return await db.select().from(aiServiceEnrichments);
  }

  // ============= SEARCH ANALYTICS & CLICK TRACKING =============
  /**
   * Track search clicks for analytics and service ranking
   * SECURITY: Uses transaction to ensure both operations succeed or fail together
   */
  async trackSearchClick(data: {
    query: string;
    normalizedQuery: string;
    resultCount: number;
    clickedServiceId?: string;
    clickPosition?: number;
    sessionId?: string;
    userAgent?: string;
  }): Promise<void> {
    // Use transaction to ensure atomicity of analytics + click count update
    await db.transaction(async (tx) => {
      await tx.insert(searchAnalytics).values({
        query: data.query,
        normalizedQuery: data.normalizedQuery,
        resultCount: data.resultCount,
        clickedServiceId: data.clickedServiceId || null,
        clickPosition: data.clickPosition || null,
        sessionId: data.sessionId || null,
        userAgent: data.userAgent || null,
      });

      // If a service was clicked, increment its click count and update last_clicked
      if (data.clickedServiceId) {
        await tx
          .update(services)
          .set({
            clickCount: sql`COALESCE(${services.clickCount}, 0) + 1`,
          })
          .where(eq(services.serviceId, data.clickedServiceId));
      }
    });
  }

  async getClickCountForService(serviceId: string): Promise<number> {
    const result = await db
      .select({ clickCount: services.clickCount })
      .from(services)
      .where(eq(services.serviceId, serviceId))
      .limit(1);
    return result[0]?.clickCount ?? 0;
  }

  async getPopularSearches(limit: number = 20): Promise<{ query: string; count: number }[]> {
    const result = await db
      .select({
        query: searchAnalytics.normalizedQuery,
        count: sql<number>`COUNT(*)`,
      })
      .from(searchAnalytics)
      .groupBy(searchAnalytics.normalizedQuery)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(limit);
    return result.map(r => ({ query: r.query, count: Number(r.count) }));
  }

  /**
   * Get popular queries for autocomplete suggestions.
   * Returns unique normalized queries from the last N days, ordered by frequency.
   */
  async getPopularQueries(limit: number = 100, days: number = 30): Promise<string[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const result = await db
      .select({
        query: searchAnalytics.normalizedQuery,
      })
      .from(searchAnalytics)
      .where(gte(searchAnalytics.createdAt, cutoff))
      .groupBy(searchAnalytics.normalizedQuery)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(limit);

    return result.map(r => r.query);
  }

  // ============= CLICK-THROUGH AFFINITIES =============
  async getQueryAffinities(normalizedQuery: string): Promise<{ serviceId: string; clickScore: number; voteScore: number }[]> {
    try {
      const result = await db.execute(sql`
        SELECT service_id, click_score, vote_score
        FROM query_service_affinities
        WHERE normalized_query = ${normalizedQuery}
        ORDER BY click_score DESC
        LIMIT 50
      `);
      return (result.rows as any[]).map(r => ({
        serviceId: r.service_id,
        clickScore: r.click_score ?? 0,
        voteScore: r.vote_score ?? 0,
      }));
    } catch {
      // Table may not exist yet — return empty
      return [];
    }
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

  // Get all aliases as a lookup map (alias -> serviceId)
  // Cached in memory — aliases rarely change
  private aliasLookupCache: Map<string, string> | null = null;
  private aliasLookupCacheTime: number = 0;
  private static readonly ALIAS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

  async getAliasLookup(): Promise<Map<string, string>> {
    const now = Date.now();
    if (this.aliasLookupCache && (now - this.aliasLookupCacheTime) < DatabaseStorage.ALIAS_CACHE_TTL) {
      return this.aliasLookupCache;
    }
    const aliases = await db.select().from(serviceAliases);
    const map = new Map<string, string>();
    for (const alias of aliases) {
      map.set(alias.alias.toLowerCase(), alias.serviceId);
    }
    this.aliasLookupCache = map;
    this.aliasLookupCacheTime = Date.now();
    return map;
  }

  // ============= OPTIMIZED TWO-STAGE SEARCH =============

  /**
   * Stage 1: Fast SQL-based search using indexes
   * Uses materialized view with GIN indexes for full-text and trigram search
   * Falls back to direct table query if materialized view doesn't exist
   */
  async fastSearch(
    query: string,
    location: string | null = null,
    isLocationOnly: boolean = false,
    limit: number = 50
  ): Promise<FastSearchResult[]> {
    try {
      // Try using the optimized SQL function
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
        serviceFormat: row.service_format ?? null,
        languagesSupported: (row.languages_supported as string[] | null) ?? null,
      }));
    } catch (err) {
      // Fallback to basic search if optimized function doesn't exist
      console.warn('[FastSearch] Optimized function not available, using fallback');
      return this.fallbackSearch(query, location, limit);
    }
  }

  /**
   * Fallback search when optimized SQL functions aren't available
   * Uses basic ILIKE matching (less efficient but works without migrations)
   * Now splits query into keywords for better matching
   * SECURITY: Uses parameterized queries to prevent SQL injection
   */
  private async fallbackSearch(
    query: string,
    location: string | null,
    limit: number
  ): Promise<FastSearchResult[]> {
    // Split query into keywords (filter out short words and common stop words)
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of', 'and', 'or', 'in', 'on', 'at', 'for', 'my', 'i', 'me', 'we', 'you', 'he', 'she', 'it', 'they']);
    const keywords = query.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length >= 3 && !stopWords.has(w));

    // If no valid keywords, use the original query
    const searchTerms = keywords.length > 0 ? keywords : [query.toLowerCase()];

    // Build safe WHERE conditions using parameterized queries
    const keywordConditions = searchTerms.map(term => {
      const pattern = '%' + term + '%';
      return sql`(lower(name) LIKE ${pattern} OR lower(category) LIKE ${pattern} OR lower(description) LIKE ${pattern} OR tags::text ILIKE ${pattern})`;
    });

    // Build safe scoring expressions
    const keywordScoring = searchTerms.map(term => {
      const pattern = '%' + term + '%';
      return sql`(CASE WHEN lower(name) LIKE ${pattern} THEN 100 ELSE 0 END + CASE WHEN lower(category) LIKE ${pattern} THEN 50 ELSE 0 END + CASE WHEN lower(description) LIKE ${pattern} THEN 30 ELSE 0 END + CASE WHEN tags::text ILIKE ${pattern} THEN 40 ELSE 0 END)`;
    });

    // Build safe location filter using parameterized queries
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
      serviceFormat: row.service_format ?? null,
      languagesSupported: (row.languages_supported as string[] | null) ?? null,
    }));
  }

  /**
   * Batch fetch enrichments for multiple services (avoids N+1)
   * Single query to get all enrichments at once
   * SECURITY: Uses Drizzle's inArray for safe parameterized queries
   */
  async getEnrichmentsBatch(serviceIds: string[]): Promise<Map<string, EnrichmentData>> {
    if (serviceIds.length === 0) return new Map();

    // Use Drizzle's inArray for safe parameterized query
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

  /**
   * Batch fetch confidence scores for data quality boosting.
   * Returns a Map of serviceId -> confidenceScore (only non-null entries).
   * Uses an in-memory cache (1-hour TTL) since scores only change on scraper runs.
   */
  private _confidenceCache: Map<string, number> | null = null;
  private _confidenceCacheTime = 0;
  private _confidenceCachePromise: Promise<Map<string, number>> | null = null;
  private static readonly CONFIDENCE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

  async getConfidenceScores(serviceIds: string[]): Promise<Map<string, number>> {
    if (serviceIds.length === 0) return new Map();

    // Refresh full cache if stale
    const now = Date.now();
    if (!this._confidenceCache || (now - this._confidenceCacheTime) > DatabaseStorage.CONFIDENCE_CACHE_TTL) {
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
            const map = new Map<string, number>();
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

    // Filter to requested IDs from the full cache
    const full = this._confidenceCache!;
    const map = new Map<string, number>();
    for (const id of serviceIds) {
      const score = full.get(id);
      if (score !== undefined) map.set(id, score);
    }
    return map;
  }

  /** Invalidate the confidence score cache — call after admin edits that change scores */
  invalidateConfidenceCache(): void {
    this._confidenceCache = null;
    this._confidenceCacheTime = 0;
  }

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

  /**
   * Fetch active services from the same organization (name prefix before " — ").
   * Used for "similar services" feature when a user searches for a specific org.
   */
  async getServicesByOrg(orgPrefix: string): Promise<Service[]> {
    return db
      .select()
      .from(services)
      .where(
        and(
          eq(services.isActive, true),
          ilike(services.name, `${orgPrefix} — %`),
        )
      )
      .limit(10);
  }

  /**
   * Check if optimized search infrastructure is available
   */
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

  /**
   * Refresh the materialized view (call after scraper runs)
   */
  async refreshSearchView(): Promise<void> {
    try {
      await db.execute(sql`SELECT refresh_search_view()`);
      console.log('[Search] Materialized view refreshed');
    } catch (err) {
      console.warn('[Search] Failed to refresh materialized view:', err);
    }
  }

  /**
   * Clear the search cache (call after service changes)
   * Removes all cached search results so fresh queries will be executed
   */
  async clearSearchCache(): Promise<void> {
    try {
      await db.delete(searches);
      console.log('[Search] Search cache cleared');
    } catch (err) {
      console.warn('[Search] Failed to clear search cache:', err);
    }
  }

  /**
   * Clear stale search cache entries older than maxAgeDays
   * Returns the number of entries deleted
   */
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

  /**
   * Auto-refresh search infrastructure after a service change.
   * Re-embeds (if content changed), refreshes the materialized view,
   * and clears the search cache. Runs async — callers should .catch(() => {}).
   */
  private async _refreshSearchInfrastructure(serviceId: number, serviceStringId: string, contentChanged: boolean): Promise<void> {
    try {
      // Re-generate embedding if content changed (name, description, eligibility, etc.)
      if (contentChanged) {
        try {
          const { generateEmbedding } = await import('../helpers/embedding');
          const svc = await this.getAdminServiceDetail(serviceId);
          if (svc) {
            const embedding = await generateEmbedding(svc);
            const embeddingStr = `[${embedding.join(',')}]`;
            await db.execute(
              sql`UPDATE services SET embedding = ${embeddingStr}::vector, embedding_updated_at = NOW() WHERE id = ${serviceId}`
            );
            console.log(`[SearchRefresh] Re-embedded service ${serviceStringId}`);
          }
        } catch (embedErr) {
          console.warn(`[SearchRefresh] Embedding failed for ${serviceStringId}:`, embedErr);
          // Not fatal — search still works via SQL
        }
      }

      // Refresh materialized view so SQL search picks up changes
      await this.refreshSearchView();

      // Clear search cache so stale results aren't served
      await this.clearSearchCache();

      console.log(`[SearchRefresh] Infrastructure refreshed for ${serviceStringId}`);
    } catch (err) {
      console.warn(`[SearchRefresh] Failed for ${serviceStringId}:`, err);
    }
  }

  // ============= PRECOMPUTED SEARCH CACHE =============

  /**
   * Get precomputed search results for popular queries
   * Returns null if not found or stale (>24 hours old)
   */
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

  /**
   * Save precomputed search results
   */
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

  /**
   * Log a query that returned zero results
   * Increments count if query already exists
   */
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

  /**
   * Get top failed queries for analysis
   */
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

  // ============= SEARCH QUALITY METRICS =============

  /**
   * Record a new search for quality tracking
   * Returns the metric ID for later updates
   */
  async recordSearchQuality(data: {
    sessionId?: string;
    query: string;
    queryNormalized: string;
    resultCount: number;
  }): Promise<number | null> {
    try {
      const result = await db.execute(sql`
        INSERT INTO search_quality_metrics (session_id, query, query_normalized, result_count)
        VALUES (${data.sessionId || null}, ${data.query}, ${data.queryNormalized}, ${data.resultCount})
        RETURNING id
      `);
      return (result.rows[0] as any)?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Update search quality metrics (e.g., when user clicks)
   */
  async updateSearchQuality(id: number, data: {
    firstClickPosition?: number;
    clickCount?: number;
    dwellTimeMs?: number;
    reformulated?: boolean;
  }): Promise<void> {
    try {
      const setClauses: SQL[] = [];
      if (data.firstClickPosition !== undefined) {
        setClauses.push(sql`first_click_position = ${data.firstClickPosition}`);
      }
      if (data.clickCount !== undefined) {
        setClauses.push(sql`click_count = ${data.clickCount}`);
      }
      if (data.dwellTimeMs !== undefined) {
        setClauses.push(sql`dwell_time_ms = ${data.dwellTimeMs}`);
      }
      if (data.reformulated !== undefined) {
        setClauses.push(sql`reformulated = ${data.reformulated}`);
      }
      if (setClauses.length > 0) {
        await db.execute(sql`
          UPDATE search_quality_metrics
          SET ${sql.join(setClauses, sql`, `)}
          WHERE id = ${id}
        `);
      }
    } catch (err) {
      console.warn('[Quality] Failed to update metrics:', err);
    }
  }

  /**
   * Get search quality report for the last N days
   */
  async getSearchQualityReport(days: number = 7): Promise<{
    totalSearches: number;
    avgFirstClickPosition: number;
    reformulationRate: number;
    zeroResultRate: number;
  }> {
    try {
      const result = await db.execute(sql`SELECT * FROM get_search_quality_report(${days})`);
      const row = result.rows[0] as any;
      return {
        totalSearches: Number(row?.total_searches) || 0,
        avgFirstClickPosition: Number(row?.avg_first_click) || 0,
        reformulationRate: Number(row?.reformulation_rate) || 0,
        zeroResultRate: Number(row?.zero_result_rate) || 0,
      };
    } catch (err) {
      console.error('[storage] getSearchQualityReport error:', err);
      return {
        totalSearches: 0,
        avgFirstClickPosition: 0,
        reformulationRate: 0,
        zeroResultRate: 0,
      };
    }
  }

  async createServiceVote(serviceId: string, vote: 'up' | 'down', queryContext?: string): Promise<void> {
    await db.insert(serviceVotes).values({ serviceId, vote, queryContext: queryContext ?? null });
  }

  // ============= ADMIN: SERVICE CRUD =============

  /**
   * Generate a URL-safe slug from a service name.
   * E.g., "Alberta Health Services — Mental Health" -> "alberta-health-services-mental-health"
   */
  private generateServiceSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[—–]/g, '-')        // em-dash, en-dash → hyphen
      .replace(/[^a-z0-9\s-]/g, '') // strip non-alphanumeric
      .replace(/\s+/g, '-')         // spaces → hyphens
      .replace(/-+/g, '-')          // collapse multiple hyphens
      .replace(/^-|-$/g, '')        // trim leading/trailing hyphens
      .substring(0, 200);           // cap length
  }

  async createService(data: Partial<Service> & { name: string; category: string }): Promise<Service> {
    const now = new Date();
    const baseSlug = this.generateServiceSlug(data.name);

    // Ensure unique slug by appending a counter if needed
    let slug = baseSlug;
    let attempt = 0;
    while (true) {
      const existing = await db.select({ id: services.id }).from(services).where(eq(services.serviceId, slug)).limit(1);
      if (existing.length === 0) break;
      attempt++;
      slug = `${baseSlug}-${attempt}`;
    }

    const [created] = await db.insert(services).values({
      serviceId: slug,
      name: data.name,
      category: data.category,
      description: data.description ?? null,
      location: data.location ?? 'Alberta',
      contact: data.contact ?? null,
      eligibility: data.eligibility ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      processSteps: data.processSteps ?? null,
      waitTimes: data.waitTimes ?? null,
      requiredDocs: data.requiredDocs ?? null,
      hoursOfOperation: data.hoursOfOperation ?? null,
      languagesSupported: data.languagesSupported ?? null,
      serviceFormat: data.serviceFormat ?? null,
      websiteUrl: data.websiteUrl ?? null,
      confidenceScore: data.confidenceScore ?? 70,
      isActive: true,
      lastChecked: now,
      lastUpdated: now,
      tags: data.tags ?? null,
      genderRestriction: data.genderRestriction ?? null,
      ageGroup: data.ageGroup ?? 'all_ages',
      isFaithBased: data.isFaithBased ?? false,
      is12Step: data.is12Step ?? false,
      is24_7: data.is24_7 ?? false,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
    }).returning();

    // Log to service_history
    await db.insert(serviceHistory).values({
      serviceId: slug,
      name: created.name,
      category: created.category,
      description: created.description,
      location: created.location,
      contact: created.contact,
      eligibility: created.eligibility,
      processSteps: created.processSteps,
      waitTimes: created.waitTimes,
      requiredDocs: created.requiredDocs,
      hoursOfOperation: created.hoursOfOperation,
      languagesSupported: created.languagesSupported,
      serviceFormat: created.serviceFormat,
      websiteUrl: created.websiteUrl,
      changedFields: { all: 'initial creation' },
      changeType: 'created',
      confidenceScore: created.confidenceScore,
    });

    return created;
  }

  async updateService(id: number, changes: Partial<Service>, reason?: string): Promise<Service> {
    // Get current service to detect which fields actually changed
    const [current] = await db.select().from(services).where(eq(services.id, id));
    if (!current) throw new Error(`Service with id ${id} not found`);

    const now = new Date();

    // Detect changed fields
    const changedFields: Record<string, { from: any; to: any }> = {};
    for (const [key, newVal] of Object.entries(changes)) {
      if (key === 'id' || key === 'serviceId' || key === 'lastUpdated') continue;
      const oldVal = (current as any)[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changedFields[key] = { from: oldVal, to: newVal };
      }
    }

    // No actual changes — return current service without bumping lastUpdated
    if (Object.keys(changedFields).length === 0) {
      return current;
    }

    // Ensure geocodedAt uses the same timestamp as lastUpdated so quality checks pass
    if ('geocodedAt' in changes) {
      (changes as any).geocodedAt = now;
    }

    // Admin edit upgrades: when key fields are manually edited, promote confidence
    // and clear AI-inferred flags so the service reflects human-verified data.
    const contentFields = new Set(['name', 'description', 'eligibility', 'processSteps', 'hoursOfOperation', 'phone', 'email', 'websiteUrl', 'address']);
    const editedContentFields = Object.keys(changedFields).filter(k => contentFields.has(k));

    if (editedContentFields.length > 0) {
      // Recalculate confidence based on field completeness after this edit
      const merged = { ...current, ...changes };
      let score = 50; // base
      if (merged.phone) score += 10;
      if (merged.email) score += 5;
      if (merged.websiteUrl) score += 5;
      if (merged.description && String(merged.description).length > 50) score += 10;
      if (merged.eligibility) score += 5;
      if (merged.processSteps && JSON.stringify(merged.processSteps) !== '[]' && JSON.stringify(merged.processSteps) !== 'null') score += 5;
      if (merged.hoursOfOperation) score += 5;
      if (merged.address) score += 5;
      changes.confidenceScore = Math.min(100, score);
      this.invalidateConfidenceCache();

      // Clear process_steps_inferred if admin edited process steps
      if ('processSteps' in changedFields) {
        (changes as any).processStepsInferred = false;
      }

      // Clear AI enrichment fields that the admin has overwritten
      const aiFieldMap: Record<string, string> = {
        description: 'ai_description',
        eligibility: 'ai_eligibility',
        processSteps: 'ai_process_steps',
        hoursOfOperation: 'ai_wait_times', // closest AI field
      };
      const aiClears: string[] = [];
      for (const field of editedContentFields) {
        if (aiFieldMap[field]) aiClears.push(aiFieldMap[field]);
      }
      if (aiClears.length > 0) {
        // Clear AI fields that admin has overwritten — use allowlisted column names only
        // ai_description and ai_process_steps are NOT NULL, so use empty/[] instead of NULL
        const notNullCols = new Set(['ai_description', 'ai_process_steps']);
        const allowedCols = new Set(['ai_description', 'ai_eligibility', 'ai_process_steps', 'ai_wait_times']);
        const safeCols = aiClears.filter(c => allowedCols.has(c));
        if (safeCols.length > 0) {
          const setClauses = safeCols.map(f =>
            notNullCols.has(f)
              ? (f === 'ai_process_steps' ? `${f} = '[]'::json` : `${f} = ''`)
              : `${f} = NULL`
          ).join(', ');
          await db.execute(sql`UPDATE ai_service_enrichments SET ${sql.raw(setClauses)} WHERE service_id = ${current.serviceId}`);
        }
      }
    }

    // Apply update
    const [updated] = await db.update(services)
      .set({ ...changes, lastUpdated: now })
      .where(eq(services.id, id))
      .returning();

    // Log to service_history if anything actually changed
    if (Object.keys(changedFields).length > 0) {
      await db.insert(serviceHistory).values({
        serviceId: current.serviceId,
        name: updated.name,
        category: updated.category,
        description: updated.description,
        location: updated.location,
        contact: updated.contact,
        eligibility: updated.eligibility,
        processSteps: updated.processSteps,
        waitTimes: updated.waitTimes,
        requiredDocs: updated.requiredDocs,
        hoursOfOperation: updated.hoursOfOperation,
        languagesSupported: updated.languagesSupported,
        serviceFormat: updated.serviceFormat,
        websiteUrl: updated.websiteUrl,
        changedFields: reason ? { ...changedFields, _reason: reason } : changedFields,
        changeType: 'updated',
        confidenceScore: updated.confidenceScore,
      });

      // Auto-refresh search infrastructure when service content or activation changes.
      // Runs async (fire-and-forget) so the API response isn't delayed.
      const activationChanged = 'isActive' in changedFields;
      const contentChanged = editedContentFields.length > 0;
      if (activationChanged || contentChanged) {
        this._refreshSearchInfrastructure(updated.id, updated.serviceId, contentChanged).catch(() => {});
      }
    }

    return updated;
  }

  async deactivateService(id: number, reason: string): Promise<Service> {
    const [current] = await db.select().from(services).where(eq(services.id, id));
    if (!current) throw new Error(`Service with id ${id} not found`);

    const now = new Date();
    const [updated] = await db.update(services)
      .set({ isActive: false, lastUpdated: now })
      .where(eq(services.id, id))
      .returning();

    await db.insert(serviceHistory).values({
      serviceId: current.serviceId,
      name: updated.name,
      category: updated.category,
      description: updated.description,
      location: updated.location,
      contact: updated.contact,
      eligibility: updated.eligibility,
      processSteps: updated.processSteps,
      waitTimes: updated.waitTimes,
      requiredDocs: updated.requiredDocs,
      hoursOfOperation: updated.hoursOfOperation,
      languagesSupported: updated.languagesSupported,
      serviceFormat: updated.serviceFormat,
      websiteUrl: updated.websiteUrl,
      changedFields: { reason, isActive: { from: true, to: false } },
      changeType: 'deactivated',
      confidenceScore: updated.confidenceScore,
    });

    // Refresh search infrastructure — remove deactivated service from results
    this._refreshSearchInfrastructure(updated.id, updated.serviceId, false).catch(() => {});

    return updated;
  }

  async restoreService(id: number): Promise<Service> {
    const [current] = await db.select().from(services).where(eq(services.id, id));
    if (!current) throw new Error(`Service with id ${id} not found`);

    const now = new Date();
    const [updated] = await db.update(services)
      .set({ isActive: true, lastUpdated: now })
      .where(eq(services.id, id))
      .returning();

    await db.insert(serviceHistory).values({
      serviceId: current.serviceId,
      name: updated.name,
      category: updated.category,
      description: updated.description,
      location: updated.location,
      contact: updated.contact,
      eligibility: updated.eligibility,
      processSteps: updated.processSteps,
      waitTimes: updated.waitTimes,
      requiredDocs: updated.requiredDocs,
      hoursOfOperation: updated.hoursOfOperation,
      languagesSupported: updated.languagesSupported,
      serviceFormat: updated.serviceFormat,
      websiteUrl: updated.websiteUrl,
      changedFields: { isActive: { from: false, to: true } },
      changeType: 'restored',
      confidenceScore: updated.confidenceScore,
    });

    // Refresh search infrastructure — re-include restored service in results
    this._refreshSearchInfrastructure(updated.id, updated.serviceId, false).catch(() => {});

    return updated;
  }

  async getServiceHistory(serviceId: number): Promise<ServiceHistory[]> {
    // Look up the string slug from the integer id
    const [svc] = await db.select({ serviceId: services.serviceId }).from(services).where(eq(services.id, serviceId));
    if (!svc) return [];

    return await db.select().from(serviceHistory)
      .where(eq(serviceHistory.serviceId, svc.serviceId))
      .orderBy(desc(serviceHistory.recordedAt))
      .limit(100);
  }

  async getAdminServices(params: {
    q?: string;
    category?: string;
    status?: 'active' | 'inactive' | 'all';
    location?: string;
    hasEmbedding?: boolean;
    hasGeocoding?: boolean;
    enrichmentSource?: string;
    page?: number;
    limit?: number;
    sort?: 'name' | 'category' | 'confidence' | 'lastUpdated' | 'clickCount' | 'location' | 'enrichmentSource';
    order?: 'asc' | 'desc';
  }): Promise<{ services: Service[]; total: number }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const conditions: SQL[] = [];

    // Status filter
    if (params.status === 'active') {
      conditions.push(eq(services.isActive, true));
    } else if (params.status === 'inactive') {
      conditions.push(eq(services.isActive, false));
    }
    // 'all' or undefined → no status filter

    // Text search
    if (params.q) {
      const term = `%${params.q}%`;
      conditions.push(
        or(
          ilike(services.name, term),
          ilike(services.category, term),
          ilike(services.location, term),
        )!
      );
    }

    // Category filter
    if (params.category) {
      conditions.push(eq(services.category, params.category));
    }

    // Location filter
    if (params.location) {
      conditions.push(ilike(services.location, `%${params.location}%`));
    }

    // Embedding filter (raw SQL since embedding isn't in Drizzle schema)
    if (params.hasEmbedding === true) {
      conditions.push(sql`embedding IS NOT NULL`);
    } else if (params.hasEmbedding === false) {
      conditions.push(sql`embedding IS NULL`);
    }

    // Geocoding filter
    if (params.hasGeocoding === true) {
      conditions.push(isNotNull(services.latitude));
    } else if (params.hasGeocoding === false) {
      conditions.push(isNull(services.latitude));
    }

    // Enrichment source filter
    if (params.enrichmentSource === 'ai_enriched') {
      conditions.push(sql`EXISTS (SELECT 1 FROM ai_service_enrichments WHERE ai_service_enrichments.service_id = services.service_id)`);
    } else if (params.enrichmentSource === 'none') {
      conditions.push(isNull(services.enrichmentSource));
    } else if (params.enrichmentSource) {
      conditions.push(eq(services.enrichmentSource, params.enrichmentSource));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Determine sort column and order
    let orderExpr: SQL;
    const sortDir = params.order === 'asc' ? asc : desc;
    switch (params.sort) {
      case 'name':
        orderExpr = sortDir(services.name);
        break;
      case 'category':
        orderExpr = sortDir(services.category);
        break;
      case 'confidence':
        orderExpr = sortDir(services.confidenceScore);
        break;
      case 'lastUpdated':
        orderExpr = sortDir(services.lastUpdated);
        break;
      case 'clickCount':
        orderExpr = sortDir(services.clickCount);
        break;
      case 'location':
        orderExpr = sortDir(services.location);
        break;
      case 'enrichmentSource':
        orderExpr = sortDir(services.enrichmentSource);
        break;
      default:
        orderExpr = desc(services.lastUpdated);
    }

    // Run count and data queries in parallel
    const [countResult, dataResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(services).where(whereClause),
      db.select().from(services).where(whereClause).orderBy(orderExpr).limit(limit).offset(offset),
    ]);

    return {
      services: dataResult,
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  async getAdminServiceDetail(id: number): Promise<Service | null> {
    const [svc] = await db.select().from(services).where(eq(services.id, id));
    return svc ?? null;
  }

  // ============= ADMIN: BULK OPERATIONS =============

  async bulkUpdateServices(ids: number[], changes: Partial<Service>, reason?: string): Promise<number> {
    let successCount = 0;
    for (const id of ids) {
      try {
        await this.updateService(id, changes, reason);
        successCount++;
      } catch (err) {
        console.warn(`[Admin] bulkUpdateServices: failed to update service ${id}:`, err);
      }
    }
    return successCount;
  }

  async bulkDeactivateServices(ids: number[], reason: string): Promise<number> {
    let successCount = 0;
    for (const id of ids) {
      try {
        await this.deactivateService(id, reason);
        successCount++;
      } catch (err) {
        console.warn(`[Admin] bulkDeactivateServices: failed to deactivate service ${id}:`, err);
      }
    }
    return successCount;
  }

  // ============= ADMIN: REVIEW QUEUE =============

  async createChangeRequest(data: InsertServiceChangeRequest): Promise<ServiceChangeRequest> {
    const [created] = await db.insert(serviceChangeRequests).values(data).returning();
    return created;
  }

  async getChangeRequests(params: {
    status?: string;
    source?: string;
    changeType?: string;
    batchId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ requests: ServiceChangeRequest[]; total: number }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 500;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];

    if (params.status) {
      conditions.push(eq(serviceChangeRequests.status, params.status));
    }
    if (params.source) {
      conditions.push(eq(serviceChangeRequests.source, params.source));
    }
    if (params.changeType) {
      conditions.push(eq(serviceChangeRequests.changeType, params.changeType));
    }
    if (params.batchId) {
      conditions.push(eq(serviceChangeRequests.batchId, params.batchId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, dataResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(serviceChangeRequests).where(whereClause),
      db.select().from(serviceChangeRequests).where(whereClause)
        .orderBy(desc(serviceChangeRequests.submittedAt))
        .limit(limit).offset(offset),
    ]);

    return {
      requests: dataResult,
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  async getChangeRequestById(id: number): Promise<ServiceChangeRequest | null> {
    const [req] = await db.select().from(serviceChangeRequests).where(eq(serviceChangeRequests.id, id));
    return req ?? null;
  }

  async updateChangeRequest(id: number, changes: Partial<ServiceChangeRequest>): Promise<ServiceChangeRequest> {
    const [updated] = await db.update(serviceChangeRequests)
      .set(changes)
      .where(eq(serviceChangeRequests.id, id))
      .returning();
    if (!updated) throw new Error(`Change request with id ${id} not found`);
    return updated;
  }

  async approveChangeRequest(id: number, reviewedBy?: string): Promise<Service> {
    const req = await this.getChangeRequestById(id);
    if (!req) throw new Error(`Change request with id ${id} not found`);
    if (req.status !== 'pending') throw new Error(`Change request ${id} is not pending (status: ${req.status})`);

    let resultService: Service;
    const proposed = req.proposedChanges as Record<string, any>;

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
        // When approving, always activate the service (review pipeline = approving for go-live)
        // Strip non-column fields and map form fields to DB columns
        const allowedFields = new Set([
          'name', 'category', 'description', 'location', 'eligibility',
          'processSteps', 'waitTimes', 'requiredDocs', 'hoursOfOperation',
          'languagesSupported', 'serviceFormat', 'websiteUrl', 'phone', 'email',
          'address', 'genderRestriction', 'ageGroup', 'isFaithBased', 'is12Step',
          'is24_7', 'tags', 'confidenceScore',
        ]);
        // Fields with DB CHECK constraints — empty string must become null
        const constrainedFields = new Set(['ageGroup', 'genderRestriction']);
        const updateFields: Record<string, any> = { isActive: true };
        for (const [key, val] of Object.entries(proposed)) {
          if (!allowedFields.has(key) || val === undefined) continue;
          // Convert empty strings to null for CHECK-constrained fields
          if (constrainedFields.has(key) && val === '') {
            updateFields[key] = null;
          } else {
            updateFields[key] = val;
          }
        }
        resultService = await this.updateService(req.serviceId, updateFields as Partial<Service>);
        break;
      }
      case 'deactivate': {
        if (!req.serviceId) throw new Error(`Change request ${id} has no serviceId for deactivation`);
        resultService = await this.deactivateService(req.serviceId, proposed.reason || 'Approved via review queue');
        break;
      }
      case 'review':
        throw new Error(`Review requests (id ${id}) cannot be approved directly — edit the service and resolve the review manually`);
      default:
        throw new Error(`Unknown changeType: ${req.changeType}`);
    }

    // Mark the change request as approved
    await this.updateChangeRequest(id, {
      status: 'approved',
      reviewedAt: new Date(),
      reviewedBy: reviewedBy ?? 'admin',
    });

    return resultService;
  }

  async rejectChangeRequest(id: number, reason: string, reviewedBy?: string): Promise<void> {
    const req = await this.getChangeRequestById(id);
    if (!req) throw new Error(`Change request with id ${id} not found`);

    await this.updateChangeRequest(id, {
      status: 'rejected',
      reviewNotes: reason,
      reviewedAt: new Date(),
      reviewedBy: reviewedBy ?? 'admin',
    });
  }

  async bulkApproveChangeRequests(ids: number[], reviewedBy?: string): Promise<number> {
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

  // ============= ADMIN: QUALITY =============

  async getQualitySummary(): Promise<Record<string, number>> {
    const result = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone != '') * 100.0 / NULLIF(COUNT(*), 0) AS phone,
        COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '') * 100.0 / NULLIF(COUNT(*), 0) AS email,
        COUNT(*) FILTER (WHERE website_url IS NOT NULL AND website_url != '') * 100.0 / NULLIF(COUNT(*), 0) AS "websiteUrl",
        COUNT(*) FILTER (WHERE address IS NOT NULL AND address != '') * 100.0 / NULLIF(COUNT(*), 0) AS address,
        COUNT(*) FILTER (WHERE description IS NOT NULL AND description != '') * 100.0 / NULLIF(COUNT(*), 0) AS description,
        COUNT(*) FILTER (WHERE hours_of_operation IS NOT NULL AND hours_of_operation != '') * 100.0 / NULLIF(COUNT(*), 0) AS "hoursOfOperation",
        COUNT(*) FILTER (WHERE eligibility IS NOT NULL AND eligibility != '') * 100.0 / NULLIF(COUNT(*), 0) AS eligibility,
        COUNT(*) FILTER (WHERE wait_times IS NOT NULL AND wait_times != '') * 100.0 / NULLIF(COUNT(*), 0) AS "waitTimes",
        COUNT(*) FILTER (WHERE service_format IS NOT NULL AND service_format != '') * 100.0 / NULLIF(COUNT(*), 0) AS "serviceFormat",
        COUNT(*) FILTER (WHERE process_steps IS NOT NULL AND process_steps::text != '[]' AND process_steps::text != 'null') * 100.0 / NULLIF(COUNT(*), 0) AS "processSteps",
        COUNT(*) FILTER (WHERE required_docs IS NOT NULL AND required_docs::text != '[]' AND required_docs::text != 'null') * 100.0 / NULLIF(COUNT(*), 0) AS "requiredDocs",
        COUNT(*) FILTER (WHERE languages_supported IS NOT NULL AND languages_supported::text != '[]' AND languages_supported::text != 'null') * 100.0 / NULLIF(COUNT(*), 0) AS "languagesSupported",
        COUNT(*) FILTER (WHERE latitude IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0) AS latitude,
        COUNT(*) FILTER (WHERE tags IS NOT NULL AND tags::text != '[]' AND tags::text != 'null') * 100.0 / NULLIF(COUNT(*), 0) AS tags,
        COUNT(*) FILTER (WHERE embedding IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0) AS embedding,
        -- % of services with embeddings that are up-to-date (embedding_updated_at >= last_updated)
        COUNT(*) FILTER (WHERE embedding IS NOT NULL AND (embedding_updated_at IS NULL OR embedding_updated_at >= last_updated)) * 100.0 / NULLIF(COUNT(*) FILTER (WHERE embedding IS NOT NULL), 0) AS "embeddingFresh",
        -- % of geocoded services that are up-to-date
        COUNT(*) FILTER (WHERE latitude IS NOT NULL AND (geocoded_at IS NULL OR geocoded_at >= last_updated)) * 100.0 / NULLIF(COUNT(*) FILTER (WHERE latitude IS NOT NULL), 0) AS "geocodingFresh"
      FROM services
      WHERE is_active = true
    `);

    const row = result.rows[0] as any;
    const summary: Record<string, number> = {};
    for (const field of ['phone', 'email', 'websiteUrl', 'address', 'description', 'hoursOfOperation', 'eligibility', 'waitTimes', 'serviceFormat', 'processSteps', 'requiredDocs', 'languagesSupported', 'latitude', 'tags', 'embedding', 'embeddingFresh', 'geocodingFresh']) {
      summary[field] = Math.round(Number(row?.[field] ?? 0) * 10) / 10;
    }
    return summary;
  }

  async getQualityIssues(params: {
    page?: number;
    limit?: number;
    fieldFilter?: string;
    severityFilter?: string;
  }): Promise<{ issues: { service: Service; severity: string; missingFields: string[] }[]; total: number }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const offset = (page - 1) * limit;

    // Map field filter values to SQL conditions (for server-side filtering)
    const FIELD_SQL: Record<string, string> = {
      phone: "(phone IS NULL OR phone = '')",
      email: "(email IS NULL OR email = '')",
      noContact: "((phone IS NULL OR phone = '') AND (email IS NULL OR email = ''))",
      websiteUrl: "(website_url IS NULL OR website_url = '')",
      name: "(name IS NULL OR name = '')",
      description: "(description IS NULL OR description = '')",
      eligibility: "(eligibility IS NULL OR eligibility = '')",
      address: "(address IS NULL OR address = '')",
      lowConfidence: "confidence_score < 30",
      hoursOfOperation: "(hours_of_operation IS NULL OR hours_of_operation = '')",
      waitTimes: "(wait_times IS NULL OR wait_times = '')",
      serviceFormat: "(service_format IS NULL OR service_format = '')",
      processSteps: "(process_steps IS NULL OR process_steps::text = '[]' OR process_steps::text = 'null')",
      requiredDocs: "(required_docs IS NULL OR required_docs::text = '[]' OR required_docs::text = 'null')",
      languagesSupported: "(languages_supported IS NULL OR languages_supported::text = '[]' OR languages_supported::text = 'null')",
      tags: "(tags IS NULL OR tags::text = '[]' OR tags::text = 'null')",
      // "Fresh" = has the data AND it's up-to-date; NOT fresh = missing OR stale
      freshEmbedding: "(embedding IS NULL OR (embedding_updated_at IS NOT NULL AND last_updated > embedding_updated_at))",
      freshGeocoding: "(latitude IS NULL OR (geocoded_at IS NOT NULL AND last_updated > geocoded_at))",
      // Legacy individual filters still useful for drilling down
      latitude: "latitude IS NULL",
      embedding: "embedding IS NULL",
      staleEmbedding: "(embedding IS NOT NULL AND embedding_updated_at IS NOT NULL AND last_updated > embedding_updated_at)",
      staleGeocoding: "(latitude IS NOT NULL AND geocoded_at IS NOT NULL AND last_updated > geocoded_at)",
    };

    const SEVERITY_SQL: Record<string, string> = {
      critical: "((phone IS NULL OR phone = '') AND (email IS NULL OR email = ''))",
      high: "(description IS NULL OR description = '')",
      medium: "NOT ((phone IS NULL OR phone = '') AND (email IS NULL OR email = '')) AND NOT (description IS NULL OR description = '')",
    };

    // Build extra WHERE conditions from filters
    const extraConditions: string[] = [];
    if (params.fieldFilter && FIELD_SQL[params.fieldFilter]) {
      extraConditions.push(FIELD_SQL[params.fieldFilter]);
    }
    if (params.severityFilter && SEVERITY_SQL[params.severityFilter]) {
      extraConditions.push(SEVERITY_SQL[params.severityFilter]);
    }
    const extraWhere = extraConditions.length > 0
      ? `AND ${extraConditions.join(' AND ')}`
      : '';

    // A service is flagged if:
    //   1. Missing any of the 14 required fields, OR
    //   2. Missing ALL contact (no phone AND no email)
    const baseWhere = `is_active = true
        AND (
          -- Required field: name/title
          (name IS NULL OR name = '')
          -- Required field: description
          OR (description IS NULL OR description = '')
          -- Required field: eligibility
          OR (eligibility IS NULL OR eligibility = '')
          -- Required field: process steps
          OR (process_steps IS NULL OR process_steps::text = '[]' OR process_steps::text = 'null')
          -- Required field: wait times
          OR (wait_times IS NULL OR wait_times = '')
          -- Required field: required documents
          OR (required_docs IS NULL OR required_docs::text = '[]' OR required_docs::text = 'null')
          -- Required field: hours of operation
          OR (hours_of_operation IS NULL OR hours_of_operation = '')
          -- Required field: service format
          OR (service_format IS NULL OR service_format = '')
          -- Required field: tags
          OR (tags IS NULL OR tags::text = '[]' OR tags::text = 'null')
          -- Required field: address
          OR (address IS NULL OR address = '')
          -- Required field: languages
          OR (languages_supported IS NULL OR languages_supported::text = '[]' OR languages_supported::text = 'null')
          -- Required field: website
          OR (website_url IS NULL OR website_url = '')
          -- Required field: fresh embedding (must exist AND be up-to-date)
          OR embedding IS NULL OR (embedding_updated_at IS NOT NULL AND last_updated > embedding_updated_at)
          -- Required field: fresh geotagging (must exist AND be up-to-date)
          OR latitude IS NULL OR (geocoded_at IS NOT NULL AND last_updated > geocoded_at)
          -- Missing ALL contact details (no phone AND no email)
          OR ((phone IS NULL OR phone = '') AND (email IS NULL OR email = ''))
        )`;

    // Query active services that have quality issues, ordered by confidence ASC
    // Note: baseWhere and extraWhere are hardcoded SQL from constant maps, not user input
    const result = await db.execute(sql`
      SELECT *,
        CASE
          WHEN (phone IS NULL OR phone = '') AND (email IS NULL OR email = '') THEN 'critical'
          WHEN (description IS NULL OR description = '') THEN 'high'
          ELSE 'medium'
        END AS severity_level
      FROM services
      WHERE ${sql.raw(baseWhere)}
        ${sql.raw(extraWhere)}
      ORDER BY
        CASE
          WHEN (phone IS NULL OR phone = '') AND (email IS NULL OR email = '') THEN 1
          WHEN (description IS NULL OR description = '') THEN 2
          ELSE 3
        END,
        COALESCE(confidence_score, 999) ASC
      LIMIT ${limit} OFFSET ${offset}
    `);

    // Get total count
    const countResult = await db.execute(sql`
      SELECT COUNT(*) AS total
      FROM services
      WHERE ${sql.raw(baseWhere)}
        ${sql.raw(extraWhere)}
    `);

    const issues = (result.rows as any[]).map(row => {
      const missingFields: string[] = [];

      // Contact fields (individually tracked for visibility)
      if (!row.phone) missingFields.push('phone');
      if (!row.email) missingFields.push('email');
      // Composite: no contact at all
      if (!row.phone && !row.email) missingFields.push('noContact');

      // 14 required fields
      if (!row.name) missingFields.push('name');
      if (!row.description) missingFields.push('description');
      if (!row.eligibility) missingFields.push('eligibility');
      if (!row.website_url) missingFields.push('websiteUrl');
      if (!row.address) missingFields.push('address');
      if (!row.hours_of_operation) missingFields.push('hoursOfOperation');
      if (!row.wait_times) missingFields.push('waitTimes');
      if (!row.service_format) missingFields.push('serviceFormat');
      const ps = row.process_steps;
      if (!ps || (typeof ps === 'string' ? ps === '[]' || ps === 'null' : Array.isArray(ps) && ps.length === 0)) missingFields.push('processSteps');
      const rd = row.required_docs;
      if (!rd || (typeof rd === 'string' ? rd === '[]' || rd === 'null' : Array.isArray(rd) && rd.length === 0)) missingFields.push('requiredDocs');
      const ls = row.languages_supported;
      if (!ls || (typeof ls === 'string' ? ls === '[]' || ls === 'null' : Array.isArray(ls) && ls.length === 0)) missingFields.push('languagesSupported');
      const tg = row.tags;
      if (!tg || (typeof tg === 'string' ? tg === '[]' || tg === 'null' : Array.isArray(tg) && tg.length === 0)) missingFields.push('tags');

      // Fresh embedding: must exist AND be up-to-date
      const hasEmbedding = !!row.embedding;
      const embeddingStale = hasEmbedding && row.embedding_updated_at && row.last_updated &&
          new Date(row.embedding_updated_at) < new Date(row.last_updated);
      if (!hasEmbedding || embeddingStale) missingFields.push('freshEmbedding');

      // Fresh geotagging: must exist AND be up-to-date
      const hasGeo = !!row.latitude;
      const geoStale = hasGeo && row.geocoded_at && row.last_updated &&
          new Date(row.geocoded_at) < new Date(row.last_updated);
      if (!hasGeo || geoStale) missingFields.push('freshGeocoding');

      // Non-flagging visibility fields (for data quality tracking only)
      if (row.confidence_score < 30) missingFields.push('lowConfidence');

      // Map raw row to Service shape
      const service: Service = {
        id: row.id,
        serviceId: row.service_id,
        name: row.name,
        category: row.category,
        description: row.description,
        location: row.location,
        contact: row.contact,
        eligibility: row.eligibility,
        phone: row.phone,
        email: row.email,
        address: row.address,
        processSteps: row.process_steps,
        waitTimes: row.wait_times,
        requiredDocs: row.required_docs,
        hoursOfOperation: row.hours_of_operation,
        languagesSupported: row.languages_supported,
        serviceFormat: row.service_format,
        websiteUrl: row.website_url,
        confidenceScore: row.confidence_score,
        isActive: row.is_active,
        lastChecked: row.last_checked,
        lastUpdated: row.last_updated,
        tags: row.tags,
        popularityScore: row.popularity_score,
        clickCount: row.click_count,
        enrichmentSource: row.enrichment_source,
        enrichmentDate: row.enrichment_date,
        sourcePageHash: row.source_page_hash,
        genderRestriction: row.gender_restriction,
        is24_7: row.is_24_7,
        ageGroup: row.age_group,
        isFaithBased: row.is_faith_based,
        is12Step: row.is_12_step,
        latitude: row.latitude,
        longitude: row.longitude,
        geocodeSource: row.geocode_source,
        geocodedAt: row.geocoded_at,
        embeddingUpdatedAt: row.embedding_updated_at,
        duplicateOf: row.duplicate_of ?? null,
      };

      return {
        service,
        severity: row.severity_level as string,
        missingFields,
      };
    });

    return {
      issues,
      total: Number((countResult.rows[0] as any)?.total ?? 0),
    };
  }

  // ============= ADMIN: DASHBOARD =============

  async getDashboardStats(): Promise<{ activeServices: number; pendingReviews: number; searchesToday: number; qualityScore: number }> {
    const [activeResult, pendingResult, searchResult, qualityResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(services).where(eq(services.isActive, true)),
      db.select({ count: sql<number>`count(*)` }).from(serviceChangeRequests).where(eq(serviceChangeRequests.status, 'pending')),
      db.execute(sql`
        SELECT COUNT(*) AS count FROM search_analytics
        WHERE created_at >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Edmonton')::date
      `),
      db.execute(sql`
        SELECT
          ROUND(AVG(
            CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 ELSE 0 END +
            CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END +
            CASE WHEN website_url IS NOT NULL AND website_url != '' THEN 1 ELSE 0 END +
            CASE WHEN description IS NOT NULL AND description != '' THEN 1 ELSE 0 END +
            CASE WHEN address IS NOT NULL AND address != '' THEN 1 ELSE 0 END +
            CASE WHEN hours_of_operation IS NOT NULL AND hours_of_operation != '' THEN 1 ELSE 0 END +
            CASE WHEN eligibility IS NOT NULL AND eligibility != '' THEN 1 ELSE 0 END +
            CASE WHEN latitude IS NOT NULL THEN 1 ELSE 0 END
          ) / 8.0 * 100, 1) AS quality_score
        FROM services WHERE is_active = true
      `),
    ]);

    return {
      activeServices: Number(activeResult[0]?.count ?? 0),
      pendingReviews: Number(pendingResult[0]?.count ?? 0),
      searchesToday: Number((searchResult.rows[0] as any)?.count ?? 0),
      qualityScore: Number((qualityResult.rows[0] as any)?.quality_score ?? 0),
    };
  }

  async getRecentActivity(limit: number = 20): Promise<any[]> {
    return await db
      .select({
        id: serviceHistory.id,
        serviceId: serviceHistory.serviceId,
        name: serviceHistory.name,
        category: serviceHistory.category,
        changeType: serviceHistory.changeType,
        changedFields: serviceHistory.changedFields,
        recordedAt: serviceHistory.recordedAt,
        confidenceScore: serviceHistory.confidenceScore,
        numericServiceId: services.id,
      })
      .from(serviceHistory)
      .leftJoin(services, eq(serviceHistory.serviceId, services.serviceId))
      .orderBy(desc(serviceHistory.recordedAt))
      .limit(limit);
  }

  // ============= ADMIN: SCRAPER =============

  async getScraperRuns(params: { page?: number; limit?: number }): Promise<{ runs: ScraperLog[]; total: number }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const offset = (page - 1) * limit;

    const [countResult, dataResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(scraperLogs),
      db.select().from(scraperLogs)
        .orderBy(desc(scraperLogs.startedAt))
        .limit(limit).offset(offset),
    ]);

    return {
      runs: dataResult,
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  async getScraperRunById(id: number): Promise<ScraperLog | null> {
    const [run] = await db.select().from(scraperLogs).where(eq(scraperLogs.id, id));
    return run ?? null;
  }
}
