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

    // Allowlist validation — these keys map to hardcoded SQL in quality-storage.ts.
    // Reject anything not in the set to prevent future sql.raw() injection if the map grows carelessly.
    const VALID_FIELDS = new Set([
      'phone', 'email', 'noContact', 'websiteUrl', 'name', 'description',
      'eligibility', 'address', 'lowConfidence', 'hoursOfOperation', 'waitTimes',
      'serviceFormat', 'processSteps', 'requiredDocs', 'languagesSupported', 'tags',
      'freshEmbedding', 'freshGeocoding', 'latitude', 'embedding',
      'staleEmbedding', 'staleGeocoding',
    ]);
    const VALID_SEVERITIES = new Set(['critical', 'high', 'medium']);

    const rawField = typeof req.query.field === 'string' ? req.query.field : undefined;
    const rawSeverity = typeof req.query.severity === 'string' ? req.query.severity : undefined;
    const fieldFilter = rawField && VALID_FIELDS.has(rawField) ? rawField : undefined;
    const severityFilter = rawSeverity && VALID_SEVERITIES.has(rawSeverity) ? rawSeverity : undefined;

    const result = await storage.getQualityIssues({ page, limit, fieldFilter, severityFilter });
    res.json({ success: true, ...result });
  }));
}
