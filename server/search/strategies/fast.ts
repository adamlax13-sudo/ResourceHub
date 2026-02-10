/**
 * Fast Search Strategy
 *
 * Optimized for speed with NO external API calls.
 * Uses only SQL search and cached enrichments.
 * Target: < 200ms response time.
 */

import { BaseSearchStrategy } from './base';
import { SEARCH_CONFIG } from '../config';
import type {
  QueryAnalysis,
  SearchInput,
  SearchResult,
  LiteService,
} from '../types';
import { storage } from '../../storage';

export class FastSearchStrategy extends BaseSearchStrategy {
  readonly name = 'fast';

  async search(analysis: QueryAnalysis, input: SearchInput): Promise<SearchResult> {
    const config = SEARCH_CONFIG.modes.fast;
    const startTime = Date.now();

    // Step 1: SQL search using optimized fast_search function
    const sqlResults = await storage.fastSearch(
      analysis.raw,
      analysis.location.specified,
      analysis.intent === 'location_only',
      config.maxResults
    );

    console.log(`[FastSearch] SQL returned ${sqlResults.length} results in ${Date.now() - startTime}ms`);

    if (sqlResults.length === 0) {
      return {
        services: [],
        summary: this.buildSummary(0, analysis.raw, analysis.location.specified),
        searchType: 'sql',
        totalResults: 0,
      };
    }

    // Step 2: Batch fetch enrichments (single query, no N+1)
    const serviceIds = sqlResults.map(r => r.serviceId);
    const enrichments = await storage.getEnrichmentsBatch(serviceIds);

    console.log(`[FastSearch] Enrichments: ${enrichments.size}/${serviceIds.length} cached`);

    // Step 3: Compose lite service results
    const services: LiteService[] = sqlResults.map(sr => {
      const enrichment = enrichments.get(sr.serviceId);
      return {
        id: sr.serviceId,
        name: sr.name,
        category: enrichment?.aiCategory || sr.category,
        description: this.truncateDescription(
          enrichment?.aiDescription || sr.description
        ),
        location: enrichment?.aiLocation || sr.location || '',
        waitTimes: enrichment?.aiWaitTimes || sr.waitTimes || '',
      };
    });

    // Determine search type based on enrichment availability
    const searchType = enrichments.size > 0 ? 'sql+enrichment' : 'sql';

    return {
      services,
      summary: this.buildSummary(services.length, analysis.raw, analysis.location.specified),
      searchType,
      totalResults: services.length,
    };
  }
}
