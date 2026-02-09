import { z } from 'zod';

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
        mode: z.enum(['fast', 'comprehensive']).optional().default('fast'),
        hp: z.string().max(0).optional(),
        // Pagination parameters (defaults applied server-side)
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(50).optional(),
      }),
      responses: {
        200: z.object({
          services: z.array(serviceDetailSchema),
          summary: z.string(),
          // Pagination metadata (optional for backward compatibility)
          pagination: paginationSchema.optional(),
        }),
        400: z.object({ message: z.string() }),
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
export type ServiceDetail = z.infer<typeof serviceDetailSchema>;
export type Pagination = z.infer<typeof paginationSchema>;
