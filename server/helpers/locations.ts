/**
 * Alberta location data and utilities for location-based search filtering
 */

// Known Alberta cities/regions for location-based filtering
export const ALBERTA_LOCATIONS = new Set([
  'calgary', 'edmonton', 'red deer', 'lethbridge', 'medicine hat',
  'grande prairie', 'airdrie', 'spruce grove', 'leduc', 'fort mcmurray',
  'fort saskatchewan', 'lloydminster', 'camrose', 'brooks', 'cold lake',
  'wetaskiwin', 'okotoks', 'cochrane', 'chestermere', 'beaumont',
  'stony plain', 'sylvan lake', 'high river', 'hinton', 'canmore', 'banff',
  'drumheller', 'ponoka', 'taber', 'edson', 'peace river', 'slave lake',
  'st. albert', 'st albert', 'sherwood park', 'strathmore', 'lacombe',
  'innisfail', 'olds', 'didsbury', 'high level', 'whitecourt', 'drayton valley',
]);

// Variations and abbreviations that map to canonical location names
export const LOCATION_ALIASES: Record<string, string> = {
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
  'fortmac': 'fort mcmurray',
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
  'medhat': 'medicine hat',
  'the hat': 'medicine hat',

  // St. Albert variations
  'st. albert': 'st albert',
  'stalbert': 'st albert',
  'saint albert': 'st albert',

  // Red Deer variations
  'rdeer': 'red deer',
  'r deer': 'red deer',

  // Grande Prairie variations
  'gp': 'grande prairie',
  'grand prairie': 'grande prairie',

  // Common short forms
  'sherwood': 'sherwood park',
  'spruce': 'spruce grove',
  'stony': 'stony plain',
  'sylvan': 'sylvan lake',
  'cold lk': 'cold lake',
  'high rv': 'high river',
  'slave lk': 'slave lake',
  'peace rv': 'peace river',
  'drayton': 'drayton valley',
};

// Province-wide indicators
export const PROVINCE_WIDE_TERMS = [
  'alberta', 'province-wide', 'province wide', 'provincial', 'ab',
  'across alberta', 'all of alberta', 'anywhere in alberta',
];

export interface LocationContext {
  specifiedLocation: string | null;  // The location user specified (e.g., "calgary")
  isProvinceWide: boolean;           // Whether user asked for province-wide
}

/**
 * Extract location context from a search query
 */
export function extractLocationContext(query: string): LocationContext {
  const queryLower = query.toLowerCase();

  // Check for province-wide terms
  const isProvinceWide = PROVINCE_WIDE_TERMS.some(term => queryLower.includes(term));

  // Check for location aliases first
  for (const [alias, canonical] of Object.entries(LOCATION_ALIASES)) {
    if (queryLower.includes(alias)) {
      return { specifiedLocation: canonical, isProvinceWide };
    }
  }

  // Check for known Alberta locations
  for (const location of Array.from(ALBERTA_LOCATIONS)) {
    if (queryLower.includes(location)) {
      return { specifiedLocation: location, isProvinceWide };
    }
  }

  return { specifiedLocation: null, isProvinceWide };
}


/**
 * Format location name nicely (capitalize first letter of each word)
 */
export function formatLocationName(loc: string): string {
  return loc.split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
