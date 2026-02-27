#!/usr/bin/env node
/**
 * Fix service names v2: Additional generic names, AHS prefixes, formatting fixes, and duplicates.
 * Follows up on scripts/fix_service_names.cjs which already applied 38 name fixes and 4 deactivations.
 *
 * Run with: node scripts/fix_service_names_v2.cjs [--dry-run]
 */
const pg = require('pg');

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://db_resourcenavigator_user:sjZnkniL7937GHPmR3mNfACf2wTp4wz6@dpg-d5juaqffte5s738u3qng-a.oregon-postgres.render.com/db_resourcenavigator',
  ssl: { rejectUnauthorized: false }
});

const dryRun = process.argv.includes('--dry-run');

// ============================================================================
// 1. Non-AHS org prefix fixes
// ============================================================================
const nonAhsFixes = {
  // Youth HQ operates 49th Street Youth Shelter (per description)
  '49th-street-youth-shelter-4633-49-street-red-deer-ab-t4n-1t4':
    'Youth HQ - 49th Street Youth Shelter',

  // The Mustard Seed Central operates this shelter (per description + website theseed.ca)
  'housing-focused-shelter-program-9526-106-avenue-edmonton-ab-t5h-0n2':
    'The Mustard Seed - Housing-Focused Shelter Program',

  // Part of Edmonton Women's Shelter Limited (WIN House) per description
  'women-in-need-iii-edmonton-ab':
    'WIN House - Women In Need III',

  // Maskan Family Association provides emergency shelter (per description)
  'maskan-shelter-calgary-ab':
    'Maskan Family Association - Emergency Shelter',

  // Full official name is "Our House Addiction Recovery Centre" (per description)
  'our-house-edmonton-edmonton':
    'Our House Addiction Recovery Centre',

  // Hope Mission facility; also fixes "Center" → "Centre" and spacing
  'emergency-shelter-and-support-services-10302-107-street-nw-edmonton-ab-t5j-1k2':
    'Hope Mission - The Karis Centre Women\'s Shelter',

  // Operated by John Howard Society, NOT AHS (per description + website johnhowardgp.ca)
  'alberta-health-services-north-zone-provincial-family-violence-treatment-program-10116-102-avenue-grande-prairie-ab-t8v-1c2':
    'John Howard Society - Provincial Family Violence Treatment Program (Grande Prairie)',

  // Stepping Stones Crisis Society (per description); fixes spacing issue "Support- Cold"
  'women-s-shelter-and-support-cold-lake':
    'Stepping Stones Crisis Society - Women\'s Shelter (Cold Lake)',

  // Fresh Start Recovery operates this facility (per website freshstartrecovery.ca)
  'lethbridge-recovery-centre-lethbridge':
    'Fresh Start Recovery - Lethbridge Recovery Centre',
};

