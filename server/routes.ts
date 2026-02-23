/**
 * Server Routes
 *
 * Simplified routes using the new search module architecture.
 * The main search logic has been moved to server/search/.
 */

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { strictLimiter, feedbackLimiter } from "./middleware/rateLimiter";
import { adminAuth, adminLimiter } from "./middleware/adminAuth";

// Import the new search module
import { search, getServiceDetails } from "./search";
import { normalizeForCache } from "./helpers/keywords";

// Standard error response format for consistency
interface ErrorResponse {
  success: false;
  message: string;
  error?: string;
  errors?: z.ZodIssue[];
}

function createErrorResponse(message: string, error?: string, errors?: z.ZodIssue[]): ErrorResponse {
  return { success: false, message, error, errors };
}

// ============= ROUTE REGISTRATION =============

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ============= SEARCH ENDPOINT =============
  app.post(api.search.query.path, strictLimiter, async (req: Request, res: Response) => {
    try {
      const input = api.search.query.input.parse(req.body);

      // Honeypot check: bots fill hidden fields, humans don't
      if (input.hp) {
        return res.json({ services: [], summary: "No results found." });
      }

      // Call the search orchestrator
      const result = await search({
        query: input.query,
        location: input.location,
        page: input.page ?? 1,
        pageSize: input.pageSize ?? 20,
      });

      res.json(result);
    } catch (err) {
      console.error("Search error:", err);
      // Don't expose internal error details to clients in production
      const errorMessage = process.env.NODE_ENV === 'production'
        ? undefined
        : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Search failed", errorMessage));
    }
  });

  // ============= FEEDBACK ENDPOINT =============
  app.post("/api/feedback", feedbackLimiter, async (req: Request, res: Response) => {
    try {
      const feedbackSchema = z.object({
        name: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        message: z.string().min(1, "Message is required").max(2000, "Message is too long"),
        hp: z.string().max(0).optional(),
      });

      const validatedData = feedbackSchema.parse(req.body);

      // Honeypot check
      if (validatedData.hp) {
        return res.json({ success: true, id: 0 });
      }

      const feedbackData = {
        name: validatedData.name || null,
        email: validatedData.email || null,
        message: validatedData.message,
      };

      const newFeedback = await storage.createFeedback(feedbackData);
      res.json({ success: true, id: newFeedback.id });
    } catch (err) {
      console.error("Feedback error:", err);
      if (err instanceof z.ZodError) {
        res.status(400).json(createErrorResponse("Invalid feedback data", undefined, err.errors));
      } else {
        res.status(500).json(createErrorResponse("Failed to submit feedback"));
      }
    }
  });

  // ============= SERVICE DETAIL ENDPOINT =============
  // Get full service details by ID (loaded when user expands a card)
  app.get("/api/services/:id", async (req: Request, res: Response) => {
    try {
      // Validate service ID parameter
      const idSchema = z.string().min(1).max(255);
      const parseResult = idSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        return res.status(400).json(createErrorResponse("Invalid service ID"));
      }
      const id = parseResult.data;

      const serviceDetails = await getServiceDetails(id);

      if (!serviceDetails) {
        return res.status(404).json(createErrorResponse("Service not found"));
      }

      res.json(serviceDetails);
    } catch (err) {
      console.error("Service detail error:", err);
      res.status(500).json(createErrorResponse("Failed to fetch service details"));
    }
  });

  // ============= CLICK TRACKING ENDPOINT =============
  // Tracks when users click on search results to improve ranking over time
  app.post("/api/track-click", async (req: Request, res: Response) => {
    try {
      const clickSchema = z.object({
        serviceId: z.string().min(1),
        query: z.string().min(1),
        position: z.number().int().min(1).optional(),
      });

      const data = clickSchema.parse(req.body);

      // Safely extract headers (handle array case)
      const sessionIdHeader = req.headers['x-session-id'];
      const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
      const userAgentHeader = req.headers['user-agent'];
      const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;

      // Track the click asynchronously (don't block response)
      storage.trackSearchClick({
        query: data.query,
        normalizedQuery: normalizeForCache(data.query),
        resultCount: 0,
        clickedServiceId: data.serviceId,
        clickPosition: data.position,
        sessionId: sessionId || undefined,
        userAgent: userAgent || undefined,
      }).catch(err => {
        console.error('Failed to track click:', err);
      });

      res.json({ success: true });
    } catch (err) {
      console.error("Click tracking error:", err);
      // Return 400 for validation errors, not 200 with success: false
      if (err instanceof z.ZodError) {
        return res.status(400).json(createErrorResponse("Invalid click data", undefined, err.errors));
      }
      res.status(500).json(createErrorResponse("Failed to track click"));
    }
  });

  // ============= SEARCH ANALYTICS ENDPOINT =============
  // Returns popular searches (for admin/analytics purposes)
  app.get("/api/analytics/popular-searches", async (req: Request, res: Response) => {
    try {
      // Validate limit parameter with Zod
      const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
      const parseResult = limitSchema.safeParse(req.query.limit);
      const limit = parseResult.success ? parseResult.data : 20;

      const popularSearches = await storage.getPopularSearches(limit);
      res.json({ success: true, searches: popularSearches });
    } catch (err) {
      console.error("Analytics error:", err);
      res.status(500).json(createErrorResponse("Failed to fetch analytics"));
    }
  });

  // ============= ADMIN: REFRESH SEARCH VIEW =============
  // Refreshes the materialized view and clears search cache
  // Call this after marking services as inactive or making bulk changes
  // SECURITY: Protected with API key authentication
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

  // Persist AI enrichments to services table (backfill job)
  // This copies enrichment data to the services table for empty fields only,
  // reducing future enrichment lookups and API calls
  // SECURITY: Protected with API key authentication
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

  return httpServer;
}
