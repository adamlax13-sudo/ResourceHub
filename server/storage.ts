import { db } from "./db";
import { searches, feedback, services, aiServiceEnrichments, searchAnalytics, serviceAliases, type Search, type Feedback, type InsertFeedback, type Service, type AiServiceEnrichment, type SearchAnalytics, type ServiceAlias } from "@shared/schema";
import { eq, or, ilike, and, desc, inArray, sql } from "drizzle-orm";

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
  semanticSearch(queryEmbedding: number[], matchThreshold?: number, matchCount?: number): Promise<SemanticSearchResult[]>;
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

  // ============= OPTIMIZED TWO-STAGE SEARCH =============
  // Stage 1: Fast SQL-based search (uses indexes)
  fastSearch(query: string, location?: string | null, isLocationOnly?: boolean, limit?: number): Promise<FastSearchResult[]>;

  // Batch enrichment lookup (avoids N+1)
  getEnrichmentsBatch(serviceIds: string[]): Promise<Map<string, EnrichmentData>>;

  // Check if materialized view exists (for graceful fallback)
  hasOptimizedSearch(): Promise<boolean>;

  // Refresh materialized view (call after scraper)
  refreshSearchView(): Promise<void>;
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

  // ============= SEMANTIC (EMBEDDING) SEARCH =============
  async semanticSearch(
    queryEmbedding: number[],
    matchThreshold: number = 0.3,
    matchCount: number = 20
  ): Promise<SemanticSearchResult[]> {
    // Convert embedding array to PostgreSQL vector format
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

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
        1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM services
      WHERE is_active = true
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${embeddingStr}::vector) > ${matchThreshold}
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

  // ============= SEARCH ANALYTICS & CLICK TRACKING =============
  async trackSearchClick(data: {
    query: string;
    normalizedQuery: string;
    resultCount: number;
    clickedServiceId?: string;
    clickPosition?: number;
    sessionId?: string;
    userAgent?: string;
  }): Promise<void> {
    await db.insert(searchAnalytics).values({
      query: data.query,
      normalizedQuery: data.normalizedQuery,
      resultCount: data.resultCount,
      clickedServiceId: data.clickedServiceId || null,
      clickPosition: data.clickPosition || null,
      sessionId: data.sessionId || null,
      userAgent: data.userAgent || null,
    });

    // If a service was clicked, increment its click count
    if (data.clickedServiceId) {
      await db
        .update(services)
        .set({
          clickCount: sql`COALESCE(${services.clickCount}, 0) + 1`,
        })
        .where(eq(services.serviceId, data.clickedServiceId));
    }
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
  async getAliasLookup(): Promise<Map<string, string>> {
    const aliases = await db.select().from(serviceAliases);
    const map = new Map<string, string>();
    for (const alias of aliases) {
      map.set(alias.alias.toLowerCase(), alias.serviceId);
    }
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
   */
  private async fallbackSearch(
    query: string,
    location: string | null,
    limit: number
  ): Promise<FastSearchResult[]> {
    const queryLower = `%${query.toLowerCase()}%`;
    const locationLower = location ? `%${location.toLowerCase()}%` : null;

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
        (
          CASE WHEN lower(name) LIKE ${queryLower} THEN 100 ELSE 0 END +
          CASE WHEN lower(category) LIKE ${queryLower} THEN 50 ELSE 0 END +
          CASE WHEN lower(description) LIKE ${queryLower} THEN 30 ELSE 0 END +
          CASE WHEN tags::text ILIKE ${queryLower} THEN 40 ELSE 0 END +
          COALESCE(click_count, 0) * 2
        ) as relevance_score
      FROM services
      WHERE is_active = true
        AND (
          lower(name) LIKE ${queryLower}
          OR lower(category) LIKE ${queryLower}
          OR lower(description) LIKE ${queryLower}
          OR tags::text ILIKE ${queryLower}
        )
        ${locationLower ? sql`AND (lower(location) LIKE ${locationLower} OR lower(location) LIKE '%alberta%')` : sql``}
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
    }));
  }

  /**
   * Batch fetch enrichments for multiple services (avoids N+1)
   * Single query to get all enrichments at once
   */
  async getEnrichmentsBatch(serviceIds: string[]): Promise<Map<string, EnrichmentData>> {
    if (serviceIds.length === 0) return new Map();

    const result = await db.execute(sql`
      SELECT
        service_id,
        service_name,
        ai_description,
        ai_category,
        ai_process_steps,
        ai_eligibility,
        ai_wait_times,
        ai_required_docs,
        ai_location,
        ai_contact
      FROM ai_service_enrichments
      WHERE service_id = ANY(${serviceIds}::varchar[])
    `);

    const map = new Map<string, EnrichmentData>();
    for (const row of result.rows as any[]) {
      map.set(row.service_id, {
        serviceId: row.service_id,
        serviceName: row.service_name,
        aiDescription: row.ai_description,
        aiCategory: row.ai_category,
        aiProcessSteps: row.ai_process_steps,
        aiEligibility: row.ai_eligibility,
        aiWaitTimes: row.ai_wait_times,
        aiRequiredDocs: row.ai_required_docs,
        aiLocation: row.ai_location,
        aiContact: row.ai_contact,
      });
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
}

export const storage = new DatabaseStorage();
