/**
 * Search Types
 *
 * Shared TypeScript interfaces for the search module.
 */

import type { SearchType, QueryIntent, SubstanceType } from './config';

// Re-export types from config for convenience
export type { SearchType, QueryIntent, SubstanceType };

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
}

// === QUERY ANALYSIS ===

export interface QueryAnalysis {
  /** Original query string */
  raw: string;
  /** Normalized query (lowercase, trimmed, typos corrected) */
  normalized: string;
  /** Extracted keywords (non-location) */
  keywords: string[];
  /** Detected query intent */
  intent: QueryIntent;
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

/** Service with relevance score for ranking */
export interface ScoredService {
  service: LiteService;
  score: number;
  /** Source of this result */
  source: 'sql' | 'semantic' | 'openai';
}

// === SEARCH RESULT TYPES ===

export interface SearchResult {
  services: LiteService[];
  summary: string;
  searchType: SearchType;
  totalResults: number;
}

export interface SearchResponse {
  services: LiteService[];
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
