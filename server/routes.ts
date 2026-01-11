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

## IMPORTANT NUMBERS & 24/7 CRISIS LINES
- 211 Alberta: Dial 211, ab.211.ca - 24/7 info on housing, food, mental health with language support
- 311 Calgary: Dial 311 - City services info with translation
- 811 Health Link: Dial 811 - 24/7 health advice from nurses
- 911: For emergencies or crimes in progress
- 988 Suicide Crisis Helpline: Call or text 988, 988.ca - 24/7 national suicide prevention
- Mental Health Help Line: 1-877-303-2642 (24/7 crisis intervention, confidential)
- Addiction Helpline: 1-866-332-2322 (24/7 confidential addiction support)
- Distress Centre Calgary: 403-266-4357, distresscentre.com - 24/7 phone, text, in-person crisis counselling
- Distress Line Edmonton: 780-482-HELP (4357) - 24/7 crisis support
- ConnecTeen Calgary: 403-264-8336, text 587-333-2724, calgaryconnecteen.com - Youth peer support
- Kids Help Phone: 1-800-668-6868, text CONNECT to 686868, kidshelpphone.ca - 24/7 for youth
- Hope for Wellness Helpline: 1-855-242-3310, hopeforwellness.ca - 24/7 Indigenous support in Cree, Ojibway, Inuktitut, English, French
- Indigenous Support Line (AHS): 1-844-944-4744 - Mon-Fri 10am-6pm culturally safe support
- Talk Suicide Canada: 1-833-456-4566, talksuicide.ca - 24/7 crisis support
- Family Violence Info Line: 310-1818 - 24/7 in 170+ languages
- Domestic Violence Hotline Calgary: 403-234-7233 (SAFE), fearisnotlove.ca - 24/7 counselling, shelter intake
- Elder Abuse Resource Team: 403-705-3250 - Confidential reporting
- Emergency Financial Assistance: 1-877-644-9992, alberta.ca/emergency-financial-assistance
- Calgary Police Non-Emergency: 403-266-1234
- Access 24/7 Edmonton: 780-424-2424 - Adult intake services
- Virtual Opioid Dependency Program: 1-844-383-7688 - Same-day OAT access
- ECMHS Crisis Counselling Line: 403-299-9699 - Multilingual family & youth crisis Calgary
- Protection for Persons in Care: 1-888-357-9339

## CALGARY MENTAL HEALTH URGENT CARE CENTRES
- Sheldon M. Chumir Health Centre: 1213 4 St SW, Calgary - 24/7 walk-in mental health all ages
- South Calgary Health Centre: 31 Sunpark Plaza SE - Daily 12-8:15pm, walk-in assessments
- Airdrie Mental Health Urgent Care: 604 Main St S - Mon-Fri 2:30-9pm, Weekends 10am-5pm
- Banff Mental Health Urgent Care: 305 Lynx St - Daily 2-9pm
- Canmore Urgent Mental Health: 1100 Hospital Pl - Daily 2-9pm
- Cochrane Mental Health Urgent Care: 60 Grand Blvd - Mon-Fri 12-7pm, Weekends 10am-5pm
- Okotoks Mental Health Urgent Care: 11 Cimarron Common - Daily 10am-6pm

