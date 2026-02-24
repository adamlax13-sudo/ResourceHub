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
  'disability_support': {
    serviceTypes: ['disability_services', 'support_groups', 'community_programs'],
    categoryPatterns: /autis|autism|ASD|asperger|disability|disabled|neurodivergent|neurodiverse|ADHD|ADD|developmental|sensory|AISH|PDD|accessibility|social skills|peer support|support group|life skills|independent living/i,
  },
  'grief_support': {
    serviceTypes: ['grief_support', 'bereavement', 'loss_support'],
    categoryPatterns: /grief|bereavement|loss|mourning|funeral|memorial|hospice|palliative|widow|death|dying|end.of.life/i,
  },
  'senior_services': {
    serviceTypes: ['senior_services', 'aging', 'elder_care'],
    categoryPatterns: /senior|elderly|aging|aged|older adult|65\+|retirement|dementia|alzheimer|home care|meals on wheels|geriatric/i,
  },
  'legal_aid': {
    serviceTypes: ['legal_aid', 'legal_services'],
    categoryPatterns: /legal|lawyer|attorney|court|custody|divorce|immigration|family law|tenant|housing rights|pro bono/i,
  },
  'employment_support': {
    serviceTypes: ['employment', 'job_training', 'career'],
    categoryPatterns: /employment|job|career|training|workforce|resume|interview|EI|apprentice|skills training/i,
  },
  'youth_services': {
    serviceTypes: ['youth_services', 'teen_support'],
    categoryPatterns: /youth|teen|adolescent|young adult|under 25|kids help|student|runaway/i,
  },
  'newcomer_services': {
    serviceTypes: ['newcomer', 'settlement', 'immigration'],
    categoryPatterns: /immigrant|refugee|newcomer|settlement|ESL|language|citizenship|sponsorship|asylum/i,
  },
  'family_addiction_support': {
    serviceTypes: ['family_support', 'addiction_family'],
    categoryPatterns: /al-?anon|nar-?anon|family.*support|loved one|concerned person|family.*addiction|intervention|codependent/i,
  },
  'financial_support': {
    serviceTypes: ['financial_services', 'debt_counseling'],
    categoryPatterns: /financial|debt|credit|bankruptcy|budget|money management|bills|collections|payday loan/i,
  },
  'caregiver_support': {
    serviceTypes: ['caregiver_support', 'respite'],
    categoryPatterns: /caregiver|respite|family caregiver|caring for|burnout|caregiver support/i,
  },
  'lgbtq_services': {
    serviceTypes: ['lgbtq_services', 'pride'],
    categoryPatterns: /lgbtq|lgbt|queer|trans|transgender|gay|lesbian|bisexual|non-?binary|pride|gender affirming|2slgbtq/i,
  },
  'indigenous_services': {
    serviceTypes: ['indigenous_services', 'first_nations'],
    categoryPatterns: /indigenous|first nations?|métis|metis|inuit|native|aboriginal|treaty|reserve|elder|ceremony|traditional healing/i,
  },
  'student_services': {
    serviceTypes: ['campus_services', 'student_support'],
    categoryPatterns: /campus|university|college|student|u of c|u of a|ucalgary|ualberta|mount royal|mru|sait|nait|macewan/i,
  },
  'parenting_support': {
    serviceTypes: ['parenting', 'baby_resources', 'family_support'],
    categoryPatterns: /pregnant|pregnancy|prenatal|postpartum|baby|infant|newborn|parenting|parent support|childcare|daycare|formula|diapers/i,
  },
  'veteran_services': {
    serviceTypes: ['veteran_services', 'military_support', 'trauma_services'],
    categoryPatterns: /veteran|military|armed forces|canadian forces|CAF|CFB|PTSD|post-?traumatic|trauma|operational stress|combat|deployment|VAC|veterans affairs|OSISS|legion|royal canadian legion/i,
  },
};

/**
 * Detect what substance a service specializes in based on its name/description/category
 * Returns 'general' for services that handle all addictions (residential treatment, etc.)
 */
