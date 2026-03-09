import { z } from 'zod';

// Score explanation schema (only populated in debug mode)
export const scoreExplanationSchema = z.object({
  factor: z.string(),
  value: z.number(),
  reason: z.string(),
});

// Lite schema for search results (card display only) - FAST
export const serviceSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string(),  // Truncated for card display
  location: z.string().nullable().default(''),
  waitTimes: z.string().nullable().default(''),
  // Phone number — shown on card for crisis lines so users don't have to expand
  phone: z.string().optional(),
  // 24/7 availability flag
  is24_7: z.boolean().optional(),
  // Distance from user's location in km (null if no coords on service or no user location)
  distanceKm: z.number().nullable().optional(),
  // Debug mode only - shows scoring breakdown
  scoreExplanation: z.array(scoreExplanationSchema).optional(),
});

// Full schema with all details (loaded on demand when user expands)
export const serviceDetailSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string(),
  location: z.string().nullable().default(''),
  contact: z.string(),
  // Allow empty string for backwards compat — some services have websiteUrl="" in the DB
  websiteUrl: z.string().url().optional().or(z.literal('')),
  eligibility: z.string(),
  process: z.array(z.string()),
  waitTimes: z.string().nullable().default(''),
  requiredDocs: z.array(z.string()),
  // Normalized contact fields (from dedicated DB columns)
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  hoursOfOperation: z.string().optional(),
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

// Filter fields passed as explicit UI constraints (applied as hard constraints, not semantic boosts)
// Note: 'all' in genderRestriction is a UI sentinel meaning "no restriction" — never compared to DB data
// Note: 'youth_and_adult' is a DB-internal storage value intentionally excluded from the API surface
export const searchFiltersSchema = z.object({
  category: z.string().max(100).trim().optional(),
  genderRestriction: z.enum(['all', 'women_only', 'men_only']).optional(),
  ageGroup: z.enum(['all_ages', 'youth', 'adult', 'senior']).optional(),
  is24_7: z.boolean().optional(),
  isFaithBased: z.boolean().optional(),
  is12Step: z.boolean().optional(),
  languagesSupported: z.array(z.string().max(100)).max(20).optional(),
  serviceFormat: z.string().max(50).optional(),
});
export type SearchFilters = z.infer<typeof searchFiltersSchema>;

export const api = {
  search: {
    query: {
      method: 'POST' as const,
      path: '/api/search',
      input: z.object({
        query: z.string().min(1, "Please enter what you're looking for").max(200, "Search query is too long (200 characters max)"),
        location: z.string().max(200).optional(), // User's selected location for filtering
        hp: z.string().max(0).optional(),
        // Pagination parameters (defaults applied server-side)
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(50).optional(),
        // Debug mode - includes score explanations in response
        debug: z.boolean().optional(),
        // Emergency mode - forces crisis service prioritization (used by "I need help right now" button)
        emergency: z.boolean().optional(),
        // User location for distance-based sorting/filtering
        userLat: z.number().min(-90).max(90).optional(),
        userLng: z.number().min(-180).max(180).optional(),
        maxDistanceKm: z.number().min(1).max(500).optional(),
        sortByDistance: z.boolean().optional(),
        // Explicit filters (applied as hard constraints in the search pipeline)
        ...searchFiltersSchema.shape,
      }).refine(
        (data) => (data.userLat == null) === (data.userLng == null),
        { message: "userLat and userLng must both be provided or both omitted" }
      ),
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
