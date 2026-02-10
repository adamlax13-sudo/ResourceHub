/**
 * Comprehensive Search Strategy
 *
 * Full-power search that can use embeddings and OpenAI.
 * Combines SQL + semantic search for better coverage.
 */

import { BaseSearchStrategy } from './base';
import { SEARCH_CONFIG } from '../config';
import type {
  QueryAnalysis,
  SearchInput,
  SearchResult,
  LiteService,
  SemanticSearchResult,
  SearchType,
} from '../types';
import { storage } from '../../storage';
import OpenAI from 'openai';

// OpenAI client (initialized lazily)
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

// Cache for embeddings availability check
let embeddingsAvailable: boolean | null = null;

async function checkEmbeddingsAvailable(): Promise<boolean> {
  if (embeddingsAvailable !== null) return embeddingsAvailable;
  try {
    embeddingsAvailable = await storage.hasEmbeddings();
    console.log(`[ComprehensiveSearch] Embeddings available: ${embeddingsAvailable}`);
  } catch {
    embeddingsAvailable = false;
  }
  return embeddingsAvailable;
}

async function generateQueryEmbedding(query: string): Promise<number[]> {
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: SEARCH_CONFIG.semantic.model,
    input: query,
  });
  return response.data[0].embedding;
}

export class ComprehensiveSearchStrategy extends BaseSearchStrategy {
  readonly name = 'comprehensive';

  async search(analysis: QueryAnalysis, input: SearchInput): Promise<SearchResult> {
    const config = SEARCH_CONFIG.modes.comprehensive;
    const startTime = Date.now();

    // Check if embeddings are available
    const hasEmbeddings = await checkEmbeddingsAvailable();

    // Run SQL and semantic search in parallel
    const sqlPromise = storage.fastSearch(
      analysis.raw,
      analysis.location.specified,
      analysis.intent === 'location_only',
      config.maxResults
    );

    const semanticPromise = hasEmbeddings
      ? this.runSemanticSearch(analysis.raw)
      : Promise.resolve([]);

    const [sqlResults, semanticResults] = await Promise.all([sqlPromise, semanticPromise]);

    console.log(`[ComprehensiveSearch] SQL: ${sqlResults.length}, Semantic: ${semanticResults.length} in ${Date.now() - startTime}ms`);

    // Merge results with deduplication
    const { services, searchType } = await this.mergeResults(
      sqlResults,
      semanticResults,
      analysis
    );

    // Check if we need OpenAI enhancement (very few results)
    if (services.length < config.minResultsBeforeOpenAI &&
        config.useOpenAI &&
        analysis.intent !== 'crisis' &&
        analysis.intent !== 'alias') {
      console.log(`[ComprehensiveSearch] Only ${services.length} results, OpenAI enhancement would be triggered`);
      // For now, we return what we have - OpenAI integration can be added later
    }

    return {
      services,
      summary: this.buildSummary(services.length, analysis.raw, analysis.location.specified),
      searchType,
      totalResults: services.length,
    };
  }

  private async runSemanticSearch(query: string): Promise<SemanticSearchResult[]> {
    try {
      const embedding = await generateQueryEmbedding(query);
      return await storage.semanticSearch(
        embedding,
        SEARCH_CONFIG.semantic.matchThresholdPrimary,
        SEARCH_CONFIG.semantic.maxCandidates
      );
    } catch (err) {
      console.warn('[ComprehensiveSearch] Semantic search failed:', err);
      return [];
    }
  }

  private async mergeResults(
    sqlResults: any[],
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
    const sqlServices: LiteService[] = sqlResults.map(sr => ({
      id: sr.serviceId,
      name: sr.name,
      category: enrichments.get(sr.serviceId)?.aiCategory || sr.category,
      description: this.truncateDescription(
        enrichments.get(sr.serviceId)?.aiDescription || sr.description
      ),
      location: enrichments.get(sr.serviceId)?.aiLocation || sr.location || '',
      waitTimes: enrichments.get(sr.serviceId)?.aiWaitTimes || sr.waitTimes || '',
    }));

    // Convert semantic results to lite services
    const semanticServices: LiteService[] = semanticResults.map(sr => ({
      id: sr.serviceId,
      name: sr.name,
      category: enrichments.get(sr.serviceId)?.aiCategory || sr.category,
      description: this.truncateDescription(
        enrichments.get(sr.serviceId)?.aiDescription || sr.description
      ),
      location: enrichments.get(sr.serviceId)?.aiLocation || sr.location || '',
      waitTimes: enrichments.get(sr.serviceId)?.aiWaitTimes || sr.waitTimes || '',
    }));

    // Sort semantic results by location relevance if location specified
    let sortedSemantic = semanticServices;
    if (analysis.location.specified) {
      const locLower = analysis.location.specified.toLowerCase();
      sortedSemantic = [...semanticServices].sort((a, b) => {
        const scoreLocation = (loc: string) => {
          const l = loc.toLowerCase();
          if (l.includes(locLower)) return 3;
          if (l.includes('alberta') || l.includes('province') || l === '') return 2;
          return 1;
        };
        return scoreLocation(b.location) - scoreLocation(a.location);
      });
    }

    // Merge: SQL first, then unique semantic results
    const combined: LiteService[] = [...sqlServices];
    const existingIds = new Set(sqlServices.map(s => s.id));
    let addedFromSemantic = 0;

    for (const svc of sortedSemantic) {
      if (!existingIds.has(svc.id)) {
        combined.push(svc);
        existingIds.add(svc.id);
        addedFromSemantic++;
      }
    }

    // Determine search type
    let searchType: SearchType = 'sql';
    if (enrichments.size > 0) {
      searchType = 'sql+enrichment';
    }
    if (addedFromSemantic > 0) {
      searchType = sqlServices.length > 0 ? 'sql+semantic' : 'semantic';
    }

    if (addedFromSemantic > 0) {
      console.log(`[ComprehensiveSearch] Added ${addedFromSemantic} from semantic. Total: ${combined.length}`);
    }

    return { services: combined, searchType };
  }
}
