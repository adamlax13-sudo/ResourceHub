import { z } from 'zod';
import { insertSearchSchema, insertFavoriteSchema } from './schema';

export const api = {
  auth: {
    me: {
      method: 'GET' as const,
      path: '/api/me',
      responses: {
        200: z.object({ id: z.number(), replitId: z.string().nullable() }).nullable(),
      },
    },
  },
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
  favorites: {
    list: {
      method: 'GET' as const,
      path: '/api/favorites',
      responses: {
        200: z.array(z.custom<any>()),
      },
    },
    add: {
      method: 'POST' as const,
      path: '/api/favorites',
      input: z.object({
        serviceId: z.string(),
        serviceName: z.string(),
        category: z.string(),
      }),
      responses: {
        201: z.custom<any>(),
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/favorites/:id',
      input: z.object({
        status: z.enum(['saved', 'in_progress', 'completed']).optional(),
        completedSteps: z.array(z.number()).optional(),
      }),
      responses: {
        200: z.custom<any>(),
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/favorites/:id',
      responses: {
        204: z.void(),
      },
    },
  },
};
