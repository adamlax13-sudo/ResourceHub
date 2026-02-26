/**
 * Comprehensive Search Strategy
 *
 * Full-power search that can use embeddings and OpenAI.
 * Combines SQL + semantic search for better coverage.
 *
 * This module acts as a thin orchestrator, delegating to specialized modules:
 * - detectors.ts: Query analysis and preference detection
 * - scoring.ts: Boost/penalty logic and intent-based ranking
 * - filters.ts: Diversity and exclusion filtering
 * - merger.ts: Result merging and RRF scoring
 */

import { BaseSearchStrategy } from './base';
import { SEARCH_CONFIG } from '../config';
import type {
  QueryAnalysis,
  SearchInput,
  SearchResult,
  LiteService,
  LiteServiceWithDebug,
  SemanticSearchResult,
} from '../types';
import { storage } from '../../storage';
import OpenAI from 'openai';
import { mergeForLiteView } from '../../helpers/enrichment';
import { LRUCache } from 'lru-cache';

// Import from new modules
import {
  detectGenderPreference,
  detectAgeGroup,
  detectUrgency,
  detectFamilySituation,
  detectCommunityPreference,
  detectExclusions,
  type AgeGroupDetection,
} from './detectors';

import {
  boostByIntent,
  applyNegativePenalty,
  type BoostOptions,
} from './scoring';

import {
  applyCategoryDiversity,
  applyOrganizationDiversity,
  applyAgeFilter,
  applyExclusionFilter,
} from './filters';

import {
  mergeResults,
  truncateDescription,
  buildSummary,
  type SQLSearchResult,
} from './merger';

// LRU cache for query embeddings - avoids repeated OpenAI API calls
const embeddingCache = new LRUCache<string, number[]>({
  max: 500,                      // Max 500 cached embeddings
  ttl: 1000 * 60 * 60 * 24,      // 24 hour TTL
});

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
  // Normalize the query for cache key
  const cacheKey = query.toLowerCase().trim();

  // Check cache first
  const cached = embeddingCache.get(cacheKey);
  if (cached) {
    console.log(`[Embedding] Cache HIT for: "${cacheKey.substring(0, 40)}..."`);
    return cached;
  }

  // Generate new embedding
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: SEARCH_CONFIG.semantic.model,
    input: query,
  });
  const embedding = response.data[0].embedding;

  // Store in cache
  embeddingCache.set(cacheKey, embedding);
  console.log(`[Embedding] Cache MISS, stored: "${cacheKey.substring(0, 40)}..."`);

  return embedding;
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
- keywords: specific search terms to find services (3-6 items). Include GENERAL terms like "addiction", "treatment", "support" alongside specific ones.

