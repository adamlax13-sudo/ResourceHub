/**
 * Batch translation — pre-warm French translations for all active services.
 * Can be triggered via admin endpoint or run as a standalone script.
 */

import { eq } from 'drizzle-orm';
import { db } from '../db';
import { services } from '@shared/schema';
import { getOrTranslateService, computeSourceHash } from './index';

interface BatchResult {
  total: number;
  translated: number;
  skipped: number;
  errors: number;
}

/**
 * Pre-translate all active services into the specified language.
 * Respects existing cache — only translates services that are missing or stale.
 */
export async function warmTranslations(
  language: string = 'fr',
  onProgress?: (done: number, total: number) => void,
): Promise<BatchResult> {
  const allServices = await db.select({
    serviceId: services.serviceId,
    name: services.name,
    description: services.description,
    eligibility: services.eligibility,
    waitTimes: services.waitTimes,
    hoursOfOperation: services.hoursOfOperation,
    address: services.address,
    processSteps: services.processSteps,
    requiredDocs: services.requiredDocs,
  })
    .from(services)
    .where(eq(services.isActive, true));

  const result: BatchResult = {
    total: allServices.length,
    translated: 0,
    skipped: 0,
    errors: 0,
  };

  for (let i = 0; i < allServices.length; i++) {
    const svc = allServices[i];

    const sourceFields = {
      name: svc.name || '',
      description: (svc.description as string) || '',
      eligibility: (svc.eligibility as string) || '',
      waitTimes: svc.waitTimes || '',
      hoursOfOperation: svc.hoursOfOperation || '',
      address: (svc.address as string) || '',
      processSteps: Array.isArray(svc.processSteps)
        ? (svc.processSteps as string[]).map(s => typeof s === 'string' ? s : JSON.stringify(s))
        : [],
      requiredDocs: Array.isArray(svc.requiredDocs)
        ? (svc.requiredDocs as string[]).map(s => typeof s === 'string' ? s : JSON.stringify(s))
        : [],
    };

    try {
      const translated = await getOrTranslateService(svc.serviceId, language, sourceFields);
      if (translated) {
        result.translated++;
      } else {
        result.skipped++;
      }
    } catch (err) {
      result.errors++;
      console.error(`[Batch] Error translating ${svc.serviceId}:`, err);
    }

    if (onProgress) {
      onProgress(i + 1, allServices.length);
    }
  }

  return result;
}
