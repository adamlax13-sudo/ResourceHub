/**
 * Admin routes — /api/admin/*
 *
 * All endpoints are protected with API key authentication
 * and admin-specific rate limiting.
 */

import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { adminAuth, adminLimiter } from "../middleware/adminAuth";
import { createErrorResponse } from "../helpers/errors";

export function registerAdminRoutes(app: Express): void {
  // ============= ADMIN: REFRESH SEARCH VIEW =============
  // Refreshes the materialized view and clears search cache
  // Call this after marking services as inactive or making bulk changes
  app.post("/api/admin/refresh-search", adminLimiter, adminAuth, async (_req: Request, res: Response) => {
    try {
      // Refresh the materialized view (removes inactive services)
      await storage.refreshSearchView();

      // Clear the search cache (old results with inactive services)
      await storage.clearSearchCache();

      console.log('[Admin] Search view refreshed and cache cleared');
      res.json({ success: true, message: 'Search view refreshed and cache cleared' });
    } catch (err) {
      console.error("Refresh search error:", err);
      res.status(500).json(createErrorResponse("Failed to refresh search view", err instanceof Error ? err.message : undefined));
    }
  });

  // ============= ADMIN: PERSIST ENRICHMENTS =============
  // Persist AI enrichments to services table (backfill job)
  // This copies enrichment data to the services table for empty fields only,
  // reducing future enrichment lookups and API calls
  app.post("/api/admin/persist-enrichments", adminLimiter, adminAuth, async (_req: Request, res: Response) => {
    try {
      const enrichments = await storage.getAllEnrichments();
      let totalFieldsUpdated = 0;
      let servicesUpdated = 0;

      for (const enrichment of enrichments) {
        const fieldsUpdated = await storage.persistEnrichmentToService(
          enrichment.serviceId,
          enrichment
        );
        if (fieldsUpdated > 0) {
          totalFieldsUpdated += fieldsUpdated;
          servicesUpdated++;
        }
      }

      // Clear cache after updates so new searches reflect the changes
      await storage.clearSearchCache();

      console.log(`[Admin] Persisted enrichments: ${servicesUpdated} services updated, ${totalFieldsUpdated} total fields`);
      res.json({
        success: true,
        message: `Persisted enrichments to ${servicesUpdated} services (${totalFieldsUpdated} fields total)`,
        servicesUpdated,
        totalFieldsUpdated,
        enrichmentsProcessed: enrichments.length,
      });
    } catch (err) {
      console.error("Persist enrichments error:", err);
      res.status(500).json(createErrorResponse("Failed to persist enrichments", err instanceof Error ? err.message : undefined));
    }
  });
}