Examples:
"i cant stop drinking" → {"rewritten":"alcohol addiction recovery services","categories":["addiction","recovery"],"keywords":["AA","alcoholics anonymous","detox","rehab","alcohol","addiction","recovery"]}
"i feel so hopeless" → {"rewritten":"mental health counselling support","categories":["mental health","counselling"],"keywords":["depression","therapy","counsellor","crisis","support","mental health"]}
"nowhere to sleep tonight" → {"rewritten":"emergency shelter housing","categories":["shelter","housing"],"keywords":["homeless","emergency shelter","beds","accommodation","housing","shelter"]}
"my child is addicted to drugs" → {"rewritten":"youth addiction family support","categories":["addiction","youth","family support"],"keywords":["addiction","treatment","youth","family","support","PCHAD","intervention","parent"]}
"im autistic and cant make friends" → {"rewritten":"autism social skills support group","categories":["disability","autism support","social programs"],"keywords":["autism","ASD","autistic","social skills","support group","peer support","community program","neurodivergent","disability services"]}
"adhd help" → {"rewritten":"ADHD support services","categories":["mental health","disability"],"keywords":["ADHD","attention deficit","counselling","therapy","support","mental health","assessment"]}
"lonely no friends isolated" → {"rewritten":"social isolation support","categories":["mental health","community","support"],"keywords":["loneliness","isolation","social support","counselling","community","support group","mental health"]}
"my mom passed away" → {"rewritten":"grief bereavement support","categories":["grief","bereavement","support"],"keywords":["grief","loss","mourning","support group","counselling","bereavement","hospice"]}
"my husband was murdered" → {"rewritten":"grief violent loss survivor support","categories":["grief","bereavement","trauma"],"keywords":["grief","loss","mourning","homicide","violent loss","survivor","trauma","counselling","support group"]}
"i had a miscarriage" → {"rewritten":"pregnancy loss grief support","categories":["grief","pregnancy loss","support"],"keywords":["miscarriage","pregnancy loss","infant loss","grief","bereavement","support group","perinatal"]}
"my dog died" → {"rewritten":"pet loss grief support","categories":["grief","pet loss"],"keywords":["pet loss","grief","bereavement","animal loss","support","counselling"]}
"i was raped" → {"rewritten":"sexual assault support services","categories":["crisis","sexual assault","trauma"],"keywords":["sexual assault","rape","crisis","trauma","support","counselling","SACE"]}
"i have an eating disorder" → {"rewritten":"eating disorder support treatment","categories":["mental health","eating disorder"],"keywords":["eating disorder","anorexia","bulimia","recovery","treatment","support","therapy"]}
"postpartum depression help" → {"rewritten":"postpartum depression support","categories":["mental health","postpartum"],"keywords":["postpartum","PPD","depression","perinatal","support","counselling","new mom"]}
"senior services for my dad" → {"rewritten":"senior elderly care services","categories":["senior","aging","elder care"],"keywords":["senior","elderly","aging","home care","dementia","retirement","meals on wheels"]}
"need a lawyer for custody" → {"rewritten":"family law legal aid custody","categories":["legal","family law"],"keywords":["legal aid","lawyer","custody","family court","divorce","child support"]}
"lost my job need help" → {"rewritten":"employment job training support","categories":["employment","career"],"keywords":["employment","job training","resume","career","workforce","EI","unemployment"]}
"help for my teenager" → {"rewritten":"youth teen support services","categories":["youth","teen"],"keywords":["youth","teen","adolescent","support","counselling","kids help phone"]}
"new to canada need help" → {"rewritten":"newcomer settlement services","categories":["newcomer","settlement"],"keywords":["immigrant","refugee","newcomer","settlement","ESL","citizenship"]}
"my husband is an alcoholic" → {"rewritten":"family addiction support al-anon","categories":["family support","addiction"],"keywords":["al-anon","family addiction support","loved one","concerned person","codependent"]}
"cant pay my bills in debt" → {"rewritten":"financial debt assistance","categories":["financial","debt"],"keywords":["financial","debt","credit counselling","bankruptcy","budget","money management"]}
"caregiver burnout exhausted" → {"rewritten":"caregiver respite support","categories":["caregiver","respite"],"keywords":["caregiver","respite","burnout","support","family caregiver"]}
"trans healthcare support" → {"rewritten":"LGBTQ transgender healthcare","categories":["lgbtq","transgender"],"keywords":["lgbtq","trans","transgender","gender affirming","pride","healthcare"]}
"indigenous mental health support" → {"rewritten":"indigenous first nations mental health","categories":["indigenous","first nations"],"keywords":["indigenous","first nations","metis","inuit","native","aboriginal","elder","traditional healing"]}
"student counselling uofc" → {"rewritten":"university calgary student counselling","categories":["campus","student"],"keywords":["ucalgary","u of c","student","campus","counselling","wellness","university"]}
"i need diapers and formula" → {"rewritten":"baby supplies parenting support","categories":["parenting","baby resources"],"keywords":["baby","infant","diapers","formula","parenting","parent support","baby supplies"]}`
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

// Domain-specific fallback terms for zero-result scenarios
const DOMAIN_FALLBACK_TERMS: Record<string, string> = {
  'substance_abuse': 'addiction treatment recovery support',
  'mental_health': 'mental health counselling therapy support',
  'housing_urgent': 'shelter housing emergency homeless',
  'food_insecurity': 'food bank meals groceries',
  'domestic_violence': 'domestic violence shelter women safety',
  'disability_support': 'autism disability support group social skills neurodivergent ADHD community program',
  'grief_support': 'grief bereavement loss mourning support group counselling hospice memorial',
  'senior_services': 'senior elderly aging support services home care meals retirement dementia geriatric',
  'legal_aid': 'legal aid lawyer court services immigration family law custody divorce free legal',
  'employment_support': 'employment job training career support workforce resume EI unemployment',
  'youth_services': 'youth teen adolescent services support young adult crisis kids help phone',
  'newcomer_services': 'immigrant refugee newcomer settlement services ESL language citizenship',
  'family_addiction_support': 'al-anon nar-anon family addiction support loved one caregiver intervention',
  'financial_support': 'financial debt credit counselling bankruptcy budget money management assistance',
  'caregiver_support': 'caregiver respite family caregiver support burnout caring for elderly',
  'lgbtq_services': 'lgbtq lgbt queer trans transgender gay lesbian pride gender affirming support',
  'indigenous_services': 'indigenous first nations métis inuit native aboriginal elder ceremony healing treaty',
  'student_services': 'campus university college student counselling mental health support crisis',
  'parenting_support': 'pregnancy pregnant baby infant parenting parent support formula diapers childcare postpartum',
};

// Domain intents that benefit from OpenAI enhancement
const DOMAIN_INTENTS = [
  'crisis', 'domestic_violence', 'food_insecurity', 'housing_urgent', 'substance_abuse',
  'mental_health', 'disability_support', 'grief_support', 'senior_services',
  'legal_aid', 'employment_support', 'youth_services', 'newcomer_services',
  'family_addiction_support', 'financial_support', 'caregiver_support', 'lgbtq_services',
  'indigenous_services', 'student_services', 'parenting_support', 'veteran_services'
];

export class ComprehensiveSearchStrategy extends BaseSearchStrategy {
  readonly name = 'comprehensive';

  async search(analysis: QueryAnalysis, input: SearchInput): Promise<SearchResult> {
    const config = SEARCH_CONFIG.search;
    const startTime = Date.now();
    const boostOptions: BoostOptions = { trackExplanations: input.debug ?? false };

    // Check if this is a domain-specific intent that needs OpenAI query enhancement
    const isDomainIntent = DOMAIN_INTENTS.includes(analysis.intent);

    // Check if embeddings are available (cached after first check)
    const hasEmbeddings = await checkEmbeddingsAvailable();

    // ============= TIER 1: ALIAS/EXACT MATCH (<20ms) =============
    // If user is searching for a specific known service by alias, return immediately
    if (analysis.intent === 'alias' && analysis.aliasMatch) {
      const aliasResult = await storage.getServiceById(analysis.aliasMatch);
      if (aliasResult.service) {
        console.log(`[TieredSearch] Tier 1: Alias match for "${analysis.aliasMatch}" in ${Date.now() - startTime}ms`);
        return {
          services: [{
            id: aliasResult.service.serviceId,
            name: aliasResult.service.name,
            category: aliasResult.service.category || '',
            description: truncateDescription(aliasResult.service.description || ''),
            location: aliasResult.service.location || aliasResult.service.address || '',
            waitTimes: aliasResult.service.waitTimes || '',
          }],
          summary: '',
          searchType: 'sql',
          totalResults: 1,
        };
      }
    }

    // ============= TIER 2: FAST SQL PATH (<50ms) =============
    // For simple, high-confidence queries, SQL alone may be sufficient
    const sqlOnly = await storage.fastSearch(
      analysis.raw,
      analysis.location.specified,
      analysis.intent === 'location_only',
      config.maxResults
    );

    // Calculate average score to determine confidence
    const avgSqlScore = sqlOnly.length > 0
      ? sqlOnly.reduce((sum, r) => sum + (r.relevanceScore || 0), 0) / sqlOnly.length
      : 0;

    // If SQL returns many high-confidence results, skip semantic search
    if (sqlOnly.length >= 10 && avgSqlScore > 80 && !isDomainIntent) {
      console.log(`[TieredSearch] Tier 2: High-confidence SQL (${sqlOnly.length} results, avg score ${avgSqlScore.toFixed(1)}) in ${Date.now() - startTime}ms`);

      // Convert to LiteService format
      const enrichments = await storage.getEnrichmentsBatch(sqlOnly.map(r => r.serviceId));
      const services: LiteService[] = sqlOnly.map(sr => {
        const enrichment = enrichments.get(sr.serviceId);
        const merged = mergeForLiteView(
          {
            serviceId: sr.serviceId,
            name: sr.name,
            category: sr.category,
            description: sr.description,
            location: sr.location,
            address: sr.address,
            waitTimes: sr.waitTimes,
          },
          enrichment
        );
        return {
          id: sr.serviceId,
          name: sr.name,
          category: merged.category,
          description: truncateDescription(merged.description),
          location: merged.location,
          waitTimes: merged.waitTimes,
          phone: sr.phone || undefined,
          is24_7: (sr as any).is24_7 || undefined,
        };
      });

      // Apply minimal boosting and return early
      const boosted = boostByIntent(services, analysis.intent, analysis.raw, analysis, boostOptions);
      let final = analysis.negativeTerms?.length
        ? applyNegativePenalty(boosted, analysis.negativeTerms, boostOptions)
        : boosted;

      // Apply category diversity for location-only queries to ensure mixed results
      if (analysis.intent === 'location_only') {
        final = applyCategoryDiversity(final);
      }

      const finalServices = applyOrganizationDiversity(final, analysis.raw);
      return {
        services: finalServices,
        servicesWithDebug: input.debug ? finalServices as LiteServiceWithDebug[] : undefined,
        summary: buildSummary(finalServices.length, analysis.raw, analysis.location.specified),
        searchType: enrichments.size > 0 ? 'sql+enrichment' : 'sql',
        totalResults: finalServices.length,
      };
    }

    // ============= TIER 3: FULL SEARCH (SQL + SEMANTIC + OpenAI) =============
    // Continue with parallel execution for complex queries

    // ============= PARALLEL EXECUTION =============
    // Run SQL search, semantic search, and OpenAI enhancement ALL IN PARALLEL
    // This saves 200-500ms compared to waiting for OpenAI before searching

    const sqlPromise = storage.fastSearch(
      analysis.raw,  // Use raw query for initial search
      analysis.location.specified,
      analysis.intent === 'location_only',
      config.maxResults
    );

    const semanticPromise = hasEmbeddings
      ? this.runSemanticSearch(analysis.raw, analysis.location.specified)
      : Promise.resolve([]);

    // OpenAI enhancement runs in parallel - no longer blocks initial search!
    const enhancePromise = (isDomainIntent && config.useOpenAI)
      ? enhanceQueryWithOpenAI(analysis.raw)
      : Promise.resolve(null);

    // Wait for all three to complete
    let [sqlResults, semanticResults, enhancedQuery] = await Promise.all([
      sqlPromise,
      semanticPromise,
      enhancePromise,
    ]);

    console.log(`[ComprehensiveSearch] Initial (parallel): SQL=${sqlResults.length}, Semantic=${semanticResults.length} in ${Date.now() - startTime}ms`);

    // Log enhanced keywords if available
    if (enhancedQuery) {
      console.log(`[ComprehensiveSearch] Enhanced keywords: ${enhancedQuery.keywords.join(', ')}`);
    }

    // ============= SUPPLEMENTARY SEARCH =============
    // If initial results are poor AND we have enhanced keywords, do a supplementary search
    const needsSupplementary = (sqlResults.length < 5 || semanticResults.length < 3) && enhancedQuery;

    if (needsSupplementary && enhancedQuery) {
      const supplementaryQuery = enhancedQuery.keywords.join(' ');
      console.log(`[ComprehensiveSearch] Running supplementary search with enhanced keywords`);

      const [extraSql, extraSemantic] = await Promise.all([
        storage.fastSearch(supplementaryQuery, analysis.location.specified, false, 30),
        hasEmbeddings ? this.runSemanticSearch(enhancedQuery.rewritten, analysis.location.specified) : Promise.resolve([]),
      ]);

      // Merge supplementary results (deduplicated)
      const existingIds = new Set([
        ...sqlResults.map(r => r.serviceId),
        ...semanticResults.map(r => r.serviceId)
      ]);

      const newSql = extraSql.filter(r => !existingIds.has(r.serviceId));
      const newSemantic = extraSemantic.filter(r => !existingIds.has(r.serviceId));

      sqlResults = [...sqlResults, ...newSql];
      semanticResults = [...semanticResults, ...newSemantic];

      console.log(`[ComprehensiveSearch] After supplementary: SQL=${sqlResults.length}, Semantic=${semanticResults.length}`);
    }

    // ============= FALLBACK: Domain-specific terms =============
    // If still no results for domain intents, try broad domain terms
    if (sqlResults.length === 0 && semanticResults.length === 0 && isDomainIntent) {
      const fallbackTerms = DOMAIN_FALLBACK_TERMS[analysis.intent];
      if (fallbackTerms) {
        console.log(`[ComprehensiveSearch] Zero results, trying domain fallback: "${fallbackTerms}"`);

        const [domainSql, domainSemantic] = await Promise.all([
          storage.fastSearch(fallbackTerms, analysis.location.specified, false, config.maxResults),
          hasEmbeddings ? this.runSemanticSearch(fallbackTerms, analysis.location.specified) : Promise.resolve([]),
        ]);

        sqlResults = domainSql;
        semanticResults = domainSemantic;
        console.log(`[ComprehensiveSearch] Domain fallback results: SQL=${sqlResults.length}, Semantic=${semanticResults.length}`);
      }
    }

    // Merge results with deduplication using RRF
    let { services, searchType } = await mergeResults(
      sqlResults as SQLSearchResult[],
      semanticResults,
      analysis
    );

    // Apply exclusion filter for hard filtering (must happen before scoring)
    const exclusions = detectExclusions(analysis.raw, analysis.intent);
    services = applyExclusionFilter(services, exclusions);

    // Apply age-based filtering for high-confidence queries
    const ageDetection = detectAgeGroup(analysis.raw);
    services = applyAgeFilter(services, ageDetection);

    // Apply intent-based boosting for domain intents or when any preference is detected
    const hasGenderPreference = detectGenderPreference(analysis.raw) !== null;
    const hasAgeGroup = detectAgeGroup(analysis.raw) !== null;
    const hasUrgency = detectUrgency(analysis.raw) !== null;
    const hasFamilySituation = detectFamilySituation(analysis.raw).length > 0;
    const hasCommunityPref = detectCommunityPreference(analysis.raw) !== null;
    const hasAnyPreference = hasGenderPreference || hasAgeGroup || hasUrgency || hasFamilySituation || hasCommunityPref;

    if (isDomainIntent || hasAnyPreference) {
      services = boostByIntent(services, analysis.intent, analysis.raw, analysis, boostOptions);
    }

    // Apply negative keyword penalty (e.g., "shelter not religious")
    if (analysis.negativeTerms && analysis.negativeTerms.length > 0) {
      services = applyNegativePenalty(services, analysis.negativeTerms, boostOptions);
    }

    // Apply organization diversity to prevent monopoly in top results
    // Pass query so we can skip limiting when user searches for specific org
    services = applyOrganizationDiversity(services, analysis.raw);

    // Check if we need additional OpenAI enhancement (very few results)
    if (services.length < config.minResultsBeforeOpenAI &&
        config.useOpenAI &&
        analysis.intent !== 'crisis' &&
        analysis.intent !== 'alias') {
      console.log(`[ComprehensiveSearch] Only ${services.length} results after enhancement`);
    }

    return {
      services,
      servicesWithDebug: input.debug ? services as LiteServiceWithDebug[] : undefined,
      summary: buildSummary(services.length, analysis.raw, analysis.location.specified),
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
}
