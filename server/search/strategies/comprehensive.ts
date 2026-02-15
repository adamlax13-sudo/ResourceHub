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
import { mergeForLiteView } from '../../helpers/enrichment';
import { LRUCache } from 'lru-cache';

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
"im autistic and cant make friends" → {"rewritten":"autism social support counselling","categories":["mental health","disability","support groups"],"keywords":["autism","ASD","social skills","counselling","support group","therapy","community","mental health"]}
"adhd help" → {"rewritten":"ADHD support services","categories":["mental health","disability"],"keywords":["ADHD","attention deficit","counselling","therapy","support","mental health","assessment"]}
"lonely no friends isolated" → {"rewritten":"social isolation support","categories":["mental health","community","support"],"keywords":["loneliness","isolation","social support","counselling","community","support group","mental health"]}`
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
 * Student context with optional specific institution
 */
interface StudentContext {
  type: 'university' | 'college';
  institution: string | null; // e.g., 'ucalgary', 'ualberta', 'sait', etc.
}

/**
 * Detect if query mentions student/university context
 * Returns the institution type and specific institution if mentioned
 */
function detectStudentContext(query: string): StudentContext | null {
  const q = query.toLowerCase();

  // Specific institution patterns - order matters (most specific first)
  const institutionPatterns: { pattern: RegExp; institution: string; type: 'university' | 'college' }[] = [
    // University of Calgary
    { pattern: /\b(u of c|uofc|ucalgary|university of calgary|u of calgary)\b/, institution: 'ucalgary', type: 'university' },
    // University of Alberta
    { pattern: /\b(u of a|uofa|ualberta|university of alberta|u of alberta)\b/, institution: 'ualberta', type: 'university' },
    // Mount Royal University
    { pattern: /\b(mount royal|mru|mount royal university)\b/, institution: 'mru', type: 'university' },
    // University of Lethbridge
    { pattern: /\b(u of l|uleth|lethbridge university|university of lethbridge)\b/, institution: 'ulethbridge', type: 'university' },
    // MacEwan University
    { pattern: /\b(macewan|macewan university)\b/, institution: 'macewan', type: 'university' },
    // Athabasca University
    { pattern: /\b(athabasca|athabasca university|au)\b/, institution: 'athabasca', type: 'university' },
    // SAIT
    { pattern: /\b(sait|southern alberta institute)\b/, institution: 'sait', type: 'college' },
    // NAIT
    { pattern: /\b(nait|northern alberta institute)\b/, institution: 'nait', type: 'college' },
    // Bow Valley College
    { pattern: /\b(bow valley|bow valley college)\b/, institution: 'bowvalley', type: 'college' },
    // NorQuest College
    { pattern: /\b(norquest|norquest college)\b/, institution: 'norquest', type: 'college' },
    // Olds College
    { pattern: /\b(olds college)\b/, institution: 'olds', type: 'college' },
    // Red Deer Polytechnic
    { pattern: /\b(red deer|red deer college|red deer polytechnic)\b/, institution: 'reddeer', type: 'college' },
  ];

  // Check for specific institution first
  for (const { pattern, institution, type } of institutionPatterns) {
    if (pattern.test(q)) {
      return { type, institution };
    }
  }

  // General university patterns (no specific institution)
  const universityPatterns = [
    /\b(university|undergrad|graduate|masters|phd|doctoral)\b/,
    /\b(eng student|engineering student|law student|med student)\b/,
    /\b(campus|dorm|residence|tuition|prof|professor)\b/,
  ];

  // General college patterns
  const collegePatterns = [
    /\b(college|polytechnic|technical school|trade school)\b/,
  ];

  // General student patterns
  const studentPatterns = [
    /\b(student|studying|enrolled|semester|exams|finals)\b/,
  ];

  if (universityPatterns.some(p => p.test(q))) return { type: 'university', institution: null };
  if (collegePatterns.some(p => p.test(q))) return { type: 'college', institution: null };
  if (studentPatterns.some(p => p.test(q))) return { type: 'university', institution: null };

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
 * Detect language preference from query text
 * Returns language code or null
 */
function detectLanguagePreference(query: string): string | null {
  const langPatterns = SEARCH_CONFIG.languagePatterns;

  for (const [lang, pattern] of Object.entries(langPatterns)) {
    if (pattern.test(query)) {
      return lang;
    }
  }
  return null;
}

/**
 * Detect family/loved one context - searching on behalf of someone else
 * Returns type of relationship or null
 */
function detectFamilyContext(query: string): 'immediate' | 'extended' | 'concerned' | null {
  const q = query.toLowerCase();
  const patterns = SEARCH_CONFIG.familyContextPatterns;

  // Check immediate family first (highest priority)
  if (patterns.immediateFamily.some(p => p.test(q))) {
    return 'immediate';
  }

  // Check extended family/loved ones
  if (patterns.extendedFamily.some(p => p.test(q))) {
    return 'extended';
  }

  // Check concerned person patterns
  if (patterns.concernedPerson.some(p => p.test(q))) {
    return 'concerned';
  }

  return null;
}

/**
 * Detect exclusion signals - things the user wants to avoid
 * Returns array of exclusion types
 */
function detectExclusions(query: string): string[] {
  const exclusions: string[] = [];
  const patterns = SEARCH_CONFIG.exclusionPatterns;

  if (patterns.secular.test(query)) exclusions.push('religious');
  if (patterns.non12Step.test(query)) exclusions.push('12step');
  if (patterns.notMenOnly.test(query)) exclusions.push('men_only');
  if (patterns.notWomenOnly.test(query)) exclusions.push('women_only');
  if (patterns.freeOnly.test(query)) exclusions.push('paid');
  if (patterns.noWaitlist.test(query)) exclusions.push('waitlist');

  return exclusions;
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
  const studentContext = detectStudentContext(rawQuery);
  const languagePref = detectLanguagePreference(rawQuery);
  const familyContext = detectFamilyContext(rawQuery);
  const exclusions = detectExclusions(rawQuery);

  // Log detected preferences
  const detections: string[] = [];
  if (genderPref) detections.push(`gender:${genderPref}`);
  if (ageGroup) detections.push(`age:${ageGroup}`);
  if (urgency) detections.push(`urgency:${urgency}`);
  if (familySituations.length > 0) detections.push(`family:${familySituations.join(',')}`);
  if (communityPref) detections.push(`community:${communityPref}`);
  if (studentContext) detections.push(`student:${studentContext.type}${studentContext.institution ? `:${studentContext.institution}` : ''}`);
  if (languagePref) detections.push(`language:${languagePref}`);
  if (familyContext) detections.push(`familyContext:${familyContext}`);
  if (exclusions.length > 0) detections.push(`exclusions:${exclusions.join(',')}`);
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

    // Student/University boosting - LARGE boost to prioritize campus resources
    if (studentContext) {
      // Institution-specific patterns for matching services to institutions
      const institutionServicePatterns: Record<string, RegExp> = {
        ucalgary: /\b(ucalgary|u of c|uofc|ucrc|university of calgary|uc wellness|uc counselling)\b/i,
        ualberta: /\b(ualberta|u of a|uofa|university of alberta|ua wellness|ua counselling)\b/i,
        mru: /\b(mount royal|mru)\b/i,
        ulethbridge: /\b(lethbridge|uleth|u of l)\b/i,
        macewan: /\b(macewan)\b/i,
        athabasca: /\b(athabasca)\b/i,
        sait: /\b(sait|southern alberta institute)\b/i,
        nait: /\b(nait|northern alberta institute)\b/i,
        bowvalley: /\b(bow valley)\b/i,
        norquest: /\b(norquest)\b/i,
        olds: /\b(olds college)\b/i,
        reddeer: /\b(red deer)\b/i,
      };

      const isStudentService = /student|university|campus|college|wellness.*centre|counsell?ing.*centre|student.*services/i.test(textLower);
      const isYouthService = /youth|young adult|18-24|18-25|under 25/i.test(textLower);

      // Check if service matches specific institution
      if (studentContext.institution) {
        const institutionPattern = institutionServicePatterns[studentContext.institution];
        if (institutionPattern && institutionPattern.test(textLower)) {
          boost += 100; // VERY large boost for exact institution match
          console.log(`[StudentBoost] "${svc.name.substring(0, 40)}" boosted for ${studentContext.institution} (institution match)`);
        } else if (isStudentService) {
          boost += 30; // Moderate boost for generic student services when specific institution searched
        }
      } else if (isStudentService) {
        boost += 50; // Large boost for student-specific services when no specific institution
        console.log(`[StudentBoost] "${svc.name.substring(0, 40)}" boosted as student service`);
      } else if (isYouthService) {
        boost += 15; // Moderate boost for youth services
      }
    }

    // Language preference boosting
    if (languagePref) {
      // Check if service mentions the language or multilingual support
      const langBoostPatterns: Record<string, RegExp> = {
        spanish: /\b(spanish|español|hispanic|latino|latina)\b/i,
        french: /\b(french|français|francophone|bilingual)\b/i,
        arabic: /\b(arabic|arab|muslim)\b/i,
        mandarin: /\b(mandarin|chinese|cantonese|asian)\b/i,
        punjabi: /\b(punjabi|sikh|south asian)\b/i,
        tagalog: /\b(tagalog|filipino|philippines)\b/i,
        vietnamese: /\b(vietnamese|viet)\b/i,
        ukrainian: /\b(ukrainian|ukrain)\b/i,
        hindi: /\b(hindi|indian|south asian)\b/i,
        urdu: /\b(urdu|pakistan)\b/i,
        korean: /\b(korean)\b/i,
        nonEnglish: /\b(multilingual|interpreter|translation|multiple languages)\b/i,
      };

      const langPattern = langBoostPatterns[languagePref];
      if (langPattern && langPattern.test(textLower)) {
        boost += 25;
        console.log(`[LanguageBoost] "${svc.name.substring(0, 40)}" boosted for ${languagePref}`);
      }
      // Also boost services that mention interpreter or multilingual
      if (/\b(interpreter|multilingual|translation|multiple languages)\b/i.test(textLower)) {
        boost += 15;
      }
    }

    // Family context boosting - boost family support services when searching for loved one
    if (familyContext) {
      const isFamilySupportService = /\b(family support|family services|loved ones|concerned persons|al-?anon|nar-?anon|family counsell?ing|parent support|caregiver|coping)\b/i.test(textLower);
      const isInterventionService = /\b(intervention|family therapy|family program)\b/i.test(textLower);

      if (isFamilySupportService) {
        boost += 20;
        console.log(`[FamilyBoost] "${svc.name.substring(0, 40)}" boosted as family support`);
      }
      if (isInterventionService) {
        boost += 15;
      }
    }

    // Exclusion signal penalties
    if (exclusions.length > 0) {
      for (const exclusion of exclusions) {
        if (exclusion === 'religious' && /\b(church|faith|christian|religious|god|spiritual|prayer|ministry|bible)\b/i.test(textLower)) {
          boost -= 30;
        }
        if (exclusion === '12step' && /\b(12.?step|twelve.?step|anonymous|AA\b|NA\b|higher power)\b/i.test(textLower)) {
          boost -= 25;
        }
        if (exclusion === 'men_only' && /\b(men only|males only|for men\b|men'?s only)\b/i.test(textLower)) {
          boost -= 40;
        }
        if (exclusion === 'women_only' && /\b(women only|females only|for women\b|women'?s only)\b/i.test(textLower)) {
          boost -= 40;
        }
        if (exclusion === 'waitlist' && /\b(waitlist|wait list|waiting list|wait time.*week|wait time.*month)\b/i.test(textLower)) {
          boost -= 15;
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

/**
 * Extract organization name from service name
 * Tries to identify the organization by common patterns
 */
function extractOrganization(serviceName: string): string {
  const name = serviceName.toLowerCase();

  // Common organization patterns in Alberta
  const orgPatterns = [
    { pattern: /\bcmha\b|canadian mental health/i, org: 'cmha' },
    { pattern: /\bywca\b/i, org: 'ywca' },
    { pattern: /\bymca\b/i, org: 'ymca' },
    { pattern: /\bsalvation army\b/i, org: 'salvation_army' },
    { pattern: /\bcalgary.*counselling/i, org: 'calgary_counselling' },
    { pattern: /\bahs\b|alberta health services/i, org: 'ahs' },
    { pattern: /\bcatholic.*services|catholic.*charities/i, org: 'catholic_services' },
    { pattern: /\bunited way\b/i, org: 'united_way' },
    { pattern: /\bdistress centre\b/i, org: 'distress_centre' },
    { pattern: /\bwoods homes\b/i, org: 'woods_homes' },
    { pattern: /\balpha house\b/i, org: 'alpha_house' },
    { pattern: /\bcalgary urban project society\b|cups\b/i, org: 'cups' },
    { pattern: /\bdrop-?in.*centre\b|drop-?in.*shelter/i, org: 'drop_in_centre' },
    { pattern: /\bmustard seed\b/i, org: 'mustard_seed' },
    { pattern: /\binn from the cold\b/i, org: 'inn_from_cold' },
  ];

  for (const { pattern, org } of orgPatterns) {
    if (pattern.test(name)) {
      return org;
    }
  }

  // Fallback: use first 2-3 significant words as org identifier
  const words = name.split(/\s+/).filter(w => w.length > 2 && !['the', 'and', 'for', 'of'].includes(w));
  return words.slice(0, 2).join('_') || 'unknown';
}

/**
 * Detect if user is searching specifically for an organization's services
 * Returns the organization key if detected, null otherwise
 */
function detectOrganizationSearch(query: string): string | null {
  const q = query.toLowerCase();

  // Organization search patterns - when user explicitly wants org's services
  const orgSearchPatterns = [
    { pattern: /\b(ahs|alberta health services?)\b.*\b(program|service|clinic|centre|center)s?\b/i, org: 'ahs' },
    { pattern: /\b(cmha|canadian mental health)\b.*\b(program|service|location)s?\b/i, org: 'cmha' },
    { pattern: /\bywca\b.*\b(program|service|shelter)s?\b/i, org: 'ywca' },
    { pattern: /\bymca\b.*\b(program|service|centre)s?\b/i, org: 'ymca' },
    { pattern: /\bsalvation army\b.*\b(program|service|shelter|location)s?\b/i, org: 'salvation_army' },
    { pattern: /\bwoods homes\b.*\b(program|service)s?\b/i, org: 'woods_homes' },
    { pattern: /\bcups\b.*\b(program|service|clinic)s?\b/i, org: 'cups' },
    { pattern: /\bdistress centre\b.*\b(program|service|line)s?\b/i, org: 'distress_centre' },
    // Also match when org name is the main search term
    { pattern: /^(ahs|alberta health services?)\s*(programs?|services?)?$/i, org: 'ahs' },
    { pattern: /^(cmha|canadian mental health)\s*(programs?|services?)?$/i, org: 'cmha' },
    { pattern: /^ywca\s*(programs?|services?)?$/i, org: 'ywca' },
    { pattern: /^ymca\s*(programs?|services?)?$/i, org: 'ymca' },
    { pattern: /^salvation army\s*(programs?|services?)?$/i, org: 'salvation_army' },
    { pattern: /^woods homes?\s*(programs?|services?)?$/i, org: 'woods_homes' },
    { pattern: /^cups\s*(programs?|services?)?$/i, org: 'cups' },
    { pattern: /^distress centre\s*(programs?|services?)?$/i, org: 'distress_centre' },
  ];

  for (const { pattern, org } of orgSearchPatterns) {
    if (pattern.test(q)) {
      console.log(`[OrgDiversity] Organization search detected: ${org}`);
      return org;
    }
  }

  return null;
}

/**
 * Compute Reciprocal Rank Fusion (RRF) score for hybrid SQL + semantic ranking
 * Higher scores = better ranking. Services appearing in both sources score highest.
 */
function computeRRFScore(sqlRank: number | null, semanticRank: number | null, k: number = 60): number {
  let score = 0;
  if (sqlRank !== null) {
    score += 1 / (k + sqlRank);
  }
  if (semanticRank !== null) {
    score += 1 / (k + semanticRank);
  }
  return score;
}

/**
 * Apply penalty for services containing negative terms user wants to exclude
 * E.g., "shelter not religious" penalizes shelters with "religious" in their text
 */
function applyNegativePenalty(services: LiteService[], negativeTerms: string[]): LiteService[] {
  if (negativeTerms.length === 0) return services;

  const scored = services.map(service => {
    let penalty = 0;
    const searchText = `${service.name} ${service.description} ${service.category}`.toLowerCase();

    for (const term of negativeTerms) {
      if (searchText.includes(term)) {
        penalty += 100; // Heavy penalty for containing excluded term
        console.log(`[NegativeKeyword] Penalizing "${service.name}" (-100) for containing "${term}"`);
      }
    }

    return { service, penalty };
  });

  // Sort by penalty (lower is better), maintaining original order for equal penalties
  scored.sort((a, b) => a.penalty - b.penalty);

  return scored.map(s => s.service);
}

/**
 * Apply organization diversity - prevent too many results from same org in top results
 * Limits to max 2 services per organization in the top 10 results
 * EXCEPTION: If user is searching for a specific organization, don't limit that org
 */
function applyOrganizationDiversity(services: LiteService[], rawQuery: string, maxPerOrg: number = 2, topN: number = 10): LiteService[] {
  if (services.length <= topN) {
    return services; // No need to diversify small result sets
  }

  // Check if user is searching for a specific organization
  const targetOrg = detectOrganizationSearch(rawQuery);

  const topResults = services.slice(0, topN);
  const rest = services.slice(topN);

  // Count organizations in top results
  const orgCounts = new Map<string, number>();
  const diversified: LiteService[] = [];
  const demoted: LiteService[] = [];

  for (const svc of topResults) {
    const org = extractOrganization(svc.name);
    const currentCount = orgCounts.get(org) || 0;

    // Skip diversity limiting if this is the target organization user searched for
    if (org === targetOrg || currentCount < maxPerOrg) {
      diversified.push(svc);
      orgCounts.set(org, currentCount + 1);
    } else {
      demoted.push(svc);
    }
  }

  // Log if any services were demoted for diversity
  if (demoted.length > 0) {
    console.log(`[OrgDiversity] Demoted ${demoted.length} services for organization diversity`);
  }

  // Return diversified top + demoted + rest
  return [...diversified, ...demoted, ...rest];
}

export class ComprehensiveSearchStrategy extends BaseSearchStrategy {
  readonly name = 'comprehensive';

  async search(analysis: QueryAnalysis, input: SearchInput): Promise<SearchResult> {
    const config = SEARCH_CONFIG.search;
    const startTime = Date.now();

    // Check if this is a domain-specific intent that needs OpenAI query enhancement
    const isDomainIntent = ['domestic_violence', 'food_insecurity', 'housing_urgent', 'substance_abuse', 'mental_health'].includes(analysis.intent);

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
            description: this.truncateDescription(aliasResult.service.description),
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
          description: this.truncateDescription(merged.description),
          location: merged.location,
          waitTimes: merged.waitTimes,
        };
      });

      // Apply minimal boosting and return early
      const boosted = boostByIntent(services, analysis.intent, analysis.raw, analysis);
      const final = analysis.negativeTerms?.length
        ? applyNegativePenalty(boosted, analysis.negativeTerms)
        : boosted;

      return {
        services: applyOrganizationDiversity(final, analysis.raw),
        summary: this.buildSummary(final.length, analysis.raw, analysis.location.specified),
        searchType: enrichments.size > 0 ? 'sql+enrichment' : 'sql',
        totalResults: final.length,
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
      const domainFallbackTerms: Record<string, string> = {
        'substance_abuse': 'addiction treatment recovery support',
        'mental_health': 'mental health counselling therapy support',
        'housing_urgent': 'shelter housing emergency homeless',
        'food_insecurity': 'food bank meals groceries',
        'domestic_violence': 'domestic violence shelter women safety',
      };

      const fallbackTerms = domainFallbackTerms[analysis.intent];
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

    // Apply negative keyword penalty (e.g., "shelter not religious")
    if (analysis.negativeTerms && analysis.negativeTerms.length > 0) {
      services = applyNegativePenalty(services, analysis.negativeTerms);
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
    // Use "fill gaps only" logic: service data wins, AI only fills empty fields
    const sqlServices: LiteService[] = sqlResults.map(sr => {
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
        description: this.truncateDescription(merged.description),
        location: merged.location,
        waitTimes: merged.waitTimes,
      };
    });

    // Convert semantic results to lite services
    // Use "fill gaps only" logic: service data wins, AI only fills empty fields
    const semanticServices: LiteService[] = semanticResults.map(sr => {
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
        description: this.truncateDescription(merged.description),
        location: merged.location,
        waitTimes: merged.waitTimes,
      };
    });

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

    // ============= RRF HYBRID SCORING =============
    // Instead of SQL-first merge, use Reciprocal Rank Fusion to combine rankings
    // Services appearing in both SQL AND semantic results rank highest

    // Build rank maps (1-indexed)
    const sqlRanks = new Map<string, number>();
    sqlServices.forEach((s, i) => sqlRanks.set(s.id, i + 1));

    const semanticRanks = new Map<string, number>();
    sortedSemantic.forEach((s, i) => semanticRanks.set(s.id, i + 1));

    // Build service lookup map
    const serviceMap = new Map<string, LiteService>();
    for (const s of sqlServices) serviceMap.set(s.id, s);
    for (const s of sortedSemantic) {
      if (!serviceMap.has(s.id)) serviceMap.set(s.id, s);
    }

    // Compute RRF scores for all services
    const scored: Array<{ id: string; rrfScore: number; inBoth: boolean }> = [];
    const mergedServiceIds = Array.from(serviceMap.keys());
    for (const id of mergedServiceIds) {
      const sqlRank = sqlRanks.get(id) || null;
      const semanticRank = semanticRanks.get(id) || null;
      const rrfScore = computeRRFScore(sqlRank, semanticRank);
      scored.push({
        id,
        rrfScore,
        inBoth: sqlRank !== null && semanticRank !== null,
      });
    }

    // Sort by RRF score (higher is better)
    scored.sort((a, b) => b.rrfScore - a.rrfScore);

    // Log RRF ranking info
    const inBothCount = scored.filter(s => s.inBoth).length;
    if (inBothCount > 0) {
      console.log(`[RRF] ${inBothCount} services in both SQL+semantic. Top 3 scores: ${scored.slice(0, 3).map(s => s.rrfScore.toFixed(4)).join(', ')}`);
    }

    // Build final sorted list
    const combined: LiteService[] = scored.map(s => serviceMap.get(s.id)!);

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
}