// ============================================================================
// 2. AHS services missing the AHS prefix
//    All confirmed via website_url pointing to albertahealthservices.ca
//    Using "AHS" abbreviation per naming convention
// ============================================================================
const ahsFixes = {
  // Generic program names — completely unidentifiable as AHS
  'addiction-helpline-alberta-wide':
    'AHS - Addiction Helpline',

  'mobile-response-team-1213-4-street-sw-calgary-ab-t2r-0x7':
    'AHS - Mobile Response Team',

  'enhanced-services-for-women-4733-49-street-red-deer-ab-t4n-1t6':
    'AHS - Enhanced Services for Women (Red Deer)',

  'nnadap-referral-alberta-wide':
    'AHS - NNADAP Referral',

  'virtual-opioid-dependency-program-alberta-wide-virtual':
    'AHS - Virtual Opioid Dependency Program',

  'streetworks-needle-exchange-multiple-locations-across-edmonton':
    'AHS - Streetworks Needle Exchange',

  'indigenous-hospital-support-services-edmonton-ab':
    'AHS - Indigenous Hospital Support Services',

  'indigenous-wellness-clinic-edmonton-ab':
    'AHS - Indigenous Wellness Clinic',

  'adult-residential-addiction-treatment-2-km-s-of-hwy-53-on-46-street-424069-range-road-255-ponoka-ab-t4j-1r8':
    'AHS - Adult Residential Addiction Treatment (Ponoka)',

  'concurrent-disorders-enhanced-service-2-km-s-of-hwy-53-on-46-street-424069-range-road-255-ponoka-ab-t4j-1r8':
    'AHS - Concurrent Disorders Enhanced Service (Ponoka)',

  'sexually-transmitted-infections-sti-clinic-11111-jasper-avenue-edmonton-ab-t5k-0l4':
    'AHS - STI Clinic Edmonton',

  'alberta-health-services-provincial-health-services-acute-care-addiction-recovery-program-1403-29-street-nw-calgary-ab-t2n-2t9':
    'AHS - Acute Care Addiction Recovery Program (ACARP)',

  'psychosocial-rehabilitation-virtual-connections-2-km-s-of-hwy-53-on-46-street-424069-range-road-255-ponoka-ab-t4j-1r8':
    'AHS - Psychosocial Rehabilitation (Virtual Connections)',

  'recovery-centre-medically-supported-detoxification-370-kipling-street-se-medicine-hat-ab-t1a-1y6':
    'AHS - Recovery Centre (Medically Supported Detox, Medicine Hat)',

  // "Addiction and Mental Health" department-prefixed services
  'addiction-and-mental-health-child-and-adolescent-mental-health-walk-in-service-9499-137-avenue-edmonton-ab-t5e-5r8':
    'AHS - Child and Adolescent Mental Health Walk-In Service',

  'addiction-and-mental-health-community-services-child-and-adolescent-11153-ellerslie-road-sw-edmonton-ab-t6w-0e9':
    'AHS - Addiction and Mental Health Community Services (Child and Adolescent)',

  'addiction-and-mental-health-crisis-and-stabilization-team-for-children-and-youth-cast-12803-116-avenue-nw-edmonton-ab-t5m-3c8':
    'AHS - Crisis and Stabilization Team for Children and Youth (CAST)',

  'addiction-and-mental-health-day-hospital-17480-fort-road-edmonton-ab-t5y-6a8':
    'AHS - Addiction and Mental Health Day Hospital',

  'addiction-and-mental-health-intake-services-child-and-adolescent-11642-142-street-nw-edmonton-ab-t5m-1v4':
    'AHS - Addiction and Mental Health Intake Services (Child and Adolescent)',

  'addiction-and-mental-health-mobile-addiction-services-adolescent-edmonton':
    'AHS - Mobile Addiction Services (Adolescent)',

  'addiction-and-mental-health-opioid-dependency-program-4805-48-avenue-red-deer-ab-t4n-3t2':
    'AHS - Opioid Dependency Program (Red Deer)',

  'addiction-and-mental-health-police-and-crisis-team-adult-666-5-street-sw-medicine-hat-ab-t1a-4h6':
    'AHS - Police and Crisis Team (Adult, Medicine Hat)',

  'child-and-adolescent-psychiatry-service-addiction-and-mental-health-1820-richmond-road-sw-calgary-ab-t2t-5c7':
    'AHS - Child and Adolescent Psychiatry Service',

  // Location-based AHS services
  'access-24-7-adult-intake-services-13211-fort-road-nw-edmonton-ab-t5a-1c3':
    'AHS - Access 24/7 (Adult Intake Services)',

  'access-24-7-edmonton-edmonton-13211-fort-rd-nw':
    'AHS - Access 24/7 Edmonton',

  'airdrie-mental-health-urgent-care-airdrie-604-main-st-s':
    'AHS - Airdrie Mental Health Urgent Care',

  'banff-mental-health-urgent-care-banff-305-lynx-st':
    'AHS - Banff Mental Health Urgent Care',

  'canmore-urgent-mental-health-canmore-1100-hospital-pl':
    'AHS - Canmore Urgent Mental Health',

  'cochrane-mental-health-urgent-care-cochrane-60-grand-blvd':
    'AHS - Cochrane Mental Health Urgent Care',

  'okotoks-mental-health-urgent-care-okotoks-11-cimarron-common':
    'AHS - Okotoks Mental Health Urgent Care',

  'edmonton-youth-addiction-services-edmonton':
    'AHS - Edmonton Youth Addiction Services',

  'edmonton-youth-recovery-program-17480-fort-road-edmonton-ab-t5y-6a8':
    'AHS - Edmonton Youth Recovery Program',

  'edmonton-youth-stabilization-program-17480-fort-road-edmonton-ab-t5y-6a8':
    'AHS - Edmonton Youth Stabilization Program',

  'crisis-response-team-7-hospital-street-fort-mcmurray-ab-t9h-1p2':
    'AHS - Crisis Response Team (Fort McMurray)',

  'crisis-response-team-11205-110-street-grande-prairie-ab-t8v-4b1':
    'AHS - Crisis Response Team (Grande Prairie)',

  'calgary-sexual-assault-response-team-csart-1213-4-street-sw-calgary-ab-t2r-0x7':
    'AHS - Calgary Sexual Assault Response Team (CSART)',

  'medicine-hat-opioid-dependency-program-medicine-hat-564-s-railway-st':
    'AHS - Medicine Hat Opioid Dependency Program',

  'rapid-access-addiction-medicine-raam-calgary-707-10-ave-sw':
    'AHS - Rapid Access Addiction Medicine (RAAM)',

  'youth-substance-use-mental-health-services-community-outpatient-clinic-1005-17-street-nw-calgary-ab-t2n-2e5':
    'AHS - Youth Substance Use & Mental Health Services (Community Outpatient Clinic)',

  'lethbridge-recovery-centre-detox-lethbridge':
    'AHS - Lethbridge Recovery Centre Detox',

  // Named AHS facilities — users don't know these are AHS
  'henwood-treatment-centre-edmonton-18750-18-st-nw':
    'AHS - Henwood Treatment Centre',

  'lander-treatment-centre-claresholm':
    'AHS - Lander Treatment Centre',

  'northern-addictions-centre-northern-alberta':
    'AHS - Northern Addictions Centre',

  'renfrew-recovery-centre-calgary-calgary-1611-remington-rd-ne':
    'AHS - Renfrew Recovery Centre',

  'alberta-health-services-north-zone-addiction-services-adult-residential-451-sakitawaw-trail-fort-mcmurray-ab-t9h-4p3':
    'AHS - Fort McMurray Recovery Centre',

  'alberta-health-services-south-zone-addiction-and-mental-health-youth-addiction-treatment-centre-402-6-avenue-n-lethbridge-ab-t1h-6j9':
    'AHS - Lethbridge Youth Addiction Treatment Centre',

  'medicine-hat-recovery-centre-medicine-hat':
    'AHS - Medicine Hat Recovery Centre',

  'alberta-health-services-calgary-zone-grief-support-program-1820-richmond-road-sw-calgary-ab-t2t-5c7':
    'AHS - Bob Glasgow Grief Support Centre',
};

