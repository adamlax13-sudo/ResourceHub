import type { Express } from "express";
import { createServer, type Server } from "http";
import { createHash } from "crypto";
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
- Recovery Alberta Help Line: 1-888-594-0211 (24/7 provincial addiction support)
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
- Virtual Opioid Dependency Program (VODP): 1-844-383-7688, vodp.ca - Same-day OAT access
- ECMHS Crisis Counselling Line: 403-299-9699 - Multilingual family & youth crisis Calgary
- Protection for Persons in Care: 1-888-357-9339
- Brite Line Edmonton: CMHA Edmonton - 2SLGBTQIA+ mental health helpline

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
- Alpha House Society Calgary: 203-15 Ave SE, 403-234-7388, alphahousecalgary.com - 24/7 emergency shelter (120+ beds), detox (42 beds), housing programs, DOAP Team outreach
- Alpha House Detox: detox@alphahousecalgary.com, 403-234-7388 - Medically supervised withdrawal, 30 active beds + 12 transitional
- CMHA Calgary: cmha.calgary.ab.ca, 403-297-1402 - Mental health education, support, advocacy
- Recovery College Calgary (CMHA): recoverycollegecalgary.ca, 403-297-1402 - FREE courses on mental health & recovery, peer-led, ages 16+, no referral, drop-ins Wed
- Calgary Counselling Centre: 403-265-4980, calgarycounselling.com - Sliding scale, no waitlist
- Rapid Access Addiction Medicine (RAAM): 707 10 Ave SW - Walk-in urgent addiction care
- AHS Opioid Dependency Program: 1213 4 St SW, 403-955-3600 - OAT, counselling, harm reduction
- Renfrew Recovery Centre (Adult Detox): 1611 Remington Rd NE, 403-297-3337 - 24/7 supervised detox
- Calgary Dream Centre: 403-243-5598, calgarydreamcentre.com - 90-day men's residential, Indigenous stream, transitional housing
- Calgary Drop-In Centre: 1 Dermot Baldwin Way SE, 403-266-3600, calgarydropin.ca - 24/7 emergency shelter, withdrawal management, meals, housing support
- The Alex Community Health Centre: 4920 17 Ave SE, 403-266-2622, thealex.ca - Drop-in peer advocacy, food centre, health care
- Wood's Homes Calgary: woodshomes.ca - Children, youth, families crisis services
- Eastside Community Mental Health (Woods Homes): #255, 495 36 St NE - Walk-in Tue 11-7, Thu 11-6, Sat 11-5
- The Summit (Sinneave Centre): 403-955-5437, albertahealthservices.ca/summit - Youth walk-in mental health
- Hull Services Calgary: 403-251-8000, hullservices.ca - Youth recovery, PChAD, detox, crisis services
- YouthSMART: youthsmart.ca - Mental health education, stigma reduction
- Community Connect YYC: communityconnectyyc.ca - Affordable barrier-free counselling, interpreters
- Carya Calgary: caryacalgary.ca - Barrier-free programs, community support
- CUPS Calgary: 403-221-8780 - Free health care and dental for low-income
- Calgary Navigation and Support Centre: 428 9 Ave SE, 403-410-1167 - Multi-service hub (ID, mental health, housing)

## CALGARY EMERGENCY SHELTERS & HOMELESS SERVICES
- Calgary Drop-In Centre: 1 Dermot Baldwin Way SE, 403-266-3600, calgarydropin.ca - 24/7 low-barrier shelter, 1000+ beds
- Alpha House Shelter: 203-15 Ave SE, 403-234-7388, alphahousecalgary.com - Men's shelter, substance use support
- Salvation Army Centre of Hope: 420 9 Ave SE, 403-410-1111, salvationarmycalgary.org - Men's emergency shelter
- Mustard Seed Foothills: 7025 44 St SE, 403-723-9422 - Emergency shelter
- Mustard Seed Women's: 110 11 Ave SE, 587-447-1345 - Women's shelter
- YW Calgary Emergency Shelter: 1715 17 Ave SE, 403-705-0315 - Women's emergency services
- Inn from the Cold: 110 11 Ave SE, 403-263-8384, innfromthecold.org - Family shelter
- Trellis Society Avenue 15: 938 15 Ave SW, 403-543-9651, growwithtrellis.ca - Youth shelter 18-24, 2SLGBTQIA+
- HELP Team Calgary: 403-998-7388 - Street-level outreach
- Calgary Homeless Foundation: 403-237-6456, calgaryhomeless.com - Extreme weather response, coordination

