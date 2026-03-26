/**
 * SEO Landing Page Configuration
 *
 * Single source of truth for category and city landing pages.
 * Maps URL slugs to DB categories, meta text, and search queries.
 */

export interface CategoryPage {
  slug: string;
  label: string;
  dbCategories: string[];
  query: string; // reused from CategoryTiles for "search all" CTA
  metaTitle: string;
  metaDescription: string;
  intro: string; // unique paragraph for SEO content
}

export interface CityPage {
  slug: string;
  label: string;
}

export const CATEGORY_PAGES: CategoryPage[] = [
  {
    slug: "crisis-support",
    label: "Crisis Support",
    dbCategories: ["Crisis Services", "Crisis Lines"],
    query: "crisis support emergency help",
    metaTitle: "Crisis Support Services in Alberta",
    metaDescription: "Find crisis support services across Alberta. Access 24/7 helplines, emergency mental health support, and immediate crisis intervention resources.",
    intro: "When you or someone you know is in crisis, immediate help is available. Alberta Resource Hub connects you with crisis helplines, emergency mental health services, and walk-in crisis centres across the province. Many of these services operate 24/7 and are free to access.",
  },
  {
    slug: "domestic-violence",
    label: "Domestic Violence",
    dbCategories: ["Domestic Violence Support", "Human Trafficking Support"],
    query: "domestic violence abuse safety support",
    metaTitle: "Domestic Violence Support Services in Alberta",
    metaDescription: "Find domestic violence support in Alberta. Access shelters, safety planning, counselling, legal advocacy, and 24/7 crisis lines for survivors of abuse.",
    intro: "Alberta Resource Hub lists shelters, safety planning services, counselling, and legal advocacy for individuals and families affected by domestic violence. These services are confidential and many offer 24/7 support. If you are in immediate danger, call 911.",
  },
  {
    slug: "mental-health",
    label: "Mental Health",
    dbCategories: ["Mental Health & Counselling", "Trauma & PTSD Support", "Grief & Bereavement", "Eating Disorder Services", "Gambling Support"],
    query: "mental health counselling therapy",
    metaTitle: "Mental Health Services in Alberta",
    metaDescription: "Find mental health counselling, therapy, and support services in Alberta. Access free and low-cost programs for anxiety, depression, trauma, grief, and more.",
    intro: "Alberta Resource Hub helps you find mental health support including counselling, therapy, peer support groups, and specialized programs for trauma, grief, eating disorders, and gambling. Many services offer sliding-scale fees or are free through Alberta Health Services.",
  },
  {
    slug: "addiction-recovery",
    label: "Addiction Recovery",
    dbCategories: ["Addiction Treatment", "Recovery & Peer Support", "Harm Reduction", "Detox & Withdrawal", "Residential Treatment"],
    query: "addiction recovery treatment",
    metaTitle: "Addiction Recovery Services in Alberta",
    metaDescription: "Find addiction recovery and treatment services in Alberta. Access detox, residential treatment, outpatient programs, harm reduction, and peer support groups.",
    intro: "Alberta Resource Hub connects you with addiction recovery services including medical detox, residential treatment centres, outpatient programs, harm reduction services, and peer support groups like AA and SMART Recovery. Services range from immediate crisis support to long-term recovery programs.",
  },
  {
    slug: "housing",
    label: "Housing",
    dbCategories: ["Emergency Shelter", "Transitional Housing", "Affordable Housing", "Supportive Housing"],
    query: "housing shelter accommodation",
    metaTitle: "Housing & Shelter Services in Alberta",
    metaDescription: "Find housing support in Alberta. Access emergency shelters, transitional housing, affordable housing programs, and rent assistance across the province.",
    intro: "Alberta Resource Hub lists emergency shelters, transitional housing, affordable housing programs, and supportive living options across the province. Whether you need a safe place tonight or long-term housing support, these services can help you find stable accommodation.",
  },
  {
    slug: "food-basic-needs",
    label: "Food & Basic Needs",
    dbCategories: ["Food Banks & Meals", "Basic Needs & Material Aid", "Transportation Assistance"],
    query: "food bank meals basic needs",
    metaTitle: "Food Banks & Basic Needs Services in Alberta",
    metaDescription: "Find food banks, free meals, clothing, and basic needs assistance in Alberta. Access community resources for groceries, household items, and material aid.",
    intro: "Alberta Resource Hub connects you with food banks, community meal programs, clothing depots, and material aid services. These resources help individuals and families access groceries, prepared meals, household essentials, and transportation support at no cost.",
  },
  {
    slug: "healthcare",
    label: "Healthcare",
    dbCategories: ["Healthcare Access", "Hospital & Emergency", "Sexual Health Services"],
    query: "healthcare medical clinic",
    metaTitle: "Healthcare Services in Alberta",
    metaDescription: "Find healthcare services in Alberta. Access hospitals, walk-in clinics, community health centres, and specialized medical programs across the province.",
    intro: "Alberta Resource Hub lists hospitals, walk-in clinics, community health centres, and specialized healthcare programs. Find urgent care locations, sexual health clinics, and programs that help Albertans navigate the healthcare system and access the medical services they need.",
  },
  {
    slug: "disability-support",
    label: "Disability Support",
    dbCategories: ["Disability & Autism Support"],
    query: "disability support accessibility",
    metaTitle: "Disability Support Services in Alberta",
    metaDescription: "Find disability and accessibility support services in Alberta. Access programs for autism, physical disabilities, developmental support, and independent living.",
    intro: "Alberta Resource Hub connects you with disability support services including programs for autism spectrum disorder, physical disabilities, developmental disabilities, and independent living. Find respite care, assistive technology, employment support, and advocacy services.",
  },
  {
    slug: "social-connection",
    label: "Social Connection",
    dbCategories: ["Community & Social Connection", "LGBTQ2S+ Services", "Newcomer & Settlement"],
    query: "social connection community recreation programs",
    metaTitle: "Community & Social Connection Services in Alberta",
    metaDescription: "Find community programs, social groups, newcomer settlement services, and LGBTQ2S+ support in Alberta. Connect with recreation, cultural, and peer programs.",
    intro: "Alberta Resource Hub lists community centres, social groups, recreation programs, newcomer settlement services, and LGBTQ2S+ support organizations. These services help Albertans build connections, find belonging, and access cultural and community resources.",
  },
  {
    slug: "family-parenting",
    label: "Family & Parenting",
    dbCategories: ["Family & Parenting Support", "Youth Services"],
    query: "family parenting pregnancy child support",
    metaTitle: "Family & Parenting Support Services in Alberta",
    metaDescription: "Find family and parenting support in Alberta. Access prenatal programs, parenting classes, youth services, childcare resources, and family counselling.",
    intro: "Alberta Resource Hub connects families with parenting programs, prenatal and postnatal support, youth services, family counselling, and childcare resources. From pregnancy through adolescence, these services support Alberta families at every stage.",
  },
  {
    slug: "employment",
    label: "Employment",
    dbCategories: ["Employment Services", "Financial Counselling & Debt Help"],
    query: "employment job training work",
    metaTitle: "Employment & Job Training Services in Alberta",
    metaDescription: "Find employment services in Alberta. Access job training, resume help, career counselling, financial literacy programs, and workplace readiness support.",
    intro: "Alberta Resource Hub lists employment services including job training programs, resume and interview preparation, career counselling, financial literacy workshops, and workplace readiness support. Many programs are free and designed for individuals facing barriers to employment.",
  },
  {
    slug: "legal-aid",
    label: "Legal Aid",
    dbCategories: ["Legal Aid", "Criminal Justice Reintegration"],
    query: "legal aid lawyer court advocacy",
    metaTitle: "Legal Aid & Advocacy Services in Alberta",
    metaDescription: "Find legal aid and advocacy services in Alberta. Access free legal advice, court support, tenant rights help, and reintegration programs.",
    intro: "Alberta Resource Hub connects you with legal aid services including free legal clinics, court support programs, tenant rights advocacy, and criminal justice reintegration services. Many services are available at no cost to low-income Albertans.",
  },
  {
    slug: "indigenous-services",
    label: "Indigenous Services",
    dbCategories: ["Indigenous Services"],
    query: "indigenous First Nations Metis Inuit services",
    metaTitle: "Indigenous Services in Alberta",
    metaDescription: "Find Indigenous services in Alberta. Access First Nations, Metis, and Inuit support programs including cultural services, health, housing, and community resources.",
    intro: "Alberta Resource Hub lists services for First Nations, Metis, and Inuit peoples across Alberta. Find culturally appropriate support including health and wellness programs, housing, cultural connections, education, and community resources delivered by and for Indigenous communities.",
  },
  {
    slug: "senior-services",
    label: "Senior Services",
    dbCategories: ["Senior Services"],
    query: "senior elderly aging support services",
    metaTitle: "Senior Services in Alberta",
    metaDescription: "Find senior services in Alberta. Access programs for aging adults including home care, social programs, health services, and caregiver support.",
    intro: "Alberta Resource Hub connects seniors and their caregivers with home care services, social programs, health and wellness resources, transportation assistance, and community supports designed for aging adults across the province.",
  },
  {
    slug: "student-services",
    label: "Student & Campus Services",
    dbCategories: ["Campus & Student Services"],
    query: "student campus university college support",
    metaTitle: "Student & Campus Services in Alberta",
    metaDescription: "Find student support services at Alberta colleges and universities. Access campus counselling, financial aid, accessibility services, and student wellness programs.",
    intro: "Alberta Resource Hub lists support services available at colleges and universities across Alberta. Find campus counselling, student financial aid, accessibility accommodations, mental health support, and wellness programs designed for post-secondary students.",
  },
  {
    slug: "veterans-services",
    label: "Veterans Services",
    dbCategories: ["Veterans Services"],
    query: "veteran military CAF support services",
    metaTitle: "Veterans Services in Alberta",
    metaDescription: "Find veterans services in Alberta. Access support for Canadian Armed Forces members and veterans including mental health, housing, employment, and peer support.",
    intro: "Alberta Resource Hub connects Canadian Armed Forces veterans and their families with mental health support, housing programs, employment services, peer support groups, and transition assistance available across the province.",
  },
];

