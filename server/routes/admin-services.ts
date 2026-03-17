/**
 * Admin service CRUD routes — /api/admin/services/*
 *
 * 14 endpoints for service management: list, create, update, deactivate,
 * restore, bulk operations, embedding regeneration, geocoding, export.
 *
 * IMPORTANT: Named routes are registered BEFORE parameterized :id routes
 * because Express matches in registration order.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { adminAuth, adminReadLimiter, adminWriteLimiter } from "../middleware/adminAuth";
import { createErrorResponse } from "../helpers/errors";
import { getOpenAI } from "../helpers/openai";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { aiServiceEnrichments } from "@shared/schema";

// ============= ZOD SCHEMAS =============

const serviceCreateSchema = z.object({
  name: z.string().min(1).max(500).trim(),
  category: z.string().min(1).max(255).trim(),
  description: z.string().max(10000).optional(),
  location: z.string().max(500).optional(),
  contact: z.string().max(5000).optional(),
  eligibility: z.string().max(5000).optional(),
  phone: z.string().max(100).optional(),
  email: z.string().max(255).optional(),
  address: z.string().max(2000).optional(),
  hoursOfOperation: z.string().max(500).optional(),
  languagesSupported: z.array(z.string()).optional(),
  serviceFormat: z.string().max(100).optional(),
  websiteUrl: z.string().max(2000).optional(),
  tags: z.array(z.string()).optional(),
  genderRestriction: z.string().max(50).optional(),
  ageGroup: z.string().max(20).optional(),
  isFaithBased: z.boolean().optional(),
  is12Step: z.boolean().optional(),
  is24_7: z.boolean().optional(),
});

const serviceUpdateSchema = serviceCreateSchema.partial();

const bulkUpdateSchema = z.object({
  ids: z.array(z.number().int().min(1)).min(1).max(50),
  changes: z.record(z.unknown()),
  reason: z.string().min(1).max(1000).trim(),
  dryRun: z.boolean().default(true),
});

const bulkDeactivateSchema = z.object({
  ids: z.array(z.number().int().min(1)).min(1).max(50),
  reason: z.string().min(1).max(1000).trim(),
  dryRun: z.boolean().default(true),
});

const bulkRegenerateSchema = z.object({
  ids: z.array(z.number().int().min(1)).min(1).max(50),
});

const importSchema = z.object({
  services: z.array(serviceCreateSchema).min(1).max(100),
  dryRun: z.boolean().default(true),
});

// ============= HELPERS =============

/**
 * Build embedding text from service fields and generate an embedding vector.
 */
async function generateEmbedding(service: { name: string; description?: string | null; category?: string | null; tags?: any }): Promise<number[]> {
  const openai = getOpenAI();
  const parts = [service.name];
  if (service.description) parts.push(service.description);
  if (service.category) parts.push(service.category);
  if (Array.isArray(service.tags)) parts.push(service.tags.join(' '));
  const text = parts.join(' ').slice(0, 8000);

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: text,
    dimensions: 1536,
  });

  return response.data[0].embedding;
}

/**
 * Geocode an address via Mapbox and return [lat, lng].
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const token = process.env.MAPBOX_SECRET_TOKEN;
  if (!token) throw new Error('MAPBOX_SECRET_TOKEN not configured');

  const encoded = encodeURIComponent(address);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&country=CA&bbox=-120.0,49.0,-110.0,60.0&limit=1`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Mapbox geocoding error: ${response.status}`);
  }

  const data = await response.json();
  if (!data.features || data.features.length === 0) {
    return null;
  }

  const [lng, lat] = data.features[0].center;
  return { lat, lng };
}

/**
 * Convert services to CSV string.
 */