## CALGARY MENTAL HEALTH & ADDICTION SERVICES
- Access Mental Health Calgary: 403-943-1500 - Free, no referral needed, Mon-Fri 8am-5pm
- CMHA Calgary: cmha.calgary.ab.ca, 403-297-1402 - Mental health education, support, advocacy
- Recovery College Calgary (CMHA): recoverycollegecalgary.ca, 403-297-1402 - FREE courses on mental health & recovery, peer-led, ages 16+, no referral, drop-ins Wed
- Calgary Counselling Centre: 403-265-4980, calgarycounselling.com - Sliding scale, no waitlist
- Rapid Access Addiction Medicine (RAAM): 707 10 Ave SW - Walk-in urgent addiction care
- AHS Opioid Dependency Program: 1213 4 St SW, 403-955-3600 - OAT, counselling, harm reduction
- Renfrew Recovery Centre (Adult Detox): 1611 Remington Rd NE, 403-297-3337 - 24/7 supervised detox
- Calgary Dream Centre: calgarydreamcentre.com - 7-week residential addiction recovery, Indigenous stream
- Calgary Drop-In Centre: 1 Dermot Baldwin Way SE, 403-263-5707, calgarydropin.ca - Withdrawal management, meals
- The Alex Community Health Centre: 4920 17 Ave SE, 403-266-2622 - Drop-in peer advocacy, food centre
- Wood's Homes Calgary: woodshomes.ca - Children, youth, families crisis services
- Eastside Community Mental Health (Woods Homes): #255, 495 36 St NE - Walk-in Tue 11-7, Thu 11-6, Sat 11-5
- The Summit (Sinneave Centre): 403-955-5437, albertahealthservices.ca/summit - Youth walk-in mental health
- Hull Services Bridging the Gap: 403-216-0660, text 403-216-0663 - Ages 16-24 mental health
- YouthSMART: youthsmart.ca - Mental health education, stigma reduction
- Community Connect YYC: communityconnectyyc.ca - Affordable barrier-free counselling, interpreters

## CALGARY LOW-COST/SLIDING SCALE COUNSELLING
- Calgary Counselling Centre: 403-265-4980, calgarycounselling.com - Income-based sliding scale, no waitlist
- Affordable Therapy Network: affordabletherapynetwork.com - Low-cost therapist connections
- Virtuous Circle Counselling: vccounselling.com - Limited sliding scale spots
- Jade Counselling Services: jadecounsellingservices.com - $20-$50/session, no proof of income required
- Community Connect YYC: communityconnectyyc.ca - Phone, online, or in-person, barrier-free
- The Mustard Seed Counselling: 587-393-4020, theseed.ca/cicmarlborough - Free for adults

## INDIGENOUS SERVICES - CALGARY
- Sunrise Healing Lodge Society: 403-261-7921, nass.ca - Gender-inclusive addiction recovery, cultural healing
- Miskanawah: 403-247-5003, miskanawah.ca/services - Cultural support, recovery circles, youth, Elders, ceremonies
- Aboriginal Friendship Centre of Calgary (AFCC): 403-270-7379, 101-427 51 Ave SE, afccalgary.org - Referrals, Elders, youth wellness
- Niitoiyis Family Support Society: 403-531-1972/1976 (24hr), niitoiyis.com - Crisis lines, housing, family addiction services
- Calgary Indigenous Sharing Network: cisn.ca/calgary - Peer support, healing circles
- Walking Eagle / New Beginnings (Indigenous AA): calgaryaa.org
- Native Network Family Centre: 19 Erin Woods Dr SE, 403-240-4642 ext 303 - Indigenous/Métis family advocacy
- AHS Indigenous Mental Health Program: 403-955-6645 - Self-referral available
- NNADAP Referral: 1-780-495-2345

## INDIGENOUS SERVICES - PROVINCIAL
- Hope for Wellness Helpline: 1-855-242-3310, hopeforwellness.ca - 24/7 in Cree, Ojibway, Inuktitut, English, French
- Indigenous Support Line (AHS): 1-844-944-4744 - Mon-Fri 10am-6pm
- Poundmaker's Lodge Treatment Centres: 780-458-1884 or 1-866-458-1884, St Albert - 18+ culturally grounded addiction treatment, detox
- Iikaisskini Indigenous Services Lethbridge: ulethbridge.ca/indigenous - Land-based healing, Elder access
- Wellbriety Program Red Deer (Safe Harbour): safeharboursociety.org - Medicine wheel-based recovery
- Aboriginal Counseling Services Association: 780-242-4357, aboriginalcounseling.com
- Métis Nation of Alberta Health: health@metis.org - Up to 12 sessions, $225/session
- Jordan's Principle: For First Nations children - Covers psychological care