export const CITY_PAGES: CityPage[] = [
  { slug: "calgary", label: "Calgary" },
  { slug: "edmonton", label: "Edmonton" },
  { slug: "red-deer", label: "Red Deer" },
  { slug: "lethbridge", label: "Lethbridge" },
  { slug: "medicine-hat", label: "Medicine Hat" },
  { slug: "grande-prairie", label: "Grande Prairie" },
  { slug: "fort-mcmurray", label: "Fort McMurray" },
  { slug: "airdrie", label: "Airdrie" },
  { slug: "st-albert", label: "St. Albert" },
  { slug: "spruce-grove", label: "Spruce Grove" },
  { slug: "leduc", label: "Leduc" },
  { slug: "okotoks", label: "Okotoks" },
  { slug: "cochrane", label: "Cochrane" },
  { slug: "camrose", label: "Camrose" },
  { slug: "lloydminster", label: "Lloydminster" },
  { slug: "cold-lake", label: "Cold Lake" },
  { slug: "fort-saskatchewan", label: "Fort Saskatchewan" },
  { slug: "sherwood-park", label: "Sherwood Park" },
  { slug: "canmore", label: "Canmore" },
  { slug: "banff", label: "Banff" },
  { slug: "brooks", label: "Brooks" },
];

// Lookup maps for fast slug validation
export const CATEGORY_BY_SLUG = new Map(CATEGORY_PAGES.map(c => [c.slug, c]));
export const CITY_BY_SLUG = new Map(CITY_PAGES.map(c => [c.slug, c]));