function detectServiceSubstanceType(name: string, description: string, category: string): SubstanceType {
  const text = `${name} ${description} ${category}`.toLowerCase();
  const indicators = SEARCH_CONFIG.serviceSubstanceIndicators;

  // EXCLUDE family support services from alcohol matching
  // These help family members of people with addiction, NOT the person seeking help:
  // - Al-Anon: Support for families/friends of alcoholics
  // - Adult Children of Alcoholics: Support for people whose parents had alcohol problems
  // - FASD services: Support for Fetal Alcohol Spectrum Disorder
  const isFamilySupportService = /\b(al-?anon|adult\s*children\s*of\s*alcoholic|fetal\s*alcohol|fasd\b|family\s*groups?\b.*alcohol)/i.test(text);

  // Check specific substances first (more specific = higher priority)
  // Skip alcohol match if this is a family support service
  if (!isFamilySupportService && indicators.alcohol.test(text)) return 'alcohol';
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

    // Location-only boosting: prioritize general information services
    if (intent === 'location_only') {
      // Strong boost for general information and referral services
      if (/\b(211|information|referral|directory|helpline|help line|community services)\b/i.test(textLower)) {
        boost += 200;
        console.log(`[LocationBoost] "${svc.name.substring(0, 40)}" +200 for general information service`);
      }
      // Moderate boost for multi-service agencies and broad access points
      if (/\b(family|community|social services|resource|multi-?service|community centre|community center)\b/i.test(textLower)) {
        boost += 50;
      }
      // Slight penalty for very specialized services (e.g., specific legal programs, specific treatment)
      if (/\b(notary|immigration.*legal|residential treatment|detox|specific program)\b/i.test(textLower)) {
        boost -= 30;
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

    // Disability/Autism boosting - detect autism/disability in query and boost relevant services
    // Boost values must be LARGE (100+) to overcome SQL base scores of 100-150
    const queryLower = (analysis?.raw || rawQuery || '').toLowerCase();
    const isDisabilityQuery = /\b(autis|autism|autistic|ASD|asperger|ADHD|ADD|disability|disabled|neurodivergent|neurodiverse|on the spectrum|sensory|developmental|AISH|PDD)\b/i.test(queryLower);
    const isADHDQuery = /\b(ADHD|ADD|attention deficit|hyperactiv|executive function)\b/i.test(queryLower);
    const hasSocialIsolation = /\b(friend|friends|friendship|lonely|isolated|social|connect|relationship|alone)\b/i.test(queryLower);

    if (isDisabilityQuery) {
      // VERY strong boost for autism-specific services (must beat SQL scores of 100-150)
      if (/\b(autis|autism|autistic|ASD|asperger|on the spectrum)\b/i.test(textLower)) {
        boost += 150;
        console.log(`[DisabilityBoost] "${svc.name.substring(0, 40)}" +150 for autism match`);
      }
      // Strong boost for disability services
      if (/\b(disability|disabled|AISH|PDD|developmental|persons with disabilities|accessibility|accommodations?)\b/i.test(textLower)) {
        boost += 120;
        console.log(`[DisabilityBoost] "${svc.name.substring(0, 40)}" +120 for disability services`);
      }
      // Good boost for neurodivergent/ADHD services
      if (/\b(neurodivergent|neurodiverse|ADHD|ADD|attention deficit|sensory processing|learning disability|executive function)\b/i.test(textLower)) {
        boost += 100;
        console.log(`[DisabilityBoost] "${svc.name.substring(0, 40)}" +100 for neurodivergent match`);
      }
      // Extra boost for social support when query mentions social isolation + disability
      // This is key for "im autistic and cant find friends" type queries
      if (hasSocialIsolation && /\b(social skills|social support|support group|peer support|life skills|community|friends|friendship|social program)\b/i.test(textLower)) {
        boost += 80;
        console.log(`[DisabilityBoost] "${svc.name.substring(0, 40)}" +80 for social support (disability + isolation query)`);
      }
      // Moderate boost for general support groups
      if (/\b(support group|peer support|community program|drop-in|meetup)\b/i.test(textLower)) {
        boost += 40;
      }
      // Penalty for generic mental health services when disability services should be prioritized
      // Only apply penalty if NO disability-specific boost was applied
      if (boost === 0 && /\b(mental health|counselling|therapy|psycholog)\b/i.test(textLower)) {
        boost -= 30; // Stronger penalty to deprioritize generic mental health
        console.log(`[DisabilityBoost] "${svc.name.substring(0, 40)}" -30 for generic mental health (disability query)`);
      }
    }

    // ADHD-specific boosting (additional to disability boosting)
    if (isADHDQuery) {
      // Boost services that offer ADHD assessment, coaching, or support
      if (/\b(ADHD|ADD|attention deficit|hyperactivity|executive function)\b/i.test(textLower)) {
        boost += 200;
        console.log(`[ADHDBoost] "${svc.name.substring(0, 40)}" +200 for ADHD-specific`);
      }
      // Boost psychological assessment services (needed for ADHD diagnosis)
      if (/\b(psychological.*assessment|psych.*assessment|neuropsych|cognitive assessment|diagnostic)\b/i.test(textLower)) {
        boost += 150;
        console.log(`[ADHDBoost] "${svc.name.substring(0, 40)}" +150 for assessment services`);
      }
      // Boost coaching and skills-based support
      if (/\b(coaching|life skills|executive.*coaching|organization|time management)\b/i.test(textLower)) {
        boost += 100;
        console.log(`[ADHDBoost] "${svc.name.substring(0, 40)}" +100 for coaching/skills`);
      }
      // Boost psychiatry (medication management)
      if (/\b(psychiatr|psychiatric|medication|prescription)\b/i.test(textLower)) {
        boost += 80;
        console.log(`[ADHDBoost] "${svc.name.substring(0, 40)}" +80 for psychiatry`);
      }
      // Penalty for services clearly not ADHD-related
      if (/\b(eating disorder|substance|addiction|domestic violence|shelter)\b/i.test(textLower)) {
        if (!/\b(ADHD|ADD|attention|neurodivergent)\b/i.test(textLower)) {
          boost -= 100;
          console.log(`[ADHDBoost] "${svc.name.substring(0, 40)}" -100 penalty (not ADHD related)`);
        }
      }
    }

    // Crisis query detection - must be checked BEFORE grief to avoid misclassification
    const isCrisisQuery = intent === 'crisis' || /\b(kill myself|suicide|want to die|end it all|don'?t want to (live|be here)|nobody.*miss me|no one.*care|burden|hopeless|give up|can'?t go on|not worth living|better off dead|cut myself|self-?harm)\b/i.test(queryLower);
    if (isCrisisQuery) {
      // MASSIVE boost for crisis/suicide helplines
      if (/\b(988|crisis|suicide|helpline|hotline|distress|prevention)\b/i.test(textLower)) {
        boost += 500;
        console.log(`[CrisisBoost] "${svc.name.substring(0, 40)}" +500 for crisis services`);
      }
      // HIGH boost for services in Crisis category
      if (/\bcris(is|es)\b/i.test(svc.category || '')) {
        boost += 400;
        console.log(`[CrisisBoost] "${svc.name.substring(0, 40)}" +400 for Crisis category`);
      }
      // High boost for mental health crisis services
      if (/\b(crisis.*line|crisis.*team|crisis.*support|mental.*crisis|immediate.*help|24.?7|24.*hour)\b/i.test(textLower)) {
        boost += 300;
        console.log(`[CrisisBoost] "${svc.name.substring(0, 40)}" +300 for crisis support`);
      }
      // Moderate boost for mental health services that can help in crisis
      if (/\b(counsell?ing|mental health|therapy|psycholog)\b/i.test(textLower) && !/\b(grief|bereavement|loss|mourning)\b/i.test(textLower)) {
        boost += 100;
      }
      // HEAVY penalty for grief/bereavement services in crisis queries - WRONG type of help
      if (/\b(grief|bereavement|loss|mourning|hospice|palliative|funeral|memorial|widows?|survivors of loss)\b/i.test(textLower) &&
          !/\b(crisis|suicide|helpline|hotline|distress)\b/i.test(textLower)) {
        boost -= 350;
        console.log(`[CrisisBoost] "${svc.name.substring(0, 40)}" -350 penalty for grief service (crisis query)`);
      }
      // Penalty for addiction treatment (not crisis intervention)
      if (/\b(detox|rehab|residential treatment|recovery house)\b/i.test(textLower)) {
        boost -= 200;
        console.log(`[CrisisBoost] "${svc.name.substring(0, 40)}" -200 penalty for addiction treatment (crisis query)`);
      }
      // Penalty for gambling services (not relevant to mental health crisis)
      if (/\b(gambling|casino|lottery|gaming|wagering)\b/i.test(textLower)) {
        boost -= 300;
        console.log(`[CrisisBoost] "${svc.name.substring(0, 40)}" -300 penalty for gambling service (crisis query)`);
      }
      // Penalty for day programs/hospitals (not immediate crisis help)
      if (/\b(day hospital|day program|outpatient program)\b/i.test(textLower) && !/\bcris(is|es)\b/i.test(textLower)) {
        boost -= 150;
        console.log(`[CrisisBoost] "${svc.name.substring(0, 40)}" -150 penalty for day program (crisis query)`);
      }
    }

    // Grief support boosting (only if NOT a crisis query)
    const isGriefQuery = !isCrisisQuery && /\b(grief|loss|died|passed away|mourning|bereavement|death of|widow|murdered|killed|homicide|suicide loss|overdose death|miscarriage|stillbirth|stillborn|infant loss|pregnancy loss|SIDS|pet died|dog died|cat died|put to sleep|drowned|accident|terminal|cancer|my dog|my cat|my pet)\b/i.test(queryLower);
    const isPetLossQuery = /\b(pet|dog|cat|animal).*(died|loss|passed|death|put to sleep|euthanized|put down)\b/i.test(queryLower) || /\b(died|lost|passed).*(pet|dog|cat|animal)\b/i.test(queryLower);
    const isMiscarriageQuery = /\b(miscarriage|stillbirth|stillborn|pregnancy loss|infant loss|SIDS|baby loss|lost the baby|baby died)\b/i.test(queryLower);
    const isViolentLossQuery = /\b(murder|murdered|killed|homicide|violent|suicide|overdose|accident|shooting|stabbing)\b/i.test(queryLower);
    if (isGriefQuery) {
      // General grief/bereavement services
      if (/\b(grief|bereavement|loss|mourning|hospice|palliative|widow|memorial|funeral|survivors?|violent loss)\b/i.test(textLower)) {
        boost += 150;
        console.log(`[GriefBoost] "${svc.name.substring(0, 40)}" +150 for grief support`);
      }
      // Pregnancy/infant loss specific - extra high boost
      if (isMiscarriageQuery) {
        if (/\b(miscarriage|stillbirth|pregnancy loss|infant loss|perinatal|SIDS|baby loss|perinatal)\b/i.test(textLower)) {
          boost += 250;
          console.log(`[GriefBoost] "${svc.name.substring(0, 40)}" +250 for pregnancy/infant loss match`);
        }
        // Also boost services that mention pregnancy-related support
        if (/\b(pregnancy|prenatal|postpartum|maternal|maternity)\b/i.test(textLower) && /\b(loss|grief|bereavement|support)\b/i.test(textLower)) {
          boost += 150;
          console.log(`[GriefBoost] "${svc.name.substring(0, 40)}" +150 for pregnancy loss support`);
        }
      }
      // Pet loss specific - higher boost
      if (isPetLossQuery) {
        if (/\b(pet loss|pet bereavement|pet grief|animal loss|companion animal)\b/i.test(textLower)) {
          boost += 250;
          console.log(`[GriefBoost] "${svc.name.substring(0, 40)}" +250 for pet loss match`);
        }
        // Also boost general grief services that might help
        if (/\b(grief|bereavement|loss support|counsell?ing)\b/i.test(textLower)) {
          boost += 100;
        }
        // Penalty for crisis/shelter services in pet loss queries
        if (/\b(crisis line|shelter|housing|emergency|domestic violence)\b/i.test(textLower)) {
          boost -= 100;
        }
      }
      // Violent loss specific
      if (isViolentLossQuery && /\b(violent loss|homicide|survivors|trauma|violent crime|victim)\b/i.test(textLower)) {
        boost += 150;
        console.log(`[GriefBoost] "${svc.name.substring(0, 40)}" +150 for violent loss support`);
      }
      if (/\b(support group|peer support|counsell?ing)\b/i.test(textLower)) {
        boost += 60;
      }
      // Penalty for generic mental health when grief-specific exists
      if (boost === 0 && /\b(mental health|counselling|therapy)\b/i.test(textLower)) {
        boost -= 20;
      }
    }

    // Postpartum depression boosting
    const isPostpartumQuery = /\b(postpartum|post-?partum|PPD|perinatal|baby blues|new mom|after giving birth|after having a baby)\b/i.test(queryLower);
    if (isPostpartumQuery) {
      // Very high boost for postpartum-specific services
      if (/\b(postpartum|post-?partum|PPD|perinatal|maternal|baby blues)\b/i.test(textLower)) {
        boost += 250;
        console.log(`[PostpartumBoost] "${svc.name.substring(0, 40)}" +250 for postpartum-specific`);
      }
      // High boost for women's mental health services
      if (/\b(women'?s.*mental|maternal.*mental|women'?s.*health|perinatal.*program)\b/i.test(textLower)) {
        boost += 200;
        console.log(`[PostpartumBoost] "${svc.name.substring(0, 40)}" +200 for women's mental health`);
      }
      // Good boost for services mentioning pregnancy/birth + mental health
      if (/\b(pregnancy|pregnant|birth|baby|newborn|infant|new mom|new mother)\b/i.test(textLower) && /\b(depression|anxiety|mental|counsell?ing|support)\b/i.test(textLower)) {
        boost += 150;
        console.log(`[PostpartumBoost] "${svc.name.substring(0, 40)}" +150 for pregnancy + mental health`);
      }
      // Moderate boost for general mental health that might help
      if (/\b(mental health|counsell?ing|therapy|depression|anxiety)\b/i.test(textLower)) {
        boost += 80;
      }
      // Penalty for services clearly not related (addiction, shelter, etc.)
      if (/\b(addiction|substance|alcohol|drug|shelter|homeless|detox|residential treatment)\b/i.test(textLower)) {
        if (!/\b(postpartum|perinatal|women'?s|maternal|pregnancy)\b/i.test(textLower)) {
          boost -= 150;
          console.log(`[PostpartumBoost] "${svc.name.substring(0, 40)}" -150 penalty (not postpartum related)`);
        }
      }
    }

    // Senior services boosting
    const isSeniorQuery = /\b(senior|elderly|aging|aged|65\+|70\+|old parent|dementia|alzheimer|geriatric)\b/i.test(queryLower);
    if (isSeniorQuery) {
      if (/\b(senior|elderly|aging|older adult|65\+|retirement|dementia|alzheimer|home care|geriatric)\b/i.test(textLower)) {
        boost += 120;
        console.log(`[SeniorBoost] "${svc.name.substring(0, 40)}" +120 for senior services`);
      }
      if (/\b(meals on wheels|senior center|senior centre|elder|assisted living)\b/i.test(textLower)) {
        boost += 80;
      }
      // Penalty for youth-only services
      if (/\b(youth only|under 25|teen only|kids only|children only)\b/i.test(textLower)) {
        boost -= 50;
      }
    }

    // Legal aid boosting
    const isLegalQuery = /\b(lawyer|legal|court|custody|divorce|immigration|tenant rights|charges)\b/i.test(queryLower);
    const isTenantEvictionQuery = /\b(tenant|eviction|evicted|getting evicted|being evicted|landlord|renter|rental|lease|rtdrs)\b/i.test(queryLower);
    const isUrgentEvictionQuery = isTenantEvictionQuery && /\b(tomorrow|tonight|today|urgent|emergency|need help|about to|going to be)\b/i.test(queryLower);
    if (isLegalQuery || isTenantEvictionQuery) {
      // VERY high boost for tenant/housing legal services in eviction queries
      if (isTenantEvictionQuery) {
        if (/\b(tenant|eviction|landlord|renter|rental|housing.*rights|residential tenancies|rtdrs|lease)\b/i.test(textLower)) {
          boost += 300;
          console.log(`[TenantLegalBoost] "${svc.name.substring(0, 40)}" +300 for tenant/eviction legal`);
        }
        // High boost for legal aid services that can help with housing
        if (/\b(legal aid|pro bono|free legal|legal clinic|student legal|community legal)\b/i.test(textLower)) {
          boost += 300;
          console.log(`[TenantLegalBoost] "${svc.name.substring(0, 40)}" +300 for legal aid (eviction query)`);
        }
        // Boost for housing-related legal services
        if (/\b(housing|landlord.*tenant|residential|civil law|housing connect)\b/i.test(textLower)) {
          boost += 200;
          console.log(`[TenantLegalBoost] "${svc.name.substring(0, 40)}" +200 for housing legal`);
        }
        // For urgent eviction, boost crisis/emergency tenant support even more
        if (isUrgentEvictionQuery) {
          if (/\b(emergency.*legal|urgent.*legal|immediate|same.*day)\b/i.test(textLower)) {
            boost += 200;
            console.log(`[TenantLegalBoost] "${svc.name.substring(0, 40)}" +200 for urgent eviction legal`);
          }
        }
        // Heavy penalty for emergency shelters in tenant rights query (different need)
        if (/\b(emergency shelter|homeless shelter|beds.*available|overnight|sleep)\b/i.test(textLower) &&
            !/\b(legal|rights|tenant|eviction)\b/i.test(textLower)) {
          boost -= 250;
          console.log(`[TenantLegalBoost] "${svc.name.substring(0, 40)}" -250 penalty for shelter (tenant rights query)`);
        }
      }
      if (/\b(legal aid|pro bono|free legal|low cost legal|lawyer referral)\b/i.test(textLower)) {
        boost += 150;
        console.log(`[LegalBoost] "${svc.name.substring(0, 40)}" +150 for legal aid`);
      }
      if (/\b(lawyer|attorney|law.*society|legal.*services|court)\b/i.test(textLower)) {
        boost += 80;
      }
    }

    // Penalize legal services in non-legal queries (e.g., mental health counselling queries)
    const isCounsellingQuery = /\b(counsell?ing|therapy|therap|mental health|depression|anxiety|support group)\b/i.test(queryLower);
    if (isCounsellingQuery && !isLegalQuery) {
      if (/\b(legal aid|pro bono|lawyer|law society|court|legal services)\b/i.test(textLower)) {
        boost -= 200;
        console.log(`[LegalPenalty] "${svc.name.substring(0, 40)}" -200 for legal service in counselling query`);
      }
    }

    // Employment support boosting
    const isEmploymentQuery = /\b(job|employment|career|unemployed|laid off|fired|work|EI|resume)\b/i.test(queryLower);
    if (isEmploymentQuery) {
      if (/\b(employment|job.*training|career|workforce|resume|interview|employment services)\b/i.test(textLower)) {
        boost += 120;
        console.log(`[EmploymentBoost] "${svc.name.substring(0, 40)}" +120 for employment support`);
      }
      if (/\b(apprentice|skills training|job search|employment insurance|EI)\b/i.test(textLower)) {
        boost += 60;
      }
    }

    // Youth services boosting
    const isYouthQuery = /\b(teen|teenager|adolescent|youth|young adult|my kid|my child|under 18|runaway)\b/i.test(queryLower);
    const isYouthShelterQuery = isYouthQuery && /\b(shelter|housing|homeless|place to stay|sleep)\b/i.test(queryLower);
    if (isYouthQuery) {
      // Extra boost for youth shelter-specific services when query mentions shelter
      if (isYouthShelterQuery && /\b(youth.*shelter|youth.*housing|teen.*shelter|runaway.*shelter|emergency.*shelter|shelter)\b/i.test(textLower)) {
        boost += 200;
        console.log(`[YouthBoost] "${svc.name.substring(0, 40)}" +200 for youth shelter`);
      }
      if (/\b(youth|teen|adolescent|young adult|under 25|kids help phone|runaway)\b/i.test(textLower)) {
        boost += 100;
        console.log(`[YouthBoost] "${svc.name.substring(0, 40)}" +100 for youth services`);
      }
      // Penalty for senior-only services
      if (/\b(senior only|65\+|elderly only|seniors only)\b/i.test(textLower)) {
        boost -= 50;
      }
      // For youth shelter queries, penalize non-shelter services
      if (isYouthShelterQuery && !/\b(shelter|housing|residential|emergency)\b/i.test(textLower)) {
        boost -= 80;
      }
    }

    // Newcomer services boosting
    const isNewcomerQuery = /\b(newcomer|immigrant|refugee|new to canada|settlement|ESL|asylum|citizenship)\b/i.test(queryLower);
    if (isNewcomerQuery) {
      if (/\b(immigrant|refugee|newcomer|settlement|ESL|language|citizenship|sponsorship)\b/i.test(textLower)) {
        boost += 120;
        console.log(`[NewcomerBoost] "${svc.name.substring(0, 40)}" +120 for newcomer services`);
      }
      if (/\b(work permit|visa|immigration|asylum|refugee services)\b/i.test(textLower)) {
        boost += 80;
      }
    }

    // Family addiction support boosting (Al-Anon, Nar-Anon)
    // Detects: "my husband is an alcoholic", "living with an addict", "al-anon"
    const isFamilyAddictionQuery =
      /\b(my|our).*(spouse|husband|wife|partner|parent|child|son|daughter|family|loved one).*(addict|alcohol|drug|drinking|using)\b/i.test(queryLower) ||
      /\b(al-?anon|nar-?anon)\b/i.test(queryLower) ||
      /\bliving with.*(addict|alcoholic|someone who|substance)\b/i.test(queryLower) ||
      /\b(loved one|family member|someone i (know|love|care)).*(addict|alcohol|drug)\b/i.test(queryLower) ||
      /\b(living with an addict|spouse.*addict|partner.*addict)\b/i.test(queryLower);
    if (isFamilyAddictionQuery) {
      // MASSIVE boost for Al-Anon/Nar-Anon by name - these are THE services for families
      if (/\b(al-?anon|nar-?anon)\b/i.test(textLower)) {
        boost += 600;
        console.log(`[FamilyAddictionBoost] "${svc.name.substring(0, 40)}" +600 for Al-Anon/Nar-Anon`);
      }
      // Very high boost for family support programs
      if (/\b(family.*support|loved one.*support|concerned.*persons?|codependent|family.*addiction|support.*famil|family group)\b/i.test(textLower)) {
        boost += 350;
        console.log(`[FamilyAddictionBoost] "${svc.name.substring(0, 40)}" +350 for family addiction support`);
      }
      // Moderate boost for peer support and group meetings
      if (/\b(support group|peer support|meeting|fellowship)\b/i.test(textLower)) {
        boost += 100;
        console.log(`[FamilyAddictionBoost] "${svc.name.substring(0, 40)}" +100 for support group`);
      }
      // VERY heavy penalty for treatment/detox services (wrong target - those are for the addict, not the family)
      if (/\b(detox|rehab|residential treatment|treatment center|inpatient|recovery house|treatment program|withdrawal|outpatient treatment)\b/i.test(textLower)) {
        boost -= 300;
        console.log(`[FamilyAddictionBoost] "${svc.name.substring(0, 40)}" -300 penalty for treatment (wrong target)`);
      }
      // Also penalize harm reduction/clinical services
      if (/\b(opioid|methadone|suboxone|naloxone|harm reduction|safer.*use|needle|syringe)\b/i.test(textLower)) {
        boost -= 250;
        console.log(`[FamilyAddictionBoost] "${svc.name.substring(0, 40)}" -250 penalty for harm reduction (wrong target)`);
      }
    }

    // Financial support boosting
    const isFinancialQuery = /\b(debt|bills?|financial|money|can'?t afford|bankruptcy|collections?|credit)\b/i.test(queryLower);
    const isCreditCounsellingQuery = /\b(credit counsell?ing|credit.*help|debt.*counsel|financial.*counsel)\b/i.test(queryLower);
    if (isFinancialQuery) {
      // Highest boost for explicit financial/credit counselling services
      if (/\b(credit counsell?ing|financial counsell?ing|debt.*counsell?ing|money management|budget.*counsel|debt relief)\b/i.test(textLower)) {
        boost += 200;
        console.log(`[FinancialBoost] "${svc.name.substring(0, 40)}" +200 for credit/financial counselling`);
      }
      if (/\b(financial|debt|bankruptcy|money management|budget|financial literacy)\b/i.test(textLower)) {
        boost += 120;
        console.log(`[FinancialBoost] "${svc.name.substring(0, 40)}" +120 for financial support`);
      }
      if (/\b(payday loan|collections?|bills|utilities assistance)\b/i.test(textLower)) {
        boost += 60;
      }
      // Heavy penalty for mental health counselling in credit/financial queries
      if (isCreditCounsellingQuery && /\b(mental health|psychological|therapy|psycholog|emotion|depression|anxiety)\b/i.test(textLower)) {
        if (!/\b(financial|debt|credit|money|budget)\b/i.test(textLower)) {
          boost -= 200;
          console.log(`[FinancialBoost] "${svc.name.substring(0, 40)}" -200 penalty for mental health in credit query`);
        }
      }
    }

    // Caregiver support boosting
    const isCaregiverQuery = /\b(caregiver|caregiving|caring for|looking after|respite|burnout.*car|exhausted.*car)\b/i.test(queryLower);
    const isCaregiverBurnoutQuery = /\b(caregiver.*burnout|burnout.*caregiver|exhausted.*caregiver|caregiver.*stress|caregiver.*exhaust)\b/i.test(queryLower);
    if (isCaregiverQuery) {
      // High boost for caregiver-specific services
      if (/\b(caregiver|respite|family caregiver|caregiver support|caregiver burnout)\b/i.test(textLower)) {
        boost += 250;
        console.log(`[CaregiverBoost] "${svc.name.substring(0, 40)}" +250 for caregiver support`);
      }
      // Boost for adult day programs (respite for caregivers)
      if (/\b(adult day|day program|respite care|respite service)\b/i.test(textLower)) {
        boost += 200;
        console.log(`[CaregiverBoost] "${svc.name.substring(0, 40)}" +200 for day program/respite`);
      }
      if (/\b(caring for|looking after|support for families|family support)\b/i.test(textLower)) {
        boost += 100;
      }
      // For burnout queries, boost mental health/counselling that mentions caregivers
      if (isCaregiverBurnoutQuery) {
        if (/\b(counsell?ing|therapy|mental health|support group)\b/i.test(textLower) && /\b(caregiver|family|stress)\b/i.test(textLower)) {
          boost += 150;
          console.log(`[CaregiverBoost] "${svc.name.substring(0, 40)}" +150 for caregiver counselling`);
        }
        // Penalty for grief-only services in burnout query (caregivers need support, not bereavement)
        if (/\b(bereavement|grief counsell?ing|loss of|mourning)\b/i.test(textLower) && !/\b(caregiver|respite)\b/i.test(textLower)) {
          boost -= 150;
          console.log(`[CaregiverBoost] "${svc.name.substring(0, 40)}" -150 penalty for grief (burnout query)`);
        }
      }
    }

    // LGBTQ+ services boosting
    const isLgbtqQuery = /\b(lgbtq|lgbt|queer|trans|transgender|gay|lesbian|bisexual|non-?binary|coming out|pride|2slgbtq)\b/i.test(queryLower);
    const isLgbtqSeniorQuery = isLgbtqQuery && /\b(senior|elderly|aging|older|65\+|retirement)\b/i.test(queryLower);
    const isLgbtqHousingQuery = isLgbtqQuery && /\b(housing|shelter|place to stay|home|living)\b/i.test(queryLower);
    if (isLgbtqQuery) {
      if (/\b(lgbtq|lgbt|queer|trans|transgender|gay|lesbian|bisexual|non-?binary|pride|2slgbtq)\b/i.test(textLower)) {
        boost += 150;
        console.log(`[LGBTQBoost] "${svc.name.substring(0, 40)}" +150 for LGBTQ+ services`);
      }
      if (/\b(gender affirming|hormone therapy|coming out|pride center|pride centre)\b/i.test(textLower)) {
        boost += 80;
      }
      // LGBTQ senior-specific boosting
      if (isLgbtqSeniorQuery) {
        // High boost for services that serve both LGBTQ and seniors
        if (/\b(senior|elderly|aging|older adult|65\+)\b/i.test(textLower) && /\b(lgbtq|lgbt|queer|trans|gay|lesbian|pride)\b/i.test(textLower)) {
          boost += 300;
          console.log(`[LGBTQBoost] "${svc.name.substring(0, 40)}" +300 for LGBTQ+ senior services`);
        }
        // Boost senior housing/care that is LGBTQ-affirming or inclusive
        if (/\b(senior|elderly).*\b(housing|living|care)\b/i.test(textLower)) {
          boost += 150;
          console.log(`[LGBTQBoost] "${svc.name.substring(0, 40)}" +150 for senior housing (LGBTQ query)`);
        }
        // Penalty for youth-only LGBTQ services when query is about seniors
        if (/\b(youth only|under 25|teen|young adult)\b/i.test(textLower)) {
          boost -= 200;
          console.log(`[LGBTQBoost] "${svc.name.substring(0, 40)}" -200 penalty for youth-only (senior query)`);
        }
      }
      // LGBTQ housing-specific boosting
      if (isLgbtqHousingQuery) {
        if (/\b(housing|shelter|residence|supportive housing|safe house)\b/i.test(textLower)) {
          boost += 150;
          console.log(`[LGBTQBoost] "${svc.name.substring(0, 40)}" +150 for LGBTQ+ housing`);
        }
      }
    }

    // Veteran/military services boosting
    const isVeteranQuery = /\b(veteran|veterans?|military|armed forces|canadian forces|ex-?military|former military|CAF|CFB|deployed|served|combat)\b/i.test(queryLower);
    const isVeteranPTSDQuery = isVeteranQuery && /\b(PTSD|post-?traumatic|trauma)\b/i.test(queryLower);
    const isHomelessVeteranQuery = isVeteranQuery && /\b(homeless|shelter|housing|nowhere.*stay|no.*home|street)\b/i.test(queryLower);
    if (isVeteranQuery) {
      // MASSIVE boost for veteran-specific services (must dominate results)
      if (/\b(veteran|veterans?|VAC|veterans affairs|OSISS|OSI-CAN|operational stress|legion|royal canadian legion|VETS Canada|wounded warriors)\b/i.test(textLower)) {
        boost += 500;
        console.log(`[VeteranBoost] "${svc.name.substring(0, 40)}" +500 for veteran services`);
      }
      // Strong boost for military-related services
      if (/\b(military|armed forces|canadian forces|CAF|CFB|combat|deployment|service member|first responder)\b/i.test(textLower)) {
        boost += 350;
        console.log(`[VeteranBoost] "${svc.name.substring(0, 40)}" +350 for military services`);
      }
      // Boost for PTSD-specific services when veteran query
      if (/\b(PTSD|post-?traumatic|traumatic stress|combat stress|operational stress)\b/i.test(textLower)) {
        boost += 200;
        console.log(`[VeteranBoost] "${svc.name.substring(0, 40)}" +200 for PTSD services`);
      }
      // Moderate boost for general mental health with peer support (common for veterans)
      if (/\b(peer support|support group)\b/i.test(textLower)) {
        boost += 100;
      }
      // HOMELESS VETERAN handling - need both veteran services AND housing/shelter
      if (isHomelessVeteranQuery) {
        // Very high boost for services that serve homeless veterans specifically
        if (/\b(veteran|military)\b/i.test(textLower) && /\b(housing|shelter|homeless|supportive housing)\b/i.test(textLower)) {
          boost += 400;
          console.log(`[HomelessVeteranBoost] "${svc.name.substring(0, 40)}" +400 for homeless veteran housing`);
        }
        // Good boost for general housing/shelter services (veterans need shelter too)
        if (/\b(emergency shelter|homeless shelter|housing.*first|supportive housing|transitional housing|shelter)\b/i.test(textLower)) {
          boost += 200;
          console.log(`[HomelessVeteranBoost] "${svc.name.substring(0, 40)}" +200 for shelter (homeless veteran query)`);
        }
        // Don't penalize shelters for homeless veteran queries
      } else {
        // Only apply these penalties for non-homeless veteran queries
        // Heavy penalty for sexual violence-specific services (wrong type of trauma for veteran query)
        if (isVeteranPTSDQuery && /\b(sexual assault|sexual violence|rape|sexual abuse|SART|women'?s.*trauma)\b/i.test(textLower)) {
          boost -= 300;
          console.log(`[VeteranBoost] "${svc.name.substring(0, 40)}" -300 penalty for sexual violence (not veteran trauma)`);
        }
        // Heavy penalty for domestic violence services (wrong type of trauma for veteran query)
        if (isVeteranPTSDQuery && /\b(domestic violence|domestic abuse|intimate partner|spousal abuse|abusive relationship|women'?s shelter|battered|family violence)\b/i.test(textLower)) {
          boost -= 250;
          console.log(`[VeteranBoost] "${svc.name.substring(0, 40)}" -250 penalty for domestic violence (not veteran trauma)`);
        }
        // Penalty for women-specific services in veteran query (veterans can be any gender)
        if (isVeteranPTSDQuery && /\b(women'?s|for women|female only|women only)\b/i.test(textLower) &&
            !/\b(veteran|military)\b/i.test(textLower)) {
          boost -= 150;
          console.log(`[VeteranBoost] "${svc.name.substring(0, 40)}" -150 penalty for women-specific (veteran query)`);
        }
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

    // Exclusion signal penalties and alternative boosting
    if (exclusions.length > 0) {
      for (const exclusion of exclusions) {
        if (exclusion === 'religious' && /\b(church|faith|christian|religious|god|spiritual|prayer|ministry|bible)\b/i.test(textLower)) {
          boost -= 30;
        }
        if (exclusion === '12step') {
          // Heavily penalize 12-step programs when user explicitly wants alternatives
          if (/\b(12.?step|twelve.?step|anonymous|AA\b|NA\b|CA\b|alcoholics anonymous|narcotics anonymous|cocaine anonymous|higher power|step.?program)\b/i.test(textLower)) {
            boost -= 200;
            console.log(`[12StepPenalty] "${svc.name.substring(0, 40)}" -200 for 12-step program`);
          }
          // Strongly boost secular alternatives like SMART Recovery
          if (/\b(SMART Recovery|cognitive behavio|evidence.?based|secular|non.?religious|harm reduction|medication.?assisted|MAT\b)\b/i.test(textLower)) {
            boost += 350;
            console.log(`[SecularBoost] "${svc.name.substring(0, 40)}" +350 for secular alternative`);
          }
        }
        if (exclusion === 'men_only' && /\b(men only|males only|for men\b|men'?s only)\b/i.test(textLower)) {
          boost -= 40;
        }
        if (exclusion === 'women_only' && /\b(women only|females only|for women\b|women'?s only)\b/i.test(textLower)) {
          boost -= 40;
        }
        if (exclusion === 'waitlist') {
          // Penalize services that mention waitlists
          if (/\b(waitlist|wait list|waiting list|wait time.*week|wait time.*month)\b/i.test(textLower)) {
            boost -= 15;
          }
          // Boost services with immediate/rapid access
          if (/\b(walk.?in|no wait|immediate|same.?day|rapid access|no appointment|drop.?in|24\/7|open now)\b/i.test(textLower)) {
            boost += 100;
            console.log(`[NoWaitlistBoost] "${svc.name.substring(0, 40)}" +100 for immediate access`);
          }
        }
      }
    }

    // Extra boost for non-12-step recovery queries
    const isNon12StepQuery = /\b(no.*12.*step|not.*12.*step|non.*12.*step|alternative to AA|alternative to NA|no AA|no NA|without.*12.*step)\b/i.test(queryLower);
    if (isNon12StepQuery) {
      // Massive boost for SMART Recovery by name - must dominate results
      if (/SMART/i.test(svc.name) || /\bSMART\b/i.test(textLower)) {
        boost += 800;
        console.log(`[Non12StepBoost] "${svc.name.substring(0, 40)}" +800 for SMART Recovery (exact match)`);
      }
      // Strong boost for evidence-based alternatives
      if (/\b(medication.?assisted|MAT\b|suboxone|methadone|harm reduction|evidence.?based|CBT|cognitive|secular)\b/i.test(textLower)) {
        boost += 400;
        console.log(`[Non12StepBoost] "${svc.name.substring(0, 40)}" +400 for evidence-based treatment`);
      }
      // Penalize youth-specific services when query doesn't mention youth
      const isYouthQuery = /\b(youth|teen|adolescent|young|under 18|minor|child)\b/i.test(queryLower);
      if (!isYouthQuery && /\b(youth|adolescent|teen|young people|children|kids|under 18|minor)\b/i.test(textLower)) {
        boost -= 300;
        console.log(`[Non12StepBoost] "${svc.name.substring(0, 40)}" -300 for youth-specific (not requested)`);
      }
      // Additional penalty for services without clear non-12-step indication
      if (/\b(residential|treatment centre|treatment center|recovery house)\b/i.test(textLower) &&
          !/\b(SMART|secular|evidence.?based|non.?12|MAT|harm reduction)\b/i.test(textLower)) {
        boost -= 100;
        console.log(`[Non12StepBoost] "${svc.name.substring(0, 40)}" -100 for unclear methodology`);
      }
    }

    // Indigenous services boosting
    if (intent === 'indigenous_services') {
      if (/\b(indigenous|first nations?|métis|metis|inuit|native|aboriginal)\b/i.test(textLower)) {
        boost += 120;
        console.log(`[IndigenousBoost] "${svc.name.substring(0, 40)}" boosted as indigenous service`);
      }
      if (/\b(elder|ceremony|smudging|sweat lodge|traditional healing|medicine wheel)\b/i.test(textLower)) {
        boost += 80;
      }
      if (/\b(treaty|reserve|band|status|nihb|jordan'?s principle)\b/i.test(textLower)) {
        boost += 60;
      }
    }

    // Parenting/baby support boosting
    if (intent === 'parenting_support') {
      const isChildcareCostsQuery = /\b(childcare.*cost|daycare.*cost|childcare.*help|daycare.*help|childcare.*afford|childcare.*subsid|daycare.*subsid|afford.*childcare|afford.*daycare)\b/i.test(queryLower);

      if (/\b(pregnant|pregnancy|prenatal|postpartum|baby|infant|newborn|parenting|parent support)\b/i.test(textLower)) {
        boost += 120;
        console.log(`[ParentingBoost] "${svc.name.substring(0, 40)}" boosted as parenting support`);
      }
      if (/\b(formula|diapers|baby supplies|car seat|crib|stroller|breastfeeding|lactation)\b/i.test(textLower)) {
        boost += 80;
      }
      if (/\b(single parent|teen parent|young parent)\b/i.test(textLower)) {
        boost += 60;
      }
      // Childcare/daycare cost assistance
      if (/\b(childcare|daycare|child care)\b/i.test(textLower)) {
        boost += 80;
        console.log(`[ParentingBoost] "${svc.name.substring(0, 40)}" +80 for childcare`);
      }
      // High boost for subsidy/financial assistance related to childcare
      if (/\b(childcare.*subsid|daycare.*subsid|subsid.*childcare|subsid.*daycare|childcare.*assist|daycare.*assist|childcare.*afford|ACCB|child.*benefit)\b/i.test(textLower)) {
        boost += 180;
        console.log(`[ParentingBoost] "${svc.name.substring(0, 40)}" +180 for childcare subsidy/assistance`);
      }
      // If specifically asking about childcare costs, penalize unrelated parenting services
      if (isChildcareCostsQuery) {
        if (/\b(financial|subsidy|benefit|assistance|affordable|low cost|free|help.*pay)\b/i.test(textLower)) {
          boost += 150;
          console.log(`[ParentingBoost] "${svc.name.substring(0, 40)}" +150 for financial childcare help`);
        }
        // Penalty for baby supplies in childcare cost query
        if (/\b(diapers|formula|breastfeeding|car seat|crib)\b/i.test(textLower) && !/\b(childcare|daycare)\b/i.test(textLower)) {
          boost -= 100;
        }
      }
    }

    // Student services boosting (when intent is student_services)
    if (intent === 'student_services') {
      // Detect which university is in the query
      const isUCalgaryQuery = /\b(u of c|uofc|ucalgary|university of calgary)\b/i.test(queryLower);
      const isUAlbertaQuery = /\b(u of a|uofa|ualberta|university of alberta)\b/i.test(queryLower);
      const isMRUQuery = /\b(mount royal|mru)\b/i.test(queryLower);

      // Very high boost for matching university
      if (isUCalgaryQuery && /\b(ucalgary|university of calgary|u of c|calgary)\b/i.test(textLower) && /\b(student|campus|wellness|counsell)/i.test(textLower)) {
        boost += 400;
        console.log(`[StudentIntentBoost] "${svc.name.substring(0, 40)}" +400 for UCalgary-specific service`);
      } else if (isUAlbertaQuery && /\b(ualberta|university of alberta|u of a)\b/i.test(textLower) && /\b(student|campus|wellness|counsell)/i.test(textLower)) {
        boost += 400;
        console.log(`[StudentIntentBoost] "${svc.name.substring(0, 40)}" +400 for UAlberta-specific service`);
      } else if (isMRUQuery && /\b(mount royal|mru)\b/i.test(textLower)) {
        boost += 400;
        console.log(`[StudentIntentBoost] "${svc.name.substring(0, 40)}" +400 for MRU-specific service`);
      }

      // General campus service boost
      if (/\b(campus|university|college|student)\b/i.test(textLower) && /\b(counsell?ing|wellness|mental health|support|services)\b/i.test(textLower)) {
        boost += 200;
        console.log(`[StudentIntentBoost] "${svc.name.substring(0, 40)}" +200 for campus service`);
      }

      // Specific student service patterns
      if (/\b(student.*counsell?ing|student.*wellness|student.*services|campus.*health|campus.*mental)\b/i.test(textLower)) {
        boost += 150;
      }

      // Penalize generic community mental health for university-specific queries
      if ((isUCalgaryQuery || isUAlbertaQuery || isMRUQuery) &&
          !/\b(campus|university|college|student|u of c|u of a|ucalgary|ualberta|mru|mount royal)\b/i.test(textLower)) {
        boost -= 100;
        console.log(`[StudentIntentBoost] "${svc.name.substring(0, 40)}" -100 for non-campus service (university query)`);
      }

      // Penalize services from wrong university (e.g., UAlberta services for UCalgary query)
      if (isUCalgaryQuery && /\b(ualberta|university of alberta|u of a|edmonton)\b/i.test(textLower)) {
        boost -= 200;
        console.log(`[StudentIntentBoost] "${svc.name.substring(0, 40)}" -200 for wrong university (UCalgary query, UAlberta service)`);
      }
      if (isUAlbertaQuery && /\b(ucalgary|university of calgary|u of c)\b/i.test(textLower)) {
        boost -= 200;
        console.log(`[StudentIntentBoost] "${svc.name.substring(0, 40)}" -200 for wrong university (UAlberta query, UCalgary service)`);
      }

      // For general mental health queries, penalize addiction-focused services
      const isGeneralMentalHealthQuery = /\b(mental health|counsell?ing|therapy|depression|anxiety|stress)\b/i.test(queryLower) &&
                                         !/\b(addiction|substance|alcohol|drug|recovery)\b/i.test(queryLower);
      if (isGeneralMentalHealthQuery && /\b(addiction|substance|harm reduction|detox|recovery|alcohol|drug)\b/i.test(textLower)) {
        boost -= 150;
        console.log(`[StudentIntentBoost] "${svc.name.substring(0, 40)}" -150 for addiction focus (general mental health query)`);
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
 * Handles semantic terms like "12_step" → AA, NA, higher power, etc.
 */
function applyNegativePenalty(services: LiteService[], negativeTerms: string[]): LiteService[] {
  if (negativeTerms.length === 0) return services;

  // Map semantic negative terms to patterns that should be penalized
  const semanticPatterns: Record<string, RegExp> = {
    '12_step': /\b(12[\s-]?step|twelve[\s-]?step|AA\b|NA\b|CA\b|alcoholics\s*anonymous|narcotics\s*anonymous|cocaine\s*anonymous|higher\s*power|step\s*program|steps?\s*(?:1|2|3|4|5|6|7|8|9|10|11|12)\b)/i,
    'religious': /\b(religious|faith[\s-]?based|christian|church|ministry|spiritual|god|prayer|bible|jesus|christ|evangelical|catholic|baptist|methodist|lutheran|presbyterian|pentecostal|salvation\s*army|rescue\s*mission|dream\s*centre|dream\s*center|life\s*centre|mission\s*centre|12[\s-]?step|AA\b|NA\b|CA\b|alcoholics\s*anonymous|narcotics\s*anonymous|higher\s*power)\b/i,
    'faith_based': /\b(faith[\s-]?based|religious|spiritual|christian|church|ministry|god|prayer|dream\s*centre|dream\s*center)\b/i,
  };

  // Deduplicate negative terms
  const uniqueTerms = negativeTerms.filter((term, index) => negativeTerms.indexOf(term) === index);

  const scored = services.map(service => {
    let penalty = 0;
    const searchText = `${service.name} ${service.description} ${service.category}`.toLowerCase();

    for (const term of uniqueTerms) {
      // Check if this is a semantic term with expanded patterns
      const pattern = semanticPatterns[term];
      if (pattern) {
        if (pattern.test(searchText)) {
          penalty += 150; // Heavy penalty for semantic match
          console.log(`[NegativeKeyword] Penalizing "${service.name.substring(0, 40)}" (-150) for "${term}" pattern match`);
        }
      } else {
        // Direct term match
        if (searchText.includes(term)) {
          penalty += 100; // Heavy penalty for containing excluded term
          console.log(`[NegativeKeyword] Penalizing "${service.name.substring(0, 40)}" (-100) for containing "${term}"`);
        }
      }
    }

    return { service, penalty };
  });

  // Sort by penalty (lower is better), maintaining original order for equal penalties
  scored.sort((a, b) => a.penalty - b.penalty);

  return scored.map(s => s.service);
}

/**
 * Apply category diversity for location-only queries
 * Ensures top results include a mix of different service categories
 * rather than being dominated by one type (e.g., mental health)
 */
function applyCategoryDiversity(services: LiteService[], maxPerCategory: number = 3, topN: number = 15): LiteService[] {
  if (services.length <= topN) {
    return services;
  }

  const topResults = services.slice(0, Math.min(topN * 2, services.length)); // Look at top 30 to find diversity
  const rest = services.slice(topN * 2);

  // Normalize categories into broader groups
  function normalizeCategory(category: string): string {
    const lower = category.toLowerCase();
    if (/mental|counsell|therapy|depression|anxiety|crisis/i.test(lower)) return 'mental_health';
    if (/addiction|substance|alcohol|drug|recovery|detox/i.test(lower)) return 'addiction';
    if (/shelter|housing|homeless/i.test(lower)) return 'housing';
    if (/food|meal|hungry|pantry|bank/i.test(lower)) return 'food';
    if (/legal|lawyer|court/i.test(lower)) return 'legal';
    if (/employment|job|career/i.test(lower)) return 'employment';
    if (/senior|elderly|aging/i.test(lower)) return 'seniors';
    if (/youth|teen|child/i.test(lower)) return 'youth';
    if (/immigrant|refugee|newcomer/i.test(lower)) return 'newcomer';
    if (/family|parent|child/i.test(lower)) return 'family';
    if (/disability|accessibility/i.test(lower)) return 'disability';
    return 'general';
  }

  const categoryCounts = new Map<string, number>();
  const diversified: LiteService[] = [];
  const demoted: LiteService[] = [];

  for (const svc of topResults) {
    const normalizedCat = normalizeCategory(svc.category);
    const currentCount = categoryCounts.get(normalizedCat) || 0;

    if (currentCount < maxPerCategory) {
      diversified.push(svc);
      categoryCounts.set(normalizedCat, currentCount + 1);
    } else {
      demoted.push(svc);
    }

    // Stop once we have enough diverse results
    if (diversified.length >= topN) break;
  }

  console.log(`[CategoryDiversity] Top ${diversified.length} results from ${categoryCounts.size} categories`);

  return [...diversified, ...demoted, ...rest];
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
    const isDomainIntent = [
      'crisis', 'domestic_violence', 'food_insecurity', 'housing_urgent', 'substance_abuse',
      'mental_health', 'disability_support', 'grief_support', 'senior_services',
      'legal_aid', 'employment_support', 'youth_services', 'newcomer_services',
      'family_addiction_support', 'financial_support', 'caregiver_support', 'lgbtq_services',
      'indigenous_services', 'student_services', 'parenting_support', 'veteran_services'
    ].includes(analysis.intent);

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
          phone: sr.phone || undefined,
          is24_7: (sr as any).is24_7 || undefined,
        };
      });

      // Apply minimal boosting and return early
      const boosted = boostByIntent(services, analysis.intent, analysis.raw, analysis);
      let final = analysis.negativeTerms?.length
        ? applyNegativePenalty(boosted, analysis.negativeTerms)
        : boosted;

      // Apply category diversity for location-only queries to ensure mixed results
      if (analysis.intent === 'location_only') {
        final = applyCategoryDiversity(final);
      }

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
        phone: sr.phone || undefined,
        is24_7: sr.is24_7 || undefined,
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
        phone: sr.phone || undefined,
        is24_7: (sr as any).is24_7 || undefined,
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
