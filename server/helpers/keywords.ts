/**
 * Keyword processing utilities: stop words, expansion, typo correction, stemming
 */

// Stop words excluded from keyword extraction
export const STOP_WORDS = new Set([
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'need', 'help', 'want',
  'find', 'get', 'for', 'with', 'in', 'the', 'a', 'an', 'and', 'or',
  'to', 'of', 'is', 'are', 'am', 'do', 'does', 'can', 'how', 'where',
  'what', 'near', 'around', 'some', 'any', 'please', 'looking', 'search',
  'services', 'service', 'resources', 'resource', 'about', 'have', 'has',
  'been', 'being', 'was', 'were', 'will', 'would', 'could', 'should',
  'there', 'here', 'this', 'that', 'these', 'those', 'it', 'its',
  'on', 'at', 'by', 'from', 'up', 'out', 'off', 'over', 'under',
  'again', 'further', 'then', 'once', 'both', 'each', 'all', 'most',
  'other', 'not', 'no', 'nor', 'but', 'if', 'so', 'too', 'very',
  'just', 'also', 'like', 'know', 'go', 'going', 'make', 'see',
]);

// Maps search terms to related terms for better pre-filtering
export const KEYWORD_EXPANSIONS: Record<string, string[]> = {
  'addiction': ['substance', 'drug', 'alcohol', 'opioid', 'detox', 'recovery', 'sober', 'rehab', 'withdrawal'],
  'alcohol': ['drinking', 'alcoholism', 'sobriety', 'addiction'],
  'drug': ['narcotics', 'substance', 'opioid', 'fentanyl', 'meth', 'cocaine'],
  'mental': ['psychological', 'psychiatric', 'therapy', 'counselling', 'emotional'],
  'shelter': ['housing', 'homeless', 'unhoused', 'accommodation', 'transitional', 'beds'],
  'crisis': ['emergency', 'urgent', 'helpline', 'hotline', 'distress'],
  'youth': ['teen', 'adolescent', 'young', 'child', 'gen-z'],
  'family': ['parenting', 'children', 'domestic'],
  'indigenous': ['first nations', 'metis', 'inuit', 'aboriginal', 'native'],
  'women': ['female', 'woman', 'gender', 'maternal'],
  'counselling': ['therapy', 'therapist', 'counselor', 'psychologist', 'psychotherapy'],
  'food': ['meal', 'nutrition', 'hungry', 'groceries', 'foodbank'],
  'employment': ['job', 'work', 'career', 'training'],
  'anxiety': ['anxious', 'worry', 'panic', 'stress'],
  'depression': ['depressed', 'sad', 'mood', 'hopeless'],
  'trauma': ['ptsd', 'abuse', 'violence', 'assault'],
  'recovery': ['rehabilitation', 'rehab', 'treatment', 'sober'],
  'harm': ['reduction', 'needle', 'injection', 'naloxone'],
  'detox': ['withdrawal', 'detoxification', 'medically'],
  'rehab': ['rehabilitation', 'residential', 'inpatient', 'treatment'],
  'homeless': ['houseless', 'unhoused', 'shelter', 'street'],
  'domestic': ['violence', 'abuse', 'intimate', 'partner'],
  'gambling': ['gaming', 'betting'],
  'grief': ['bereavement', 'loss', 'mourning'],
};

