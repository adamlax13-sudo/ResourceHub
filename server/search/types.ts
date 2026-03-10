/**
 * Search Types
 *
 * Shared TypeScript interfaces for the search module.
 */

import type { SearchType, QueryIntent, SubstanceType } from './config';
import type { SearchFilters } from '@shared/routes';

// Re-export types from config for convenience
export type { SearchType, QueryIntent, SubstanceType };

/** A single scored intent with confidence */
export interface ScoredIntent {
  intent: QueryIntent;
  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
}

/** Multi-intent detection result with primary and optional secondary/tertiary */
export interface IntentResult {
  primary: ScoredIntent;
  secondary?: ScoredIntent;
  tertiary?: ScoredIntent;
}

/**
 * Structured exclusion signals detected from user query.
 * Used for hard filtering services that don't match user preferences.
 */
export interface Exclusions {
  /** User wants non-religious services ("not religious", "secular") */
  religious: boolean;
  /** User wants non-12-step programs ("no 12-step", or implied by religious + addiction context) */
  twelveStep: boolean;
  /** User wants to exclude specific gender-restricted services */
  genderRestricted: 'men_only' | 'women_only' | null;
}

// === SESSION CONTEXT ===

/** Session context for personalized search */
export interface SessionContext {
  sessionId: string;
  previousQueries: string[];
  selectedLocation?: string;
  clickedServiceIds: string[];
  clickedCategories: string[];
  lastSearchTime?: number;
}

// === INPUT TYPES ===

export interface SearchInput {
  query: string;
  location?: string;
  page: number;
  pageSize: number;
  /** Optional session context for personalization */
  session?: SessionContext;
  /** Enable debug mode to include score explanations */
  debug?: boolean;
  /** Emergency mode — forces crisis service prioritization */
  emergency?: boolean;
  // Explicit filters from UI (applied as hard constraints, not semantic boosts)
  filters?: SearchFilters;
  // User location for distance-based sorting/filtering
  userLat?: number;
  userLng?: number;
  maxDistanceKm?: number;
  sortByDistance?: boolean;
}

// === QUERY ANALYSIS ===

export interface QueryAnalysis {
  /** Original query string (PII scrubbed, but NOT typo-corrected) */
  raw: string;
  /** Typo-corrected query (use this for search operations) */
  corrected: string;
  /** Normalized query (lowercase, trimmed, typos corrected) */
  normalized: string;
  /** Extracted keywords (non-location) */
  keywords: string[];
  /** Detected query intent (primary intent for backward compatibility) */
  intent: QueryIntent;
  /** Multi-intent detection with confidence scores */
  intents: IntentResult;
  /** Location information */
  location: {
    /** User-specified or query-extracted location */
    specified: string | null;
    /** True if location is province-wide or unspecified */
    isProvinceWide: boolean;
  };
  /** Whether this is a crisis query */
  isCrisis: boolean;
  /** Matched service alias (e.g., "CMHA" -> serviceId) */
  aliasMatch: string | null;
  /** Detected specific substance type for substance_abuse intent */
  substanceType: SubstanceType;
  /** Terms user wants to exclude (e.g., "not religious" -> ["religious"]) */
  negativeTerms: string[];
}

// === SERVICE TYPES ===

/** Lite service format for search result cards */
export interface LiteService {
  id: string;
  name: string;
  category: string;
  description: string;
  location: string;
  waitTimes: string;
  /** Phone number for quick contact - especially important for crisis services */
  phone?: string;
  /** 24/7 availability flag */
  is24_7?: boolean;
  /** Distance from user in km (null if no coords) */
  distanceKm?: number | null;
  /** Source of this result in search */
  matchType?: 'sql' | 'semantic' | 'both';
  /** RRF score from merge (higher = better) */
  rrfScore?: number;
  /** Age group this service targets */
  age_group?: 'youth' | 'youth_and_adult' | 'adult' | 'senior' | 'all_ages';
  /** True if service is faith-based */
  is_faith_based?: boolean;
  /** True if service uses 12-step methodology */
  is_12_step?: boolean;
  // Filter-relevant fields (populated for hard constraint filtering)
  genderRestriction?: string | null;
  ageGroup?: string | null;
  isFaithBased?: boolean | null;
  is12Step?: boolean | null;
  serviceFormat?: string | null;
  languagesSupported?: string[] | null;
  // Coordinates for distance computation (from materialized view)
  latitude?: number | null;
  longitude?: number | null;
}

/** Full service detail format for expanded view */
export interface FullService extends LiteService {
  contact: string;
  websiteUrl: string;
  eligibility: string;
  process: string[];
  requiredDocs: string[];
  phone: string;
  email: string;
  address: string;
}

/** Individual score factor explanation */
export interface ScoreExplanation {
  factor: string;
  value: number;
  reason: string;
}

/** Service with relevance score for ranking */
export interface ScoredService {
  service: LiteService;
  score: number;
  /** Source of this result */
  source: 'sql' | 'semantic' | 'openai';
  /** Detailed breakdown of scoring factors (only populated in debug mode) */
  scoreExplanation?: ScoreExplanation[];
}

/** LiteService with optional score explanation for debug mode */
export interface LiteServiceWithDebug extends LiteService {
  scoreExplanation?: ScoreExplanation[];
}

// === SEARCH RESULT TYPES ===

export interface SearchResult {
  services: LiteService[];
  /** Services with score explanations (populated in debug mode) */
  servicesWithDebug?: LiteServiceWithDebug[];
  summary: string;
  searchType: SearchType;
  totalResults: number;
}

export interface SearchResponse {
  services: LiteService[] | LiteServiceWithDebug[];
  summary: string;
  pagination: {
    page: number;
    pageSize: number;
    totalResults: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  searchTimeMs: number;
  cached: boolean;
  searchType?: SearchType;
}

// === STORAGE TYPES ===

/** Result from fast SQL search */
export interface FastSearchResult {
  serviceId: string;
  name: string;
  category: string;
  description: string | null;
  location: string | null;
  contact: string | null;
  websiteUrl: string | null;
  eligibility: string | null;
  processSteps: string[] | null;
  waitTimes: string | null;
  requiredDocs: string[] | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is24_7?: boolean | null;
  genderRestriction?: string | null;
  ageGroup?: string | null;
  isFaithBased?: boolean | null;
  is12Step?: boolean | null;
  serviceFormat?: string | null;
  languagesSupported?: string[] | null;
}

/** Result from semantic vector search */
export interface SemanticSearchResult extends FastSearchResult {
  similarity: number;
}

/** Cached AI enrichment data */
export interface EnrichmentData {
  aiDescription?: string;
  aiCategory?: string;
  aiProcessSteps?: string[];
  aiEligibility?: string;
  aiWaitTimes?: string;
  aiRequiredDocs?: string[];
  aiLocation?: string;
  aiContact?: string;
}

// === STRATEGY INTERFACE ===

export interface SearchStrategy {
  /**
   * Execute search with the given query analysis
   */
  search(analysis: QueryAnalysis, input: SearchInput): Promise<SearchResult>;
}

// === UTILITY TYPES ===

/** Cache key components */
export interface CacheKeyComponents {
  databaseHash: string;
  normalizedQuery: string;
  location: string | null;
}