// ============================================================================
// 3. Formatting fixes: en-dash (–) → regular dash (-)
// ============================================================================
const enDashFixes = {
  'alberta-health-services-edmonton-zone-addiction-and-mental-health-eating-disorder-program-8440-112-street-nw-edmonton-ab-t6g-2b7':
    'Alberta Health Services - Edmonton Zone - Addiction and Mental Health - Eating Disorder Program',

  'alberta-health-services-edmonton-zone-adult-feeding-swallowing-service-10230-111-avenue-nw-edmonton-ab-t5g-0b7':
    'Alberta Health Services - Edmonton Zone - Adult Feeding/Swallowing Service',

  'central-alberta-outreach-society-domestic-violence-support-4101-54-avenue-red-deer-ab-t4n-7g3':
    'Central Alberta Outreach Society - Domestic Violence Support',

  'central-alberta-outreach-society-julietta-s-place-4101-54-avenue-red-deer-ab-t4n-7g3':
    'Central Alberta Outreach Society - Julietta\'s Place',

  'centre-for-sexuality-sexual-health-gender-and-sexual-diversity-counselling-support-1509-centre-street-sw-calgary-ab-t2g-2e6':
    'Centre for Sexuality - Sexual Health, Gender and Sexual Diversity Counselling Support',

  'centre-for-sexuality-sexual-health-programs-for-parents-and-lgbtq-1509-centre-street-sw-calgary-ab-t2g-2e6':
    'Centre for Sexuality - Sexual Health Programs for Parents and LGBTQ+',

  'grande-prairie-john-howard-society-domestic-violence-treatment-services-community-village-10116-102-avenue-grande-prairie-ab-t8v-1a1':
    'Grande Prairie John Howard Society - Domestic Violence Treatment Services',

  'north-peace-society-for-the-prevention-of-domestic-violence-healthy-relationship-program-9615-100-street-peace-river-ab-t8s-1j7':
    'North Peace Society for the Prevention of Domestic Violence - Healthy Relationship Program',

  'police-and-crisis-team-alberta-health-services-ahs-north-zone-10202-99-street-grande-prairie-ab-t8v-2h4':
    'Police and Crisis Team - Alberta Health Services (AHS) - North Zone',

  'trellis-aura-938-15-avenue-sw-calgary-ab-t2r-0s3':
    'Trellis - Aura',

  'wood-buffalo-food-bank-association-food-hampers-10010-centennial-drive-fort-mcmurray-ab-t9h-4a2':
    'Wood Buffalo Food Bank Association - Food Hampers',

  'wood-buffalo-food-bank-association-mobile-pantry-program-10010-centennial-drive-fort-mcmurray-ab-t9h-4a2':
    'Wood Buffalo Food Bank Association - Mobile Pantry Program',

  'ywca-edmonton-individual-counselling-10402-124-street-nw-edmonton-ab-t5n-1r5':
    'YWCA Edmonton - Individual Counselling',
};

