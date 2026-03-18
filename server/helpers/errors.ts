/**
 * Standard error response utilities shared across route modules.
 */

import type { z } from "zod";
import type { Request, Response, NextFunction, RequestHandler } from "express";

export interface ErrorResponse {
  success: false;
  message: string;
  error?: string;
  errors?: z.ZodIssue[];
}

export function createErrorResponse(
  message: string,
  error?: string,
  errors?: z.ZodIssue[],
): ErrorResponse {
  return { success: false, message, error, errors };
}

/**
 * Wraps an async route handler to catch errors and return a standard 500 response.
 * Use this for routes that follow the standard try/catch → createErrorResponse pattern.
 * Routes with custom error handling (ZodError differentiation, non-500 status codes)
 * should keep their explicit try/catch.
 */
export function asyncHandler(
  handler: (req: Request, res: Response) => Promise<any>
): RequestHandler {
  return (req: Request, res: Response, _next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch((err) => {
      console.error(`Error in ${req.method} ${req.path}:`, err);
      const errorMessage = process.env.NODE_ENV === 'production'
        ? undefined
        : (err instanceof Error ? err.message : undefined);
      res.status(500).json(createErrorResponse("Operation failed", errorMessage));
    });
  };
}