## CALGARY LOW-COST/SLIDING SCALE COUNSELLING
- Calgary Counselling Centre: 403-265-4980, calgarycounselling.com - Income-based sliding scale, no waitlist
- Affordable Therapy Network: affordabletherapynetwork.com - Low-cost therapist connections
- Virtuous Circle Counselling: vccounselling.com - Limited sliding scale spots
- Jade Counselling Services: jadecounsellingservices.com - $20-$50/session, no proof of income required
- Community Connect YYC: communityconnectyyc.ca - Phone, online, or in-person, barrier-free
- The Mustard Seed Counselling: 587-393-4020, theseed.ca/cicmarlborough - Free for adults

## LICENSED RESIDENTIAL TREATMENT - CALGARY
- Alpha House Detox & Transitional: 403-234-7388, alphahousecalgary.com - Licensed detox, transitional beds
- AARC Adolescent Recovery Centre: 403-253-5250, aarc.ab.ca - Youth 12-step residential
- Aventa Centre for Women (Mission): 403-245-9050, aventa.org - Women's addiction treatment
- Aventa Centre for Women (Sunalta): 403-245-9050, aventa.org - Long-term women's program
- Calgary Dream Centre Men's: 403-243-5598, calgarydreamcentre.com - 90-day men's residential
- Fresh Start Recovery Site 1: 403-387-6266, freshstartrecovery.ca - Licensed residential
- Hull Services Youth Recovery: 403-251-8000, hullservices.ca - Youth detox, PChAD, residential
- NAM Niwas 1-4: 587-777-4722, namrecovery.com - Holistic addiction/mental health recovery
- Oxford House Foundation Calgary: 403-214-2046, oxfordhouse.ca - Acadia, Allandale, Arlington, Astoria houses
- Recovery Acres Calgary: 403-245-1196, recoveryacres.org - 1822/1835/1839 House residential recovery
- Alcove Addiction Recovery for Women: 403-919-5715, alcoverecovery.ca - Elderberry, Family Program

## INDIGENOUS SERVICES - CALGARY
- Sunrise Healing Lodge Society: 403-261-7921, nass.ca - Gender-inclusive addiction recovery, cultural healing
- Miskanawah: 403-247-5003, miskanawah.ca - Nanatawiho Kamik Healing Lodge, cultural support, recovery circles, youth, Elders, ceremonies
- Aboriginal Friendship Centre of Calgary (AFCC): 403-270-7379, 101-427 51 Ave SE, afccalgary.org - Referrals, Elders, youth wellness
- Niitoiyis Family Support Society: 403-531-1972/1976 (24hr), niitoiyis.com - Crisis lines, housing, family addiction services
- Calgary Indigenous Sharing Network: cisn.ca/calgary - Peer support, healing circles
- Walking Eagle / New Beginnings (Indigenous AA): calgaryaa.org
- Native Network Family Centre: 19 Erin Woods Dr SE, 403-240-4642 ext 303 - Indigenous/Métis family advocacy
- AHS Indigenous Mental Health Program: 403-955-6645 - Self-referral available
- Alpha House Wellbriety: 403-234-7388 - Sweat Lodge, drumming, sharing circles, Elder access (50-60% Indigenous clients)

## INDIGENOUS SERVICES - PROVINCIAL
- Hope for Wellness Helpline: 1-855-242-3310, hopeforwellness.ca - 24/7 in Cree, Ojibway, Inuktitut, English, French
- Indigenous Support Line (AHS): 1-844-944-4744 - Mon-Fri 10am-6pm
- NNADAP Referral: 1-780-495-2345
- Poundmaker's Lodge Treatment Centres: 780-458-1884, 1-866-458-1884, St Albert - 42-day & 90-day culturally grounded addiction treatment
- Bonnyville Indian Metis Rehabilitation Center: 780-826-3328, bimrc.ca - 42-day 12-step Indigenous traditions
- Akoka'tssini Medical Detox (Brocket): 403-849-7544, aakomkiyiihealthservices.com - Aakom-kiyii Health Services
- Nightwind Treatment Centre (Athabasca): 780-698-2595, nightwind.ca - Stony Creek, Kihew House, GMT House
- Okisikow Iskwew Center: Indigenous women's recovery
- Kainai Transition Centre Society: Kainaiwa Women's Wellness Lodge, 403-653-3946
- Bringing the Spirit Home (BTSH): Blood Tribe Department of Health
- Iikaisskini Indigenous Services Lethbridge: ulethbridge.ca/indigenous - Land-based healing, Elder access
- Wellbriety Program Red Deer (Safe Harbour): safeharboursociety.org - Medicine wheel-based recovery
- Aboriginal Counseling Services Association: 780-242-4357, aboriginalcounseling.com
- Métis Nation of Alberta Health: health@metis.org - Up to 12 sessions, $225/session
- Jordan's Principle: For First Nations children - Covers psychological care

