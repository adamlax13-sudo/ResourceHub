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
- CMHA Calgary: cmha.calgary.ab.ca - Community Navigator, YouthSMART (12-24), Recovery College
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

CRITICAL REQUIREMENT: Every service you return MUST be a REAL, SPECIFIC organization, program, or service that actually exists in Alberta, Canada. 
- Include the actual organization name (e.g., "Alberta Health Services Addiction & Mental Health", "CMHA Edmonton", "Distress Centre Calgary")
- Provide real phone numbers, websites, and addresses when available
- Never return generic categories like "Local Counseling Services" or "Community Support Groups" - always name the specific organization
- If you're unsure about exact contact details, provide the organization's main website or general intake number
- Prefer well-established organizations with verifiable online presence
- PRIORITIZE services from the reference database below - these are verified real Alberta services

Examples of GOOD responses: "Kids Help Phone", "Access Open Minds Edmonton", "CASA Mental Health", "Centre for Suicide Prevention Calgary"
Examples of BAD responses: "Local Mental Health Clinic", "Community Addiction Services", "Campus Counseling Center"

${ALBERTA_SERVICES_REFERENCE}

SERVICE-SPECIFIC PROCESS STEPS REQUIREMENT:
Each service MUST have process steps that are UNIQUE and SPECIFIC to that exact organization. DO NOT use generic templates.

For each service, research and provide the ACTUAL intake process based on:
1. That organization's specific intake method (phone, online form, walk-in, referral required, etc.)
2. Their actual contact numbers, websites, and booking systems
3. What actually happens when someone contacts that specific service
4. Any unique requirements or steps specific to that program
5. Real operating hours, locations, and service-specific procedures

EXAMPLES OF SERVICE-SPECIFIC PROCESS STEPS:

For "Distress Centre Calgary":
- "Call 403-266-4357 (available 24/7, 365 days)"
- "A trained volunteer crisis counselor will answer and ask how they can help"
- "Share what you're going through - calls are confidential and anonymous"
- "Receive emotional support, crisis intervention, and coping strategies"
- "Get referrals to Calgary-area resources if ongoing support is needed"

For "Access 24/7 Edmonton":
- "Visit 13211 Fort Road NW, Edmonton (open 7 days, 8am-10pm) or call 780-424-2424"
- "Check in at reception - no appointment needed for walk-ins"
- "Complete intake paperwork and consent forms"
- "Meet with an intake clinician for assessment (typically 30-60 minutes)"
- "Receive same-day connection to addiction or mental health services"
- "Get referrals to ongoing community programs based on your needs"

For "University of Alberta Counselling & Clinical Services":
- "Book online at ualberta.ca/current-students/counselling or call 780-492-5205"
- "Complete the online intake questionnaire before your first appointment"
- "Attend your initial assessment session at SUB or another campus location"
- "Work with the counselor to identify your goals and appropriate services"
- "Begin individual counselling, group therapy, or workshops based on your needs"
- "Sessions are free for current U of A students with valid OneCard"

For "Calgary Counselling Centre":
- "Call 403-691-5991 or book online at calgarycounselling.com"
- "Complete intake forms and discuss your financial situation for sliding scale fee"
- "Attend your first session at their downtown Calgary office"
- "Work with your assigned counselor on your presenting concerns"
- "Continue with ongoing sessions at your agreed fee ($0-$150+ based on income)"