## EDMONTON SERVICES
- Access 24/7 Edmonton: 13211 Fort Rd NW, 780-424-2424 - Open 7 days 8am-10pm, one-stop adult intake
- CMHA Edmonton: edmonton.cmha.ca - Mental health programs, housing, peer support
- Mobile Crisis Adults Edmonton: 780-342-7777
- Mobile Crisis Children Edmonton: 780-413-4733
- George Spady Society Detox: 780-424-8335 - Medically supported detox 18+
- Boyle Street Community Services: 780-424-4106 - Harm reduction, wraparound addiction support
- Managed Alcohol Program: 780-990-5912 - For those experiencing homelessness
- Hope Mission Edmonton: 780-422-2018 - Faith-based residential recovery, emergency shelter
- Breakout Recovery Community: 780-422-2018 x312 - Men 18-60
- Wellspring Recovery Community: 780-422-2018 x203 - Women 18+
- Jellinek Society: 780-488-1160 - Men 18+ alcoholism recovery
- McDougall House: 780-426-1409 - Women 18+ residential treatment
- Our House Edmonton: 780-474-8945 - Long-term men 18+ addiction treatment
- Recovery Acres Society: 780-471-2996 - Men 16+ substance use recovery
- Urban Manor Housing Society: 780-425-5901 - Supportive housing for hard-to-house men
- YWCA Edmonton Counselling: counselling@ywcaedm.org - Sliding scale $5-$200/session
- The Family Centre: 780-423-2831 - First session free then sliding scale
- Pride Centre of Edmonton: pridecentreofedmonton.ca
- CASA Mental Health Edmonton: casamentalhealth.org - Children/youth, Indigenous programs
- YESS: yess.org - Youth shelter, ages 15-24

## PEER-BASED RECOVERY SUPPORT
- UCalgary Recovery Community (UCRC): ucalgary.ca/safer-substance-use/ucrc - Inclusive peer-driven space
- Alcoholics Anonymous Calgary: calgaryaa.org - 12-step meetings
- Alcoholics Anonymous Alberta: 780-424-5900
- Narcotics Anonymous Calgary: calgaryna.org
- Narcotics Anonymous Edmonton: 780-421-4429
- SMART Recovery Calgary: smartrecoverycalgary.com - Science-based mutual support
- SMART Recovery Alberta: smartrecoveryalberta.org
- Crystal Meth Anonymous: 1-855-638-4373
- Cocaine Anonymous: ca.org
- Al-Anon Family Groups Edmonton (24/7): 780-443-6000
- Gamblers Anonymous Edmonton: 780-463-0892
- Problem Gambling Resources Network: 780-461-1259
- Sex Addicts Anonymous: 780-394-3709
- Overeaters Anonymous: oa-southernalberta.com
- Food Addicts in Recovery: foodaddicts.org
- Anorexics and Bulimics Anonymous: aba12steps.org
- Clean Scene (Youth 14-29): 780-488-0036
- Alano Club 12-Step Meetings: 780-423-1807
- Parents Empowering Parents (PEP): 780-293-0737

## UNIVERSITY/COLLEGE CAMPUS SERVICES
- University of Calgary Wellness Services: 403-210-9355, ucalgary.ca/wellness-services - Counselling, psychiatry
- UCalgary Writing Symbols Lodge: ucalgary.ca/student-services/writing-symbols - Indigenous academic/cultural support, Elders
- UCalgary Women's Centre Resource Database: ucalgary.ca/student-services/womens-centre/resources
- University of Alberta Counselling: ualberta.ca/current-students/counselling - Free confidential counselling
- U of A First Peoples' House: Indigenous student support
- U of A The Landing: Gender & sexual diversity support
- Mount Royal University Wellness: mtroyal.ca/CampusServices/WellnessServices
- MRU Iniskim Centre: Indigenous student support
- MacEwan University Wellness & Psychological Services
- NAIT Student Counselling: nait.ca/student-services
- SAIT Student Development & Counselling
- Lethbridge College Counselling
- Red Deer Polytechnic Counselling
- NorQuest College Student Wellness
- Bow Valley College Learner Success

