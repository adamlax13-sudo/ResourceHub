/**
 * Frontend utility to extract a location from a search query
 * and return the corresponding dropdown value from Hero.tsx's ALBERTA_LOCATIONS.
 *
 * This mirrors a subset of the backend's extractLocationContext
 * (server/helpers/locations.ts) but is scoped to only the 21 cities
 * available in the location dropdown.
 */

// The 21 dropdown city values, sorted longest-first for matching
const DROPDOWN_CITIES = [
  'fort saskatchewan',
  'fort mcmurray',
  'grande prairie',
  'sherwood park',
  'medicine hat',
  'spruce grove',
  'lloydminster',
  'lethbridge',
  'cold lake',
  'red deer',
  'st albert',
  'edmonton',
  'cochrane',
  'calgary',
  'okotoks',
  'camrose',
  'canmore',
  'airdrie',
  'brooks',
  'leduc',
  'banff',
];

// Aliases that map to dropdown city values.
// Only includes aliases whose canonical target is a dropdown city.
// Omitted from backend: 'gp' (ambiguous — also means "general practitioner"),
// 'spruce' (covered by full name 'spruce grove'), 'fortmac' (covered by 'fort mac'/'ft mac').
const ALIASES: Record<string, string> = {
  // Airport codes
  'yyc': 'calgary',
  'yeg': 'edmonton',
  'yqf': 'red deer',
  'yql': 'lethbridge',
  'ymm': 'fort mcmurray',
  'ygp': 'grande prairie',
  'yxh': 'medicine hat',
  'yqd': 'lloydminster',
  'yod': 'cold lake',

  // Fort McMurray variations
  'fort mac': 'fort mcmurray',
  'ft mac': 'fort mcmurray',
  'ft. mac': 'fort mcmurray',
  'ft mcmurray': 'fort mcmurray',
  'ft. mcmurray': 'fort mcmurray',
  'wood buffalo': 'fort mcmurray',

  // Fort Saskatchewan variations
  'fort sask': 'fort saskatchewan',
  'ft sask': 'fort saskatchewan',
  'ft. sask': 'fort saskatchewan',
  'ft saskatchewan': 'fort saskatchewan',
  'ft. saskatchewan': 'fort saskatchewan',

  // Medicine Hat variations
  'med hat': 'medicine hat',
  'the hat': 'medicine hat',

  // St. Albert variations
  'st. albert': 'st albert',
  'saint albert': 'st albert',

  // Grande Prairie variations
  'grand prairie': 'grande prairie',

  // Sherwood Park
  'sherwood': 'sherwood park',
};

// Sorted longest-first so longer aliases match before shorter substrings
const SORTED_ALIAS_ENTRIES = Object.entries(ALIASES).sort(
  (a, b) => b[0].length - a[0].length,
);

// Province-wide terms (return '' to select "All of Alberta" in dropdown)
const PROVINCE_WIDE_TERMS = [
  'anywhere in alberta',
  'across alberta',
  'all of alberta',
  'province-wide',
  'province wide',
  'provincial',
  'alberta',
];

/**
 * Extract a location from a search query and return the dropdown value.
 *
 * @returns A dropdown-compatible city value (e.g. "edmonton"), '' for province-wide, or null if no location detected.
 */
export function extractQueryLocation(query: string): string | null {
  const q = query.toLowerCase();

  // 1. Province-wide terms first
  for (const term of PROVINCE_WIDE_TERMS) {
    if (q.includes(term)) {
      return '';
    }
  }

  // 2. Aliases before city names (more specific patterns first)
  for (const [alias, city] of SORTED_ALIAS_ENTRIES) {
    if (q.includes(alias)) {
      return city;
    }
  }

  // 3. Dropdown city names (already sorted longest-first)
  for (const city of DROPDOWN_CITIES) {
    if (q.includes(city)) {
      return city;
    }
  }

  return null;
}
