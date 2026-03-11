/**
 * Scoring Configuration
 *
 * Centralized scoring boost/penalty configuration.
 * All numeric values used in scoring logic are defined here for easy tuning.
 */

export const SCORING_CONFIG = {
  // Name match boosts (applied before intent boosting)
  nameMatch: {
    exact: 500,       // Exact service name match (case-insensitive)
    alias: 500,       // Known alias match from service_aliases table
    partial: 250,     // All query words (2+ non-stoplist) appear in name
  },

  // Intent-based boosts
  intent: {
    categoryPattern: 10,  // Text pattern matching for intent
    categoryName: 5,      // Category name contains relevant keywords
    urgentService: 2,     // 24/7 services for urgent intents
    dualIntentMatch: 15,  // Bonus when service matches 2+ detected intents (e.g., indigenous + addiction)
  },

  // Location-only boosts
  locationOnly: {
    generalInfo: 200,     // General information/referral services
    multiService: 50,     // Multi-service agencies
    specializedPenalty: -30,  // Penalty for very specialized services
  },

  // Gender-based boosts
  gender: {
    matchBoost: 8,        // Service matches user's gender preference
    mismatchPenalty: -15, // Service is opposite gender only
  },

  // Age group boosts
  ageGroup: {
    youthMatch: 50,
    youthForSeniorPenalty: -100,
    youthForAdultPenalty: -50,
    adultForYouthPenalty: -200,      // Changed from -300 for medium confidence
    adultMatch: 100,
    adultForSeniorPenalty: -50,
    seniorMatch: 50,
    seniorYouthOnlyPenalty: -100,
    mediumConfidencePenalty: -200,   // New: penalty for medium confidence mismatches
  },

  // Urgency boosts
  urgency: {
    immediateAccess: 10,
    appointmentPenalty: -3,
  },

  // Disability/Autism boosts
  disability: {
    autismMatch: 150,
    disabilityServices: 120,
    neurodivergentMatch: 100,
    socialSupport: 80,
    supportGroup: 40,
    genericMentalHealthPenalty: -30,
  },

  // ADHD boosts
  adhd: {
    adhdSpecific: 200,
    assessmentServices: 150,
    coachingSkills: 100,
    psychiatry: 80,
    unrelatedPenalty: -100,
  },

  // Crisis boosts
  crisis: {
    crisisHelpline: 500,
    crisisCategory: 400,
    crisisSupport: 300,
    mentalHealthCrisis: 100,
    griefPenalty: -350,
    addictionTreatmentPenalty: -200,
    gamblingPenalty: -300,
    dayProgramPenalty: -150,
  },

  // Grief boosts
  grief: {
    generalGrief: 150,
    pregnancyInfantLoss: 250,
    petLoss: 250,
    violentLoss: 150,
    supportGroup: 60,
    genericMentalHealthPenalty: -20,
    crisisShelterPenalty: -100,
  },

  // Postpartum boosts
  postpartum: {
    postpartumSpecific: 250,
    womensMentalHealth: 200,
    pregnancyMentalHealth: 150,
    generalMentalHealth: 80,
    unrelatedPenalty: -150,
  },

  // Senior boosts
  senior: {
    seniorServices: 120,
    additionalSenior: 80,
    youthOnlyPenalty: -50,
  },

  // Legal boosts
  legal: {
    tenantEviction: 300,
    legalAidEviction: 300,
    housingLegal: 200,
    urgentEviction: 200,
    shelterInTenantPenalty: -250,
    legalAid: 150,
    lawyerGeneral: 80,
    legalInCounsellingPenalty: -200,
  },

  // Employment boosts
  employment: {
    employmentSupport: 120,
    additionalEmployment: 60,
  },

  // Youth boosts
  youth: {
    youthShelter: 200,
    youthServices: 100,
    seniorOnlyPenalty: -50,
    nonShelterPenalty: -80,
  },

  // Newcomer boosts
  newcomer: {
    newcomerServices: 120,
    additionalNewcomer: 80,
  },

  // Family addiction support boosts
  familyAddiction: {
    alAnon: 600,
    familySupport: 350,
    supportGroup: 100,
    treatmentPenalty: -300,
    harmReductionPenalty: -250,
  },

  // Financial boosts
  financial: {
    creditCounselling: 200,
    financialSupport: 120,
    additional: 60,
    mentalHealthPenalty: -200,
  },

  // Caregiver boosts
  caregiver: {
    caregiverSupport: 250,
    dayProgramRespite: 200,
    familySupport: 100,
    caregiverCounselling: 150,
    griefPenalty: -150,
  },

  // LGBTQ boosts
  lgbtq: {
    lgbtqServices: 150,
    genderAffirming: 80,
    lgbtqSenior: 300,
    seniorHousing: 150,
    youthOnlyPenalty: -200,
    lgbtqHousing: 150,
  },

  // Veteran boosts
  veteran: {
    veteranServices: 500,
    militaryServices: 350,
    ptsdServices: 200,
    peerSupport: 100,
    homelessVeteranHousing: 400,
    generalShelter: 200,
    sexualViolencePenalty: -300,
    domesticViolencePenalty: -250,
    womenSpecificPenalty: -150,
  },

  // Family situation boosts
  familySituation: {
    singleParent: 6,
    familyLegal: 8,
    pregnancy: 8,
    familyGeneral: 4,
  },

  // Community preference boosts
  community: {
    match: 10,
  },

  // Student boosts
  student: {
    institutionMatch: 100,
    genericStudent: 30,
    studentService: 50,
    youthService: 15,
  },

  // Language preference boosts
  language: {
    langMatch: 25,
    multilingual: 15,
  },

  // Family context boosts
  familyContext: {
    familySupport: 20,
    intervention: 15,
  },

  // Exclusion penalties
  exclusion: {
    religious: -30,
    twelveStep: -200,
    secularBoost: 350,
    genderOnly: -40,
    waitlist: -15,
    noWaitlistBoost: 100,
  },

  // Non-12-step boosts
  non12Step: {
    smartRecovery: 800,
    evidenceBased: 400,
    youthPenalty: -300,
    unclearMethodology: -100,
  },

  // Indigenous boosts
  indigenous: {
    indigenousService: 120,
    traditionalHealing: 80,
    treatyReserve: 60,
  },

  // Parenting boosts
  parenting: {
    parentingSupport: 120,
    babySupplies: 80,
    parentType: 60,
    childcare: 80,
    childcareSubsidy: 180,
    financialChildcare: 150,
    babySuppliesPenalty: -100,
  },

  // Student services (intent-based)
  studentServices: {
    universityMatch: 400,
    campusService: 200,
    studentCounselling: 150,
    nonCampusPenalty: -100,
    wrongUniversityPenalty: -200,
    addictionFocusPenalty: -150,
  },

  // Substance-specific boosts
  substance: {
    exactMatch: 80,
    peerSupport: 40,
    generalPenalty: -30,
    generalServiceBoost: 20,
    mismatchPenalty: -15,
  },

  // Substance abuse intent boosts (dedicated section like crisis, grief, etc.)
  substanceAbuse: {
    addictionService: 150,       // Addiction treatment/recovery services
    residentialTreatment: 200,   // Residential/live-in addiction programs
    harmReduction: 80,           // Harm reduction services
    unrelatedPenalty: -150,      // Unrelated categories (disability, food, senior, legal, etc.)
    nonResidentialPenalty: -200,  // Non-residential services when query asks for residential
  },

  // Domestic violence boosts
  domesticViolence: {
    dvShelter: 200,          // DV shelter/safe house
    dvServices: 150,         // DV-specific counselling, outreach, legal
    crisisLine: 100,         // Crisis lines for DV
    sexualAssault: 120,      // Sexual assault services
    unrelatedPenalty: -150,  // Food bank, disability, senior, addiction treatment
  },

  // Mental health boosts
  mentalHealth: {
    counsellingTherapy: 150,   // Counselling/therapy services
    psychiatry: 120,           // Psychiatry/medication management
    supportGroup: 80,          // Peer support groups
    specificCondition: 100,    // Matches specific condition (anxiety, depression, etc.)
    unrelatedPenalty: -120,    // Food bank, legal aid, employment, housing
  },

  // Food insecurity boosts
  foodInsecurity: {
    foodBank: 200,           // Food banks, pantries
    communityMeals: 150,     // Meal programs, soup kitchens
    grocerySupport: 100,     // Grocery gift cards, hampers
    unrelatedPenalty: -150,  // DV shelter, disability, legal, addiction
  },

  // Housing urgent boosts
  housingUrgent: {
    emergencyShelter: 200,    // Emergency shelters
    dropInShelter: 150,       // Drop-in centres with beds
    housingSupport: 100,      // Housing support/navigation
    unrelatedPenalty: -150,   // Food bank, disability, legal, mental health counselling
  },

  // Community & social connection boosts
  communitySocial: {
    recreationProgram: 150,   // Recreation, fitness, sports
    socialConnection: 120,    // Drop-ins, social groups, friendship programs
    volunteerProgram: 80,     // Volunteering opportunities
    unrelatedPenalty: -100,   // Addiction treatment, DV, legal, crisis
  },

  // Healthcare access boosts
  healthcareAccess: {
    healthcareService: 150,    // Direct healthcare services
    healthBenefits: 120,       // Benefit programs, coverage help
    communityHealth: 100,      // Community health centres
    unrelatedPenalty: -120,    // Addiction, DV, legal, food
  },

  // Basic needs & material aid boosts
  basicNeeds: {
    materialAid: 150,          // Clothing, furniture, supplies
    emergencyAssistance: 120,  // Emergency financial/utility assistance
    hygieneSupplies: 100,      // Hygiene kits, personal care
    unrelatedPenalty: -120,    // Mental health counselling, legal, DV, addiction
  },

  // Eating disorder boosts
  eatingDisorder: {
    edSpecific: 200,           // Eating disorder programs
    edSupport: 120,            // ED support groups, peer support
    bodyImage: 80,             // Body image programs
    unrelatedPenalty: -150,    // Addiction treatment, food banks
  },

  // Stable/transitional housing boosts
  housingStable: {
    transitionalHousing: 200,   // Transitional housing programs
    affordableHousing: 150,     // Affordable/subsidized housing
    rentSupplement: 120,        // Rent supplement programs
    emergencyShelterPenalty: -80, // Emergency shelters when looking for long-term
  },

  // Trauma & PTSD boosts (non-veteran)
  trauma: {
    traumaSpecific: 150,        // Trauma-specific counselling
    ptsdServices: 120,          // PTSD treatment programs
    sexualAssaultSupport: 150,  // Sexual assault centres
    abuseRecovery: 100,         // Abuse recovery programs
    unrelatedPenalty: -120,     // Food, employment, housing
  },

  // Criminal justice reintegration boosts
  criminalJustice: {
    reintegration: 200,         // Reintegration programs (John Howard, Elizabeth Fry)
    recordSupport: 150,         // Criminal record support, pardons
    paroleProbation: 120,       // Parole/probation support
    unrelatedPenalty: -120,     // Mental health counselling, food, DV
  },

  // Gambling support boosts
  gambling: {
    gamblingTreatment: 200,     // Problem gambling treatment
    gamblingSupport: 150,       // Gambling support groups (GA)
    selfExclusion: 100,         // Self-exclusion programs
    substancePenalty: -150,     // Drug/alcohol treatment (not gambling)
    unrelatedPenalty: -120,     // Food, legal, housing, disability
  },

  // Negative keyword penalties
  negativeKeyword: {
    semanticMatch: 150,
    directMatch: 100,
  },

  // RRF scoring constant
  rrf: {
    k: 60,  // RRF k parameter
  },
} as const;

// Type export for SCORING_CONFIG
export type ScoringConfigType = typeof SCORING_CONFIG;