## LGBTQ2S+ SERVICES
- Camp fYrefly: fyrefly.ca - Leadership retreat ages 14-24
- Calgary Outlink: calgaryoutlink.ca - Support, Inside Out Youth Group (13-18)
- Skipping Stone: skippingstone.ca - Trans/gender-diverse youth & adults Calgary
- Centre for Sexuality Calgary: centreforsexuality.ca
- Aura Calgary: 587-779-5015 - LGBTQ2S+ youth housing 14-24
- Pride Centre of Edmonton: pridecentreofedmonton.ca
- Rainbow Alliance for Youth Edmonton: Ages 12-24
- HOME Central Alberta: Two-Spirit, Indigenous, Queer-led safe spaces

## DOMESTIC VIOLENCE & SEXUAL ASSAULT
- Domestic Violence Hotline Calgary: 403-234-7233 (SAFE), fearisnotlove.ca - 24/7 counselling, shelter intake
- Family Violence Info Line: 310-1818 - 24/7 in 170+ languages
- Calgary Communities Against Sexual Abuse (CCASA): 403-237-5888, calgarycasa.com
- Escaping Abuse Benefit: alberta.ca/family-violence-costs-leave - Emergency funds
- Ruth House Society: 587-352-9422, ruthshouse.ca - African-descent support, shelter for women/children/men
- Domestic Conflict/Elder Abuse: 403-428-8339

## BABY & PARENTING RESOURCES
- Calgary Pregnancy Care Centre: 403-269-3110, pregcare.com - Referrals, free baby/maternity clothing
- Best Beginning Program: 403-228-8221, birthandbabies.com - Pregnant teens/low-income, food, transport
- Calgary Food Bank (Baby Items): 403-253-2055, calgaryfoodbank.com - Formula, hygiene, request in advance
- Made by Momma: madebymomma.org - Mothers with young children in crisis, meals, essentials
- Rise Calgary Healthy Babies: 3303 17 Ave SE, 403-204-8280 - Monthly support for infants under 1
- Salvation Army (Infant Essentials): 100, 5115 17 Ave SE
- WINS Community Resource Hubs: 825-540-4717 - Baby items, hygiene

## FREE FOOD RESOURCES - CALGARY
- Calgary Food Bank: 5000 11 St SE, 403-253-2055, calgaryfoodbank.com - 7-day hampers, delivery available
- The Alex Community Food Centre: 4920 17 Ave SE, 403-455-5792, thealexcfc.ca - Drop-in meals, garden, low-cost market
- Centre for the City Well Café: 3900 2 St NE, 403-293-3900 - Hot meals Mon/Wed, Food Bank depot
- Calgary Drop-In Centre: 1 Dermot Baldwin Way SE, 403-263-5707 - Daily breakfast, lunch, supper
- Muslim Families Network (Halal): 3961 52 Ave NE, 403-466-6367 - Halal hampers by appointment
- Salvation Army: 5115 17 Ave SE, 403-410-1160 - Monthly 2-day hampers, ID required
- Rise Calgary: 3303 17 Ave SE, 403-204-8280 - Food/furniture referrals, drop-in Wed-Fri
- Kerby Centre Thrive (50+): 1133 7 Ave SW, 403-705-3222 - Free food for older adults, delivery
- Jewish Family Service: 403-287-3510, jfsc.org - Kosher & regular hampers by appointment
- Robert McClure United Church: 5510 26 Ave NE, 403-280-9500 - Thursday pantry
- Fish Creek United Church: 77 Deerpoint Rd SE, 403-278-8263 - Pantry Mon-Thu, bread Thu
- Eastside Victory Outreach: 1840 38 St SE, 403-273-1050 - Hampers + hot lunch Tue/Thu
- Ogden Victory Outreach: 7012 Ogden Rd SE, 403-273-1050 - Hampers + hot lunch Fri
- St. Mary's Feed the Hungry: 221 18 Ave SW, 403-218-5532 - Free Sunday lunch
- Abundant Life Church: 3343 49 St SW, 403-246-1804 - Hampers west of 14 St, Thu by appointment

