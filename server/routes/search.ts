/**
 * Search routes — /api/search, /api/services/:id
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { api, serviceSummarySchema } from "@shared/routes";
import { strictLimiter } from "../middleware/rateLimiter";
import { search, getServiceDetails } from "../search";
import { asyncHandler, createErrorResponse } from "../helpers/errors";

export function registerSearchRoutes(app: Express): void {
  // ============= SEARCH ENDPOINT =============
  app.post(api.search.query.path, strictLimiter, asyncHandler(async (req: Request, res: Response) => {
      const input = api.search.query.input.parse(req.body);

      // Honeypot check: bots fill hidden fields, humans don't
      if (input.hp) {
        return res.json({ services: [], summary: "No results found." });
      }

      // Call the search orchestrator
      const activeFilters = {
        categories: input.categories?.length ? input.categories : undefined,
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
        pageSize: input.pageSize ?? 30,
        debug: process.env.ENABLE_DEBUG_SEARCH === 'true',
        emergency: input.emergency,
        filters: hasFilters ? activeFilters : undefined,
        userLat: input.userLat,
        userLng: input.userLng,
        maxDistanceKm: input.maxDistanceKm,
        sortByDistance: input.sortByDistance,
      });

      // Strip internal fields (rrfScore, matchType, filter flags) from response
      const strippedServices = result.services.map((s) => serviceSummarySchema.parse(s));
      res.json({ ...result, services: strippedServices });
  }));

  // ============= SERVICE DETAIL ENDPOINT =============
  // Get full service details by ID (loaded when user expands a card)
  app.get("/api/services/:id", asyncHandler(async (req: Request, res: Response) => {
      // Validate service ID parameter
      const idSchema = z.string().min(1).max(200).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid service ID format');
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
  }));
}
