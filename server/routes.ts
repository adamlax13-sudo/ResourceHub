import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { createHash } from "crypto";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { strictLimiter, feedbackLimiter } from "./middleware/rateLimiter";
import type { Service } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Format database services into OpenAI-compatible reference string
const formatServicesForAI = (services: Service[]): string => {
  const categories = new Map<string, Service[]>();

  // Group services by category
  services.forEach(service => {
    const cat = service.category || 'Other Services';
    if (!categories.has(cat)) {
      categories.set(cat, []);
    }
    categories.get(cat)!.push(service);
  });

  let formatted = '=== ALBERTA MENTAL HEALTH & SOCIAL SERVICES DATABASE ===\n\n';

  // Format each category
  for (const category of Array.from(categories.keys())) {
    const categoryServices = categories.get(category)!;
    formatted += `## ${category.toUpperCase()}\n`;
    for (const service of categoryServices) {
      // Format: Name: Contact - Description
      const contact = service.contact || 'N/A';
      const description = service.description || 'Service information available upon contact';
      formatted += `- ${service.name}: ${contact} - ${description}\n`;
    }
    formatted += '\n';
  }

  return formatted;
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post(api.search.query.path, strictLimiter, async (req: Request, res: Response) => {
    let dbServices: Service[] = [];
    try {
      const input = api.search.query.input.parse(req.body);
      const mode = input.mode || 'fast';

      // Query database for all active services
      dbServices = await storage.getAllActiveServices();

      // Create dynamic hash based on service count and latest update timestamp
      // This invalidates cache when services are added/updated
      const serviceCount = dbServices.length;
      const latestUpdate = dbServices.length > 0
        ? Math.max(...dbServices.map(s => s.lastUpdated?.getTime() || 0))
        : 0;
      const DATABASE_HASH = createHash('md5')
        .update(`${serviceCount}-${latestUpdate}`)
        .digest('hex')
        .slice(0, 8);

      // Format services for OpenAI
      const servicesReference = formatServicesForAI(dbServices);

      // Detect suicide/crisis-related queries for special prioritization
      const suicideKeywords = ['suicide', 'suicidal', 'kill myself', 'end my life', 'want to die', 'dont want to live', "don't want to live", 'self harm', 'self-harm'];
      const queryLower = input.query.toLowerCase();
      const isCrisisQuery = suicideKeywords.some(keyword => queryLower.includes(keyword));
      
      // Normalize query for better cache hits - handle common variations
      const normalizeForCache = (q: string): string => {
        return q
          .toLowerCase()
          .trim()
          .replace(/\s+/g, ' ')  // Multiple spaces to single space
          .replace(/['']/g, "'") // Smart quotes to regular
          .replace(/[""]/g, '"') // Smart quotes to regular
          // Common typo corrections for cache matching
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
      };
      
      // Include database hash and mode in cache key
      const normalizedQuery = `${DATABASE_HASH}:${mode}:${normalizeForCache(input.query)}`;
      const cached = await storage.getSearchByQuery(normalizedQuery);
      if (cached) return res.json(cached.results);

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
FAST MODE - Return 5-8 most relevant services quickly:
1. Return ONLY the 5-8 most relevant, high-priority services that best match the query
2. Prioritize crisis lines, major treatment centers, and well-known organizations
3. Provide detailed process steps (4-8 steps each) with full contact information (do not make these us, ensure it is real information)
4. Focus on immediate, actionable resources`;

      const comprehensiveModeInstructions = `
COMPREHENSIVE MODE - Return ALL relevant services:
1. RETURN ALL RELEVANT SERVICES - DO NOT limit or cap results. If 15 services match, return all 15. If 30 match, return all 30.
2. Be COMPREHENSIVE - include crisis lines, shelters, treatment programs, support groups, peer support, counselling, and all related services
3. Provide detailed process steps (4-8 steps each) with full contact information (do not make these us, ensure it is real information)
4. Include both major organizations AND smaller community resources`;

      const systemPrompt = `You are helpful assistant for "Recovery on Campus Resource Hub" in Alberta.
${crisisInstructions}
${mode === 'fast' ? fastModeInstructions : comprehensiveModeInstructions}

CRITICAL REQUIREMENTS:
- EXACT NAME MATCH PRIORITY: If the user's query contains an exact organization name (e.g., "Alpha House", "Calgary Drop-In", "Mustard Seed"), you MUST include that specific organization in your results FIRST.
- Every service MUST be a REAL, SPECIFIC Alberta organization from the reference database below
- ONLY use URLs, phone numbers, and addresses EXACTLY as listed in the reference database
- DO NOT invent or guess URLs - if a URL is not in the database, use the phone number instead
- Never return generic categories like "Local Counseling Services" or "Community Support Groups"

SPELLING & TYPO TOLERANCE - INTERPRET USER INTENT:
- Always interpret what the user MEANT, not just what they typed
- Common misspellings to recognize:
  * "counceling/councilling/counsling/counsilling" → counselling/counseling
  * "addiciton/addicton/addction" → addiction
  * "mentl/menal/mential" → mental
  * "helth/heath/heatlh" → health
  * "detox/detoxx/detocks" → detox
  * "rehab/reahb/rahab" → rehab
  * "sheltr/sheltter/shleter" → shelter
  * "emergancy/emergeny/emrgency" → emergency
  * "suport/supprt/suporrt" → support
  * "treatmnt/tretment/treatement" → treatment
  * "alcahol/alchol/alcohal" → alcohol
  * "anxeity/anxity/anixety" → anxiety
  * "depresion/depressin/deppression" → depression
  * "indiginous/indigenious/indegenous" → Indigenous
  * "homless/homelss/houseless" → homeless
  * "psyciatry/phsychiatry/pschiatry" → psychiatry
- Handle missing spaces: "mentalhealth" → "mental health", "foodbank" → "food bank"
- Handle extra spaces: "Al pha House" → "Alpha House"
- Handle common abbreviations: "AA" → "Alcoholics Anonymous", "NA" → "Narcotics Anonymous", "MH" → "mental health"
- If the query is unclear but seems related to recovery/support services, provide relevant general results

SEARCH MATCHING RULES:
- If query mentions "Alpha House" → MUST include Alpha House Society Calgary and Alpha House Detox
- If query mentions "Calgary Drop-In" → MUST include Calgary Drop-In Centre
- If query mentions "Mustard Seed" → MUST include Mustard Seed services
- If query mentions "CMHA" → MUST include relevant CMHA chapter

${servicesReference}

PROCESS STEPS - USE ONLY VERIFIED INFO:
- Use ONLY phone numbers, emails, and URLs from the reference database above
- DO NOT invent URLs - if not in database, use phone number instead
- If unsure of exact process: "Contact [org] at [phone from database] for current intake steps"

Return JSON matching:
{
  "services": [{
    "id": "string",
    "name": "string (MUST be the real organization/program name)",
    "category": "string",
    "description": "string",
    "location": "string (real address or service area)",
    "contact": "string (real phone/email/website)",
    "eligibility": "string",
    "process": ["${mode === 'fast' ? '3-4' : '4-8'} steps SPECIFIC to this organization with real contact info"],
    "waitTimes": "string",
    "requiredDocs": ["Specific to this service"]
  }],
  "summary": "string"
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: input.query }
        ],
        response_format: { type: "json_object" },
        temperature: mode === 'fast' ? 0.2 : 0.3,
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
        message: z.string().min(1, "Message is required"),
      });
      
      const validatedData = feedbackSchema.parse(req.body);
      
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
