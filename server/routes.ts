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
import { registerAdminRoutes } from "./routes/admin";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  registerSearchRoutes(app);
  registerFeedbackRoutes(app);
  registerAnalyticsRoutes(app);
  registerAdminRoutes(app);

  return httpServer;
}
