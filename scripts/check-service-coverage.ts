/**
 * Check service coverage for specific query types
 */
import 'dotenv/config';
import { db } from '../server/db';
import { services } from '@shared/schema';
import { ilike, eq, or, and } from 'drizzle-orm';

async function check() {
  // Check veteran services
  const veteranServices = await db.select({ name: services.name })
    .from(services)
    .where(and(
      eq(services.isActive, true),
      or(
        ilike(services.name, '%veteran%'),
        ilike(services.name, '%military%'),
        ilike(services.description, '%veteran%')
      )
    ))
    .limit(20);

  console.log('VETERAN SERVICES IN DATABASE:', veteranServices.length);
  veteranServices.forEach(s => console.log('  -', s.name));

  // Check services with 12-step/spiritual content
  const religiousServices = await db.select({ name: services.name })
    .from(services)
    .where(and(
      eq(services.isActive, true),
      or(
        ilike(services.name, '%12 step%'),
        ilike(services.name, '%twelve step%'),
        ilike(services.description, '%12-step%'),
        ilike(services.description, '%twelve step%'),
        ilike(services.description, '%higher power%')
      )
    ))
    .limit(15);

  console.log('\n12-STEP SERVICES IN DATABASE:', religiousServices.length);
  religiousServices.forEach(s => console.log('  -', s.name));

  // Check SMART Recovery or non-12-step options
  const nonTwelveStep = await db.select({ name: services.name })
    .from(services)
    .where(and(
      eq(services.isActive, true),
      or(
        ilike(services.name, '%SMART%'),
        ilike(services.description, '%SMART Recovery%'),
        ilike(services.description, '%evidence-based%'),
        ilike(services.description, '%secular%')
      )
    ))
    .limit(10);

  console.log('\nNON-12-STEP/EVIDENCE-BASED SERVICES:', nonTwelveStep.length);
  nonTwelveStep.forEach(s => console.log('  -', s.name));

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
