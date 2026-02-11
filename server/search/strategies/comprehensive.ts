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
import type { QueryIntent, SubstanceType } from '../config';

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
 * Detect gender preference from query text
 * Returns 'women_only', 'men_only', or null
 */
function detectGenderPreference(query: string): 'women_only' | 'men_only' | null {
  const q = query.toLowerCase();

  // Female-associated terms
  const femalePatterns = [
    /\b(mother|mom|mum|mama|mommy)\b/,
    /\b(pregnant|pregnancy|expecting)\b/,
    /\b(daughter|sister|wife|girlfriend)\b/,
    /\b(woman|women|female|girl)\b/,
    /\bi am a (mother|mom|woman|female)\b/,
    /\bas a (mother|mom|woman|female)\b/,
    /\b(postpartum|maternity|maternal)\b/,
  ];

  // Male-associated terms
  const malePatterns = [
    /\b(father|dad|daddy|papa)\b/,
    /\b(son|brother|husband|boyfriend)\b/,
    /\b(man|men|male|guy)\b/,
    /\bi am a (father|dad|man|male)\b/,
    /\bas a (father|dad|man|male)\b/,
  ];

  const isFemale = femalePatterns.some(p => p.test(q));
  const isMale = malePatterns.some(p => p.test(q));

  // If both or neither, no preference
  if (isFemale && !isMale) return 'women_only';
  if (isMale && !isFemale) return 'men_only';
  return null;
}

/**
 * Detect age group preference from query text
 * Returns 'youth', 'senior', or null
 */
function detectAgeGroup(query: string): 'youth' | 'senior' | null {
  const q = query.toLowerCase();

  // Youth patterns
  const youthPatterns = [
    /\b(teenager|teen|adolescent|youth|young adult)\b/,
    /\b(high school|university|college|student)\b/,
    /\b(under 18|under 25|under18|under25)\b/,
    /\b(1[3-9]|2[0-4])\s*(year|yr)s?\s*old\b/,
    /\bmy\s+(son|daughter|kid|child)\b/,
    /\b(child|children|kids)\b/,
    /\b(young|juvenile|minor)\b/,
  ];

  // Senior patterns
  const seniorPatterns = [
    /\b(elderly|senior|aging|aged|older adult)\b/,
    /\b(65\+|70\+|over 65|over 60)\b/,
    /\b([6-9][0-9]|100)\s*(year|yr)s?\s*old\b/,
    /\b(retirement|retired|pension)\b/,
    /\b(dementia|alzheimer|mobility issues?|arthritis)\b/,
    /\b(grandparent|grandmother|grandfather|grandma|grandpa)\b/,
  ];

  if (youthPatterns.some(p => p.test(q))) return 'youth';
  if (seniorPatterns.some(p => p.test(q))) return 'senior';
  return null;
}

/**
 * Detect urgency level from query text
 * Returns 'immediate' or null
 */
function detectUrgency(query: string): 'immediate' | null {
  const q = query.toLowerCase();

  // Immediate urgency patterns
  const immediatePatterns = [
    /\b(right now|tonight|this minute|immediately|asap)\b/,
    /\bneed\s+.{0,20}\s*now\b/,
    /\bhelp\s+.{0,20}\s*now\b/,
    /\b(this evening|this morning)\b/,
    /\b(emergency|urgent|crisis)\b/,
    /\b(about to|going to|will)\s+(be|become|get)\s+(evicted|kicked out|homeless)\b/,
    /\b(nowhere to go|no place to stay|no where to sleep)\b/,
    /\b(today|same day)\b/,
  ];

  if (immediatePatterns.some(p => p.test(q))) return 'immediate';
  return null;
}

/**
 * Detect family situation from query text
 * Returns array of detected situations
 */
function detectFamilySituation(query: string): string[] {
  const q = query.toLowerCase();
  const situations: string[] = [];

  // Single parent patterns
  if (/\b(single\s+(parent|mom|dad|mother|father)|raising\s+.{0,10}\s*alone|sole custody|only parent)\b/.test(q)) {
    situations.push('single_parent');
  }

  // Custody/divorce patterns
  if (/\b(custody|divorce|separation|visitation|family court|child access|co-parenting)\b/.test(q)) {
    situations.push('family_legal');
  }

  // Pregnancy/newborn patterns
  if (/\b(pregnant|pregnancy|expecting|newborn|infant|baby|postpartum|prenatal|maternity)\b/.test(q)) {
    situations.push('pregnancy');
  }

  // Parent with children general
  if (/\b(with\s+(my\s+)?(kids?|children|child)|parent(ing)?|family)\b/.test(q) && situations.length === 0) {
    situations.push('family_general');
  }

  return situations;
}

