/**
 * Category Consolidation Migration Script
 * Run with: node scraper/migrations/run_consolidation.js
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('Starting category consolidation migration...\n');

    // Start transaction
    await client.query('BEGIN');

    // Get current category counts for comparison
    const before = await client.query(`
      SELECT category, COUNT(*) as count
      FROM services
      GROUP BY category
      ORDER BY count DESC
    `);
    console.log(`Current state: ${before.rows.length} categories\n`);

    // === STEP 1: Consolidate duplicate categories ===
    console.log('Step 1: Consolidating duplicate categories...');

    // Harm Reduction
    let result = await client.query(`
      UPDATE services SET category = 'Harm Reduction'
      WHERE category = 'Harm Reduction Services'
    `);
    if (result.rowCount > 0) console.log(`  - Harm Reduction: ${result.rowCount} updated`);

    // LGBTQ2S+
    result = await client.query(`
      UPDATE services SET category = 'LGBTQ2S+ Services'
      WHERE category = 'LGBTQ2S+ Support Services'
    `);
    if (result.rowCount > 0) console.log(`  - LGBTQ2S+: ${result.rowCount} updated`);

    // Detox consolidation
    result = await client.query(`
      UPDATE services SET category = 'Detox & Withdrawal Management'
      WHERE category IN (
        'Detoxification Programs',
        'Detox & Medical Withdrawal Services',
        'Stabilization & Withdrawal Management'
      )
    `);
    if (result.rowCount > 0) console.log(`  - Detox: ${result.rowCount} updated`);

    // Residential Treatment consolidation
    result = await client.query(`
      UPDATE services SET category = 'Residential Treatment'
      WHERE category IN (
        'Licensed Residential Treatment - Calgary',
        'Residential Treatment Programs - Licensed Alberta',
        'Mens Residential Recovery',
        'Womens Residential Recovery',
        'Residential Addiction Treatment'
      )
    `);
    if (result.rowCount > 0) console.log(`  - Residential Treatment: ${result.rowCount} updated`);

    // === STEP 2: Mental Health consolidation ===
    console.log('\nStep 2: Consolidating Mental Health categories...');

    result = await client.query(`
      UPDATE services SET category = 'Mental Health & Counselling'
      WHERE category IN (
        'Calgary Mental Health & Addiction',
        'Mental Health & Addiction Services',
        'Specialized Mental Health Treatment',
        'Affordable Counselling Services',
        'Calgary Low-Cost/Sliding Scale Counselling'
      )
      AND category NOT LIKE '%Campus%'
      AND category NOT LIKE '%Crisis%'
      AND category NOT LIKE '%Eating%'
    `);
    if (result.rowCount > 0) console.log(`  - Mental Health & Counselling: ${result.rowCount} updated`);

    // Crisis Mental Health
    result = await client.query(`
      UPDATE services SET category = 'Crisis Mental Health'
      WHERE category IN (
        'Calgary Mental Health Urgent Care',
        'Mental Health & Crisis Services'
      )
    `);
    if (result.rowCount > 0) console.log(`  - Crisis Mental Health: ${result.rowCount} updated`);

    // === STEP 3: Fix misclassified services ===
    console.log('\nStep 3: Fixing misclassified services...');

    // FASD should be in Disability
    result = await client.query(`
      UPDATE services SET category = 'Disability & Autism Support'
      WHERE (
        name ILIKE '%FASD%'
        OR description ILIKE '%FASD%'
        OR description ILIKE '%Fetal Alcohol%'
      )
      AND category = 'Support for Family Members Affected by Addiction'
    `);
    if (result.rowCount > 0) console.log(`  - FASD → Disability: ${result.rowCount} updated`);

    // === STEP 4: Standardize category names ===
    console.log('\nStep 4: Standardizing category names...');

    // Crisis Lines
    result = await client.query(`
      UPDATE services SET category = 'Crisis Lines'
      WHERE category = '24/7 Crisis Lines'
    `);
    if (result.rowCount > 0) console.log(`  - Crisis Lines: ${result.rowCount} updated`);

    // Indigenous Services - strip location
    result = await client.query(`
      UPDATE services SET category = 'Indigenous Services'
      WHERE category LIKE '%Indigenous%Calgary%' OR category LIKE '%Indigenous%Edmonton%'
    `);
    if (result.rowCount > 0) console.log(`  - Indigenous Services: ${result.rowCount} updated`);

    // Campus Services standardization
    result = await client.query(`
      UPDATE services SET category = 'Campus & Student Services'
      WHERE category LIKE '%Campus%' OR category LIKE '%University%Mental Health%'
    `);
    if (result.rowCount > 0) console.log(`  - Campus & Student Services: ${result.rowCount} updated`);

    // Food Banks consolidation
    result = await client.query(`
      UPDATE services SET category = 'Food Banks & Meals'
      WHERE category LIKE '%Food%'
        AND category LIKE '%Calgary%' OR category LIKE '%Edmonton%' OR category LIKE '%Provincial%'
    `);
    if (result.rowCount > 0) console.log(`  - Food Banks: ${result.rowCount} updated`);

    // Commit transaction
    await client.query('COMMIT');

    // Get final category counts
    const after = await client.query(`
      SELECT category, COUNT(*) as count
      FROM services
      GROUP BY category
      ORDER BY count DESC
    `);

    console.log('\n========================================');
    console.log('MIGRATION COMPLETE');
    console.log('========================================');
    console.log(`Categories: ${before.rows.length} → ${after.rows.length}`);
    console.log('\nNew category distribution:');
    after.rows.forEach(row => {
      console.log(`  ${row.category}: ${row.count}`);
    });

    // Check for any remaining orphan categories
    const orphans = await client.query(`
      SELECT DISTINCT category FROM services
      WHERE category LIKE '% - Calgary'
         OR category LIKE '% - Edmonton'
         OR category LIKE '% - Provincial'
    `);
    if (orphans.rows.length > 0) {
      console.log('\n⚠️  Categories still with location suffix:');
      orphans.rows.forEach(row => console.log(`  - ${row.category}`));
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
