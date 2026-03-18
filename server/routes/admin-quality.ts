/**
 * Admin quality routes — /api/admin/quality/*
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { adminAuth, adminReadLimiter } from "../middleware/adminAuth";
import { asyncHandler } from "../helpers/errors";

export function registerAdminQualityRoutes(app: Express): void {
  // ============= QUALITY SUMMARY =============
  app.get("/api/admin/quality/summary", adminReadLimiter, adminAuth, asyncHandler(async (_req: Request, res: Response) => {
    const summary = await storage.getQualitySummary();
    res.json({ success: true, summary });
  }));

  // ============= QUALITY ISSUES =============
  app.get("/api/admin/quality/issues", adminReadLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const pageSchema = z.coerce.number().int().min(1).default(1);
    const limitSchema = z.coerce.number().int().min(1).max(200).default(50);

    const page = pageSchema.safeParse(req.query.page).success
      ? pageSchema.parse(req.query.page)
      : 1;
    const limit = limitSchema.safeParse(req.query.limit).success
      ? limitSchema.parse(req.query.limit)
      : 50;

    const result = await storage.getQualityIssues({ page, limit });
    res.json({ success: true, ...result });
  }));
}