// Common misspellings mapped to correct terms
// Also includes identity mappings to prevent false corrections (e.g., hopeless → homeless)
export const COMMON_MISSPELLINGS: Record<string, string> = {
  // Identity mappings to prevent false corrections
  'hopeless': 'hopeless',  // Not "homeless"
  'helpless': 'helpless',  // Not "homeless"
  'burden': 'burden',      // Emotional state word
  'worthless': 'worthless', // Emotional state word
  // Actual misspellings
  'addicton': 'addiction',
  'addiciton': 'addiction',
  'addction': 'addiction',
  'alcahol': 'alcohol',
  'alchohol': 'alcohol',
  'alchohal': 'alcohol',
  'councelling': 'counselling',
  'counceling': 'counselling',
  'counsling': 'counselling',
  'counsilling': 'counselling',
  'sheltar': 'shelter',
  'shleter': 'shelter',
  'sheler': 'shelter',
  'mentol': 'mental',
  'mentla': 'mental',
  'anxeity': 'anxiety',
  'anxity': 'anxiety',
  'anixety': 'anxiety',
  'depresion': 'depression',
  'depressin': 'depression',
  'deppression': 'depression',
  'suicde': 'suicide',
  'suiside': 'suicide',
  'suicidal': 'suicidal',
  'homless': 'homeless',
  'houising': 'housing',
  'houseing': 'housing',
  'theropy': 'therapy',
  'theraphy': 'therapy',
  'detocs': 'detox',
  'withdrawl': 'withdrawal',
  'withdrawel': 'withdrawal',
  'opiods': 'opioid',
  'opoids': 'opioid',
  'fentanyl': 'fentanyl',
  'fentinal': 'fentanyl',
  'methadone': 'methadone',
  'methadoan': 'methadone',
  'nalaxone': 'naloxone',
  'naxolone': 'naloxone',
  'indiginous': 'indigenous',
  'indegenous': 'indigenous',
  'aborignal': 'aboriginal',
  'aborginal': 'aboriginal',
};

// Simple stemming rules for common recovery-related terms
const STEM_RULES: [RegExp, string][] = [
  [/tion$/, ''],           // addiction → addic
  [/sion$/, ''],           // depression → depres
  [/ment$/, ''],           // treatment → treat
  [/ness$/, ''],           // homelessness → homeless
  [/ing$/, ''],            // housing → hous, counselling → counsell
  [/ed$/, ''],             // addicted → addict
  [/er$/, ''],             // counseller → counsell
  [/or$/, ''],             // counselor → counsel
  [/ies$/, 'y'],           // families → family
  [/ive$/, ''],            // supportive → support
  [/ous$/, ''],            // anxious → anxi
  [/al$/, ''],             // mental → ment
  [/s$/, ''],              // services → service
];

/**
 * Levenshtein distance for fuzzy matching (handles typos not in dictionary)
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Find closest matching keyword using Levenshtein distance
 */
export function findClosestKeyword(input: string, maxDistance: number = 2): string | null {
  const inputLower = input.toLowerCase();

  // First check exact misspellings dictionary
  if (COMMON_MISSPELLINGS[inputLower]) {
    return COMMON_MISSPELLINGS[inputLower];
  }

  // Then try fuzzy matching against known keywords
  const knownKeywords = Object.keys(KEYWORD_EXPANSIONS);
  let bestMatch: string | null = null;
  let bestDistance = maxDistance + 1;

  for (const keyword of knownKeywords) {
    const distance = levenshteinDistance(inputLower, keyword);
    if (distance <= maxDistance && distance < bestDistance) {
      bestDistance = distance;
      bestMatch = keyword;
    }
  }
  return bestMatch;
}

/**
 * Correct typos in a query
 */
export function correctTypos(query: string): { corrected: string; corrections: string[] } {
  const words = query.toLowerCase().split(/\s+/);
  const corrections: string[] = [];
  const correctedWords = words.map(word => {
    // Skip short words and stop words
    if (word.length < 4 || STOP_WORDS.has(word)) return word;

    // Check misspellings dictionary first
    if (COMMON_MISSPELLINGS[word]) {
      corrections.push(`${word} → ${COMMON_MISSPELLINGS[word]}`);
      return COMMON_MISSPELLINGS[word];
    }

    // Try fuzzy matching
    const closest = findClosestKeyword(word);
    if (closest && closest !== word) {
      corrections.push(`${word} → ${closest}`);
      return closest;
    }

    return word;
  });
  return { corrected: correctedWords.join(' '), corrections };
}

/**
 * Simple word stemming
 */
