/**
 * Indigenous Service Identifier
 *
 * Single source of truth for identifying indigenous services
 * and detecting indigenous search intent.
 */

const NATION_NAMES = [
  // Treaty 7
  'siksika', 'tsuut\'ina', 'tsuu t\'ina', 'piikani', 'kainai',
  'blood tribe', 'stoney nakoda', 'stoney nation', 'blackfoot',
  // Treaty 6
  'ermineskin', 'samson cree', 'louis bull', 'enoch cree',
  'alexander first nation', 'saddle lake', 'kehewin', 'frog lake',
  // Treaty 8
  'bigstone cree', 'woodland cree', 'dene tha', 'little red river',
  'tallcree', 'mikisew', 'athabasca chipewyan', 'horse lake',
  // Metis settlements (qualified to avoid false positives)
  'metis settlement', 'paddle prairie', 'gift lake',
  'peavine metis', 'kikino metis', 'fishing lake metis',
];

const escapedNations = NATION_NAMES.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

export const INDIGENOUS_NAME_PATTERN = new RegExp(
  '\\b(?:' + [
    'indigenous',
    'first nations?',
    'm[eé]tis',
    'inuit',
    'aboriginal',
    'native friendship',
    'native counselling',
    'native counseling',
    'friendship cent(?:re|er)',
    ...escapedNations,
  ].join('|') + ')\\b',
  'i'
);

export const INDIGENOUS_QUERY_PATTERN = new RegExp(
  '\\b(?:' + escapedNations.join('|') + ')\\b',
  'i'
);

export function isIndigenousService(service: { name: string; category?: string | null }): boolean {
  if (service.category && service.category.toLowerCase().includes('indigenous')) {
    return true;
  }
  return INDIGENOUS_NAME_PATTERN.test(service.name);
}

const INDIGENOUS_TAG_VALUES = new Set(['indigenous', 'first nations', 'métis', 'metis', 'inuit']);

export function isIndigenousServiceWithTags(
  service: { name: string; category?: string | null; tags?: any }
): boolean {
  if (isIndigenousService(service)) return true;
  if (service.tags) {
    try {
      const tags = typeof service.tags === 'string' ? JSON.parse(service.tags) : service.tags;
      if (Array.isArray(tags)) {
        return tags.some(t => {
          const val = (typeof t === 'string' ? t : t?.name || t?.value || '').toLowerCase();
          return INDIGENOUS_TAG_VALUES.has(val);
        });
      }
    } catch {
      // Malformed tags — skip
    }
  }
  return false;
}

export function isIndigenousIntent(
  primaryIntent: string,
  secondaryIntent?: { intent: string; confidence: number },
): boolean {
  return (
    primaryIntent === 'indigenous_services' ||
    (secondaryIntent?.intent === 'indigenous_services' &&
      secondaryIntent.confidence >= 0.5)
  );
}
