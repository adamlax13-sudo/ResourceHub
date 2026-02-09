/**
 * PII (Personally Identifiable Information) scrubbing utilities
 * Strips potential PII from search queries before forwarding to the LLM API
 */

/**
 * Scrub PII from a search query
 * Removes phone numbers, addresses, postal codes, and email addresses
 */
export function scrubPii(query: string): string {
  let scrubbed = query;

  // Alberta phone numbers: (780) 123-4567, 780-123-4567, 780.123.4567, +1 780 123 4567, etc.
  scrubbed = scrubbed.replace(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE]');

  // Numeric street addresses: "123 Main Street", "4567 12 Ave NW"
  scrubbed = scrubbed.replace(/\b\d{1,5}\s+\d{0,4}\s*(?:street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|crescent|cres|place|pl|way|lane|ln|court|ct|terrace|trail|park)\b/gi, '[ADDRESS]');

  // Postal codes: T2P 1A1
  scrubbed = scrubbed.replace(/\b[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d\b/g, '[POSTAL]');

  // Email addresses
  scrubbed = scrubbed.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');

  return scrubbed;
}
