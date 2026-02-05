import { db } from "./db";
import { searches, feedback, services, aiServiceEnrichments, searchAnalytics, serviceAliases, type Search, type Feedback, type InsertFeedback, type Service, type AiServiceEnrichment, type SearchAnalytics, type ServiceAlias } from "@shared/schema";
import { eq, or, ilike, and, desc, inArray, sql } from "drizzle-orm";

export interface IStorage {
  createSearch(search: { query: string; results: any }): Promise<Search>;
  getSearchByQuery(query: string): Promise<Search | undefined>;

  createFeedback(feedbackData: InsertFeedback): Promise<Feedback>;
  getAllFeedback(): Promise<Feedback[]>;

  // Service queries
  getAllActiveServices(): Promise<Service[]>;
  searchServices(searchTerm: string): Promise<Service[]>;

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
}

export const storage = new DatabaseStorage();
