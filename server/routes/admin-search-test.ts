/**
 * Admin search test routes — /api/admin/search-test
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { adminAuth, adminWriteLimiter } from "../middleware/adminAuth";
import { createErrorResponse } from "../helpers/errors";
import { diagnoseQuery } from "../search/diagnose";

const searchTestSchema = z.object({
  query: z.string().min(1).max(500).trim(),
  filters: z.record(z.unknown()).optional(),
});

export function registerAdminSearchTestRoutes(app: Express): void {
  // ============= SEARCH DIAGNOSIS =============
  app.post("/api/admin/search-test", adminWriteLimiter, adminAuth, async (req: Request, res: Response) => {
    try {
      const parsed = searchTestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(
          createErrorResponse("Invalid request body", undefined, parsed.error.issues)
        );
      }

      const { query, filters } = parsed.data;
      const result = await diagnoseQuery(query, filters);

      res.json({ success: true, ...result });
    } catch (err) {
      console.error("Search test error:", err);
      const errorMessage = process.env.NODE_ENV === 'production' ? undefined : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Search test failed", errorMessage));
    }
  });
}
