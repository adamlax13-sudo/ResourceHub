/**
 * Admin analytics routes — /api/admin/analytics/*
 *
 * Aggregated search and service analytics from the search_analytics table.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { adminAuth, adminReadLimiter } from "../middleware/adminAuth";
import { createErrorResponse } from "../helpers/errors";
import { db } from "../db";
import { sql } from "drizzle-orm";

const daysSchema = z.coerce.number().int().min(1).max(365).default(30);

export function registerAdminAnalyticsRoutes(app: Express): void {
  // ============= SEARCH ANALYTICS (grouped by query) =============
  app.get("/api/admin/analytics/searches", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const days = daysSchema.safeParse(req.query.days).success
        ? daysSchema.parse(req.query.days)
        : 30;

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const results = await db.execute(sql`
        SELECT
          normalized_query AS query,
          COUNT(*)::int AS "searchCount",
          COUNT(clicked_service_id)::int AS "clickCount",
          MAX(created_at) AS "lastSearched"
        FROM search_analytics
        WHERE created_at >= ${cutoff}
        GROUP BY normalized_query
        ORDER BY COUNT(*) DESC
        LIMIT 50
      `);

      res.json({ success: true, searches: results.rows, days });
    } catch (err) {
      console.error("Admin search analytics error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch search analytics", errorMessage));
    }
  });

  // ============= SERVICE ANALYTICS (grouped by service) =============
  app.get("/api/admin/analytics/services", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const days = daysSchema.safeParse(req.query.days).success
        ? daysSchema.parse(req.query.days)
        : 30;

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const results = await db.execute(sql`
        SELECT
          sa.clicked_service_id AS "serviceId",
          s.name AS "serviceName",
          COUNT(*)::int AS "clickCount",
          MAX(sa.created_at) AS "lastClicked"
        FROM search_analytics sa
        LEFT JOIN services s ON s.service_id = sa.clicked_service_id
        WHERE sa.clicked_service_id IS NOT NULL
          AND sa.created_at >= ${cutoff}
        GROUP BY sa.clicked_service_id, s.name
        ORDER BY COUNT(*) DESC
        LIMIT 50
      `);

      res.json({ success: true, services: results.rows, days });
    } catch (err) {
      console.error("Admin service analytics error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch service analytics", errorMessage));
    }
  });
}
