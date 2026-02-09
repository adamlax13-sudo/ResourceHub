/**
 * Route registration module
 * Combines all route modules into a single registration function
 */

import type { Express, Router } from "express";
import { registerFeedbackRoutes } from "./feedback";
import { registerAnalyticsRoutes } from "./analytics";
import { registerHealthRoutes } from "./health";

export function registerModularRoutes(app: Express): void {
  // Health routes (no rate limiting)
  registerHealthRoutes(app as unknown as Router);

  // Feedback routes
  registerFeedbackRoutes(app as unknown as Router);

  // Analytics routes
  registerAnalyticsRoutes(app as unknown as Router);
}

export { registerFeedbackRoutes } from "./feedback";
export { registerAnalyticsRoutes } from "./analytics";
export { registerHealthRoutes } from "./health";
