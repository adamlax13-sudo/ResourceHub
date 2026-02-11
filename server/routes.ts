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

// Import the new search module
import { search, getServiceDetails } from "./search";
import { normalizeForCache } from "./helpers/keywords";

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
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({
        message: "Search failed",
        error: errorMessage,
      });
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
        res.status(400).json({ message: "Invalid feedback data", errors: err.errors });
      } else {
        res.status(500).json({ message: "Failed to submit feedback" });
      }
    }
  });

  // ============= SERVICE DETAIL ENDPOINT =============
  // Get full service details by ID (loaded when user expands a card)
  app.get("/api/services/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const serviceDetails = await getServiceDetails(id);

      if (!serviceDetails) {
        return res.status(404).json({ message: "Service not found" });
      }

      res.json(serviceDetails);
    } catch (err) {
      console.error("Service detail error:", err);
      res.status(500).json({ message: "Failed to fetch service details" });
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

      // Track the click asynchronously (don't block response)
      storage.trackSearchClick({
        query: data.query,
        normalizedQuery: normalizeForCache(data.query),
        resultCount: 0,
        clickedServiceId: data.serviceId,
        clickPosition: data.position,
        sessionId: req.headers['x-session-id'] as string || undefined,
        userAgent: req.headers['user-agent'] || undefined,
      }).catch(err => {
        console.error('Failed to track click:', err);
      });

      res.json({ success: true });
    } catch (err) {
      console.error("Click tracking error:", err);
      res.json({ success: false });
    }
  });

  // ============= SEARCH ANALYTICS ENDPOINT =============
  // Returns popular searches (for admin/analytics purposes)
  app.get("/api/analytics/popular-searches", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const popularSearches = await storage.getPopularSearches(limit);
      res.json({ searches: popularSearches });
    } catch (err) {
      console.error("Analytics error:", err);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // ============= ADMIN: REFRESH SEARCH VIEW =============
  // Refreshes the materialized view and clears search cache
  // Call this after marking services as inactive or making bulk changes
  app.post("/api/admin/refresh-search", async (_req: Request, res: Response) => {
    try {
      // Refresh the materialized view (removes inactive services)
      await storage.refreshSearchView();

      // Clear the search cache (old results with inactive services)
      await storage.clearSearchCache();

      console.log('[Admin] Search view refreshed and cache cleared');
      res.json({ success: true, message: 'Search view refreshed and cache cleared' });
    } catch (err) {
      console.error("Refresh search error:", err);
      res.status(500).json({ message: "Failed to refresh search view" });
    }
  });

  return httpServer;
}
