/**
 * ServiceStorage — Service CRUD with cross-domain side effect callbacks.
 *
 * Methods that trigger search infrastructure changes (updateService,
 * deactivateService, restoreService) receive side-effect callbacks
 * from the facade, keeping domain modules decoupled.
 */

import { db } from "../db";
import {
  services, serviceHistory,
  type Service, type ServiceHistory,
} from "@shared/schema";
import { eq, or, ilike, and, desc, asc, inArray, sql, isNull, isNotNull, type SQL } from "drizzle-orm";

export interface ServiceSideEffects {
  invalidateConfidenceCache: () => void;
  refreshSearchInfrastructure: (id: number, serviceId: string, contentChanged: boolean) => Promise<void>;
  invalidateTranslations?: (serviceId: string) => Promise<void>;
  invalidateSearchCache?: () => void;
}

export class ServiceStorage {
  private generateServiceSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[—–]/g, '-')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 200);
  }

  async createService(data: Partial<Service> & { name: string; category: string }): Promise<Service> {
    const now = new Date();
    const baseSlug = this.generateServiceSlug(data.name);

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

  async updateService(
    id: number,
    changes: Partial<Service>,
    reason: string | undefined,
    effects: ServiceSideEffects,
  ): Promise<Service> {
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

    if (Object.keys(changedFields).length === 0) {
      return current;
    }

    if ('geocodedAt' in changes) {
      (changes as any).geocodedAt = now;
    }

    const contentFields = new Set(['name', 'description', 'eligibility', 'processSteps', 'hoursOfOperation', 'phone', 'email', 'websiteUrl', 'address']);
    const editedContentFields = Object.keys(changedFields).filter(k => contentFields.has(k));

    if (editedContentFields.length > 0) {
      const merged = { ...current, ...changes };
      let score = 50;
      if (merged.phone) score += 10;
      if (merged.email) score += 5;
      if (merged.websiteUrl) score += 5;
      if (merged.description && String(merged.description).length > 50) score += 10;
      if (merged.eligibility) score += 5;
      if (merged.processSteps && JSON.stringify(merged.processSteps) !== '[]' && JSON.stringify(merged.processSteps) !== 'null') score += 5;
      if (merged.hoursOfOperation) score += 5;
      if (merged.address) score += 5;
      changes.confidenceScore = Math.min(100, score);

      // Cross-domain side effect: invalidate search cache
      effects.invalidateConfidenceCache();

      if ('processSteps' in changedFields) {
        (changes as any).processStepsInferred = false;
      }

      const aiFieldMap: Record<string, string> = {
        description: 'ai_description',
        eligibility: 'ai_eligibility',
        processSteps: 'ai_process_steps',
        hoursOfOperation: 'ai_wait_times',
      };
      const aiClears: string[] = [];
      for (const field of editedContentFields) {
        if (aiFieldMap[field]) aiClears.push(aiFieldMap[field]);
      }
      if (aiClears.length > 0) {
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

    const [updated] = await db.update(services)
      .set({ ...changes, lastUpdated: now })
      .where(eq(services.id, id))
      .returning();

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

      const activationChanged = 'isActive' in changedFields;
      const contentChanged = editedContentFields.length > 0;
      if (activationChanged || contentChanged) {
        // Cross-domain side effect: refresh search infrastructure
        effects.refreshSearchInfrastructure(updated.id, updated.serviceId, contentChanged).catch(() => {});
        // Cross-domain side effect: clear cached search results so users see fresh data
        effects.invalidateSearchCache?.();
      }

      // Cross-domain side effect: invalidate cached translations when translatable fields change
      const translatableFields = new Set(['name', 'description', 'eligibility', 'waitTimes', 'hoursOfOperation', 'address', 'processSteps', 'requiredDocs']);
      const translationDirty = Object.keys(changedFields).some(k => translatableFields.has(k));
      if (translationDirty && effects.invalidateTranslations) {
        effects.invalidateTranslations(updated.serviceId).catch(err => {
          console.error(`[ServiceStorage] Failed to invalidate translations for ${updated.serviceId}:`, err);
        });
      }
    }

    return updated;
  }

  async deactivateService(id: number, reason: string, effects: ServiceSideEffects): Promise<Service> {
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

    effects.refreshSearchInfrastructure(updated.id, updated.serviceId, false).catch(() => {});
    effects.invalidateSearchCache?.();
    return updated;
  }

  async restoreService(id: number, effects: ServiceSideEffects): Promise<Service> {
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

    effects.refreshSearchInfrastructure(updated.id, updated.serviceId, false).catch(() => {});
    effects.invalidateSearchCache?.();
    return updated;
  }

  async getServiceHistory(serviceId: number): Promise<ServiceHistory[]> {
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

    const conditions: SQL[] = [];

    if (params.status === 'active') {
      conditions.push(eq(services.isActive, true));
    } else if (params.status === 'inactive') {
      conditions.push(eq(services.isActive, false));
    }

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

    if (params.category) {
      conditions.push(eq(services.category, params.category));
    }

    if (params.location) {
      conditions.push(ilike(services.location, `%${params.location}%`));
    }

    if (params.hasEmbedding === true) {
      conditions.push(sql`embedding IS NOT NULL`);
    } else if (params.hasEmbedding === false) {
      conditions.push(sql`embedding IS NULL`);
    }

    if (params.hasGeocoding === true) {
      conditions.push(isNotNull(services.latitude));
    } else if (params.hasGeocoding === false) {
      conditions.push(isNull(services.latitude));
    }

    if (params.enrichmentSource === 'ai_enriched') {
      conditions.push(sql`EXISTS (SELECT 1 FROM ai_service_enrichments WHERE ai_service_enrichments.service_id = services.service_id)`);
    } else if (params.enrichmentSource === 'none') {
      conditions.push(isNull(services.enrichmentSource));
    } else if (params.enrichmentSource) {
      conditions.push(eq(services.enrichmentSource, params.enrichmentSource));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let orderExpr: SQL;
    const sortDir = params.order === 'asc' ? asc : desc;
    switch (params.sort) {
      case 'name': orderExpr = sortDir(services.name); break;
      case 'category': orderExpr = sortDir(services.category); break;
      case 'confidence': orderExpr = sortDir(services.confidenceScore); break;
      case 'lastUpdated': orderExpr = sortDir(services.lastUpdated); break;
      case 'clickCount': orderExpr = sortDir(services.clickCount); break;
      case 'location': orderExpr = sortDir(services.location); break;
      case 'enrichmentSource': orderExpr = sortDir(services.enrichmentSource); break;
      default: orderExpr = desc(services.lastUpdated);
    }

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

  async bulkUpdateServices(ids: number[], changes: Partial<Service>, reason: string | undefined, effects: ServiceSideEffects): Promise<number> {
    let successCount = 0;
    for (const id of ids) {
      try {
        await this.updateService(id, changes, reason, effects);
        successCount++;
      } catch (err) {
        console.warn(`[Admin] bulkUpdateServices: failed to update service ${id}:`, err);
      }
    }
    return successCount;
  }

  async bulkDeactivateServices(ids: number[], reason: string, effects: ServiceSideEffects): Promise<number> {
    let successCount = 0;
    for (const id of ids) {
      try {
        await this.deactivateService(id, reason, effects);
        successCount++;
      } catch (err) {
        console.warn(`[Admin] bulkDeactivateServices: failed to deactivate service ${id}:`, err);
      }
    }
    return successCount;
  }
}