## EDMONTON SERVICES
- Access 24/7 Edmonton: 13211 Fort Rd NW, 780-424-2424 - Open 7 days 8am-10pm, one-stop adult intake
- CMHA Edmonton: edmonton.cmha.ca - Mental health programs, housing, peer support, Brite Line
- Mobile Crisis Adults Edmonton: 780-342-7777
- Mobile Crisis Children Edmonton: 780-413-4733
- George Spady Society Detox: 780-424-8335 - Medically supported detox 18+
- Boyle Street Community Services: 780-424-4106 - Harm reduction, wraparound addiction support
- Managed Alcohol Program: 780-990-5912 - For those experiencing homelessness
- Hope Mission Edmonton: 780-422-2018 - Faith-based residential recovery, emergency shelter
- Breakout Recovery Community: 780-422-2018 x312 - Men 18-60
- Wellspring by Hope Mission: 780-422-2018 x203 - Women 18+, 1-year program
- Jellinek Society: 780-488-1160 - Men 18+ alcoholism recovery
- McDougall House: 780-426-1409 - Women 18+ residential treatment
- Our House Edmonton: 780-474-8945, ourhouseedmonton.com - 1-year men's residential (one of few in Canada)
- Recovery Acres Society: 780-471-2996 - Men 16+ substance use recovery
- Urban Manor Housing Society: 780-425-5901 - Supportive housing for hard-to-house men
- YWCA Edmonton Counselling: counselling@ywcaedm.org - Sliding scale $5-$200/session
- The Family Centre: 780-423-2831 - First session free then sliding scale
- Pride Centre of Edmonton: pridecentreofedmonton.ca - LGBTQ2S+ resources, counselling
- CASA Mental Health Edmonton: casamentalhealth.org - Children/youth, Indigenous programs, classroom support
- YESS: yess.org - Youth shelter, ages 15-24
- Henwood Treatment Centre: 18750 18 St NW, Edmonton - Adult residential treatment (AHS)
- Edmonton Navigation and Support Centre: Provincial referrals, multi-service hub
- Edmonton's Food Bank: 11508 120 St NW, 780-425-4190 - 43,000+ people monthly, Beyond Food program
- Envision Mind Care: envisionmindcare.com - Psychedelic-assisted therapy, ketamine, TMS (first in Alberta)
- WIN House Edmonton: 780-479-0058, winhouse.org - Women's emergency shelter (3 locations)
- Lurana Shelter: 780-424-5875, cssalberta.ca - 24/7 domestic violence shelter

## LETHBRIDGE SERVICES
- Lethbridge Train Station (Recovery Alberta): 801 1 Ave S, 403-381-5260 - Outpatient addiction/mental health, self-referral
- Lethbridge Provincial Building: 200 5 Ave S - Community addiction services, psychiatric services
- CMHA Lethbridge: lethbridge.cmha.ca - Crisis Intervention Team, DOT outreach, 403-328-5465 (328-LINK)
- Alpha House Lethbridge Shelter: Shelter services, substance use support
- Lethbridge Wellness Shelter - Stabilization Unit: Licensed facility
- Lethbridge Recovery Centre: Adult detoxification services
- Fresh Start Recovery Lethbridge: 14-week residential for men (3 sites)
- Central Alberta Women's Emergency Shelter: 1-888-346-5643, cawes.com - 24/7 domestic violence
- Iikaisskini Indigenous Services: ulethbridge.ca/indigenous - Land-based healing

## MEDICINE HAT SERVICES
- Medicine Hat Provincial Building: 346 3 St SE, 403-529-3500 - Outpatient addiction/mental health
- Medicine Hat Child/Youth Services: 403-529-3582
- Intensive Outreach & Diversion: RCC Building, 631 Prospect Dr SW, 403-502-8617
- Medicine Hat Recovery Centre: Adult residential treatment, detoxification
- Medicine Hat Opioid Dependency Program: 564 S Railway St - OAT, no fees
- 24-Hour Help Line: 1-866-332-2322

## GRANDE PRAIRIE & NORTHERN ALBERTA
- Grande Prairie AHS Addiction & Mental Health: Community services, outreach
- Northern Addictions Centre: Adult detox and residential treatment
- Peace River Regional Women's Shelter: 1-877-624-3466
- Grande Cache Transition House: 780-827-3776, 1-866-957-3776
- Northern Haven Support Society: 780-849-4418, 1-877-214-4418
- Fort McMurray Recovery Centre: Adult residential treatment
- High Prairie services available through AHS

