/**
 * Admin dashboard routes — /api/admin/dashboard/*, /api/admin/activity
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { adminAuth, adminReadLimiter } from "../middleware/adminAuth";
import { createErrorResponse } from "../helpers/errors";

export function registerAdminDashboardRoutes(app: Express): void {
  // ============= DASHBOARD STATS =============
  app.get("/api/admin/dashboard/stats", adminReadLimiter, adminAuth, async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json({ success: true, ...stats });
    } catch (err) {
      console.error("Dashboard stats error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch dashboard stats", errorMessage));
    }
  });

  // ============= RECENT ACTIVITY =============
  app.get("/api/admin/activity", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
      const parseResult = limitSchema.safeParse(req.query.limit);
      const limit = parseResult.success ? parseResult.data : 20;

      const activity = await storage.getRecentActivity(limit);
      res.json({ success: true, activity });
    } catch (err) {
      console.error("Recent activity error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch recent activity", errorMessage));
    }
  });
}