## BASIC NEEDS & COMMUNITY RESOURCES - CALGARY
- Fair Entry Calgary: 800 Macleod Trail SE or Village Square Library - Subsidized programs, call 311
- Income Support Alberta: 1-877-644-9992, applyincomesupport.alberta.ca
- Jewish Family Services: 6131 6 St SE, 403-287-3510, jfsc.org - Housing, ESL, seniors, resettlement
- The Mustard Seed Marlborough: #24, 6060 Memorial Dr NE, 1-833-448-4673 - Referrals, food, counselling, jobs
- Rise Calgary Forest Lawn: 3303 17 Ave SE, 403-204-8280 - Emergency food/clothing, tax help, housing
- Rise Project: #16, 2221 41 Ave NE, 403-680-1943 - Food, clothing, parenting, addiction, newcomers
- Salvation Army East: 100, 5115 17 Ave SE, 403-410-1160 - Food, literacy, infant items
- WINS Community Hubs: Dover 3525 26 Ave SE, Erin Woods 701 Erin Woods Lane SE, 825-540-4717 - Support groups, youth, parenting
- West Dover Patch: 3203 31A Ave SE, 403-273-3984 - Jobs, basic needs, financial coaching
- Soap and Suds (Free Showers): Ernie Star Arena 4808 14 Ave SE - Tue 10am-12pm

## CLOTHING RESOURCES - CALGARY
- Hope Mission Church: 4869 Hubalta Rd SE, 403-474-3237 - Appointment-based low-cost clothing
- SE Calgary Community Resource Centre: 2734 76 Ave SE, 403-720-3322 - Walk-in clothing room (2 bags)
- Rise Calgary Clothing Room: 403-204-8280 - By appointment
- WINS Hubs "House to Home": 825-540-4717 - Clothing, furniture, household items

## DETOXIFICATION PROGRAMS
- Renfrew Recovery Centre Calgary: 1611 Remington Rd NE, 403-297-3337, 1-866-332-2322 - 24/7 adult detox
- AHS Adult Detox (17+): 780-342-5900
- George Spady Society Edmonton: 780-424-8335 - Medically supported 18+
- Poundmaker's Lodge Detox: 780-458-1884 - 18+

## RESIDENTIAL TREATMENT PROGRAMS
- Lander Treatment Centre (AHS): 221 Fairway Dr, Claresholm, 403-625-5600 - 48-bed short-term intensive
- Calgary Dream Centre: calgarydreamcentre.com - 7-week residential, Indigenous stream
- Oxford House Foundation: 587-598-6977 - Recovery housing post-treatment
- Fresh Start Recovery Lethbridge: 14-week residential for men
- Grace House Drumheller: Women only, 1-year program
- Last Door Recovery Society: lastdoor.org/addiction-treatment/adult-program - Gender-specific programs

## YOUTH SERVICES
- Kids Help Phone: 1-800-668-6868, text CONNECT to 686868 - 24/7
- ConnecTeen: 403-264-8336, text 587-333-2724 - Youth peer support
- The Summit (Sinneave Centre): 403-955-5437 - Walk-in mental health children/youth
- Hull Services Bridging the Gap: 403-216-0660 - Ages 16-24
- YouthSMART: youthsmart.ca - Mental health education
- Youth Substance Use Clinic Calgary: 1005 17 St NW, 403-297-4664 - Ages 12-17
- Kickstand: mykickstand.ca - Free virtual/in-person ages 11-25, no waitlist
- CASA Mental Health: casamentalhealth.org - Children & youth
- Clean Scene Edmonton: 780-488-0036 - Ages 14-29