## RED DEER & CENTRAL ALBERTA
- Red Deer Recovery Community by EHN Canada: 1-877-875-8890 - Medical detox, 42-90 day programs
- Red Deer Dream Centre: Faith-based residential recovery
- Red Deer Medically Supported Detox: 403-347-0181
- Safe Harbour Society Red Deer: safeharboursociety.org - Wellbriety, medically supported detox
- Central Zone PChAD: Protection of Children Abusing Drugs
- CAPS (Central Alberta Pride Society): LGBTQ+ awareness & support

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
- University of Calgary Wellness Services: 403-210-9355, ucalgary.ca/wellness-services - Free counselling, psychiatry, walk-in Mon-Thu
- UCalgary Writing Symbols Lodge: ucalgary.ca/student-services/writing-symbols - Indigenous academic/cultural support, Elders
- UCalgary Harm Reduction Support: naomi.denhaan@ucalgary.ca - Substance use advising
- UCalgary Crisis (24/7): Distress Centre 403-266-4357, Wood's Homes after-hours
- University of Alberta Counselling: 780-492-5205, ualberta.ca/current-students/counselling - Free confidential, extended hours Tue/Wed
- U of A Psychiatry: Covered with Alberta Health Care
- U of A First Peoples' House: Indigenous student support
- U of A The Landing: Gender & sexual diversity support, peer mentorship
- U of A Empower Me: 24/7 confidential support (student health plan)
- Mount Royal University Wellness: 403-440-6960, mtroyal.ca/WellnessServices
- MRU Iniskim Centre: Indigenous student support
- MacEwan University Wellness & Psychological Services
- NAIT Student Counselling: nait.ca/student-services
- SAIT Student Development & Counselling
- Lethbridge College Counselling
- U of Lethbridge Counselling Services
- Red Deer Polytechnic Counselling
- NorQuest College Student Wellness
- Bow Valley College Learner Success
- Campus Food Banks: U of A, U of C, NorQuest, U of Lethbridge

## LGBTQ2S+ SERVICES
- Camp fYrefly: 403-283-5580, fyrefly.ca - Leadership retreat ages 14-24 (Calgary/Edmonton)
- Calgary Outlink: calgaryoutlink.ca - Support, education, Inside Out Youth Group (13-18)
- Skipping Stone: skippingstone.ca - Trans/gender-diverse youth & adults Calgary
- Centre for Sexuality Calgary: centreforsexuality.ca - Education, Camp fYrefly
- Aura Housing Calgary: 587-779-5015 - LGBTQ2S+ youth housing 14-24
- Pride Centre of Edmonton: pridecentreofedmonton.ca - Queer Joy programs, resources
- Rainbow Alliance for Youth Edmonton: Ages 12-24
- CHEW Project OUTpost: Crisis/drop-in 2SLGBTQIA+ youth 14-29, mental health, housing
- Youth Health Centre Calgary: 403-520-6270 - Health/social care ages 12-24
- Youth Health Bus Calgary: 403-689-9196 - Visits high schools
- HOME Central Alberta: Two-Spirit, Indigenous, Queer-led safe spaces
- altView Foundation: Strathcona County gender/sexual minority resources
- Alberta GSA Network: albertagsanetwork.ca - K-12 resources
- ShiftGrit LGBTQ+ Counselling: Calgary 587-352-6463, Edmonton 780-705-6463, shiftgrit.com
- Outloud St. Albert / PFLAG St. Albert: Support groups all ages
- Centre for Newcomers: LGBTQ+ newcomer mental health, b.stojanovic@centrefornewcomers.ca

## DOMESTIC VIOLENCE & WOMEN'S SHELTERS
- Calgary Women's Emergency Shelter: 24/7 Crisis Line, calgarywomensshelter.com - Trained counsellors
- Family Violence Info Line: 310-1818 - 24/7 in 170+ languages
- Calgary Communities Against Sexual Abuse (CCASA): 403-237-5888, calgarycasa.com
- WIN House Edmonton (3 locations): 780-479-0058, winhouse.org - 50+ years serving Edmonton
- Lurana Shelter Edmonton: 780-424-5875, cssalberta.ca - 24/7, meals, transport, child support
- WEAC Edmonton: 780-423-5302 - Women's Emergency Accommodation, 18+
- A Safe Place Sherwood Park: 780-464-7233, 1-877-252-7233, asafeplace.ca - 24/7 crisis
- SAGE Senior's Safe House Edmonton: 780-702-1520 (emergency), 780-426-3746 - Seniors 60+
- Central Alberta Women's Emergency Shelter (CAWES): 1-888-346-5643, cawes.com - Red Deer 24/7
- Bow Valley Women's Emergency Shelter: 403-760-3200
- Strathmore Shelter: 403-934-6634, 1-877-934-6634
- Pincher Creek Women's Emergency Shelter: 403-627-2114
- Mountain Rose Women's Shelter: 1-877-845-4141
- Ermineskin Women's Shelter Maskwacis: 780-585-4444 - On-reserve
- Eagle's Nest Stoney Family Shelter: 403-881-2000
- Escaping Abuse Benefit: alberta.ca/family-violence-costs-leave - Emergency funds
- Ruth House Society: 587-352-9422, ruthshouse.ca - African-descent support
- Alberta SPCA Pet Safekeeping: Free temporary pet care for abuse survivors

