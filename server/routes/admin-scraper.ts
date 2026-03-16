/**
 * Admin scraper routes — /api/admin/scraper/*
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { adminAuth, adminReadLimiter } from "../middleware/adminAuth";
import { createErrorResponse } from "../helpers/errors";

export function registerAdminScraperRoutes(app: Express): void {
  // ============= SCRAPER RUNS LIST =============
  app.get("/api/admin/scraper/runs", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
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
    } catch (err) {
      console.error("Scraper runs error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch scraper runs", errorMessage));
    }
  });

  // ============= SCRAPER RUN DETAIL =============
  app.get("/api/admin/scraper/runs/:id", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const idSchema = z.coerce.number().int().min(1);
      const parseResult = idSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        return res.status(400).json(createErrorResponse("Invalid run ID"));
      }

      const run = await storage.getScraperRunById(parseResult.data);
      if (!run) {
        return res.status(404).json(createErrorResponse("Scraper run not found"));
      }

      res.json({ success: true, run });
    } catch (err) {
      console.error("Scraper run detail error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch scraper run", errorMessage));
    }
  });
}
