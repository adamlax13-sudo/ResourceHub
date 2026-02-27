#!/usr/bin/env node
/**
 * Fix service names that are generic and don't include the hosting organization.
 * Also deactivates duplicate entries and fixes other naming issues.
 *
 * Run with: node scripts/fix_service_names.cjs [--dry-run]
 */
const pg = require('pg');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://db_resourcenavigator_user:sjZnkniL7937GHPmR3mNfACf2wTp4wz6@dpg-d5juaqffte5s738u3qng-a.oregon-postgres.render.com/db_resourcenavigator',
  ssl: { rejectUnauthorized: false }
});

const dryRun = process.argv.includes('--dry-run');

// ============================================================================
// 1. Name fixes: Add organization prefix to generic service names
// ============================================================================
const nameFixesByServiceId = {
  // User-reported: "Domestic Abuse Programs" should be "Calgary Counselling - Domestic Abuse Programs"
  'domestic-abuse-programs-105-12-avenue-se-calgary-ab-t2g-1a1':
    'Calgary Counselling - Domestic Abuse Programs',

  // Generic program names missing hosting org
  'domestic-violence-support-outreach-program-1715-17-avenue-se-calgary-ab-t2g-5j1':
    'YW Calgary - Domestic Violence Support Outreach Program',

  'emergency-shelter-and-support-services-9908-106-avenue-nw-edmonton-ab-t5h-0n6':
    'Hope Mission - Emergency Shelter and Support Services',

  'family-counselling-1231-34-avenue-ne-calgary-ab-t2e-6n4':
    'Sunrise Healing Lodge Society - Family Counselling',

  'service-hub-10527-96-street-nw-edmonton-ab-t5h-2h6':
    'Bissell Centre - Service Hub',

  'outreach-housing-team-10527-96-street-nw-edmonton-ab-t5h-2h6':
    'Bissell Centre - Outreach Housing Team',

  'seniors-health-7007-14-street-sw-calgary-ab-t2v-1p9':
    'Rockyview General Hospital - Seniors Health Clinic',

  'second-stage-shelter-calgary-ab':
    'Heart Home Network - Second Stage Shelter',

  'adult-addiction-counselling-4733-49-street-red-deer-ab-t4n-1t6':
    'Alberta Health Services - Adult Addiction Counselling (Red Deer)',

  'psychosocial-oncology-red-deer-ab':
    'Central Alberta Cancer Centre - Psychosocial Oncology',

  'indigenous-women-s-program-edmonton-ab':
    'BIPOC Healing and Wellness Centre - Indigenous Women\'s Program',

  'men-s-healing-circle-225-525-28-street-se-calgary-ab-t2a-6w9':
    'Niitoiyis Family Support Society - Men\'s Healing Circle',

  'holding-our-anger-bundle-edmonton-ab':
    'Aboriginal Counseling Services Association - Holding Our Anger Bundle',

  'our-children-are-sacred-edmonton-ab':
    'Ben Calf Robe Society - Our Children Are Sacred',

  'the-loft-program-sunrise-house-10702-110-street-grande-prairie-ab-t8v-6w7':
    'Sunrise House - The Loft Program',

  'breakout-recovery-community-edmonton':
    'Hope Mission - Breakout Recovery Community',

  'wellspring-recovery-community-edmonton-ab':
    'Hope Mission - Wellspring Recovery Community',

  'fort-macleod-detox-fort-macleod':
    'Foothills Centre - Fort Macleod Detox',

  'nikihk-housing-first-11648-85-street-nw-edmonton-ab-t5b-3e5':
    'Bent Arrow Traditional Healing Society - Nikihk Housing First',

  'sakihitowin-recovery-home-program-fort-mcmurray':
    'Wood Buffalo Wellness Society - Sakihitowin Recovery Home Program',

  'shunda-creek-recovery-center-alberta':
    'Enviros - Shunda Creek Recovery Centre',

  'phoenix-safe-house-emergency-shelter-lethbridge':
    'Medicine Hat Women\'s Shelter Society - Phoenix Safe House (Lethbridge)',

  'unity-house-emergency-women-s-shelter-fort-mcmurray':
    'Waypoints - Unity House Emergency Women\'s Shelter',

  'family-programs-for-blackfalds-lacombe-ponoka-and-rimbey-5004-54-street-ponoka-ab-t4j-1n8':
    'BGC Wolf Creek - Family Programs (Blackfalds, Lacombe, Ponoka, Rimbey)',

  'addiction-and-mental-health-adult-and-youth-350-3-avenue-nw-mclennan-ab-t0h-2l0':
    'Sacred Heart Community Health Centre - Addiction and Mental Health',

  'bounceback-alberta-wide':
    'CMHA - BounceBack',

  'domestic-violence-hotline-calgary-calgary':
    'FearIsNotLove - Domestic Violence Hotline Calgary',

  // AHS services missing the AHS prefix
  'addiction-and-mental-health-provincial-mobile-addiction-outreach-red-deer-ab':
    'Alberta Health Services - Provincial Mobile Addiction Outreach (Red Deer)',

  'provincial-family-violence-treatment-program-red-deer-ab':
    'Alberta Health Services - Provincial Family Violence Treatment Program (Red Deer)',

  'community-geriatric-mental-health-service-1070-mcdougall-road-ne-calgary-ab-t2e-7z2':
    'Alberta Health Services - Community Geriatric Mental Health Service',

  'day-treatment-service-community-geriatric-mental-health-1070-mcdougall-road-ne-calgary-ab-t2e-7z2':
    'Alberta Health Services - Day Treatment Service (Community Geriatric Mental Health)',

  'addiction-and-mental-health-domestic-abuse-response-team-elk-point':
    'Alberta Health Services - Domestic Abuse Response Team (Elk Point)',

  // Other naming fixes
  'mustard-seed-womens-calgary-110-11-ave-se':
    'The Mustard Seed - Women\'s Emergency Shelter',

  'salvation-army-calgary-5115-17-ave-se':
    'The Salvation Army - Calgary Community Services',

  'salvation-army-east-calgary-100-5115-17-ave-se':
    'The Salvation Army - East Calgary (Forest Lawn)',

  'youth-substance-use-clinic-calgary-calgary-1005-17-st-nw':
    'Alberta Health Services - Youth Substance Use Clinic (Calgary)',

  'community-outreach-transit-team-program-edmonton-ab':
    'City of Edmonton - Community Outreach Transit Team',

  'legacy-counselling-centre-160-dickins-drive-fort-mcmurray-ab-t9k-1r4':
    'Family Christian Centre - Legacy Counselling',
};


