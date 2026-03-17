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

function parseDays(raw: unknown): number {
  const result = daysSchema.safeParse(raw);
  return result.success ? result.data : 30;
}

export function registerAdminAnalyticsRoutes(app: Express): void {
  // ============= SEARCH ANALYTICS (grouped by query) =============
  app.get("/api/admin/analytics/searches", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const days = parseDays(req.query.days);

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
      const days = parseDays(req.query.days);

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const results = await db.execute(sql`
        SELECT
          sa.clicked_service_id AS "serviceId",
          s.name AS "serviceName",
          s.category AS "category",
          COUNT(*)::int AS "clickCount",
          MAX(sa.created_at) AS "lastClicked"
        FROM search_analytics sa
        LEFT JOIN services s ON s.service_id = sa.clicked_service_id
        WHERE sa.clicked_service_id IS NOT NULL
          AND sa.created_at >= ${cutoff}
        GROUP BY sa.clicked_service_id, s.name, s.category
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

  // ============= OVERVIEW — summary stats =============
  app.get("/api/admin/analytics/overview", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const days = parseDays(req.query.days);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const results = await db.execute(sql`
        SELECT
          COUNT(*)::int AS "totalClicks",
          COUNT(DISTINCT normalized_query)::int AS "uniqueQueries",
          COUNT(DISTINCT clicked_service_id)::int AS "uniqueServicesClicked",
          ROUND(AVG(click_position)::numeric, 1)::float AS "avgClickPosition",
          ROUND(AVG(result_count)::numeric, 1)::float AS "avgResultCount"
        FROM search_analytics
        WHERE created_at >= ${cutoff}
      `);

      const row = results.rows[0] || {
        totalClicks: 0,
        uniqueQueries: 0,
        uniqueServicesClicked: 0,
        avgClickPosition: null,
        avgResultCount: null,
      };

      res.json({ success: true, overview: row, days });
    } catch (err) {
      console.error("Admin overview analytics error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch overview analytics", errorMessage));
    }
  });

  // ============= CATEGORY DISTRIBUTION — clicks by service category =============
  app.get("/api/admin/analytics/categories", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const days = parseDays(req.query.days);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const results = await db.execute(sql`
        SELECT s.category, COUNT(*)::int AS clicks
        FROM search_analytics sa
        JOIN services s ON sa.clicked_service_id = s.service_id
        WHERE sa.clicked_service_id IS NOT NULL
          AND sa.created_at >= ${cutoff}
        GROUP BY s.category
        ORDER BY clicks DESC
      `);

      res.json({ success: true, categories: results.rows, days });
    } catch (err) {
      console.error("Admin category analytics error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch category analytics", errorMessage));
    }
  });

  // ============= TRENDS — daily click volume =============
  app.get("/api/admin/analytics/trends", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const days = parseDays(req.query.days);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const results = await db.execute(sql`
        SELECT
          DATE(created_at)::text AS date,
          COUNT(*)::int AS clicks,
          COUNT(DISTINCT normalized_query)::int AS "uniqueQueries"
        FROM search_analytics
        WHERE created_at >= ${cutoff}
        GROUP BY DATE(created_at)
        ORDER BY date
      `);

      res.json({ success: true, trends: results.rows, days });
    } catch (err) {
      console.error("Admin trends analytics error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch trends analytics", errorMessage));
    }
  });

  // ============= HOURS — hour-of-day distribution =============
  app.get("/api/admin/analytics/hours", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const days = parseDays(req.query.days);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const results = await db.execute(sql`
        SELECT
          EXTRACT(HOUR FROM created_at)::int AS hour,
          COUNT(*)::int AS clicks
        FROM search_analytics
        WHERE created_at >= ${cutoff}
        GROUP BY hour
        ORDER BY hour
      `);

      res.json({ success: true, hours: results.rows, days });
    } catch (err) {
      console.error("Admin hours analytics error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch hours analytics", errorMessage));
    }
  });

  // ============= POSITIONS — click position distribution =============
  app.get("/api/admin/analytics/positions", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const days = parseDays(req.query.days);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const results = await db.execute(sql`
        SELECT
          click_position AS position,
          COUNT(*)::int AS clicks
        FROM search_analytics
        WHERE click_position IS NOT NULL
          AND created_at >= ${cutoff}
        GROUP BY click_position
        ORDER BY click_position
      `);

      res.json({ success: true, positions: results.rows, days });
    } catch (err) {
      console.error("Admin positions analytics error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch positions analytics", errorMessage));
    }
  });
}