// ============================================================================
// 4. Formatting: "Center" → "Centre" (Canadian English)
// ============================================================================
const centreFixes = {
  'bonnyville-indian-metis-rehabilitation-center-bonnyville':
    'Bonnyville Indian Metis Rehabilitation Centre',

  'okisikow-iskwew-center-alberta':
    'Okisikow Iskwew Centre',
};

// ============================================================================
// 5. Additional generic names found in second pass
// ============================================================================
const additionalFixes = {
  // Medicine Hat Women's Shelter Society (mhwss.ca)
  'outreach-services-1036-7-street-sw-medicine-hat-ab-t1a-8v7':
    'Medicine Hat Women\'s Shelter Society - Outreach Services',

  // HIV Edmonton (hivedmonton.com)
  'support-and-outreach-9702-111-avenue-edmonton-ab-t5g-0b1':
    'HIV Edmonton - Support and Outreach',

  // The Salvation Army (salvationarmyedmonton.org)
  'transitional-housing-program-12520-140-avenue-nw-edmonton-ab-t5x-5z1':
    'The Salvation Army - Transitional Housing Program',

  // Boyle Street Community Services (boylestreet.org)
  'community-space-10740-99-street-nw-edmonton-ab-t5h-1n7':
    'Boyle Street Community Services - Community Space',

  // Al Rashid Mosque (alrashidmosque.ca)
  'extreme-weather-response-edmonton-ab':
    'Al Rashid Mosque - Extreme Weather Response',

  // Bridges Family Programs (bridgesfamilyprograms.com)
  'first-steps-477-3-street-se-medicine-hat-ab-t1a-0g8':
    'Bridges Family Programs - First Steps',

  // Métis Child and Family Services Society (metischild.com)
  'avenue-program-edmonton-ab':
    'Métis Child and Family Services - Avenue Program',

  // GEF Seniors Housing (gef.org)
  'subsidized-apartment-program-9743-77-avenue-edmonton-ab-t6e-1m2':
    'GEF Seniors Housing - Subsidized Apartment Program',

  // Sunrise House (sunrisehouse.ca)
  'youth-emergency-shelter-10702-110-street-grande-prairie-ab-t8v-6w7':
    'Sunrise House - Youth Emergency Shelter',

  // Our Collective Journey (ourcollectivejourney.ca)
  'recovery-coach-program-compass-building-2-600-2-street-se-medicine-hat-ab-t1a-0c9':
    'Our Collective Journey - Recovery Coach Program',

  // BIPOC Healing and Wellness Centre (bipochealingcentre.ca)
  'mental-wellness-unit-edmonton-ab':
    'BIPOC Healing and Wellness Centre - Mental Wellness Unit',

  // Centerpoint Facilitation (mycenterpoint.ca)
  'rural-housing-outreach-10113-103-avenue-grande-prairie-ab-t8v-6w7':
    'Centerpoint Facilitation - Rural Housing Outreach',

  // University of Alberta (ualberta.ca)
  'residence-safe-house-program-edmonton-ab':
    'University of Alberta - Residence Safe House Program',

  // CMHA Red Deer (cmhareddeer.ca)
  'mobile-mental-health-support-red-deer-ab':
    'CMHA Red Deer - Mobile Mental Health Support',

  // Taproot Community Support Services (taproot.ca)
  'spirit-of-our-youth-program-edmonton-ab':
    'Taproot - Spirit of Our Youth Program',
};

