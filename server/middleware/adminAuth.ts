import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual, createHash } from 'crypto';

/**
 * Admin authentication middleware
 * Validates API key for admin endpoints
 *
 * Usage: Add ADMIN_API_KEY to your .env file
 * Clients must send: Authorization: Bearer <ADMIN_API_KEY>
 */
export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const adminApiKey = process.env.ADMIN_API_KEY;

  // If no admin key is configured, admin endpoints are disabled
  if (!adminApiKey) {
    console.warn('[AdminAuth] ADMIN_API_KEY not configured - admin endpoints disabled');
    return res.status(503).json({
      message: 'Admin endpoints are not configured',
      error: 'ADMIN_API_KEY environment variable is not set'
    });
  }

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'Unauthorized',
      error: 'Missing or invalid Authorization header. Expected: Bearer <token>'
    });
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  // Constant-time comparison to prevent timing attacks
  if (!constantTimeCompare(token, adminApiKey)) {
    console.warn('[AdminAuth] Invalid admin API key attempt');
    return res.status(403).json({
      message: 'Forbidden',
      error: 'Invalid admin API key'
    });
  }

  // Log successful admin access
  console.log(`[AdminAuth] Admin access granted for: ${req.method} ${req.path}`);
  next();
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
 * Admin rate limiter - stricter than regular endpoints
 */
import rateLimit from 'express-rate-limit';

export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 admin requests per window
  message: 'Too many admin requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
