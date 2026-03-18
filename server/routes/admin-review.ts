/**
 * Admin review queue routes — /api/admin/review/*
 *
 * Manages change requests submitted by the scraper or admin users.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { adminAuth, adminReadLimiter, adminWriteLimiter } from "../middleware/adminAuth";
import { asyncHandler, createErrorResponse } from "../helpers/errors";
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
  app.get("/api/admin/review", adminReadLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
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
  }));

  // ============= FLAG FOR REVIEW =============
  app.post("/api/admin/review/flag", adminWriteLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
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
  }));

  // ============= BULK APPROVE (must be before :id routes) =============
  app.post("/api/admin/review/bulk-approve", adminWriteLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const parsed = bulkApproveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(
        createErrorResponse("Invalid request body", undefined, parsed.error.issues)
      );
    }

    const count = await storage.bulkApproveChangeRequests(parsed.data.ids);
    res.json({ success: true, approved: count });
  }));

  // ============= GET CHANGE REQUEST DETAIL =============
  app.get("/api/admin/review/:id", adminReadLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
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

    // For review-flagged and update items, include current service data for diffing/editing
    let currentServiceData: Record<string, any> | null = null;
    if ((request.changeType === 'review' || request.changeType === 'update') && request.serviceId) {
      const [svc] = await db.select().from(services).where(eq(services.id, request.serviceId)).limit(1);
      if (svc) {
        currentServiceData = {
          id: svc.id,
          name: svc.name,
          category: svc.category,
          description: svc.description || '',
          location: svc.location || '',
          eligibility: svc.eligibility || '',
          processSteps: svc.processSteps,
          hoursOfOperation: svc.hoursOfOperation || '',
          phone: svc.phone || '',
          email: svc.email || '',
          websiteUrl: svc.websiteUrl || '',
          address: svc.address || '',
        };
      }
    }

    // Add serviceName from join
    let serviceName: string | null = null;
    if (request.serviceId) {
      const [svc] = await db.select({ name: services.name }).from(services).where(eq(services.id, request.serviceId)).limit(1);
      serviceName = svc?.name ?? null;
    }

    res.json({
      success: true,
      request: { ...request, serviceName, createdAt: request.submittedAt, currentServiceData, currentData: currentServiceData },
      duplicateWarning,
    });
  }));

  // ============= APPROVE CHANGE REQUEST =============
  app.post("/api/admin/review/:id/approve", adminWriteLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
    const idSchema = z.coerce.number().int().min(1);
    const parseResult = idSchema.safeParse(req.params.id);
    if (!parseResult.success) {
      return res.status(400).json(createErrorResponse("Invalid change request ID"));
    }

    const service = await storage.approveChangeRequest(parseResult.data);
    res.json({ success: true, service });
  }));

  // ============= REJECT CHANGE REQUEST =============
  app.post("/api/admin/review/:id/reject", adminWriteLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
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
  }));

  // ============= UPDATE CHANGE REQUEST =============
  app.patch("/api/admin/review/:id", adminWriteLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
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
  }));
}
