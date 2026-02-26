/**
 * Merger Module
 *
 * Handles merging of results from multiple search sources (SQL, semantic).
 * Uses Reciprocal Rank Fusion (RRF) for hybrid ranking and handles
 * deduplication, enrichment merging, and final score calculation.
 */

import { storage } from '../../storage';
import { mergeForLiteView } from '../../helpers/enrichment';
import { computeRRFScore } from './scoring';
import type { LiteService, SemanticSearchResult, SearchType, QueryAnalysis } from '../types';

/**
 * SQL search result interface (from storage.fastSearch)
 */
export interface SQLSearchResult {
  serviceId: string;
  name: string;
  category: string;
  description: string;
  location: string;
  address?: string;
  waitTimes?: string;
  phone?: string;
  is24_7?: boolean;
  relevanceScore?: number;
}

/**
 * Merge configuration
 */
export const MERGE_CONFIG = {
  descriptionMaxLength: 350,  // Max characters for truncated descriptions
  descriptionOverflow: 50,    // How far past maxLength to look for a good break
};

/**
 * Truncate description to a reasonable length for display.
 * Tries to find a complete sentence boundary, avoiding cuts in the middle of
 * phone numbers or immediately after colons (which often precede key info).
 */
export function truncateDescription(description: string, maxLength: number = MERGE_CONFIG.descriptionMaxLength): string {
  if (!description) return '';
  if (description.length <= maxLength) return description;

  const overflow = MERGE_CONFIG.descriptionOverflow;
  const searchEnd = Math.min(description.length, maxLength + overflow);
  const searchRegion = description.substring(0, searchEnd);
  const minBreak = Math.floor(maxLength * 0.6);

  // First, try to find a sentence end (". " followed by capital letter or end)
  let bestBreak = -1;
  const sentenceEndRegex = /\.\s+(?=[A-Z]|$)/g;
  let match;
  while ((match = sentenceEndRegex.exec(searchRegion)) !== null) {
    if (match.index >= minBreak && match.index <= maxLength + overflow) {
      bestBreak = match.index + 1; // Include the period
    }
  }

  // If we found a good sentence break, use it
  if (bestBreak > 0) {
    return description.substring(0, bestBreak).trim();
  }

  // No sentence break found - try to break at a word boundary
  // But avoid breaking immediately after a colon (key info often follows)
  let breakPoint = description.lastIndexOf(' ', maxLength);

  // Check if we'd be breaking right after a colon - if so, look for earlier break
  const beforeBreak = description.substring(Math.max(0, breakPoint - 10), breakPoint);
  if (beforeBreak.includes(':')) {
    const colonPos = description.lastIndexOf(':', breakPoint);
    if (colonPos > minBreak) {
      const earlierBreak = description.lastIndexOf(' ', colonPos - 1);
      if (earlierBreak > minBreak) {
        breakPoint = earlierBreak;
      }
    }
  }

  // Check if we're in the middle of a phone number pattern
  const afterBreak = description.substring(breakPoint, breakPoint + 15);
  if (/^\s*[\d\-()]+/.test(afterBreak)) {
    const phoneStart = description.lastIndexOf(' ', breakPoint - 1);
    if (phoneStart > minBreak) {
      breakPoint = phoneStart;
    }
  }

  if (breakPoint === -1 || breakPoint < minBreak) {
    breakPoint = maxLength;
  }

  return description.substring(0, breakPoint).trim() + '...';
}

/**
 * Convert SQL search results to LiteService format with enrichment
 */
export async function convertSQLToLiteServices(
  sqlResults: SQLSearchResult[],
  enrichments: Map<string, any>
): Promise<LiteService[]> {
  return sqlResults.map(sr => {
    const enrichment = enrichments.get(sr.serviceId);
    const merged = mergeForLiteView(
      {
        serviceId: sr.serviceId,
        name: sr.name,
        category: sr.category,
        description: sr.description,
        location: sr.location,
        address: sr.address,
        waitTimes: sr.waitTimes ?? null,
      },
      enrichment
    );
    return {
      id: sr.serviceId,
      name: sr.name,
      category: merged.category,
      description: truncateDescription(merged.description),
      location: merged.location,
      waitTimes: merged.waitTimes || '',
      phone: sr.phone || undefined,
      is24_7: sr.is24_7 || undefined,
    };
  });
}

