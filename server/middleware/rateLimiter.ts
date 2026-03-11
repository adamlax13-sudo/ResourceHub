import rateLimit from 'express-rate-limit';

// In development/CI, relax rate limits so evaluations can run fully.
// Production keeps strict limits to prevent abuse.
const isProduction = process.env.NODE_ENV === 'production';

/**
 * General API rate limiter
 * Limits requests to 100 per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 500, // Production: 100, Dev/CI: 500
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests that don't consume resources
  skipSuccessfulRequests: false,
});

/**
 * Strict rate limiter for resource-intensive endpoints
 * Limits requests to 20 per 15 minutes per IP
 * Use for AI/search endpoints that consume significant resources
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 20 : 500, // Production: 20, Dev/CI: 500
  message: 'Too many requests to this endpoint, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Lenient rate limiter for feedback/contact forms
 * Limits requests to 5 per hour per IP
 * Prevents spam while allowing legitimate submissions
 */
export const feedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 requests per hour
  message: 'Too many submissions. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Lenient rate limiter for click tracking
 * Higher limit than feedback since normal browsing generates many clicks
 */
export const clickTrackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 clicks per 15 minutes
  message: 'Too many requests.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Very strict rate limiter for authentication endpoints
 * Limits requests to 5 per 15 minutes per IP
 * Prevents brute force attacks
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 failed login attempts
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

/**
 * Geocode rate limiter
 * 30 requests per 15 minutes per IP — stricter than search
 * Prevents abuse of the Mapbox geocoding proxy
 */
export const geocodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many geocoding requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
