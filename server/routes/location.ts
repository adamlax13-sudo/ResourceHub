/**
 * Location routes — /api/mapbox-token, /api/geocode
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { LRUCache } from "lru-cache";
import { createErrorResponse } from "../helpers/errors";
import { withTimeout } from "../helpers/timeout";
import { geocodeLimiter } from "../middleware/rateLimiter";

const MAPBOX_GEOCODE_TIMEOUT = 5000;
const MAPBOX_BASE_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";
const ALBERTA_BBOX = "-120.0,49.0,-110.0,60.0";

// LRU cache for geocoding results (same address = same result)
const geocodeCache = new LRUCache<string, { lat: number; lng: number; placeName: string }>({
  max: 500,
  ttl: 1000 * 60 * 60 * 24, // 24h
});

const geocodeInputSchema = z.object({
  address: z.string().min(1).max(200).trim(),
});

function sanitizeInput(text: string): string {
  return text
    .replace(/[`"\\<>]/g, "")
    .replace(/[\x00-\x1f]/g, "") // control characters
    .replace(/\n/g, " ")
    .trim();
}

export function registerLocationRoutes(app: Express): void {
  // ============= MAPBOX TOKEN ENDPOINT =============
  // Returns the public (URL-restricted) token for client-side map rendering
  // Global apiLimiter middleware in server/index.ts already covers this route
  app.get("/api/mapbox-token", (_req: Request, res: Response) => {
    const token = process.env.MAPBOX_PUBLIC_TOKEN;
    if (!token) {
      return res.status(503).json(
        createErrorResponse("Map service temporarily unavailable")
      );
    }
    res.json({ token });
  });

  // ============= GEOCODE ENDPOINT =============
  // Server-side geocoding proxy — hides secret token from client
  app.post("/api/geocode", geocodeLimiter, async (req: Request, res: Response) => {
    try {
      const { address } = geocodeInputSchema.parse(req.body);
      const sanitized = sanitizeInput(address);

      if (!sanitized) {
        return res.status(400).json(
          createErrorResponse("Invalid address")
        );
      }

      // Check cache
      const cacheKey = sanitized.toLowerCase();
      const cached = geocodeCache.get(cacheKey);
      if (cached) {
        return res.json({ success: true, ...cached });
      }

      const secretToken = process.env.MAPBOX_SECRET_TOKEN;
      if (!secretToken) {
        return res.status(503).json(
          createErrorResponse("Geocoding service temporarily unavailable")
        );
      }

      const url = `${MAPBOX_BASE_URL}/${encodeURIComponent(sanitized)}.json?access_token=${secretToken}&country=ca&bbox=${ALBERTA_BBOX}&limit=1`;

      const response = await withTimeout(
        fetch(url),
        MAPBOX_GEOCODE_TIMEOUT,
        "Mapbox geocoding"
      );

      if (!response.ok) {
        console.error(`Mapbox geocoding error: ${response.status}`);
        return res.status(503).json(
          createErrorResponse("Geocoding temporarily unavailable")
        );
      }

      const data = await response.json();

      if (!data.features || data.features.length === 0) {
        return res.json({ success: true, lat: null, lng: null, placeName: null });
      }

      const feature = data.features[0];
      const result = {
        lat: feature.center[1],
        lng: feature.center[0],
        placeName: feature.place_name as string,
      };

      // Cache the result
      geocodeCache.set(cacheKey, result);

      res.json({ success: true, ...result });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json(
          createErrorResponse("Invalid address input", undefined, err.errors as any)
        );
      }
      console.error("Geocode error:", err instanceof Error ? err.message : err);
      const errorMessage = process.env.NODE_ENV === "production"
        ? undefined
        : (err instanceof Error ? err.message : undefined);
      res.status(503).json(
        createErrorResponse("Geocoding temporarily unavailable", errorMessage)
      );
    }
  });
}
