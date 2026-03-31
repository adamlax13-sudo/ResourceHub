/**
 * Tier 2: Enrich services with confidence 50-69 (non-campus batch).
 * Updates website_url to point to specific program pages where a better URL was found.
 *
 * Usage:
 *   node scripts/apply-tier2-enrichment.mjs
 *   DRY_RUN=false node scripts/apply-tier2-enrichment.mjs
 */
import pg from "pg";
const { Pool } = pg;
import "dotenv/config";

const DRY_RUN = process.env.DRY_RUN !== "false";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const BATCH_ID = `tier2-reenrich-2026-03-29`;

const enrichments = [
  // === Churches with verified social service programs ===
  {
    id: 3084,
    description: "Masjid Al Fatima offers community programs and services including a Free Tax Clinic, Women Empowerment program, and Youth Programs for the Edmonton Muslim community. The mosque also provides marriage services, Quran and Fiqh classes, an Islamic Library, and Arabic and Urdu credential programs.",
    process_steps: [
      "Visit the Masjid Al Fatima website at masjidalfatima.com/services/ for current program schedules",
      "For the Free Tax Clinic, check the services page for seasonal availability and required documents",
      "Contact the mosque at (780) 462-7077 or email salaam@masjidalfatima.com for program details",
      "Visit in person at 9275 25 Ave NW, Edmonton, AB T6N 0A5"
    ],
    eligibility: null,
    hours: null,
    phone: "(780) 462-7077", email: "salaam@masjidalfatima.com",
    confidence: 75,
    source_urls: ["https://masjidalfatima.com/", "https://masjidalfatima.com/services/"],
    website_url: "https://masjidalfatima.com/services/",
  },
  {
    id: 2869,
    description: "Okotoks United Church partners with the Okotoks Food Bank and runs community outreach programs including Feeding Our Future (a food security ministry), Jacket Racket (a clothing program), Healing Pathways (a wellness-focused ministry), and a Congregational Care Team providing support to community members.",
    process_steps: [
      "For food assistance, contact the Okotoks Food Bank through okotoksfoodbank.ca or visit the church during office hours",
      "For the Jacket Racket clothing program, Feeding Our Future, or Healing Pathways, call the church at 403-938-4357",
      "Email okunited@telus.net for information about community programs and how to access services",
      "Visit during office hours: Monday-Thursday 10 AM - 2 PM, Friday 10 AM - 12 PM at 43 Riverside Drive, Okotoks",
      "For urgent pastoral care needs, call Rev. Julia Kimmett at (403) 702-2249"
    ],
    eligibility: null,
    hours: "Office: Monday-Thursday 10 AM - 2 PM, Friday 10 AM - 12 PM",
    phone: "403-938-4357", email: "okunited@telus.net",
    confidence: 82,
    source_urls: ["https://www.okunited.ca/"],
    website_url: null,
  },
  {
    id: 2981,
    description: "Robertson-Wesley United Church is a community hub in the heart of Edmonton that operates a weekly Food Bank Depot every Wednesday where individuals collect hampers ordered through the Edmonton Food Bank. The Magic Pantry program distributes ready-to-eat bagged lunches to those in need on Mondays, Tuesdays, and Thursdays from 12:00 to 1:00 PM. The church also hosts a monthly Community Dinner serving a free hot meal to up to 200 people, and provides funding, food donations, and volunteering to support Operation Friendship, Inner-City Pastoral Ministry, and Bissell Centre.",
    process_steps: [
      "For Food Bank hampers, order through the Edmonton Food Bank and pick up at Robertson-Wesley on Wednesdays",
      "For a ready-to-eat bagged lunch, visit the Magic Pantry on Mondays, Tuesdays, or Thursdays between 12:00 PM and 1:00 PM",
      "For the free monthly Community Dinner, check the church website or call for the next date — meals are served in Memorial Hall",
      "Visit Robertson-Wesley United Church at 10209 123 Street NW, Edmonton, or check rwuc.org/outreach for program details"
    ],
    eligibility: "Open to all community members in need. No membership or religious affiliation required.",
    hours: "Magic Pantry: Monday, Tuesday, Thursday 12:00 PM - 1:00 PM. Food Bank Depot: Wednesdays. Community Dinner: once monthly.",
    phone: null, email: null,
    confidence: 90,
    source_urls: ["https://www.rwuc.org/", "https://www.rwuc.org/outreach"],
    website_url: "https://www.rwuc.org/outreach",
  },
  // === Social service organizations ===
  {
    id: 3068,
    description: "PAL Calgary is a non-profit charitable organization serving the arts community by championing opportunities for accessible and affordable housing, fostering a sense of social connection, and identifying additional resources for Calgary based artists and arts workers. This includes artists, administrative workers, technical workers or anyone else who works or has worked in the artistic community.",
    process_steps: [
      "Visit the PAL Calgary website at palcalgary.com to learn about current housing initiatives and resources",
      "Check the Resources page for a listing of local resources to assist with a variety of needs",
      "Contact PAL Calgary through the website form for information about affordable housing opportunities for artists"
    ],
    eligibility: "Calgary-based artists and arts workers, including administrative workers, technical workers, or anyone who works or has worked in the artistic community",
    hours: null,
    phone: null, email: null,
    confidence: 75,
    source_urls: ["https://www.palcalgary.com/"],
    website_url: null,
  },
  {
    id: 2699,
    description: "Impact Society is committed to empowering youth by promoting the development of long-term mental health and well-being through evidence-based Heroes social-emotional learning programs. By working with schools, parents, caregivers, and community partners, they help create a supportive environment that promotes mental health and well-being, empowering young people to overcome challenges and thrive in their personal and professional lives.",
    process_steps: [
      "Visit impactsociety.com/programs to explore available Heroes programs for youth",
      "Book a Discovery Call through the website to discuss program options for your school or community",
      "Register as an educator or facilitator through the Educator Path to bring Heroes programs to your students"
    ],
    eligibility: "Youth in schools across Alberta; Alberta students eligible for high school credits through virtual Heroes courses",
    hours: null,
    phone: null, email: null,
    confidence: 80,
    source_urls: ["https://www.impactsociety.com/"],
    website_url: "https://www.impactsociety.com/programs",
  },
  {
    id: 2979,
    description: "Al Fajr Islamic Centre Edmonton is dedicated to illuminating intellects and nurturing souls through the sacred knowledge of Qur'an and Sunnah. Qualified teachers conduct classes for children and sisters in both Urdu and English. Programs include the A'limah Program, Weekly Tafseer Halaqah, Kids Summer Camp, and regular Islamic education courses.",
    process_steps: [
      "Visit alfajr.ca/courses/ to explore current programs including the A'limah Program, Weekly Tafseer Halaqah, and Kids Summer Camp",
      "Register for courses through the Google Forms links on the website",
      "Contact Al Fajr at 587-315-1666 or info@alfajr.ca for more information about programs and registration"
    ],
    eligibility: "Open to community members; programs available for children (ages 7-10 for summer camp) and sisters",
    hours: null,
    phone: "587-315-1666", email: "info@alfajr.ca",
    confidence: 85,
    source_urls: ["https://alfajr.ca/"],
    website_url: "https://alfajr.ca/courses/",
  },
  {
    id: 3025,
    description: "FOCAS Canada is dedicated to empowering and supporting newcomers, refugees, and immigrants — particularly the underserved community — as they navigate life in Canada. Through settlement services, employment support, language training, and cultural programs, they help individuals build resilience and confidently participate in Canadian society.",
    process_steps: [
      "Visit focascanada.org/programs-services/ to learn about available programs including Youth Training & Employment, Women and Youth Employment, Sponsorship and Settlement, and Senior Services",
      "Contact FOCAS Canada to discuss which program best fits your needs",
      "Volunteer or get involved by visiting the volunteer page at focascanada.org/volunteer"
    ],
    eligibility: "Newcomers, refugees, and immigrants in Edmonton, particularly underserved community members",
    hours: null,
    phone: null, email: null,
    confidence: 85,
    source_urls: ["https://focascanada.org/"],
    website_url: "https://focascanada.org/programs-services/",
  },
  {
    id: 856,
    description: "The Community Impact Centre Canora offers a warm, safe, and inclusive space for community members in west Edmonton. Programs include meals, recreational activities, and art nights. The centre also provides access to essential services such as housing supports, hygiene and clothing items, mail service, ID clinics, and more.",
    process_steps: [
      "Visit the Community Impact Centre Canora at 15740 Stony Plain Road NW, Edmonton",
      "Drop in during operating hours — Monday to Friday 9:00 AM to 4:00 PM, Weekends 10:00 AM to 4:00 PM",
      "On Thursdays from 9:00 AM - 12:00 PM, Jasper Place Wellness Centre is on site to assist with housing support",
      "Call 1-833-448-4673 or email InfoEdmonton@theseed.ca with questions"
    ],
    eligibility: "Everyone is welcome. Doors are open to anyone seeking support, connection, or a safe space.",
    hours: "Monday - Friday: 9:00 AM - 4:00 PM | Weekends: 10:00 AM - 4:00 PM",
    phone: "1-833-448-4673", email: "InfoEdmonton@theseed.ca",
    confidence: 90,
    source_urls: ["https://theseed.ca/cic-canora"],
    website_url: null,
  },
  {
    id: 560,
    description: "For 40 years, The Mustard Seed has been a safe, supportive haven for individuals experiencing poverty and homelessness. In Edmonton, basic necessities services include warm meals, clothing, and hygiene products through community centres and shelters, with the goal of helping people make positive, lasting changes in their lives.",
    process_steps: [
      "Visit any Mustard Seed Edmonton location for basic necessities including meals, clothing, and hygiene items",
      "Call 1-833-448-4673 for help finding the right Mustard Seed service or location",
      "Visit the Community Impact Centre Canora at 15740 Stony Plain Road NW or the Mosaic Centre in north Edmonton for drop-in support"
    ],
    eligibility: "Anyone experiencing poverty or homelessness in Edmonton",
    hours: null,
    phone: "1-833-448-4673", email: null,
    confidence: 75,
    source_urls: ["https://theseed.ca/services"],
    website_url: null,
  },
  {
    id: 568,
    description: "The Mustard Seed Red Deer Community Impact Centre serves as a hub for accessing basic necessities and connecting with wellness, employment, and other support services. The centre provides community members with warm meals, clothing, and hygiene products, along with counselling, ID assistance, income support, and housing referrals.",
    process_steps: [
      "Visit The Mustard Seed Red Deer Community Impact Centre at 6002 54 Ave, Red Deer",
      "Drop in to access warm meals, clothing, and hygiene products",
      "Speak with wellness staff about additional support including counselling, ID assistance, income support, and housing",
      "For employment support, connect with the Employment Program on-site"
    ],
    eligibility: "Anyone experiencing homelessness or poverty in Red Deer",
    hours: null,
    phone: null, email: null,
    confidence: 80,
    source_urls: ["https://theseed.ca/services"],
    website_url: "https://theseed.ca/reddeer",
  },
  {
    id: 162,
    description: "The Problem Gambling Resources Network is committed to helping individuals and communities address gambling in a healthy and responsible way through public awareness, education, advocacy, prevention, treatment/referral and research. The PGRN offers 1 to 2 hour presentations aimed at promoting awareness about how gambling can impact the community and individuals.",
    process_steps: [
      "Visit the Problem Gambling Resources Network website at problemgamblingalberta.ca",
      "Explore the Help & Recovery section for types of help available in Alberta",
      "Use the Contact Us page to reach out for support or referrals",
      "Request a workshop or presentation through the Presentation Request Form"
    ],
    eligibility: null,
    hours: null,
    phone: null, email: null,
    confidence: 80,
    source_urls: ["https://problemgamblingalberta.ca"],
    website_url: null,
  },
  {
    id: 783,
    description: "United Cultures of Canada Association is a non-profit community based organization working to create situations of social inclusion for immigrant communities leading to their effective participation and successful integration into Canadian society. Services include education, language training, free multicultural legal facilitation, free interpreting, and settlement resources for newcomers.",
    process_steps: [
      "Visit ucca.ca to learn about available programs for newcomers and immigrants",
      "Use the Contact page to reach out about counselling or settlement services",
      "Join a training program by selecting your desired course on the website and submitting the registration form",
      "Access free interpreting or legal facilitation services through the programs page"
    ],
    eligibility: "Persons of all cultures are welcome. Programs focus on newcomers and immigrant communities in Edmonton.",
    hours: null,
    phone: null, email: null,
    confidence: 80,
    source_urls: ["https://www.ucca.ca"],
    website_url: "https://www.ucca.ca/contacts/",
  },
  {
    id: 753,
    description: "Elizabeth Fry Society of Calgary supports individual pathways to healing by restoring harmony, reparation of harm, and regaining relationships. Working from the context of Indigenous natural laws, the organization supports individuals who have been systemically criminalized, with services including Indigenous cultural supports through access to Elders and Knowledge Holders, ceremonies, cultural activities and programs.",
    process_steps: [
      "Visit elizabethfrycalgary.ca and navigate to the Programs section to learn about Dana's House and other services",
      "Connect with the organization through their website to learn about eligibility and referral process",
      "Access Indigenous Cultural Supports to reconnect with culture and community"
    ],
    eligibility: "Women and Indigenous relatives who have been systemically criminalized",
    hours: null,
    phone: null, email: null,
    confidence: 75,
    source_urls: ["https://elizabethfrycalgary.ca"],
    website_url: null,
  },
  {
    id: 512,
    description: "YWCA Lethbridge offers Hope Transitional Housing as part of its programs supporting women and families escaping violence and homelessness. When you need somewhere to turn, YWCA Lethbridge is here for you, offering a wide variety of programs so you and your family can find an escape from violence and homelessness.",
    process_steps: [
      "Visit ywcalethbridge.com/services/hope-transitional-housing/ for program details",
      "Contact YWCA Lethbridge directly for intake and referral information",
      "If you need immediate safety, ask about the Harbour House Emergency Shelter as well"
    ],
    eligibility: null,
    hours: null,
    phone: null, email: null,
    confidence: 80,
    source_urls: ["https://ywcalethbridge.com"],
    website_url: "https://ywcalethbridge.com/services/hope-transitional-housing/",
  },
  {
    id: 702,
    description: "AGLC's Self-Exclusion Program is here to help when it feels like gambling has taken over your life. By enrolling in the program, you can choose to self-exclude from Alberta's casinos and racing entertainment centres, regulated iGaming platforms, or both. After choosing a period between six months and three years, taking this pause can help put your future back in your hands.",
    process_steps: [
      "Visit selfexclusion.ca to learn about the program",
      "Click 'Sign Up' to begin the self-exclusion registration process online",
      "Choose your exclusion type: casinos, iGaming platforms, or both",
      "Select your self-exclusion period between six months and three years",
      "Call 1-844-468-8034 to speak with a representative if you have questions",
      "Consider combining self-exclusion with professional counselling support for the best results"
    ],
    eligibility: "Anyone in Alberta who wants to take a break from gambling",
    hours: null,
    phone: "1-844-468-8034", email: null,
    confidence: 90,
    source_urls: ["https://www.selfexclusion.ca/s/"],
    website_url: "https://www.selfexclusion.ca/s/",
  },
  {
    id: 230,
    description: "The Calgary Food Bank is making food accessible to everyone in the city. You can access a hamper every 10 days with an efficient drive-thru hamper pick-up service. You can request a hamper online anytime, and pick up a hamper closer to home or work at one of the satellite locations throughout the city.",
    process_steps: [
      "Request a food hamper online anytime at calgaryfoodbank.com/needfoodform/",
      "You can access a hamper every 10 days — no limit on total uses",
      "Pick up your hamper at the main location or a satellite location closer to you",
      "The Food Bank is open weekdays and Saturdays",
      "If you need support beyond food, visit 211 Alberta at ab.211.ca to get connected to other organizations"
    ],
    eligibility: null,
    hours: "Open weekdays and Saturdays",
    phone: null, email: null,
    confidence: 88,
    source_urls: ["https://www.calgaryfoodbank.com"],
    website_url: "https://www.calgaryfoodbank.com/needfood/",
  },
  {
    id: 2733,
    description: "As one of Alberta's longest serving charities, the Children's Ability Fund's mission is to provide funding to enhance the independence of children and young adults with disabilities throughout Alberta by providing funding for specialized equipment.",
    process_steps: [
      "Visit childrensabilityfund.ca to learn about the fund",
      "Navigate to the About Us page for details on how the funding works",
      "Apply for funding for specialized equipment for a child or young adult with a disability",
      "Contact the organization through their website for application details"
    ],
    eligibility: "Children and young adults with disabilities throughout Alberta",
    hours: null,
    phone: null, email: null,
    confidence: 80,
    source_urls: ["https://www.childrensabilityfund.ca"],
    website_url: null,
  },
  {
    id: 2686,
    description: "Crowsnest Community Support Society (CCSS) is a not-for-profit organization located in the scenic Crowsnest Pass, Alberta, established in 1964. Their purpose is fostering community through purpose and inclusion. Services offered include community vocational opportunities through The Thrift Store and The Woodshop, volunteer positions, attainable residential housing for adults requiring higher levels of care, and a Creative Works Program for seniors.",
    process_steps: [
      "Visit crowsnestcommunitysupportsociety.ca to learn about available programs",
      "Explore vocational opportunities at The Thrift Store (Bagatelle) or The Woodshop",
      "Contact the society through the Contact & Staff page for residential housing inquiries",
      "Ask about the Creative Works Program if you are a senior interested in woodshop projects"
    ],
    eligibility: "Adults with disabilities; seniors (Creative Works Program); community members seeking vocational opportunities",
    hours: null,
    phone: null, email: null,
    confidence: 85,
    source_urls: ["https://www.crowsnestcommunitysupportsociety.ca"],
    website_url: null,
  },
  {
    id: 2963,
    description: "Dashmesh Culture Centre in Calgary is a Sikh community centre offering a range of programs and services including food security projects, women's transitional housing, a community garden, and Gurmat (religious education) classes. The centre partners with organizations like Centre for Newcomers, Calgary Immigrant Women's Association, and Sagesse to serve the community.",
    process_steps: [
      "Visit dashmesh.ca to learn about available community programs",
      "Explore the Food Security Projects for food assistance",
      "Contact the centre for information about women's transitional housing",
      "Call 403-590-0970 or email info@dashmesh.ca for general inquiries"
    ],
    eligibility: null,
    hours: null,
    phone: "403-590-0970", email: "info@dashmesh.ca",
    confidence: 85,
    source_urls: ["https://www.dashmesh.ca"],
    website_url: null,
  },
  {
    id: 2771,
    description: "Edmonton Emergency Response and Newcomers Services (EERNS) empowers and helps the community and newcomers. Through many disasters and world events, EERNS aims to provide refugees and newcomers with services starting with their basic needs. The organization also offers assistance and supplies to those experiencing homelessness, and helps those impacted by fire, natural disasters, or other life challenges to get back on their feet.",
    process_steps: [
      "Call (780) 700-8218 or (780) 700-2281 to speak with someone about your needs",
      "Email info@eerns.ca with any questions about available support",
      "Visit eerns.ca to learn about available services for newcomers, refugees, and those in need"
    ],
    eligibility: "Newcomers, refugees, individuals experiencing homelessness, and those impacted by fire or disaster",
    hours: null,
    phone: "(780) 700-8218", email: "info@eerns.ca",
    confidence: 85,
    source_urls: ["https://www.eerns.ca"],
    website_url: null,
  },
  {
    id: 2819,
    description: "Living Springs Airdrie is a church community offering a food pantry, pastoral visits, clubs and groups, and various ministries including youth, young adults, women's, and men's ministries. Resources include a food pantry request form, pastoral visit requests, prayer request forms, and LGBTQ resources.",
    process_steps: [
      "Submit a Food Pantry Request Form on the website at livingspringsairdrie.com if you need food assistance",
      "Request a Pastoral Visit through the online form for spiritual or personal support",
      "Join a club, group, or ministry that fits your needs",
      "Office hours: Tuesday 10am-2pm, Wednesday-Friday 9am-3pm"
    ],
    eligibility: null,
    hours: "Office: Tue 10am-2pm, Wed-Fri 9am-3pm",
    phone: null, email: null,
    confidence: 80,
    source_urls: ["https://livingspringsairdrie.com"],
    website_url: "https://livingspringsairdrie.com/food-pantry-request-form",
  },
  {
    id: 233,
    description: "Muslim Families Network Society (MFNS) is a non-profit organization working to enhance the physical, social, and spiritual well-being of individuals and families in Calgary and area by providing education and awareness, poverty relief and social supports based on Islamic principles and values. Services include halal food and clothing distribution, youth empowerment programs, single mothers' self-sufficiency program, and programs to help bridge cultural gaps for newcomers.",
    process_steps: [
      "Visit muslimfamilynetwork.org to learn about available programs and services",
      "Register with MFNS if you need food, clothing, or other essential support",
      "Ask about the Single Mothers' Self-Sufficiency Program for life skills, counselling, and literacy support",
      "Explore youth empowerment programs for children ages 11-16"
    ],
    eligibility: "Muslim individuals and families in Calgary and area; programs also serve newcomers from various cultural backgrounds",
    hours: null,
    phone: null, email: null,
    confidence: 85,
    source_urls: ["https://www.muslimfamilynetwork.org"],
    website_url: null,
  },
  {
    id: 3065,
    description: "North East Calgary Adopt A Family Society (NECAAFS) is a non-profit organization of volunteers that develops and provides resources through delivery of short term program services for North East Calgary's financially challenged individuals and families. Programs include a Christmas Hamper Program matching donors with recipients, a School Supplies Program for students from preschool to post-secondary, a Baby Hamper Program for families with young children referred by social workers, and an Emergency Food & Personal Hygiene Program providing hampers and gift certificates year-round.",
    process_steps: [
      "Visit necaafs.com to learn about available programs",
      "For the Christmas Program, check the website for annual registration deadlines",
      "For school supplies, ask your school or referral agency about the School Supplies Program",
      "Baby Hamper referrals come through social workers or public health nurses",
      "For emergency food hampers, contact NECAAFS through their website contact page"
    ],
    eligibility: "Low-income individuals and families in North East Calgary. Baby Hamper Program requires referral from social workers or public health nurses.",
    hours: null,
    phone: null, email: null,
    confidence: 85,
    source_urls: ["https://www.necaafs.com"],
    website_url: null,
  },
  {
    id: 2977,
    description: "Sanatan Hindu Cultural Society is an organization built on the core values of Sanatan Dharma, promoting and manifesting the timeless and eternal doctrines, observations and practices advocated in Hinduism. The society offers spiritual discourses, festivals and related cultural activities such as music, dance, drama, and language classes.",
    process_steps: [
      "Visit shcscalgary.com to learn about temple activities and cultural services",
      "Book sevas and services by contacting Manorama Patki at 403-608-6331",
      "Call 587-351-7427 for general inquiries or email info@shcscalgary.com",
      "Check the Activities page for upcoming festivals and cultural events"
    ],
    eligibility: null,
    hours: null,
    phone: "587-351-7427", email: "info@shcscalgary.com",
    confidence: 82,
    source_urls: ["https://shcscalgary.com"],
    website_url: null,
  },
  {
    id: 2518,
    description: "The Association of the Devon Christmas Elves is comprised of a group of dedicated volunteers who come together each year to ensure that every family experiences the joy of Christmas. The organization provides gift card hampers for low-income families. 100% of all donations are utilized for the hampers, and financial donations are collected year-round.",
    process_steps: [
      "Visit devonchristmaselves.com to learn about the program",
      "Check the Referral page during the campaign season (deadline is typically early December) to register your family",
      "If you miss the deadline, call the Leduc Food Bank at 780-986-5353 for assistance"
    ],
    eligibility: "Low-income families in the Devon, Alberta area",
    hours: "Seasonal program — campaign runs annually leading up to Christmas",
    phone: null, email: null,
    confidence: 82,
    source_urls: ["https://devonchristmaselves.com"],
    website_url: null,
  },
  {
    id: 900,
    description: "Turning Point Society offers low barrier, equitable access to health promotion and social programming which has expanded over the three decades they have served Central Alberta. Their programming offers a compassionate and person-centred approach, working to empower individuals, reduce risks, save lives and seek solutions that foster improved safety and wellness.",
    process_steps: [
      "Visit turningpoint-ca.org to learn about available programming",
      "Contact the admin office at 402-4808 50 Street, Red Deer for inquiries",
      "Office hours for donations: Monday to Friday, 9am-12pm and 1pm-5pm",
      "Reach out to inquire about mobile outreach services in Central Alberta"
    ],
    eligibility: "Individuals experiencing chronic homelessness and/or complex health issues in Central Alberta",
    hours: "Admin office: Monday-Friday 9am-12pm, 1pm-5pm",
    phone: null, email: null,
    confidence: 80,
    source_urls: ["https://www.turningpoint-ca.org"],
    website_url: null,
  },
  {
    id: 2587,
    description: "Discovery House is a family violence prevention society helping thousands of families with children fleeing domestic violence, providing a safe place to call home and services to help them heal and rebuild their lives. Services include second-stage shelter, community housing, programs for children and youth, programs for women, and Indigenous reconciliation programming.",
    process_steps: [
      "Visit discoveryhouse.ca/get-help/ for information on accessing services",
      "Learn about available housing options including second-stage shelter and community housing",
      "Explore client programs for women, children, and youth",
      "Contact Discovery House through the website for intake and referral information"
    ],
    eligibility: "Families with children fleeing domestic violence",
    hours: null,
    phone: null, email: null,
    confidence: 85,
    source_urls: ["https://discoveryhouse.ca"],
    website_url: "https://discoveryhouse.ca/get-help/",
  },
  {
    id: 145,
    description: "EHN Canada is the nation's leading provider of evidence-based addiction and mental health treatment, operating inpatient facilities and virtual treatment programs. They treat complex cases of addiction, mental health disorders, and concurrent conditions, with patients receiving one-to-one therapy and attentive support reinforced by a strong clinician-to-patient ratio. The Red Deer Recovery Community is their Alberta inpatient facility.",
    process_steps: [
      "Call 1-866-963-6343 for immediate, confidential help around the clock",
      "Visit edgewoodhealthnetwork.com/locations/red-deer-recovery-community/ for Alberta-specific program details",
      "Fill out the confidential inquiry form at edgewoodhealthnetwork.com/admissions/",
      "Take the free online screener to see if treatment is right for you"
    ],
    eligibility: null,
    hours: "24/7 phone support available",
    phone: "1-866-963-6343", email: null,
    confidence: 88,
    source_urls: ["https://www.edgewoodhealthnetwork.com"],
    website_url: "https://www.edgewoodhealthnetwork.com/locations/red-deer-recovery-community/",
  },
  {
    id: 428,
    description: "Wood Buffalo Wellness Society is a non-profit organization providing residential therapeutic treatment and Housing with Supports Case Management solutions to individuals and families facing addiction and homelessness. For over 15 years, the society has been supporting the community, with programming that blends traditional Indigenous knowledge and ceremonies with evidence-based addiction treatment.",
    process_steps: [
      "Visit woodbuffalowellnesssociety.com to learn about available treatment programs",
      "Explore the Mark Amy Treatment Centre page for residential addiction treatment details",
      "Ask about Housing with Supports Case Management if you are experiencing homelessness",
      "Contact the society through their website to begin the intake process"
    ],
    eligibility: "Individuals and families facing addiction and homelessness in the Wood Buffalo region",
    hours: null,
    phone: null, email: null,
    confidence: 85,
    source_urls: ["https://www.woodbuffalowellnesssociety.com"],
    website_url: null,
  },
];

