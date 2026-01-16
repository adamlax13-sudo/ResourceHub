import type { Express, RequestHandler } from "express";
import { setupGoogleAuth, isAuthenticated as googleIsAuthenticated, getSession as getGoogleSession } from "./googleAuth";

export { authStorage, type IAuthStorage } from "./storage";
export { registerAuthRoutes } from "./routes";

export async function setupAuth(app: Express): Promise<void> {
  console.log("[auth] Using Google OAuth");
  await setupGoogleAuth(app);
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  return googleIsAuthenticated(req, res, next);
};

export function getSession() {
  return getGoogleSession();
}
