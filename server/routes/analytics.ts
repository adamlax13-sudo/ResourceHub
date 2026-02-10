/**
 * Analytics endpoints: click tracking and popular searches
 */

import type { Request, Response, Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { normalizeForCache } from "../helpers/keywords";

const clickSchema = z.object({
  serviceId: z.string().min(1),
  query: z.string().min(1),
  position: z.number().int().min(1).optional(),
});

export function registerAnalyticsRoutes(router: Router): void {
  /**
   * Track when users click on search results to improve ranking over time
   */
  router.post("/api/track-click", async (req: Request, res: Response) => {
    try {
      const data = clickSchema.parse(req.body);

      // Track the click asynchronously (don't block response)
      storage.trackSearchClick({
        query: data.query,
        normalizedQuery: normalizeForCache(data.query),
        resultCount: 0, // Not tracking this for click events
        clickedServiceId: data.serviceId,
        clickPosition: data.position,
        sessionId: req.headers['x-session-id'] as string || undefined,
        userAgent: req.headers['user-agent'] || undefined,
      }).catch(err => {
        console.error('Failed to track click:', err);
      });

      res.json({ success: true });
    } catch (err) {
      // Don't fail the request if tracking fails
      console.error("Click tracking error:", err);
      res.json({ success: false });
    }
  });

  /**
   * Returns popular searches (for admin/analytics purposes)
   */
  router.get("/api/analytics/popular-searches", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const popularSearches = await storage.getPopularSearches(limit);
      res.json({ searches: popularSearches });
    } catch (err) {
      console.error("Analytics error:", err);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });
}
