/**
 * Populate is_faith_based and is_12_step columns for existing services.
 *
 * Scans service name, description, and category for known patterns.
 * Defaults to false when uncertain (better to under-classify than over-filter).
 */
import 'dotenv/config';
import { Pool } from 'pg';

interface Service {
  service_id: string;
  name: string;
  description: string | null;
  category: string | null;
}

// 12-step program indicators
const TWELVE_STEP_NAME_PATTERNS = [
  /\b(AA|NA|CA|GA)\b/,  // Acronyms as standalone words
  /alcoholics\s*anonymous/i,
  /narcotics\s*anonymous/i,
  /cocaine\s*anonymous/i,
  /gamblers\s*anonymous/i,
  /celebrate\s*recovery/i,
  /12[\s-]?step/i,
  /twelve[\s-]?step/i,
];

const TWELVE_STEP_DESCRIPTION_PATTERNS = [
  /higher\s*power/i,
  /\bstep\s*program/i,
  /anonymous\s*fellowship/i,
  /\bAA\s*meeting/i,
  /\bNA\s*meeting/i,
  /working\s*the\s*steps/i,
  /12[\s-]?step/i,
];

// Faith-based service indicators
const FAITH_BASED_NAME_PATTERNS = [
  /\bchurch\b/i,
  /\bministry\b/i,
  /\bmission\b/i,
  /\bchapel\b/i,
  /\bchristian\b/i,
  /\bcatholic\b/i,
  /\bbaptist\b/i,
  /\blutheran\b/i,
  /\bpresbyterian\b/i,
  /\bpentecostal\b/i,
  /\bmethodist\b/i,
  /\bevangelical\b/i,
  /salvation\s*army/i,
  /dream\s*centre/i,
  /dream\s*center/i,
  /faith[\s-]?based/i,
  /mustard\s*seed/i,  // Known faith-based org in Alberta
];

const FAITH_BASED_DESCRIPTION_PATTERNS = [
  /\bprayer\b/i,
  /\bprayer\s*group/i,
  /\bbible\s*study/i,
  /\bscripture\b/i,
  /\bworship\b/i,
  /\bpraise\b/i,
  /\bjesus\b/i,
  /\bchrist\b/i,
  /\bspiritual\s*healing\b/i,
  /\bfaith[\s-]?based/i,
  /\bchristian\s*(counsell?ing|program|support)/i,
  /\bchurch[\s-]?based/i,
];

// Exclusion patterns - don't classify as faith-based
const FALSE_POSITIVE_PATTERNS = [
  /thank\s*god/i,  // Common expression, not religious service
  /god\s*forbid/i,
  /for\s*god'?s\s*sake/i,
];

function is12Step(name: string, description: string): boolean {
  // Check name patterns
  for (const pattern of TWELVE_STEP_NAME_PATTERNS) {
    if (pattern.test(name)) {
      return true;
    }
  }

  // Check description patterns
  for (const pattern of TWELVE_STEP_DESCRIPTION_PATTERNS) {
    if (pattern.test(description)) {
      return true;
    }
  }

  return false;
}

function isFaithBased(name: string, description: string): boolean {
  const text = `${name} ${description}`;

  // Check for false positives first
  for (const pattern of FALSE_POSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      // Has idiom but check if also has strong faith indicators
      let hasStrongIndicator = false;
      for (const namePattern of FAITH_BASED_NAME_PATTERNS) {
        if (namePattern.test(name)) {
          hasStrongIndicator = true;
          break;
        }
      }
      if (!hasStrongIndicator) {
        return false;
      }
    }
  }

  // Check name patterns
  for (const pattern of FAITH_BASED_NAME_PATTERNS) {
    if (pattern.test(name)) {
      return true;
    }
  }

  // Check description patterns
  for (const pattern of FAITH_BASED_DESCRIPTION_PATTERNS) {
    if (pattern.test(description)) {
      return true;
    }
  }

  return false;
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Get all active services
    const { rows: services } = await pool.query<Service>(`
      SELECT service_id, name, description, category
      FROM services
      WHERE is_active = true
    `);

    console.log(`Processing ${services.length} services...\n`);

    const stats = {
      is12Step: 0,
      isFaithBased: 0,
      both: 0,
      neither: 0,
    };

    const classified: { serviceId: string; name: string; flags: string[] }[] = [];

    for (const service of services) {
      const name = service.name || '';
      const description = service.description || '';
      const category = service.category || '';
      const fullText = `${name} ${description} ${category}`;

      const flags: string[] = [];
      const is12StepFlag = is12Step(name, fullText);
      const isFaithBasedFlag = isFaithBased(name, fullText);

      if (is12StepFlag) flags.push('is_12_step');
      if (isFaithBasedFlag) flags.push('is_faith_based');

      // Update database
      await pool.query(
        'UPDATE services SET is_12_step = $1, is_faith_based = $2 WHERE service_id = $3',
        [is12StepFlag, isFaithBasedFlag, service.service_id]
      );

      // Track stats
      if (is12StepFlag && isFaithBasedFlag) {
        stats.both++;
      } else if (is12StepFlag) {
        stats.is12Step++;
      } else if (isFaithBasedFlag) {
        stats.isFaithBased++;
      } else {
        stats.neither++;
      }

      // Track classified services for review
      if (flags.length > 0) {
        classified.push({ serviceId: service.service_id, name: service.name, flags });
      }
    }

    console.log('=== Classification Results ===');
    console.log(`12-step only:      ${stats.is12Step}`);
    console.log(`Faith-based only:  ${stats.isFaithBased}`);
    console.log(`Both:              ${stats.both}`);
    console.log(`Neither:           ${stats.neither}`);
    console.log(`\nTotal:             ${services.length}`);

    console.log(`\n=== Classified Services (${classified.length}) ===`);
    console.log('Review these for accuracy:\n');

    // Group by flag type
    const twelveStepServices = classified.filter(s => s.flags.includes('is_12_step'));
    const faithBasedServices = classified.filter(s => s.flags.includes('is_faith_based'));

    if (twelveStepServices.length > 0) {
      console.log('--- 12-Step Programs ---');
      for (const svc of twelveStepServices.slice(0, 30)) {
        console.log(`  [${svc.flags.join(', ')}] ${svc.name.substring(0, 60)}`);
      }
      if (twelveStepServices.length > 30) {
        console.log(`  ... and ${twelveStepServices.length - 30} more`);
      }
    }

    if (faithBasedServices.length > 0) {
      console.log('\n--- Faith-Based Services ---');
      for (const svc of faithBasedServices.slice(0, 30)) {
        console.log(`  [${svc.flags.join(', ')}] ${svc.name.substring(0, 60)}`);
      }
      if (faithBasedServices.length > 30) {
        console.log(`  ... and ${faithBasedServices.length - 30} more`);
      }
    }

  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
