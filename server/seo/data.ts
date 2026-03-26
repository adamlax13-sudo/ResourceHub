/**
 * SEO Landing Page Data Queries
 *
 * Simple filtered DB queries for landing page content.
 * Bypasses the search pipeline (no embeddings, no LLM) for speed and cacheability.
 */

import { db } from "../db";
import { services } from "@shared/schema";
import { eq, and, inArray, or, ilike, desc, asc } from "drizzle-orm";
import type { CategoryPage, CityPage } from "./config";

export async function getServicesForLandingPage(
  category: CategoryPage,
  city?: CityPage,
) {
  const conditions = [
    eq(services.isActive, true),
    inArray(services.category, category.dbCategories),
  ];

  if (city) {
    // Include city-local + province-wide + online services
    conditions.push(
      or(
        ilike(services.location, `%${city.label}%`),
        ilike(services.location, "%province-wide%"),
        ilike(services.location, "%alberta-wide%"),
        ilike(services.location, "%alberta wide%"),
        eq(services.serviceFormat, "online"),
      )!,
    );
  }

  return db
    .select()
    .from(services)
    .where(and(...conditions))
    .orderBy(desc(services.confidenceScore), asc(services.name));
}