/**
 * Detect community/cultural preference from query text
 * Returns community identifier or null
 */
function detectCommunityPreference(query: string): string | null {
  const q = query.toLowerCase();

  // Indigenous patterns
  if (/\b(indigenous|first nations?|metis|m[eé]tis|inuit|aboriginal|native|fnmi)\b/.test(q)) {
    return 'indigenous';
  }

  // Newcomer/immigrant patterns
  if (/\b(newcomer|refugee|immigrant|asylum|visa|settlement|new to canada|esl)\b/.test(q)) {
    return 'newcomer';
  }

  // LGBTQ2S+ patterns
  if (/\b(lgbtq|lgbt|gay|lesbian|trans|transgender|queer|2slgbtq|2s|two-spirit|bisexual|non-?binary)\b/.test(q)) {
    return 'lgbtq';
  }

  // Veteran patterns
  if (/\b(veteran|military|armed forces|ex-military|former military|canadian forces)\b/.test(q)) {
    return 'veteran';
  }

  return null;
}

/**
 * Map query intent to expected service types and boost patterns
 */
const INTENT_SERVICE_MAP: Partial<Record<QueryIntent, {
  serviceTypes: string[];
  categoryPatterns: RegExp;
  genderPreference?: 'women_only' | 'men_only';
}>> = {
  'domestic_violence': {
    serviceTypes: ['domestic_violence', 'emergency_shelter', 'crisis_line'],
    categoryPatterns: /domestic|violence|abuse|women'?s.*shelter|safe.*house|crisis.*line|victim|assault/i,
    genderPreference: 'women_only',
  },
  'food_insecurity': {
    serviceTypes: ['food_resources'],
    categoryPatterns: /food.*bank|pantry|meals|groceries|hunger|nutrition|hamper/i,
  },
  'housing_urgent': {
    serviceTypes: ['emergency_shelter'],
    categoryPatterns: /shelter|housing|homeless|beds|accommodation|emergency housing|drop-in/i,
  },
  'substance_abuse': {
    serviceTypes: ['addiction_recovery', 'residential_treatment'],
    categoryPatterns: /addiction|recovery|alcohol|drug|detox|rehab|sober|AA|NA|AADAC|peer support|treatment/i,
  },
  'mental_health': {
    serviceTypes: ['mental_health', 'counselling', 'crisis_line'],
    categoryPatterns: /mental|counselling|counseling|therapy|therapist|depression|anxiety|support|crisis|psycholog/i,
  },
};

/**
 * Detect what substance a service specializes in based on its name/description/category
 * Returns 'general' for services that handle all addictions (residential treatment, etc.)
 */
function detectServiceSubstanceType(name: string, description: string, category: string): SubstanceType {
  const text = `${name} ${description} ${category}`.toLowerCase();
  const indicators = SEARCH_CONFIG.serviceSubstanceIndicators;

  // Check specific substances first (more specific = higher priority)
  if (indicators.alcohol.test(text)) return 'alcohol';
  if (indicators.opioid.test(text)) return 'opioid';
  if (indicators.stimulant.test(text)) return 'stimulant';
  if (indicators.cannabis.test(text)) return 'cannabis';
  if (indicators.gambling.test(text)) return 'gambling';

  // Check if it's a general addiction service
  if (indicators.general.test(text)) return 'general';

  return null;
}

/**
 * Boost services that match the detected intent, gender, age, urgency, family, and community preferences
 * Uses both service_type field (if available) and text pattern matching
 */
