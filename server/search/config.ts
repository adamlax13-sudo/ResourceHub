/**
 * Search Configuration
 *
 * All search-related constants in one place.
 * This replaces magic numbers scattered throughout routes.ts.
 */

export const SEARCH_CONFIG = {
  // === MODE-SPECIFIC SETTINGS ===
  modes: {
    fast: {
      maxResults: 50,
      paginationDefault: 15,
      useEmbeddings: false,      // NO external API calls in fast mode
      useOpenAI: false,          // NO external API calls in fast mode
      enrichmentThreshold: 0.7,  // 70% of results must have cached enrichments
      preFilterLimit: 60,        // Max services to consider
    },
    comprehensive: {
      maxResults: 100,
      paginationDefault: 20,
      useEmbeddings: true,       // Can generate query embeddings
      useOpenAI: true,           // Can call OpenAI chat completion
      enrichmentThreshold: 0.9,  // 90% of results must have cached enrichments
      minResultsBeforeOpenAI: 3, // Only call OpenAI if < 3 results
      preFilterLimit: 80,        // Max services to consider
    },
  },

  // === SEMANTIC SEARCH SETTINGS ===
  semantic: {
    model: 'text-embedding-3-small' as const,
    dimensions: 1536,
    matchThresholdPrimary: 0.15,   // Low threshold for maximum coverage
    matchThresholdFallback: 0.2,   // Higher threshold for fallback
    maxCandidates: 50,
  },

  // === SCORING WEIGHTS ===
  // Used by preFilterServices and result merging
  scoring: {
    // Field match weights
    nameMatch: 100,
    categoryMatch: 50,
    descriptionMatch: 30,
    tagMatch: 40,
    eligibilityMatch: 12,
    notesMatch: 5,
    contactMatch: 3,

    // Phrase/exact match bonuses
    queryInNameBonus: 150,
    queryInCategoryBonus: 80,
    queryInDescriptionBonus: 60,
    exactTagMatchBonus: 100,
    partialTagMatchBonus: 50,

    // Location weights
    exactLocationBonus: 200,
    provinceWideBonus: 100,
    wrongLocationPenalty: -500,

    // Special query type bonuses
    crisisBonus: 1000,
    aliasBonus: 500,
    aliasInQueryBonus: 300,

    // Quality factors
    maxPopularityBoost: 30,      // Capped at 30 points from click count
    recentUpdateBonus: 15,       // Updated within 30 days
    moderateUpdateBonus: 10,     // Updated within 90 days
    staleDataPenalty: -5,        // Older than 365 days

    // Multi-keyword bonuses
    multiKeywordBonus2: 20,      // 2 keyword matches
    multiKeywordBonus3: 40,      // 3+ keyword matches

    // Stemmed keyword weights (lower than exact)
    stemmedNameMatch: 35,
    stemmedCategoryMatch: 30,
    stemmedTagMatch: 25,
    stemmedDescriptionMatch: 15,
  },

  // === CRISIS DETECTION ===
  crisis: {
    keywords: [
      'suicide',
      'suicidal',
      'kill myself',
      'end my life',
      'want to die',
      'dont want to live',
      "don't want to live",
      'self harm',
      'self-harm',
      'overdose',
    ],
    pinnedServiceId: '988-suicide-crisis-helpline',
    pinnedServiceLite: {
      id: '988-suicide-crisis-helpline',
      name: '988 Suicide Crisis Helpline',
      category: '24/7 Crisis Line',
      description: 'Free, confidential 24/7 support for people in suicidal crisis or emotional distress. Call or text 988.',
      location: 'Canada-wide (available in Alberta)',
      waitTimes: 'Immediate - 24/7 availability',
    },
    pinnedServiceFull: {
      id: '988-suicide-crisis-helpline',
      name: '988 Suicide Crisis Helpline',
      category: '24/7 Crisis Line',
      description: 'Free, confidential 24/7 support for people in suicidal crisis or emotional distress. Call or text 988 to connect with a trained crisis counselor immediately. Available in English and French.',
      location: 'Canada-wide (available in Alberta)',
      contact: 'Call or text 988',
      websiteUrl: '',
      eligibility: 'Anyone experiencing suicidal thoughts, emotional distress, or supporting someone in crisis',
      process: [
        'Call or text 988 from any phone - available 24/7',
        'You will be connected to a trained crisis counselor',
        'Share what you\'re going through at your own pace',
        'The counselor will provide immediate support and safety planning',
        'You may be connected to local resources for ongoing support',
      ],
      waitTimes: 'Immediate - 24/7 availability',
      requiredDocs: ['None - anonymous and confidential'],
      phone: '988',
      email: '',
      address: '',
    },
  },

  // === CACHE SETTINGS ===
  cache: {
    servicesCacheTTL: 5 * 60 * 1000,        // 5 minutes for services list
    searchResultsTTL: 60 * 60 * 1000,       // 1 hour for search results
  },

  // === OPENAI SETTINGS ===
  openai: {
    fastModel: 'gpt-4.1-mini' as const,
    comprehensiveModel: 'gpt-4.1' as const,
    temperature: 0.2,
  },

  // === RESULT LIMITS ===
  limits: {
    fastModeResultLimit: 15,           // Max results returned in fast mode
    locationOnlyResultLimit: 50,       // Max results for location-only queries
    minResultsThreshold: 8,            // Supplement with semantic if SQL < this
  },

  // === DOMAIN INTENT PATTERNS ===
  // Used by analyzer.ts to detect specific query intents
  // Order matters: more urgent/specific patterns should be checked first in analyzer.ts
  domainPatterns: {
    domestic_violence: [
      /(?:partner|husband|wife|boyfriend|girlfriend|spouse).*(?:hit|hurt|abuse|violent|attack)/i,
      /(?:being|getting|am).*(?:abused|beaten|hurt|hit)/i,
      /(?:domestic|family).*(?:violence|abuse)/i,
      /(?:scared|afraid).*(?:of|for).*(?:my|partner|husband|wife|life|safety)/i,
      /(?:escape|leave|flee).*(?:relationship|partner|husband|wife|abuser)/i,
      /(?:women'?s|woman'?s).*(?:shelter|safe)/i,
    ],
    food_insecurity: [
      /(?:hungry|starving).*(?:no food|can'?t eat|nothing to eat)/i,
      /(?:need|looking for|where).*(?:food|groceries|meals)/i,
      /(?:can'?t|cannot).*(?:afford|buy).*(?:food|groceries|eat)/i,
      /(?:food bank|food pantry|free food|free meals)/i,
      /(?:no food|out of food|nothing to eat)/i,
    ],
    housing_urgent: [
      /(?:need|nowhere|no|can'?t find).*(?:sleep|shelter|housing|place|bed|stay)/i,
      /(?:homeless|evict|kicked out|on the street)/i,
      /(?:emergency|urgent).*(?:housing|shelter|bed)/i,
      /(?:place|somewhere).*(?:to sleep|to stay)/i,
      /(?:about to|going to).*(?:lose|be evicted|kicked out)/i,
      /(?:can'?t|cannot).*(?:pay|afford).*(?:rent|mortgage)/i,
    ],
    substance_abuse: [
      /(?:can'?t|cannot|struggling|help|stop|quit|trouble).*(?:drinking|alcohol|drug|using|addiction|addict)/i,
      /(?:drinking|alcohol|drug|addict).*(?:problem|issue|help|recovery)/i,
      /(?:relapse|withdrawal|detox|rehab|sober|sobriety)/i,
      /(?:addicted|hooked).*(?:to|on)/i,
    ],
    mental_health: [
      /(?:feel|i'?m|feeling|struggling|always).*(?:sad|depressed|anxious|hopeless|alone|empty|worthless|overwhelmed|lost)/i,
      /(?:anxiety|depression|panic|stress|trauma|ptsd).*(?:attack|help|support|treatment)/i,
      /(?:can'?t|cannot).*(?:cope|function|eat|get out of bed)/i,
      /(?:can'?t|cannot).*(?:fall asleep|sleep at night|sleeping)/i,
      /(?:struggling|help|need).*(?:mental health|mental-health|my mental)/i,
      /(?:no one|nobody).*(?:to talk|who cares|understands)/i,
      /(?:isolated|lonely|loneliness)/i,
    ],
  },
} as const;

// Type exports for type safety
export type SearchMode = 'fast' | 'comprehensive';
export type SearchType = 'sql' | 'sql+enrichment' | 'sql+semantic' | 'semantic' | 'openai' | 'cache';
export type QueryIntent = 'crisis' | 'alias' | 'location_only' | 'domestic_violence' | 'food_insecurity' | 'housing_urgent' | 'substance_abuse' | 'mental_health' | 'general';

// Re-export the config type
export type SearchConfigType = typeof SEARCH_CONFIG;
