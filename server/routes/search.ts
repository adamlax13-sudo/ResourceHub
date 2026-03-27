/**
 * Search routes — /api/search, /api/services/:id
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { api, serviceSummarySchema } from "@shared/routes";
import { createHash, timingSafeEqual } from "crypto";
import { strictLimiter } from "../middleware/rateLimiter";
import { search, getServiceDetails } from "../search";
import { asyncHandler, createErrorResponse } from "../helpers/errors";
import { getOrTranslateService, getTranslationsBatch } from "../translation";
import { storage } from "../storage";
import { normalizeForCache } from "../helpers/keywords";
import { verifyToken } from "./admin-auth";

/** Check if a request has valid admin auth (non-blocking, no 401) */
function isAdminRequest(req: Request): boolean {
  const adminApiKey = process.env.ADMIN_API_KEY;
  if (!adminApiKey) return false;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const hashA = createHash('sha256').update(token).digest();
    const hashB = createHash('sha256').update(adminApiKey).digest();
    return timingSafeEqual(hashA, hashB);
  }
  const cookieValue = (req as any).cookies?.admin_session as string | undefined;
  return !!(cookieValue && verifyToken(cookieValue));
}

const SUPPORTED_LANGS = new Set(['en', 'fr', 'es', 'zh', 'ar', 'hi', 'pt', 'de', 'ja', 'ko']);

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
        debug: process.env.ENABLE_DEBUG_SEARCH === 'true' && isAdminRequest(req),
        emergency: input.emergency,
        filters: hasFilters ? activeFilters : undefined,
        userLat: input.userLat,
        userLng: input.userLng,
        maxDistanceKm: input.maxDistanceKm,
        sortByDistance: input.sortByDistance,
      });

      // Strip internal fields (rrfScore, matchType, filter flags) from response
      const strippedServices = result.services.map((s) => serviceSummarySchema.parse(s));

      // Apply translations if a non-English language is requested
      const lang = input.lang && SUPPORTED_LANGS.has(input.lang) ? input.lang : undefined;
      let translationMissing = false;
      if (lang && lang !== 'en') {
        try {
          const serviceIds = strippedServices.map(s => s.id);
          const translations = await getTranslationsBatch(serviceIds, lang);

          let translated = 0;
          for (const svc of strippedServices) {
            const t = translations.get(svc.id);
            if (t) {
              if (t.name) svc.name = t.name;
              if (t.description) svc.description = t.description;
              if (t.waitTimes) svc.waitTimes = t.waitTimes;
              translated++;
            }
          }
          // Flag if most services couldn't be translated
          if (strippedServices.length > 0 && translated < strippedServices.length / 2) {
            translationMissing = true;
          }
        } catch {
          translationMissing = true;
        }
      }

      // Track search (fire-and-forget — don't block response)
      const userAgentHeader = req.headers['user-agent'];
      const userAgent = (Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader)?.slice(0, 500);
      const sessionIdHeader = req.headers['x-session-id'];
      const sessionIdRaw = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;
      const SESSION_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const sessionId = sessionIdRaw && SESSION_UUID_RE.test(sessionIdRaw) ? sessionIdRaw.slice(0, 36) : undefined;

      storage.trackSearchClick({
        query: input.query,
        normalizedQuery: normalizeForCache(input.query),
        resultCount: strippedServices.length,
        clickedServiceId: undefined,
        clickPosition: undefined,
        sessionId,
        userAgent,
      }).catch(err => {
        console.error('Failed to track search:', err);
      });

      // Record search quality metric (fire-and-forget)
      if (sessionId) {
        storage.recordSearchQuality({
          sessionId,
          query: input.query,
          queryNormalized: normalizeForCache(input.query),
          resultCount: strippedServices.length,
        }).catch(() => {});
      }

      res.json({ ...result, services: strippedServices, ...(translationMissing ? { translationMissing: true } : {}) });
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

      // Apply translation if ?lang= is a valid supported language
      const rawLang = typeof req.query.lang === 'string' ? req.query.lang : undefined;
      const lang = rawLang && SUPPORTED_LANGS.has(rawLang) ? rawLang : undefined;
      if (lang && lang !== 'en') {
        const sourceFields = {
          name: serviceDetails.name,
          description: serviceDetails.description || '',
          eligibility: serviceDetails.eligibility || '',
          waitTimes: serviceDetails.waitTimes || '',
          hoursOfOperation: serviceDetails.hoursOfOperation || '',
          address: serviceDetails.address || '',
          processSteps: serviceDetails.process || [],
          requiredDocs: serviceDetails.requiredDocs || [],
        };

        const translated = await getOrTranslateService(id, lang, sourceFields);
        if (translated) {
          if (translated.name) serviceDetails.name = translated.name;
          if (translated.description) serviceDetails.description = translated.description;
          if (translated.eligibility) serviceDetails.eligibility = translated.eligibility;
          if (translated.waitTimes) serviceDetails.waitTimes = translated.waitTimes;
          if (translated.hoursOfOperation) serviceDetails.hoursOfOperation = translated.hoursOfOperation;
          if (translated.address) serviceDetails.address = translated.address;
          if (translated.processSteps) serviceDetails.process = translated.processSteps;
          if (translated.requiredDocs) serviceDetails.requiredDocs = translated.requiredDocs;
        }
      }

      res.json(serviceDetails);
  }));
}