const deactivations = [
  { id: 2929, name: "Advent Lutheran Church", reason: "Church with worship services, Bible studies, and social events only — no direct social service programs found on website." },
  { id: 2731, name: "Hope City Church (Edmonton)", reason: "Multi-campus megachurch with worship/youth ministry only. Existing 'clothing bank' claim could not be verified anywhere on the website." },
  { id: 2679, name: "Westside King's Church", reason: "Church with worship/youth/small groups only — aspirational community language but no documented social service programs." },
  { id: 3057, name: "Fifth Avenue Memorial United Church", reason: "Church with worship services only — categorized as Food Banks & Meals but no food programs found on website." },
  { id: 2828, name: "Profound Walk with God Ministry", reason: "Small Bible teaching ministry — no social services. Website appears dated (2012-2015)." },
  { id: 801,  name: "Fort City Church — Counselling Services (Legacy)", reason: "Church homepage with no mention of Legacy Counselling or any counselling program — service cannot be verified from website." },
  { id: 2571, name: "SAM Ministries", reason: "Operates in Mozambique and Brazil only — not an Alberta social service provider." },
  { id: 2824, name: "Carstairs Bancroft United Church", reason: "DEAD-SITE: Domain carstairsunitedchurch.ca is parked with Porkbun — no website exists." },
  { id: 195,  name: "Rainbow Alliance for Youth", reason: "DEAD-SITE: Domain rainbowallianceyeg.ca is parked — no website content." },
  { id: 719,  name: "AAWEAR", reason: "DEAD-SITE: Website aawear.org is completely down ('Site Currently Unavailable')." },
];

