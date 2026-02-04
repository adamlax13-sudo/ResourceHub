import { z } from 'zod';

export const serviceDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  location: z.string(),
  contact: z.string(),
  eligibility: z.string(),
  process: z.array(z.string()),
  waitTimes: z.string(),
  requiredDocs: z.array(z.string()),
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
      }),
      responses: {
        200: z.object({
          services: z.array(serviceDetailSchema),
          summary: z.string(),
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
