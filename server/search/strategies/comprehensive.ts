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
import type { QueryIntent } from '../config';

// Enhanced query result from OpenAI
interface EnhancedQuery {
  rewritten: string;
  categories: string[];
  keywords: string[];
}

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

/**
 * Use OpenAI to rewrite a natural language query into searchable terms
 */
async function enhanceQueryWithOpenAI(rawQuery: string): Promise<EnhancedQuery | null> {
  try {
    const openai = getOpenAI();
    const startTime = Date.now();

    const response = await openai.chat.completions.create({
      model: SEARCH_CONFIG.openai.fastModel,
      temperature: SEARCH_CONFIG.openai.temperature,
      max_tokens: 200,
      messages: [{
        role: 'system',
        content: `You interpret user queries for an Alberta social services search engine.
Given a natural language query, extract search terms to find relevant services.
Output ONLY valid JSON with:
- rewritten: a clearer query for keyword search (2-5 words)
- categories: relevant service categories (1-3 items)
- keywords: specific search terms to find services (3-6 items)

Examples:
"i cant stop drinking" → {"rewritten":"alcohol addiction recovery services","categories":["addiction","recovery"],"keywords":["AA","alcoholics anonymous","detox","rehab","alcohol","sober living"]}
"i feel so hopeless" → {"rewritten":"mental health counselling support","categories":["mental health","counselling"],"keywords":["depression","therapy","counsellor","crisis","support group"]}
"nowhere to sleep tonight" → {"rewritten":"emergency shelter housing","categories":["shelter","housing"],"keywords":["homeless","emergency shelter","beds","accommodation","housing"]}`
      }, {
        role: 'user',
        content: rawQuery
      }],
    });

    const content = response.choices[0].message.content?.trim();
    if (!content) return null;

    const result = JSON.parse(content) as EnhancedQuery;
    console.log(`[ComprehensiveSearch] OpenAI query enhancement in ${Date.now() - startTime}ms: "${rawQuery}" → "${result.rewritten}"`);
    return result;
  } catch (err) {
    console.warn('[ComprehensiveSearch] OpenAI query enhancement failed:', err);
    return null;
  }
}

/**
 * Boost services that match the detected intent
 */
function boostByIntent(services: LiteService[], intent: QueryIntent): LiteService[] {
  const boostPatterns: Partial<Record<QueryIntent, RegExp>> = {
    'substance_abuse': /addiction|recovery|alcohol|drug|detox|rehab|sober|AA|NA|AADAC|peer support|treatment/i,
    'mental_health': /mental|counselling|counseling|therapy|therapist|depression|anxiety|support|crisis|psycholog/i,
    'housing_urgent': /shelter|housing|homeless|beds|accommodation|emergency housing|drop-in/i,
  };

  const pattern = boostPatterns[intent];
  if (!pattern) return services;

  // Create a scored copy
  const scored = services.map(svc => {
    const text = `${svc.name} ${svc.category} ${svc.description}`;
    const matches = pattern.test(text);
    return { svc, boost: matches ? 1 : 0 };
  });

  // Sort by boost (matching services first) while preserving relative order
  scored.sort((a, b) => b.boost - a.boost);

  console.log(`[ComprehensiveSearch] Intent boosting for ${intent}: ${scored.filter(s => s.boost > 0).length} services boosted`);
  return scored.map(s => s.svc);
}

export class ComprehensiveSearchStrategy extends BaseSearchStrategy {
  readonly name = 'comprehensive';

  async search(analysis: QueryAnalysis, input: SearchInput): Promise<SearchResult> {
    const config = SEARCH_CONFIG.modes.comprehensive;
    const startTime = Date.now();

    // Check if this is a domain-specific intent that needs OpenAI query enhancement
    const isDomainIntent = ['substance_abuse', 'mental_health', 'housing_urgent'].includes(analysis.intent);

    // For domain intents, use OpenAI to get better search terms
    let enhancedQuery: EnhancedQuery | null = null;
    let searchQuery = analysis.raw;

    if (isDomainIntent && config.useOpenAI) {
      enhancedQuery = await enhanceQueryWithOpenAI(analysis.raw);
      if (enhancedQuery) {
        // Use the enhanced keywords for search
        searchQuery = enhancedQuery.keywords.join(' ');
      }
    }

    // Check if embeddings are available
    const hasEmbeddings = await checkEmbeddingsAvailable();

    // Run SQL and semantic search in parallel
    // For domain intents, search with enhanced keywords
    const sqlPromise = storage.fastSearch(
      searchQuery,
      analysis.location.specified,
      analysis.intent === 'location_only',
      config.maxResults
    );

    // For semantic search, use the rewritten query if available (more natural language)
    const semanticQuery = enhancedQuery ? enhancedQuery.rewritten : analysis.raw;
    const semanticPromise = hasEmbeddings
      ? this.runSemanticSearch(semanticQuery, analysis.location.specified)
      : Promise.resolve([]);

    const [sqlResults, semanticResults] = await Promise.all([sqlPromise, semanticPromise]);

    console.log(`[ComprehensiveSearch] SQL: ${sqlResults.length}, Semantic: ${semanticResults.length} in ${Date.now() - startTime}ms`);

    // Merge results with deduplication
    let { services, searchType } = await this.mergeResults(
      sqlResults,
      semanticResults,
      analysis
    );

    // Apply intent-based boosting for domain intents
    if (isDomainIntent) {
      services = boostByIntent(services, analysis.intent);
    }

    // Check if we need additional OpenAI enhancement (very few results)
    if (services.length < config.minResultsBeforeOpenAI &&
        config.useOpenAI &&
        analysis.intent !== 'crisis' &&
        analysis.intent !== 'alias') {
      console.log(`[ComprehensiveSearch] Only ${services.length} results after enhancement`);
    }

    return {
      services,
      summary: this.buildSummary(services.length, analysis.raw, analysis.location.specified),
      searchType,
      totalResults: services.length,
    };
  }

  private async runSemanticSearch(query: string, location: string | null): Promise<SemanticSearchResult[]> {
    try {
      const embedding = await generateQueryEmbedding(query);
      return await storage.semanticSearch(
        embedding,
        SEARCH_CONFIG.semantic.matchThresholdPrimary,
        SEARCH_CONFIG.semantic.maxCandidates,
        location
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
