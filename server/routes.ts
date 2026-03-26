/**
 * Route Registrar
 *
 * Thin entry point that imports and mounts all route modules.
 * Each module is responsible for its own endpoints, middleware, and validation.
 */

import type { Express } from "express";
import type { Server } from "http";
import { registerSearchRoutes } from "./routes/search";
import { registerFeedbackRoutes } from "./routes/feedback";
import { registerAnalyticsRoutes } from "./routes/analytics";
import { registerAdminAuthRoutes } from "./routes/admin-auth";
import { registerAdminDashboardRoutes } from "./routes/admin-dashboard";
import { registerAdminServiceRoutes } from "./routes/admin-services";
import { registerAdminReviewRoutes } from "./routes/admin-review";
import { registerAdminQualityRoutes } from "./routes/admin-quality";
import { registerAdminAnalyticsRoutes } from "./routes/admin-analytics";
import { registerAdminScraperRoutes } from "./routes/admin-scraper";
import { registerAdminSearchTestRoutes } from "./routes/admin-search-test";
import { registerAdminSystemRoutes } from "./routes/admin-system";
import { registerAdminFeedbackRoutes } from "./routes/admin-feedback";
import { registerAdminRoutes } from "./routes/admin";
import { registerLocationRoutes } from "./routes/location";
import { registerSuggestRoutes } from "./routes/suggest";
import { registerSeoRoutes } from "./routes/seo";
import { registerLandingPageRoutes } from "./routes/landing-pages";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  registerSeoRoutes(app);
  registerSearchRoutes(app);
  registerFeedbackRoutes(app);
  registerAnalyticsRoutes(app);
  registerAdminAuthRoutes(app);

  // Admin API routes — registered after auth, before legacy admin routes
  registerAdminDashboardRoutes(app);
  registerAdminServiceRoutes(app);
  registerAdminReviewRoutes(app);
  registerAdminQualityRoutes(app);
  registerAdminAnalyticsRoutes(app);
  registerAdminScraperRoutes(app);
  registerAdminSearchTestRoutes(app);
  registerAdminSystemRoutes(app);
  registerAdminFeedbackRoutes(app);

  registerAdminRoutes(app);
  registerLocationRoutes(app);
  registerSuggestRoutes(app);

  // Landing pages last — /:category wildcard must not shadow /api or /admin routes
  registerLandingPageRoutes(app);

  return httpServer;
}
