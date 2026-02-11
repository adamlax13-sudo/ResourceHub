/**
 * Search Configuration
 *
 * All search-related constants in one place.
 * This replaces magic numbers scattered throughout routes.ts.
 */

export const SEARCH_CONFIG = {
  // === SEARCH SETTINGS ===
  search: {
    maxResults: 100,
    paginationDefault: 20,
    useEmbeddings: true,       // Can generate query embeddings
    useOpenAI: true,           // Can call OpenAI chat completion
    enrichmentThreshold: 0.9,  // 90% of results must have cached enrichments
    minResultsBeforeOpenAI: 3, // Only call OpenAI if < 3 results
    preFilterLimit: 80,        // Max services to consider
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
    // Explicit crisis keywords
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
    // Implicit crisis patterns - subtle expressions of suicidal ideation
    implicitPatterns: [
      /\b(don'?t|do not)\s+want\s+to\s+(be here|exist|wake up|live)\b/i,
      /\b(no point|what'?s the point|pointless)\s+(in|to|of)?\s*(living|life|going on|continuing)?\b/i,
      /\b(can'?t|cannot)\s+(go on|take it|do this)\s*(anymore|any more)?\b/i,
      /\b(better off|world.*better)\s+(without me|if i.*gone|dead)\b/i,
      /\b(hopeless|worthless|burden)\s+(to everyone|to my family|on)?\b/i,
      /\b(end(ing)?|final(ly)?)\s+(it|peace|solution|way out)\b/i,
      /\b(nobody|no one)\s+(would|will)\s+(care|notice|miss me)\b/i,
      /\b(give up|giving up)\s+(on life|on everything|completely)?\b/i,
      /\b(tired of|done with)\s+(living|life|fighting|everything)\b/i,
      /\b(permanent)\s+(solution|escape|way out)\b/i,
      // Feeling unwanted/uncared for
      /\b(nobody|no one)\s+(wants|needs|cares about|loves)\s+me\b/i,
      /\b(nobody|no one)\s+wants\s+me\s+(here|around|anymore)\b/i,
      /\b(i'?m|i am)\s+(unwanted|unloved|a burden|in the way)\b/i,
      /\b(everyone|they|the world)\s+(would be|is)\s+better\s+(off\s+)?without\s+me\b/i,
      /\bwish\s+i\s+(was\s+)?never\s+born\b/i,
      /\bshouldn'?t\s+(be here|exist|have been born)\b/i,
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
      /(?:he|she).*(?:threatens|threatening|controls|controlling)/i,
    ],
    food_insecurity: [
      /(?:hungry|starving).*(?:no food|can'?t eat|nothing to eat)/i,
      /(?:need|looking for|where).*(?:food|groceries|meals)/i,
      /(?:can'?t|cannot).*(?:afford|buy).*(?:food|groceries|eat)/i,
      /(?:food bank|food pantry|free food|free meals)/i,
      /(?:no food|out of food|nothing to eat)/i,
      // Expanded food patterns
      /(?:haven'?t|have not).*(?:eaten|eat)/i,
      /(?:skipping|skip).*(?:meals?|eating)/i,
      /(?:kids?|children).*(?:are|is).*hungry/i,
      /(?:choosing|choose).*between.*(?:food|rent|bills)/i,
    ],
    housing_urgent: [
      /(?:need|nowhere|no|can'?t find).*(?:sleep|shelter|housing|place|bed|stay)/i,
      /(?:homeless|evict|kicked out|on the street)/i,
      /(?:emergency|urgent).*(?:housing|shelter|bed)/i,
      /(?:place|somewhere).*(?:to sleep|to stay)/i,
      /(?:about to|going to).*(?:lose|be evicted|kicked out)/i,
      /(?:can'?t|cannot).*(?:pay|afford).*(?:rent|mortgage)/i,
      // Expanded housing patterns
      /(?:sleeping|living).*(?:in my car|in car|in vehicle|in my vehicle)/i,
      /(?:couch surfing|staying with friends|no permanent)/i,
      /(?:about to be|getting|facing).*(?:evicted|kicked out)/i,
      /(?:nowhere to go|no where to go|no place to go)/i,
    ],
    substance_abuse: [
      /(?:can'?t|cannot|struggling|help|stop|quit|trouble).*(?:drinking|alcohol|drug|using|addiction|addict|gambling|betting)/i,
      /(?:drinking|alcohol|drug|addict|gambling|betting).*(?:problem|issue|help|recovery)/i,
      /(?:relapse|withdrawal|detox|rehab|sober|sobriety)/i,
      /(?:addicted|hooked).*(?:to|on)/i,
      // Gambling-specific patterns
      /(?:can'?t|cannot|stop|quit|control).*(?:gambling|betting|playing.*(?:slots|poker|casino|bet))/i,
      /(?:gambling|betting|casino).*(?:addiction|problem|help|support)/i,
      /(?:lost|losing).*(?:money|everything).*(?:gambling|betting|casino)/i,
      /(?:gambler|gambling addict)/i,
      // Financial ruin from gambling
      /(?:lost|blew|spent|wasted).*(?:money|savings|paycheck|rent).*(?:on|to|at)/i,
      /(?:in debt|owe money).*(?:because|from|due to)/i,
      /(?:ruined|destroyed).*(?:finances|life|family).*(?:gambling|betting)/i,
    ],
    mental_health: [
      /(?:feel|i'?m|feeling|struggling|always).*(?:sad|depressed|anxious|hopeless|alone|empty|worthless|overwhelmed|lost)/i,
      /(?:anxiety|depression|panic|stress|trauma|ptsd).*(?:attack|help|support|treatment)/i,
      /(?:can'?t|cannot).*(?:cope|function|eat|get out of bed)/i,
      /(?:can'?t|cannot).*(?:fall asleep|sleep at night|sleeping)/i,
      /(?:struggling|help|need).*(?:mental health|mental-health|my mental)/i,
      /(?:no one|nobody).*(?:to talk|who cares|understands)/i,
      /(?:isolated|lonely|loneliness)/i,
      // Expanded emotional distress patterns
      /(?:scared|terrified|trapped|helpless|stuck)/i,
      /(?:can'?t cope|breaking down|falling apart|at my wit'?s end)/i,
      /(?:completely alone|nobody understands|no one to talk)/i,
      /(?:don'?t know what to do|at a loss|losing it)/i,
    ],
  },

  // === SUBSTANCE-SPECIFIC PATTERNS ===
  // Used by analyzer.ts to detect specific substances mentioned in queries
  // Includes street names, slang, and colloquial terms
  substancePatterns: {
    alcohol: [
      /\b(drink|drinking|drunk|drank|alcoholic|alcoholism|beer|wine|liquor|booze|sober|sobriety)\b/i,
      /\b(can'?t|cannot|stop|quit).*drinking\b/i,
      /\balcohol\b/i,
      // Colloquial/slang terms
      /\b(wasted|hammered|plastered|smashed|trashed|blacked out|black out)\b/i,
      /\b(shakes|tremors|DTs|withdrawal|detoxing)\b/i,
      /\b(hair of the dog|liquid courage|falling off the wagon)\b/i,
      /\b(binge|bender|on a bender)\b/i,
    ],
    opioid: [
      /\b(heroin|fentanyl|opioid|opiate|morphine|oxycontin|methadone|suboxone|buprenorphine)\b/i,
      /\b(painkiller|pain\s*pill).*addict/i,
      /\b(needle|inject|shooting up)\b/i,
      // Street names and slang
      /\b(oxy|percs?|roxies?|blues|dope|smack|junk|horse|china white|tar)\b/i,
      /\b(nodding|on the nod|pinned|dopesick|kicking|cold turkey)\b/i,
      /\b(chasing|chasing the dragon)\b/i,
      /\b(dilaudid|hydromorphone|codeine|tramadol|norco|vicodin)\b/i,
    ],
    stimulant: [
      /\b(meth|methamphetamine|crystal|cocaine|coke|crack)\b/i,
      // Prescription stimulants (commonly abused)
      /\b(adderall|ritalin|vyvanse|concerta|dexedrine|amphetamine|dextroamphetamine|methylphenidate)\b/i,
      // Street names and slang
      /\b(blow|snow|yayo|white|powder|rails?|lines?|8-?ball)\b/i,
      /\b(ice|glass|tina|speed|crank|tweak|tweaking|geeked|gacked)\b/i,
      /\b(crashing|coming down|stayed up \d+ days?|haven'?t slept)\b/i,
      /\b(uppers|stims|study drugs?)\b/i,
    ],
    cannabis: [
      /\b(weed|pot|marijuana|cannabis|thc|dab|dabs)\b/i,
      // Colloquial terms
      /\b(bud|flower|edibles?|gummies|vape|vaping|cart|cartridge)\b/i,
      /\b(stoned|high all the time|wake and bake|smoking every day)\b/i,
    ],
    gambling: [
      /\b(gambling|gamble|gambler|betting|bet|casino|slots|poker|blackjack|roulette)\b/i,
      /\b(sports\s*betting|sports\s*gambling|online\s*betting|online\s*gambling)\b/i,
      // Popular betting sites/apps
      /\b(rainbet|bet365|fanduel|draftkings|betway|888|pokerstars|partypoker|bovada|pinnacle|unibet|betfair|william\s*hill|proline|playalberta|stake|rollbit|duelbits)\b/i,
      /\b(vlt|vlts|scratch\s*tickets?|lottery|lotto)\b/i,
      // Gambling behavior patterns
      /\b(chasing losses|can'?t stop betting|lost everything gambling|in the hole|down bad)\b/i,
      /\b(bookies?|bookie|parlay|accumulator|over.?under|spread|handicap)\b/i,
    ],
  },

  // === CATEGORY INDICATORS ===
  // Used for fallback intent detection when explicit patterns don't match
  // If a category indicator + distress indicator is found, we can infer the intent
  categoryIndicators: {
    // Housing-related terms (situations, not just services)
    housing: [
      /\b(homeless|evicted|eviction|kicked out|no.*place|nowhere.*stay|shelter|housing)\b/i,
      /\b(sleeping.*(?:car|street|outside|rough)|couch.*surf|no.*bed|no.*roof)\b/i,
      /\b(landlord|lease|rent|mortgage|tenant|apartment|room)\b/i,
      /\b(motel|hotel|hostel|rooming house)\b/i,
    ],
    // Food-related terms
    food: [
      /\b(hungry|starving|food|groceries|meals?|eat|eating|fed)\b/i,
      /\b(food.*bank|pantry|hamper|soup.*kitchen)\b/i,
      /\b(breakfast|lunch|dinner|snacks?)\b/i,
    ],
    // Mental health terms (symptoms, conditions, medications)
    mental_health: [
      /\b(depress|anxiety|anxious|panic|ptsd|trauma|bipolar|schizo|ocd)\b/i,
      /\b(therapist|therapy|counsell?or|counsell?ing|psychiatr|psycholog)\b/i,
      /\b(antidepressant|ssri|zoloft|prozac|lexapro|wellbutrin|seroquel|lithium)\b/i,
      /\b(hopeless|worthless|empty|numb|crying|overwhelmed|stressed)\b/i,
      /\b(sleep.*(?:problem|issue|can'?t)|insomnia|nightmare)\b/i,
    ],
    // Domestic violence terms
    domestic_violence: [
      /\b(abus(?:e|ed|ive|er)|violen(?:t|ce)|assault|attack|hit|beat|hurt)\b/i,
      /\b(partner|husband|wife|boyfriend|girlfriend|spouse|ex)\b/i,
      /\b(safe.*(?:house|place)|women'?s.*shelter|escape|flee|protect)\b/i,
      /\b(threaten|control|stalk|harass|intimidate|isolate)\b/i,
      /\b(restraining.*order|protection.*order)\b/i,
    ],
    // Financial/employment terms
    financial: [
      /\b(broke|poor|debt|owe|bills?|money|income|unemploy|job.*(?:lost|fired|laid off))\b/i,
      /\b(EI|employment.*insurance|welfare|AISH|income.*support)\b/i,
      /\b(bankrupt|creditor|collection|payday.*loan)\b/i,
    ],
    // Legal terms
    legal: [
      /\b(lawyer|attorney|legal.*(?:aid|help)|court|judge|charges?|arrested)\b/i,
      /\b(custody|divorce|separation|child.*support|family.*court)\b/i,
      /\b(immigration|visa|refugee|asylum|deporta)\b/i,
    ],
    // Healthcare terms
    healthcare: [
      /\b(doctor|physician|clinic|hospital|prescription|medication|medicine)\b/i,
      /\b(sick|illness|disease|condition|symptom|diagnosis)\b/i,
      /\b(no.*(?:insurance|coverage)|uninsured|can'?t.*afford.*(?:doctor|medication))\b/i,
    ],
    // Student/University terms (for boosting campus resources)
    student: [
      /\b(student|university|college|campus|undergrad|graduate|masters|phd|doctoral)\b/i,
      // Alberta universities/colleges
      /\b(u of c|u of a|uofc|uofa|ucalgary|ualberta|mount royal|mru|sait|nait|macewan|lethbridge|athabasca)\b/i,
      /\b(engineering|eng|arts|science|nursing|business|education|med school|law school)\b/i,
      /\b(dorm|residence|res|roommate|tuition|finals|exams|semester|prof|professor)\b/i,
    ],
  },

  // === DISTRESS/NEED INDICATORS ===
  // General patterns that indicate someone needs help (used with category indicators)
  distressIndicators: /\b(need|help|can'?t|cannot|struggling|lost|losing|problem|issue|crisis|emergency|urgent|desperate|scared|afraid|worried|stuck|trapped|don'?t know what to do|nowhere to turn|no one to talk|at my wit'?s end|breaking down|falling apart|ruined|destroyed|can'?t cope|can'?t take it|out of options|running out of)\b/i,

  // === FAMILY/LOVED ONE CONTEXT PATTERNS ===
  // Detect when someone is searching on behalf of a family member
  familyContextPatterns: {
    // Direct family relationships
    immediateFamily: [
      /\b(my|our)\s+(son|daughter|kid|child|spouse|partner|husband|wife|parent|mom|dad|mother|father|brother|sister)\b/i,
      /\b(my|our)\s+(teenager|teen|toddler|baby|infant|newborn)\b/i,
    ],
    // Extended family and loved ones
    extendedFamily: [
      /\b(my|our)\s+(uncle|aunt|cousin|nephew|niece|grandparent|grandmother|grandfather|grandma|grandpa|in-law)\b/i,
      /\b(loved one|family member|someone I (know|care about|love))\b/i,
      /\b(friend|roommate|coworker|colleague)\s+(is|has|needs|who)\b/i,
    ],
    // Concerned person indicators
    concernedPerson: [
      /\b(watching|seeing)\s+(them|him|her)\b/i,
      /\b(worried|concerned|scared)\s+(about|for)\s+(my|a|the|their)\b/i,
      /\b(help(ing)?|support(ing)?)\s+(someone|a friend|my|a family)\b/i,
      /\b(how (do|can) I help)\b/i,
      /\b(intervention|confront|talk to them about)\b/i,
    ],
  },

  // === LANGUAGE PREFERENCE PATTERNS ===
  // Detect when users need services in specific languages
  languagePatterns: {
    spanish: /\b(spanish|español|habla español|en español|hispanohablante)\b/i,
    french: /\b(french|français|en français|francophone|francais)\b/i,
    arabic: /\b(arabic|عربي|arabe)\b/i,
    mandarin: /\b(mandarin|chinese|中文|cantonese|普通话|粤语)\b/i,
    punjabi: /\b(punjabi|ਪੰਜਾਬੀ)\b/i,
    tagalog: /\b(tagalog|filipino|pilipino)\b/i,
    vietnamese: /\b(vietnamese|tiếng việt|viet)\b/i,
    ukrainian: /\b(ukrainian|українська|ukrain)\b/i,
    hindi: /\b(hindi|हिन्दी)\b/i,
    urdu: /\b(urdu|اردو)\b/i,
    korean: /\b(korean|한국어|hangul)\b/i,
    // General non-English indicator
    nonEnglish: /\b(non-?english|another language|interpreter|translation|my language|speak.*english.*not|english.*not.*good|limited english)\b/i,
  },

  // === NEGATIVE/EXCLUSION SIGNAL PATTERNS ===
  // Detect when users want to exclude certain types of services
  exclusionPatterns: {
    // Religious exclusions
    secular: /\b(not religious|non-?religious|secular|no.*religion|no.*faith|no.*church|no.*god|atheist|agnostic)\b/i,
    // 12-step exclusions (some prefer non-12-step programs)
    non12Step: /\b(not.*12.*step|no.*12.*step|non.*12.*step|alternative to AA|alternative to NA|no AA|no NA)\b/i,
    // Gender exclusions
    notMenOnly: /\b(not.*men only|no.*men|not just men|not.*male only)\b/i,
    notWomenOnly: /\b(not.*women only|no.*women|not just women|not.*female only)\b/i,
    // Cost exclusions
    freeOnly: /\b(free only|must be free|can'?t afford|no money|no insurance|uninsured|low income|sliding scale)\b/i,
    // Wait time exclusions
    noWaitlist: /\b(no wait|immediate|right away|can'?t wait|urgent|asap|today|tonight|now)\b/i,
  },

  // === SERVICE SUBSTANCE INDICATORS ===
  // Patterns to identify substance-specific services from their name/description
  // Order matters: more specific patterns should be checked BEFORE general
  serviceSubstanceIndicators: {
    alcohol: /\b(AA\b|alcoholics?\s*anonymous|alcohol|alcoholism|alcoholic|al-?anon|drinking|sober\s*living|sobriety)\b/i,
    opioid: /\b(opioid|opiate|methadone|suboxone|buprenorphine|needle exchange|naloxone|harm reduction|safe\s*injection|overdose prevention)\b/i,
    stimulant: /\b(meth|methamphetamine|cocaine|crack|CMA|crystal|stimulant|adderall|ritalin|amphetamine|prescription.*stimulant)\b/i,
    cannabis: /\b(cannabis|marijuana|weed)\b/i,
    gambling: /\b(gambl|GA\b|gamblers?\s*anonymous|betting|problem gambling|gambling addiction|gambling support)\b/i,
    // General catches addiction services that don't specify a substance
    // These should rank LOWER than substance-specific services for substance-specific queries
    general: /\b(NA\b|narcotics\s*anonymous|SMART\s*recovery|addiction(?!\s*(to\s+)?(alcohol|drinking))|recovery|detox|rehab|treatment|12-?step|residential)\b/i,
  },
} as const;

// Type exports for type safety
export type SearchType = 'sql' | 'sql+enrichment' | 'sql+semantic' | 'semantic' | 'openai' | 'cache';
export type QueryIntent = 'crisis' | 'alias' | 'location_only' | 'domestic_violence' | 'food_insecurity' | 'housing_urgent' | 'substance_abuse' | 'mental_health' | 'general';
export type SubstanceType = 'alcohol' | 'opioid' | 'stimulant' | 'cannabis' | 'gambling' | 'general' | null;

// Re-export the config type
export type SearchConfigType = typeof SEARCH_CONFIG;