If you don't know the exact process for a specific organization, include:
- "Contact [organization] directly at [phone/website] to confirm current intake process"
- Use general steps but acknowledge: "Process may vary - contact for current procedures"

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

  // Recommendations endpoint
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
      
      // Build context for recommendations
      const demographicContext = [];
      if (user.age) demographicContext.push(`Age: ${user.age}`);
      if (user.gender) demographicContext.push(`Gender: ${user.gender}`);
      if (user.race) demographicContext.push(`Race/Ethnicity: ${user.race}`);
      if (user.sexuality) demographicContext.push(`Sexual Orientation: ${user.sexuality}`);
      if (user.education) demographicContext.push(`Education Level: ${user.education}`);
      if (user.religion) demographicContext.push(`Religion/Spirituality: ${user.religion}`);
      if (user.inAddiction) demographicContext.push(`Recovery Status: ${user.inAddiction}`);
      if (user.university) demographicContext.push(`University/College: ${user.university}`);
      if (user.disability) demographicContext.push(`Disability Status: ${user.disability}`);
      if (user.serviceFormat) demographicContext.push(`Service Format Preference: ${user.serviceFormat}`);
      if (user.supportStyle) demographicContext.push(`Support Style Preference: ${user.supportStyle}`);
      
      const favoriteCategories = Array.from(new Set(favorites.map(f => f.category)));
      const favoriteNames = favorites.slice(0, 5).map(f => f.serviceName);
      
      // Build location context for more specific recommendations
      const locationContext = user.university ? `
LOCATION-SPECIFIC GUIDANCE:
The user attends ${user.university.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}. 
Prioritize recommending:
1. On-campus services directly at their institution (counseling centers, student wellness, campus health services)
2. Services specifically partnered with or located near their campus
3. Student-specific resources available in their city (Edmonton for U of A, NAIT, MacEwan, NorQuest; Calgary for U of C, SAIT, Mount Royal, Bow Valley; Lethbridge for U of L and Lethbridge College, etc.)
4. Provincial services with locations accessible from their campus

Include the specific campus location or nearest service location in the "location" field when possible.
` : '';

      const prompt = `You are a helpful assistant for "Recovery on Campus Resource Hub" in Alberta, Canada.
      
Based on the user's profile and preferences, recommend 5-7 relevant recovery and support services.

CRITICAL REQUIREMENT: Every service you recommend MUST be a REAL, SPECIFIC organization, program, or service that actually exists in Alberta, Canada.
- Include the actual organization name (e.g., "Alberta Health Services Addiction & Mental Health", "CMHA Edmonton", "Distress Centre Calgary", "University of Alberta Counselling & Clinical Services")
- Provide real phone numbers, websites, and addresses when available
- Never return generic categories like "Local Counseling Services" or "Community Support Groups" - always name the specific organization
- If you're unsure about exact contact details, provide the organization's main website or general intake number
- Prefer well-established organizations with verifiable online presence
- For campus services, use the actual name (e.g., "U of A Wellness Services" not "Campus Mental Health")
- PRIORITIZE services from the reference database below - these are verified real Alberta services

Examples of GOOD responses: "Kids Help Phone", "Access Open Minds Edmonton", "CASA Mental Health", "Centre for Suicide Prevention Calgary", "University of Calgary Student Wellness Services"
Examples of BAD responses: "Local Mental Health Clinic", "Community Addiction Services", "Campus Counseling Center", "Student Health Services"

${ALBERTA_SERVICES_REFERENCE}

SERVICE-SPECIFIC PROCESS STEPS REQUIREMENT:
Each service MUST have process steps that are UNIQUE and SPECIFIC to that exact organization. DO NOT use generic templates.

For each service, research and provide the ACTUAL intake process based on:
1. That organization's specific intake method (phone, online form, walk-in, referral required, etc.)
2. Their actual contact numbers, websites, and booking systems
3. What actually happens when someone contacts that specific service
4. Any unique requirements or steps specific to that program
5. Real operating hours, locations, and service-specific procedures

EXAMPLES OF SERVICE-SPECIFIC PROCESS STEPS:

For "Distress Centre Calgary":
- "Call 403-266-4357 (available 24/7, 365 days)"
- "A trained volunteer crisis counselor will answer and ask how they can help"
- "Share what you're going through - calls are confidential and anonymous"
- "Receive emotional support, crisis intervention, and coping strategies"
- "Get referrals to Calgary-area resources if ongoing support is needed"

For "Kickstand":
- "Visit mykickstand.ca and click 'Book an Appointment'"
- "Select your preferred location or choose virtual/online"
- "No referral needed - anyone ages 11-25 can self-refer"
- "Attend your first drop-in or scheduled appointment"
- "Meet with a youth counselor, peer support worker, or health professional"
- "Access integrated services including mental health, physical health, and peer support"

For "CASA Mental Health":
- "Call 780-352-1335 to request services"
- "Complete phone intake and screening process"
- "Provide relevant background information about your child/youth"
- "Attend initial assessment at CASA Edmonton location"
- "Receive a treatment plan tailored to your child's needs"
- "Begin therapy, group programs, or specialized services as recommended"

For "Skipping Stone (Calgary)":
- "Visit skippingstone.ca or call to inquire about services"
- "Complete intake form describing your needs"
- "Specify if seeking support for yourself, your child, or family"
- "Attend initial consultation to discuss affirming care options"
- "Access trans-affirming counselling, support groups, or healthcare navigation"

If you don't know the exact process for a specific organization, include:
- "Contact [organization] directly at [phone/website] to confirm current intake process"
- Use realistic steps but acknowledge: "Process may vary - contact for current procedures"

${demographicContext.length > 0 ? `User Demographics (use to personalize recommendations):
${demographicContext.join('\n')}` : 'No demographic information provided - give general recommendations.'}

${favoriteCategories.length > 0 ? `User's favorite service categories: ${favoriteCategories.join(', ')}` : 'No favorites yet.'}
${favoriteNames.length > 0 ? `Services they've saved: ${favoriteNames.join(', ')}` : ''}
${locationContext}
IMPORTANT: Consider services that would be especially relevant or welcoming for this user's identity and needs.
For example:
- LGBTQ2S+ resources if relevant to sexuality/gender
- Culturally-specific services if relevant to race/ethnicity  
- Age-appropriate services
- Student-specific resources if relevant to education level
- Faith-based or spiritual support if relevant to religion
- Addiction recovery and harm reduction services if user indicates recovery status
- Campus-specific services and nearby community resources if user indicated their university/college
- Accessible services and disability accommodations if user indicates a disability (prioritize services with accessibility features, accommodation support, assistive technology, accessible locations, disability support offices)
- Similar services to their favorites but in different categories they haven't explored

