/**
 * Flag services as 24/7 based on description/name patterns
 */
import 'dotenv/config';
import { db } from '../server/db';
import { services } from '@shared/schema';
import { eq, and, or, ilike, isNull } from 'drizzle-orm';

const PATTERNS_24_7 = [
  '%24/7%',
  '%24 hour%',
  '%24-hour%',
  '%around the clock%',
  '%24 hours a day%',
  '%available anytime%',
];

async function flag247Services(dryRun: boolean = true) {
  console.log('='.repeat(60));
  console.log('24/7 SERVICE FLAGGER');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Find services mentioning 24/7 in name or description
  const conditions = PATTERNS_24_7.map(p =>
    or(ilike(services.name, p), ilike(services.description, p))
  );

  const candidates = await db.select({
    serviceId: services.serviceId,
    name: services.name,
    is24_7: services.is24_7,
  })
  .from(services)
  .where(and(
    eq(services.isActive, true),
    or(...conditions),
    or(isNull(services.is24_7), eq(services.is24_7, false))
  ))
  .limit(100);

  console.log(`\nFound ${candidates.length} services to flag as 24/7:\n`);

  for (const svc of candidates) {
    console.log(`- ${svc.name}`);

    if (!dryRun) {
      await db.update(services)
        .set({ is24_7: true })
        .where(eq(services.serviceId, svc.serviceId));
    }
  }

  if (dryRun && candidates.length > 0) {
    console.log(`\nRun with --execute to flag ${candidates.length} services`);
  }

  process.exit(0);
}

const dryRun = !process.argv.includes('--execute');
flag247Services(dryRun).catch(console.error);
