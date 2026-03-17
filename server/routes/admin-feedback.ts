/**
 * Admin feedback routes — /api/admin/feedback/*
 *
 * Endpoints for viewing user feedback messages, updating status, and service vote aggregates.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { sql, eq, and, desc } from "drizzle-orm";
import { feedback } from "@shared/schema";
import { adminAuth, adminReadLimiter, adminWriteLimiter } from "../middleware/adminAuth";
import { createErrorResponse } from "../helpers/errors";

const FEEDBACK_TYPES = ["incorrect_info", "service_closed", "missing_service", "bad_search", "general"] as const;
const FEEDBACK_STATUSES = ["new", "reviewed", "resolved"] as const;

export function registerAdminFeedbackRoutes(app: Express): void {
  // ============= FEEDBACK MESSAGES (with filtering) =============
  app.get("/api/admin/feedback", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const pageSchema = z.coerce.number().int().min(1).default(1);
      const limitSchema = z.coerce.number().int().min(1).max(100).default(50);
      const typeSchema = z.enum(FEEDBACK_TYPES).optional();
      const statusSchema = z.enum(FEEDBACK_STATUSES).optional();

      const page = pageSchema.parse(req.query.page ?? 1);
      const limit = limitSchema.parse(req.query.limit ?? 50);
      const type = typeSchema.safeParse(req.query.type).success ? typeSchema.parse(req.query.type) : undefined;
      const status = statusSchema.safeParse(req.query.status).success ? statusSchema.parse(req.query.status) : undefined;
      const offset = (page - 1) * limit;

      // Build where conditions
      const conditions = [];
      if (type) conditions.push(eq(feedback.type, type));
      if (status) conditions.push(eq(feedback.status, status));
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [messages, countResult] = await Promise.all([
        db
          .select()
          .from(feedback)
          .where(whereClause)
          .orderBy(desc(feedback.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: sql<number>`count(*)::int` }).from(feedback).where(whereClause),
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

  // ============= NEW FEEDBACK COUNT =============
  app.get("/api/admin/feedback/count", adminReadLimiter, adminAuth, async (_req: Request, res: Response) => {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(feedback)
        .where(eq(feedback.status, "new"));

      res.json({ success: true, count: result[0]?.count ?? 0 });
    } catch (err) {
      console.error("Admin feedback count error:", err);
      const errorMessage = process.env.NODE_ENV === "production" ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch feedback count", errorMessage));
    }
  });

  // ============= UPDATE FEEDBACK STATUS =============
  app.patch("/api/admin/feedback/:id/status", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const idSchema = z.coerce.number().int().min(1);
      const bodySchema = z.object({ status: z.enum(FEEDBACK_STATUSES) });

      const id = idSchema.parse(req.params.id);
      const { status } = bodySchema.parse(req.body);

      const [updated] = await db
        .update(feedback)
        .set({ status })
        .where(eq(feedback.id, id))
        .returning();

      if (!updated) {
        res.status(404).json(createErrorResponse("Feedback not found"));
        return;
      }

      res.json({ success: true, feedback: updated });
    } catch (err) {
      console.error("Admin feedback status update error:", err);
      const errorMessage = process.env.NODE_ENV === "production" ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to update feedback status", errorMessage));
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
