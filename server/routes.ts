import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { createHash } from "crypto";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { strictLimiter, feedbackLimiter } from "./middleware/rateLimiter";
import type { Service, AiServiceEnrichment } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// ============= PII SCRUBBING =============
// Strips potential PII (phone numbers, full addresses) from a search query
// before it is forwarded to the LLM API.
function scrubPii(query: string): string {
  let scrubbed = query;
  // Alberta phone numbers: (780) 123-4567, 780-123-4567, 780.123.4567, +1 780 123 4567, etc.
  scrubbed = scrubbed.replace(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE]');
  // Numeric street addresses: "123 Main Street", "4567 12 Ave NW"
  scrubbed = scrubbed.replace(/\b\d{1,5}\s+\d{0,4}\s*(?:street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|crescent|cres|place|pl|way|lane|ln|court|ct|terrace|trail|park)\b/gi, '[ADDRESS]');
  // Postal codes: T2P 1A1
  scrubbed = scrubbed.replace(/\b[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d\b/g, '[POSTAL]');
  // Email addresses
  scrubbed = scrubbed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
  return scrubbed;
}

// ============= STOP WORDS (excluded from keyword extraction) =============
const STOP_WORDS = new Set([
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'need', 'help', 'want',
  'find', 'get', 'for', 'with', 'in', 'the', 'a', 'an', 'and', 'or',
  'to', 'of', 'is', 'are', 'am', 'do', 'does', 'can', 'how', 'where',
  'what', 'near', 'around', 'some', 'any', 'please', 'looking', 'search',
  'services', 'service', 'resources', 'resource', 'about', 'have', 'has',
  'been', 'being', 'was', 'were', 'will', 'would', 'could', 'should',
  'there', 'here', 'this', 'that', 'these', 'those', 'it', 'its',
  'on', 'at', 'by', 'from', 'up', 'out', 'off', 'over', 'under',
  'again', 'further', 'then', 'once', 'both', 'each', 'all', 'most',
  'other', 'not', 'no', 'nor', 'but', 'if', 'so', 'too', 'very',
  'just', 'also', 'like', 'know', 'go', 'going', 'make', 'see',
]);

// ============= ALBERTA LOCATIONS =============
// Known Alberta cities/regions for location-based filtering
const ALBERTA_LOCATIONS = new Set([
  'calgary', 'edmonton', 'red deer', 'lethbridge', 'medicine hat',
  'grande prairie', 'airdrie', 'spruce grove', 'leduc', 'fort mcmurray',
  'fort saskatchewan', 'lloydminster', 'camrose', 'brooks', 'cold lake',
  'wetaskiwin', 'okotoks', 'cochrane', 'chestermere', 'beaumont',
  'stony plain', 'sylvan lake', 'high river', 'hinton', 'canmore', 'banff',
  'drumheller', 'ponoka', 'taber', 'edson', 'peace river', 'slave lake',
  'st. albert', 'st albert', 'sherwood park', 'strathmore', 'lacombe',
  'innisfail', 'olds', 'didsbury', 'high level', 'whitecourt', 'drayton valley',
]);

// Variations and abbreviations that map to canonical location names
const LOCATION_ALIASES: Record<string, string> = {
  // Airport codes
  'yyc': 'calgary',
  'yeg': 'edmonton',
  'yqf': 'red deer',
  'yql': 'lethbridge',
  'ymm': 'fort mcmurray',
  'ygp': 'grande prairie',
  'yxh': 'medicine hat',
  'yqd': 'lloydminster',
  'yod': 'cold lake',

  // Fort McMurray variations
  'fort mac': 'fort mcmurray',
  'fortmac': 'fort mcmurray',
  'ft mac': 'fort mcmurray',
  'ft. mac': 'fort mcmurray',
  'ft mcmurray': 'fort mcmurray',
  'ft. mcmurray': 'fort mcmurray',
  'wood buffalo': 'fort mcmurray',

  // Fort Saskatchewan variations
  'fort sask': 'fort saskatchewan',
  'ft sask': 'fort saskatchewan',
  'ft. sask': 'fort saskatchewan',
  'ft saskatchewan': 'fort saskatchewan',
  'ft. saskatchewan': 'fort saskatchewan',

  // Medicine Hat variations
  'med hat': 'medicine hat',
  'medhat': 'medicine hat',
  'the hat': 'medicine hat',

  // St. Albert variations
  'st. albert': 'st albert',
  'stalbert': 'st albert',
  'saint albert': 'st albert',

  // Red Deer variations
  'rdeer': 'red deer',
  'r deer': 'red deer',

  // Grande Prairie variations
  'gp': 'grande prairie',
  'grand prairie': 'grande prairie',

  // Common short forms
  'sherwood': 'sherwood park',
  'spruce': 'spruce grove',
  'stony': 'stony plain',
  'sylvan': 'sylvan lake',
  'cold lk': 'cold lake',
  'high rv': 'high river',
  'slave lk': 'slave lake',
  'peace rv': 'peace river',
  'drayton': 'drayton valley',
};

// Province-wide indicators
const PROVINCE_WIDE_TERMS = [
  'alberta', 'province-wide', 'province wide', 'provincial', 'ab',
  'across alberta', 'all of alberta', 'anywhere in alberta',
];

interface LocationContext {
  specifiedLocation: string | null;  // The location user specified (e.g., "calgary")
  isProvinceWide: boolean;           // Whether user asked for province-wide
}

// Extract location context from a search query
function extractLocationContext(query: string): LocationContext {
  const queryLower = query.toLowerCase();

  // Check for province-wide terms
  const isProvinceWide = PROVINCE_WIDE_TERMS.some(term => queryLower.includes(term));

  // Check for location aliases first
  for (const [alias, canonical] of Object.entries(LOCATION_ALIASES)) {
    if (queryLower.includes(alias)) {
      return { specifiedLocation: canonical, isProvinceWide };
    }
  }

  // Check for known Alberta locations
  for (const location of Array.from(ALBERTA_LOCATIONS)) {
    if (queryLower.includes(location)) {
      return { specifiedLocation: location, isProvinceWide };
    }
  }

  return { specifiedLocation: null, isProvinceWide };
}

// Check if a service's location matches the specified location or is province-wide
function matchesLocation(serviceLocation: string, specifiedLocation: string): 'exact' | 'province-wide' | 'none' {
  const locLower = serviceLocation.toLowerCase();

  // Check for province-wide services (should always be included)
  if (PROVINCE_WIDE_TERMS.some(term => locLower.includes(term)) ||
      locLower.includes('canada-wide') ||
      locLower.includes('nationwide') ||
      locLower.includes('all regions')) {
    return 'province-wide';
  }

  // Check for exact location match
  if (locLower.includes(specifiedLocation)) {
    return 'exact';
  }

  // Check location aliases
  const canonical = LOCATION_ALIASES[specifiedLocation];
  if (canonical && locLower.includes(canonical)) {
    return 'exact';
  }

  return 'none';
}

// ============= KEYWORD EXPANSION MAP =============
// Maps search terms to related terms for better pre-filtering
const KEYWORD_EXPANSIONS: Record<string, string[]> = {
  'addiction': ['substance', 'drug', 'alcohol', 'opioid', 'detox', 'recovery', 'sober', 'rehab', 'withdrawal'],
  'alcohol': ['drinking', 'alcoholism', 'sobriety', 'addiction'],
  'drug': ['narcotics', 'substance', 'opioid', 'fentanyl', 'meth', 'cocaine'],
  'mental': ['psychological', 'psychiatric', 'therapy', 'counselling', 'emotional'],
  'shelter': ['housing', 'homeless', 'unhoused', 'accommodation', 'transitional', 'beds'],
  'crisis': ['emergency', 'urgent', 'helpline', 'hotline', 'distress'],
  'youth': ['teen', 'adolescent', 'young', 'child', 'gen-z'],
  'family': ['parenting', 'children', 'domestic'],
  'indigenous': ['first nations', 'metis', 'inuit', 'aboriginal', 'native'],
  'women': ['female', 'woman', 'gender', 'maternal'],
  'counselling': ['therapy', 'therapist', 'counselor', 'psychologist', 'psychotherapy'],
  'food': ['meal', 'nutrition', 'hungry', 'groceries', 'foodbank'],
  'employment': ['job', 'work', 'career', 'training'],
  'anxiety': ['anxious', 'worry', 'panic', 'stress'],
  'depression': ['depressed', 'sad', 'mood', 'hopeless'],
  'trauma': ['ptsd', 'abuse', 'violence', 'assault'],
  'recovery': ['rehabilitation', 'rehab', 'treatment', 'sober'],
  'harm': ['reduction', 'needle', 'injection', 'naloxone'],
  'detox': ['withdrawal', 'detoxification', 'medically'],
  'rehab': ['rehabilitation', 'residential', 'inpatient', 'treatment'],
  'homeless': ['houseless', 'unhoused', 'shelter', 'street'],
  'domestic': ['violence', 'abuse', 'intimate', 'partner'],
  'gambling': ['gaming', 'betting'],
  'grief': ['bereavement', 'loss', 'mourning'],
};

// ============= TYPO CORRECTION =============
// Common misspellings mapped to correct terms
const COMMON_MISSPELLINGS: Record<string, string> = {
  'addicton': 'addiction',
  'addiciton': 'addiction',
  'addction': 'addiction',
  'alcahol': 'alcohol',
  'alchohol': 'alcohol',
  'alchohal': 'alcohol',
  'councelling': 'counselling',
  'counceling': 'counselling',
  'counsling': 'counselling',
  'counsilling': 'counselling',
  'sheltar': 'shelter',
  'shleter': 'shelter',
  'sheler': 'shelter',
  'mentol': 'mental',
  'mentla': 'mental',
  'anxeity': 'anxiety',
  'anxity': 'anxiety',
  'anixety': 'anxiety',
  'depresion': 'depression',
  'depressin': 'depression',
  'deppression': 'depression',
  'suicde': 'suicide',
  'suiside': 'suicide',
  'suicidal': 'suicide',
  'homless': 'homeless',
  'houising': 'housing',
  'houseing': 'housing',
  'theropy': 'therapy',
  'theraphy': 'therapy',
  'detocs': 'detox',
  'withdrawl': 'withdrawal',
  'withdrawel': 'withdrawal',
  'opiods': 'opioid',
  'opoids': 'opioid',
  'fentanyl': 'fentanyl',
  'fentinal': 'fentanyl',
  'methadone': 'methadone',
  'methadoan': 'methadone',
  'nalaxone': 'naloxone',
  'naxolone': 'naloxone',
  'indiginous': 'indigenous',
  'indegenous': 'indigenous',
  'aborignal': 'aboriginal',
  'aborginal': 'aboriginal',
};

// Levenshtein distance for fuzzy matching (handles typos not in dictionary)
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Find closest matching keyword using Levenshtein distance
function findClosestKeyword(input: string, maxDistance: number = 2): string | null {
  const inputLower = input.toLowerCase();

  // First check exact misspellings dictionary
  if (COMMON_MISSPELLINGS[inputLower]) {
    return COMMON_MISSPELLINGS[inputLower];
  }

  // Then try fuzzy matching against known keywords
  const knownKeywords = Object.keys(KEYWORD_EXPANSIONS);
  let bestMatch: string | null = null;
  let bestDistance = maxDistance + 1;

  for (const keyword of knownKeywords) {
    const distance = levenshteinDistance(inputLower, keyword);
    if (distance <= maxDistance && distance < bestDistance) {
      bestDistance = distance;
      bestMatch = keyword;
    }
  }
  return bestMatch;
}

// Correct typos in a query
function correctTypos(query: string): { corrected: string; corrections: string[] } {
  const words = query.toLowerCase().split(/\s+/);
  const corrections: string[] = [];
  const correctedWords = words.map(word => {
    // Skip short words and stop words
    if (word.length < 4 || STOP_WORDS.has(word)) return word;

    // Check misspellings dictionary first
    if (COMMON_MISSPELLINGS[word]) {
      corrections.push(`${word} → ${COMMON_MISSPELLINGS[word]}`);
      return COMMON_MISSPELLINGS[word];
    }

    // Try fuzzy matching
    const closest = findClosestKeyword(word);
    if (closest && closest !== word) {
      corrections.push(`${word} → ${closest}`);
      return closest;
    }

    return word;
  });
  return { corrected: correctedWords.join(' '), corrections };
}

// ============= QUERY INTENT CLASSIFICATION =============
type QueryIntent = 'crisis' | 'specific_service' | 'category_browse' | 'location_search' | 'general';

function classifyQueryIntent(query: string): QueryIntent {
  const q = query.toLowerCase();

  // Crisis indicators (highest priority)
  if (/\b(suicide|suicidal|kill myself|end my life|crisis|emergency|overdose|od['']?d|dying|help me)\b/.test(q)) {
    return 'crisis';
  }

  // Specific service lookup (looking for a named organization by acronym or name)
  if (/\b(cmha|211|988|aa|na|smart recovery|distress centre|salvation army|mustard seed|inn from the cold)\b/i.test(q)) {
    return 'specific_service';
  }

  // Category browsing (user wants a list)
  if (/\b(list of|all|show me|what are the|find all|every)\b/.test(q)) {
    return 'category_browse';
  }

  // Location-focused (short query with just location + topic)
  const locContext = extractLocationContext(q);
  if (locContext.specifiedLocation && q.split(' ').length <= 4) {
    return 'location_search';
  }

  return 'general';
}

// ============= STEMMING =============
// Simple stemming rules for common recovery-related terms
const STEM_RULES: [RegExp, string][] = [
  [/tion$/, ''],           // addiction → addic
  [/sion$/, ''],           // depression → depres
  [/ment$/, ''],           // treatment → treat
  [/ness$/, ''],           // homelessness → homeless
  [/ing$/, ''],            // housing → hous, counselling → counsell
  [/ed$/, ''],             // addicted → addict
  [/er$/, ''],             // counseller → counsell
  [/or$/, ''],             // counselor → counsel
  [/ies$/, 'y'],           // families → family
  [/ive$/, ''],            // supportive → support
  [/ous$/, ''],            // anxious → anxi
  [/al$/, ''],             //mental → ment
  [/s$/, ''],              // services → service
];

function stem(word: string): string {
  if (word.length <= 4) return word; // Don't stem short words

  let stemmed = word.toLowerCase();
  for (const [pattern, replacement] of STEM_RULES) {
    if (pattern.test(stemmed) && stemmed.replace(pattern, replacement).length >= 3) {
      stemmed = stemmed.replace(pattern, replacement);
      break; // Only apply one rule
    }
  }
  return stemmed;
}

// ============= DATA COMPLETENESS CHECK =============
// Key fields that determine if a service has sufficient data for display
// Services missing 2+ of these fields are filtered from search results
const KEY_DATA_FIELDS = ['description', 'contact', 'websiteUrl', 'processSteps', 'requiredDocs'] as const;

function countMissingFields(service: Service): number {
  let missing = 0;

  // Check description
  if (!service.description || service.description.trim() === '') missing++;

  // Check contact
  if (!service.contact || service.contact.trim() === '') missing++;

  // Check websiteUrl
  if (!service.websiteUrl || service.websiteUrl.trim() === '') missing++;

  // Check processSteps (JSONB array)
  const steps = service.processSteps as string[] | null;
  if (!steps || !Array.isArray(steps) || steps.length === 0) missing++;

  // Check requiredDocs (JSONB array)
  const docs = service.requiredDocs as string[] | null;
  if (!docs || !Array.isArray(docs) || docs.length === 0) missing++;

  return missing;
}

function hasMinimumData(service: Service): boolean {
  // Allow services with at most 1 missing field (i.e., filter out those missing 2+)
  return countMissingFields(service) < 2;
}

// ============= IN-MEMORY SERVICES CACHE =============
interface ServicesCache {
  services: Service[];
  completeServices: Service[]; // Services with sufficient data
  formattedString: string;
  hash: string;
  lastFetched: number;
  aliasToServiceId: Map<string, string>; // alias -> serviceId lookup
  serviceIdToAliases: Map<string, string[]>; // serviceId -> aliases lookup
}

let servicesCache: ServicesCache | null = null;
const SERVICES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============= HELPER FUNCTIONS =============

// Format database services into OpenAI-compatible reference string
function formatServicesForAI(servicesList: Service[]): string {
  const categories = new Map<string, Service[]>();

  servicesList.forEach(service => {
    const cat = service.category || 'Other Services';
    if (!categories.has(cat)) {
      categories.set(cat, []);
    }
    categories.get(cat)!.push(service);
  });

  let formatted = '=== ALBERTA MENTAL HEALTH & SOCIAL SERVICES DATABASE ===\n\n';

  for (const category of Array.from(categories.keys())) {
    const categoryServices = categories.get(category)!;
    formatted += `## ${category.toUpperCase()}\n`;
    for (const service of categoryServices) {
      const serviceId = service.serviceId;
      const location = service.location || 'Alberta';
      const contact = service.contact || 'N/A';
      const website = service.websiteUrl ? ` [Website: ${service.websiteUrl}]` : '';
      const description = service.description || 'Service information available upon contact';
      const tags = Array.isArray(service.tags) && (service.tags as string[]).length > 0
        ? ` [Tags: ${(service.tags as string[]).join(', ')}]`
        : '';
      const elig = service.eligibility ? ` [Eligibility: ${service.eligibility}]` : '';
      formatted += `- [ID: ${serviceId}] ${service.name} (${location}): ${contact}${website} - ${description}${tags}${elig}\n`;
    }
    formatted += '\n';
  }

  return formatted;
}

// Normalize query for better cache hits
function normalizeForCache(q: string): string {
  return q
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/counc[ei]l+ing/g, 'counselling')
    .replace(/addic[it]+on/g, 'addiction')
    .replace(/ment[ae]l/g, 'mental')
    .replace(/he[al]+th/g, 'health')
    .replace(/anxi[ei]ty/g, 'anxiety')
    .replace(/depress?i?on/g, 'depression')
    .replace(/indigen[io]+us/g, 'indigenous')
    .replace(/homel?e?ss/g, 'homeless')
    .replace(/sheltt?er/g, 'shelter')
    .replace(/emerg[ae]n[cs]y/g, 'emergency')
    .replace(/supp?orr?t/g, 'support')
    .replace(/trea?t?ment/g, 'treatment')
    .replace(/alc[oa]h?ol/g, 'alcohol')
    .replace(/re[ha]+b/g, 'rehab');
}

