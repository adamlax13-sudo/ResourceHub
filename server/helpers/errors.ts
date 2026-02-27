/**
 * Standard error response utilities shared across route modules.
 */

import type { z } from "zod";

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
