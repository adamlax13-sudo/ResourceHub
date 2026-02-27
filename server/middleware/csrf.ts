import type { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

// Store for CSRF tokens (in production, use Redis or similar)
const csrfTokens = new Map<string, { token: string; expires: number }>();

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  csrfTokens.forEach((data, sessionId) => {
    if (data.expires < now) {
      csrfTokens.delete(sessionId);
    }
  });
}, 60000); // Clean every minute

/**
 * Generate a CSRF token for a session
 */
export function generateCsrfToken(sessionId: string): string {
  const token = randomBytes(32).toString('hex');
  const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  csrfTokens.set(sessionId, { token, expires });
  return token;
}

/**
 * Get or create CSRF token for a session
 */
function getOrCreateToken(sessionId: string): string {
  const existing = csrfTokens.get(sessionId);
  if (existing && existing.expires > Date.now()) {
    return existing.token;
  }
  return generateCsrfToken(sessionId);
}

/**
 * CSRF token endpoint - clients call this to get a token
 * Token is returned in response and should be sent in X-CSRF-Token header
 */
export function csrfTokenEndpoint(req: Request, res: Response) {
  const sessionId = req.headers['x-session-id'] as string || 'anonymous';
  const token = getOrCreateToken(sessionId);
  res.json({ csrfToken: token });
}

/**
 * CSRF protection middleware
 * Validates X-CSRF-Token header against stored token
 *
 * Skips validation for:
 * - GET, HEAD, OPTIONS requests (safe methods)
 * - Requests with valid Origin matching allowed origins
 */
export function csrfProtection(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Check Origin header for same-origin requests
    const origin = req.headers.origin;
    if (origin) {
      const isAllowedOrigin = allowedOrigins.some(allowed => origin === allowed);
      if (!isAllowedOrigin) {
        console.warn(`[CSRF] Blocked request from origin: ${origin}`);
        return res.status(403).json({
          message: 'Forbidden',
          error: 'Invalid origin'
        });
      }
    }

    // For API requests, also check CSRF token
    const sessionId = req.headers['x-session-id'] as string;
    const csrfToken = req.headers['x-csrf-token'] as string;

    // CSRF validation: log-only mode. Token mismatch is logged but not blocked.
    // To enforce strict CSRF, use strictCsrfProtection middleware instead.
    if (sessionId && csrfToken) {
      const stored = csrfTokens.get(sessionId);
      if (!stored || stored.token !== csrfToken || stored.expires < Date.now()) {
        console.warn(`[CSRF] Invalid token for session: ${sessionId}`);
      }
    }

    next();
  };
}

/**
 * Strict CSRF protection for sensitive endpoints
 * Requires valid CSRF token - no bypass
 */
export function strictCsrfProtection(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const sessionId = req.headers['x-session-id'] as string;
  const csrfToken = req.headers['x-csrf-token'] as string;

  if (!sessionId || !csrfToken) {
    return res.status(403).json({
      message: 'Forbidden',
      error: 'Missing CSRF token. Call GET /api/csrf-token first.'
    });
  }

  const stored = csrfTokens.get(sessionId);
  if (!stored || stored.token !== csrfToken || stored.expires < Date.now()) {
    return res.status(403).json({
      message: 'Forbidden',
      error: 'Invalid or expired CSRF token'
    });
  }

  next();
}
