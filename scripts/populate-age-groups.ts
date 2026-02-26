/**
 * Populate age_group column for existing services
 *
 * Analyzes eligibility, name, and description to determine age group.
 * Defaults to 'all_ages' when uncertain.
 * Logs services that defaulted for manual review.
 */
import 'dotenv/config';
import { Pool } from 'pg';

type AgeGroupValue = 'youth' | 'youth_and_adult' | 'adult' | 'senior' | 'all_ages';

interface Service {
  service_id: string;
  name: string;
  eligibility: string | null;
  description: string | null;
}

function mapAgeRangeToGroup(age_min: number | null, age_max: number | null): AgeGroupValue {
  // Check youth_and_adult first — meaningfully spans into adulthood
  if (age_min !== null && age_max !== null &&
      age_min < 22 && age_max > 25 && age_max <= 40) {
    return 'youth_and_adult';
  }

  // Youth — clearly youth-only, max is 25 or under
  if (age_max !== null && age_max <= 25 &&
      (age_min === null || age_min < 18)) {
    return 'youth';
  }

  // Senior — 55+ or 65+
  if (age_min !== null && age_min >= 55) {
    return 'senior';
  }

  // Adult — explicitly 18+ with no upper bound or high upper bound
  if (age_min !== null && age_min >= 18 &&
      (age_max === null || age_max > 40)) {
    return 'adult';
  }

  return 'all_ages';
}

function extractAgeRange(text: string): { min: number | null; max: number | null } {
  const lower = text.toLowerCase();

  // Patterns to extract age ranges
  const patterns = [
    // "ages 12-24", "age 18-30"
    /ages?\s*(\d+)\s*[-–to]+\s*(\d+)/i,
    // "12 to 24 years"
    /(\d+)\s*to\s*(\d+)\s*years?/i,
    // "under 25", "under 18"
    /under\s*(\d+)/i,
    // "18+", "65+"
    /(\d+)\s*\+/,
    // "youth (12-24)"
    /youth\s*\(?(\d+)?\s*[-–]?\s*(\d+)?\)?/i,
    // "seniors 55+"
    /seniors?\s*(\d+)\s*\+?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern.source.includes('under')) {
        return { min: null, max: parseInt(match[1]) };
      }
      if (pattern.source.includes('\\+')) {
        return { min: parseInt(match[1]), max: null };
      }
      if (pattern.source.includes('senior')) {
        return { min: parseInt(match[1]) || 55, max: null };
      }
      const min = match[1] ? parseInt(match[1]) : null;
      const max = match[2] ? parseInt(match[2]) : null;
      if (min !== null || max !== null) {
        return { min, max };
      }
    }
  }

  return { min: null, max: null };
}

function detectAgeGroupFromText(text: string): AgeGroupValue {
  const lower = text.toLowerCase();

  // First try to extract numeric age range
  const range = extractAgeRange(text);
  if (range.min !== null || range.max !== null) {
    return mapAgeRangeToGroup(range.min, range.max);
  }

  // Pattern-based detection

  // Youth indicators
  const youthPatterns = [
    /\b(youth|teen|teenager|adolescent|children|kids?|juvenile|minor)\s*(only|program|service|shelter)/i,
    /\bfor\s+(youth|teens?|children|kids)\b/i,
    /\b(under\s*18|under\s*25)\b/i,
    /\b(young\s+people|young\s+person)\b/i,
  ];

  // Adult indicators (explicit adult-only)
  const adultPatterns = [
    /\badults?\s*(only|program|service)/i,
    /\bfor\s+adults\b/i,
    /\b18\s*\+\s*(only|years)/i,
    /\bmust\s+be\s+18/i,
  ];

  // Senior indicators
  const seniorPatterns = [
    /\b(senior|elderly|older\s+adult)s?\s*(only|program|service|care)/i,
    /\bfor\s+(seniors?|elderly)/i,
    /\b(55|60|65)\s*\+/i,
    /\b(geriatric|aging)/i,
  ];

  // Young adult indicators (spans youth/adult)
  const youngAdultPatterns = [
    /\byoung\s+adult/i,
    /\b(16|17|18)\s*[-–to]+\s*(30|35|40)\b/i,
    /\btransitional\s+(age|housing)/i,
  ];

  // Check young adult first (spans boundary)
  for (const pattern of youngAdultPatterns) {
    if (pattern.test(lower)) {
      return 'youth_and_adult';
    }
  }

  // Check specific age groups
  for (const pattern of youthPatterns) {
    if (pattern.test(lower)) {
      return 'youth';
    }
  }

  for (const pattern of seniorPatterns) {
    if (pattern.test(lower)) {
      return 'senior';
    }
  }

  for (const pattern of adultPatterns) {
    if (pattern.test(lower)) {
      return 'adult';
    }
  }

  return 'all_ages';
}

function determineAgeGroup(service: Service): { ageGroup: AgeGroupValue; source: string } {
  // Priority 1: eligibility field
  if (service.eligibility) {
    const fromEligibility = detectAgeGroupFromText(service.eligibility);
    if (fromEligibility !== 'all_ages') {
      return { ageGroup: fromEligibility, source: 'eligibility' };
    }
  }

  // Priority 2: name
  const fromName = detectAgeGroupFromText(service.name);
  if (fromName !== 'all_ages') {
    return { ageGroup: fromName, source: 'name' };
  }

  // Priority 3: description
  if (service.description) {
    const fromDescription = detectAgeGroupFromText(service.description);
    if (fromDescription !== 'all_ages') {
      return { ageGroup: fromDescription, source: 'description' };
    }
  }

  return { ageGroup: 'all_ages', source: 'default' };
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Get all services
    const { rows: services } = await pool.query<Service>(`
      SELECT service_id, name, eligibility, description
      FROM services
      WHERE is_active = true
    `);

    console.log(`Processing ${services.length} services...\n`);

    const stats = {
      youth: 0,
      youth_and_adult: 0,
      adult: 0,
      senior: 0,
      all_ages: 0,
    };

    const defaultedServices: { serviceId: string; name: string }[] = [];

    for (const service of services) {
      const { ageGroup, source } = determineAgeGroup(service);

      await pool.query(
        'UPDATE services SET age_group = $1 WHERE service_id = $2',
        [ageGroup, service.service_id]
      );

      stats[ageGroup]++;

      if (source === 'default') {
        defaultedServices.push({ serviceId: service.service_id, name: service.name });
      }
    }

    console.log('=== Age Group Distribution ===');
    console.log(`youth:           ${stats.youth}`);
    console.log(`youth_and_adult: ${stats.youth_and_adult}`);
    console.log(`adult:           ${stats.adult}`);
    console.log(`senior:          ${stats.senior}`);
    console.log(`all_ages:        ${stats.all_ages}`);
    console.log(`\nTotal:           ${services.length}`);

    if (defaultedServices.length > 0) {
      console.log(`\n=== Services Defaulted to all_ages (${defaultedServices.length}) ===`);
      console.log('Review these manually to verify age group:\n');
      for (const svc of defaultedServices.slice(0, 50)) {
        console.log(`  - ${svc.serviceId}: ${svc.name}`);
      }
      if (defaultedServices.length > 50) {
        console.log(`  ... and ${defaultedServices.length - 50} more`);
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