// Extract meaningful keywords from a search query
function extractKeywords(query: string): string[] {
  const normalized = normalizeForCache(query);
  return normalized
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

// Expand keywords with related terms for broader pre-filtering
function expandKeywords(keywords: string[]): string[] {
  const expanded = new Set(keywords);
  for (const kw of keywords) {
    if (KEYWORD_EXPANSIONS[kw]) {
      for (const synonym of KEYWORD_EXPANSIONS[kw]) {
        expanded.add(synonym);
      }
    }
    // Reverse expansion: if this keyword is a synonym of another term, include that term
    for (const [key, synonyms] of Object.entries(KEYWORD_EXPANSIONS)) {
      if (synonyms.includes(kw)) {
        expanded.add(key);
      }
    }
  }
  return Array.from(expanded);
}

// Get services with in-memory caching (avoids DB round-trip on every request)
async function getCachedServices(): Promise<{
  services: Service[];
  completeServices: Service[];
  formatted: string;
  hash: string;
  aliasToServiceId: Map<string, string>;
  serviceIdToAliases: Map<string, string[]>;
}> {
  const now = Date.now();
  if (servicesCache && (now - servicesCache.lastFetched) < SERVICES_CACHE_TTL) {
    return {
      services: servicesCache.services,
      completeServices: servicesCache.completeServices,
      formatted: servicesCache.formattedString,
      hash: servicesCache.hash,
      aliasToServiceId: servicesCache.aliasToServiceId,
      serviceIdToAliases: servicesCache.serviceIdToAliases,
    };
  }

  const allServices = await storage.getAllActiveServices();
  // Filter to only services with sufficient data (missing < 2 key fields)
  const completeServices = allServices.filter(hasMinimumData);
  const formatted = formatServicesForAI(completeServices);
  const latestUpdate = allServices.length > 0
    ? Math.max(...allServices.map(s => s.lastUpdated?.getTime() || 0))
    : 0;
  const hash = createHash('md5')
    .update(`${completeServices.length}-${latestUpdate}`)
    .digest('hex')
    .slice(0, 8);

  // Load service aliases for better matching
  const serviceIdToAliases = await storage.getAliasesForServices();
  const aliasToServiceId = new Map<string, string>();
  Array.from(serviceIdToAliases.entries()).forEach(([serviceId, aliases]) => {
    aliases.forEach(alias => {
      aliasToServiceId.set(alias.toLowerCase(), serviceId);
    });
  });

  console.log(`Services cache: ${allServices.length} total, ${completeServices.length} with sufficient data, ${aliasToServiceId.size} aliases loaded`);

  servicesCache = {
    services: allServices,
    completeServices,
    formattedString: formatted,
    hash,
    lastFetched: now,
    aliasToServiceId,
    serviceIdToAliases,
  };
  return { services: allServices, completeServices, formatted, hash, aliasToServiceId, serviceIdToAliases };
}

// Pre-filter services based on query keywords for smaller OpenAI context
interface ScoredService {
  service: Service;
  score: number;
}

function preFilterServices(
  query: string,
  allServices: Service[],
  aliasToServiceId?: Map<string, string>,
  serviceIdToAliases?: Map<string, string[]>
): ScoredService[] {
  // ========== TYPO CORRECTION ==========
  // Correct common misspellings before processing
  const { corrected: correctedQuery, corrections } = correctTypos(query);
  if (corrections.length > 0) {
    console.log(`Typo corrections applied: ${corrections.join(', ')}`);
  }

  const queryLower = normalizeForCache(correctedQuery);
  const baseKeywords = extractKeywords(correctedQuery);
  const keywords = expandKeywords(baseKeywords);

  // ========== ALIAS MATCHING ==========
  // Check if any keyword matches a service alias (e.g., "CMHA", "AA", "NA")
  const aliasMatchedServiceIds = new Set<string>();
  if (aliasToServiceId) {
    for (const kw of baseKeywords) {
      const matchedServiceId = aliasToServiceId.get(kw.toLowerCase());
      if (matchedServiceId) {
        aliasMatchedServiceIds.add(matchedServiceId);
        console.log(`Alias match: "${kw}" → service ID "${matchedServiceId}"`);
      }
    }
    // Also check the full query for multi-word aliases
    const queryWords = queryLower.split(/\s+/);
    for (let i = 0; i < queryWords.length; i++) {
      for (let j = i + 1; j <= Math.min(i + 3, queryWords.length); j++) {
        const phrase = queryWords.slice(i, j).join(' ');
        const matchedServiceId = aliasToServiceId.get(phrase);
        if (matchedServiceId) {
          aliasMatchedServiceIds.add(matchedServiceId);
          console.log(`Alias match (phrase): "${phrase}" → service ID "${matchedServiceId}"`);
        }
      }
    }
  }

  // ========== STEMMING ==========
  // Add stemmed versions of keywords for broader matching
  const stemmedKeywords = new Set<string>();
  for (const kw of keywords) {
    stemmedKeywords.add(kw);
    const stemmed = stem(kw);
    if (stemmed !== kw && stemmed.length >= 3) {
      stemmedKeywords.add(stemmed);
    }
  }

  // Extract location context from the query
  const locationContext = extractLocationContext(correctedQuery);
  const { specifiedLocation } = locationContext;

  // Remove location terms from keywords to avoid double-counting
  const nonLocationKeywords = Array.from(stemmedKeywords).filter(kw =>
    !ALBERTA_LOCATIONS.has(kw) && !LOCATION_ALIASES[kw]
  );

  // ========== QUERY INTENT ==========
  const queryIntent = classifyQueryIntent(correctedQuery);

  // Detect location-only queries (user just typed a city name without topic keywords)
  const isLocationOnlyQuery = specifiedLocation && nonLocationKeywords.length === 0;

  if (nonLocationKeywords.length === 0 && !specifiedLocation) {
    return allServices.map(s => ({ service: s, score: 1 }));
  }

  // ========== LOCATION-ONLY QUERY HANDLING ==========
  // For queries like "fort mac" or "medicine hat", return ALL services in that location
  // plus province-wide services, without requiring keyword matches
  if (isLocationOnlyQuery) {
    console.log(`Location-only query detected: "${specifiedLocation}" - returning all matching services`);
    const locationResults: ScoredService[] = [];
    const now = Date.now();

    for (const service of allServices) {
      const serviceLocation = (service.location || '').toLowerCase();
      const locationMatch = matchesLocation(serviceLocation, specifiedLocation!);

      if (locationMatch === 'none') continue; // Skip services from wrong locations

      // Base score for matching services
      let score = locationMatch === 'exact' ? 300 : 150; // Exact location vs province-wide

      // Recency boost
      const lastUpdated = service.lastUpdated?.getTime() || 0;
      const daysSinceUpdate = lastUpdated > 0 ? (now - lastUpdated) / (1000 * 60 * 60 * 24) : 365;
      if (daysSinceUpdate < 30) score += 20;
      else if (daysSinceUpdate < 90) score += 10;

      // Popularity boost
      const clickCount = (service as any).clickCount || 0;
      score += Math.min(clickCount * 2, 30);

      // Data completeness boost (prefer services with more info)
      const missingFields = countMissingFields(service);
      score += (5 - missingFields) * 5; // +25 for complete, +0 for 5 missing

      locationResults.push({ service, score });
    }

    console.log(`Location-only query "${specifiedLocation}": found ${locationResults.length} services`);
    return locationResults.sort((a, b) => b.score - a.score);
  }

  const scored: ScoredService[] = [];
  const now = Date.now();

  for (const service of allServices) {
    let score = 0;
    const name = (service.name || '').toLowerCase();
    const desc = (service.description || '').toLowerCase();
    const cat = (service.category || '').toLowerCase();
    const eligibility = (service.eligibility || '').toLowerCase();
    const notes = (service.notes || '').toLowerCase();
    const serviceLocation = (service.location || '').toLowerCase();
    const contact = (service.contact || '').toLowerCase();

    // Parse tags as actual array for proper matching
    const tagsArray: string[] = Array.isArray(service.tags)
      ? (service.tags as string[]).map(t => String(t).toLowerCase())
      : [];

    // ========== ALIAS MATCHING BOOST (highest priority) ==========
    // If user searched for an alias (like "CMHA", "AA"), give huge boost to that service
    if (aliasMatchedServiceIds.has(service.serviceId)) {
      score += 500; // Very strong boost for alias match
    }

    // Also check if any query keyword matches this service's aliases
    if (serviceIdToAliases) {
      const serviceAliases = serviceIdToAliases.get(service.serviceId) || [];
      for (const alias of serviceAliases) {
        if (queryLower.includes(alias.toLowerCase())) {
          score += 300; // Strong boost for alias mention in query
          break;
        }
      }
    }

    // ========== LOCATION FILTERING (critical for location-specific queries) ==========
    let locationMatch: 'exact' | 'province-wide' | 'none' = 'none';
    if (specifiedLocation) {
      locationMatch = matchesLocation(serviceLocation, specifiedLocation);

      // If user specified a location and service doesn't match, heavily penalize
      // but still allow province-wide services through
      if (locationMatch === 'none') {
        // Skip services from wrong locations entirely when location is specified
        // unless they have very strong keyword relevance (handled below)
        score -= 500; // Heavy penalty, can be overcome by very strong matches
      } else if (locationMatch === 'exact') {
        score += 200; // Strong bonus for exact location match
      } else if (locationMatch === 'province-wide') {
        score += 100; // Moderate bonus for province-wide services
      }
    }

    // ========== EXACT & PHRASE MATCHING (highest priority) ==========
    // Full query match in name (strongest signal)
    // Remove location from query for matching
    const queryWithoutLocation = specifiedLocation
      ? queryLower.replace(specifiedLocation, '').trim()
      : queryLower;

    if (queryWithoutLocation && name.includes(queryWithoutLocation)) score += 150;

    // Exact tag match (very strong signal)
    if (tagsArray.some(tag => tag === queryWithoutLocation)) score += 100;

    // Full query in category
    if (queryWithoutLocation && cat.includes(queryWithoutLocation)) score += 80;

    // Full query in description
    if (queryWithoutLocation && desc.includes(queryWithoutLocation)) score += 60;

    // ========== TAG MATCHING (high priority) ==========
    // Partial tag matches
    if (queryWithoutLocation && tagsArray.some(tag => tag.includes(queryWithoutLocation) || queryWithoutLocation.includes(tag))) {
      score += 50;
    }

    // ========== KEYWORD MATCHING (with stemming) ==========
    // Stem the service text for matching
    const nameStemmed = name.split(/\s+/).map(stem).join(' ');
    const descStemmed = desc.split(/\s+/).map(stem).join(' ');
    const catStemmed = cat.split(/\s+/).map(stem).join(' ');

    for (const kw of nonLocationKeywords) {
      // Name matches (high value)
      if (name.includes(kw) || nameStemmed.includes(kw)) score += 35;

      // Category matches (high value - indicates core focus)
      if (cat.includes(kw) || catStemmed.includes(kw)) score += 30;

      // Tag keyword matches (good signal)
      if (tagsArray.some(tag => tag.includes(kw) || stem(tag).includes(kw))) score += 25;

      // Description matches
      if (desc.includes(kw) || descStemmed.includes(kw)) score += 15;

      // Eligibility matches (relevant for user targeting)
      if (eligibility.includes(kw)) score += 12;

      // Notes and contact (lower priority)
      if (notes.includes(kw)) score += 5;
      if (contact.includes(kw)) score += 3;
    }

    // ========== BONUS: Multiple keyword matches ==========
    // Reward services that match multiple keywords
    const keywordMatchCount = nonLocationKeywords.filter(kw =>
      name.includes(kw) || nameStemmed.includes(kw) ||
      cat.includes(kw) || catStemmed.includes(kw) ||
      desc.includes(kw) || descStemmed.includes(kw) ||
      tagsArray.some(tag => tag.includes(kw))
    ).length;
    if (keywordMatchCount >= 3) score += 40;
    else if (keywordMatchCount >= 2) score += 20;

    // ========== RECENCY BOOSTING ==========
    // Boost recently updated services
    const lastUpdated = service.lastUpdated?.getTime() || 0;
    const daysSinceUpdate = lastUpdated > 0 ? (now - lastUpdated) / (1000 * 60 * 60 * 24) : 365;

    if (daysSinceUpdate < 30) score += 15;        // Updated within last month
    else if (daysSinceUpdate < 90) score += 10;   // Updated within last quarter
    else if (daysSinceUpdate > 365) score -= 5;   // Stale data penalty

    // ========== POPULARITY BOOSTING ==========
    // Boost services with high click counts (capped to prevent domination)
    const clickCount = (service as any).clickCount || 0;
    const popularityBoost = Math.min(clickCount * 2, 30); // Max +30 from clicks
    score += popularityBoost;

    // ========== QUERY INTENT ADJUSTMENTS ==========
    // Adjust scoring based on query intent
    if (queryIntent === 'crisis') {
      // Boost crisis services
      if (cat.includes('crisis') || cat.includes('24/7') || name.includes('crisis') || name.includes('helpline')) {
        score += 100;
      }
    } else if (queryIntent === 'specific_service') {
      // Boost exact name matches for specific service lookups
      if (name.includes(queryWithoutLocation)) {
        score += 50;
      }
    }

    // ========== LOCATION-BASED FILTERING ==========
    // Only include services with positive scores
    // For location-specific queries, this means:
    // - Exact location matches: easily positive due to +200 bonus
    // - Province-wide: positive due to +100 bonus
    // - Wrong location: needs very strong keyword relevance to overcome -500 penalty
    if (score > 0) {
      scored.push({ service, score });
    }
  }

  return scored.sort((a, b) => b.score - a.score);
}

// Compose search results from cached enrichments (no OpenAI call needed)
function composeFromEnrichments(
  scoredServices: ScoredService[],
  enrichments: Map<string, AiServiceEnrichment>,
  mode: string,
  query: string,
  isCrisisQuery: boolean
): { services: any[]; summary: string } {
  // For location-only queries or small result sets, return all results
  // Only apply the 15-result limit for large result sets in fast mode
  const locationContext = extractLocationContext(query);
  const baseKeywords = extractKeywords(query);
  const nonLocationKeywords = baseKeywords.filter(kw =>
    !ALBERTA_LOCATIONS.has(kw) && !LOCATION_ALIASES[kw]
  );
  const isLocationOnlyQuery = locationContext.specifiedLocation && nonLocationKeywords.length === 0;

  // For location-only queries, return all results (up to 50)
  // For regular queries in fast mode, limit to 15
  // For regular queries in comprehensive mode, no limit
  let limit: number;
  if (isLocationOnlyQuery) {
    limit = Math.min(scoredServices.length, 50); // Return all for location queries (cap at 50)
  } else if (mode === 'fast') {
    limit = 15;
  } else {
    limit = scoredServices.length;
  }

  const selected = scoredServices.slice(0, limit);

  const resultServices = selected.map(({ service }) => {
    const enrichment = enrichments.get(service.serviceId);

    if (enrichment) {
      const processSteps = (enrichment.aiProcessSteps as string[]) || [];
      return {
        id: service.serviceId,
        name: service.name,
        category: enrichment.aiCategory || service.category,
        description: enrichment.aiDescription,
        location: enrichment.aiLocation || service.location || '',
        contact: enrichment.aiContact || service.contact || '',
        websiteUrl: service.websiteUrl || '',
        eligibility: enrichment.aiEligibility || service.eligibility || '',
        process: mode === 'fast' ? processSteps.slice(0, 4) : processSteps,
        waitTimes: enrichment.aiWaitTimes || service.waitTimes || '',
        requiredDocs: (enrichment.aiRequiredDocs as string[]) || [],
      };
    }

    // Fallback to raw DB data when enrichment is missing
    return {
      id: service.serviceId,
      name: service.name,
      category: service.category,
      description: service.description || '',
      location: service.location || '',
      contact: service.contact || '',
      websiteUrl: service.websiteUrl || '',
      eligibility: service.eligibility || '',
      process: (service.processSteps as string[]) || [],
      waitTimes: service.waitTimes || '',
      requiredDocs: (service.requiredDocs as string[]) || [],
    };
  });

  // For crisis queries, ensure 988 is first
  if (isCrisisQuery) {
    const crisis988Service = {
      id: "988-suicide-crisis-helpline",
      name: "988 Suicide Crisis Helpline",
      category: "24/7 Crisis Line",
      description: "Free, confidential 24/7 support for people in suicidal crisis or emotional distress. Call or text 988 to connect with a trained crisis counselor immediately. Available in English and French.",
      location: "Canada-wide (available in Alberta)",
      contact: "Call or text 988",
      eligibility: "Anyone experiencing suicidal thoughts, emotional distress, or supporting someone in crisis",
      process: [
        "Call or text 988 from any phone - available 24/7",
        "You will be connected to a trained crisis counselor",
        "Share what you're going through at your own pace",
        "The counselor will provide immediate support and safety planning",
        "You may be connected to local resources for ongoing support"
      ],
      waitTimes: "Immediate - 24/7 availability",
      requiredDocs: ["None - anonymous and confidential"]
    };

    const filtered = resultServices.filter((s: any) =>
      !s.id?.includes('988') && !s.name?.toLowerCase().includes('988')
    );
    return { services: [crisis988Service, ...filtered], summary: buildSummary(filtered.length + 1, query) };
  }

  return { services: resultServices, summary: buildSummary(resultServices.length, query) };
}

function buildSummary(count: number, query: string): string {
  const keywords = extractKeywords(query);
  const locationContext = extractLocationContext(query);
  const nonLocationKeywords = keywords.filter(kw =>
    !ALBERTA_LOCATIONS.has(kw) && !LOCATION_ALIASES[kw]
  );
  const isLocationOnlyQuery = locationContext.specifiedLocation && nonLocationKeywords.length === 0;

  // Format location name nicely (capitalize first letter of each word)
  const formatLocation = (loc: string) => loc.split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // For location-only queries, provide a cleaner summary
  if (isLocationOnlyQuery && locationContext.specifiedLocation) {
    const locationName = formatLocation(locationContext.specifiedLocation);
    return `Found ${count} service${count === 1 ? '' : 's'} available in ${locationName} and province-wide. These include mental health, addiction, housing, and social services. Contact any service directly for current availability.`;
  }

  const topic = nonLocationKeywords.join(', ') || query;

  // Include location in summary if specified
  const locationPhrase = locationContext.specifiedLocation
    ? ` in ${formatLocation(locationContext.specifiedLocation)} and province-wide`
    : '';

  return `Found ${count} Alberta service${count === 1 ? '' : 's'} related to ${topic}${locationPhrase}. These are verified resources available to help with your needs. Contact any service directly for current availability and intake information.`;
}

// Save per-service enrichments from an OpenAI response for future reuse
async function saveEnrichments(results: any, dbServices: Service[]): Promise<void> {
  if (!results.services || !Array.isArray(results.services)) return;

  // Build lookup maps for matching AI results to database services
  const nameToService = new Map<string, Service>();
  const normalizedNameToService = new Map<string, Service>();
  for (const s of dbServices) {
    nameToService.set(s.name.toLowerCase(), s);
    normalizedNameToService.set(
      s.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim(),
      s
    );
  }

  for (const aiService of results.services) {
    const matchName = (aiService.name || '').toLowerCase();
    const normalizedMatch = matchName.replace(/[^a-z0-9\s]/g, '').trim();

    // Try exact match first
    let dbService = nameToService.get(matchName);

    // Try normalized match
    if (!dbService) {
      dbService = normalizedNameToService.get(normalizedMatch);
    }

    // Try inclusion match (partial name match)
    if (!dbService) {
      for (const [name, service] of Array.from(nameToService.entries())) {
        if (name.includes(normalizedMatch) || normalizedMatch.includes(name)) {
          dbService = service;
          break;
        }
      }
    }

    if (!dbService) continue;

    try {
      await storage.upsertEnrichment({
        serviceId: dbService.serviceId,
        serviceName: dbService.name,
        aiDescription: aiService.description || '',
        aiCategory: aiService.category || dbService.category,
        aiProcessSteps: aiService.process || [],
        aiEligibility: aiService.eligibility || null,
        aiWaitTimes: aiService.waitTimes || null,
        aiRequiredDocs: aiService.requiredDocs || null,
        aiLocation: aiService.location || null,
        aiContact: aiService.contact || null,
      });
    } catch (err) {
      console.error(`Failed to save enrichment for ${dbService.name}:`, err);
    }
  }
}

// ============= ROUTE REGISTRATION =============

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Pre-warm the services cache on startup
  getCachedServices().catch(err => {
    console.error('Failed to pre-warm services cache:', err);
  });

  app.post(api.search.query.path, strictLimiter, async (req: Request, res: Response) => {
    const startTime = Date.now();
    let dbServices: Service[] = [];
    try {
      const input = api.search.query.input.parse(req.body);

      // Honeypot check: bots fill hidden fields, humans don't
      if (input.hp) {
        return res.json({ services: [], summary: "No results found." });
      }

      const mode = input.mode || 'fast';

      // OPTIMIZATION 1: In-memory services cache
      // Eliminates DB round-trip for service data on every request
      // Uses completeServices (services with sufficient data) for search
      const {
        services: allCachedServices,
        completeServices,
        formatted: servicesReference,
        hash: DATABASE_HASH,
        aliasToServiceId,
        serviceIdToAliases
      } = await getCachedServices();
      dbServices = allCachedServices;
      // Use only services with sufficient data for search results
      const cachedServices = completeServices;

      // Normalize query and check exact cache match
      const normalizedQueryText = normalizeForCache(input.query);
      const normalizedQuery = `${DATABASE_HASH}:${mode}:${normalizedQueryText}`;
      const cached = await storage.getSearchByQuery(normalizedQuery);
      if (cached) {
        const searchTimeMs = Date.now() - startTime;
        const cachedResults = cached.results as Record<string, unknown>;
        return res.json({ ...cachedResults, searchTimeMs, cached: true });
      }

      // Detect suicide/crisis-related queries for special prioritization
      const suicideKeywords = ['suicide', 'suicidal', 'kill myself', 'end my life', 'want to die', 'dont want to live', "don't want to live", 'self harm', 'self-harm'];
      const queryLower = input.query.toLowerCase();
      const isCrisisQuery = suicideKeywords.some(keyword => queryLower.includes(keyword));

      // OPTIMIZATION 2: Pre-filter services based on query keywords (with alias support)
      const preFiltered = preFilterServices(input.query, cachedServices, aliasToServiceId, serviceIdToAliases);

      // OPTIMIZATION 3: Try enrichment-based fast path
      // If we have cached AI enrichments for all relevant services, compose the
      // response locally without calling OpenAI. This gets faster over time as
      // more services accumulate enrichments from previous searches.

      // Detect location-only queries for special handling
      const queryLocationContext = extractLocationContext(input.query);
      const queryBaseKeywords = extractKeywords(input.query);
      const queryNonLocationKeywords = queryBaseKeywords.filter(kw =>
        !ALBERTA_LOCATIONS.has(kw) && !LOCATION_ALIASES[kw]
      );
      const isLocationOnlySearch = queryLocationContext.specifiedLocation && queryNonLocationKeywords.length === 0;

      if (preFiltered.length >= 3) {
        // For location-only queries, include all matching services (up to 50)
        // For regular queries, use the standard limits
        let topCount: number;
        if (isLocationOnlySearch) {
          topCount = Math.min(preFiltered.length, 50); // All results for location queries
        } else if (mode === 'fast') {
          topCount = 15;
        } else {
          topCount = Math.min(preFiltered.length, 80);
        }

        const topServices = preFiltered.slice(0, topCount);
        const serviceIds = topServices.map(s => s.service.serviceId);
        const enrichments = await storage.getEnrichmentsByServiceIds(serviceIds);

        const enrichedCount = serviceIds.filter(id => enrichments.has(id)).length;
        const enrichmentThreshold = mode === 'fast' ? 0.7 : 0.9;
        if (enrichedCount >= Math.ceil(serviceIds.length * enrichmentThreshold)) {
          // All top services have cached enrichments - compose locally (skip OpenAI)
          const results = composeFromEnrichments(topServices, enrichments, mode, input.query, isCrisisQuery);
          await storage.createSearch({ query: normalizedQuery, results });
          const searchTimeMs = Date.now() - startTime;
          return res.json({ ...results, searchTimeMs, cached: false });
        }
      }

      // OPTIMIZATION 4: Send only pre-filtered services to OpenAI
      // Instead of sending all services, send only the relevant ones
      // This dramatically reduces token count and response latency
      const maxPreFilter = mode === 'fast' ? 60 : 150;
      const usePreFiltered = preFiltered.length >= 5;
      const relevantServices = usePreFiltered
        ? preFiltered.slice(0, maxPreFilter).map(s => s.service)
        : cachedServices;
      const filteredReference = usePreFiltered
        ? formatServicesForAI(relevantServices)
        : servicesReference;

      // Crisis prioritization instructions
      const crisisInstructions = isCrisisQuery ? `
CRISIS QUERY DETECTED - PRIORITIZE CRISIS RESOURCES:
⚠️ THIS IS A POTENTIAL CRISIS SITUATION - YOU MUST RETURN CRISIS LINES FIRST ⚠️
1. ALWAYS include 988 Suicide Crisis Helpline as the FIRST result
2. Include Mental Health Helpline (1-877-303-2642) in top 3 results
3. Include Distress Centre Calgary (403-266-HELP) in top 3 results
4. Include ConnecTeen for youth (403-264-8336) if applicable
5. Include local Crisis/Urgent Care centres in the results
6. Only AFTER crisis resources, include other relevant mental health services
` : '';

      // Different prompts for fast vs comprehensive modes
      const fastModeInstructions = `
FAST MODE - Return 12-15 most relevant services:
1. Return the 12-15 most relevant services matching the query
2. Prioritize crisis lines, then major treatment centers, then community programs
3. Include real contact info and 3-4 process steps per service
4. Err on the side of inclusion - if a service could be relevant, include it
5. Include services with matching tags even if name doesn't directly match`;

      const comprehensiveModeInstructions = `
COMPREHENSIVE MODE - Return ALL relevant services (CRITICAL):
1. You MUST return EVERY service from the database that could be relevant to the query
2. If 15 services match, return all 15. If 40 match, return all 40. NEVER cap or limit results.
3. Include: crisis lines, shelters, treatment programs, support groups, peer support, counselling, community programs, campus resources, online resources, and ANY service with matching tags
4. A service is relevant if its name, description, category, tags, OR eligibility relates to the query
5. Include real contact info and 4-8 process steps per service
6. When in doubt about relevance, INCLUDE the service`;

      // Detect location context for OpenAI prompt
      const locationContext = extractLocationContext(input.query);

      // Location-only query instructions (user just typed a city name)
      const locationOnlyInstructions = isLocationOnlySearch && locationContext.specifiedLocation ? `
LOCATION-ONLY QUERY DETECTED: User wants ALL services available in "${locationContext.specifiedLocation.toUpperCase()}"
- Return EVERY service from the database that serves ${locationContext.specifiedLocation}
- ALSO return ALL province-wide services (marked as "Alberta", "province-wide", "provincial", etc.)
- Include ALL categories: crisis lines, shelters, addiction, mental health, housing, counselling, support groups, etc.
- DO NOT limit results - if 30 services match, return all 30
- DO NOT include services from OTHER cities unless they are province-wide
- Order by category for easy browsing (crisis first, then by alphabetical category)
` : '';

      const locationInstructions = (!isLocationOnlySearch && locationContext.specifiedLocation) ? `
LOCATION-SPECIFIC QUERY DETECTED: User is looking for services in "${locationContext.specifiedLocation.toUpperCase()}"
- PRIORITIZE services located in or serving ${locationContext.specifiedLocation}
- ALSO INCLUDE province-wide services (marked as "Alberta", "province-wide", "provincial", etc.)
- DO NOT include services from other cities unless they are province-wide
- If a service's location field contains "${locationContext.specifiedLocation}" or "Alberta province-wide", include it
- Services in other cities like ${locationContext.specifiedLocation === 'calgary' ? 'Edmonton, Red Deer, Lethbridge' : 'Calgary, Red Deer, Lethbridge'} should be EXCLUDED unless province-wide
` : '';

      const systemPrompt = `You are a helpful assistant for "Recovery on Campus Resource Hub" in Alberta.
${crisisInstructions}
${locationOnlyInstructions}
${locationInstructions}
${mode === 'fast' ? fastModeInstructions : comprehensiveModeInstructions}

REQUIREMENTS:
- Every service MUST be a REAL Alberta organization from the reference database below
- Use the EXACT service ID from [ID: ...] - this is critical for matching
- Match services by name, description, category, AND tags (tags are shown in [Tags: ...] brackets)
- If the user's query matches a service's tags, that service MUST be included in results
- Use ONLY URLs, phone numbers, and addresses EXACTLY as listed in the database
- For websiteUrl: copy the EXACT URL from [Website: ...] - do NOT put URLs in the contact field
- For contact: include phone numbers and email addresses only (NOT website URLs)
- DO NOT invent URLs - if no [Website: ...] exists for a service, leave websiteUrl empty
- Never return generic categories - only real named organizations
- Interpret user intent even with typos or misspellings
- RESPECT LOCATION: Use the location shown in parentheses (e.g., "Calgary" or "Alberta"). Only include services from the user's city + province-wide services

${filteredReference}

Return JSON:
{
  "services": [{
    "id": "string (EXACT ID from [ID: ...] in the database)",
    "name": "string (exact org name from database)",
    "category": "string",
    "description": "string",
    "location": "string (from database)",
    "contact": "string (phone/email ONLY - no URLs)",
    "websiteUrl": "string (EXACT URL from [Website: ...] or empty string if none)",
    "eligibility": "string",
    "process": ["${mode === 'fast' ? '3-4' : '4-8'} actionable steps with real contact info"],
    "waitTimes": "string",
    "requiredDocs": ["specific to this service"]
  }],
  "summary": "string"
}`;

      // Scrub PII from query before sending to the LLM
      const sanitizedQuery = scrubPii(input.query);

      const completion = await openai.chat.completions.create({
        model: mode === 'fast' ? "gpt-4.1-mini" : "gpt-4.1",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: sanitizedQuery }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const results = JSON.parse(completion.choices[0].message.content!);

      // ========== POST-PROCESSING: Enhance AI results with database data ==========
      // Match AI results to actual database services and fill in missing fields
      if (results.services && Array.isArray(results.services)) {
        // Build a lookup map of database services by ID and normalized name
        const serviceById = new Map<string, Service>();
        const serviceByName = new Map<string, Service>();
        for (const s of allCachedServices) {
          serviceById.set(s.serviceId.toLowerCase(), s);
          serviceByName.set(s.name.toLowerCase().trim(), s);
        }

        results.services = results.services.map((aiService: any) => {
          // Try to match by ID first, then by name
          let dbService: Service | undefined;
          if (aiService.id) {
            dbService = serviceById.get(aiService.id.toLowerCase());
          }
          if (!dbService && aiService.name) {
            dbService = serviceByName.get(aiService.name.toLowerCase().trim());
          }

          if (dbService) {
            // Use database ID (ensures exact match)
            aiService.id = dbService.serviceId;

            // Fill in websiteUrl from database if AI didn't return it
            if (!aiService.websiteUrl && dbService.websiteUrl) {
              aiService.websiteUrl = dbService.websiteUrl;
            }

            // If AI put a URL in contact, extract it to websiteUrl
            if (aiService.contact) {
              const urlMatch = aiService.contact.match(/https?:\/\/[^\s,;]+/i);
              if (urlMatch && !aiService.websiteUrl) {
                aiService.websiteUrl = urlMatch[0].replace(/[.)]+$/, '');
                aiService.contact = aiService.contact.replace(urlMatch[0], '').trim().replace(/^[,;|\s]+|[,;|\s]+$/g, '');
              }
            }

            // Fill in location from database if missing
            if (!aiService.location && dbService.location) {
              aiService.location = dbService.location;
            }
          }

          // Ensure websiteUrl is a string (not undefined/null)
          aiService.websiteUrl = aiService.websiteUrl || '';

          // Ensure arrays are properly formatted
          if (!Array.isArray(aiService.process)) aiService.process = [];
          if (!Array.isArray(aiService.requiredDocs)) aiService.requiredDocs = [];

          return aiService;
        });
      }

      // For crisis queries, ensure 988 is ALWAYS the first result
      if (isCrisisQuery && results.services) {
        const crisis988Service = {
          id: "988-suicide-crisis-helpline",
          name: "988 Suicide Crisis Helpline",
          category: "24/7 Crisis Line",
          description: "Free, confidential 24/7 support for people in suicidal crisis or emotional distress. Call or text 988 to connect with a trained crisis counselor immediately. Available in English and French.",
          location: "Canada-wide (available in Alberta)",
          contact: "Call or text 988",
          eligibility: "Anyone experiencing suicidal thoughts, emotional distress, or supporting someone in crisis",
          process: [
            "Call or text 988 from any phone - available 24/7",
            "You will be connected to a trained crisis counselor",
            "Share what you're going through at your own pace",
            "The counselor will provide immediate support and safety planning",
            "You may be connected to local resources for ongoing support"
          ],
          waitTimes: "Immediate - 24/7 availability",
          requiredDocs: ["None - anonymous and confidential"]
        };

        // Remove any existing 988 entry to avoid duplicates
        results.services = results.services.filter((s: any) =>
          !s.id?.includes('988') && !s.name?.toLowerCase().includes('988')
        );

        // Prepend 988 as the first result
        results.services.unshift(crisis988Service);
      }

      // OPTIMIZATION 5: Save per-service enrichments asynchronously
      // Each OpenAI response enriches our cache, making future searches faster
      // Use allCachedServices to match enrichments to any service, not just complete ones
      saveEnrichments(results, allCachedServices).catch(err => {
        console.error('Failed to save enrichments:', err);
      });

      await storage.createSearch({ query: normalizedQuery, results });
      const searchTimeMs = Date.now() - startTime;
      res.json({ ...results, searchTimeMs, cached: false });
    } catch (err) {
      // Log detailed error information for debugging
      console.error("=== Search Error ===");
      console.error("Error:", err);
      console.error("OpenAI API Key configured:", !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
      console.error("OpenAI Base URL:", process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'default');
      console.error("Database services available:", dbServices?.length || 0);
      console.error("===================");

      // Return error with helpful message
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({
        message: "Search failed",
        error: errorMessage,
        hint: !process.env.AI_INTEGRATIONS_OPENAI_API_KEY
          ? "OpenAI API key not configured"
          : undefined
      });
    }
  });

  // Feedback endpoint
  app.post("/api/feedback", feedbackLimiter, async (req: Request, res: Response) => {
    try {
      const feedbackSchema = z.object({
        name: z.string().optional(),
        email: z.string().email().optional().or(z.literal('')),
        message: z.string().min(1, "Message is required").max(2000, "Message is too long"),
        hp: z.string().max(0).optional(),
      });

      const validatedData = feedbackSchema.parse(req.body);

      // Honeypot check
      if (validatedData.hp) {
        return res.json({ success: true, id: 0 });
      }

      const feedbackData = {
        name: validatedData.name || null,
        email: validatedData.email || null,
        message: validatedData.message,
      };

      const newFeedback = await storage.createFeedback(feedbackData);
      res.json({ success: true, id: newFeedback.id });
    } catch (err) {
      console.error("Feedback error:", err);
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid feedback data", errors: err.errors });
      } else {
        res.status(500).json({ message: "Failed to submit feedback" });
      }
    }
  });

  // ============= CLICK TRACKING ENDPOINT =============
  // Tracks when users click on search results to improve ranking over time
  app.post("/api/track-click", async (req: Request, res: Response) => {
    try {
      const clickSchema = z.object({
        serviceId: z.string().min(1),
        query: z.string().min(1),
        position: z.number().int().min(1).optional(),
      });

      const data = clickSchema.parse(req.body);

      // Track the click asynchronously (don't block response)
      storage.trackSearchClick({
        query: data.query,
        normalizedQuery: normalizeForCache(data.query),
        resultCount: 0, // Not tracking this for click events
        clickedServiceId: data.serviceId,
        clickPosition: data.position,
        sessionId: req.headers['x-session-id'] as string || undefined,
        userAgent: req.headers['user-agent'] || undefined,
      }).catch(err => {
        console.error('Failed to track click:', err);
      });

      res.json({ success: true });
    } catch (err) {
      // Don't fail the request if tracking fails
      console.error("Click tracking error:", err);
      res.json({ success: false });
    }
  });

  // ============= SEARCH ANALYTICS ENDPOINT =============
  // Returns popular searches (for admin/analytics purposes)
  app.get("/api/analytics/popular-searches", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const popularSearches = await storage.getPopularSearches(limit);
      res.json({ searches: popularSearches });
    } catch (err) {
      console.error("Analytics error:", err);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  return httpServer;
}
