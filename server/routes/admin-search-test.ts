/**
 * Admin search test routes — /api/admin/search-test
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { adminAuth, adminWriteLimiter } from "../middleware/adminAuth";
import { asyncHandler, createErrorResponse } from "../helpers/errors";
import { diagnoseQuery } from "../search/diagnose";

const searchTestSchema = z.object({
  query: z.string().min(1).max(500).trim(),
  filters: z.record(z.unknown()).optional(),
});

export function registerAdminSearchTestRoutes(app: Express): void {
  // ============= SEARCH DIAGNOSIS =============
  app.post("/api/admin/search-test", adminWriteLimiter, adminAuth, asyncHandler(async (req: Request, res: Response) => {
      const parsed = searchTestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(
          createErrorResponse("Invalid request body", undefined, parsed.error.issues)
        );
      }

      const { query, filters } = parsed.data;
      const result = await diagnoseQuery(query, filters);

      res.json({ success: true, ...result });
  }));
}
