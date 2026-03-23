import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual, createHash } from 'crypto';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../routes/admin-auth';

/**
 * Admin authentication middleware.
 *
 * Accepts auth via two mechanisms (checked in order):
 *   1. Authorization: Bearer <ADMIN_API_KEY>  (backward compat for CLI scripts)
 *   2. admin_session HTTP-only cookie         (used by the admin UI)
 *
 * Usage: Add ADMIN_API_KEY to your .env file.
 */
export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const adminApiKey = process.env.ADMIN_API_KEY;

  // If no admin key is configured, admin endpoints are disabled
  if (!adminApiKey) {
    console.warn('[AdminAuth] ADMIN_API_KEY not configured - admin endpoints disabled');
    return res.status(404).json({ message: 'Not found' });
  }

  // --- Method 1: Authorization header (Bearer token) ---
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    if (constantTimeCompare(token, adminApiKey)) {
      console.log(`[AdminAuth] Admin access granted (header) — ${req.method} ${req.path} from ${req.ip}`);
      return next();
    }
    // Header present but invalid — fail immediately (don't fall through to cookie)
    console.warn(`[AdminAuth] Invalid Bearer token from ${req.ip}`);
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // --- Method 2: Signed cookie ---
  const cookieValue = req.cookies?.admin_session as string | undefined;
  if (cookieValue && verifyToken(cookieValue)) {
    console.log(`[AdminAuth] Admin access granted (cookie) — ${req.method} ${req.path} from ${req.ip}`);
    return next();
  }

  // Neither header nor cookie passed
  console.warn(`[AdminAuth] Unauthorized access attempt — ${req.method} ${req.path} from ${req.ip}`);
  return res.status(401).json({ success: false, message: 'Unauthorized' });
}

/**
 * Constant-time string comparison that doesn't leak string length.
 * Hashes both values to fixed length before comparing.
 */
function constantTimeCompare(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

/**
 * Rate limiter for read (GET) admin endpoints — more permissive.
 */
export const adminReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: 'Too many admin requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for write (POST/PATCH) admin endpoints — stricter.
 */
export const adminWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: 'Too many admin requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Backward-compatible alias for adminWriteLimiter.
 * Existing routes that use adminLimiter continue to work unchanged.
 */
export const adminLimiter = adminWriteLimiter;
