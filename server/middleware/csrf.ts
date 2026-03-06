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
