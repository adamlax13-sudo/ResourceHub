/**
 * Query Analysis Configuration
 *
 * Main search configuration including query analysis parameters,
 * intent detection patterns, substance patterns, category indicators,
 * typo dictionaries, location data, exclusion patterns, and more.
 */

import {
  CRISIS_PINNED_SERVICE_ID,
  CRISIS_PINNED_SERVICE_LITE,
  CRISIS_PINNED_SERVICE_FULL,
  PCHAD_PINNED_SERVICE_ID,
  PCHAD_PINNED_SERVICE_LITE,
  PCHAD_PINNED_SERVICE_FULL,
} from './pinned';

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
    model: 'text-embedding-3-large' as const,
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
  // SAFETY-CRITICAL: This is a life-safety feature. When in doubt, include a pattern.
  // False positives (showing 988 when not needed) are vastly preferable to false negatives.
  crisis: {
    // Explicit crisis keywords — direct phrases that always indicate crisis
    keywords: [
      'suicide',
      'suicidal',
      'kill myself',
      'end my life',
      'want to die',
      'wanna die',
      'dont want to live',
      "don't want to live",
      'self harm',
      'self-harm',
      'overdose',
      'off myself',
      'unalive',
      'self delete',
      'self-delete',
      'take my own life',
      'take my life',
      'commit suicide',
      'not worth living',
      'rather be dead',
      'better off dead',
      'kms',           // "kill myself" abbreviation
      'kys',           // "kill yourself" — toxic gaming culture / self-directed
      'end it all',
      'hurt myself',   // general self-harm
      'harm myself',   // general self-harm
      'cut myself',    // general self-harm (without specifying body part)
      'exit bag',      // specific suicide method reference
      'drink bleach',  // method reference (sometimes hyperbolic, but err on safety)
      'catch the bus', // suicide community euphemism
      // Gen Z / internet culture euphemisms
      'sewerslide',    // TikTok censorship evasion for "suicide"
      'sewer slide',
      'toaster bath',  // dark humor suicide method reference
      'neck rope',     // dark humor suicide method reference
      'forever sleep', // euphemism for death/suicide
      'eternal sleep',
      'permadeath',    // gaming term used as suicide euphemism
      'rage quit life', // gaming metaphor for suicide
    ],
    // Implicit crisis patterns — subtle expressions of suicidal ideation
    // These use regex to catch variations in phrasing
    implicitPatterns: [
      // --- Expressions of not wanting to exist ---
      /\b(don'?t|do not|dont)\s+want\s+to\s+(be here|exist|wake up|live|be alive)\b/i,
      /\b(don'?t|do not|dont)\s+want\s+to\s+be\s+here\s*(anymore|any more)?\b/i,
      /\b(don'?t|do not|dont)\s+feel\s+like\s+(being here|living|existing|being alive|going on)\b/i,
      /\b(don'?t|do not|dont)\s+want\s+to\s+(be around|be alive|keep going|keep living|go on)\b/i,
      /\b(no point|what'?s the point|pointless)\s+(in|to|of)?\s*(living|life|going on|continuing)?\b/i,
      /\b(can'?t|cannot|cant)\s+(go on|take it|do this|take this)\s*(anymore|any more)?\b/i,

      // --- Better off dead / burden ---
      /\b(better off|world.*better)\s+(without me|if i.*gone|dead)\b/i,
      /\b(hopeless|worthless|burden)\b/i,
      /\b(i'?m|i am)\s+(a\s+)?burden\b/i,
      /\b(everyone|they|the world|my family|people)\s+(would be|is|are)\s+better\s+(off\s+)?without\s+me\b/i,

      // --- Ending it / final solution ---
      /\b(end(ing)?)\s+(it|it all|everything|my life|this)\b/i,
      /\b(final)\s+(solution|way out|exit|goodbye|answer)\b/i,
      /\bpermanent\s+(solution|escape|way out)\b/i,

      // --- Nobody cares / unwanted ---
      /\b(nobody|no one|noone)\s+(would|will)\s+(care|notice|miss me)\b/i,
      /\b(nobody|no one|noone)\s+(wants|needs|cares about|cares for|loves)\s+me\b/i,
      /\b(nobody|no one|noone)\s+wants\s+me\s+(here|around|anymore|any more)\b/i,
      /\b(i'?m|i am)\s+(unwanted|unloved|a burden|in the way|invisible)\b/i,

      // --- Giving up on life ---
      /\b(give up|giving up)\s+(on life|on everything|completely)?\b/i,
      /\b(tired of|done with|sick of)\s+(living|life|fighting|everything|trying)\b/i,
      /\b(can'?t|cannot|cant)\s+keep\s+(going|living|doing this)\b/i,

      // --- Wish I was never born / shouldn't exist ---
      /\bwish\s+i\s+(was\s+|were\s+)?(never\s+born|dead|gone)\b/i,
      /\bshouldn'?t\s+(be here|exist|have been born|be alive)\b/i,

      // --- Internet euphemisms for suicide ---
      /\b(un-?alive|unalive)\s*(myself|me)?\b/i,
      /\bself[- ]?delete\b/i,
      /\b(off|offing)\s+(myself|me)\b/i,
      /\b(gonna|going to|want to|wanna)\s+(off|unalive|self[- ]?delete)\s+(myself|me)\b/i,

      // --- Gen Z / internet culture / content filter evasion ---
      // Leetspeak and censored spellings of "suicide"
      /\bsu[i1!][c¢][i1!]de\b/i,
      /\bsewer\s*slide\b/i,
      // Gaming metaphors for suicide
      /\bgame[- ]?end\s+(myself|me)\b/i,
      /\b(log|logging)\s+(off|out)\s+(permanently|forever|for good)\b/i,
      /\b(alt[- ]?f4|ctrl[- ]?alt[- ]?delete)\s+(my\s+)?(life|myself|existence)\b/i,
      /\bleave\s+(this\s+|the\s+)?(server|game|world)\s+(permanently|forever|for good|behind)\b/i,
      // Self-yeet (Gen Z term for throwing oneself)
      /\b(yeet|yeeting)\s+(myself|me)\s*(off|from|into)?\b/i,
      /\bself[- ]?yeet\b/i,
      /\b(final|last)\s+yeet\b/i,
      // Dark humor method references
      /\btoaster\s+bath\b/i,
      /\bneck\s+rope\b/i,
      /\b(commit|go)\s+(neck rope|toaster bath|sewer\s*slide|sewerslide)\b/i,
      // "Go to sleep forever" / "long sleep"
      /\b(go to|take a|the)\s+(forever|eternal|long|permanent|final)\s+sleep\b/i,

      // --- Method references ---
      /\b(jump|jumping)\s+(off|from)\s+(a\s+)?(bridge|building|roof|cliff|balcony)\b/i,
      /\b(slit|cut|cutting)\s+(my\s+)?(wrists?|veins?|throat)\b/i,
      /\b(hang|hanging)\s+(myself|me)\b/i,
      /\b(pull the trigger|shoot myself|gun to my head)\b/i,
      /\b(take|swallow|down)\s+(all|a bunch of|too many)\s+(my\s+)?(pills?|medication|meds)\b/i,
      /\b(step in front of|throw myself|jump in front)\b/i,
      /\bod\s+(on|with)\s+(pills?|medication|meds|drugs)\b/i,  // "od on pills"
      /\b(drown|drowning)\s+(myself|me)\b/i,

      // --- Farewell / goodbye expressions ---
      /\b(this is|it'?s)\s+(my\s+)?(goodbye|farewell|the end|my last)\b/i,
      /\b(won'?t|will not)\s+(be here|be around|see)\s+(much longer|tomorrow|anymore)\b/i,
      /\b(no|not)\s+(reason|point)\s+(to|for)\s+(live|living|go on|continue|stay)\b/i,
      /\b(rather|want to)\s+(die|be dead|not exist|disappear forever)\b/i,
      /\bpeace\s+out\s+(forever|for good|permanently)\b/i,

      // --- Pain cessation / desperation ---
      /\b(just\s+)?(want|need)\s+(the\s+)?pain\s+to\s+(stop|end|go away)\b/i,
      /\bmake\s+(the\s+)?pain\s+(stop|end|go away)\b/i,
      /\b(taking|take)\s+the\s+easy\s+way\s+out\b/i,

      // --- Cry for help ---
      /\b(i'?m|i am)\s+(going to|gonna)\s+(do it|end it|kill myself|hurt myself)\b/i,
      /\bhelp\s+me\s+(die|end it|kill myself)\b/i,
      /\b(can'?t|cannot|cant)\s+(live|survive)\s+(like this|this way|without)\b/i,
      /\b(life|living)\s+(isn'?t|is not|not)\s+worth\s+(it|living|the pain)\b/i,

      // --- Censored / obfuscated spellings ---
      // Covers s*icide, su*cide, sui*ide, s**cide, etc. (non-letter char replaces letter)
      /\bs[^a-z\s]i?cide\b/i,
      /\bsu[^a-z\s]c?ide\b/i,
      /\bsui[^a-z\s]ide\b/i,
    ],
    pinnedServiceId: CRISIS_PINNED_SERVICE_ID,
    pinnedServiceLite: CRISIS_PINNED_SERVICE_LITE,
    pinnedServiceFull: CRISIS_PINNED_SERVICE_FULL,
  },

  // === PCHAD (Protection of Children Abusing Drugs) ===
  // Prioritize PCHAD when parents search for help with their child's addiction
  pchad: {
    // Patterns to detect parent/guardian seeking help for child's substance abuse
    // Note: (?:\w+\s+)* allows optional adjectives like "male", "young", "teenage" between my/our and child word
    patterns: [
      // Direct child + addiction patterns (allows "my male teen", "my young son", etc.)
      /\b(my|our)\s+(?:\w+\s+)*(child|kid|son|daughter|teen|teenager|adolescent)\b.*\b(addict|addiction|addicted|using|drugs?|substance|fent|fentanyl|meth|cocaine|opioid|heroin|pills?|overdose|OD)\b/i,
      /\b(child|kid|son|daughter|teen|teenager|adolescent)\b.*\b(won'?t|will not|can'?t|cannot)\s+(stop|quit)\b.*\b(using|drugs?|drinking|smoking)\b/i,
      /\b(child|kid|son|daughter|teen|teenager|adolescent)\b.*\b(drug|substance|addiction|addict)\b/i,
      // Reverse order patterns (substance mentioned first)
      /\b(addict|addiction|drugs?|substance|fent|fentanyl|meth|cocaine|opioid|heroin)\b.*\b(my|our)\s+(?:\w+\s+)*(child|kid|son|daughter|teen|teenager|adolescent)\b/i,
      /\b(help|support|treatment|intervention)\b.*\b(my|our)\s+(?:\w+\s+)*(child|kid|son|daughter|teen|teenager)\b.*\b(addict|drug|substance)\b/i,
      // PCHAD-specific searches
      /\bpchad\b/i,
      /\bprotection of children abusing drugs\b/i,
      // Parent concern patterns
      /\b(parent|mom|dad|mother|father|guardian)\b.*\b(help|support)\b.*\b(child|kid|son|daughter|teen)\b.*\b(addict|drug|substance)\b/i,
      /\b(worried|scared|concerned|desperate)\b.*\b(my|our)\s+(?:\w+\s+)*(child|kid|son|daughter|teen)\b.*\b(drug|addict|using|substance)\b/i,
      // Youth intervention patterns
      /\b(youth|minor|underage)\b.*\b(addict|addiction|drug|substance)\b.*\b(help|intervention|treatment)\b/i,
      /\b(force|make|get)\b.*\b(my|our)\s+(?:\w+\s+)*(child|kid|son|daughter|teen)\b.*\b(treatment|rehab|help)\b/i,
    ],
    pinnedServiceId: PCHAD_PINNED_SERVICE_ID,
    pinnedServiceLite: PCHAD_PINNED_SERVICE_LITE,
    pinnedServiceFull: PCHAD_PINNED_SERVICE_FULL,
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
      // Sexual assault / rape
      /\b(?:raped|rape|sexual assault|sexually assaulted|molested|sexual abuse)\b/i,
      /(?:he|she|partner|ex).*(?:forced|made).*(?:me|sex)/i,
      // Stalking / harassment
      /\b(?:stalking|stalker|stalked|harassing|harassment)\b.*(?:ex|partner|won'?t leave)/i,
      /(?:ex|partner).*(?:won'?t|will not).*(?:leave me alone|stop|go away)/i,
      // Coercive control
      /(?:controls?|controlling).*(?:my|money|friends|family|phone|where I go)/i,
      /\b(?:financial abuse|emotional abuse|coercive control|isolated me)\b/i,
      // Human trafficking
      /\b(?:human trafficking|sex trafficking|trafficked|forced labour|forced labor|exploitation)\b/i,
      /\b(?:trafficking.*(?:help|support|victim|survivor))\b/i,
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
      // Affordable housing (long-term)
      /\b(?:affordable|subsidized|low-?income).*(?:housing|apartment|rental|unit)/i,
      /\b(?:rent supplement|rent assistance|social housing|public housing)\b/i,
      /\b(?:habitat for humanity|housing.*waitlist|housing.*wait list)\b/i,
    ],
    substance_abuse: [
      /(?:can'?t|cannot|struggling|help|stop|quit|trouble).*(?:drinking|alcohol|drug|using|addiction|addict|gambling|betting|coke|cocaine|crack|meth|crystal|heroin|fentanyl|pills?|weed|smoke|smoking)/i,
      /(?:drinking|alcohol|drug|addict|gambling|betting|coke|cocaine|crack|meth|heroin|fentanyl).*(?:problem|issue|help|recovery)/i,
      /(?:relapse|withdrawal|detox|rehab|sober|sobriety)/i,
      /(?:addicted|hooked).*(?:to|on)/i,
      // Street names and slang in distress context
      /(?:can'?t|cannot|stop|quit|struggling).*\b(coke|blow|crack|meth|crystal|speed|heroin|smack|dope|fenny|percs?|oxy)\b/i,
      /\b(coke|cocaine|crack|meth|crystal|fentanyl|heroin|opioid).*(?:addict|problem|help|recovery|quit|clean)\b/i,
      // Recovery-specific patterns (for queries like "recovery support no 12 step")
      /\b(?:recovery|recovering).*(?:support|program|group|meeting|help)/i,
      /\b(?:12[\s-]?step|twelve[\s-]?step|AA\b|NA\b|CA\b|SMART Recovery)\b/i,
      /\b(?:no|non|not|without|alternative).*(?:12[\s-]?step|AA\b|NA\b)/i,
      // Gambling-specific patterns
      /(?:can'?t|cannot|stop|quit|control).*(?:gambling|betting|playing.*(?:slots|poker|casino|bet))/i,
      /(?:gambling|betting|casino).*(?:addiction|problem|help|support)/i,
      /(?:lost|losing).*(?:money|everything).*(?:gambling|betting|casino)/i,
      /(?:gambler|gambling addict)/i,
      // Financial ruin from gambling
      /(?:lost|blew|spent|wasted).*(?:money|savings|paycheck|rent).*(?:on|to|at)/i,
      /(?:in debt|owe money).*(?:because|from|due to)/i,
      /(?:ruined|destroyed).*(?:finances|life|family).*(?:gambling|betting)/i,
      // Directory/informational patterns (not distress-phrased)
      /\b(?:addiction|addictions)\s+(?:treatment|program|services?|centre|center|residential|recovery|counsell?ing)\b/i,
      /\b(?:residential)\s+(?:treatment|recovery|rehab|addiction|programs?)\b/i,
      /\b(?:treatment|recovery)\s+(?:centre|center|house|facility|programs?)\b.*(?:addiction|alcohol|drug|substance)/i,
      /\b(?:drug|alcohol|substance)\s+(?:treatment|rehabilitation|recovery|programs?|counsell?ing)\b/i,
    ],
    mental_health: [
      /(?:feel|i'?m|feeling|struggling|always).*(?:sad|depressed|anxious|hopeless|alone|empty|worthless|overwhelmed|lost)/i,
      /(?:anxiety|depression|panic|stress|trauma|ptsd).*(?:attack|help|support|treatment)/i,
      /(?:can'?t|cannot).*(?:cope|function|eat|get out of bed)/i,
      /(?:can'?t|cannot).*(?:fall asleep|sleep at night|sleeping)/i,
      /(?:struggling|help|need).*(?:mental health|mental-health|my mental)/i,
      /(?:no one|nobody).*(?:to talk|who cares|understands)/i,
      // Note: standalone "lonely/isolated" moved to community_social intent;
      // mental_health still catches these via distress patterns below and categoryIndicators
      // Expanded emotional distress patterns
      /(?:scared|terrified|trapped|helpless|stuck)/i,
      /(?:can'?t cope|breaking down|falling apart|at my wit'?s end)/i,
      /(?:completely alone|nobody understands|no one to talk)/i,
      /(?:don'?t know what to do|at a loss|losing it)/i,
      // Social isolation and friendship difficulties (generic - not disability-specific)
      /(?:can'?t|cannot|don'?t|hard to).*(?:make|keep|have).*(?:friends|friendships|connections)/i,
      /(?:no friends|have no friends|friendless|alone|no one to talk)/i,
      /(?:socially|social).*(?:awkward|anxious|isolated|struggling)/i,
      // Eating disorders
      /\b(?:anorexia|anorexic|bulimia|bulimic|binge eating|eating disorder|ED recovery)\b/i,
      /(?:can'?t|won'?t|afraid to).*(?:eat|eating)|(?:purging|throwing up|making myself sick)/i,
      // Self-harm
      /\b(?:self-?harm|cutting|self-?injury|hurting myself|burning myself)\b/i,
      /(?:want to|urge to).*(?:hurt myself|cut myself|harm myself)/i,
      // Specific conditions
      /\b(?:bipolar|manic|mania|schizophrenia|psychosis|psychotic|hearing voices|BPD|borderline)\b/i,
      /\b(?:OCD|obsessive.*compulsive|intrusive thoughts|compulsions?)\b/i,
      /\b(?:panic attack|agoraphobia|phobia|social anxiety)\b/i,
      // Postpartum
      /\b(?:postpartum|post-?partum|PPD|baby blues|after giving birth).*(?:depression|anxiety|help|support)/i,
      // Trauma/PTSD
      /\b(?:PTSD|post-?traumatic|trauma|flashbacks?|nightmares?|triggered)\b/i,
    ],
    // Disability and neurodivergent support - checked BEFORE mental_health fallback in analyzer
    // Combined patterns: disability condition + social/support need
    disability_support: [
      // Autism/ASD + social difficulties (the key pattern for "im autistic and cant find friends")
      /\b(?:autis|autism|autistic|ASD|asperger|aspie|on the spectrum)\b.*(?:friend|social|lonely|isolated|connect|relationship)/i,
      /(?:friend|social|lonely|isolated|connect).*\b(?:autis|autism|autistic|ASD|asperger|aspie|on the spectrum)\b/i,
      // Direct disability support requests
      /\b(?:i'?m|i am|i have|diagnosed with)\s*(?:autistic|autism|ASD|asperger|aspie)\b/i,
      /\b(?:autistic|autism|ASD|asperger|aspie)\s*(?:and|support|help|services|group|program|community)\b/i,
      // ADHD support patterns
      /\b(?:i'?m|i am|i have|diagnosed with)\s*(?:ADHD|ADD)\b.*(?:help|support|group|program|struggling)/i,
      /\b(?:ADHD|ADD)\s*(?:support|help|services|group|program|community|coaching)\b/i,
      // Neurodivergent community/support
      /\b(?:neurodivergent|neurodiverse)\s*(?:support|services|help|group|community|friends|social)\b/i,
      /\b(?:i'?m|i am)\s*(?:neurodivergent|neurodiverse)\b/i,
      // Disability services general
      /\b(?:disability|disabled)\s*(?:support|services|help|resources|program|community)\b/i,
      // Developmental disability support
      /\b(?:developmental.*disability|intellectual.*disability|learning.*disability)\b.*(?:support|help|services|program)/i,
      // Sensory processing support
      /\b(?:sensory.*processing|sensory.*issues|sensory.*overload)\b.*(?:support|help|therapy|group)/i,
      // AISH/PDD (Alberta disability programs)
      /\b(?:AISH|PDD)\b.*(?:help|support|apply|services)/i,
      // FASD support
      /\b(?:FASD|fetal alcohol|FAS)\b.*(?:support|help|services|diagnosis|assessment|network)/i,
      /\b(?:child|kid|son|daughter).*\b(?:FASD|fetal alcohol)\b/i,
      // Brain injury support
      /\b(?:brain injury|ABI|acquired brain|TBI|traumatic brain|concussion)\b.*(?:support|help|rehab|services)/i,
      /\b(?:cognitive rehab|brain care|synapse)\b/i,
      // Chronic pain
      /\b(?:chronic pain|pain management|pain clinic|pain centre|pain center)\b/i,
    ],
    // Grief and bereavement support
    grief_support: [
      /(?:grief|bereavement|mourning).*(?:support|counsell?ing|group|help)/i,
      /(?:lost|death of|passed away|died|murdered|killed).*(?:my|a).*(?:mom|dad|parent|spouse|husband|wife|child|son|daughter|loved one|sibling|brother|sister|baby|friend|pet|dog|cat)/i,
      /(?:coping|dealing).*(?:with|after).*(?:loss|death|passing|murder)/i,
      /(?:widow|widower|bereaved)\b/i,
      /\b(?:my|a).*(?:mom|dad|parent|spouse|husband|wife|child|son|daughter).*(?:died|passed|passed away|gone|murdered|killed|was killed)\b/i,
      // Violent loss patterns
      /\b(?:my|a).*(?:mom|dad|parent|spouse|husband|wife|child|son|daughter|loved one).*(?:was|were|got).*(?:murdered|killed|shot|stabbed|drowned)\b/i,
      /\b(?:murdered|killed|homicide|violent death|took their life|suicide|overdose|OD'd)\b.*(?:my|a).*(?:mom|dad|parent|spouse|husband|wife|child|son|daughter|loved one)/i,
      // Pregnancy/infant loss
      /\b(?:miscarriage|stillbirth|stillborn|lost the baby|baby died|infant loss|pregnancy loss|SIDS)\b/i,
      // Pet loss
      /\b(?:my|our).*(?:dog|cat|pet).*(?:died|passed|had to put down|euthanized|put to sleep)\b/i,
      /\b(?:pet loss|losing a pet|grieving.*pet)\b/i,
      // Accident/illness related
      /\b(?:died in|killed in|lost.*to).*(?:accident|crash|fire|cancer|illness)\b/i,
      /\b(?:terminal|hospice|end of life|dying).*(?:family|parent|spouse|child|loved one)\b/i,
    ],
    // Senior and elderly services
    senior_services: [
      /(?:senior|elderly|aging|aged).*(?:services?|support|help|care)/i,
      /(?:help|support|care).*(?:for|with).*(?:my|a|an).*(?:elderly|aging|senior|old).*(?:parent|mom|dad|mother|father)/i,
      /\b(?:dementia|alzheimer|mobility|fall risk|home care|assisted living|nursing home)\b/i,
      /\b(?:meals on wheels|senior center|senior centre|elder abuse|geriatric)\b/i,
      /\b(?:65\+|70\+|80\+).*(?:services?|support|help)\b/i,
    ],
    // Legal aid and court services
    legal_aid: [
      /(?:need|looking for|find).*(?:a\s+)?(?:lawyer|attorney|legal help|legal aid)/i,
      /(?:legal|court|custody|divorce|immigration).*(?:help|support|services?|assistance)/i,
      /(?:can'?t afford|free|low cost).*(?:lawyer|legal)/i,
      /\b(?:tenant rights|eviction|evicted|landlord|tenancy|housing.*legal|family court|child support)\b/i,
      /\b(?:legal aid|pro bono|lawyer referral|restraining order|protection order)\b/i,
      // Custody and access disputes (not violence — legal issue)
      /(?:ex|partner|husband|wife|spouse).*(?:won'?t|will not|refuse|denied|keeping).*(?:see|visit|access|take).*(?:kids?|children|son|daughter)\b/i,
      /(?:won'?t|can'?t|not allowed).*(?:see|visit|access).*(?:my\s+)?(?:kids?|children|son|daughter)\b/i,
      /\b(?:custody|access|visitation|parenting time|parenting order|custody battle|custody dispute)\b/i,
    ],
    // Employment and job support
    employment_support: [
      /(?:lost|fired|laid off|unemployed|need).*(?:my\s+)?(?:job|work|employment)/i,
      /(?:job|career|employment|work).*(?:help|support|training|services?)/i,
      /(?:looking for|find|need).*(?:work|job|employment)/i,
      /\b(?:EI|employment insurance|unemployment|resume|interview prep|job search)\b/i,
      /\b(?:career counsell?ing|workforce|apprentice|skills training)\b/i,
    ],
    // Youth and teen services
    youth_services: [
      /(?:teen|teenager|adolescent|youth|young adult).*(?:help|support|services?|crisis|struggling)/i,
      /(?:help|support).*(?:for|with).*(?:my|a).*(?:teen|teenager|adolescent|youth)/i,
      /(?:my|our).*(?:teen|teenager).*(?:needs?|struggling|crisis|problem)/i,
      /\b(?:kids help phone|youth shelter|runaway|troubled teen)\b/i,
    ],
    // Newcomer and immigration services
    newcomer_services: [
      /(?:newcomer|immigrant|refugee|new to canada).*(?:help|support|services?)/i,
      /(?:settlement|immigration|ESL|language).*(?:help|support|services?)/i,
      /(?:just arrived|recently arrived|new immigrant|asylum)\b/i,
      /\b(?:sponsorship|citizenship|work permit|refugee claim|landed immigrant)\b/i,
    ],
    // Family addiction support (Al-Anon, Nar-Anon)
    family_addiction_support: [
      /(?:my|our).*(?:spouse|husband|wife|partner|parent|child|son|daughter|family member|loved one).*(?:is|has|drinks?|using|addicted|addiction)/i,
      /(?:living with|married to|dealing with).*(?:an?\s+)?(?:alcoholic|addict)/i,
      /(?:family|loved one).*(?:'s|has).*(?:addiction|drinking|drug).*(?:problem|issue)/i,
      /\b(?:al-?anon|nar-?anon|family.*addiction.*support|codependent)\b/i,
      /(?:help|support).*(?:for|as).*(?:family|spouse|parent|child).*(?:of|with).*(?:addict|alcoholic)/i,
      /(?:my|our).*(?:kid|child|son|daughter|teen|teenager).*(?:drugs?|using|smoking|snorting|out of control)/i,
      /(?:worried|concerned|scared).*(?:about|for).*(?:my|our).*(?:spouse|husband|wife|partner|child|son|daughter|teen).*(?:drinking|using|drug|addiction|substance)/i,
      /(?:how|what).*(?:can|do|should).*(?:I|we).*(?:do|help).*(?:my|our).*(?:spouse|husband|wife|partner|child|son|daughter).*(?:addict|drug|alcohol|substance|drinking)/i,
    ],
    // Financial support and debt help
    financial_support: [
      /(?:can'?t|cannot).*(?:pay|afford).*(?:bills?|rent|utilities|groceries)/i,
      /(?:in|have|drowning in).*(?:debt|financial.*trouble)/i,
      /(?:financial|money).*(?:help|support|assistance|crisis)/i,
      /\b(?:bankruptcy|collections?|payday loan|credit counsell?ing)\b/i,
      /(?:behind on|late on).*(?:payments?|bills?|rent)/i,
      /\b(?:budget|debt management|financial literacy)\b/i,
    ],
    // Caregiver support
    caregiver_support: [
      /(?:caregiver|caregiving|caring for).*(?:burnout|stress|support|help|exhausted)/i,
      /(?:looking after|taking care of).*(?:my|a).*(?:parent|spouse|child|family member)/i,
      /\b(?:respite care|caregiver respite|family caregiver)\b/i,
      /(?:overwhelmed|exhausted|burnt out).*(?:caring|looking after|caregiver)/i,
      /\b(?:caregiver.*support|support.*caregiver)\b/i,
    ],
    // LGBTQ+ services
    lgbtq_services: [
      /\b(?:lgbtq|lgbt|lgbtq\+|2slgbtq|queer).*(?:services?|support|help|resources?|counsell?ing|therapy)/i,
      /\b(?:trans|transgender).*(?:healthcare|support|services?|help)/i,
      /(?:coming out|gay|lesbian|bisexual|non-?binary).*(?:support|help|counsell?ing)/i,
      /\b(?:pride|gender affirming|hormone therapy|gender identity)\b/i,
      /\b(?:lgbtq|lgbt|queer|trans).*(?:youth|teen|senior|elder)\b/i,
      /\b(?:lgbtq|lgbt|2slgbtq|queer|gay|lesbian|bisexual|trans|transgender|non-?binary|gender identity).*(?:counsell?ing|therapy|mental health)/i,
    ],
    // Indigenous services (First Nations, Metis, Inuit)
    indigenous_services: [
      /\b(?:indigenous|first nations?|métis|metis|inuit|native|aboriginal).*(?:services?|support|help|resources?)/i,
      /\b(?:treaty|reserve|band office|status card|status indian)\b/i,
      /\b(?:elder|smudging|sweat lodge|ceremony|medicine wheel|traditional healing)\b/i,
      /\b(?:residential school|sixties scoop|MMIWG|missing.*murdered.*indigenous)\b/i,
      /\b(?:indigenous|native|aboriginal).*(?:mental health|addiction|healing|wellness)\b/i,
      /\b(?:jordan'?s principle|nihb|non-?insured health benefits)\b/i,
    ],
    // Veteran and military services
    veteran_services: [
      /\b(?:veteran|veterans?|military|armed forces|canadian forces|ex-?military|former military|CAF|CFB)\b.*(?:support|services?|help|mental health|PTSD|trauma)/i,
      /\b(?:PTSD|post-?traumatic|trauma|flashback).*(?:veteran|military|combat|war|deployment|service)/i,
      /\b(?:veteran|military).*(?:counsell?ing|therapy|treatment|recovery)/i,
      /\b(?:VAC|veterans affairs|OSISS|operational stress|combat stress)\b/i,
      /\b(?:legion|royal canadian legion|poppy fund)\b/i,
      /(?:served|deployed|combat|tour).*(?:afghanistan|iraq|overseas|military)/i,
      /(?:returning|returned).*(?:soldier|veteran|service member)/i,
    ],
    // Student/campus services
    student_services: [
      /\b(?:student|university|college|campus).*(?:counsell?ing|mental health|support|crisis|resource|service|help)/i,
      /\b(?:resource|help|support|service)s?\b.*\b(?:university|college|campus)\b/i,
      /\b(?:u of c|u of a|uofc|uofa|ucalgary|ualberta|mount royal|mru|sait|nait|macewan|bow valley)\b/i,
      /\b(?:academic|exam|finals|stress|thesis|dissertation|failing|dropped out)\b/i,
      /\b(?:dorm|residence|student housing|roommate|tuition|student loan)\b/i,
      /\b(?:grad student|undergrad|postgrad|phd|masters|degree)\b/i,
    ],
    // Parenting and baby support
    parenting_support: [
      /\b(?:pregnant|pregnancy|prenatal|postpartum|new mom|new parent|expecting)\b/i,
      /\b(?:baby|infant|newborn|toddler).*(?:help|support|need|struggling)/i,
      /\b(?:formula|diapers|baby supplies|infant essentials|car seat|crib|stroller)\b/i,
      /\b(?:parenting|parent support|single parent|teen parent|young parent)\b/i,
      /\b(?:breastfeeding|nursing|lactation|postpartum depression|ppd|baby blues)\b/i,
      /\b(?:childcare|daycare|child care).*(?:help|afford|can'?t|need)/i,
      // Child welfare / aging out of care
      /\b(?:child welfare|children'?s services|foster care|kinship care|aging out)\b/i,
      /\b(?:youth in care|aged out|former foster|crown ward)\b/i,
      /\b(?:child advocate|youth advocate|advancing futures)\b/i,
      // Midwifery / prenatal
      /\b(?:midwife|midwifery|doula|prenatal class|birth plan)\b/i,
    ],
    // Healthcare access (doctors, clinics, prescriptions, hospitals, accessibility)
    healthcare_access: [
      /\b(?:doctor|physician|family doctor|walk-?in clinic|medical clinic)\b/i,
      /\b(?:prescription|medication|pharmacy|pharmacist)\b.*(?:help|afford|can't|program)/i,
      /\b(?:no doctor|need a doctor|find a doctor|finding a doctor)\b/i,
      /\b(?:health benefits|health coverage|health insurance)\b/i,
      /\b(?:community health|health centre|health center)\b/i,
      /\b(?:dental|dentist|dental clinic|dental services|dental care|teeth|tooth)\b/i,
      /\b(?:sexual health|STI|STD|contraception|family planning)\b/i,
      /\b(?:hospital|emergency room|emergency department|ER|urgent care)\b/i,
      /\b(?:AADL|aids to daily living|wheelchair|mobility aid|home modification)\b/i,
      /\b(?:RAMP|SHARP|seniors? benefit|drug coverage|pharmacare)\b/i,
      /\b(?:physiotherapy|physio(?:therapist)?|physical therapy|occupational therapy|rehab(?:ilitation)?)\b/i,
      /\b(?:eye exam|optometrist|optician|glasses|eyeglasses|vision care|optical)\b/i,
    ],
    // Basic needs & material aid (clothing, furniture, supplies)
    basic_needs: [
      /\b(?:need|looking for|where).*(?:clothes|clothing|furniture|household|supplies)\b/i,
      /\b(?:emergency).*(?:supplies|assistance|financial|funds)\b/i,
      /\b(?:hygiene|toiletries|personal care).*(?:products|supplies|kits)\b/i,
      /\b(?:clothing bank|clothing room|thrift|donation centre|furniture bank)\b/i,
      /\b(?:utility|rent|bill).*(?:help|assistance|arrears|subsidy|supplement)\b/i,
    ],
    // Criminal justice reintegration and reentry
    criminal_justice: [
      /\b(?:just|recently).*(?:released|out of|left|got out of).*(?:prison|jail|custody|penitentiary|incarcerat)/i,
      /\b(?:halfway house|reintegration|re-?entry|reentry)\b/i,
      /\b(?:parole|probation)\b.*(?:help|support|officer|services?)/i,
      /\b(?:on parole|on probation)\b/i,
      /\b(?:criminal record|record suspension|pardon)\b/i,
      /\b(?:john howard|elizabeth fry|st\.? leonard)/i,
      /\b(?:drug treatment court|drug court|diversion program)\b/i,
      /\b(?:restorative justice|victim.offender mediation)\b/i,
      /\b(?:ex-?offender|former offender|incarcerated|formerly incarcerated)\b/i,
      /\b(?:after prison|after jail|post-?release|post-?incarcerat)\b/i,
    ],
    // Community & social connection, recreation, hobbies
    community_social: [
      // Social connection / loneliness (proactive, not crisis)
      /\b(?:make|find|meet|looking for)\s*(?:friends|people|connections?|companions?)\b/i,
      /\b(?:can'?t|cannot|don'?t have|no|need)\s*(?:find|make)?\s*(?:friends|people|connections?|companions?)\b/i,
      /\b(?:social\s*(?:activities|connection|support|groups?|programs?|events?|clubs?|circles?))\b/i,
      /\b(?:i'?m|i am|i feel|feeling|so)\s*(?:lonely|lonesome|isolated|alone)\b/i,
      /\b(?:lonely|loneliness|isolated|isolation)\b/i,
      /\b(?:lonely|loneliness|isolated|isolation)\b.*\b(?:connect|friends|people|activities|things to do)\b/i,
      /\b(?:connect|friends|people|activities|things to do)\b.*\b(?:lonely|loneliness|isolated|isolation)\b/i,
      // Recreation and fitness
      /\b(?:recreation|recreational)\s*(?:programs?|centres?|centers?|activities|classes)\b/i,
      /\b(?:drop-?in)\s*(?:programs?|activities|classes|fitness|sports?|swimming|skating)\b/i,
      /\b(?:fitness|exercise|swimming|skating|sports?)\s*(?:programs?|classes|drop-?in|centres?|centers?)\b/i,
      // Community activities / things to do
      /\b(?:things?\s*to\s*do|activities)\b.*\b(?:community|local|nearby|in\s+\w+)\b/i,
      /\b(?:community)\s*(?:programs?|activities|groups?|events?|centres?|centers?)\b/i,
      /\b(?:group\s*activities|meetup|meet-?up)\b/i,
      // Hobbies and interests
      /\b(?:hobbies|hobby|arts?\s*and\s*crafts?|woodworking|makerspace|maker\s*space|gardening|community\s*garden)\b/i,
      /\b(?:men'?s\s*shed)\b/i,
      // Volunteering
      /\b(?:volunteer|volunteering|give\s*back|civic\s*engagement)\b.*\b(?:opportunit|program|connect|where|how)\b/i,
      // Outdoors and nature
      /\b(?:hiking|outdoor)\s*(?:group|club|activities|programs?|recreation)\b/i,
      /\b(?:nature)\s*(?:programs?|activities|therapy|wellness|based)\b/i,
      // Adaptive and inclusive recreation
      /\b(?:adaptive|adapted|inclusive)\s*(?:sports?|recreation|programs?|activities)\b/i,
      /\b(?:wheelchair)\s*(?:sports?|basketball|rugby|tennis|hockey)\b/i,
      // YMCA / rec centres
      /\bYMCA\b/i,
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
      /\b(DTs|detoxing)\b/i,
      /\b(shakes|tremors|withdrawal)\b.*\b(drink|alcohol|booze|sober|liquor)\b/i,
      /\b(drink|alcohol|booze|sober|liquor)\b.*\b(shakes|tremors|withdrawal)\b/i,
      /\b(hair of the dog|liquid courage|falling off the wagon)\b/i,
      /\b(binge|bender|on a bender)\b/i,
    ],
    opioid: [
      /\b(heroin|fentanyl|opioid|opiate|morphine|oxycontin|methadone|suboxone|buprenorphine)\b/i,
      /\b(painkiller|pain\s*pill).*addict/i,
      /\b(needle|inject|shooting up)\b/i,
      // Street names and slang
      /\b(oxy|percs?|roxies?|dope|smack|junk|horse|china white|tar)\b/i,
      /\b(popping|taking|buying|doing)\s+blues\b/i,
      /\bblues\b.*\b(fentanyl|oxy|pill|press)\b/i,
      /\b(nodding|on the nod|pinned|dopesick|kicking|cold turkey)\b/i,
      /\b(chasing|chasing the dragon)\b/i,
      /\b(dilaudid|hydromorphone|codeine|tramadol|norco|vicodin)\b/i,
    ],
    stimulant: [
      /\b(meth|methamphetamine|crystal|cocaine|coke|crack)\b/i,
      // Prescription stimulants (commonly abused)
      /\b(adderall|ritalin|vyvanse|concerta|dexedrine|amphetamine|dextroamphetamine|methylphenidate)\b/i,
      // Street names and slang
      /\b(blow|yayo|8-?ball)\b/i,
      /\b(snow|white|powder|rails?|lines?)\s+(coke|cocaine|meth|crack|speed)/i,
      /\b(doing|snorting|cutting|racking)\s+(lines?|rails?|powder)\b/i,
      /\b(ice|glass|tina|speed|crank|tweak|tweaking|geeked|gacked)\b/i,
      /\b(crashing|coming down|stayed up \d+ days?|haven'?t slept)\b/i,
      /\b(uppers|stims|study drugs?)\b/i,
    ],
    cannabis: [
      /\b(weed|pot|marijuana|cannabis|thc|dab|dabs)\b/i,
      // Colloquial terms
      /\b(vape|vaping|cartridge)\b/i,
      /\b(bud|flower|edibles?|gummies|cart)\s+(weed|marijuana|cannabis|thc|dispensary)/i,
      /\b(smoking|buying|selling)\s+(bud|flower|cart|edibles?|gummies)\b/i,
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
      // Social isolation and loneliness
      /\b(lonely|loneliness|isolated|isolation|no.*friends|can'?t.*make.*friends|socially.*awkward)\b/i,
      /\b(don'?t.*have.*friends|have.*no.*friends|friendless|no.*social.*(?:life|connections?|skills?))\b/i,
      /\b(social.*anxiety|social.*phobia|social.*skills|social.*difficulties)\b/i,
      // Eating disorders
      /\b(anorexia|anorexic|bulimia|bulimic|binge.*eat|eating.*disorder|purging)\b/i,
      // Self-harm
      /\b(self-?harm|cutting|self-?injury|hurting.*myself|burning.*myself)\b/i,
      // Specific conditions
      /\b(borderline|BPD|manic|mania|psychosis|psychotic|hearing.*voices|dissociat)\b/i,
      /\b(agoraphobia|phobia|intrusive.*thoughts|compulsions?|flashbacks?)\b/i,
      // Postpartum
      /\b(postpartum|post-?partum|PPD|baby.*blues|perinatal)\b/i,
    ],
    // Disability and neurodivergent conditions (often need specialized support)
    disability: [
      // Neurodivergent conditions
      /\b(autis|autism|autistic|ASD|asperger|aspie|neurodivergent|neurodiverse|on the spectrum)\b/i,
      /\b(ADHD|ADD|attention deficit|hyperactiv|executive function)\b/i,
      /\b(dyslexia|dyslexic|dyscalculia|dyspraxia|learning.*disabilit|learning.*disorder)\b/i,
      /\b(sensory.*processing|sensory.*issues|sensory.*overload|overstimulat)\b/i,
      // Developmental disabilities
      /\b(developmental.*delay|developmental.*disabilit|intellectual.*disabilit|down.*syndrome)\b/i,
      /\b(FASD|fetal.*alcohol|FAS\b)\b/i,
      // Physical disabilities
      /\b(disabilit|disabled|handicap|wheelchair|mobility.*issue|mobility.*impair)\b/i,
      /\b(blind|visually.*impair|deaf|hearing.*impair|hard.*of.*hearing)\b/i,
      /\b(paralyz|parapleg|quadripleg|amputee|prosthetic)\b/i,
      // Chronic conditions that affect daily functioning
      /\b(chronic.*fatigue|fibromyalgia|chronic.*pain|chronic.*illness)\b/i,
      /\b(brain injury|ABI|TBI|traumatic brain|concussion|cognitive rehab)\b/i,
      // Support and services
      /\b(AISH|PDD|disability.*services|accessibility|accommodations?|adaptive)\b/i,
    ],
    // Domestic violence terms
    domestic_violence: [
      /\b(abus(?:e|ed|ive|er)|violen(?:t|ce)|assault|attack|hit|beat|hurt)\b/i,
      /\b(partner|husband|wife|boyfriend|girlfriend|spouse|ex)\b/i,
      /\b(safe.*(?:house|place)|women'?s.*shelter|escape|flee|protect)\b/i,
      /\b(threaten|control|stalk|harass|intimidate|isolate)\b/i,
      /\b(restraining.*order|protection.*order)\b/i,
      /\b(trafficking|trafficked|exploited|exploitation|forced labour)\b/i,
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
      /\b(halfway house|parole|probation|reintegration|ex-?offender|criminal record)\b/i,
    ],
    // Criminal justice / reintegration terms
    criminal_justice: [
      /\b(jail|prison|penitentiary|incarcerat|convict|offend|inmate)\b/i,
      /\b(parole|probation|halfway house|reintegration|reentry|re-?entry)\b/i,
      /\b(criminal record|record suspension|pardon|drug court|diversion)\b/i,
      /\b(john howard|elizabeth fry|st\.? leonard|restorative justice)\b/i,
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
    // Grief and bereavement indicators
    grief: [
      /\b(grief|bereavement|mourning|loss|died|passed away|death|funeral|memorial)\b/i,
      /\b(widow|widower|bereaved|losing.*loved one)\b/i,
      /\b(murdered|killed|homicide|suicide|overdose|OD'd|took their life|violent death)\b/i,
      /\b(miscarriage|stillbirth|stillborn|infant loss|pregnancy loss|SIDS|lost the baby)\b/i,
      /\b(pet.*died|dog.*died|cat.*died|pet loss|put to sleep|euthanized)\b/i,
      /\b(terminal|hospice|end of life|dying|cancer took)\b/i,
      /\b(accident|crash|drowned|fire).*(?:died|killed|lost)\b/i,
    ],
    // Senior/elderly indicators
    senior: [
      /\b(senior|elderly|aging|aged|older adult|65\+|70\+|retirement|retired)\b/i,
      /\b(dementia|alzheimer|mobility.*issue|home care|nursing home|assisted living)\b/i,
      /\b(geriatric|elder|grandparent|grandmother|grandfather)\b/i,
    ],
    // Youth/teen indicators
    youth: [
      /\b(youth|teen|teenager|adolescent|young adult|under 18|under 25)\b/i,
      /\b(runaway|troubled teen|youth.*crisis|kids help)\b/i,
    ],
    // Newcomer/immigrant indicators
    newcomer: [
      /\b(newcomer|refugee|immigrant|asylum|settlement|new to canada)\b/i,
      /\b(ESL|citizenship|work permit|sponsorship|landed immigrant)\b/i,
    ],
    // Family addiction support indicators (Al-Anon, Nar-Anon)
    family_addiction: [
      /\b(my|our).*(family|spouse|partner|parent|child|son|daughter).*(addict|alcohol|drug|drinking)\b/i,
      /\b(al-?anon|nar-?anon|family.*support.*addict|codependent)\b/i,
      /\b(loved one|family member).*(?:is|has).*(?:addiction|drinking|drug)\b/i,
    ],
    // Substance abuse / addiction indicators (directory-style, not distress-required)
    substance_abuse: [
      /\b(?:addiction|addictions|addict)\b/i,
      /\b(?:rehab|rehabilitation|treatment center|treatment centre)\b/i,
      /\b(?:sober living|recovery house|halfway house|oxford house)\b/i,
      /\b(?:naloxone|narcan|needle exchange|safe injection|harm reduction|overdose)\b/i,
    ],
    // Caregiver indicators
    caregiver: [
      /\b(caregiver|caregiving|caring for|looking after)\b/i,
      /\b(respite|caregiver.*(?:burnout|stress|support|exhausted))\b/i,
    ],
    // LGBTQ+ indicators
    lgbtq: [
      /\b(lgbtq|lgbt|2slgbtq|queer|gay|lesbian|trans|transgender|bisexual|non-?binary)\b/i,
      /\b(coming out|pride|gender affirming|hormone therapy|gender identity)\b/i,
    ],
    // Indigenous indicators
    indigenous: [
      /\b(indigenous|first nations?|métis|metis|inuit|native|aboriginal)\b/i,
      /\b(treaty|reserve|band office|status|elder|ceremony|smudging|traditional healing)\b/i,
      /\b(residential school|sixties scoop|MMIWG|jordan'?s principle)\b/i,
    ],
    // Parenting/baby indicators
    parenting: [
      /\b(pregnant|pregnancy|prenatal|postpartum|expecting|due date)\b/i,
      /\b(baby|infant|newborn|toddler|diapers|formula|breastfeeding|nursing)\b/i,
      /\b(parent|parenting|mom|dad|single parent|teen parent|young parent)\b/i,
      /\b(childcare|daycare|car seat|crib|stroller|baby supplies)\b/i,
    ],
    // Employment indicators
    employment: [
      /\b(job|career|employment|resume|interview|work|workplace)\b/i,
      /\b(apprentice|trades?|skills training|workforce)\b/i,
      /\b(unemployed|laid off|fired|job loss|looking for work)\b/i,
    ],
    // Veteran/military indicators
    veteran: [
      /\b(veteran|military|armed forces|canadian forces|CAF|CFB)\b/i,
      /\b(service member|deployment|combat|legion|VAC|veterans affairs)\b/i,
    ],
    // Basic needs & material aid indicators
    basic_needs: [
      /\b(clothes|clothing|furniture|household items|supplies|blankets|coats)\b/i,
      /\b(hygiene|toiletries|personal care|shampoo|soap|toothbrush)\b/i,
      /\b(emergency assistance|emergency financial|utility assistance|rent assistance)\b/i,
      /\b(donation|donate|free stuff|thrift|clothing bank|furniture bank)\b/i,
    ],
    // Transportation indicators
    transportation: [
      /\b(transportation|transport|ride|rides|bus pass|bus ticket|shuttle)\b/i,
      /\b(medical transportation|patient transport|DATS|access-a-bus)\b/i,
    ],
    // Community & social connection indicators
    community_social: [
      /\b(recreation|recreational|fitness class|drop-in|sports league)\b/i,
      /\b(social connection|social support|social activit|community program|community group)\b/i,
      /\b(volunteer|volunteering)\b/i,
      /\b(hobby|hobbies|arts and crafts|woodworking|makerspace|maker space)\b/i,
      /\b(community garden|gardening club|urban farm)\b/i,
      /\b(men'?s shed|friendship club|hiking group|outdoor club)\b/i,
      /\b(YMCA|adaptive sport|wheelchair sport|inclusive recreation)\b/i,
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
    noWaitlist: /\b(no wait|no waitlist|without wait|immediate|right away|can'?t wait|urgent|asap|today|tonight|now|walk[\s-]?in)\b/i,
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
export type QueryIntent = 'crisis' | 'alias' | 'location_only' | 'domestic_violence' | 'food_insecurity' | 'housing_urgent' | 'substance_abuse' | 'mental_health' | 'disability_support' | 'grief_support' | 'senior_services' | 'legal_aid' | 'employment_support' | 'youth_services' | 'newcomer_services' | 'family_addiction_support' | 'financial_support' | 'caregiver_support' | 'lgbtq_services' | 'indigenous_services' | 'veteran_services' | 'student_services' | 'parenting_support' | 'community_social' | 'healthcare_access' | 'basic_needs' | 'criminal_justice' | 'general';
export type SubstanceType = 'alcohol' | 'opioid' | 'stimulant' | 'cannabis' | 'gambling' | 'general' | null;

// Re-export the config type
export type SearchConfigType = typeof SEARCH_CONFIG;

// ─── Sub-Intent Taxonomy ───────────────────────────────────────────────────
//
// Namespaced sub-intents: '<parent_intent>.<sub_intent>'
// Only 10 intents covered in v138; 14 deferred to future iteration.
// Deferred: domestic_violence, youth_services, family_addiction_support,
//   parenting_support, financial_support, grief_support, senior_services,
//   caregiver_support, lgbtq_services, crisis, food_insecurity, basic_needs,
//   community_social, student_services
// ────────────────────────────────────────────────────────────────────────────

export const SUB_INTENT_PATTERNS: Record<string, Record<string, RegExp[]>> = {
  housing_urgent: {
    'housing_urgent.emergency_shelter': [
      /\bemergency shelter\b/i,
      /\bnowhere to (?:sleep|stay|go)\b/i,
      /\bhomeless(ness)?\b/i,
      /\bno (?:fixed address|place to stay)\b/i,
      /\bsleeping rough\b/i,
    ],
    'housing_urgent.eviction_defense': [
      /\bevict(ion|ed|ing)?\b/i,
      /\btenant rights\b/i,
      /\bbeing forced out\b/i,
      /\blandlord.*(?:kick|throw|push|forc).*out\b/i,
    ],
    'housing_urgent.transitional_housing': [
      /\btransitional housing\b/i,
      /\bhalfway house\b/i,
      /\bsober living\b/i,
      /\bgroup home\b/i,
    ],
    'housing_urgent.affordable_housing': [
      /\baffordable housing\b/i,
      /\bsubsidized (housing|rent|apartment)\b/i,
      /\brent[- ]geared[- ]to[- ]income\b/i,
      /\bRGI\b/,
      /\blow[- ]income housing\b/i,
      /\bhousing (?:subsidy|benefit|allowance)\b/i,
    ],
    'housing_urgent.youth_housing': [
      /\byouth (?:shelter|housing|hostel)\b/i,
      /\brunaway\b/i,
      /\bcouch surfing\b/i,
      /\byoung (?:adult|person).*hous/i,
    ],
    'housing_urgent.supportive_housing': [
      /\b(?:sober living|sober house|recovery house)\b/i,
      /\b(?:supportive housing|supported housing)\b/i,
      /\b(?:permanent supportive)\b/i,
    ],
  },

  substance_abuse: {
    'substance_abuse.detox': [
      /\bdetox(ification)?\b/i,
      /\bwithdraw(al)?\b/i,
      /\bmedically supervised\b/i,
      /\bsober(ing) up\b/i,
    ],
    'substance_abuse.residential_treatment': [
      /\bresidential treat(ment)?\b/i,
      /\binpatient (rehab|treatment)\b/i,
      /\brehab(ilitation)?\b/i,
      /\btreatment cent(re|er)\b/i,
    ],
    'substance_abuse.harm_reduction': [
      /\bharm reduction\b/i,
      /\bnaloxone\b/i,
      /\bnarcan\b/i,
      /\bsafe (supply|injection|consumption)\b/i,
      /\bneedle (exchange|program)\b/i,
      /\boverdose prevention\b/i,
      /\bfentanyl\b/i,
    ],
    'substance_abuse.outpatient': [
      /\boutpatient\b/i,
      /\bday program\b/i,
      /\bsubstitut(ion|e) therapy\b/i,
      /\bmethadone\b/i,
      /\bsuboxone\b/i,
    ],
    'substance_abuse.gambling': [
      /\bgambl(ing|er|ed)\b/i,
      /\bbetting (problem|addiction)\b/i,
      /\bgamblers anonymous\b/i,
    ],
    'substance_abuse.cannabis': [
      /\bcannabis (use disorder|addiction|dependence)\b/i,
      /\bmarijuana (problem|addiction)\b/i,
      /\bweed.*problem\b/i,
    ],
    'substance_abuse.peer_recovery': [
      /\b(?:AA|NA|CA) meeting/i,
      /\b(?:recovery meeting|recovery group|recovery support)\b/i,
      /\b(?:sober communit|sober.*group|sober.*support)\b/i,
      /\b(?:peer.*recovery|peer support.*addict)/i,
      /\b(?:12[- ]?step meeting|twelve[- ]?step meeting)\b/i,
    ],
  },

  healthcare_access: {
    'healthcare_access.dental': [
      /\bdental\b/i,
      /\bdentist\b/i,
      /\btooth|teeth\b/i,
      /\boral health\b/i,
    ],
    'healthcare_access.walk_in_clinic': [
      /\bwalk[- ]in (clinic|centre|center)\b/i,
      /\bno (?:appointment|referral) (needed|required)\b/i,
      /\bdrop[- ]in (?:clinic|health)\b/i,
      /\bsame[- ]day (care|appointment)\b/i,
    ],
    'healthcare_access.hospital_er': [
      /\b(?:hospital|ER|emergency room|emergency department)\b/i,
      /\burgent care\b/i,
      /\btrauma cent(re|er)\b/i,
    ],
    'healthcare_access.prescription_coverage': [
      /\bprescription (?:coverage|cost|afford|help|free)\b/i,
      /\bmedication (?:cost|coverage|afford)\b/i,
      /\bdrug (?:coverage|plan|benefit)\b/i,
      /\bNHIB\b/i,
      /\bblue cross\b/i,
    ],
    'healthcare_access.disability_equipment': [
      /\b(?:mobility|assistive) (?:aids?|equipment|devices?)\b/i,
      /\bwheelchair\b/i,
      /\bwalker\b/i,
      /\bAADL\b/,
      /\bRGP\b/,
    ],
    'healthcare_access.physiotherapy': [
      /\bphysiotherapy\b/i,
      /\bphysio(?:therapist)?\b/i,
      /\bphysical therapy\b/i,
      /\boccupational therapy\b/i,
      /\brehabilitation\b/i,
    ],
    'healthcare_access.vision_care': [
      /\beye exam\b/i,
      /\boptometrist\b/i,
      /\bglasses\b/i,
      /\beyeglasses\b/i,
      /\bvision care\b/i,
      /\boptical\b/i,
      /\boptician\b/i,
    ],
    'healthcare_access.sexual_health': [
      /\b(?:sti|std|sexually transmitted|sexual health)\b/i,
      /\b(?:hiv|aids).*(?:test|clinic|support|help)\b/i,
      /\b(?:prep|pep)\b.*(?:hiv|clinic|prescri)/i,
      /\b(?:birth control|contracept|family planning)\b/i,
      /\b(?:gonorrhea|chlamydia|syphilis|herpes|hepatitis)\b.*(?:test|clinic|treat)/i,
    ],
    'healthcare_access.chronic_pain': [
      /\b(?:chronic pain|pain management|pain clinic|pain program|pain centre|pain center)\b/i,
      /\b(?:fibromyalgia|neuropathic pain)\b/i,
    ],
  },

  mental_health: {
    'mental_health.counselling': [
      /\bcounsell?ing\b/i,
      /\btherapy\b/i,
      /\btherapist\b/i,
      /\bpsychologist\b/i,
      /\bmental health support\b/i,
    ],
    'mental_health.depression': [
      /\bdepression\b/i,
      /\bdepressed\b/i,
      /\bfeeling (?:hopeless|worthless|empty)\b/i,
    ],
    'mental_health.psychiatry': [
      /\bpsychiatry\b/i,
      /\bpsychiatrist\b/i,
      /\bmedication management\b/i,
      /\bantidepressant\b/i,
      /\bbipolar\b/i,
      /\bschizophrenia\b/i,
    ],
    'mental_health.eating_disorder': [
      /\beating dis(?:order|ordered eating)\b/i,
      /\banorexia\b/i,
      /\bbulimia\b/i,
      /\bbinge eating\b/i,
      /\bEDSA\b/,
    ],
    'mental_health.trauma': [
      /\btrauma\b/i,
      /\bPTSD\b/i,
      /\bpost[- ]traumatic\b/i,
      /\babuse (survivor|recovery)\b/i,
      /\bcomplex trauma\b/i,
    ],
    'mental_health.anger_management': [
      /\banger management\b/i,
      /\brage\b/i,
      /\baggression\b/i,
      /\bconflict (?:management|resolution)\b/i,
      /\bviolent behaviour\b/i,
    ],
    'mental_health.postpartum': [
      /\bpostpartum\b/i,
      /\bpost[- ]natal\b/i,
      /\bperinatal mental health\b/i,
      /\bafter (birth|baby|delivery).*(?:depression|anxiety)\b/i,
      /\bnew (mom|mother|parent).*(?:depression|anxiety|struggle)\b/i,
    ],
  },

  indigenous_services: {
    'indigenous_services.residential_school_survivor': [
      /\bresidential school\b/i,
      /\bsurvivor (support|healing)\b/i,
      /\bIRS (support|survivors)\b/i,
      /\btruth and reconciliation\b/i,
    ],
    'indigenous_services.nihb_coverage': [
      /\bNIHB\b/i,
      /\bNon[- ]Insured Health Benefits\b/i,
      /\bfederal health (?:benefit|coverage).*(?:indigenous|first nations|inuit|métis)\b/i,
    ],
    'indigenous_services.cultural_healing': [
      /\bcultural healing\b/i,
      /\btraditional (?:healing|medicine|ceremony)\b/i,
      /\bElders?\b/i,
      /\bsmudging\b/i,
      /\bsweat lodge\b/i,
      /\bIndigenous (?:culture|tradition|ceremony)\b/i,
    ],
    'indigenous_services.language_preservation': [
      /\b(?:Cree|Blackfoot|Dene|Nakoda|Michif|Stoney) (?:language|class|program)\b/i,
      /\bIndigenous language\b/i,
      /\blanguage (?:revitalization|preservation|nest)\b/i,
    ],
    'indigenous_services.status_card': [
      /\b(?:status card|treaty card|indian status)\b/i,
      /\b(?:certificate of indian status|band membership)\b/i,
    ],
  },

  newcomer_services: {
    'newcomer_services.esl_language': [
      /\bESL\b/i,
      /\bELL\b/i,
      /\benglish (?:class|lesson|language|course|school)\b/i,
      /\blearn english\b/i,
      /\blanguage (?:class|training|program)\b/i,
      /\bFSL\b/i,
    ],
    'newcomer_services.credential_recognition': [
      /\bcredential (?:recognition|assessment|evaluation)\b/i,
      /\bforeign (?:credential|degree|diploma|qualification)\b/i,
      /\bIQAS\b/i,
      /\bWES\b/i,
      /\bprofessional (?:licence|license|certification).*(?:foreign|international|overseas)\b/i,
    ],
    'newcomer_services.settlement': [
      /\bsettlement (?:service|agency|program|worker)\b/i,
      /\bnewcomer (?:service|program|support)\b/i,
      /\bimmigrant (?:service|support|program)\b/i,
      /\bwelcome cent(re|er)\b/i,
    ],
    'newcomer_services.refugee': [
      /\brefugee\b/i,
      /\basylum seeker\b/i,
      /\bprotected person\b/i,
      /\bsponsorship (?:agreement|holder)\b/i,
      /\bIFH\b/i,
    ],
    'newcomer_services.interpretation': [
      /\binterpreter\b/i,
      /\btranslat(or|ion)\b/i,
      /\blanguage (?:barrier|access|help)\b/i,
      /\bculturally? (?:appropriate|sensitive) service\b/i,
    ],
  },

  legal_aid: {
    'legal_aid.family_court': [
      /\bcustody\b/i,
      /\bvisitation\b/i,
      /\bparenting (order|plan|time)\b/i,
      /\bfamily (?:court|law|lawyer)\b/i,
      /\bdivorce\b/i,
      /\bseparation (agreement|order)\b/i,
      /\bchild support\b/i,
    ],
    'legal_aid.eviction_defense': [
      /\bevict(ion|ed|ing)?\b/i,
      /\btenant rights\b/i,
      /\blandlord (?:dispute|problem|issue)\b/i,
      /\bRTDRS\b/i,
    ],
    'legal_aid.restraining_order': [
      /\brestraining order\b/i,
      /\bprotection order\b/i,
      /\bEPO\b/,
      /\bQEP\b/,
      /\bno[- ]contact order\b/i,
    ],
    'legal_aid.immigration_law': [
      /\bimmigration (?:lawyer|legal|law|help)\b/i,
      /\bdeportation\b/i,
      /\bvisa (?:problem|issue|appeal|denied)\b/i,
      /\brefugee (?:claim|board|hearing)\b/i,
    ],
    'legal_aid.criminal_court': [
      /\bcriminal (?:record|charge|lawyer|court)\b/i,
      /\bpardon\b/i,
      /\brecord suspension\b/i,
      /\bcharge (dismissed|stayed|withdrawn)\b/i,
    ],
  },

  employment_support: {
    'employment_support.job_search': [
      /\bjob (?:search|hunt|seek|find)\b/i,
      /\blooking for work\b/i,
      /\bunemployed\b/i,
      /\bjob (?:fair|posting|board|listing)\b/i,
    ],
    'employment_support.resume_help': [
      /\bresume\b/i,
      /\bCV\b/,
      /\bcover letter\b/i,
      /\bjob application\b/i,
      /\binterview (?:prep|skills|coaching)\b/i,
    ],
    'employment_support.credential_recognition': [
      /\bcredential (?:recognition|assessment)\b/i,
      /\bforeign (credential|degree|qualification)\b/i,
      /\bprofessional (?:licence|license).*(?:foreign|international)\b/i,
    ],
    'employment_support.barrier_employment': [
      /\bbarrier(s)? to employment\b/i,
      /\bsupported employment\b/i,
      /\bworkplace (accommodation|modification)\b/i,
      /\bdisability.*work\b/i,
    ],
    'employment_support.apprenticeship': [
      /\bapprenticeship\b/i,
      /\btrades (training|program)\b/i,
      /\bvocational training\b/i,
      /\bskills training\b/i,
    ],
  },

  veteran_services: {
    'veteran_services.ptsd_trauma': [
      /\bPTSD\b/i,
      /\boperational stress injury\b/i,
      /\bOSI\b/,
      /\bcombat trauma\b/i,
      /\bmilitary.*trauma\b/i,
    ],
    'veteran_services.military_family': [
      /\bmilitary family\b/i,
      /\bdeployment (?:support|stress)\b/i,
      /\bspouse.*military\b/i,
      /\bCAF (?:family|member|veteran)\b/i,
    ],
    'veteran_services.transition_support': [
      /\btransition(ing)? (out of|from) (?:military|service|forces)\b/i,
      /\breleas(ed|ing) (?:from)? (?:military|CF|CAF|forces)\b/i,
      /\bVAC\b/,
      /\bVeterans Affairs\b/i,
    ],
    'veteran_services.benefits_navigation': [
      /\bveteran (benefit|pension|allowance|disability)\b/i,
      /\bVAC benefit\b/i,
      /\bservice benefit\b/i,
      /\bmilitary pension\b/i,
    ],
  },

  disability_support: {
    'disability_support.aish_application': [
      /\bAISH\b/i,
      /\bAssured Income for the Severely Handicapped\b/i,
      /\bdisability benefit.*(?:Alberta|provincial)\b/i,
      /\bapply.*AISH\b/i,
    ],
    'disability_support.mobility_aids': [
      /\bwheelchair\b/i,
      /\bwalker\b/i,
      /\bmobility (?:aid|device|equipment|scooter)\b/i,
      /\bAADL\b/,
      /\bassistive (?:device|technology|equipment)\b/i,
    ],
    'disability_support.autism_support': [
      /\bautism\b/i,
      /\bASD\b/,
      /\bAsperger\b/i,
      /\bPDD\b/,
      /\bneurodiverg(ent|ence)\b/i,
    ],
    'disability_support.acquired_brain_injury': [
      /\bacquired brain injury\b/i,
      /\bABI\b/,
      /\btraumatic brain injury\b/i,
      /\bTBI\b/,
      /\bstroke (?:recovery|rehabilitation|support)\b/i,
    ],
    'disability_support.fasd': [
      /\b(?:FASD|fetal alcohol|foetal alcohol|FAS)\b/i,
      /\b(?:fetal alcohol spectrum)\b/i,
    ],
  },

  domestic_violence: {
    'domestic_violence.sexual_assault': [
      /\b(?:raped?|sexual assault|sexually assaulted|molested|sexual abuse|sexual violence)\b/i,
      /\bsexual (?:trauma|survivor|exploitation)\b/i,
    ],
    'domestic_violence.stalking': [
      /\bstalk(?:ing|er|ed)\b/i,
      /\bharass(?:ment|ing|ed)\b.*(?:ex|partner|former)\b/i,
      /\bcyberstalking\b/i,
    ],
    'domestic_violence.human_trafficking': [
      /\bhuman trafficking\b/i,
      /\bsex trafficking\b/i,
      /\blabour trafficking\b/i,
      /\bforced (labour|labor|prostitution)\b/i,
    ],
    'domestic_violence.coercive_control': [
      /\bcoercive control\b/i,
      /\bfinancial abuse\b/i,
      /\bemotional abuse\b/i,
      /\bisolat(?:ing|ed|ion).*(?:partner|spouse|husband|wife)\b/i,
    ],
    'domestic_violence.safety_planning': [
      /\bsafety plan\b/i,
      /\bleav(?:e|ing).*(?:abus(?:er|ive)|partner|husband|wife|spouse)\b/i,
      /\bescape.*(?:abus(?:er|ive)|violent|relationship)\b/i,
      /\bsafe (?:house|place|shelter)\b/i,
    ],
  },

  financial_support: {
    'financial_support.debt_counselling': [
      /\bdebt\b/i,
      /\bcredit counsell?ing\b/i,
      /\bbankruptcy\b/i,
      /\bcollection agency\b/i,
      /\bpayday loan\b/i,
    ],
    'financial_support.utility_arrears': [
      /\butility (?:bill|arrears|help|assist)\b/i,
      /\b(?:electric|gas|heat|power|water) bill\b/i,
      /\benergy (?:assist|rebate|program)\b/i,
      /\brent (?:arrears|behind|help)\b/i,
    ],
    'financial_support.income_support': [
      /\bincome support\b/i,
      /\bsocial assistance\b/i,
      /\bwelfare\b/i,
      /\bAlberta Works\b/i,
      /\bAISH\b/i,
    ],
    'financial_support.tax_clinic': [
      /\btax(?:es)? (?:clinic|help|filing|preparation|return)\b/i,
      /\bfil(?:e|ing).*\btax(?:es)?\b/i,
      /\bfree tax\b/i,
      /\bCVITP\b/,
      /\bincome tax\b/i,
    ],
  },

  grief_support: {
    'grief_support.violent_loss': [
      /\b(?:murder(?:ed)?|homicide|killed|shooting|stabbing|manslaughter)\b/i,
      /\bviol(?:ent|ence).*(?:death|loss|lost)\b/i,
      /\bvictim.*(?:crime|violence)\b/i,
    ],
    'grief_support.pet_loss': [
      /\bpet (?:loss|died|death|passing|grief|euthan)\b/i,
      /\b(?:dog|cat|animal).*(?:died|death|put down|passing)\b/i,
      /\bpet bereavement\b/i,
    ],
    'grief_support.pregnancy_loss': [
      /\bmiscarriage\b/i,
      /\bstillb(?:irth|orn)\b/i,
      /\bpregnancy loss\b/i,
      /\binfant loss\b/i,
      /\bneonatal (?:death|loss)\b/i,
      /\bSIDS\b/,
    ],
    'grief_support.suicide_loss': [
      /\b(?:lost|loss).*(?:to|by) suicide\b/i,
      /\bsuicide (?:bereavement|survivor|loss|grief)\b/i,
      /\b(?:friend|family|parent|child|sibling).*(?:took|ended).*(?:own|their) life\b/i,
    ],
    'grief_support.palliative_hospice': [
      /\b(?:hospice|palliative)\b/i,
      /\b(?:end of life|dying|terminal)\b.*(?:support|care|help)/i,
      /\b(?:comfort care)\b/i,
    ],
  },

  senior_services: {
    'senior_services.home_care': [
      /\bhome (?:care|support|help|health)\b/i,
      /\bin[- ]home (?:care|support|nursing)\b/i,
      /\baging in place\b/i,
      /\bpersonal care.*senior\b/i,
    ],
    'senior_services.dementia': [
      /\bdementia\b/i,
      /\balzheimer\b/i,
      /\bmemory (?:care|loss|clinic)\b/i,
      /\bcognitive decline\b/i,
    ],
    'senior_services.elder_abuse': [
      /\belder abuse\b/i,
      /\bsenior abuse\b/i,
      /\babusing.*(?:elderly|senior|older|parent|grandparent)\b/i,
      /\b(?:elderly|senior|older).*(?:neglect|exploit|abus)\b/i,
    ],
    'senior_services.meals_delivery': [
      /\bmeals on wheels\b/i,
      /\bmeal delivery.*senior\b/i,
      /\bsenior.*meal (?:program|delivery|service)\b/i,
      /\bcongregat(e|ion) dining\b/i,
    ],
  },

  community_social: {
    'community_social.social_connection': [
      /\blonely\b/i,
      /\bloneliness\b/i,
      /\bisolat(?:ed|ion)\b/i,
      /\bneed (?:friends|companionship|company|people)\b/i,
      /\bsocial (?:connection|group|club|circle)\b/i,
    ],
    'community_social.recreation': [
      /\brecreation\b/i,
      /\b(?:swimming|skating|fitness|gym|yoga|sports?)\b.*(?:lesson|class|program|free)\b/i,
      /\bfree (?:swimming|skating|fitness|gym|yoga|sports?)\b/i,
      /\bdrop[- ]in (?:sport|gym|rec|activity)\b/i,
    ],
    'community_social.volunteering': [
      /\bvolunteer(?:ing)?\b/i,
      /\bgive back\b/i,
      /\bcommunity (?:service|involvement)\b/i,
    ],
    'community_social.adaptive_sports': [
      /\badaptive (?:sport|recreation|fitness|program)\b/i,
      /\bwheelchair (?:sport|basketball|hockey|rugby|racing)\b/i,
      /\binclusive (?:sport|recreation|fitness)\b/i,
      /\bpara[- ]?sport\b/i,
    ],
  },

  youth_services: {
    'youth_services.runaway': [
      /\brunaway\b/i,
      /\bstreet youth\b/i,
      /\byouth.*(?:homeless|shelter)\b/i,
      /\bkicked out\b.*(?:teen|youth|kid)\b/i,
    ],
    'youth_services.youth_mental_health': [
      /\b(?:teen|youth|adolescent).*(?:depress|anxi|mental health|counsell?ing|therapy)\b/i,
      /\bkids help\b/i,
    ],
    'youth_services.youth_addiction': [
      /\b(?:teen|youth|adolescent).*(?:addict|substance|drug|alcohol|vaping)\b/i,
      /\bPCHAD\b/i,
    ],
    'youth_services.aging_out_of_care': [
      /\baging out\b/i,
      /\bformer (?:foster|ward|youth in care)\b/i,
      /\btransition(?:ing)? (?:out of|from) care\b/i,
    ],
  },

  parenting_support: {
    'parenting_support.prenatal': [
      /\bprenat(?:al|e)\b/i,
      /\bpregnant\b/i,
      /\bpregnancy (?:support|help|class|resource)\b/i,
      /\bexpecting (?:mom|mother|parent)\b/i,
    ],
    'parenting_support.postpartum': [
      /\bpostpartum\b/i,
      /\bpost[- ]natal\b/i,
      /\bnew (?:mom|mother|parent|baby)\b/i,
      /\bbreastfeed(?:ing)?\b/i,
    ],
    'parenting_support.childcare': [
      /\bchildcare\b/i,
      /\bdaycare\b/i,
      /\bchild care subsidy\b/i,
      /\bafter[- ]school\b/i,
    ],
    'parenting_support.teen_parent': [
      /\bteen (?:mom|parent|pregnancy|pregnant)\b/i,
      /\byoung (?:mom|parent|mother|father)\b/i,
    ],
    'parenting_support.kinship_care': [
      /\b(?:kinship care|kinship)\b/i,
      /\b(?:grandparent|grandmother|grandfather).*(?:raising|rais)\b/i,
      /\b(?:relative.*raising|raising.*grandchild)\b/i,
    ],
  },

  food_insecurity: {
    'food_insecurity.food_bank': [
      /\bfood bank\b/i,
      /\bfood hamper\b/i,
      /\bgrocery (?:help|assistance|hamper)\b/i,
      /\bfood pantry\b/i,
    ],
    'food_insecurity.free_meals': [
      /\bfree (?:meal|lunch|dinner|breakfast|soup)\b/i,
      /\bsoup kitchen\b/i,
      /\bcommunity (?:meal|kitchen|dinner)\b/i,
      /\bfood (?:program|drop[- ]in)\b/i,
    ],
    'food_insecurity.hamper_program': [
      /\bhamper (?:program|delivery|pick[- ]?up)\b/i,
      /\bChristmas (?:hamper|food)\b/i,
      /\bholiday (?:hamper|food)\b/i,
      /\bemergency food\b/i,
    ],
  },

  basic_needs: {
    'basic_needs.clothing': [
      /\bclothing\b/i,
      /\bclothes\b/i,
      /\bwinter (?:coat|jacket|gear)\b/i,
      /\bthrift store\b/i,
      /\bfree clothing\b/i,
    ],
    'basic_needs.furniture': [
      /\bfurniture\b/i,
      /\bhousehold (?:item|good|essential)\b/i,
      /\bbed(?:ding)?\b/i,
      /\bfurniture bank\b/i,
      /\bhome (?:starter|setup) kit\b/i,
    ],
    'basic_needs.hygiene': [
      /\bhygiene\b/i,
      /\btoiletr(?:y|ies)\b/i,
      /\bshower (?:access|facility)\b/i,
      /\blaundry\b/i,
    ],
    'basic_needs.emergency_financial': [
      /\bemergency (?:financial|funds?|money|cash|assistance)\b/i,
      /\bone[- ]time (?:financial|emergency|assistance)\b/i,
      /\beviction prevention\b/i,
    ],
    'basic_needs.transportation': [
      /\b(?:bus pass|transit pass|low[- ]income transit)\b/i,
      /\b(?:DATS|handibus|paratransit|wheelchair transport)\b/i,
      /\b(?:ride to|need a ride|transportation help|transportation assist)\b/i,
      /\b(?:medical transport|volunteer driver|volunteer ride)\b/i,
    ],
    'basic_needs.pet_support': [
      /\b(?:pet food|pet.*bank|pet.*pantry)\b/i,
      /\b(?:pet.*safe|safe.*pet|pet.*shelter|pet.*boarding)\b/i,
      /\b(?:afford.*vet|low[- ]cost.*vet|vet.*help|vet.*assist)\b/i,
      /\b(?:animal.*help|animal.*support|pet.*support)\b/i,
    ],
  },

  student_services: {
    'student_services.campus_counselling': [
      /\b(?:university|college|campus|student) counsell?ing\b/i,
      /\bstudent (?:mental health|wellness|therapy)\b/i,
      /\bcampus (?:mental health|wellness|counsell?ing)\b/i,
    ],
    'student_services.financial_aid': [
      /\bstudent (?:loan|finance|bursary|scholarship|aid)\b/i,
      /\btuition (?:help|assistance|waiver)\b/i,
      /\bstudent (?:emergency fund|food bank)\b/i,
    ],
    'student_services.student_housing': [
      /\bstudent (?:housing|residence|accommodation)\b/i,
      /\bcampus (?:housing|residence)\b/i,
    ],
  },

  lgbtq_services: {
    'lgbtq_services.trans_healthcare': [
      /\btrans (?:health|healthcare|care|clinic|surgery|hormone)\b/i,
      /\bgender[- ]affirm(?:ing|ation)\b/i,
      /\bHRT\b/,
      /\bhormone (?:therapy|replacement|treatment)\b/i,
    ],
    'lgbtq_services.coming_out': [
      /\bcoming out\b/i,
      /\bacceptance\b.*(?:gay|lesbian|bi|trans|queer)\b/i,
      /\b(?:gay|lesbian|bi|trans|queer).*(?:support|group|community)\b/i,
    ],
    'lgbtq_services.lgbtq_youth': [
      /\b(?:lgbtq?|queer|gay|trans|lesbian|bi).*(?:youth|teen|young)\b/i,
      /\b(?:youth|teen).*(?:lgbtq?|queer|gay|trans)\b/i,
      /\bGSA\b/,
    ],
  },

  caregiver_support: {
    'caregiver_support.respite': [
      /\brespite\b/i,
      /\brespite care\b/i,
      /\bbreak from caregiving\b/i,
      /\bshort[- ]term relief\b/i,
    ],
    'caregiver_support.caregiver_burnout': [
      /\bcaregiver (?:burnout|stress|exhaust|overwhelm)\b/i,
      /\bcaring for.*(?:exhaust|overwhelm|burnout|stress)\b/i,
      /\bcaregiver (?:support|counsell?ing|group)\b/i,
    ],
    'caregiver_support.dementia_caregiver': [
      /\bcaregiver.*(?:dementia|alzheimer|memory)\b/i,
      /\b(?:dementia|alzheimer).*caregiver\b/i,
      /\bcaring for.*(?:dementia|alzheimer)\b/i,
    ],
  },

  family_addiction_support: {
    'family_addiction_support.parent_of_addict': [
      /\b(?:my|our) (?:son|daughter|child|kid|teen).*(?:addict|drugs?|alcohol|substance|using)\b/i,
      /\bparent.*(?:addict|substance|drug)\b/i,
      /\bPCHAD\b/i,
    ],
    'family_addiction_support.spouse_of_addict': [
      /\b(?:my|our) (?:husband|wife|partner|spouse).*(?:addict|alcohol|drug|drink|using)\b/i,
      /\bliving with (?:an? )?addict\b/i,
      /\bcodependen(?:t|cy)\b/i,
      /\bal[- ]?anon\b/i,
    ],
  },

  // ─── NEW: criminal_justice sub-intents ───
  criminal_justice: {
    'criminal_justice.reentry': [
      /\b(?:just|recently).*(?:released|out of|left|got out of).*(?:prison|jail|custody|penitentiary)\b/i,
      /\b(?:reintegration|re-?entry|reentry|post-?release|after (?:prison|jail))\b/i,
      /\b(?:ex-?offender|formerly incarcerated)\b/i,
    ],
    'criminal_justice.drug_court': [
      /\b(?:drug treatment court|drug court|DTC)\b/i,
      /\b(?:diversion program|alternative.*(?:sentencing|incarcerat))\b/i,
    ],
    'criminal_justice.restorative_justice': [
      /\b(?:restorative justice|victim.offender mediation)\b/i,
      /\b(?:circle sentencing|healing circle|peacemaking)\b/i,
    ],
    'criminal_justice.record_suspension': [
      /\b(?:criminal record|record suspension|pardon)\b/i,
      /\b(?:background check|police check|vulnerable sector)\b/i,
    ],
  },

};

/**
 * Flat set of all valid sub-intent strings derived from SUB_INTENT_PATTERNS.
 * Used to validate LLM-returned sub-intents before merging.
 */
export const VALID_SUB_INTENTS: Set<string> = new Set(
  Object.values(SUB_INTENT_PATTERNS).flatMap(subMap => Object.keys(subMap))
);
