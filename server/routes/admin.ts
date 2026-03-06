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
import { withTimeout } from "../helpers/timeout";

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

      // Clear stale cache entries (older than 7 days)
      const staleCleared = await storage.clearStaleSearches();

      console.log(`[Admin] Search view refreshed, cache cleared, ${staleCleared} stale entries removed`);
      res.json({ success: true, message: `Search view refreshed, cache cleared, ${staleCleared} stale entries removed` });
    } catch (err) {
      console.error("Refresh search error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to refresh search view", errorMessage));
    }
  });

  // ============= ADMIN: PERSIST ENRICHMENTS =============
  // Persist AI enrichments to services table (backfill job)
  // This copies enrichment data to the services table for empty fields only,
  // reducing future enrichment lookups and API calls
  app.post("/api/admin/persist-enrichments", adminLimiter, adminAuth, async (_req: Request, res: Response) => {
    try {
      const result = await withTimeout(
        (async () => {
          const enrichments = await storage.getAllEnrichments();
          let totalFieldsUpdated = 0;
          let servicesUpdated = 0;
          const deadline = Date.now() + 55000; // 55s soft limit inside 60s hard limit

          for (const enrichment of enrichments) {
            if (Date.now() > deadline) {
              console.warn('[Admin] Approaching timeout, stopping enrichment persistence early');
              break;
            }
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

          return { servicesUpdated, totalFieldsUpdated, enrichmentsProcessed: enrichments.length };
        })(),
        60000,
        'persist-enrichments'
      );

      console.log(`[Admin] Persisted enrichments: ${result.servicesUpdated} services updated, ${result.totalFieldsUpdated} total fields`);
      res.json({
        success: true,
        message: `Persisted enrichments to ${result.servicesUpdated} services (${result.totalFieldsUpdated} fields total)`,
        servicesUpdated: result.servicesUpdated,
        totalFieldsUpdated: result.totalFieldsUpdated,
        enrichmentsProcessed: result.enrichmentsProcessed,
      });
    } catch (err) {
      console.error("Persist enrichments error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to persist enrichments", errorMessage));
    }
  });
}
