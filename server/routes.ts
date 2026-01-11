import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Comprehensive Alberta Mental Health & Social Services Reference Database
const ALBERTA_SERVICES_REFERENCE = `
=== ALBERTA MENTAL HEALTH & SOCIAL SERVICES REFERENCE DATABASE ===

## 24/7 CRISIS & HELPLINES
- Mental Health Help Line: 1-877-303-2642 (24/7 crisis intervention, confidential)
- 988 Suicide Crisis Helpline: Call or text 988
- Addiction Helpline: 1-866-332-2322 (24/7 confidential addiction support)
- Health Link: 811 (24/7 health advice, addiction & mental health team)
- Indigenous Support Line: 1-844-944-4744 or 811 (culturally relevant mental health)
- Hope for Wellness Helpline: 1-855-242-3310 (24/7 for all Indigenous peoples)
- Kids Help Phone: 1-800-668-6868 or text CONNECT to 686868 (ages 5-29)
- Distress Centre Calgary: 403-266-4357 (24/7)
- Distress Line Edmonton: 780-482-4357
- Access 24/7 Edmonton: 1-888-594-0211 (non-urgent advice, appointments)
- ConnecTeen Calgary: 403-264-8336 (youth crisis support)
- Virtual Opioid Dependency Program (VODP): 1-844-383-7688

## PROVINCIAL ORGANIZATIONS
- Recovery Alberta: recoveryalberta.ca, info@recoveryalberta.ca - Main provincial provider
- Alberta Health Services Addiction & Mental Health: albertahealthservices.ca/amh
- 211 Alberta: Dial 211 - Community services database 24/7
- Centre of Recovery Excellence (CoRE): recoveryexcellence.org
- Recovery Access Alberta: recoveryaccessalberta.ca - Searchable treatment directory

## YOUTH SERVICES (Ages 11-25)
- Kickstand: mykickstand.ca - Free virtual & in-person for ages 11-25, no waitlist
- CASA Mental Health: casamentalhealth.org, 780-352-1335 - Children & youth mental health Edmonton
- Emerging Adult Mental Health: Ages 16-29, Alberta Children's Hospital Calgary, 7 days/week 10am-10pm
- Northern Alberta Youth Recovery Centre: 105-bed long-term treatment (under development)

## EDMONTON SERVICES
- Access 24/7 Edmonton: 13211 Fort Rd NW, Open 7 days 8am-10pm - One-stop adult intake
- CMHA Edmonton: edmonton.cmha.ca - Mental health programs & advocacy
- Mental Health Foundation: mentalhealthfoundation.ca
- YWCA Edmonton Counselling: counselling@ywcaedm.org, Sliding scale $5-$200/session
- The Family Centre: 780-423-2831, First session free then sliding scale
- CASA Mental Health Edmonton: casamentalhealth.org - Children/youth, Indigenous programs
- Mobile Crisis Adults Edmonton: 780-342-7777
- Mobile Crisis Children Edmonton: 780-413-4733
- Pride Centre of Edmonton: pridecentreofedmonton.ca
- Poundmaker's Lodge Treatment Centres: 1-866-458-1884, St Albert - Indigenous addiction treatment

## CALGARY SERVICES
- Access Mental Health Calgary: 403-943-1500, Mon-Fri 8am-5pm - Free, no referral needed
- CMHA Calgary: cmha.calgary.ab.ca, 403-297-1402 - Community Navigator, YouthSMART (12-24), Peer Support
- Recovery College Calgary: recoverycollegecalgary.ca, 403-297-1402, recovery.college@cmha.calgary.ab.ca - FREE courses on mental health & addiction recovery, peer-led, ages 16+, no referral needed, drop-ins Wed, virtual & in-person
- Distress Centre Calgary: 403-266-4357 - 24/7 crisis, counselling, ConnecTeen
- Calgary Counselling Centre: calgarycounselling.com - Sliding scale, no waitlist
- Centre for Mental Health & Addictions: thecentres.ca - Sliding scale starting $10/session
- Calgary Foothills PCN: 587-774-9736 - Free one-session-at-a-time counselling
- Sheldon M. Chumir Centre: 24/7 urgent mental health assessment & crisis
- Calgary Dream Centre: calgarydreamcentre.ca - 7-week residential addiction recovery
- The Alex Community Health Centre: 403-266-2622, info@thealex.ca
- Wood's Homes Calgary: woodshomes.ca - Children, youth, families crisis services

## UNIVERSITY/COLLEGE CAMPUS SERVICES
- University of Alberta Counselling & Clinical Services: ualberta.ca/current-students/counselling, Free confidential counselling
- U of A First Peoples' House: Indigenous student support
- U of A The Landing: Gender & sexual diversity support
- U of A Graduate Student Assistance Program (GSAP): 780-428-7909
- University of Calgary Student Wellness Services: ucalgary.ca/wellness-services, 403-210-9355
- U of C Community Mental Health & Well-Being Strategy (CMHWS): UFlourish events
- Mount Royal University Wellness Services: mtroyal.ca/CampusServices/WellnessServices
- MRU Iniskim Centre: Indigenous student support
- MacEwan University Wellness & Psychological Services
- NAIT Student Counselling: nait.ca/student-services
- SAIT Student Development & Counselling
- Lethbridge College Counselling Services
- Red Deer Polytechnic Counselling
- NorQuest College Student Wellness
- Bow Valley College Learner Success Services

## LGBTQ2S+ SERVICES
- Camp fYrefly: fyrefly.ca - Leadership retreat ages 14-24, Edmonton (U of A)
- CHEW Project (Fyrefly Institute): Edmonton & Calgary street outreach, harm reduction
- Calgary Outlink: calgaryoutlink.ca - Support, education, Inside Out Youth Group (13-18)
- Skipping Stone: skippingstone.ca, Calgary - Trans/gender-diverse youth & adults
- Pride Centre of Edmonton: pridecentreofedmonton.ca
- Centre for Sexuality Calgary: centreforsexuality.ca
- Aura Calgary: 587-779-5015 - Housing-first for LGBTQ2S+ youth 14-24
- Rainbow Alliance for Youth Edmonton: Ages 12-24

## INDIGENOUS SERVICES
- Indigenous Support Line: 1-844-944-4744 or 811
- Hope for Wellness Help Line: 1-855-242-3310 (24/7, online chat hopeforwellness.ca)
- AHS Indigenous Mental Health Program: 403-955-6645 (Calgary intake) - Self-referral available
- CASA Indigenous Mental Health Services: Trauma-informed for Indigenous children, teens, families
- Poundmaker's Lodge Treatment Centres: 1-866-458-1884, St Albert
- Aboriginal Counseling Services Association of Alberta: 780-242-4357, aboriginalcounseling.com
- Métis Nation of Alberta Health: health@metis.org - Up to 12 therapy sessions, $225/session
- Blood Tribe Department of Health - Bringing the Spirit Home Program
- Kapown Treatment Center: 32-bed mental health & addiction
- Indigenous Services Canada Mental Wellness Unit: 780-495-4837

## ADDICTION TREATMENT & RECOVERY
- Recovery Alberta: recoveryalberta.ca - Provincial provider
- Virtual Rapid Access Addiction Medicine: 1-844-383-7688 - Same/next-day, no waitlist
- Virtual Opioid Dependency Program (VODP): 1-844-383-7688 - Same-day OAT access
- Red Deer Recovery Community (EHN Canada): Long-term residential
- Fresh Start Recovery Centre Lethbridge: 14-week residential for men
- Our House Addiction Recovery Centre
- Teen Challenge Alberta Men's Centre
- Glendon Treatment Center
- Nightwind Treatment Centre (Kihew House)
- Grace House Drumheller: Women only, 1-year program
- Renfrew Recovery Centre: Adult detoxification
- Drug Treatment Courts: Judicially supervised for non-violent offenders
- DORS App: dorsapp.ca - Digital Overdose Response System

## MENTAL HEALTH ORGANIZATIONS
- CMHA Alberta Division: alberta.cmha.ca - Buddy Up (men's mental health), Family-to-Family peer support
- Centre for Suicide Prevention: suicideinfo.ca, Calgary
- Canadian Mental Health Association Calgary: cmha.calgary.ab.ca
- Canadian Mental Health Association Edmonton: edmonton.cmha.ca
- BounceBack: bounceback.cmha.ca - Free CBT program

## SPECIALIZED SERVICES
- ARCH Psychological Services: archpsychological.com - Indigenous counselling, Jordan's Principle billing
- Counselling Alberta Partnership: Pay-what-you-can, no waitlist
- Hull Services Calgary: Children, youth, families
- Carya Calgary: Family support services
- Inglewood Opportunity Calgary
- YESS Edmonton: yess.org - Youth shelter, supportive housing ages 15-24
- HOME Central Alberta: Two-Spirit, Indigenous, Queer-led safe spaces

## HOUSING & HOMELESSNESS
- YESS Edmonton: yess.org - Youth ages 15-24
- Aura Calgary: LGBTQ2S+ youth housing 14-24
- Mustard Seed Calgary/Edmonton: Shelter, addiction support
- Calgary Dream Centre: Transitional housing

## FINANCIAL ASSISTANCE FOR THERAPY
- Jordan's Principle: For all First Nations children - Covers psychological care, counseling
- Métis Nation of Alberta: Up to 12 sessions, $225/session for MNA citizens
- Sliding scale services: Calgary Counselling Centre, The Family Centre Edmonton, Centre for Mental Health & Addictions
`;