export function stem(word: string): string {
  if (word.length <= 4) return word; // Don't stem short words

  let stemmed = word.toLowerCase();
  for (const [pattern, replacement] of STEM_RULES) {
    if (pattern.test(stemmed) && stemmed.replace(pattern, replacement).length >= 3) {
      stemmed = stemmed.replace(pattern, replacement);
      break; // Only apply one rule
    }
  }
  return stemmed;
}

/**
 * Normalize query for better cache hits
 */
export function normalizeForCache(q: string): string {
  return q
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/counc[ei]l+ing/g, 'counselling')
    .replace(/addic[it]+on/g, 'addiction')
    .replace(/ment[ae]l/g, 'mental')
    .replace(/he[al]+th/g, 'health')
    .replace(/anxi[ei]ty/g, 'anxiety')
    .replace(/depress?i?on/g, 'depression')
    .replace(/indigen[io]+us/g, 'indigenous')
    .replace(/homel?e?ss/g, 'homeless')
    .replace(/sheltt?er/g, 'shelter')
    .replace(/emerg[ae]n[cs]y/g, 'emergency')
    .replace(/supp?orr?t/g, 'support')
    .replace(/trea?t?ment/g, 'treatment')
    .replace(/alc[oa]h?ol/g, 'alcohol')
    .replace(/re[ha]+b/g, 'rehab');
}

/**
 * Extract meaningful keywords from a search query
 */
