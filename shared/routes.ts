import { z } from 'zod';

// Score explanation schema (only populated in debug mode)
export const scoreExplanationSchema = z.object({
  factor: z.string(),
  value: z.number(),
  reason: z.string(),
});

// Lite schema for search results (card display only) - FAST
export const serviceSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string(),  // Truncated for card display
  location: z.string(),
  waitTimes: z.string(),
  // Debug mode only - shows scoring breakdown
  scoreExplanation: z.array(scoreExplanationSchema).optional(),
});

// Full schema with all details (loaded on demand when user expands)
export const serviceDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  location: z.string(),
  contact: z.string(),
  websiteUrl: z.string().optional(),
  eligibility: z.string(),
  process: z.array(z.string()),
  waitTimes: z.string(),
  requiredDocs: z.array(z.string()),
  // Normalized contact fields (from dedicated DB columns)
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
});

// Pagination metadata schema
export const paginationSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  totalResults: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const api = {
  search: {
    query: {
      method: 'POST' as const,
      path: '/api/search',
      input: z.object({
        query: z.string().min(1, "Please enter what you're looking for").max(200, "Search query is too long (200 characters max)"),
        location: z.string().optional(), // User's selected location for filtering
        hp: z.string().max(0).optional(),
        // Pagination parameters (defaults applied server-side)
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(50).optional(),
        // Debug mode - includes score explanations in response
        debug: z.boolean().optional(),
      }),
      responses: {
        // Now returns lite summaries for fast display
        200: z.object({
          services: z.array(serviceSummarySchema),
          summary: z.string(),
          pagination: paginationSchema.optional(),
        }),
        400: z.object({ message: z.string() }),
      },
    },
  },
  services: {
    // Get full service details by ID (loaded when user clicks to expand)
    getById: {
      method: 'GET' as const,
      path: '/api/services/:id',
      responses: {
        200: serviceDetailSchema,
        404: z.object({ message: z.string() }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, String(value));
    });
  }
  return url;
}

export type SearchResponse = z.infer<typeof api.search.query.responses[200]>;
export type ServiceSummary = z.infer<typeof serviceSummarySchema>;
export type ServiceDetail = z.infer<typeof serviceDetailSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
export type ScoreExplanation = z.infer<typeof scoreExplanationSchema>;