async function main() {
  const client = await pool.connect();
  try {
    console.log(`\n=== Tier 2 Enrichment: Non-Campus Services (conf 50-69) ===`);
    console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
    console.log(`Enrichments: ${enrichments.length}`);
    console.log(`Deactivations: ${deactivations.length}`);
    console.log(`Total: ${enrichments.length + deactivations.length}\n`);

    let updated = 0, reviewed = 0, deactivated = 0, urlsFixed = 0, errors = 0;

    // ---- Phase 1: Enrich services ----
    console.log("--- Phase 1: Enriching services ---");
    for (const e of enrichments) {
      const setClauses = [];
      const values = [e.id];
      let idx = 2;

      const fields = {
        description: e.description,
        phone: e.phone,
        email: e.email,
        hours_of_operation: e.hours,
        process_steps: e.process_steps ? JSON.stringify(e.process_steps) : null,
        eligibility: e.eligibility,
        confidence_score: e.confidence,
        source_urls: e.source_urls ? JSON.stringify(e.source_urls) : null,
        enrichment_source: "found",
        enrichment_date: new Date().toISOString(),
      };

      // Update website_url if we found a better program-specific page
      if (e.website_url) {
        fields.website_url = e.website_url;
      }

      for (const [key, val] of Object.entries(fields)) {
        if (val === null || val === undefined) continue;
        setClauses.push(`${key} = $${idx}`);
        values.push(val);
        idx++;
      }

      if (setClauses.length === 0) continue;

      if (!DRY_RUN) {
        try {
          await client.query(
            `UPDATE services SET ${setClauses.join(", ")}, last_updated = NOW() WHERE id = $1`,
            values
          );

          const svc = (await client.query(
            `SELECT id, service_id, name, category, description, location, eligibility, process_steps,
                    hours_of_operation, phone, email, website_url, address
             FROM services WHERE id = $1`, [e.id]
          )).rows[0];

          if (svc) {
            const proposedChanges = {
              id: svc.id, name: svc.name, category: svc.category,
              description: svc.description || "", location: svc.location || "",
              eligibility: svc.eligibility || "", processSteps: svc.process_steps,
              hoursOfOperation: svc.hours_of_operation || "",
              phone: svc.phone || "", email: svc.email || "",
              websiteUrl: svc.website_url || "", address: svc.address || "",
              isActive: true,
            };

            await client.query(`
              INSERT INTO service_change_requests
                (service_id, change_type, proposed_changes, source, source_plugin, batch_id, status)
              VALUES ($1, 'update', $2, 'tier2-reenrich', 'firecrawl-reenrich', $3, 'pending')
            `, [svc.id, JSON.stringify(proposedChanges), BATCH_ID]);
            reviewed++;
          }

          updated++;
          if (e.website_url) urlsFixed++;
          console.log(`  [UPD] id=${e.id} conf=${e.confidence}${e.website_url ? ' URL-FIXED' : ''}`);
        } catch (err) {
          console.error(`  [ERR] id=${e.id}: ${err.message}`);
          errors++;
        }
      } else {
        console.log(`  [DRY] id=${e.id} conf=${e.confidence}${e.website_url ? ' URL→' + e.website_url.substring(0, 50) : ''}`);
        updated++;
        if (e.website_url) urlsFixed++;
      }
    }

    // ---- Phase 2: Deactivations ----
    console.log("\n--- Phase 2: Deactivating non-service entries ---");
    for (const d of deactivations) {
      if (!DRY_RUN) {
        try {
          await client.query(`UPDATE services SET is_active = false, last_updated = NOW() WHERE id = $1`, [d.id]);

          const svc = (await client.query(
            `SELECT id, service_id, name, category, description, location, eligibility, process_steps,
                    hours_of_operation, phone, email, website_url, address
             FROM services WHERE id = $1`, [d.id]
          )).rows[0];

          if (svc) {
            const proposedChanges = {
              id: svc.id, name: svc.name, category: svc.category,
              description: svc.description || "", location: svc.location || "",
              isActive: false,
              _deactivationReason: d.reason,
            };

            await client.query(`
              INSERT INTO service_change_requests
                (service_id, change_type, proposed_changes, source, source_plugin, batch_id, status)
              VALUES ($1, 'update', $2, 'tier2-reenrich', 'firecrawl-reenrich', $3, 'pending')
            `, [svc.id, JSON.stringify(proposedChanges), BATCH_ID]);
          }

          deactivated++;
          console.log(`  [OFF] id=${d.id} "${d.name}" — ${d.reason.substring(0, 60)}`);
        } catch (err) {
          console.error(`  [ERR] id=${d.id}: ${err.message}`);
          errors++;
        }
      } else {
        console.log(`  [DRY-OFF] id=${d.id} "${d.name}"`);
        deactivated++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Enriched: ${updated}`);
    console.log(`URLs fixed to program pages: ${urlsFixed}`);
    console.log(`Change requests created: ${reviewed + deactivated}`);
    console.log(`Deactivated: ${deactivated}`);
    console.log(`Errors: ${errors}`);
    console.log(`\nSkipped (need manual review): 124, 810, 670, 776, 931, 2834, 2884`);
    if (DRY_RUN) console.log(`\nDRY RUN. Run with DRY_RUN=false to apply.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
