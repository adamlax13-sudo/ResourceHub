/**
 * Fix Remaining Miscategorized Services
 * Handle edge cases from Food Banks and check other categories
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
    console.log('FIX REMAINING MISCATEGORIZED SERVICES');
    console.log('========================================\n');

    await client.query('BEGIN');

    // ============================================
    // PHASE 1: Fix remaining Food Banks edge cases
    // ============================================
    console.log('PHASE 1: Fixing remaining Food Banks edge cases...');

    const foodBankFixes = [
      // Lurana Shelter - DV shelter, not food bank
      { name: 'Lurana Shelter Edmonton', category: 'Domestic Violence Support' },
      // Urban Manor - Housing, not food bank
      { name: 'Urban Manor Housing Society', category: 'Transitional Housing' },
      // SAGE Safe House - Senior shelter
      { name: 'SAGE Seniors Safe House Edmonton', category: 'Senior Services' },
    ];

    for (const fix of foodBankFixes) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE name = $2 AND category = 'Food Banks & Meals' RETURNING name`,
        [fix.category, fix.name]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ "${fix.name}" → ${fix.category}`);
      }
    }

    // Keep these in Food Banks (they legitimately provide food services):
    // - 211 Alberta Food Resources (food helpline)
    // - Wellspring by Hope Mission (provides meals)
    // - Hope Mission Edmonton (provides meals)
    // - Salvation Army (provides food assistance)
    // - Wood Buffalo Food Bank Association (food bank)
    // - Wood Buffalo Food Bank Mobile Pantry (food program)

    // ============================================
    // PHASE 2: Check other categories for issues
    // ============================================
    console.log('\nPHASE 2: Checking other categories for miscategorization...');

    // Check Recovery & Peer Support for non-recovery services
    const recoveryCheck = await client.query(`
      SELECT id, name, LEFT(description, 100) as desc
      FROM services
      WHERE category = 'Recovery & Peer Support'
      AND description NOT ILIKE '%recovery%'
      AND description NOT ILIKE '%peer%'
      AND description NOT ILIKE '%support group%'
      AND description NOT ILIKE '%12 step%'
      AND description NOT ILIKE '%sobriety%'
    `);
    console.log(`\nRecovery & Peer Support - potentially wrong: ${recoveryCheck.rowCount}`);

    // Fix specific Recovery issues
    const recoveryFixes = [
      // WIN House is domestic violence shelter
      { name: 'WIN House Edmonton (3 locations)', category: 'Domestic Violence Support' },
      // Service Canada is government services
      { name: 'Service Canada Calgary', category: 'Basic Needs & Material Aid' },
      // YESS is youth services
      { name: 'Youth Empowerment and Support Services Edmonton (YESS)', category: 'Youth Services' },
      // Rise Calgary - check if it's actually recovery
    ];

    for (const fix of recoveryFixes) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE name = $2 RETURNING name`,
        [fix.category, fix.name]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ "${fix.name}" → ${fix.category}`);
      }
    }

    // ============================================
    // PHASE 3: Check Emergency Shelter for DV shelters
    // ============================================
    console.log('\nPHASE 3: Checking Emergency Shelter for DV services...');

    const shelterDvCheck = await client.query(`
      SELECT name FROM services
      WHERE category = 'Emergency Shelter'
      AND (
        description ILIKE '%domestic violence%'
        OR description ILIKE '%family violence%'
        OR description ILIKE '%women fleeing%'
        OR description ILIKE '%abuse%'
        OR name ILIKE '%women%shelter%'
      )
    `);
    console.log(`  Found ${shelterDvCheck.rowCount} potential DV services in Emergency Shelter`);

    // Move DV services from Emergency Shelter
    let result = await client.query(`
      UPDATE services SET category = 'Domestic Violence Support'
      WHERE category = 'Emergency Shelter'
      AND (
        description ILIKE '%domestic violence%'
        OR description ILIKE '%family violence%'
        OR (description ILIKE '%women fleeing%' AND description ILIKE '%abuse%')
      )
      RETURNING name
    `);
    result.rows.forEach(r => console.log(`  ✓ "${r.name}" → Domestic Violence Support`));

    // ============================================
    // PHASE 4: Check Addiction Treatment for detox services
    // ============================================
    console.log('\nPHASE 4: Checking Addiction Treatment for detox services...');

    result = await client.query(`
      UPDATE services SET category = 'Detox & Withdrawal'
      WHERE category = 'Addiction Treatment'
      AND (
        name ILIKE '%detox%'
        OR (description ILIKE '%detox%' AND description ILIKE '%withdrawal%')
      )
      AND name NOT LIKE '%Residential%'
      RETURNING name
    `);
    if (result.rowCount > 0) {
      console.log(`  Moved ${result.rowCount} detox services:`);
      result.rows.forEach(r => console.log(`    - ${r.name}`));
    }

    // ============================================
    // PHASE 5: Check Indigenous Services placement
    // ============================================
    console.log('\nPHASE 5: Checking for indigenous services in wrong categories...');

    // Move indigenous-specific services to Indigenous Services if they're in generic categories
    result = await client.query(`
      UPDATE services SET category = 'Indigenous Services'
      WHERE category IN ('Basic Needs & Material Aid', 'Mental Health & Counselling')
      AND (
        name ILIKE '%indigenous%'
        OR name ILIKE '%first nation%'
        OR name ILIKE '%aboriginal%'
        OR name ILIKE '%métis%'
        OR name ILIKE '%native%healing%'
      )
      RETURNING name, category
    `);
    if (result.rowCount > 0) {
      console.log(`  Moved ${result.rowCount} indigenous services`);
      result.rows.forEach(r => console.log(`    - ${r.name}`));
    }

    await client.query('COMMIT');

    // ============================================
    // VERIFICATION
    // ============================================
    console.log('\n========================================');
    console.log('VERIFICATION');
    console.log('========================================\n');

    // Category distribution
    const categories = await client.query(`
      SELECT category, COUNT(*) as count
      FROM services
      GROUP BY category
      ORDER BY count DESC
    `);
    console.log(`Final category count: ${categories.rowCount}\n`);
    console.log('Top 20 categories:');
    categories.rows.slice(0, 20).forEach(row => {
      console.log(`  ${row.category}: ${row.count}`);
    });

    // Check for any remaining issues
    const totalServices = await client.query(`SELECT COUNT(*) as total FROM services`);
    console.log(`\nTotal services: ${totalServices.rows[0].total}`);

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
