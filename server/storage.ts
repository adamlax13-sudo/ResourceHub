import { db } from "./db";
import { searches, feedback, services, aiServiceEnrichments, searchAnalytics, serviceAliases, serviceVotes, type Search, type Feedback, type InsertFeedback, type Service, type AiServiceEnrichment, type SearchAnalytics, type ServiceAlias } from "@shared/schema";
import { eq, or, ilike, and, desc, inArray, sql, type SQL } from "drizzle-orm";

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

  // Batch confidence score lookup for data quality boosting
  getConfidenceScores(serviceIds: string[]): Promise<Map<string, number>>;

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
    const { buildEnrichmentUpdate } = await import('./helpers/enrichment');

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
            lastUpdated: new Date(), // Also track when last clicked for recency
          })
          .where(eq(services.serviceId, data.clickedServiceId));
      }
    });
  }

  async getClickCountForService(serviceId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(searchAnalytics)
      .where(eq(searchAnalytics.clickedServiceId, serviceId));
    return result[0]?.count ?? 0;
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
        locationFilter = sql`AND (lower(location) LIKE ${locPattern} OR lower(location) LIKE '%alberta%')`;
      } else if (locations.length > 1) {
        const locationClauses = locations.map(l => sql`lower(location) LIKE ${'%' + l + '%'}`);
        locationFilter = sql`AND (${sql.join(locationClauses, sql` OR `)} OR lower(location) LIKE '%alberta%')`;
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
   */
  async getConfidenceScores(serviceIds: string[]): Promise<Map<string, number>> {
    if (serviceIds.length === 0) return new Map();

    const result = await db
      .select({
        serviceId: services.serviceId,
        confidenceScore: services.confidenceScore,
      })
      .from(services)
      .where(inArray(services.serviceId, serviceIds));

    const map = new Map<string, number>();
    for (const row of result) {
      if (row.confidenceScore !== null) {
        map.set(row.serviceId, row.confidenceScore);
      }
    }
    return map;
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

  // ============= QUERY-SERVICE AFFINITY =============

  /**
   * Get affinity scores for services based on historical query performance
   * Returns services that users have clicked on for similar queries
   */
  async getQueryAffinities(
    queryPattern: string,
    serviceIds: string[]
  ): Promise<Array<{ serviceId: string; affinityScore: number }>> {
    if (serviceIds.length === 0) return [];

    try {
      const result = await db.execute(sql`
        SELECT service_id, affinity_score
        FROM query_service_affinity
        WHERE query_pattern = ${queryPattern}
          AND service_id = ANY(${serviceIds})
          AND affinity_score > 0.1
        ORDER BY affinity_score DESC
        LIMIT 20
      `);

      return (result.rows as any[]).map(r => ({
        serviceId: r.service_id as string,
        affinityScore: r.affinity_score as number,
      }));
    } catch (err) {
      console.error('[storage] getQueryAffinities error:', err);
      return [];
    }
  }

  /**
   * Record a click on a service for a given query pattern
   * Builds affinity over time
   */
  async recordQueryClick(queryPattern: string, serviceId: string): Promise<void> {
    try {
      await db.execute(sql`SELECT update_query_affinity(${queryPattern}, ${serviceId})`);
    } catch (err) {
      console.warn('[Affinity] Failed to record click:', err);
    }
  }

  /**
   * Record impressions for services appearing in search results
   */
  async recordQueryImpressions(queryPattern: string, serviceIds: string[]): Promise<void> {
    if (serviceIds.length === 0) return;
    try {
      await db.execute(sql`SELECT record_query_impressions(${queryPattern}, ${serviceIds})`);
    } catch (err) {
      console.warn('[Affinity] Failed to record impressions:', err);
    }
  }

  /**
   * Recompute all affinity scores (run periodically)
   */
  async computeAffinityScores(): Promise<void> {
    try {
      await db.execute(sql`SELECT compute_affinity_scores()`);
      console.log('[Affinity] Recomputed affinity scores');
    } catch (err) {
      console.warn('[Affinity] Failed to compute scores:', err);
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
}

export const storage = new DatabaseStorage();
