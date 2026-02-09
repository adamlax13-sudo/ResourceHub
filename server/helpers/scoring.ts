/**
 * Data quality scoring and completeness checking utilities
 */

import type { Service } from "@shared/schema";

// Key fields that determine if a service has sufficient data for display
export const KEY_DATA_FIELDS = ['description', 'contact', 'websiteUrl', 'processSteps', 'requiredDocs'] as const;

/**
 * Count how many key fields are missing from a service
 */
export function countMissingFields(service: Service): number {
  let missing = 0;

  // Check description
  if (!service.description || service.description.trim() === '') missing++;

  // Check contact
  if (!service.contact || service.contact.trim() === '') missing++;

  // Check websiteUrl
  if (!service.websiteUrl || service.websiteUrl.trim() === '') missing++;

  // Check processSteps (JSONB array)
  const steps = service.processSteps as string[] | null;
  if (!steps || !Array.isArray(steps) || steps.length === 0) missing++;

  // Check requiredDocs (JSONB array)
  const docs = service.requiredDocs as string[] | null;
  if (!docs || !Array.isArray(docs) || docs.length === 0) missing++;

  return missing;
}

/**
 * Check if a service has minimum required data for display
 * Services missing 2+ key fields are filtered from search results
 */
export function hasMinimumData(service: Service): boolean {
  return countMissingFields(service) < 2;
}

/**
 * Calculate a comprehensive quality score based on data completeness and content quality
 * Higher score = more complete and higher quality information
 * Max score: ~200 points
 */
export function calculateQualityScore(service: Service): number {
  let quality = 0;

  // ===== DESCRIPTION (max 40 points) =====
  const desc = service.description?.trim() || '';
  if (desc) {
    quality += 15; // Has description
    // Bonus for longer, more detailed descriptions
    if (desc.length > 100) quality += 5;
    if (desc.length > 250) quality += 10;
    if (desc.length > 500) quality += 10;
  }

  // ===== CONTACT INFO (max 30 points) =====
  const contact = service.contact?.trim() || '';
  if (contact) {
    quality += 10; // Has contact info
    // Check for phone number pattern
    if (/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(contact) || /1[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(contact)) {
      quality += 10; // Has phone number
    }
    // Check for email
    if (/@/.test(contact)) {
      quality += 10; // Has email
    }
  }

  // ===== WEBSITE URL (max 15 points) =====
  if (service.websiteUrl?.trim()) {
    quality += 15;
  }

  // ===== HOURS OF OPERATION (max 15 points) =====
  if (service.hoursOfOperation?.trim()) {
    quality += 15;
  }

  // ===== ELIGIBILITY (max 20 points) =====
  const elig = service.eligibility?.trim() || '';
  if (elig) {
    quality += 10;
    if (elig.length > 50) quality += 5;
    if (elig.length > 150) quality += 5;
  }

  // ===== PROCESS STEPS (max 20 points) =====
  const steps = service.processSteps as string[] | null;
  if (steps && Array.isArray(steps) && steps.length > 0) {
    quality += 10;
    if (steps.length >= 2) quality += 5;
    if (steps.length >= 4) quality += 5;
  }

  // ===== REQUIRED DOCS (max 15 points) =====
  const docs = service.requiredDocs as string[] | null;
  if (docs && Array.isArray(docs) && docs.length > 0) {
    quality += 10;
    if (docs.length >= 2) quality += 5;
  }

  // ===== TAGS (max 20 points) =====
  const tags = service.tags as string[] | null;
  if (tags && Array.isArray(tags) && tags.length > 0) {
    quality += 5;
    if (tags.length >= 3) quality += 5;
    if (tags.length >= 6) quality += 5;
    if (tags.length >= 10) quality += 5;
  }

  // ===== LOCATION (max 10 points) =====
  if (service.location?.trim()) {
    quality += 10;
  }

  // ===== LANGUAGES (max 10 points) =====
  const langs = service.languagesSupported as string[] | null;
  if (langs && Array.isArray(langs) && langs.length > 0) {
    quality += 5;
    if (langs.length >= 2) quality += 5;
  }

  // ===== SERVICE FORMAT (max 5 points) =====
  if (service.serviceFormat?.trim()) {
    quality += 5;
  }

  return quality; // Max ~200 points
}
