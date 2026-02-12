/**
 * Enrichment Helpers
 *
 * Utilities for checking field completeness and merging service data
 * with AI enrichment data. Follows the "Fill Gaps, Don't Replace" principle:
 * - Existing service data is NEVER overwritten by AI enrichment
 * - AI data only fills in empty/missing fields
 */

import type { Service, AiServiceEnrichment } from '@shared/schema';

/**
 * Status of each field - true means the field has data, false means empty/null
 */
export interface ServiceFieldStatus {
  description: boolean;
  processSteps: boolean;
  requiredDocs: boolean;
  eligibility: boolean;
  waitTimes: boolean;
  contact: boolean;
  location: boolean;
  category: boolean;
}

/**
 * Check if an array field has actual content
 */
function hasArrayContent(value: unknown): boolean {
  if (!value) return false;
  if (Array.isArray(value) && value.length > 0) return true;
  // Handle JSON string that might contain an array
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Check if a string field has actual content (not just whitespace)
 */
function hasStringContent(value: unknown): boolean {
  if (!value) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return false;
}

/**
 * Check which fields in a service have actual data
 */
export function checkFieldCompleteness(service: {
  description?: string | null;
  processSteps?: unknown;
  requiredDocs?: unknown;
  eligibility?: string | null;
  waitTimes?: string | null;
  contact?: string | null;
  phone?: string | null;
  location?: string | null;
  address?: string | null;
  category?: string | null;
}): ServiceFieldStatus {
  return {
    description: hasStringContent(service.description),
    processSteps: hasArrayContent(service.processSteps),
    requiredDocs: hasArrayContent(service.requiredDocs),
    eligibility: hasStringContent(service.eligibility),
    waitTimes: hasStringContent(service.waitTimes),
    contact: hasStringContent(service.contact) || hasStringContent(service.phone),
    location: hasStringContent(service.location) || hasStringContent(service.address),
    category: hasStringContent(service.category),
  };
}

/**
 * Check if all critical fields are complete (no enrichment needed)
 */
export function isServiceComplete(status: ServiceFieldStatus): boolean {
  return (
    status.description &&
    status.processSteps &&
    status.eligibility &&
    status.category
  );
}

/**
 * Get list of fields that need enrichment (are empty)
 */
export function getEmptyFields(status: ServiceFieldStatus): string[] {
  const empty: string[] = [];
  if (!status.description) empty.push('description');
  if (!status.processSteps) empty.push('processSteps');
  if (!status.requiredDocs) empty.push('requiredDocs');
  if (!status.eligibility) empty.push('eligibility');
  if (!status.waitTimes) empty.push('waitTimes');
  if (!status.contact) empty.push('contact');
  if (!status.location) empty.push('location');
  if (!status.category) empty.push('category');
  return empty;
}

/**
 * Merge service data with enrichment data, preserving existing service data.
 * Returns an object with the merged values for each field.
 *
 * Principle: Service data wins if it exists. AI only fills gaps.
 */
export function mergeServiceWithEnrichment(
  service: {
    description?: string | null;
    processSteps?: unknown;
    requiredDocs?: unknown;
    eligibility?: string | null;
    waitTimes?: string | null;
    contact?: string | null;
    location?: string | null;
    address?: string | null;
    category?: string | null;
  },
  enrichment: AiServiceEnrichment | null | undefined
): {
  description: string | null;
  processSteps: unknown;
  requiredDocs: unknown;
  eligibility: string | null;
  waitTimes: string | null;
  contact: string | null;
  location: string | null;
  category: string | null;
} {
  const status = checkFieldCompleteness(service);

  return {
    // Only use AI data for EMPTY fields
    description: status.description
      ? (service.description || null)
      : (enrichment?.aiDescription || service.description || null),

    processSteps: status.processSteps
      ? service.processSteps
      : (enrichment?.aiProcessSteps || service.processSteps || null),

    requiredDocs: status.requiredDocs
      ? service.requiredDocs
      : (enrichment?.aiRequiredDocs || service.requiredDocs || null),

    eligibility: status.eligibility
      ? (service.eligibility || null)
      : (enrichment?.aiEligibility || service.eligibility || null),

    waitTimes: status.waitTimes
      ? (service.waitTimes || null)
      : (enrichment?.aiWaitTimes || service.waitTimes || null),

    contact: status.contact
      ? (service.contact || null)
      : (enrichment?.aiContact || service.contact || null),

    location: status.location
      ? (service.location || service.address || null)
      : (enrichment?.aiLocation || service.location || service.address || null),

    category: status.category
      ? (service.category || null)
      : (enrichment?.aiCategory || service.category || null),
  };
}

/**
 * For search results (lite view) - merge a search result with enrichment
 * Returns only the fields needed for the card display
 */
export function mergeForLiteView(
  searchResult: {
    serviceId: string;
    name: string;
    category: string;
    description: string | null;
    location: string | null;
    address?: string | null;
    waitTimes: string | null;
  },
  enrichment: {
    aiCategory?: string | null;
    aiDescription?: string | null;
    aiLocation?: string | null;
    aiWaitTimes?: string | null;
  } | null | undefined
): {
  category: string;
  description: string;
  location: string;
  waitTimes: string;
} {
  // Check if existing fields have content
  const hasCategory = hasStringContent(searchResult.category);
  const hasDescription = hasStringContent(searchResult.description);
  const hasLocation = hasStringContent(searchResult.location) || hasStringContent(searchResult.address);
  const hasWaitTimes = hasStringContent(searchResult.waitTimes);

  return {
    // Service data wins, AI fills gaps
    category: hasCategory
      ? searchResult.category
      : (enrichment?.aiCategory || searchResult.category || ''),

    description: hasDescription
      ? (searchResult.description || '')
      : (enrichment?.aiDescription || searchResult.description || ''),

    location: hasLocation
      ? (searchResult.address || searchResult.location || '')
      : (enrichment?.aiLocation || searchResult.location || ''),

    waitTimes: hasWaitTimes
      ? (searchResult.waitTimes || '')
      : (enrichment?.aiWaitTimes || searchResult.waitTimes || ''),
  };
}

/**
 * Build a database update object with only the fields that need to be filled
 * from enrichment data. Returns null if no updates needed.
 */
export function buildEnrichmentUpdate(
  service: Service,
  enrichment: AiServiceEnrichment
): Partial<Service> | null {
  const status = checkFieldCompleteness(service);
  const updates: Partial<Service> = {};

  // Only include fields that are empty in service but have data in enrichment
  if (!status.description && hasStringContent(enrichment.aiDescription)) {
    updates.description = enrichment.aiDescription;
  }

  if (!status.processSteps && hasArrayContent(enrichment.aiProcessSteps)) {
    updates.processSteps = enrichment.aiProcessSteps;
  }

  if (!status.requiredDocs && hasArrayContent(enrichment.aiRequiredDocs)) {
    updates.requiredDocs = enrichment.aiRequiredDocs;
  }

  if (!status.eligibility && hasStringContent(enrichment.aiEligibility)) {
    updates.eligibility = enrichment.aiEligibility;
  }

  if (!status.waitTimes && hasStringContent(enrichment.aiWaitTimes)) {
    updates.waitTimes = enrichment.aiWaitTimes;
  }

  if (!status.category && hasStringContent(enrichment.aiCategory) && enrichment.aiCategory) {
    updates.category = enrichment.aiCategory;
  }

  // Only update contact if both contact AND phone are empty
  if (!status.contact && hasStringContent(enrichment.aiContact)) {
    updates.contact = enrichment.aiContact;
  }

  // Location is trickier - only update if both location and address are empty
  if (!status.location && hasStringContent(enrichment.aiLocation)) {
    updates.location = enrichment.aiLocation;
  }

  // Return null if no updates needed
  return Object.keys(updates).length > 0 ? updates : null;
}
