/**
 * Admin analytics routes — /api/admin/analytics/*
 *
 * Aggregated search and service analytics from the search_analytics table.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { adminAuth, adminReadLimiter } from "../middleware/adminAuth";
import { asyncHandler } from "../helpers/errors";
import { db } from "../db";
import { sql } from "drizzle-orm";

const daysSchema = z.coerce.number().int().min(1).max(365).default(30);

function parseDays(raw: unknown): number {
  const result = daysSchema.safeParse(raw);
  return result.success ? result.data : 30;
}

export function registerAdminAnalyticsRoutes(app: Express): void {
  // ============= SEARCH ANALYTICS (grouped by query) =============
  app.get("/api/admin/analytics/searches", adminReadLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
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
  }));

  // ============= SERVICE ANALYTICS (grouped by service) =============
  app.get("/api/admin/analytics/services", adminReadLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
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
  }));

  // ============= OVERVIEW — summary stats =============
  app.get("/api/admin/analytics/overview", adminReadLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const days = parseDays(req.query.days);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const results = await db.execute(sql`
      SELECT
        COUNT(*)::int AS "totalSearches",
        COUNT(*) FILTER (WHERE clicked_service_id IS NOT NULL)::int AS "totalClicks",
        COUNT(DISTINCT normalized_query)::int AS "uniqueQueries",
        COUNT(DISTINCT clicked_service_id) FILTER (WHERE clicked_service_id IS NOT NULL)::int AS "uniqueServicesClicked",
        ROUND(AVG(click_position) FILTER (WHERE click_position IS NOT NULL)::numeric, 1)::float AS "avgClickPosition",
        ROUND(AVG(result_count)::numeric, 1)::float AS "avgResultCount",
        COUNT(DISTINCT CONCAT(DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Edmonton'), '|', COALESCE(LEFT(user_agent, 100), 'unknown')))::int AS "approximateVisitors"
      FROM search_analytics
      WHERE created_at >= ${cutoff}
    `);

    const row = results.rows[0] || {
      totalSearches: 0,
      totalClicks: 0,
      approximateVisitors: 0,
      uniqueQueries: 0,
      uniqueServicesClicked: 0,
      avgClickPosition: null,
      avgResultCount: null,
    };

    res.json({ success: true, overview: row, days });
  }));

  // ============= CATEGORY DISTRIBUTION — clicks by service category =============
  app.get("/api/admin/analytics/categories", adminReadLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
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
  }));

  // ============= TRENDS — daily click volume =============
  app.get("/api/admin/analytics/trends", adminReadLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const days = parseDays(req.query.days);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const results = await db.execute(sql`
      SELECT
        DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Edmonton')::text AS date,
        COUNT(*)::int AS searches,
        COUNT(*) FILTER (WHERE clicked_service_id IS NOT NULL)::int AS clicks,
        COUNT(DISTINCT normalized_query)::int AS "uniqueQueries",
        COUNT(DISTINCT COALESCE(LEFT(user_agent, 100), 'unknown'))::int AS visitors
      FROM search_analytics
      WHERE created_at >= ${cutoff}
      GROUP BY DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Edmonton')
      ORDER BY date
    `);

    res.json({ success: true, trends: results.rows, days });
  }));

  // ============= HOURS — hour-of-day distribution =============
  app.get("/api/admin/analytics/hours", adminReadLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const days = parseDays(req.query.days);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const results = await db.execute(sql`
      SELECT
        EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Edmonton')::int AS hour,
        COUNT(*)::int AS clicks
      FROM search_analytics
      WHERE created_at >= ${cutoff}
      GROUP BY hour
      ORDER BY hour
    `);

    res.json({ success: true, hours: results.rows, days });
  }));

  // ============= DEVICES — device breakdown from user_agent =============
  app.get("/api/admin/analytics/devices", adminReadLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const days = parseDays(req.query.days);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const results = await db.execute(sql`
      SELECT
        CASE
          WHEN user_agent ILIKE '%mobile%' OR user_agent ILIKE '%android%' OR user_agent ILIKE '%iphone%' THEN 'Mobile'
          WHEN user_agent ILIKE '%tablet%' OR user_agent ILIKE '%ipad%' THEN 'Tablet'
          ELSE 'Desktop'
        END as device_type,
        COUNT(*)::int as clicks
      FROM search_analytics
      WHERE created_at >= ${cutoff}
        AND user_agent IS NOT NULL
      GROUP BY device_type
      ORDER BY clicks DESC
    `);

    res.json({ success: true, devices: results.rows, days });
  }));

  // ============= NO-CLICKS — searches with results but no clicks =============
  app.get("/api/admin/analytics/no-clicks", adminReadLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const days = parseDays(req.query.days);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const results = await db.execute(sql`
      SELECT sa.query, MAX(sa.result_count)::int as "resultCount", COUNT(*)::int as "searchCount"
      FROM search_analytics sa
      WHERE sa.clicked_service_id IS NULL
        AND sa.result_count > 0
        AND sa.created_at >= ${cutoff}
      GROUP BY sa.query
      ORDER BY COUNT(*) DESC
      LIMIT 20
    `);

    res.json({ success: true, noClicks: results.rows, days });
  }));

  // ============= SESSIONS — session depth =============
  app.get("/api/admin/analytics/sessions", adminReadLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const days = parseDays(req.query.days);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const results = await db.execute(sql`
      SELECT
        session_depth AS "sessionDepth",
        COUNT(*)::int AS "sessionCount"
      FROM (
        SELECT session_id, COUNT(*)::int AS session_depth
        FROM search_analytics
        WHERE session_id IS NOT NULL
          AND created_at >= ${cutoff}
        GROUP BY session_id
      ) sub
      GROUP BY session_depth
      ORDER BY session_depth
      LIMIT 10
    `);

    res.json({ success: true, sessions: results.rows, days });
  }));

  // ============= POSITIONS — click position distribution =============
  app.get("/api/admin/analytics/positions", adminReadLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
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
  }));
}