## BABY & PARENTING RESOURCES
- Calgary Pregnancy Care Centre: 403-269-3110, pregcare.com - Referrals, free baby/maternity clothing
- Best Beginning Program: 403-228-8221, birthandbabies.com - Pregnant teens/low-income, food, transport
- Calgary Food Bank (Baby Items): 403-253-2055, calgaryfoodbank.com - Formula, hygiene, request in advance
- Made by Momma: madebymomma.org - Mothers with young children in crisis, meals, essentials
- Rise Calgary Healthy Babies: 3303 17 Ave SE, 403-204-8280 - Monthly support for infants under 1
- Salvation Army (Infant Essentials): 100, 5115 17 Ave SE
- WINS Community Resource Hubs: 825-540-4717 - Baby items, hygiene
- Children's Cottage Society - Brenda's House: 1921 28 St SW, 403-242-8575 - Family emergency housing

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
- Community Kitchen Program of Calgary: ckpcalgary.ca - Cooking skills, Spinz-A-Round food access
- Robert McClure United Church: 5510 26 Ave NE, 403-280-9500 - Thursday pantry
- Fish Creek United Church: 77 Deerpoint Rd SE, 403-278-8263 - Pantry Mon-Thu, bread Thu
- Eastside Victory Outreach: 1840 38 St SE, 403-273-1050 - Hampers + hot lunch Tue/Thu
- Ogden Victory Outreach: 7012 Ogden Rd SE, 403-273-1050 - Hampers + hot lunch Fri
- St. Mary's Feed the Hungry: 221 18 Ave SW, 403-218-5532 - Free Sunday lunch
- Abundant Life Church: 3343 49 St SW, 403-246-1804 - Hampers west of 14 St, Thu by appointment

## FREE FOOD RESOURCES - EDMONTON
- Edmonton's Food Bank: 11508 120 St NW, 780-425-4190, edmontonsfoodbank.com - 43,000+ monthly, Beyond Food free services
- Food Not Bombs Community Fridge: Outside Earth's General Store, Whyte Avenue - Open access
- Gurdwara Siri Guru Singh Sabha Mill Woods: Free vegetarian langar for all
- West End Outreach Centre: Free lunches Mon/Wed 12-1pm, community kitchen training

## PROVINCIAL FOOD RESOURCES
- Food Banks Alberta: foodbanksalberta.ca - 113 member food banks province-wide
- 211 Alberta Food Resources: Dial 211 - Connect to local food banks
- Alberta Health Services Food Map: albertahealthservices.ca/nutrition/Page16163.aspx - By health zone
- Strathcona Food Bank: 255 Kaska Rd, Sherwood Park, 780-449-6413
- Red Deer Food Bank Society
- Lethbridge Salvation Army Food Bank
- Grande Prairie Salvation Army Food Bank
- Airdrie Food Bank

## BASIC NEEDS & COMMUNITY RESOURCES - CALGARY
- Fair Entry Calgary: 800 Macleod Trail SE or Village Square Library - Subsidized programs, call 311
- Income Support Alberta: 1-877-644-9992, applyincomesupport.alberta.ca
- Alberta Supports Contact Centre: 1-877-644-9992 - Mon-Fri 8:15am-4:30pm
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
- Alpha House Calgary Detox: 203-15 Ave SE, 403-234-7388 - 42 beds, medically supervised, 24/7
- Renfrew Recovery Centre Calgary: 1611 Remington Rd NE, 403-297-3337, 1-866-332-2322 - 24/7 adult detox
- AHS Adult Detox (17+): 780-342-5900
- George Spady Society Edmonton: 780-424-8335 - Medically supported 18+
- Poundmaker's Lodge Detox St. Albert: 780-458-1884 - 18+ Indigenous-focused
- Red Deer Recovery Community Detox: 1-877-875-8890 - Medical detox
- Safe Harbour Medically Supported Detox Red Deer: 403-347-0181
- M.I.T.A.A. Detox Centre: Licensed detox
- Pastew Place Detox Centre: Licensed facility
- Fort Macleod Detox: 403-553-4466
- Lethbridge Recovery Centre Detox: Adult detoxification
- Medicine Hat Recovery Centre Detox: Detoxification services
- Akoka'tssini Medical Detox Brocket: 403-849-7544 - Indigenous health services

