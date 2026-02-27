/**
 * Fix Remaining Category Issues and Duplicates
 * - Fix miscategorized detox services
 * - Remove remaining near-duplicates
 * - Fix category mismatches
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runFix() {
  const client = await pool.connect();

  try {
    console.log('========================================');
    console.log('FIX CATEGORIES AND DUPLICATES');
    console.log('========================================\n');

    await client.query('BEGIN');

    // ============================================
    // PHASE 1: Fix Miscategorized Detox Services
    // ============================================
    console.log('PHASE 1: Fixing miscategorized detox services...');

    const detoxFixes = [
      // Services with 'detox' in name that are in wrong category
      { name: 'Alpha House Detox', correctCategory: 'Detox & Withdrawal' },
      { name: 'Renfrew Recovery Centre (Adult Detox)', correctCategory: 'Detox & Withdrawal' },
      { name: 'Akokatssini Medical Detox (Brocket)', correctCategory: 'Detox & Withdrawal' },
      { name: 'George Spady Society Detox', correctCategory: 'Detox & Withdrawal' },
      { name: 'Akoka tssini Medical Detox Brocket', correctCategory: 'Detox & Withdrawal' },
      // Alpha House Society Calgary should be Emergency Shelter or Addiction Treatment
      { name: 'Alpha House Society Calgary', correctCategory: 'Emergency Shelter' },
      // Recovery Access Alberta - addiction services, not food
      { name: 'Recovery Access Alberta', correctCategory: 'Addiction Treatment' },
    ];

    for (const fix of detoxFixes) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE name = $2 RETURNING id`,
        [fix.correctCategory, fix.name]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ "${fix.name}" → ${fix.correctCategory}`);
      }
    }

    // ============================================
    // PHASE 2: Remove Near-Duplicates (similarity = 1.0)
    // ============================================
    console.log('\nPHASE 2: Removing near-duplicate services...');

    // These are pairs where names are essentially identical
    // Keep the one with more complete data or the active one
    const duplicatesToRemove = [
      // Keep "Edmonton Women's Shelter Limited (Win House)", remove variant
      { keepPattern: "Edmonton Women's Shelter Limited (Win House)", removePattern: "Edmonton Women's Shelter Limited (WIN house)" },
      // Keep standard name format
      { keepPattern: 'The Mustard Seed - Edmonton', removePattern: 'Mustard Seed - Edmonton, The' },
      { keepPattern: 'The Mustard Seed - Medicine Hat', removePattern: 'Mustard Seed - Medicine Hat' },
      // Keep with proper punctuation
      { keepPattern: 'Family and Community Support Services of Barons-Eureka-Warner - Counselling Services', removePattern: 'Family and Community Support Services of Barons-Eureka-Warner – Counselling Services' },
      { keepPattern: 'MacEwan University Health Centre - Rainbow Clinic', removePattern: 'MacEwan University Health Centre – The Rainbow Clinic' },
      // Keep shorter/cleaner name
      { keepPattern: 'Alcoholics Anonymous in Alberta', removePattern: 'Alcoholics Anonymous Alberta' },
      { keepPattern: 'Virtual Opioid Dependency Program', removePattern: 'Virtual Opioid Dependency Program (VODP)' },
      // Keep standard format (Organization - Program)
      { keepPattern: 'REACH Edmonton Council for Safe Communities - 24/7 Edmonton Crisis Diversion Team', removePattern: '24/7 Edmonton Crisis Diversion Team (REACH Edmonton Council for Safe Communities)' },
      { keepPattern: 'Elizabeth Fry Society of Northern Alberta - Resources and Referrals Centre', removePattern: 'Resources and Referrals Centre (Elizabeth Fry Society of Northern Alberta)' },
      { keepPattern: 'Edmonton Police Service - Police and Crisis Team', removePattern: 'Police and Crisis Team (Edmonton Police Service)' },
      { keepPattern: 'University of Alberta Students\' Union - Peer Support Centre', removePattern: 'Peer Support Centre (University of Alberta Students\' Union)' },
      { keepPattern: 'Old Strathcona Youth Society - Get Connected', removePattern: 'Old Strathcona Youth Society: Get Connected' },
      { keepPattern: 'Iskwew Healing Lodge - Poundmaker\'s Lodge Treatment Centres', removePattern: 'Poundmaker\'s Lodge Treatment Centres - Iskwew Healing Lodge' },
      { keepPattern: 'Alberta Health Services - North Zone - Walk-In Counselling Services', removePattern: 'Alberta Health Services - North Zone - Walk In Counselling Services' },
      { keepPattern: 'Central Alberta Womens Emergency Shelter (CAWES)', removePattern: 'Central Alberta Womens Emergency Shelter' },
      { keepPattern: 'Calgary Women\'s Emergency Shelter', removePattern: 'Calgary Womens Emergency Shelter' },
      { keepPattern: 'Edmonton Seniors Coordinating Council', removePattern: 'Edmonton Seniors Coordinating Council - Hello Seniors' },
      { keepPattern: 'Jewish Family Services', removePattern: 'Jewish Family Service' },
    ];

    for (const dup of duplicatesToRemove) {
      // First check if both exist
      const check = await client.query(
        `SELECT id, name FROM services WHERE name = $1 OR name = $2`,
        [dup.keepPattern, dup.removePattern]
      );

      if (check.rows.length === 2) {
        // Delete service_history first
        await client.query(
          `DELETE FROM service_history WHERE service_id IN (SELECT service_id FROM services WHERE name = $1)`,
          [dup.removePattern]
        );
        // Then delete the duplicate
        const result = await client.query(
          `DELETE FROM services WHERE name = $1 RETURNING name`,
          [dup.removePattern]
        );
        if (result.rowCount > 0) {
          console.log(`  ✓ Removed duplicate: "${dup.removePattern}"`);
        }
      }
    }

    // ============================================
    // PHASE 3: Fix Wood's Homes (same name, different categories)
    // ============================================
    console.log('\nPHASE 3: Fixing Wood\'s Homes duplicates...');

    // Check Wood's Homes entries
    const woodsHomes = await client.query(
      `SELECT id, name, category, description FROM services WHERE name = 'Wood''s Homes'`
    );
    console.log(`  Found ${woodsHomes.rows.length} Wood's Homes entries`);

    if (woodsHomes.rows.length > 1) {
      // Keep the Youth Services one (more specific), remove Emergency Shelter one
      await client.query(
        `DELETE FROM service_history WHERE service_id IN (SELECT service_id FROM services WHERE name = 'Wood''s Homes' AND category = 'Emergency Shelter')`
      );
      const result = await client.query(
        `DELETE FROM services WHERE name = 'Wood''s Homes' AND category = 'Emergency Shelter' RETURNING id`
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ Removed Wood's Homes from Emergency Shelter (kept Youth Services)`);
      }
    }

    // ============================================
    // PHASE 4: Fix AHS duplicate services
    // ============================================
    console.log('\nPHASE 4: Fixing AHS near-duplicates...');

    // AHS services that are essentially the same
    const ahsDuplicates = [
      {
        keep: 'Alberta Health Services - Central Zone - Addiction and Mental Health Children, Youth and Family Outpatient Groups',
        remove: 'Addiction and Mental Health Children, Youth and Family Outpatient Groups - Alberta Health Services - Central Zone'
      },
      {
        keep: 'Alberta Health Services - South Zone - Addiction and Mental Health - Community Mental Health Services, Child, Youth and Families',
        remove: 'Alberta Health Services - South Zone - Addiction and Mental Health - Community Addiction Services, Child, Youth and Families'
      },
      {
        keep: 'Alberta Health Services - Central Zone - Addiction and Mental Health Drop-in Counselling',
        remove: 'Alberta Health Services - Central Zone - Addiction and Mental Health - Addiction Counselling'
      },
    ];

    for (const dup of ahsDuplicates) {
      const check = await client.query(
        `SELECT id FROM services WHERE name = $1 OR name = $2`,
        [dup.keep, dup.remove]
      );
      if (check.rows.length === 2) {
        await client.query(
          `DELETE FROM service_history WHERE service_id IN (SELECT service_id FROM services WHERE name = $1)`,
          [dup.remove]
        );
        const result = await client.query(
          `DELETE FROM services WHERE name = $1 RETURNING id`,
          [dup.remove]
        );
        if (result.rowCount > 0) {
          console.log(`  ✓ Removed AHS duplicate`);
        }
      }
    }

    // ============================================
    // PHASE 5: Consolidate Alpha House services
    // ============================================
    console.log('\nPHASE 5: Consolidating Alpha House...');

    // Alpha House Calgary Detox and Alpha House Detox are likely duplicates
    const alphaDetox = await client.query(
      `SELECT id, name, category FROM services WHERE name ILIKE '%alpha house%detox%' ORDER BY name`
    );
    console.log(`  Found ${alphaDetox.rows.length} Alpha House Detox entries:`);
    alphaDetox.rows.forEach(r => console.log(`    - ${r.name} (${r.category})`));

    // Keep "Alpha House Calgary Detox" (more specific), remove "Alpha House Detox" if both exist
    const alphaCheck = await client.query(
      `SELECT id, name FROM services WHERE name IN ('Alpha House Calgary Detox', 'Alpha House Detox')`
    );
    if (alphaCheck.rows.length === 2) {
      await client.query(
        `DELETE FROM service_history WHERE service_id IN (SELECT service_id FROM services WHERE name = 'Alpha House Detox')`
      );
      await client.query(`DELETE FROM services WHERE name = 'Alpha House Detox'`);
      console.log(`  ✓ Removed "Alpha House Detox" (kept "Alpha House Calgary Detox")`);
    }

    await client.query('COMMIT');

    // ============================================
    // VERIFICATION
    // ============================================
    console.log('\n========================================');
    console.log('VERIFICATION');
    console.log('========================================\n');

    // Check remaining detox in wrong categories
    const wrongDetox = await client.query(`
      SELECT name, category FROM services
      WHERE name ILIKE '%detox%'
      AND category NOT LIKE '%Detox%'
      AND category NOT LIKE '%Residential%'
      AND category NOT LIKE '%Addiction%'
      AND category NOT LIKE '%Indigenous%'
    `);
    console.log(`Detox services in wrong categories: ${wrongDetox.rowCount}`);
    wrongDetox.rows.forEach(r => console.log(`  - ${r.name}: ${r.category}`));

    // Check remaining exact duplicates
    const exactDupes = await client.query(`
      SELECT name, COUNT(*) as count FROM services GROUP BY name HAVING COUNT(*) > 1
    `);
    console.log(`\nRemaining exact duplicate names: ${exactDupes.rowCount}`);
    exactDupes.rows.forEach(r => console.log(`  - ${r.name}: ${r.count}`));

    // Service count
    const count = await client.query(`SELECT COUNT(*) as total FROM services`);
    console.log(`\nTotal services: ${count.rows[0].total}`);

    // Category count
    const cats = await client.query(`SELECT COUNT(DISTINCT category) as count FROM services`);
    console.log(`Total categories: ${cats.rows[0].count}`);

    console.log('\n========================================');
    console.log('FIX COMPLETE');
    console.log('========================================');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Fix failed, rolled back:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runFix().catch(console.error);
