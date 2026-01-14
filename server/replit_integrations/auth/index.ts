import type { Express, RequestHandler } from "express";
import { setupAuth as setupReplitAuth, isAuthenticated as replitIsAuthenticated, getSession as getReplitSession } from "./replitAuth";
import { setupGoogleAuth, isAuthenticated as googleIsAuthenticated, getSession as getGoogleSession } from "./googleAuth";

export { authStorage, type IAuthStorage } from "./storage";
export { registerAuthRoutes } from "./routes";

const useGoogleAuth = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export async function setupAuth(app: Express): Promise<void> {
  if (useGoogleAuth) {
    console.log("[auth] Using Google OAuth");
    await setupGoogleAuth(app);
  } else {
    console.log("[auth] Using Replit Auth");
    await setupReplitAuth(app);
  }
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (useGoogleAuth) {
    return googleIsAuthenticated(req, res, next);
  }
  return replitIsAuthenticated(req, res, next);
};

export function getSession() {
  if (useGoogleAuth) {
    return getGoogleSession();
  }
  return getReplitSession();
}
