import { z } from 'zod';
import { insertSearchSchema } from './schema';

export const api = {
  search: {
    query: {
      method: 'POST' as const,
      path: '/api/search',
      input: z.object({
        query: z.string().min(1, "Please enter what you're looking for"),
      }),
      responses: {
        200: z.object({
          services: z.array(z.object({
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
          })),
          summary: z.string(),
        }),
        400: z.object({ message: z.string() }),
      },
    },
  },
};
