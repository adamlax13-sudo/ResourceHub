/**
 * Translation Service Facade
 *
 * Manages on-demand translation of service data with DB caching.
 * French is pre-warmed; other languages are translated on first request.
 *
 * Fields translated: name, description, eligibility, waitTimes,
 * hoursOfOperation, address, processSteps, requiredDocs.
 * Fields NOT translated: phone, email, websiteUrl, category (uses locale files).
 */

import { createHash } from 'crypto';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db';
import { serviceTranslations } from '@shared/schema';
import { translateBatch } from './libretranslate';

export interface TranslatedFields {
  name?: string | null;
  description?: string | null;
  eligibility?: string | null;
  waitTimes?: string | null;
  hoursOfOperation?: string | null;
  address?: string | null;
  processSteps?: string[] | null;
  requiredDocs?: string[] | null;
}

interface SourceFields {
  name: string;
  description: string;
  eligibility: string;
  waitTimes: string;
  hoursOfOperation: string;
  address: string;
  processSteps: string[];
  requiredDocs: string[];
}

/** Compute a SHA-256 hash of the English source fields for cache invalidation */
export function computeSourceHash(fields: SourceFields): string {
  const content = [
    fields.name,
    fields.description,
    fields.eligibility,
    fields.waitTimes,
    fields.hoursOfOperation,
    fields.address,
    (fields.processSteps || []).join('||'),
    (fields.requiredDocs || []).join('||'),
  ].join('\n---\n');
  return createHash('sha256').update(content).digest('hex').slice(0, 64);
}

/**
 * Get cached translation or translate on-demand for a single service.
 * Returns null if language is 'en' or translation fails completely.
 */
export async function getOrTranslateService(
  serviceId: string,
  language: string,
  sourceFields: SourceFields,
): Promise<TranslatedFields | null> {
  if (language === 'en') return null;

  const currentHash = computeSourceHash(sourceFields);

  // Check cache
  const cached = await db.select()
    .from(serviceTranslations)
    .where(and(
      eq(serviceTranslations.serviceId, serviceId),
      eq(serviceTranslations.language, language),
    ))
    .limit(1);

  if (cached.length > 0 && cached[0].sourceHash === currentHash) {
    return {
      name: cached[0].name,
      description: cached[0].description,
      eligibility: cached[0].eligibility,
      waitTimes: cached[0].waitTimes,
      hoursOfOperation: cached[0].hoursOfOperation,
      address: cached[0].address,
      processSteps: cached[0].processSteps as string[] | null,
      requiredDocs: cached[0].requiredDocs as string[] | null,
    };
  }

  // Cache miss or stale — translate now
  try {
    const translated = await translateServiceFields(sourceFields, language);

    // Upsert into cache
    await db.insert(serviceTranslations)
      .values({
        serviceId,
        language,
        ...translated,
        sourceHash: currentHash,
      })
      .onConflictDoUpdate({
        target: [serviceTranslations.serviceId, serviceTranslations.language],
        set: {
          ...translated,
          sourceHash: currentHash,
          translatedAt: new Date(),
        },
      });

    return translated;
  } catch (err) {
    console.error(`[Translation] Failed to translate service ${serviceId} to ${language}:`, err);
    return null; // graceful degradation — show English
  }
}

/**
 * Batch-fetch cached translations for multiple services (used by search results).
 * Returns a map of serviceId → TranslatedFields. Missing entries = not cached.
 *
 * Note: Does NOT validate sourceHash — relies on cache invalidation in
 * service-storage.ts deleting stale rows when English content changes.
 * Only card-visible fields (name, description, waitTimes) are used from
 * the batch result in the search endpoint for performance.
 */
export async function getTranslationsBatch(
  serviceIds: string[],
  language: string,
): Promise<Map<string, TranslatedFields>> {
  if (language === 'en' || serviceIds.length === 0) return new Map();

  const rows = await db.select()
    .from(serviceTranslations)
    .where(and(
      inArray(serviceTranslations.serviceId, serviceIds),
      eq(serviceTranslations.language, language),
    ));

  const map = new Map<string, TranslatedFields>();
  for (const row of rows) {
    map.set(row.serviceId, {
      name: row.name,
      description: row.description,
      eligibility: row.eligibility,
      waitTimes: row.waitTimes,
      hoursOfOperation: row.hoursOfOperation,
      address: row.address,
      processSteps: row.processSteps as string[] | null,
      requiredDocs: row.requiredDocs as string[] | null,
    });
  }
  return map;
}

/**
 * Translate and cache a single service (used for on-demand translation of
 * search results that aren't cached yet).
 */
export async function translateAndCacheService(
  serviceId: string,
  language: string,
  sourceFields: SourceFields,
): Promise<TranslatedFields> {
  const translated = await translateServiceFields(sourceFields, language);
  const currentHash = computeSourceHash(sourceFields);

  await db.insert(serviceTranslations)
    .values({
      serviceId,
      language,
      ...translated,
      sourceHash: currentHash,
    })
    .onConflictDoUpdate({
      target: [serviceTranslations.serviceId, serviceTranslations.language],
      set: {
        ...translated,
        sourceHash: currentHash,
        translatedAt: new Date(),
      },
    });

  return translated;
}

/** Delete cached translations for a service (called when English content changes) */
export async function invalidateTranslations(serviceId: string): Promise<void> {
  await db.delete(serviceTranslations)
    .where(eq(serviceTranslations.serviceId, serviceId));
}

/** Get translation coverage stats per language */
export async function getTranslationStats(): Promise<{ language: string; count: number }[]> {
  const result = await db.execute<{ language: string; count: string }>(
    `SELECT language, COUNT(*)::text as count FROM service_translations GROUP BY language ORDER BY count DESC`
  );
  return (result.rows || []).map(r => ({ language: r.language, count: parseInt(r.count, 10) }));
}

// --- Internal helpers ---

async function translateServiceFields(
  source: SourceFields,
  targetLang: string,
): Promise<TranslatedFields> {
  // Batch all scalar fields in one call for efficiency
  const scalarFields = [
    source.name,
    source.description,
    source.eligibility,
    source.waitTimes,
    source.hoursOfOperation,
    source.address,
  ];

  const translatedScalars = await translateBatch(scalarFields, 'en', targetLang);

  // Translate array fields
  const translatedSteps = source.processSteps.length > 0
    ? await translateBatch(source.processSteps, 'en', targetLang)
    : [];

  const translatedDocs = source.requiredDocs.length > 0
    ? await translateBatch(source.requiredDocs, 'en', targetLang)
    : [];

  return {
    name: translatedScalars[0],
    description: translatedScalars[1],
    eligibility: translatedScalars[2],
    waitTimes: translatedScalars[3],
    hoursOfOperation: translatedScalars[4],
    address: translatedScalars[5],
    processSteps: translatedSteps,
    requiredDocs: translatedDocs,
  };
}