## RESIDENTIAL TREATMENT PROGRAMS - LICENSED ALBERTA
- Lander Treatment Centre (AHS): 221 Fairway Dr, Claresholm, 403-625-5600 - 48-bed, 4-week adult
- Alpha House Calgary: 403-234-7388 - Emergency shelter, detox, transitional, Housing First
- Calgary Dream Centre: 403-243-5598 - 90-day men's, transitional housing
- Fresh Start Recovery Centre Lethbridge: 403-387-6266 - 90-day, 3 sites
- AARC Adolescent Recovery Centre: 403-253-5250 - Youth 12-step semi-residential
- Aventa Treatment for Women: 403-245-9050 - Short/long-term, trauma-informed, OAT-friendly
- Poundmaker's Lodge St. Albert: 780-458-1884 - 42-day & 90-day Indigenous
- Our House Edmonton: 780-474-8945 - 1-year men's program
- Henwood Treatment Centre Edmonton: Adult residential
- Red Deer Recovery Community (EHN): 1-877-875-8890 - 42-90 day programs
- Teen Challenge Alberta Men's Centre: Faith-based long-term
- Adeara Recovery Centre: Women & children, faith-based, 1+ year
- Simon House Recovery Centre: 5807/5809/5811/5813/5819 locations
- Oxford House Foundation: Recovery housing post-treatment (multiple houses)
- Jellinek Society Edmonton: 780-488-1160 - Men's alcoholism
- McDougall House Edmonton: 780-426-1409 - Women's residential
- Grace House Drumheller: Women only, 1-year
- Thorpe Recovery Centre Blackfoot: 780-875-8890 - Licensed residential
- Bonnyville Indian Metis Rehab: 780-826-3328 - 42-day Indigenous
- Nightwind Treatment Centre: Stony Creek, Kihew House, GMT House - Indigenous
- Fort McMurray Recovery Centre: Adult residential
- Medicine Hat Recovery Centre: Adult residential
- Shunda Creek Recovery Center: Licensed facility
- Opportunity Home Treatment & Recovery Centre: Licensed residential

## YOUTH SERVICES
- Kids Help Phone: 1-800-668-6868, text CONNECT to 686868 - 24/7
- ConnecTeen: 403-264-8336, text 587-333-2724 - Youth peer support Calgary
- The Summit (Sinneave Centre): 403-955-5437 - Walk-in mental health children/youth
- Hull Services Bridging the Gap: 403-216-0660, text 403-216-0663 - Ages 16-24
- Hull Services Calgary: 403-251-8000 - Youth recovery, PChAD
- YouthSMART: youthsmart.ca - Mental health education
- Youth Substance Use Clinic Calgary: 1005 17 St NW, 403-297-4664 - Ages 12-17
- Kickstand: mykickstand.ca - Free virtual/in-person ages 11-25, no waitlist
- CASA Mental Health: casamentalhealth.org - Children & youth, classroom program
- Clean Scene Edmonton: 780-488-0036 - Ages 14-29
- AARC: 403-253-5250, aarc.ab.ca - Adolescent semi-residential 12-step
- Edmonton Youth Addiction Services: Residential treatment, stabilization, PChAD
- Clear Hills Youth Treatment Centre: Licensed residential
- EHN Sandstone Recovery Calgary: Ages 12-24 eating disorders
- Trellis Society Avenue 15: 403-543-9651 - Youth shelter 18-24, 2SLGBTQIA+
- YESS Edmonton: yess.org - Youth shelter 15-24

## EATING DISORDERS
- Eating Disorder Support Network of Alberta: 780-729-3376
- Anorexics and Bulimics Anonymous: aba12steps.org
- AHS Access Mental Health: 403-943-1500 or 780-424-2424
- EHN Sandstone Recovery Centre Calgary: Ages 12-24

## GAMBLING SUPPORT
- Alberta Gamblers Anonymous: 780-463-0892
- Problem Gambling Resources Network: 780-461-1259
- AHS QuitCore: 1-866-710-QUIT (7848)
- Lander Treatment Centre: Gambling addiction treatment

## SUPPORT FOR FAMILY MEMBERS AFFECTED BY ADDICTION
- Al-Anon Family Groups Edmonton: 780-443-6000 (24/7)
- Parents Empowering Parents (PEP): 780-293-0737
- Bissell Centre FASD Services: 780-423-2285 x157
- Catholic Social Services FASD: 780-975-4896
- FASD Alberta Resource Hub: fasd.typepad.com

## HARM REDUCTION
- Digital Overdose Response System (DORS): dorsapp.ca - App to prevent fatal overdoses when using alone
- Boyle Street Community Services Edmonton: 780-424-4106
- Virtual Opioid Dependency Program: 1-844-383-7688, vodp.ca - Same-day OAT anywhere in Alberta
- Alpha House DOAP Team: Downtown outreach, needle response, harm reduction
- Alpha House Needle Response & Ambassador Teams: Overdose response, harm reduction supplies
- UCalgary Harm Reduction: naomi.denhaan@ucalgary.ca