function boostByIntent(services: LiteService[], intent: QueryIntent, rawQuery: string, analysis?: QueryAnalysis): LiteService[] {
  const intentConfig = INTENT_SERVICE_MAP[intent];

  // Detect all preferences from query
  const genderPref = detectGenderPreference(rawQuery);
  const ageGroup = detectAgeGroup(rawQuery);
  const urgency = detectUrgency(rawQuery);
  const familySituations = detectFamilySituation(rawQuery);
  const communityPref = detectCommunityPreference(rawQuery);

  // Log detected preferences
  const detections: string[] = [];
  if (genderPref) detections.push(`gender:${genderPref}`);
  if (ageGroup) detections.push(`age:${ageGroup}`);
  if (urgency) detections.push(`urgency:${urgency}`);
  if (familySituations.length > 0) detections.push(`family:${familySituations.join(',')}`);
  if (communityPref) detections.push(`community:${communityPref}`);
  if (detections.length > 0) {
    console.log(`[ComprehensiveSearch] Detected preferences: ${detections.join(', ')}`);
  }

  // Create a scored copy with multi-factor boosting
  const scored = services.map(svc => {
    let boost = 0;
    const text = `${svc.name} ${svc.category} ${svc.description}`;
    const textLower = text.toLowerCase();

    // Intent-based boosting (if applicable)
    if (intentConfig) {
      // Boost 1: Text pattern matching (primary)
      if (intentConfig.categoryPatterns.test(text)) {
        boost += 10;
      }

      // Boost 2: Category name contains relevant keywords
      const category = svc.category.toLowerCase();
      if (intentConfig.serviceTypes.some(st => category.includes(st.replace('_', ' ')))) {
        boost += 5;
      }

      // Boost 3: 24/7 services get small boost for urgent intents
      if (['housing_urgent', 'domestic_violence'].includes(intent) && /24\/7|24 hour/i.test(text)) {
        boost += 2;
      }
    }

    // Gender-based boosting
    if (genderPref) {
      const isWomensService = /women|woman|female|mother|girl|domestic violence|yw\s|ywca/i.test(textLower);
      const isMensService = /\bmen\b|male|father|\bmen'?s\b/i.test(textLower) && !isWomensService;
      const menOnlyIndicator = /men'?s.*shelter|men only|males only|for men\b/i.test(textLower);
      const womenOnlyIndicator = /women'?s.*shelter|women only|females only|for women\b/i.test(textLower);

      if (genderPref === 'women_only') {
        if (isWomensService || womenOnlyIndicator) boost += 8;
        if (menOnlyIndicator) boost -= 15;
      } else if (genderPref === 'men_only') {
        if (isMensService || menOnlyIndicator) boost += 8;
        if (womenOnlyIndicator) boost -= 15;
      }
    }

    // Age group boosting
    if (ageGroup) {
      const isYouthService = /youth|teen|adolescent|young|student|under 25|child|kids?|juvenile|minor|school/i.test(textLower);
      const isSeniorService = /senior|elderly|aging|aged|older adult|65\+|retirement|dementia|alzheimer/i.test(textLower);

      if (ageGroup === 'youth') {
        if (isYouthService) boost += 8;
        if (isSeniorService) boost -= 10;
      } else if (ageGroup === 'senior') {
        if (isSeniorService) boost += 8;
        if (isYouthService && /only|exclusive/i.test(textLower)) boost -= 10;
      }
    }

    // Urgency boosting - prioritize immediate access services
    if (urgency === 'immediate') {
      if (/24\/7|24 hour|walk-?in|emergency|crisis|immediate|no appointment|same day|drop-?in|open now/i.test(textLower)) {
        boost += 10;
      }
      // Slight penalty for services that require appointments/intake
      if (/appointment required|waitlist|intake process|wait time|waiting list/i.test(textLower)) {
        boost -= 3;
      }
    }

    // Family situation boosting
    if (familySituations.length > 0) {
      for (const situation of familySituations) {
        if (situation === 'single_parent') {
          if (/single parent|single mom|single dad|sole parent|family|child|parenting/i.test(textLower)) {
            boost += 6;
          }
        }
        if (situation === 'family_legal') {
          if (/legal|court|mediation|family services|custody|divorce|lawyer|law/i.test(textLower)) {
            boost += 8;
          }
        }
        if (situation === 'pregnancy') {
          if (/prenatal|maternity|infant|baby|parenting|newborn|pregnancy|pregnant|postpartum|maternal/i.test(textLower)) {
            boost += 8;
          }
        }
        if (situation === 'family_general') {
          if (/family|families|parent|child|kids/i.test(textLower)) {
            boost += 4;
          }
        }
      }
    }

    // Community preference boosting
    if (communityPref) {
      if (communityPref === 'indigenous') {
        if (/indigenous|first nations?|aboriginal|native|metis|m[eé]tis|inuit|fnmi/i.test(textLower)) {
          boost += 10;
        }
      }
      if (communityPref === 'newcomer') {
        if (/immigrant|refugee|newcomer|settlement|new canadian|esl|language|citizenship/i.test(textLower)) {
          boost += 10;
        }
      }
      if (communityPref === 'lgbtq') {
        if (/lgbtq|lgbt|pride|queer|trans|gay|lesbian|2slgbtq|two-spirit|non-?binary/i.test(textLower)) {
          boost += 10;
        }
      }
      if (communityPref === 'veteran') {
        if (/veteran|military|armed forces|canadian forces|vac\b|legion/i.test(textLower)) {
          boost += 10;
        }
      }
    }

    // Substance-specific boosting (for substance_abuse intent)
    // Boost values must be LARGE (50-100+) to overcome SQL scores of 100-150
    if (intent === 'substance_abuse' && analysis?.substanceType) {
      const querySubstance = analysis.substanceType;
      const serviceSubstance = detectServiceSubstanceType(svc.name, svc.description, svc.category);

      // Log for debugging
      if (serviceSubstance) {
        console.log(`[SubstanceBoost] "${svc.name.substring(0, 40)}" → ${serviceSubstance}, query wants: ${querySubstance}`);
      }

      if (querySubstance && serviceSubstance) {
        // Exact substance match: LARGE boost to overcome SQL scores
        if (querySubstance === serviceSubstance) {
          boost += 80;
          // Extra boost for peer support (AA, NA, GA, etc.) over residential
          if (/peer|support|anonymous|12.?step|meeting/i.test(textLower)) {
            boost += 40;
          }
        }
        // Query is specific (e.g., alcohol) but service is general (residential, detox): PENALTY
        else if (serviceSubstance === 'general' && querySubstance !== 'general') {
          boost -= 30;
        }
        // Query is general but service is specific: moderate boost (still relevant)
        else if (querySubstance === 'general' && serviceSubstance !== 'general') {
          boost += 20;
        }
        // Mismatch between specific types: small penalty
        else if (querySubstance !== serviceSubstance) {
          boost -= 15;
        }
      }
    }

    return { svc, boost };
  });

  // Sort by boost (highest first) while preserving relative order for equal scores
  scored.sort((a, b) => b.boost - a.boost);

  const boostedCount = scored.filter(s => s.boost > 0).length;
  const penalizedCount = scored.filter(s => s.boost < 0).length;
  console.log(`[ComprehensiveSearch] Intent boosting for ${intent}: ${boostedCount} boosted, ${penalizedCount} penalized`);

  return scored.map(s => s.svc);
}

