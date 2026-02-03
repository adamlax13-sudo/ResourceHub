import { db } from "./db";
import { searches, feedback, services, aiServiceEnrichments, type Search, type Feedback, type InsertFeedback, type Service, type AiServiceEnrichment } from "@shared/schema";
import { eq, or, ilike, and, desc, inArray } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();