## OTHER PROVINCIAL SERVICES
- Recovery Alberta: recoveryalberta.ca - Provincial addiction/mental health agency ($1.13B budget)
- Recovery Access Alberta: recoveryaccessalberta.ca - Match to treatment programs
- Find a Doctor Alberta: albertafindadoctor.ca
- Service Canada Calgary: 5401 Temple Dr NE Suite 116 - SIN, EI, grants
- BounceBack: bounceback.cmha.ca - Free CBT program
- Counselling Alberta: Recovery Alberta - Affordable virtual/in-person, no waitlist
- 211 Alberta: Dial 211, ab.211.ca - Community services 24/7
- Alberta.ca Residential Treatment Lookup: alberta.ca/lookup/residential-addiction-treatment-service-providers.aspx
`;

// Auto-generate cache version from database content hash - invalidates cache when database is updated
const DATABASE_HASH = createHash('md5').update(ALBERTA_SERVICES_REFERENCE).digest('hex').slice(0, 8);

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

  app.post(api.search.query.path, async (req: any, res) => {
    try {
      const input = api.search.query.input.parse(req.body);
      const mode = input.mode || 'fast';
      
      // Check if user is logged in and has a university set
      let userUniversity: string | null = null;
      let userLocation: string | null = null;
      if (req.isAuthenticated && req.isAuthenticated()) {
        const user = await storage.getUserByReplitId(req.user.claims.sub);
        if (user?.university && user.university !== 'not-in-university' && user.university !== 'in-highschool') {
          userUniversity = user.university.replace(/-/g, ' ');
        }
        if (user?.location && user.location !== 'prefer-not-to-say') {
          userLocation = user.location === 'other' && user.customLocation 
            ? user.customLocation 
            : user.location?.replace(/-/g, ' ');
        }
      }
      
      // Include database hash, mode, and university in cache key for personalized results
      const universityKey = userUniversity ? `:uni:${userUniversity}` : '';
      const normalizedQuery = `${DATABASE_HASH}:${mode}${universityKey}:${input.query.trim().toLowerCase()}`;
      const cached = await storage.getSearchByQuery(normalizedQuery);
      if (cached) return res.json(cached.results);

      // Different prompts for fast vs comprehensive modes
      const fastModeInstructions = `
FAST MODE - Return 5-8 most relevant services quickly:
1. Return ONLY the 5-8 most relevant, high-priority services that best match the query
2. Prioritize crisis lines, major treatment centers, and well-known organizations
3. Keep process steps brief (3-4 steps each)
4. Focus on immediate, actionable resources`;

      const comprehensiveModeInstructions = `
COMPREHENSIVE MODE - Return ALL relevant services:
1. RETURN ALL RELEVANT SERVICES - DO NOT limit or cap results. If 15 services match, return all 15. If 30 match, return all 30.
2. Be COMPREHENSIVE - include crisis lines, shelters, treatment programs, support groups, peer support, counselling, and all related services
3. Provide detailed process steps (4-8 steps each) with full contact information
4. Include both major organizations AND smaller community resources`;

      // Build university prioritization instructions if user has a university set
      const universityPrioritization = userUniversity ? `
UNIVERSITY/CAMPUS PRIORITIZATION:
The user is a student at ${userUniversity}. When results are relevant to the query:
- PRIORITIZE campus counselling, wellness centers, and student services at ${userUniversity} by listing them FIRST
- Include on-campus or university-affiliated resources before off-campus alternatives when both are relevant
- If the query relates to mental health, counselling, crisis support, or student wellness, ALWAYS include ${userUniversity}'s campus resources if available
- This prioritization only applies when campus resources are genuinely relevant to the search - don't force irrelevant campus services` : '';

      const locationContext = userLocation ? `
USER LOCATION: ${userLocation}, Alberta - When multiple services match, prefer services in or near this location.` : '';

      const systemPrompt = `You are helpful assistant for "Recovery on Campus Resource Hub" in Alberta.

${mode === 'fast' ? fastModeInstructions : comprehensiveModeInstructions}
${universityPrioritization}
${locationContext}

CRITICAL REQUIREMENTS:
- EXACT NAME MATCH PRIORITY: If the user's query contains an exact organization name (e.g., "Alpha House", "Calgary Drop-In", "Mustard Seed"), you MUST include that specific organization in your results FIRST.
- Every service MUST be a REAL, SPECIFIC Alberta organization from the reference database below
- ONLY use URLs, phone numbers, and addresses EXACTLY as listed in the reference database
- DO NOT invent or guess URLs - if a URL is not in the database, use the phone number instead
- Never return generic categories like "Local Counseling Services" or "Community Support Groups"

SEARCH MATCHING RULES:
- If query mentions "Alpha House" → MUST include Alpha House Society Calgary and Alpha House Detox
- If query mentions "Calgary Drop-In" → MUST include Calgary Drop-In Centre
- If query mentions "Mustard Seed" → MUST include Mustard Seed services
- If query mentions "CMHA" → MUST include relevant CMHA chapter

${ALBERTA_SERVICES_REFERENCE}

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

  // Recommendations endpoint - always generate fresh recommendations for variety
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
      
      // Build category list from favorites for context
      const favoriteCategories = Array.from(new Set(favorites.map(f => f.category))).sort().join(',');
      
      // Build list of already-saved services to exclude from recommendations
      const savedServiceNames = favorites.map(f => f.serviceName).filter(Boolean);
      const savedServiceIds = favorites.map(f => f.serviceId).filter(Boolean);
      
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
      
      // Streamlined prompt for faster response - maintains quality requirements with variety
      const prompt = `Recovery on Campus Resource Hub - Alberta personalized recommendations.