/**
 * Convert semantic search results to LiteService format with enrichment
 */
export async function convertSemanticToLiteServices(
  semanticResults: SemanticSearchResult[],
  enrichments: Map<string, any>
): Promise<LiteService[]> {
  return semanticResults.map(sr => {
    const enrichment = enrichments.get(sr.serviceId);
    const merged = mergeForLiteView(
      {
        serviceId: sr.serviceId,
        name: sr.name,
        category: sr.category,
        description: sr.description,
        location: sr.location,
        address: sr.address,
        waitTimes: sr.waitTimes ?? null,
      },
      enrichment
    );
    return {
      id: sr.serviceId,
      name: sr.name,
      category: merged.category,
      description: truncateDescription(merged.description),
      location: merged.location,
      waitTimes: merged.waitTimes || '',
      phone: sr.phone || undefined,
      is24_7: (sr as any).is24_7 || undefined,
    };
  });
}

/**
 * Sort services by location relevance
 */
export function sortByLocationRelevance(
  services: LiteService[],
  specifiedLocation: string | null
): LiteService[] {
  if (!specifiedLocation) return services;

  // Handle comma-separated multiple locations
  const selectedLocations = specifiedLocation.split(',').map(l => l.trim().toLowerCase()).filter(l => l);

  return [...services].sort((a, b) => {
    const scoreLocation = (loc: string) => {
      const l = loc.toLowerCase();
      // Check if matches any selected location
      if (selectedLocations.some(sel => l.includes(sel))) return 3;
      if (l.includes('alberta') || l.includes('province') || l === '') return 2;
      return 1;
    };
    return scoreLocation(b.location) - scoreLocation(a.location);
  });
}

/**
 * Merge SQL and semantic results using Reciprocal Rank Fusion (RRF)
 * Services appearing in both SQL AND semantic results rank highest
 */
