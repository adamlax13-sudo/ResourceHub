/**
 * Admin authentication routes — /api/admin/auth/*
 *
 * Provides cookie-based session auth for the admin UI.
 * Header-based auth (Authorization: Bearer <key>) remains supported
 * for backward compatibility with CLI scripts.
 */

import type { Express, Request, Response } from "express";
import { createHmac, timingSafeEqual, createHash } from "crypto";
import { z } from "zod";
import { createErrorResponse } from "../helpers/errors";
import { authLimiter } from "../middleware/rateLimiter";

const COOKIE_NAME = "admin_session";
const COOKIE_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Return the session secret, falling back to ADMIN_API_KEY.
 * Never exposed outside this module.
 */
function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_KEY;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET or ADMIN_API_KEY must be set for session signing");
  }
  return secret;
}

/**
 * Sign a value with HMAC-SHA256 using the session secret.
 * Returns the hex digest — this is stored as the cookie value.
 */
function signToken(apiKey: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(apiKey)
    .digest("hex");
}

/**
 * Verify a cookie value against the expected HMAC for the configured API key.
 * Returns true if the cookie was produced by signToken(ADMIN_API_KEY).
 */
export function verifyToken(cookieValue: string): boolean {
  const adminApiKey = process.env.ADMIN_API_KEY;
  if (!adminApiKey) return false;

  const expected = signToken(adminApiKey);

  // Constant-time comparison to prevent timing attacks
  const hashExpected = createHash("sha256").update(expected).digest();
  const hashActual = createHash("sha256").update(cookieValue).digest();

  try {
    return timingSafeEqual(hashExpected, hashActual);
  } catch {
    return false;
  }
}

const loginSchema = z.object({
  apiKey: z.string().min(1),
});

export function registerAdminAuthRoutes(app: Express): void {
  // ============= POST /api/admin/auth/login =============
  app.post("/api/admin/auth/login", authLimiter, (req: Request, res: Response) => {
    const adminApiKey = process.env.ADMIN_API_KEY;
    if (!adminApiKey) {
      console.warn("[AdminAuth] ADMIN_API_KEY not configured");
      return res.status(404).json({ message: "Not found" });
    }

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json(createErrorResponse("Invalid request body", undefined, parsed.error.issues));
    }

    const { apiKey } = parsed.data;

    // Constant-time comparison of submitted key against configured key
    const hashSubmitted = createHash("sha256").update(apiKey).digest();
    const hashConfigured = createHash("sha256").update(adminApiKey).digest();

    let keysMatch: boolean;
    try {
      keysMatch = timingSafeEqual(hashSubmitted, hashConfigured);
    } catch {
      keysMatch = false;
    }

    if (!keysMatch) {
      console.warn(`[AdminAuth] Failed login attempt from ${req.ip}`);
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Issue signed cookie
    const token = signToken(adminApiKey);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: COOKIE_MAX_AGE_MS,
      path: "/",
    });

    console.log(`[AdminAuth] Login successful from ${req.ip}`);
    return res.json({ success: true });
  });

  // ============= POST /api/admin/auth/logout =============
  app.post("/api/admin/auth/logout", (_req: Request, res: Response) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    return res.json({ success: true });
  });
}
