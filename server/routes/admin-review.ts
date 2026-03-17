/**
 * Admin review queue routes — /api/admin/review/*
 *
 * Manages change requests submitted by the scraper or admin users.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { adminAuth, adminReadLimiter, adminWriteLimiter } from "../middleware/adminAuth";
import { createErrorResponse } from "../helpers/errors";
import { db } from "../db";
import { services, serviceChangeRequests } from "@shared/schema";
import { or, ilike, eq, sql, and } from "drizzle-orm";

const bulkApproveSchema = z.object({
  ids: z.array(z.number().int().min(1)).min(1).max(50),
});

const rejectSchema = z.object({
  reason: z.string().min(1).max(1000).trim(),
});

const updateChangeRequestSchema = z.object({
  proposedChanges: z.record(z.unknown()).optional(),
  reviewNotes: z.string().max(1000).optional(),
});

export function registerAdminReviewRoutes(app: Express): void {
  // ============= LIST CHANGE REQUESTS =============
  app.get("/api/admin/review", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const params = {
        status: req.query.status as string | undefined,
        source: req.query.source as string | undefined,
        changeType: req.query.changeType as string | undefined,
        batchId: req.query.batchId as string | undefined,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      };

      const result = await storage.getChangeRequests(params);

      // Join service names for display
      const serviceIds = result.requests
        .map((r) => r.serviceId)
        .filter((id): id is number => id != null);
      const serviceNames: Record<number, string> = {};
      if (serviceIds.length > 0) {
        const nameRows = await db
          .select({ id: services.id, name: services.name })
          .from(services)
          .where(sql`${services.id} IN ${serviceIds}`);
        for (const row of nameRows) {
          serviceNames[row.id] = row.name;
        }
      }

      const changeRequests = result.requests.map((r) => ({
        ...r,
        serviceName: r.serviceId ? serviceNames[r.serviceId] ?? null : null,
        createdAt: r.submittedAt,
      }));

      res.json({ success: true, changeRequests, total: result.total });
    } catch (err) {
      console.error("Review list error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch change requests", errorMessage));
    }
  });

  // ============= FLAG FOR REVIEW =============
  app.post("/api/admin/review/flag", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        serviceId: z.number().int().min(1),
        reason: z.string().max(500).optional(),
        missingFields: z.array(z.string()).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(createErrorResponse("Invalid request", undefined, parsed.error.issues));
      }

      const { serviceId, reason, missingFields } = parsed.data;

      // Check if there's already a pending review for this service
      const existing = await db
        .select({ id: serviceChangeRequests.id })
        .from(serviceChangeRequests)
        .where(and(
          eq(serviceChangeRequests.serviceId, serviceId),
          eq(serviceChangeRequests.status, "pending"),
          eq(serviceChangeRequests.source, "admin"),
          eq(serviceChangeRequests.changeType, "review"),
        ))
        .limit(1);

      if (existing.length > 0) {
        return res.json({ success: true, message: "Already flagged for review", id: existing[0].id });
      }

      const [created] = await db
        .insert(serviceChangeRequests)
        .values({
          serviceId,
          changeType: "review",
          source: "admin",
          status: "pending",
          proposedChanges: { reason: reason || "Flagged from quality issues", missingFields: missingFields || [] },
        })
        .returning({ id: serviceChangeRequests.id });

      res.json({ success: true, id: created.id });
    } catch (err) {
      console.error("Flag for review error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to flag for review", errorMessage));
    }
  });

  // ============= BULK APPROVE (must be before :id routes) =============
  app.post("/api/admin/review/bulk-approve", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const parsed = bulkApproveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(
          createErrorResponse("Invalid request body", undefined, parsed.error.issues)
        );
      }

      const count = await storage.bulkApproveChangeRequests(parsed.data.ids);
      res.json({ success: true, approved: count });
    } catch (err) {
      console.error("Bulk approve error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to bulk approve", errorMessage));
    }
  });

  // ============= GET CHANGE REQUEST DETAIL =============
  app.get("/api/admin/review/:id", adminReadLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const idSchema = z.coerce.number().int().min(1);
      const parseResult = idSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        return res.status(400).json(createErrorResponse("Invalid change request ID"));
      }

      const request = await storage.getChangeRequestById(parseResult.data);
      if (!request) {
        return res.status(404).json(createErrorResponse("Change request not found"));
      }

      // Duplicate detection for 'create' change requests
      let duplicateWarning: { serviceId: number; serviceName: string; matchType: string } | null = null;
      if (request.changeType === 'create' && request.proposedChanges) {
        const proposed = request.proposedChanges as Record<string, any>;
        const conditions = [];

        if (proposed.phone) {
          conditions.push(eq(services.phone, proposed.phone));
        }
        if (proposed.name) {
          conditions.push(ilike(services.name, `%${proposed.name}%`));
        }

        if (conditions.length > 0) {
          const matches = await db
            .select({ id: services.id, name: services.name, phone: services.phone })
            .from(services)
            .where(or(...conditions))
            .limit(1);

          if (matches.length > 0) {
            const match = matches[0];
            const matchType = proposed.phone && match.phone === proposed.phone ? 'phone' : 'name';
            duplicateWarning = {
              serviceId: match.id,
              serviceName: match.name,
              matchType,
            };
          }
        }
      }

      res.json({ success: true, request, duplicateWarning });
    } catch (err) {
      console.error("Review detail error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to fetch change request", errorMessage));
    }
  });

  // ============= APPROVE CHANGE REQUEST =============
  app.post("/api/admin/review/:id/approve", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const idSchema = z.coerce.number().int().min(1);
      const parseResult = idSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        return res.status(400).json(createErrorResponse("Invalid change request ID"));
      }

      const service = await storage.approveChangeRequest(parseResult.data);
      res.json({ success: true, service });
    } catch (err) {
      console.error("Approve error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to approve change request", errorMessage));
    }
  });

  // ============= REJECT CHANGE REQUEST =============
  app.post("/api/admin/review/:id/reject", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const idSchema = z.coerce.number().int().min(1);
      const parseResult = idSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        return res.status(400).json(createErrorResponse("Invalid change request ID"));
      }

      const parsed = rejectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(
          createErrorResponse("Invalid request body", undefined, parsed.error.issues)
        );
      }

      await storage.rejectChangeRequest(parseResult.data, parsed.data.reason);
      res.json({ success: true });
    } catch (err) {
      console.error("Reject error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to reject change request", errorMessage));
    }
  });

  // ============= UPDATE CHANGE REQUEST =============
  app.patch("/api/admin/review/:id", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const idSchema = z.coerce.number().int().min(1);
      const parseResult = idSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        return res.status(400).json(createErrorResponse("Invalid change request ID"));
      }

      const parsed = updateChangeRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(
          createErrorResponse("Invalid request body", undefined, parsed.error.issues)
        );
      }

      const updated = await storage.updateChangeRequest(parseResult.data, parsed.data as any);
      res.json({ success: true, request: updated });
    } catch (err) {
      console.error("Update change request error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Failed to update change request", errorMessage));
    }
  });
}