export async function mergeResults(
  sqlResults: SQLSearchResult[],
  semanticResults: SemanticSearchResult[],
  analysis: QueryAnalysis
): Promise<{ services: LiteService[]; searchType: SearchType }> {
  // Get all service IDs for batch enrichment lookup
  const allServiceIds = new Set<string>();
  sqlResults.forEach(r => allServiceIds.add(r.serviceId));
  semanticResults.forEach(r => allServiceIds.add(r.serviceId));

  // Batch fetch enrichments
  const enrichments = await storage.getEnrichmentsBatch(Array.from(allServiceIds));

  // Convert SQL results to lite services
  const sqlServices = await convertSQLToLiteServices(sqlResults, enrichments);

  // Convert semantic results to lite services
  const semanticServicesRaw = await convertSemanticToLiteServices(semanticResults, enrichments);

  // Sort semantic results by location relevance if location specified
  const sortedSemantic = analysis.location.specified
    ? sortByLocationRelevance(semanticServicesRaw, analysis.location.specified)
    : semanticServicesRaw;

  // ============= RRF HYBRID SCORING WITH PROPER DEDUPLICATION =============
  // Deduplicate by service_id, keeping the entry with higher relevance score
  // Services appearing in both SQL AND semantic results get +50 confidence boost

  // Confidence boost for services appearing in both sources
  const DUAL_MATCH_BOOST = 50;

  // Build rank maps (1-indexed) and score maps
  const sqlRanks = new Map<string, number>();
  const sqlScoreMap = new Map<string, number>();
  sqlServices.forEach((s, i) => {
    sqlRanks.set(s.id, i + 1);
    // Use inverse rank as proxy for relevance (higher rank = lower score)
    sqlScoreMap.set(s.id, sqlServices.length - i);
  });

  const semanticRanks = new Map<string, number>();
  const semanticScoreMap = new Map<string, number>();
  sortedSemantic.forEach((s, i) => {
    semanticRanks.set(s.id, i + 1);
    semanticScoreMap.set(s.id, sortedSemantic.length - i);
  });

  // Build service lookup maps for both sources
  const sqlServiceMap = new Map<string, LiteService>();
  for (const s of sqlServices) sqlServiceMap.set(s.id, s);

  const semanticServiceMap = new Map<string, LiteService>();
  for (const s of sortedSemantic) semanticServiceMap.set(s.id, s);

  // Get all unique service IDs for RRF merge
  const mergedIds = new Set<string>([
    ...Array.from(sqlServiceMap.keys()),
    ...Array.from(semanticServiceMap.keys()),
  ]);

  // Compute RRF scores and determine best source for each service
  const scored: Array<{
    id: string;
    rrfScore: number;
    matchType: 'sql' | 'semantic' | 'both';
    service: LiteService;
  }> = [];

  for (const id of Array.from(mergedIds)) {
    const sqlRank = sqlRanks.get(id) || null;
    const semanticRank = semanticRanks.get(id) || null;
    const sqlScore = sqlScoreMap.get(id) || 0;
    const semanticScore = semanticScoreMap.get(id) || 0;

    // Calculate base RRF score
    let rrfScore = computeRRFScore(sqlRank, semanticRank);

    // Determine match type and select best service data
    let matchType: 'sql' | 'semantic' | 'both';
    let service: LiteService;

    if (sqlRank !== null && semanticRank !== null) {
      // Service appears in both - add confidence boost
      matchType = 'both';
      rrfScore += DUAL_MATCH_BOOST / 1000; // Normalize boost to RRF scale

      // Keep service data from source with higher score
      if (sqlScore >= semanticScore) {
        service = { ...sqlServiceMap.get(id)! };
      } else {
        service = { ...semanticServiceMap.get(id)! };
      }
    } else if (sqlRank !== null) {
      matchType = 'sql';
      service = { ...sqlServiceMap.get(id)! };
    } else {
      matchType = 'semantic';
      service = { ...semanticServiceMap.get(id)! };
    }

    // Attach match metadata to service
    service.matchType = matchType;
    service.rrfScore = rrfScore;

    scored.push({ id, rrfScore, matchType, service });
  }

  // Sort by RRF score (higher is better)
  scored.sort((a, b) => b.rrfScore - a.rrfScore);

  // Log RRF ranking info
  const inBothCount = scored.filter(s => s.matchType === 'both').length;
  if (inBothCount > 0) {
    console.log(`[RRF] ${inBothCount} services in both SQL+semantic (each gets +${DUAL_MATCH_BOOST} confidence). Top 3 scores: ${scored.slice(0, 3).map(s => s.rrfScore.toFixed(4)).join(', ')}`);
  }

  // Build final sorted list with deduplication complete
  const combined: LiteService[] = scored.map(s => s.service);

  // Determine search type
  let searchType: SearchType = 'sql';
  if (enrichments.size > 0) {
    searchType = 'sql+enrichment';
  }
  const addedFromSemantic = semanticRanks.size - sqlRanks.size;
  if (addedFromSemantic > 0 || inBothCount > 0) {
    searchType = sqlServices.length > 0 ? 'sql+semantic' : 'semantic';
  }

  console.log(`[ComprehensiveSearch] RRF merged ${combined.length} services (SQL: ${sqlServices.length}, Semantic: ${sortedSemantic.length}, Both: ${inBothCount})`);

  return { services: combined, searchType };
}

/**
 * Merge supplementary search results with existing results
 * Returns deduplicated combined results
 */
export function mergeSupplementaryResults(
  existingSql: SQLSearchResult[],
  existingSemantic: SemanticSearchResult[],
  newSql: SQLSearchResult[],
  newSemantic: SemanticSearchResult[]
): { sqlResults: SQLSearchResult[]; semanticResults: SemanticSearchResult[] } {
  // Build set of existing IDs
  const existingIds = new Set<string>();
  existingSql.forEach(r => existingIds.add(r.serviceId));
  existingSemantic.forEach(r => existingIds.add(r.serviceId));

  // Filter out duplicates from new results
  const filteredSql = newSql.filter(r => !existingIds.has(r.serviceId));
  const filteredSemantic = newSemantic.filter(r => !existingIds.has(r.serviceId));

  return {
    sqlResults: [...existingSql, ...filteredSql],
    semanticResults: [...existingSemantic, ...filteredSemantic],
  };
}

/**
 * Build search summary string
 */
export function buildSummary(
  resultCount: number,
  query: string,
  location: string | null | undefined
): string {
  if (resultCount === 0) {
    return `No services found for "${query}"${location ? ` in ${location}` : ''}`;
  }

  const locationText = location ? ` in ${location}` : '';
  return `Found ${resultCount} service${resultCount === 1 ? '' : 's'}${locationText}`;
}
