/**
 * Admin feedback routes — /api/admin/feedback/*
 *
 * Read-only endpoints for viewing user feedback messages and service vote aggregates.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { feedback } from "@shared/schema";
import { desc } from "drizzle-orm";
import { adminAuth, adminReadLimiter } from "../middleware/adminAuth";
import { createErrorResponse } from "../helpers/errors";

export function registerAdminFeedbackRoutes(app: Express): void {
  // ============= FEEDBACK MESSAGES =============
  app.get("/api/admin/feedback", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const pageSchema = z.coerce.number().int().min(1).default(1);
      const limitSchema = z.coerce.number().int().min(1).max(100).default(50);

      const page = pageSchema.parse(req.query.page ?? 1);
      const limit = limitSchema.parse(req.query.limit ?? 50);
      const offset = (page - 1) * limit;

      const [messages, countResult] = await Promise.all([
        db
          .select()
          .from(feedback)
          .orderBy(desc(feedback.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: sql<number>`count(*)::int` }).from(feedback),
      ]);

      const total = countResult[0]?.count ?? 0;

      res.json({
        success: true,
        messages,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      console.error("Admin feedback list error:", err);
      const errorMessage = process.env.NODE_ENV === "production" ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch feedback", errorMessage));
    }
  });

  // ============= SERVICE VOTES (AGGREGATED) =============
  app.get("/api/admin/feedback/votes", adminReadLimiter, adminAuth, async (_req: Request, res: Response) => {
    try {
      const votes = await db.execute(sql`
        SELECT
          sv.service_id,
          s.name as service_name,
          s.category,
          COUNT(*) FILTER (WHERE sv.vote = 'up') as thumbs_up,
          COUNT(*) FILTER (WHERE sv.vote = 'down') as thumbs_down,
          COUNT(*) as total_votes
        FROM service_votes sv
        JOIN services s ON sv.service_id = s.service_id
        GROUP BY sv.service_id, s.name, s.category
        ORDER BY COUNT(*) DESC
        LIMIT 100
      `);

      res.json({
        success: true,
        votes: votes.rows,
      });
    } catch (err) {
      console.error("Admin service votes error:", err);
      const errorMessage = process.env.NODE_ENV === "production" ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch service votes", errorMessage));
    }
  });
}