SERVICE DELIVERY PREFERENCES (prioritize but don't exclude based on these):
- If user prefers virtual/online services, prioritize telehealth, online counseling, virtual support groups, chat/text services
- If user prefers in-person services, prioritize walk-in clinics, on-campus counseling, in-person support groups
- If user prefers one-on-one support, prioritize individual counseling, mentorship programs, case management
- If user prefers group/peer support, prioritize support groups, peer networks, group therapy, community programs
These are preferences only - still include a mix of options, but rank preferred formats higher in the list.

Return JSON matching:
{
  "recommendations": [{
    "id": "string (unique id)",
    "name": "string (MUST be the real organization/program name - not a generic category)",
    "category": "string (e.g., Mental Health, Financial Aid, Housing, LGBTQ2S+ Support, Cultural Services)",
    "description": "string (brief description)",
    "reasoning": "string (why this is recommended for this user)",
    "location": "string (real address or service area)",
    "contact": "string (real phone/email/website)", 
    "eligibility": "string",
    "process": ["4-8 steps SPECIFIC to this exact organization. Include their actual phone numbers, websites, locations, operating hours. Each step should describe what happens when accessing THIS service. If uncertain about exact process, include 'Contact directly at [phone/website] to confirm current intake process'"],
    "waitTimes": "string (specific to this service if known, otherwise provide realistic estimate and note to confirm with organization)",
    "requiredDocs": ["Specific to this service - what THIS organization actually requires for intake"]
  }],
  "summary": "string (personalized summary explaining these recommendations)"
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Please provide personalized service recommendations." }
        ],
        response_format: { type: "json_object" },
      });

      const results = JSON.parse(completion.choices[0].message.content!);
      res.json(results);
    } catch (err) {
      console.error("Recommendations error:", err);
      res.status(500).json({ message: "Failed to get recommendations" });
    }
  });

  return httpServer;
}