// ============================================================================
// 2. Duplicates to deactivate (keep the better-named entry)
// ============================================================================
const duplicatesToDeactivate = [
  // "Domestic Violence and Abuse Emergency Shelter" is a duplicate of
  // "Rowan House Society - Domestic Violence and Abuse Emergency Shelter"
  'domestic-violence-and-abuse-emergency-shelter-high-river',

  // "Boyle Street Community Services Edmonton" is duplicate of "Boyle Street Community Services"
  'boyle-street-community-services-edmonton-edmonton',

  // "Our House (Edmonton) Limited" is duplicate of "Our House Edmonton"
  'our-house-edmonton-limited-edmonton-ab',

  // "WINS Community Hubs" is duplicate of "WINS Community Resource Hubs"
  'wins-community-hubs-calgary-dover-and-erin-woods',
];


async function main() {
  const client = await pool.connect();

  try {
    console.log(dryRun ? '=== DRY RUN MODE ===' : '=== LIVE MODE ===');
    console.log('');

    // Apply name fixes
    console.log('--- NAME FIXES ---');
    let nameFixCount = 0;
    for (const [serviceId, newName] of Object.entries(nameFixesByServiceId)) {
      const existing = await client.query(
        'SELECT name FROM services WHERE service_id = $1 AND is_active = true',
        [serviceId]
      );

      if (existing.rows.length === 0) {
        console.log(`  SKIP (not found/inactive): ${serviceId}`);
        continue;
      }

      const oldName = existing.rows[0].name;
      if (oldName === newName) {
        console.log(`  SKIP (already fixed): ${serviceId}`);
        continue;
      }

      console.log(`  FIX: "${oldName}" → "${newName}"`);

      if (!dryRun) {
        await client.query(
          'UPDATE services SET name = $1, last_updated = NOW() WHERE service_id = $2',
          [newName, serviceId]
        );
      }
      nameFixCount++;
    }
    console.log(`\n  Total name fixes: ${nameFixCount}\n`);

    // Deactivate duplicates
    console.log('--- DUPLICATE DEACTIVATION ---');
    let dedupeCount = 0;
    for (const serviceId of duplicatesToDeactivate) {
      const existing = await client.query(
        'SELECT name FROM services WHERE service_id = $1 AND is_active = true',
        [serviceId]
      );

      if (existing.rows.length === 0) {
        console.log(`  SKIP (not found/inactive): ${serviceId}`);
        continue;
      }

      console.log(`  DEACTIVATE: "${existing.rows[0].name}" (${serviceId})`);

      if (!dryRun) {
        await client.query(
          'UPDATE services SET is_active = false, last_updated = NOW() WHERE service_id = $1',
          [serviceId]
        );
      }
      dedupeCount++;
    }
    console.log(`\n  Total deactivated: ${dedupeCount}\n`);

    console.log(dryRun
      ? 'Dry run complete. Re-run without --dry-run to apply changes.'
      : 'All changes applied successfully.'
    );

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