function servicesToCsv(serviceList: any[]): string {
  const headers = ['id', 'serviceId', 'name', 'category', 'description', 'location', 'phone', 'email', 'address', 'websiteUrl', 'isActive', 'confidenceScore'];
  const escape = (val: any): string => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
  };

  const rows = serviceList.map(s =>
    headers.map(h => escape((s as any)[h])).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

// ============= ROUTE REGISTRATION =============

export function registerAdminServiceRoutes(app: Express): void {
  // ============= LIST SERVICES =============
  app.get("/api/admin/services", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const params = {
        q: req.query.q as string | undefined,
        category: req.query.category as string | undefined,
        status: req.query.status as 'active' | 'inactive' | 'all' | undefined,
        location: req.query.location as string | undefined,
        hasEmbedding: req.query.hasEmbedding === 'true' ? true : req.query.hasEmbedding === 'false' ? false : undefined,
        hasGeocoding: req.query.hasGeocoding === 'true' ? true : req.query.hasGeocoding === 'false' ? false : undefined,
        enrichmentSource: req.query.enrichmentSource as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        sort: req.query.sort as 'name' | 'category' | 'confidence' | 'lastUpdated' | 'clickCount' | 'location' | 'enrichmentSource' | undefined,
        order: req.query.order as 'asc' | 'desc' | undefined,
      };

      const result = await storage.getAdminServices(params);
      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Admin services list error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch services", errorMessage));
    }
  });

  // ============= EXPORT SERVICES (named route — before :id) =============
  app.get("/api/admin/services/export", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const format = req.query.format === 'json' ? 'json' : 'csv';
      const result = await storage.getAdminServices({ limit: 10000 });

      if (format === 'json') {
        res.setHeader('Content-Disposition', 'attachment; filename=services.json');
        res.json(result.services);
      } else {
        const csv = servicesToCsv(result.services);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=services.csv');
        res.send(csv);
      }
    } catch (err) {
      console.error("Export error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to export services", errorMessage));
    }
  });

  // ============= CREATE SERVICE =============
  app.post("/api/admin/services", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const parsed = serviceCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(
          createErrorResponse("Invalid service data", undefined, parsed.error.issues)
        );
      }

      const service = await storage.createService(parsed.data);
      res.json({ success: true, service });
    } catch (err) {
      console.error("Create service error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to create service", errorMessage));
    }
  });

  // ============= BULK UPDATE (named route — before :id) =============
  app.post("/api/admin/services/bulk-update", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const parsed = bulkUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(
          createErrorResponse("Invalid request body", undefined, parsed.error.issues)
        );
      }

      const { ids, changes, reason, dryRun } = parsed.data;

      if (dryRun) {
        return res.json({ success: true, dryRun: true, affected: ids.length, ids, changes });
      }

      const count = await storage.bulkUpdateServices(ids, changes as any, reason);
      res.json({ success: true, updated: count });
    } catch (err) {
      console.error("Bulk update error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to bulk update services", errorMessage));
    }
  });

  // ============= BULK DEACTIVATE (named route — before :id) =============
  app.post("/api/admin/services/bulk-deactivate", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const parsed = bulkDeactivateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(
          createErrorResponse("Invalid request body", undefined, parsed.error.issues)
        );
      }

      const { ids, reason, dryRun } = parsed.data;

      if (dryRun) {
        return res.json({ success: true, dryRun: true, affected: ids.length, ids });
      }

      const count = await storage.bulkDeactivateServices(ids, reason);
      res.json({ success: true, deactivated: count });
    } catch (err) {
      console.error("Bulk deactivate error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to bulk deactivate services", errorMessage));
    }
  });

  // ============= BULK REGENERATE EMBEDDINGS (named route — before :id) =============
  app.post("/api/admin/services/bulk-regenerate-embeddings", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const parsed = bulkRegenerateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(
          createErrorResponse("Invalid request body", undefined, parsed.error.issues)
        );
      }

      const { ids } = parsed.data;

      // Fire-and-forget background regeneration
      (async () => {
        let successCount = 0;
        let errorCount = 0;
        for (const id of ids) {
          try {
            const service = await storage.getAdminServiceDetail(id);
            if (!service) continue;

            const embedding = await generateEmbedding(service);
            const embeddingStr = `[${embedding.join(',')}]`;
            await db.execute(
              sql`UPDATE services SET embedding = ${embeddingStr}::vector, embedding_updated_at = NOW() WHERE id = ${id}`
            );
            successCount++;
          } catch (err) {
            errorCount++;
            console.error(`[AdminServices] Embedding regen failed for id=${id}:`, err);
          }
        }
        console.log(`[AdminServices] Bulk embedding regen complete: ${successCount} success, ${errorCount} errors`);
      })();

      res.json({ success: true, message: `Embedding regeneration started for ${ids.length} services`, queued: ids.length });
    } catch (err) {
      console.error("Bulk regenerate embeddings error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to start embedding regeneration", errorMessage));
    }
  });

  // ============= IMPORT SERVICES (named route — before :id) =============
  app.post("/api/admin/services/import", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const parsed = importSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(
          createErrorResponse("Invalid import data", undefined, parsed.error.issues)
        );
      }

      const { services: serviceList, dryRun } = parsed.data;

      if (dryRun) {
        return res.json({
          success: true,
          dryRun: true,
          preview: serviceList.map(s => ({ name: s.name, category: s.category })),
          count: serviceList.length,
        });
      }

      const created = [];
      const errors = [];
      for (const serviceData of serviceList) {
        try {
          const service = await storage.createService(serviceData);
          created.push({ id: service.id, name: service.name });
        } catch (err) {
          errors.push({ name: serviceData.name, error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }

      res.json({ success: true, created, errors, totalCreated: created.length, totalErrors: errors.length });
    } catch (err) {
      console.error("Import services error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to import services", errorMessage));
    }
  });

  // ============= GET SERVICE ENRICHMENT (named sub-route — before :id) =============
  app.get("/api/admin/services/:id/enrichment", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const idSchema = z.coerce.number().int().min(1);
      const parseResult = idSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        return res.status(400).json(createErrorResponse("Invalid service ID"));
      }

      const service = await storage.getAdminServiceDetail(parseResult.data);
      if (!service) {
        return res.status(404).json(createErrorResponse("Service not found"));
      }

      const enrichment = service.serviceId
        ? await db.select().from(aiServiceEnrichments).where(eq(aiServiceEnrichments.serviceId, service.serviceId)).limit(1)
        : [];

      res.json({
        success: true,
        enrichment: enrichment[0] || null,
        enrichmentSource: service.enrichmentSource,
        enrichmentDate: service.enrichmentDate,
      });
    } catch (err) {
      console.error("Service enrichment error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch enrichment data", errorMessage));
    }
  });

  // ============= GET SERVICE DETAIL (parameterized :id) =============
  app.get("/api/admin/services/:id", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const idSchema = z.coerce.number().int().min(1);
      const parseResult = idSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        return res.status(400).json(createErrorResponse("Invalid service ID"));
      }

      const service = await storage.getAdminServiceDetail(parseResult.data);
      if (!service) {
        return res.status(404).json(createErrorResponse("Service not found"));
      }

      res.json({ success: true, service });
    } catch (err) {
      console.error("Service detail error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch service", errorMessage));
    }
  });

  // ============= UPDATE SERVICE =============
  app.patch("/api/admin/services/:id", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const idSchema = z.coerce.number().int().min(1);
      const parseResult = idSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        return res.status(400).json(createErrorResponse("Invalid service ID"));
      }

      const parsed = serviceUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(
          createErrorResponse("Invalid service data", undefined, parsed.error.issues)
        );
      }

      const service = await storage.updateService(parseResult.data, parsed.data as any);
      res.json({ success: true, service });
    } catch (err) {
      console.error("Update service error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to update service", errorMessage));
    }
  });

  // ============= DEACTIVATE SERVICE =============
  app.post("/api/admin/services/:id/deactivate", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const idSchema = z.coerce.number().int().min(1);
      const parseResult = idSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        return res.status(400).json(createErrorResponse("Invalid service ID"));
      }

      const reasonSchema = z.object({ reason: z.string().min(1).max(1000).trim() });
      const parsed = reasonSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(
          createErrorResponse("Reason is required", undefined, parsed.error.issues)
        );
      }

      const service = await storage.deactivateService(parseResult.data, parsed.data.reason);
      res.json({ success: true, service });
    } catch (err) {
      console.error("Deactivate service error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to deactivate service", errorMessage));
    }
  });

  // ============= RESTORE SERVICE =============
  app.post("/api/admin/services/:id/restore", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const idSchema = z.coerce.number().int().min(1);
      const parseResult = idSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        return res.status(400).json(createErrorResponse("Invalid service ID"));
      }

      const service = await storage.restoreService(parseResult.data);
      res.json({ success: true, service });
    } catch (err) {
      console.error("Restore service error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to restore service", errorMessage));
    }
  });

  // ============= REGENERATE SINGLE EMBEDDING =============
  app.post("/api/admin/services/:id/regenerate-embedding", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const idSchema = z.coerce.number().int().min(1);
      const parseResult = idSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        return res.status(400).json(createErrorResponse("Invalid service ID"));
      }

      const service = await storage.getAdminServiceDetail(parseResult.data);
      if (!service) {
        return res.status(404).json(createErrorResponse("Service not found"));
      }

      const embedding = await generateEmbedding(service);
      const embeddingStr = `[${embedding.join(',')}]`;
      await db.execute(
        sql`UPDATE services SET embedding = ${embeddingStr}::vector, embedding_updated_at = NOW() WHERE id = ${parseResult.data}`
      );

      res.json({ success: true, message: `Embedding regenerated for service ${parseResult.data}` });
    } catch (err) {
      console.error("Regenerate embedding error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to regenerate embedding", errorMessage));
    }
  });

  // ============= GEOCODE SERVICE =============
  app.post("/api/admin/services/:id/geocode", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const idSchema = z.coerce.number().int().min(1);
      const parseResult = idSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        return res.status(400).json(createErrorResponse("Invalid service ID"));
      }

      const service = await storage.getAdminServiceDetail(parseResult.data);
      if (!service) {
        return res.status(404).json(createErrorResponse("Service not found"));
      }

      const address = service.address || service.location;
      if (!address) {
        return res.status(400).json(createErrorResponse("Service has no address or location to geocode"));
      }

      const coords = await geocodeAddress(address);
      if (!coords) {
        return res.status(404).json(createErrorResponse("Could not geocode address"));
      }

      const updated = await storage.updateService(parseResult.data, {
        latitude: coords.lat,
        longitude: coords.lng,
      } as any);

      res.json({ success: true, service: updated, coordinates: coords });
    } catch (err) {
      console.error("Geocode service error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to geocode service", errorMessage));
    }
  });

  // ============= FLAG FOR REVIEW =============
  app.post("/api/admin/services/:id/flag-review", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const idSchema = z.coerce.number().int().min(1);
      const parseResult = idSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        return res.status(400).json(createErrorResponse("Invalid service ID"));
      }

      const service = await storage.getAdminServiceDetail(parseResult.data);
      if (!service) {
        return res.status(404).json(createErrorResponse("Service not found"));
      }

      const { reason } = (req.body as { reason?: string }) || {};

      await storage.createChangeRequest({
        serviceId: parseResult.data,
        changeType: 'update',
        proposedChanges: service as any,
        previousValues: service as any,
        source: 'admin',
        status: 'pending',
        reviewNotes: reason || 'Flagged for review by admin',
      });

      res.json({ success: true, message: "Service flagged for review" });
    } catch (err) {
      console.error("Flag for review error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to flag service for review", errorMessage));
    }
  });

  // ============= SERVICE HISTORY =============
  app.get("/api/admin/services/:id/history", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const idSchema = z.coerce.number().int().min(1);
      const parseResult = idSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        return res.status(400).json(createErrorResponse("Invalid service ID"));
      }

      const history = await storage.getServiceHistory(parseResult.data);
      res.json({ success: true, history });
    } catch (err) {
      console.error("Service history error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch service history", errorMessage));
    }
  });
}
