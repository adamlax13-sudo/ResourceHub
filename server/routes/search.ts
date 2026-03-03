/**
 * Search routes — /api/search, /api/services/:id
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { api } from "@shared/routes";
import { strictLimiter } from "../middleware/rateLimiter";
import { search, getServiceDetails } from "../search";
import { createErrorResponse } from "../helpers/errors";

export function registerSearchRoutes(app: Express): void {
  // ============= SEARCH ENDPOINT =============
  app.post(api.search.query.path, strictLimiter, async (req: Request, res: Response) => {
    try {
      const input = api.search.query.input.parse(req.body);

      // Honeypot check: bots fill hidden fields, humans don't
      if (input.hp) {
        return res.json({ services: [], summary: "No results found." });
      }

      // Call the search orchestrator
      const activeFilters = {
        category: input.category,
        genderRestriction: input.genderRestriction,
        ageGroup: input.ageGroup,
        is24_7: input.is24_7,
        isFaithBased: input.isFaithBased,
        is12Step: input.is12Step,
        languagesSupported: input.languagesSupported,
        serviceFormat: input.serviceFormat,
      };
      const hasFilters = Object.values(activeFilters).some(v => v !== undefined);

      const result = await search({
        query: input.query,
        location: input.location,
        page: input.page ?? 1,
        pageSize: input.pageSize ?? 20,
        debug: input.debug,
        filters: hasFilters ? activeFilters : undefined,
      });

      res.json(result);
    } catch (err) {
      console.error("Search error:", err);
      // Don't expose internal error details to clients in production
      const errorMessage = process.env.NODE_ENV === 'production'
        ? undefined
        : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Search failed", errorMessage));
    }
  });

  // ============= SERVICE DETAIL ENDPOINT =============
  // Get full service details by ID (loaded when user expands a card)
  app.get("/api/services/:id", async (req: Request, res: Response) => {
    try {
      // Validate service ID parameter
      const idSchema = z.string().min(1).max(255);
      const parseResult = idSchema.safeParse(req.params.id);
      if (!parseResult.success) {
        return res.status(400).json(createErrorResponse("Invalid service ID"));
      }
      const id = parseResult.data;

      const serviceDetails = await getServiceDetails(id);

      if (!serviceDetails) {
        return res.status(404).json(createErrorResponse("Service not found"));
      }

      res.json(serviceDetails);
    } catch (err) {
      console.error("Service detail error:", err);
      res.status(500).json(createErrorResponse("Failed to fetch service details"));
    }
  });
}
