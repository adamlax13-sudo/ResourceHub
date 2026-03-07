/**
 * Comprehensive Test Query Set
 *
 * Covers ALL 24+ query intents with multiple variations per intent.
 * This ensures thorough testing across all service categories.
 */

export interface TestQuery {
  query: string;
  location?: string;
  intent: string;
  description: string;
  expectedPatterns?: string[];
  mustInclude?: string[];
  mustExclude?: string[];
}

// ============================================
// COMPREHENSIVE TEST QUERIES - ALL INTENTS
// ============================================

export const COMPREHENSIVE_QUERIES: TestQuery[] = [
  // ===========================================
  // TIER 1: CRISIS & EMERGENCY (highest priority)
  // ===========================================

  // Crisis - explicit suicidal ideation
  {
    query: "I want to kill myself",
    intent: "crisis",
    description: "Explicit suicidal ideation - must show 988 first",
    mustInclude: ["988 Suicide Crisis Helpline"],
  },
  {
    query: "I don't want to be here anymore",
    intent: "crisis",
    description: "Implicit suicidal ideation - should detect crisis",
    expectedPatterns: ["crisis", "suicide", "helpline", "988"],
  },
  {
    query: "feeling hopeless and like a burden",
    intent: "crisis",
    description: "Subtle crisis language",
    expectedPatterns: ["mental health", "crisis", "support"],
  },
  {
    query: "nobody would miss me if I was gone",
    intent: "crisis",
    description: "Implied suicidal ideation - should detect crisis",
    expectedPatterns: ["crisis", "988", "helpline"],
  },

  // Domestic Violence
  {
    query: "my husband hits me I need to leave",
    intent: "domestic_violence",
    description: "Domestic violence - immediate danger",
    expectedPatterns: ["shelter", "domestic", "violence", "safe"],
  },
  {
    query: "women's shelter domestic violence",
    intent: "domestic_violence",
    description: "DV shelter for women",
    expectedPatterns: ["women", "shelter", "domestic violence", "abuse"],
  },
  {
    query: "I was raped and need help",
    intent: "domestic_violence",
    description: "Sexual assault crisis",
    expectedPatterns: ["sexual assault", "crisis", "support", "SACE"],
  },
  {
    query: "my ex is stalking me",
    intent: "domestic_violence",
    description: "Stalking situation",
    expectedPatterns: ["victim", "support", "safety"],
  },

  // Housing Urgent / Emergency Shelter
  {
    query: "emergency shelter tonight Calgary",
    location: "Calgary",
    intent: "housing_urgent",
    description: "Immediate shelter need",
    expectedPatterns: ["shelter", "emergency", "overnight"],
  },
  {
    query: "I'm homeless and have nowhere to sleep",
    intent: "housing_urgent",
    description: "General homelessness",
    expectedPatterns: ["shelter", "homeless", "emergency"],
  },
  {
    query: "youth shelter under 18",
    intent: "youth_services",
    description: "Youth-specific housing",
    expectedPatterns: ["youth", "shelter", "teen"],
  },
  {
    query: "getting evicted tomorrow need help",
    intent: "housing_urgent",
    description: "Imminent eviction",
    expectedPatterns: ["housing", "eviction", "emergency"],
  },

  // Food Insecurity
  {
    query: "food bank near downtown Edmonton",
    location: "Edmonton",
    intent: "food_insecurity",
    description: "Food assistance with location",
    expectedPatterns: ["food bank", "food", "hamper"],
  },
  {
    query: "free meals for homeless",
    intent: "food_insecurity",
    description: "Meal programs for unhoused",
    expectedPatterns: ["meal", "soup kitchen", "drop-in"],
  },
  {
    query: "I have no food and can't feed my kids",
    intent: "food_insecurity",
    description: "Family food crisis",
    expectedPatterns: ["food bank", "emergency food", "hamper"],
  },

  // ===========================================
  // TIER 2: MENTAL HEALTH & COUNSELLING
  // ===========================================

  // General Mental Health
  {
    query: "free counselling Calgary",
    location: "Calgary",
    intent: "mental_health",
    description: "Free mental health services",
    expectedPatterns: ["counselling", "free", "sliding scale"],
  },
  {
    query: "anxiety therapy no waitlist",
    intent: "mental_health",
    description: "Urgent mental health with no wait",
    expectedPatterns: ["therapy", "counselling", "anxiety"],
  },
  {
    query: "I feel depressed and can't get out of bed",
    intent: "mental_health",
    description: "Depression symptoms",
    expectedPatterns: ["depression", "mental health", "counselling"],
  },
  {
    query: "panic attacks help",
    intent: "mental_health",
    description: "Anxiety/panic disorder",
    expectedPatterns: ["anxiety", "mental health", "therapy"],
  },
  {
    query: "i have an eating disorder and need help",
    intent: "mental_health",
    description: "Eating disorder support",
    expectedPatterns: ["eating disorder", "recovery", "treatment"],
  },
  {
    query: "i keep cutting myself",
    intent: "mental_health",
    description: "Self-harm crisis",
    expectedPatterns: ["mental health", "crisis", "support"],
  },
  {
    query: "postpartum depression help",
    intent: "mental_health",
    description: "PPD support",
    expectedPatterns: ["postpartum", "depression", "support"],
  },

  // Grief Support
  {
    query: "grief counselling after losing spouse",
    intent: "grief_support",
    description: "Bereavement support",
    expectedPatterns: ["grief", "bereavement", "loss"],
  },
  {
    query: "my mom died and I don't know what to do",
    intent: "grief_support",
    description: "Recent loss grief",
    expectedPatterns: ["grief", "loss", "bereavement", "support"],
  },
  {
    query: "my husband was murdered",
    intent: "grief_support",
    description: "Violent loss grief",
    expectedPatterns: ["grief", "violent loss", "trauma", "support"],
  },
  {
    query: "I had a miscarriage",
    intent: "grief_support",
    description: "Pregnancy loss",
    expectedPatterns: ["pregnancy loss", "grief", "support"],
  },
  {
    query: "my dog died and I can't stop crying",
    intent: "grief_support",
    description: "Pet loss grief",
    expectedPatterns: ["pet loss", "grief", "support"],
  },

  // ===========================================
  // TIER 3: ADDICTION & RECOVERY
  // ===========================================

  // Substance Abuse - General
  {
    query: "help with alcohol addiction Calgary",
    location: "Calgary",
    intent: "substance_abuse",
    description: "Alcohol-specific addiction help",
    expectedPatterns: ["alcohol", "addiction", "recovery", "AA"],
  },
  {
    query: "opioid treatment Edmonton",
    location: "Edmonton",
    intent: "substance_abuse",
    description: "Opioid-specific treatment",
    expectedPatterns: ["opioid", "ODP", "methadone", "suboxone"],
  },
  {
    query: "I can't stop using meth",
    intent: "substance_abuse",
    description: "Stimulant addiction",
    expectedPatterns: ["addiction", "recovery", "treatment"],
  },
  {
    query: "I need detox now",
    intent: "substance_abuse",
    description: "Immediate detox need",
    expectedPatterns: ["detox", "withdrawal", "treatment"],
  },
  {
    query: "gambling addiction help",
    intent: "substance_abuse",
    description: "Problem gambling",
    expectedPatterns: ["gambling", "addiction", "support"],
  },

  // Exclusion-based addiction queries
  {
    query: "addiction help not religious",
    intent: "substance_abuse",
    description: "Non-faith-based addiction services",
    mustExclude: ["Salvation Army", "church"],
    expectedPatterns: ["secular", "addiction"],
  },
  {
    query: "recovery support no 12 step",
    intent: "substance_abuse",
    description: "Non-12-step recovery options",
    expectedPatterns: ["SMART Recovery", "recovery"],
  },

  // Family Addiction Support
  {
    query: "my son is addicted to drugs what can I do",
    intent: "family_addiction_support",
    description: "PCHAD query - parent seeking help for child",
    expectedPatterns: ["PCHAD", "family", "parent"],
  },
  {
    query: "my husband is an alcoholic",
    intent: "family_addiction_support",
    description: "Al-Anon type support",
    expectedPatterns: ["al-anon", "family", "support"],
  },
  {
    query: "living with an addict",
    intent: "family_addiction_support",
    description: "Family member affected by addiction",
    expectedPatterns: ["family", "support", "al-anon", "nar-anon"],
  },

  // ===========================================
  // TIER 4: POPULATION-SPECIFIC SERVICES
  // ===========================================

  // Youth Services
  {
    query: "help for my teenager who is struggling",
    intent: "youth_services",
    description: "Teen support",
    expectedPatterns: ["youth", "teen", "support"],
  },
  {
    query: "teen crisis line",
    intent: "youth_services",
    description: "Youth crisis support",
    expectedPatterns: ["kids help phone", "youth", "crisis"],
  },

  // Senior Services
  {
    query: "senior services for my elderly mother",
    intent: "senior_services",
    description: "Elder care support",
    expectedPatterns: ["senior", "elderly", "care"],
  },
  {
    query: "help for my dad who has dementia",
    intent: "senior_services",
    description: "Dementia support",
    expectedPatterns: ["dementia", "alzheimer", "senior", "care"],
  },
  {
    query: "meals on wheels Edmonton",
    location: "Edmonton",
    intent: "senior_services",
    description: "Senior meal delivery",
    expectedPatterns: ["meals", "senior", "delivery"],
  },

  // Indigenous Services
  {
    query: "indigenous mental health support",
    intent: "indigenous_services",
    description: "Indigenous-specific services",
    expectedPatterns: ["indigenous", "First Nations", "Métis"],
  },
  {
    query: "first nations addiction treatment",
    intent: "indigenous_services",
    description: "Indigenous addiction services",
    expectedPatterns: ["indigenous", "First Nations", "treatment"],
  },
  {
    query: "traditional healing services",
    intent: "indigenous_services",
    description: "Indigenous traditional healing",
    expectedPatterns: ["elder", "ceremony", "traditional"],
  },

  // LGBTQ+ Services
  {
    query: "LGBTQ counselling Calgary",
    location: "Calgary",
    intent: "lgbtq_services",
    description: "LGBTQ-affirming services",
    expectedPatterns: ["LGBTQ", "Pride", "queer"],
  },
  {
    query: "trans healthcare support",
    intent: "lgbtq_services",
    description: "Transgender healthcare",
    expectedPatterns: ["trans", "gender affirming", "LGBTQ"],
  },
  {
    query: "coming out support",
    intent: "lgbtq_services",
    description: "Coming out support",
    expectedPatterns: ["LGBTQ", "support", "counselling"],
  },

  // Newcomer Services
  {
    query: "newcomer settlement services",
    intent: "newcomer_services",
    description: "Immigrant/refugee support",
    expectedPatterns: ["immigrant", "refugee", "settlement", "newcomer"],
  },
  {
    query: "new to Canada need help",
    intent: "newcomer_services",
    description: "New immigrant general help",
    expectedPatterns: ["newcomer", "settlement", "immigrant"],
  },
  {
    query: "ESL classes Calgary",
    location: "Calgary",
    intent: "newcomer_services",
    description: "English language learning",
    expectedPatterns: ["ESL", "English", "language"],
  },
  {
    query: "refugee asylum help",
    intent: "newcomer_services",
    description: "Refugee support",
    expectedPatterns: ["refugee", "asylum", "settlement"],
  },

  // Student/Campus Services
  {
    query: "UCalgary mental health",
    intent: "student_services",
    description: "University-specific services",
    expectedPatterns: ["UCalgary", "student", "campus"],
  },
  {
    query: "UAlberta counselling",
    intent: "student_services",
    description: "U of A student counselling",
    expectedPatterns: ["UAlberta", "student", "counselling"],
  },
  {
    query: "student mental health SAIT",
    intent: "student_services",
    description: "College student support",
    expectedPatterns: ["student", "SAIT", "mental health"],
  },
  {
    query: "failing classes need help",
    intent: "student_services",
    description: "Academic distress",
    expectedPatterns: ["student", "support", "counselling"],
  },

  // Veteran Services
  {
    query: "PTSD support for veterans",
    intent: "veteran_services",
    description: "Veteran-specific trauma support",
    expectedPatterns: ["veteran", "PTSD", "trauma", "military", "OSI-CAN"],
  },
  {
    query: "veteran mental health support",
    intent: "veteran_services",
    description: "Veteran mental health",
    expectedPatterns: ["veteran", "military", "mental health"],
  },
  {
    query: "help for former military",
    intent: "veteran_services",
    description: "Ex-military support",
    expectedPatterns: ["veteran", "military", "support"],
  },
  {
    query: "operational stress injury help",
    intent: "veteran_services",
    description: "OSI support",
    expectedPatterns: ["OSISS", "OSI", "veteran", "military"],
  },

  // ===========================================
  // TIER 5: DISABILITY & SPECIALIZED
  // ===========================================

  // Disability Support
  {
    query: "autism support adult Edmonton",
    location: "Edmonton",
    intent: "disability_support",
    description: "Adult autism services",
    expectedPatterns: ["autism", "disability", "support"],
  },
  {
    query: "im autistic and cant make friends",
    intent: "disability_support",
    description: "Autism social support",
    expectedPatterns: ["autism", "social", "support", "group"],
  },
  {
    query: "ADHD support for adults",
    intent: "disability_support",
    description: "Adult ADHD support",
    expectedPatterns: ["ADHD", "support", "adult"],
  },
  {
    query: "help with AISH application",
    intent: "disability_support",
    description: "Disability benefits help",
    expectedPatterns: ["AISH", "disability", "benefits"],
  },
  {
    query: "developmental disability services",
    intent: "disability_support",
    description: "Developmental disability support",
    expectedPatterns: ["developmental", "disability", "services"],
  },

  // Caregiver Support
  {
    query: "caregiver burnout support",
    intent: "caregiver_support",
    description: "Caregiver burnout help",
    expectedPatterns: ["caregiver", "respite", "support"],
  },
  {
    query: "I'm exhausted from caring for my mom",
    intent: "caregiver_support",
    description: "Caregiver exhaustion",
    expectedPatterns: ["caregiver", "respite", "support"],
  },
  {
    query: "respite care for dementia patient",
    intent: "caregiver_support",
    description: "Dementia caregiver respite",
    expectedPatterns: ["respite", "caregiver", "dementia"],
  },

  // ===========================================
  // TIER 6: BASIC NEEDS & NAVIGATION
  // ===========================================

  // Legal Aid
  {
    query: "free legal help family court",
    intent: "legal_aid",
    description: "Family law assistance",
    expectedPatterns: ["legal", "family", "court", "lawyer"],
  },
  {
    query: "can't afford a lawyer",
    intent: "legal_aid",
    description: "Low-income legal help",
    expectedPatterns: ["legal aid", "pro bono", "lawyer"],
  },
  {
    query: "help with custody battle",
    intent: "legal_aid",
    description: "Custody legal support",
    expectedPatterns: ["custody", "legal", "family court"],
  },
  {
    query: "tenant rights eviction",
    intent: "legal_aid",
    description: "Tenant legal help",
    expectedPatterns: ["tenant", "legal", "eviction", "rights"],
  },

  // Employment Support
  {
    query: "I lost my job and need help",
    intent: "employment_support",
    description: "Job loss support",
    expectedPatterns: ["employment", "job", "training"],
  },
  {
    query: "resume help Edmonton",
    location: "Edmonton",
    intent: "employment_support",
    description: "Resume assistance",
    expectedPatterns: ["resume", "employment", "job"],
  },
  {
    query: "job training programs",
    intent: "employment_support",
    description: "Skills training",
    expectedPatterns: ["training", "employment", "skills"],
  },

  // Financial Support
  {
    query: "can't pay my bills in debt",
    intent: "financial_support",
    description: "Debt crisis",
    expectedPatterns: ["financial", "debt", "help"],
  },
  {
    query: "help with utility bills",
    intent: "financial_support",
    description: "Utility payment help",
    expectedPatterns: ["financial", "assistance", "bills"],
  },
  {
    query: "credit counselling",
    intent: "financial_support",
    description: "Debt counselling",
    expectedPatterns: ["credit", "debt", "counselling"],
  },

  // Parenting Support
  {
    query: "I need diapers and formula",
    intent: "parenting_support",
    description: "Baby supplies need",
    expectedPatterns: ["baby", "infant", "supplies", "diapers"],
  },
  {
    query: "single mom needs help",
    intent: "parenting_support",
    description: "Single parent support",
    expectedPatterns: ["parent", "support", "family"],
  },
  {
    query: "pregnant and scared",
    intent: "parenting_support",
    description: "Pregnancy support",
    expectedPatterns: ["pregnancy", "prenatal", "support"],
  },
  {
    query: "help with childcare costs",
    intent: "parenting_support",
    description: "Childcare assistance",
    expectedPatterns: ["childcare", "daycare", "subsidy"],
  },

  // ===========================================
  // EDGE CASES & GENERAL QUERIES
  // ===========================================

  // Vague queries
  {
    query: "help",
    intent: "general",
    description: "Vague query - should show diverse options",
  },
  {
    query: "I need help",
    intent: "general",
    description: "General help request",
  },
  {
    query: "services near me",
    intent: "general",
    description: "Generic location query",
  },

  // Location-only queries
  {
    query: "Calgary",
    intent: "location_only",
    description: "Location-only query",
  },
  {
    query: "Edmonton services",
    location: "Edmonton",
    intent: "location_only",
    description: "Location with services keyword",
  },
  {
    query: "Red Deer help",
    location: "Red Deer",
    intent: "location_only",
    description: "Smaller city location query",
  },
  {
    query: "Lethbridge mental health",
    location: "Lethbridge",
    intent: "mental_health",
    description: "Smaller city specific service",
    expectedPatterns: ["mental health", "counselling", "Lethbridge"],
  },

  // Multi-faceted queries (test intent prioritization)
  {
    query: "homeless veteran with PTSD",
    intent: "veteran_services",
    description: "Complex veteran query - multiple needs",
    expectedPatterns: ["veteran", "PTSD", "shelter"],
  },
  {
    query: "indigenous youth addiction help",
    intent: "indigenous_services",
    description: "Indigenous youth addiction - multi-demographic",
    expectedPatterns: ["indigenous", "youth", "addiction"],
  },
  {
    query: "LGBTQ senior housing",
    intent: "lgbtq_services",
    description: "LGBTQ senior services",
    expectedPatterns: ["LGBTQ", "senior", "housing"],
  },

  // ===========================================
  // TYPO & MISSPELLING QUERIES
  // ===========================================
  {
    query: "dental services",
    intent: "general",
    description: "Must NOT be corrected to 'mental' — valid word",
    mustExclude: ["mental health"],
  },
  {
    query: "counslling near me",
    intent: "mental_health",
    description: "Typo: should correct to counselling",
    expectedPatterns: ["counselling", "therapy", "mental health"],
  },
  {
    query: "adiction help",
    intent: "substance_abuse",
    description: "Typo: should correct to addiction",
    expectedPatterns: ["addiction", "recovery", "treatment"],
  },
  {
    query: "fud bank",
    intent: "food_insecurity",
    description: "Phonetic typo: should correct to food bank",
    expectedPatterns: ["food", "bank", "hamper"],
  },
  {
    query: "sheltr tonight",
    intent: "housing_urgent",
    description: "Phonetic typo: should correct to shelter",
    expectedPatterns: ["shelter", "emergency", "housing"],
  },

  // ===========================================
  // NATURAL LANGUAGE / COLLOQUIAL QUERIES
  // ===========================================
  {
    query: "I just got out of jail and need somewhere to stay",
    intent: "housing_urgent",
    description: "Reentry housing need",
    expectedPatterns: ["shelter", "housing", "transitional"],
  },
  {
    query: "where can I get free food today",
    intent: "food_insecurity",
    description: "Immediate food need",
    expectedPatterns: ["food", "meal", "hamper"],
  },
  {
    query: "my kid is out of control on drugs",
    intent: "family_addiction_support",
    description: "Parent seeking help for child substance abuse",
    expectedPatterns: ["PCHAD", "family", "parent", "addiction"],
  },
  {
    query: "I think I might be autistic",
    intent: "disability_support",
    description: "Self-identification autism query",
    expectedPatterns: ["autism", "assessment", "support"],
  },
  {
    query: "how do I apply for disability benefits",
    intent: "disability_support",
    description: "Benefits navigation query",
    expectedPatterns: ["AISH", "disability", "benefits"],
  },

  // ===========================================
  // MULTI-INTENT / COMPLEX QUERIES
  // ===========================================
  {
    query: "housing for women fleeing abuse",
    intent: "domestic_violence",
    description: "DV + housing + gender intersection",
    expectedPatterns: ["shelter", "women", "domestic violence", "abuse"],
  },
  {
    query: "senior with dementia needs meals delivered",
    intent: "senior_services",
    description: "Senior + food + dementia intersection",
    expectedPatterns: ["senior", "meals", "delivery", "dementia"],
  },
  {
    query: "pregnant teenager needs housing",
    intent: "housing_urgent",
    description: "Youth + pregnancy + housing intersection",
    expectedPatterns: ["housing", "youth", "pregnancy", "support"],
  },

  // ===========================================
  // SPECIFIC SERVICE NAME SEARCHES
  // ===========================================
  {
    query: "SMART Recovery",
    intent: "substance_abuse",
    description: "Specific service name lookup",
    mustInclude: ["SMART Recovery"],
  },
  {
    query: "211",
    intent: "general",
    description: "211 information line lookup",
    expectedPatterns: ["211", "information"],
  },
  {
    query: "Al-Anon",
    intent: "family_addiction_support",
    description: "Specific family support service lookup",
    expectedPatterns: ["Al-Anon"],
  },
  {
    query: "Kids Help Phone",
    intent: "youth_services",
    description: "Specific youth crisis service lookup",
    expectedPatterns: ["Kids Help Phone"],
  },
];

// Category distribution check
export function getCategoryDistribution(): Record<string, number> {
  const distribution: Record<string, number> = {};
  for (const query of COMPREHENSIVE_QUERIES) {
    distribution[query.intent] = (distribution[query.intent] || 0) + 1;
  }
  return distribution;
}

// Get queries by intent
export function getQueriesByIntent(intent: string): TestQuery[] {
  return COMPREHENSIVE_QUERIES.filter(q => q.intent === intent);
}

// Export count
export const TOTAL_QUERIES = COMPREHENSIVE_QUERIES.length;
