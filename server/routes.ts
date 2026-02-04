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

// ============= IN-MEMORY SERVICES CACHE =============
interface ServicesCache {
  services: Service[];
  formattedString: string;
  hash: string;
  lastFetched: number;
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
      const contact = service.contact || 'N/A';
      const description = service.description || 'Service information available upon contact';
      const tags = Array.isArray(service.tags) && (service.tags as string[]).length > 0
        ? ` [Tags: ${(service.tags as string[]).join(', ')}]`
        : '';
      const elig = service.eligibility ? ` [Eligibility: ${service.eligibility}]` : '';
      formatted += `- ${service.name}: ${contact} - ${description}${tags}${elig}\n`;
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
async function getCachedServices(): Promise<{ services: Service[]; formatted: string; hash: string }> {
  const now = Date.now();
  if (servicesCache && (now - servicesCache.lastFetched) < SERVICES_CACHE_TTL) {
    return {
      services: servicesCache.services,
      formatted: servicesCache.formattedString,
      hash: servicesCache.hash,
    };
  }

  const allServices = await storage.getAllActiveServices();
  const formatted = formatServicesForAI(allServices);
  const latestUpdate = allServices.length > 0
    ? Math.max(...allServices.map(s => s.lastUpdated?.getTime() || 0))
    : 0;
  const hash = createHash('md5')
    .update(`${allServices.length}-${latestUpdate}`)
    .digest('hex')
    .slice(0, 8);

  servicesCache = { services: allServices, formattedString: formatted, hash, lastFetched: now };
  return { services: allServices, formatted, hash };
}

// Pre-filter services based on query keywords for smaller OpenAI context
interface ScoredService {
  service: Service;
  score: number;
}

function preFilterServices(query: string, allServices: Service[]): ScoredService[] {
  const queryLower = normalizeForCache(query);
  const baseKeywords = extractKeywords(query);
  const keywords = expandKeywords(baseKeywords);

  if (keywords.length === 0) {
    return allServices.map(s => ({ service: s, score: 1 }));
  }

  const scored: ScoredService[] = [];

  for (const service of allServices) {
    let score = 0;
    const name = (service.name || '').toLowerCase();
    const desc = (service.description || '').toLowerCase();
    const cat = (service.category || '').toLowerCase();
    const eligibility = (service.eligibility || '').toLowerCase();
    const notes = (service.notes || '').toLowerCase();

    // Parse tags as actual array for proper matching
    const tagsArray: string[] = Array.isArray(service.tags)
      ? (service.tags as string[]).map(t => String(t).toLowerCase())
      : [];

    // Full query match in name (strongest signal)
    if (name.includes(queryLower)) score += 100;

    // Full query match against individual tags (strong signal)
    if (tagsArray.some(tag => tag === queryLower || tag.includes(queryLower) || queryLower.includes(tag))) {
      score += 50;
    }

    // Keyword matches with different weights
    for (const kw of keywords) {
      if (name.includes(kw)) score += 30;
      if (cat.includes(kw)) score += 25;
      if (desc.includes(kw)) score += 15;
      if (tagsArray.some(tag => tag.includes(kw))) score += 20;
      if (eligibility.includes(kw)) score += 10;
      if (notes.includes(kw)) score += 5;
    }

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
  const limit = mode === 'fast' ? 8 : scoredServices.length;
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
  const topic = keywords.length > 0 ? keywords.join(', ') : query;
  return `Found ${count} Alberta service${count === 1 ? '' : 's'} related to ${topic}. These are verified resources available to help with your needs. Contact any service directly for current availability and intake information.`;
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
      const { services: cachedServices, formatted: servicesReference, hash: DATABASE_HASH } = await getCachedServices();
      dbServices = cachedServices;

      // Normalize query and check exact cache match
      const normalizedQueryText = normalizeForCache(input.query);
      const normalizedQuery = `${DATABASE_HASH}:${mode}:${normalizedQueryText}`;
      const cached = await storage.getSearchByQuery(normalizedQuery);
      if (cached) return res.json(cached.results);

      // Detect suicide/crisis-related queries for special prioritization
      const suicideKeywords = ['suicide', 'suicidal', 'kill myself', 'end my life', 'want to die', 'dont want to live', "don't want to live", 'self harm', 'self-harm'];
      const queryLower = input.query.toLowerCase();
      const isCrisisQuery = suicideKeywords.some(keyword => queryLower.includes(keyword));

      // OPTIMIZATION 2: Pre-filter services based on query keywords
      const preFiltered = preFilterServices(input.query, cachedServices);

      // OPTIMIZATION 3: Try enrichment-based fast path
      // If we have cached AI enrichments for all relevant services, compose the
      // response locally without calling OpenAI. This gets faster over time as
      // more services accumulate enrichments from previous searches.
      if (preFiltered.length >= 3) {
        const topCount = mode === 'fast' ? 8 : Math.min(preFiltered.length, 30);
        const topServices = preFiltered.slice(0, topCount);
        const serviceIds = topServices.map(s => s.service.serviceId);
        const enrichments = await storage.getEnrichmentsByServiceIds(serviceIds);

        const enrichedCount = serviceIds.filter(id => enrichments.has(id)).length;
        if (enrichedCount >= Math.ceil(serviceIds.length * 0.6)) {
          // All top services have cached enrichments - compose locally (skip OpenAI)
          const results = composeFromEnrichments(topServices, enrichments, mode, input.query, isCrisisQuery);
          await storage.createSearch({ query: normalizedQuery, results });
          return res.json(results);
        }
      }

      // OPTIMIZATION 4: Send only pre-filtered services to OpenAI
      // Instead of sending all 342+ services, send only the relevant ones
      // This dramatically reduces token count and response latency
      const maxPreFilter = mode === 'fast' ? 25 : 50;
      const usePreFiltered = preFiltered.length >= 3;
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
FAST MODE - Return 5-8 most relevant services:
1. Return ONLY the 5-8 most relevant services matching the query
2. Prioritize crisis lines, then major treatment centers
3. Include real contact info and 3-4 process steps per service`;

      const comprehensiveModeInstructions = `
COMPREHENSIVE MODE - Return ALL relevant services:
1. Return ALL services that match - do NOT limit results
2. Include crisis lines, shelters, treatment, support groups, counselling, and all related services
3. Include real contact info and 4-8 process steps per service`;

      const systemPrompt = `You are a helpful assistant for "Recovery on Campus Resource Hub" in Alberta.
${crisisInstructions}
${mode === 'fast' ? fastModeInstructions : comprehensiveModeInstructions}

REQUIREMENTS:
- Every service MUST be a REAL Alberta organization from the reference database below
- Match services by name, description, category, AND tags (tags are shown in [Tags: ...] brackets)
- If the user's query matches a service's tags, that service MUST be included in results
- Use ONLY URLs, phone numbers, and addresses EXACTLY as listed in the database
- DO NOT invent URLs - if not in database, use the phone number instead
- Never return generic categories - only real named organizations
- Interpret user intent even with typos or misspellings

${filteredReference}

Return JSON:
{
  "services": [{
    "id": "string",
    "name": "string (exact org name from database)",
    "category": "string",
    "description": "string",
    "location": "string",
    "contact": "string (real phone/email/website from database)",
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
      saveEnrichments(results, cachedServices).catch(err => {
        console.error('Failed to save enrichments:', err);
      });

      await storage.createSearch({ query: normalizedQuery, results });
      res.json(results);
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

  return httpServer;
}