## EATING DISORDERS
- Eating Disorder Support Network of Alberta: 780-729-3376
- Anorexics and Bulimics Anonymous: aba12steps.org
- AHS Access Mental Health: 403-943-1500 or 780-424-2424

## GAMBLING SUPPORT
- Alberta Gamblers Anonymous: 780-463-0892
- Problem Gambling Resources Network: 780-461-1259
- AHS QuitCore: 1-866-710-QUIT (7848)

## SUPPORT FOR FAMILY MEMBERS AFFECTED BY ADDICTION
- Al-Anon Family Groups Edmonton: 780-443-6000 (24/7)
- Parents Empowering Parents (PEP): 780-293-0737
- Bissell Centre FASD Services: 780-423-2285 x157
- Catholic Social Services FASD: 780-975-4896
- FASD Alberta Resource Hub: fasd.typepad.com

## HARM REDUCTION
- Digital Overdose Response System (DORS): dorsapp.ca - App to prevent fatal overdoses
- Boyle Street Community Services Edmonton: 780-424-4106
- Virtual Opioid Dependency Program: 1-844-383-7688

## OTHER PROVINCIAL SERVICES
- Find a Doctor Alberta: albertafindadoctor.ca
- Service Canada Calgary: 5401 Temple Dr NE Suite 116 - SIN, EI, grants
- BounceBack: bounceback.cmha.ca - Free CBT program
- Recovery Alberta: recoveryalberta.ca - Provincial addiction provider
- 211 Alberta: Dial 211 - Community services 24/7
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
- IMPORTANT: Different services have DIFFERENT numbers of steps - vary based on actual complexity
- Simple services (crisis lines, drop-ins) = 3-4 steps
- Moderate services (counselling intake, peer support) = 4-6 steps  
- Complex services (residential treatment, formal assessments) = 6-8 steps
- Use ONLY verified contact info from the reference database - NEVER invent URLs
- Include specific details: phone numbers, websites, hours, what to expect at each stage

EXAMPLE crisis line (3 steps):
["Call 403-266-4357 - available 24/7", "Speak with trained counselor", "Get referrals if needed"]

EXAMPLE peer support drop-in (4 steps):
["Visit recoverycollegecalgary.ca or call 403-297-1402", "Browse free courses", "No referral needed - FREE for 16+", "Attend peer-led session"]

EXAMPLE university counselling (6 steps):
["Visit campus counselling website", "Complete online intake form", "Wait for email confirmation (1-3 days)", "Book initial phone screening", "Attend assessment appointment", "Begin regular counselling sessions"]

EXAMPLE residential treatment (8 steps):
["Call 1-866-332-2322 Addiction Helpline for referral", "Complete phone screening assessment", "Gather required documents (ID, health card)", "Attend in-person intake interview", "Wait for bed availability (may be 1-4 weeks)", "Complete medical assessment on arrival", "Participate in orientation program", "Begin structured treatment program"]

If unsure: "Contact [org] at [phone from database] to confirm current process"

Return JSON (note: process array length varies by service complexity):
{"recommendations":[{"id":"unique","name":"Real Org Name","category":"Category","description":"Brief","reasoning":"Why recommended","location":"Real address","contact":"Real phone/website","eligibility":"Who qualifies","process":["Step 1...","Step 2...","...as many as needed for this specific service"],"waitTimes":"Estimate","requiredDocs":["Doc if any"]}],"summary":"Summary"}

Recommend exactly 5 services with VARIED step counts reflecting each service's actual process.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: "Provide personalized recommendations." }
        ],
        response_format: { type: "json_object" },
        temperature: 0.4, // Balanced temperature for consistency with variation in step counts
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
