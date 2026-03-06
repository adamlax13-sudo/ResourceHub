/**
 * Analytics routes — /api/track-click, /api/analytics/popular-searches
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { normalizeForCache } from "../helpers/keywords";
import { createErrorResponse } from "../helpers/errors";
import { adminAuth } from "../middleware/adminAuth";

export function registerAnalyticsRoutes(app: Express): void {
  // ============= CLICK TRACKING ENDPOINT =============
  // Tracks when users click on search results to improve ranking over time
  app.post("/api/track-click", async (req: Request, res: Response) => {
    try {
      const clickSchema = z.object({
        serviceId: z.string().min(1).max(255),
        query: z.string().min(1).max(500),
        position: z.number().int().min(1).optional(),
      });

      const data = clickSchema.parse(req.body);

      // Safely extract headers (handle array case)
      const sessionIdHeader = req.headers['x-session-id'];
      const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
      const userAgentHeader = req.headers['user-agent'];
      const userAgent = (Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader)?.slice(0, 500);

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
  app.get("/api/analytics/popular-searches", adminAuth, async (req: Request, res: Response) => {
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
}