// ============================================================================
// 6. Duplicates to deactivate
// ============================================================================
const duplicatesToDeactivate = [
  // "City of Edmonton - Community Outreach Transit Team Program" is a duplicate of
  // "City of Edmonton - Community Outreach Transit Team" (community-outreach-transit-team-program-edmonton-ab)
  'city-of-edmonton-community-outreach-transit-team-program-edmonton-ab',
];


async function main() {
  const client = await pool.connect();

  try {
    console.log(dryRun ? '=== DRY RUN MODE ===' : '=== LIVE MODE ===');
    console.log('');

    const allFixes = {
      ...nonAhsFixes,
      ...ahsFixes,
      ...enDashFixes,
      ...centreFixes,
      ...additionalFixes,
    };

    // Apply name fixes
    console.log('--- NAME FIXES ---');
    let nameFixCount = 0;
    let skipCount = 0;
    for (const [serviceId, newName] of Object.entries(allFixes)) {
      const existing = await client.query(
        'SELECT name FROM services WHERE service_id = $1 AND is_active = true',
        [serviceId]
      );

      if (existing.rows.length === 0) {
        console.log(`  SKIP (not found/inactive): ${serviceId}`);
        skipCount++;
        continue;
      }

      const oldName = existing.rows[0].name;
      if (oldName === newName) {
        console.log(`  SKIP (already fixed): ${newName}`);
        skipCount++;
        continue;
      }

      console.log(`  FIX: "${oldName}"`);
      console.log(`    →  "${newName}"`);

      if (!dryRun) {
        await client.query(
          'UPDATE services SET name = $1, last_updated = NOW() WHERE service_id = $2',
          [newName, serviceId]
        );
      }
      nameFixCount++;
    }
    console.log(`\n  Total name fixes: ${nameFixCount} (skipped: ${skipCount})\n`);

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

    // Summary
    console.log('=== SUMMARY ===');
    console.log(`  Non-AHS org prefix fixes: ${Object.keys(nonAhsFixes).length}`);
    console.log(`  AHS prefix fixes: ${Object.keys(ahsFixes).length}`);
    console.log(`  En-dash formatting fixes: ${Object.keys(enDashFixes).length}`);
    console.log(`  Centre spelling fixes: ${Object.keys(centreFixes).length}`);
    console.log(`  Additional generic fixes: ${Object.keys(additionalFixes).length}`);
    console.log(`  Duplicates deactivated: ${duplicatesToDeactivate.length}`);
    console.log(`  Total planned changes: ${Object.keys(allFixes).length + duplicatesToDeactivate.length}`);

    console.log(dryRun
      ? '\nDry run complete. Re-run without --dry-run to apply changes.'
      : '\nAll changes applied successfully.'
    );

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