PRIORITY #1 - PROFILE RELEVANCE (MANDATORY):
All recommendations MUST be directly relevant to the user's profile. Every service you recommend should match at least one of these criteria based on their profile:
- Location: Services in or accessible from their city/area
- Identity: LGBTQ2S+ services if indicated, Indigenous services if indicated, age-appropriate services
- University: Campus-specific resources if they're a student at that institution
- Recovery status: Addiction/recovery services if in recovery
- Preferences: Virtual vs in-person, one-on-one vs group as specified
- Faith/religion: Faith-based services if indicated

PRIORITY #2 - VARIETY WITHIN RELEVANCE:
While staying relevant to the profile above, select DIFFERENT services each time from the many matching options. Don't repeat the same 5 services - explore the full range of profile-appropriate options.

CRITICAL REQUIREMENTS:
- Every service MUST be a REAL, SPECIFIC Alberta organization (e.g., "CMHA Edmonton", "Distress Centre Calgary", "U of A Counselling")
- NEVER return generic categories like "Local Mental Health Clinic" - always name the actual organization
- ONLY use URLs, phone numbers, and addresses that are EXACTLY as listed in the reference database below
- DO NOT invent or guess URLs - if a URL is not in the database, use the phone number instead
- Prioritize services from the reference database below - these are verified and current

${ALBERTA_SERVICES_REFERENCE}

USER PROFILE (USE THIS TO FILTER RECOMMENDATIONS): ${demographics.length > 0 ? demographics.join(', ') : 'No profile - give general Alberta recommendations'}
${favCategoriesList.length > 0 ? `Favorite categories (suggest similar services in these areas): ${favCategoriesList.join(', ')}` : ''}
${savedServiceNames.length > 0 ? `
ALREADY SAVED RESOURCES (DO NOT RECOMMEND THESE - user already has them saved):
${savedServiceNames.slice(0, 10).join(', ')}
Instead, use these saved services to understand user's interests and recommend COMPLEMENTARY or SIMILAR services they haven't saved yet.` : ''}
${user.university && user.university !== 'not-in-university' && user.university !== 'in-highschool' ? `
UNIVERSITY STUDENT PRIORITIZATION (HIGH PRIORITY):
User is a student at ${user.university.replace(/-/g, ' ')}. This is a "Recovery on Campus" platform, so campus resources are especially valuable:
- List 2-3 on-campus or university-affiliated services FIRST in recommendations (campus counselling, wellness center, student support, campus food bank, etc.)
- These campus resources should appear at the TOP of the list, before off-campus alternatives
- Only include campus resources that are relevant to the user's other profile attributes
- After campus resources, include complementary off-campus services` : ''}
${user.university === 'in-highschool' ? 'User is a HIGH SCHOOL student - MUST prioritize youth services appropriate for under-18' : ''}
${userLocation && userLocation !== 'prefer not to say' ? `Location: ${userLocation}, Alberta - MUST prioritize services in or accessible from this city` : ''}

PERSONALIZATION RULES (FOLLOW STRICTLY):
- If user specified university: List 2-3 campus-specific resources FIRST, then off-campus services
- If user specified location: Remaining services should be in/near that city
- If user is LGBTQ2S+: Include at least 1 LGBTQ2S+-affirming service
- If user is Indigenous: Include at least 1 Indigenous-specific service
- If user specified recovery status: Include relevant addiction/recovery support
- If user specified format preference: Prioritize matching format (virtual/in-person)
- If user specified support style: Prioritize matching style (one-on-one/group)
- Consider disability accommodations if indicated
- Suggest services in categories similar to favorites but in unexplored areas

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
        temperature: 0.6, // Balanced: variety while maintaining profile relevance
      });

      const results = JSON.parse(completion.choices[0].message.content!);
      
      // Filter out any recommendations that match already-saved services (backup filter)
      if (results.recommendations && savedServiceIds.length > 0) {
        const savedNamesLower = savedServiceNames.map(n => n.toLowerCase());
        results.recommendations = results.recommendations.filter((rec: any) => {
          const recNameLower = rec.name?.toLowerCase() || '';
          // Check if this recommendation matches any saved service
          return !savedServiceIds.includes(rec.id) && 
                 !savedNamesLower.some(saved => recNameLower.includes(saved) || saved.includes(recNameLower));
        });
      }
      
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