export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Replit Auth first
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get(api.auth.me.path, async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.json(null);
    }
    const replitId = req.user.claims.sub;
    const user = await storage.upsertUser({ 
      replitId,
      email: req.user.claims.email,
      firstName: req.user.claims.first_name,
      lastName: req.user.claims.last_name,
      profileImageUrl: req.user.claims.profile_image_url
    });
    res.json(user);
  });

  app.post(api.search.query.path, async (req, res) => {
    try {
      const input = api.search.query.input.parse(req.body);
      const normalizedQuery = input.query.trim().toLowerCase();
      const cached = await storage.getSearchByQuery(normalizedQuery);
      if (cached) return res.json(cached.results);

      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          {
            role: "system",
            content: `You are helpful assistant for "Recovery on Campus Resource Hub" in Alberta.

CRITICAL REQUIREMENTS:
- Every service MUST be a REAL, SPECIFIC Alberta organization (e.g., "Alberta Health Services Addiction & Mental Health", "CMHA Edmonton", "Distress Centre Calgary")
- ONLY use URLs, phone numbers, and addresses EXACTLY as listed in the reference database below
- DO NOT invent or guess URLs - if a URL is not in the database, use the phone number instead
- Never return generic categories like "Local Counseling Services" or "Community Support Groups"
- PRIORITIZE services from the reference database below - these are verified and current

Examples of GOOD responses: "Kids Help Phone", "Access Open Minds Edmonton", "CASA Mental Health", "Centre for Suicide Prevention Calgary"
Examples of BAD responses: "Local Mental Health Clinic", "Community Addiction Services", "Campus Counseling Center"

${ALBERTA_SERVICES_REFERENCE}

PROCESS STEPS - USE ONLY VERIFIED INFO:
- Use ONLY phone numbers, emails, and URLs from the reference database above
- DO NOT invent URLs - if not in database, use phone number instead
- If unsure of exact process: "Contact [org] at [phone from database] for current intake steps"
- Each step should use real contact info from the database

PROCESS STEPS - REFLECT THE REAL INTAKE JOURNEY:
- Provide as many steps as needed (typically 3-8) to accurately reflect how someone actually accesses this service
- Simple services (crisis lines) may need only 3-4 steps; complex services (intake assessments) may need 6-8
- Use ONLY verified contact info from the reference database - NEVER invent URLs
- Include specific details: phone numbers, websites, hours, what to expect at each stage

EXAMPLE for crisis line (simple - 4 steps):
["Call 403-266-4357 - available 24/7, 365 days a year",
 "A trained crisis counselor will answer and ask how they can help",
 "Share what you're going through - calls are confidential and anonymous",
 "Receive support and referrals to Calgary-area resources if needed"]

EXAMPLE for Recovery College Calgary (moderate - 5 steps):
["Visit recoverycollegecalgary.ca or call 403-297-1402",
 "Browse free courses - topics include anxiety, stress, recovery skills",
 "No referral or account needed - FREE for anyone 16+",
 "Register online or attend Wednesday drop-in sessions",
 "Attend peer-led session (virtual or in-person)"]

EXAMPLE for clinical assessment service (complex - 7 steps):
["Call intake line during business hours to request assessment",
 "Complete phone screening to determine eligibility",
 "Receive appointment date (wait times vary)",
 "Bring required documents to first appointment",
 "Meet with clinician for initial assessment",
 "Discuss treatment options and create care plan",
 "Begin recommended services or get referrals"]

If unsure of exact details: "Contact [org] at [phone from database] to confirm current process"

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
    "process": ["4-8 steps SPECIFIC to this exact organization. Include their actual phone numbers, websites, locations, operating hours. Each step should describe what happens when accessing THIS service, not a generic category. If uncertain, include 'Contact directly to confirm current process'"],
    "waitTimes": "string (specific to this service if known, otherwise realistic estimate with note to confirm)",
    "requiredDocs": ["Specific to this service - e.g., 'Valid U of A OneCard' for campus services, 'Alberta Health Care card' for AHS services, 'Proof of income for sliding scale' for Calgary Counselling Centre"]
  }],
  "summary": "string"
}`
          },
          { role: "user", content: input.query }
        ],
        response_format: { type: "json_object" },
      });

      const results = JSON.parse(completion.choices[0].message.content!);
      await storage.createSearch({ query: normalizedQuery, results });
      res.json(results);
    } catch (err) {
      res.status(500).json({ message: "Search failed" });
    }
  });

  app.get(api.favorites.list.path, async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const user = await storage.getUserByReplitId(req.user.claims.sub);
    if (!user) return res.json([]);
    const favs = await storage.getFavorites(user.id);
    res.json(favs);
  });

  app.post(api.favorites.add.path, async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const input = api.favorites.add.input.parse(req.body);
    const user = await storage.getUserByReplitId(req.user.claims.sub);
    if (!user) return res.status(401).send();
    
    // Check for duplicate before adding
    const existingFavorites = await storage.getFavorites(user.id);
    const isDuplicate = existingFavorites.some(f => f.serviceId === input.serviceId);
    if (isDuplicate) {
      return res.status(409).json({ message: "Service already saved" });
    }
    
    const fav = await storage.addFavorite({
      userId: user.id,
      serviceId: input.serviceId,
      serviceName: input.serviceName,
      category: input.category,
      serviceDetails: input.serviceDetails || null,
      status: 'saved',
      completedSteps: []
    });
    res.status(201).json(fav);
  });

  app.patch(api.favorites.update.path, async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const user = await storage.getUserByReplitId(req.user.claims.sub);
    if (!user) return res.status(401).send();
    
    const id = parseInt(req.params.id);
    const favorite = await storage.getFavorite(id);
    if (!favorite || favorite.userId !== user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    const input = api.favorites.update.input.parse(req.body);
    const updated = await storage.updateFavorite(id, input);
    res.json(updated);
  });

  app.delete(api.favorites.delete.path, async (req: any, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const user = await storage.getUserByReplitId(req.user.claims.sub);
    if (!user) return res.status(401).send();
    
    const id = parseInt(req.params.id);
    const favorite = await storage.getFavorite(id);
    if (!favorite || favorite.userId !== user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    await storage.deleteFavorite(id);
    res.status(204).send();
  });

  // Profile endpoints
  app.get(api.profile.get.path, async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUserByReplitId(req.user.claims.sub);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    res.json(user);
  });

  app.patch(api.profile.update.path, async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await storage.getUserByReplitId(req.user.claims.sub);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    const input = api.profile.update.input.parse(req.body);
    const updated = await storage.updateUserDemographics(user.id, input);
    res.json(updated);
  });

  // Recommendations endpoint with caching for speed
  app.get(api.recommendations.get.path, async (req: any, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const user = await storage.getUserByReplitId(req.user.claims.sub);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const favorites = await storage.getFavorites(user.id);
      
      // Build profile hash for caching (based on demographics + favorite categories sorted)
      const favoriteCategories = Array.from(new Set(favorites.map(f => f.category))).sort().join(',');
      const profileData = [
        user.age || '',
        user.gender || '',
        user.race || '',
        user.sexuality || '',
        user.education || '',
        user.religion || '',
        user.inAddiction || '',
        user.university || '',
        user.location || '',
        user.customLocation || '',
        user.disability || '',
        user.serviceFormat || '',
        user.supportStyle || '',
        favoriteCategories // Include sorted categories, not just count
      ].join('|');
      const profileHash = Buffer.from(profileData).toString('base64');
      
      // Check cache first (cache expires after profile changes or new favorites)
      const cached = await storage.getCachedRecommendations(profileHash);
      if (cached) {
        return res.json(cached.results);
      }
      
      // Build compact context for faster processing
      const demographics = [];
      if (user.age) demographics.push(`age:${user.age}`);
      if (user.gender) demographics.push(`gender:${user.gender}`);
      if (user.race) demographics.push(`ethnicity:${user.race}`);
      if (user.sexuality) demographics.push(`orientation:${user.sexuality}`);
      if (user.education) demographics.push(`education:${user.education}`);
      if (user.religion) demographics.push(`faith:${user.religion}`);
      if (user.inAddiction) demographics.push(`recovery:${user.inAddiction}`);
      if (user.university) demographics.push(`school:${user.university}`);
      const userLocation = user.location === 'other' && user.customLocation 
        ? user.customLocation 
        : user.location?.replace(/-/g, ' ');
      if (userLocation) demographics.push(`location:${userLocation}`);
      if (user.disability) demographics.push(`disability:${user.disability}`);
      if (user.serviceFormat) demographics.push(`format:${user.serviceFormat}`);
      if (user.supportStyle) demographics.push(`style:${user.supportStyle}`);
      
      const favCategoriesList = favoriteCategories ? favoriteCategories.split(',').slice(0, 3) : [];
      
      // Streamlined prompt for faster response - maintains quality requirements
      const prompt = `Recovery on Campus Resource Hub - Alberta personalized recommendations.

CRITICAL REQUIREMENTS:
- Every service MUST be a REAL, SPECIFIC Alberta organization (e.g., "CMHA Edmonton", "Distress Centre Calgary", "U of A Counselling")
- NEVER return generic categories like "Local Mental Health Clinic" - always name the actual organization
- ONLY use URLs, phone numbers, and addresses that are EXACTLY as listed in the reference database below
- DO NOT invent or guess URLs - if a URL is not in the database, use the phone number instead
- Prioritize services from the reference database below - these are verified and current

${ALBERTA_SERVICES_REFERENCE}

USER PROFILE: ${demographics.length > 0 ? demographics.join(', ') : 'No profile - give general recommendations'}
${favCategoriesList.length > 0 ? `Favorite categories: ${favCategoriesList.join(', ')}` : ''}
${user.university && user.university !== 'not-in-university' && user.university !== 'in-highschool' ? `Campus: ${user.university.replace(/-/g, ' ')} - prioritize on-campus/nearby services` : ''}
${user.university === 'in-highschool' ? 'User is a high school student - prioritize youth services and resources appropriate for under-18' : ''}
${userLocation && userLocation !== 'prefer not to say' ? `Location: ${userLocation}, Alberta - prioritize services in or near this city` : ''}

PERSONALIZATION:
- Match services to user identity (LGBTQ2S+, Indigenous, age-appropriate, faith-based if relevant)
- Respect format preference (virtual/in-person) and support style (one-on-one/group)
- Include campus services if university specified
- Consider disability accommodations if indicated
- Suggest similar services to favorites but in unexplored categories
- PRIORITIZE services geographically close to user's location when specified

PROCESS STEPS - REFLECT THE REAL INTAKE JOURNEY:
- Provide as many steps as needed (typically 3-8) to accurately reflect how someone actually accesses this service
- Simple services (crisis lines) may need only 3-4 steps; complex services (intake assessments) may need 6-8
- Use ONLY verified contact info from the reference database - NEVER invent URLs
- Include specific details: phone numbers, websites, hours, what to expect at each stage

EXAMPLE for crisis line (simple - 4 steps):
["Call 403-266-4357 - available 24/7",
 "Speak with trained crisis counselor",
 "Receive confidential support",
 "Get referrals if needed"]

EXAMPLE for Recovery College (moderate - 5 steps):
["Visit recoverycollegecalgary.ca or call 403-297-1402",
 "Browse free courses on mental health and recovery",
 "No referral or account needed - FREE for 16+",
 "Register online or attend Wednesday drop-ins",
 "Attend peer-led session (virtual or in-person)"]

If unsure of exact details: "Contact [org] at [phone from database] to confirm current process"

Return JSON:
{"recommendations":[{"id":"unique","name":"Real Org Name","category":"Category","description":"Brief","reasoning":"Why recommended for this user","location":"Real address","contact":"Real phone/website","eligibility":"Who qualifies","process":["Step with real contact info","Step 2","Step 3","Step 4"],"waitTimes":"Realistic estimate","requiredDocs":["Required doc"]}],"summary":"Personalized summary"}

Recommend exactly 5 services.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Provide personalized recommendations." }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3, // Lower temperature for faster, more consistent responses
      });

      const results = JSON.parse(completion.choices[0].message.content!);
      
      // Cache the results for this profile
      await storage.cacheRecommendations(profileHash, results);
      
      res.json(results);
    } catch (err) {
      console.error("Recommendations error:", err);
      res.status(500).json({ message: "Failed to get recommendations" });
    }
  });

  // Feedback endpoint
  app.post("/api/feedback", async (req, res) => {
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
