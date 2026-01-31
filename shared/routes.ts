import { z } from 'zod';
import { updateDemographicsSchema } from './schema';

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

export const favoriteSchema = z.object({
  id: z.number(),
  userId: z.number(),
  serviceId: z.string(),
  serviceName: z.string(),
  category: z.string(),
  status: z.string(),
  completedSteps: z.array(z.number()),
  serviceDetails: serviceDetailSchema.nullable().optional(),
  createdAt: z.string().nullable(),
});

export const userProfileSchema = z.object({
  id: z.number(),
  email: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  profileImageUrl: z.string().nullable().optional(),
  age: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  race: z.string().nullable().optional(),
  sexuality: z.string().nullable().optional(),
});

export const recommendationSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  reasoning: z.string(),
  location: z.string(),
  contact: z.string(),
  eligibility: z.string(),
  process: z.array(z.string()),
  waitTimes: z.string(),
  requiredDocs: z.array(z.string()),
});

export const api = {
  auth: {
    me: {
      method: 'GET' as const,
      path: '/api/me',
      responses: {
        200: userProfileSchema.nullable(),
      },
    },
  },
  profile: {
    get: {
      method: 'GET' as const,
      path: '/api/profile',
      responses: {
        200: userProfileSchema,
        401: z.object({ message: z.string() }),
      },
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/profile',
      input: updateDemographicsSchema,
      responses: {
        200: userProfileSchema,
        401: z.object({ message: z.string() }),
      },
    },
  },
  recommendations: {
    get: {
      method: 'GET' as const,
      path: '/api/recommendations',
      responses: {
        200: z.object({
          recommendations: z.array(recommendationSchema),
          summary: z.string(),
        }),
        401: z.object({ message: z.string() }),
      },
    },
  },
  search: {
    query: {
      method: 'POST' as const,
      path: '/api/search',
      input: z.object({
        query: z.string().min(1, "Please enter what you're looking for"),
        mode: z.enum(['fast', 'comprehensive']).optional().default('fast'),
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
  favorites: {
    list: {
      method: 'GET' as const,
      path: '/api/favorites',
      responses: {
        200: z.array(favoriteSchema),
      },
    },
    add: {
      method: 'POST' as const,
      path: '/api/favorites',
      input: z.object({
        serviceId: z.string(),
        serviceName: z.string(),
        category: z.string(),
        serviceDetails: serviceDetailSchema.optional(),
      }),
      responses: {
        201: favoriteSchema,
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
        200: favoriteSchema,
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
export type Favorite = z.infer<typeof favoriteSchema>;
export type ServiceDetail = z.infer<typeof serviceDetailSchema>;
