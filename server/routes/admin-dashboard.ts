/**
 * Admin dashboard routes — /api/admin/dashboard/*, /api/admin/activity
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { adminAuth, adminReadLimiter } from "../middleware/adminAuth";
import { asyncHandler } from "../helpers/errors";

export function registerAdminDashboardRoutes(app: Express): void {
  // ============= DASHBOARD STATS =============
  app.get("/api/admin/dashboard/stats", adminReadLimiter, adminAuth, asyncHandler(async (_req: Request, res: Response) => {
    const stats = await storage.getDashboardStats();
    res.json({ success: true, ...stats });
  }));

  // ============= RECENT ACTIVITY =============
  app.get("/api/admin/activity", adminReadLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const limitSchema = z.coerce.number().int().min(1).max(100).default(20);
    const parseResult = limitSchema.safeParse(req.query.limit);
    const limit = parseResult.success ? parseResult.data : 20;

    const activity = await storage.getRecentActivity(limit);
    res.json({ success: true, activity });
  }));
}