export function extractKeywords(query: string): string[] {
  const normalized = normalizeForCache(query);
  return normalized
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Expand keywords with related terms for broader pre-filtering
 */
export function expandKeywords(keywords: string[]): string[] {
  const expanded = new Set(keywords);
  for (const kw of keywords) {
    if (KEYWORD_EXPANSIONS[kw]) {
      for (const synonym of KEYWORD_EXPANSIONS[kw]) {
        expanded.add(synonym);
      }
    }
    // Reverse expansion: if this keyword is a synonym of another term, include that term
    for (const [key, synonyms] of Object.entries(KEYWORD_EXPANSIONS)) {
      if (synonyms.includes(kw)) {
        expanded.add(key);
      }
    }
  }
  return Array.from(expanded);
}

// Query intent classification types
export type QueryIntent = 'crisis' | 'specific_service' | 'category_browse' | 'location_search' | 'general';

/**
 * Classify the intent of a search query
 */
export function classifyQueryIntent(query: string): QueryIntent {
  const q = query.toLowerCase();

  // Crisis indicators (highest priority)
  if (/\b(suicide|suicidal|kill myself|end my life|crisis|emergency|overdose|od['']?d|dying|help me)\b/.test(q)) {
    return 'crisis';
  }

  // Specific service lookup (looking for a named organization by acronym or name)
  if (/\b(cmha|211|988|aa|na|smart recovery|distress centre|salvation army|mustard seed|inn from the cold)\b/i.test(q)) {
    return 'specific_service';
  }

  // Category browsing (user wants a list)
  if (/\b(list of|all|show me|what are the|find all|every)\b/.test(q)) {
    return 'category_browse';
  }

  return 'general';
}

// ============= PHONETIC MATCHING =============
// Catches typos that sound right but are spelled wrong (e.g., "fud bank" → "food bank")

// Phonetic substitution rules for social services domain
const PHONETIC_SUBSTITUTIONS: [RegExp, string][] = [
  // Common phonetic equivalents
  [/ph/g, 'f'],
  [/gh/g, 'f'],
  [/ck/g, 'k'],
  [/cc/g, 'k'],
  [/qu/g, 'k'],
  [/tion/g, 'shn'],
  [/sion/g, 'zhn'],
  [/dge/g, 'j'],
  [/tch/g, 'ch'],
  [/wr/g, 'r'],
  [/kn/g, 'n'],
  [/gn/g, 'n'],
  [/pn/g, 'n'],
  [/wh/g, 'w'],
  [/mb/g, 'm'],
  [/sce/g, 'se'],
  [/sci/g, 'si'],
  // Vowel normalizations
  [/ae/g, 'e'],
  [/oe/g, 'e'],
  [/ey/g, 'e'],
  [/ay/g, 'a'],
  [/eau/g, 'o'],
  [/ew/g, 'u'],
  [/oo/g, 'u'],
  [/ou/g, 'o'],
];

/**
 * Generate a phonetic code for a word
 * Similar words should produce similar codes
 */
export function phoneticCode(word: string): string {
  let s = word.toLowerCase().trim();

  // Apply phonetic substitutions
  for (const [pattern, replacement] of PHONETIC_SUBSTITUTIONS) {
    s = s.replace(pattern, replacement);
  }

  // Remove duplicate consonants
  s = s.replace(/([bcdfghjklmnpqrstvwxz])\1+/g, '$1');

  // Remove trailing silent e
  s = s.replace(/e$/, '');

  // Keep first vowel, remove subsequent vowels (simplification)
  const firstVowelIdx = s.search(/[aeiou]/);
  if (firstVowelIdx >= 0) {
    const before = s.substring(0, firstVowelIdx + 1);
    const after = s.substring(firstVowelIdx + 1).replace(/[aeiou]/g, '');
    s = before + after;
  }

  return s.substring(0, 8); // Limit to 8 chars for comparison
}

/**
 * Check if two words match phonetically
 */
export function phoneticMatch(word1: string, word2: string): boolean {
  return phoneticCode(word1) === phoneticCode(word2);
}

// Direct phonetic corrections for common social services terms
export const PHONETIC_CORRECTIONS: Record<string, string> = {
  // Food
  'fud': 'food',
  'fut': 'food',
  'fod': 'food',
  // Shelter
  'shelta': 'shelter',
  'sheltr': 'shelter',
  'sheltar': 'shelter',
  // Counselling
  'konseling': 'counselling',
  'counsling': 'counselling',
  'konsling': 'counselling',
  'cownseling': 'counselling',
  // Addiction
  'adikshun': 'addiction',
  'adikshon': 'addiction',
  // Mental
  'mentl': 'mental',
  'mentul': 'mental',
  // Health
  'helth': 'health',
  'helthe': 'health',
  // Housing
  'howsing': 'housing',
  'howzing': 'housing',
  'housng': 'housing',
  // Emergency
  'emerjency': 'emergency',
  'imergency': 'emergency',
  'emergancy': 'emergency',
  // Recovery
  'recovry': 'recovery',
  'recuvery': 'recovery',
  // Therapy
  'theripy': 'therapy',
  'theropy': 'therapy',
  // Crisis
  'crysis': 'crisis',
  'krisis': 'crisis',
};

/**
 * Correct a word using phonetic matching
 * Returns the corrected word or the original if no match
 */
export function correctPhonetic(word: string): string {
  const lower = word.toLowerCase();

  // Check direct phonetic corrections first
  if (PHONETIC_CORRECTIONS[lower]) {
    return PHONETIC_CORRECTIONS[lower];
  }

  // Check if phonetically matches any known correction target
  for (const correct of Object.values(PHONETIC_CORRECTIONS)) {
    if (phoneticMatch(lower, correct)) {
      return correct;
    }
  }

  // Check if phonetically matches any known keyword
  for (const keyword of Object.keys(KEYWORD_EXPANSIONS)) {
    if (phoneticMatch(lower, keyword) && lower !== keyword) {
      return keyword;
    }
  }

  return word;
}

/**
 * Apply phonetic corrections to a full query
 */
export function correctQueryPhonetic(query: string): { corrected: string; corrections: string[] } {
  const words = query.toLowerCase().split(/\s+/);
  const corrections: string[] = [];

  const correctedWords = words.map(word => {
    // Skip short words
    if (word.length < 3) return word;

    const corrected = correctPhonetic(word);
    if (corrected !== word) {
      corrections.push(`${word} → ${corrected} (phonetic)`);
      return corrected;
    }
    return word;
  });

  return { corrected: correctedWords.join(' '), corrections };
}
