/**
 * SEO Landing Page Routes
 *
 * Serves server-rendered HTML for category and category+city pages.
 * Registered after all /api and /admin routes, before SPA catch-all.
 */

import type { Express, Request, Response, NextFunction } from "express";
import { CATEGORY_BY_SLUG, CITY_BY_SLUG } from "../seo/config";
import { getServicesForLandingPage } from "../seo/data";
import { renderLandingPage } from "../seo/render";

const PAGE_CACHE = new Map<string, { html: string; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function landingPageHandler(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const categorySlug = req.params.category;
  const citySlug = req.params.city;

  const category = CATEGORY_BY_SLUG.get(categorySlug);
  if (!category) return next();

  const city = citySlug ? CITY_BY_SLUG.get(citySlug) : undefined;
  if (citySlug && !city) return next();

  try {
    const cacheKey = city ? `${categorySlug}/${city.slug}` : categorySlug;
    const cached = PAGE_CACHE.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      res.set("Content-Type", "text/html");
      res.set("Cache-Control", "public, max-age=3600");
      return res.send(cached.html);
    }

    const services = await getServicesForLandingPage(category, city);
    const html = renderLandingPage({ category, city, services });

    PAGE_CACHE.set(cacheKey, { html, ts: Date.now() });

    res.set("Content-Type", "text/html");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(html);
  } catch (err) {
    console.error(`Error rendering landing page ${categorySlug}/${citySlug || ""}:`, err);
    next();
  }
}

export function registerLandingPageRoutes(app: Express): void {
  app.get("/:category/:city", landingPageHandler);
  app.get("/:category", landingPageHandler);
}
