/**
 * Admin scraper routes — /api/admin/scraper/*
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { adminAuth, adminReadLimiter } from "../middleware/adminAuth";
import { asyncHandler, createErrorResponse } from "../helpers/errors";

export function registerAdminScraperRoutes(app: Express): void {
  // ============= SCRAPER RUNS LIST =============
  app.get("/api/admin/scraper/runs", adminReadLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const pageSchema = z.coerce.number().int().min(1).default(1);
    const limitSchema = z.coerce.number().int().min(1).max(100).default(20);

    const page = pageSchema.safeParse(req.query.page).success
      ? pageSchema.parse(req.query.page)
      : 1;
    const limit = limitSchema.safeParse(req.query.limit).success
      ? limitSchema.parse(req.query.limit)
      : 20;

    const result = await storage.getScraperRuns({ page, limit });
    res.json({ success: true, ...result });
  }));

  // ============= SCRAPER RUN DETAIL =============
  app.get("/api/admin/scraper/runs/:id", adminReadLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const idSchema = z.coerce.number().int().min(1);
    const parseResult = idSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      res.status(400).json(createErrorResponse("Invalid run ID"));
      return;
    }

    const run = await storage.getScraperRunById(parseResult.data);
    if (!run) {
      res.status(404).json(createErrorResponse("Scraper run not found"));
      return;
    }

    res.json({ success: true, run });
  }));
}