export class ComprehensiveSearchStrategy extends BaseSearchStrategy {
  readonly name = 'comprehensive';

  async search(analysis: QueryAnalysis, input: SearchInput): Promise<SearchResult> {
    const config = SEARCH_CONFIG.search;
    const startTime = Date.now();

    // Check if this is a domain-specific intent that needs OpenAI query enhancement
    const isDomainIntent = ['domestic_violence', 'food_insecurity', 'housing_urgent', 'substance_abuse', 'mental_health'].includes(analysis.intent);

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

    // Apply intent-based boosting for domain intents or when any preference is detected
    const hasGenderPreference = detectGenderPreference(analysis.raw) !== null;
    const hasAgeGroup = detectAgeGroup(analysis.raw) !== null;
    const hasUrgency = detectUrgency(analysis.raw) !== null;
    const hasFamilySituation = detectFamilySituation(analysis.raw).length > 0;
    const hasCommunityPref = detectCommunityPreference(analysis.raw) !== null;
    const hasAnyPreference = hasGenderPreference || hasAgeGroup || hasUrgency || hasFamilySituation || hasCommunityPref;

    if (isDomainIntent || hasAnyPreference) {
      services = boostByIntent(services, analysis.intent, analysis.raw, analysis);
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
    // Prefer address over location for more complete info on cards
    const sqlServices: LiteService[] = sqlResults.map(sr => ({
      id: sr.serviceId,
      name: sr.name,
      category: enrichments.get(sr.serviceId)?.aiCategory || sr.category,
      description: this.truncateDescription(
        enrichments.get(sr.serviceId)?.aiDescription || sr.description
      ),
      location: sr.address || enrichments.get(sr.serviceId)?.aiLocation || sr.location || '',
      waitTimes: enrichments.get(sr.serviceId)?.aiWaitTimes || sr.waitTimes || '',
    }));

    // Convert semantic results to lite services
    // Prefer address over location for more complete info on cards
    const semanticServices: LiteService[] = semanticResults.map(sr => ({
      id: sr.serviceId,
      name: sr.name,
      category: enrichments.get(sr.serviceId)?.aiCategory || sr.category,
      description: this.truncateDescription(
        enrichments.get(sr.serviceId)?.aiDescription || sr.description
      ),
      location: sr.address || enrichments.get(sr.serviceId)?.aiLocation || sr.location || '',
      waitTimes: enrichments.get(sr.serviceId)?.aiWaitTimes || sr.waitTimes || '',
    }));

    // Sort semantic results by location relevance if location specified
    let sortedSemantic = semanticServices;
    if (analysis.location.specified) {
      // Handle comma-separated multiple locations
      const selectedLocations = analysis.location.specified.split(',').map(l => l.trim().toLowerCase()).filter(l => l);
      sortedSemantic = [...semanticServices].sort((a, b) => {
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
