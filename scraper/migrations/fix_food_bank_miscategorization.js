/**
 * Fix Miscategorized Food Banks Services
 * 42 services incorrectly placed in Food Banks & Meals based on description analysis
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
    console.log('FIX FOOD BANK MISCATEGORIZATION');
    console.log('========================================\n');

    await client.query('BEGIN');

    // ============================================
    // Recategorize based on description analysis
    // ============================================

    // Indigenous Services - services with indigenous/first nation/aboriginal keywords
    let result = await client.query(`
      UPDATE services SET category = 'Indigenous Services'
      WHERE category = 'Food Banks & Meals'
      AND (
        description ILIKE '%indigenous%'
        OR description ILIKE '%first nation%'
        OR description ILIKE '%aboriginal%'
        OR description ILIKE '%native%'
        OR description ILIKE '%métis%'
        OR description ILIKE '%inuit%'
        OR name ILIKE '%indigenous%'
        OR name ILIKE '%first nation%'
      )
      AND description NOT ILIKE '%food%'
      AND description NOT ILIKE '%meal%'
      AND description NOT ILIKE '%groceries%'
      AND description NOT ILIKE '%hamper%'
      RETURNING name
    `);
    console.log(`Indigenous Services: ${result.rowCount} recategorized`);
    result.rows.forEach(r => console.log(`  - ${r.name}`));

    // Domestic Violence Support
    result = await client.query(`
      UPDATE services SET category = 'Domestic Violence Support'
      WHERE category = 'Food Banks & Meals'
      AND (
        description ILIKE '%domestic violence%'
        OR description ILIKE '%family violence%'
        OR description ILIKE '%abuse%'
        OR description ILIKE '%women''s shelter%'
        OR description ILIKE '%violence against women%'
        OR name ILIKE '%women%shelter%'
      )
      AND description NOT ILIKE '%food%'
      AND description NOT ILIKE '%meal%'
      RETURNING name
    `);
    console.log(`\nDomestic Violence Support: ${result.rowCount} recategorized`);
    result.rows.forEach(r => console.log(`  - ${r.name}`));

    // Emergency Shelter
    result = await client.query(`
      UPDATE services SET category = 'Emergency Shelter'
      WHERE category = 'Food Banks & Meals'
      AND (
        description ILIKE '%emergency shelter%'
        OR description ILIKE '%homeless%'
        OR description ILIKE '%overnight shelter%'
        OR description ILIKE '%temporary shelter%'
        OR description ILIKE '%emergency housing%'
        OR name ILIKE '%shelter%'
      )
      AND description NOT ILIKE '%food%'
      AND description NOT ILIKE '%meal%'
      AND description NOT ILIKE '%domestic%'
      AND description NOT ILIKE '%women%'
      RETURNING name
    `);
    console.log(`\nEmergency Shelter: ${result.rowCount} recategorized`);
    result.rows.forEach(r => console.log(`  - ${r.name}`));

    // Addiction Treatment
    result = await client.query(`
      UPDATE services SET category = 'Addiction Treatment'
      WHERE category = 'Food Banks & Meals'
      AND (
        description ILIKE '%addiction%'
        OR description ILIKE '%substance%'
        OR description ILIKE '%recovery%'
        OR description ILIKE '%sobriety%'
        OR description ILIKE '%alcohol%'
        OR description ILIKE '%drug%'
        OR name ILIKE '%recovery%'
        OR name ILIKE '%addiction%'
      )
      AND description NOT ILIKE '%food%'
      AND description NOT ILIKE '%meal%'
      AND description NOT ILIKE '%detox%'
      RETURNING name
    `);
    console.log(`\nAddiction Treatment: ${result.rowCount} recategorized`);
    result.rows.forEach(r => console.log(`  - ${r.name}`));

    // Mental Health & Counselling
    result = await client.query(`
      UPDATE services SET category = 'Mental Health & Counselling'
      WHERE category = 'Food Banks & Meals'
      AND (
        description ILIKE '%mental health%'
        OR description ILIKE '%counselling%'
        OR description ILIKE '%counseling%'
        OR description ILIKE '%therapy%'
        OR description ILIKE '%psychiatric%'
        OR description ILIKE '%psychologist%'
        OR description ILIKE '%anxiety%'
        OR description ILIKE '%depression%'
        OR name ILIKE '%counselling%'
        OR name ILIKE '%mental health%'
      )
      AND description NOT ILIKE '%food%'
      AND description NOT ILIKE '%meal%'
      RETURNING name
    `);
    console.log(`\nMental Health & Counselling: ${result.rowCount} recategorized`);
    result.rows.forEach(r => console.log(`  - ${r.name}`));

    // Harm Reduction
    result = await client.query(`
      UPDATE services SET category = 'Harm Reduction'
      WHERE category = 'Food Banks & Meals'
      AND (
        description ILIKE '%harm reduction%'
        OR description ILIKE '%needle%'
        OR description ILIKE '%safe consumption%'
        OR description ILIKE '%overdose prevention%'
        OR description ILIKE '%naloxone%'
        OR description ILIKE '%opioid%'
      )
      AND description NOT ILIKE '%food%'
      AND description NOT ILIKE '%meal%'
      RETURNING name
    `);
    console.log(`\nHarm Reduction: ${result.rowCount} recategorized`);
    result.rows.forEach(r => console.log(`  - ${r.name}`));

    // Recovery & Peer Support
    result = await client.query(`
      UPDATE services SET category = 'Recovery & Peer Support'
      WHERE category = 'Food Banks & Meals'
      AND (
        description ILIKE '%peer support%'
        OR description ILIKE '%support group%'
        OR description ILIKE '%12 step%'
        OR description ILIKE '%AA%'
        OR description ILIKE '%NA%'
        OR name ILIKE '%peer support%'
      )
      AND description NOT ILIKE '%food%'
      AND description NOT ILIKE '%meal%'
      RETURNING name
    `);
    console.log(`\nRecovery & Peer Support: ${result.rowCount} recategorized`);
    result.rows.forEach(r => console.log(`  - ${r.name}`));

    // Youth Services
    result = await client.query(`
      UPDATE services SET category = 'Youth Services'
      WHERE category = 'Food Banks & Meals'
      AND (
        description ILIKE '%youth%'
        OR description ILIKE '%teen%'
        OR description ILIKE '%adolescent%'
        OR description ILIKE '%young people%'
        OR name ILIKE '%youth%'
      )
      AND description NOT ILIKE '%food%'
      AND description NOT ILIKE '%meal%'
      AND description NOT ILIKE '%family%'
      RETURNING name
    `);
    console.log(`\nYouth Services: ${result.rowCount} recategorized`);
    result.rows.forEach(r => console.log(`  - ${r.name}`));

    // Family & Parenting Support
    result = await client.query(`
      UPDATE services SET category = 'Family & Parenting Support'
      WHERE category = 'Food Banks & Meals'
      AND (
        description ILIKE '%family support%'
        OR description ILIKE '%parenting%'
        OR description ILIKE '%child development%'
        OR description ILIKE '%family counselling%'
        OR name ILIKE '%family%'
      )
      AND description NOT ILIKE '%food%'
      AND description NOT ILIKE '%meal%'
      AND description NOT ILIKE '%violence%'
      RETURNING name
    `);
    console.log(`\nFamily & Parenting Support: ${result.rowCount} recategorized`);
    result.rows.forEach(r => console.log(`  - ${r.name}`));

    // Detox & Withdrawal
    result = await client.query(`
      UPDATE services SET category = 'Detox & Withdrawal'
      WHERE category = 'Food Banks & Meals'
      AND (
        description ILIKE '%detox%'
        OR description ILIKE '%withdrawal%'
        OR name ILIKE '%detox%'
      )
      AND description NOT ILIKE '%food%'
      AND description NOT ILIKE '%meal%'
      RETURNING name
    `);
    console.log(`\nDetox & Withdrawal: ${result.rowCount} recategorized`);
    result.rows.forEach(r => console.log(`  - ${r.name}`));

    await client.query('COMMIT');

    // ============================================
    // VERIFICATION
    // ============================================
    console.log('\n========================================');
    console.log('VERIFICATION');
    console.log('========================================\n');

    // Remaining Food Banks services
    const remaining = await client.query(`
      SELECT name, LEFT(description, 80) as description_preview
      FROM services
      WHERE category = 'Food Banks & Meals'
      ORDER BY name
    `);
    console.log(`Food Banks & Meals remaining: ${remaining.rowCount} services`);

    // Show any that might still be wrong
    const suspicious = await client.query(`
      SELECT name, LEFT(description, 100) as desc
      FROM services
      WHERE category = 'Food Banks & Meals'
      AND (
        description ILIKE '%addiction%'
        OR description ILIKE '%mental health%'
        OR description ILIKE '%shelter%'
        OR description ILIKE '%counselling%'
        OR description ILIKE '%indigenous%'
      )
    `);

    if (suspicious.rowCount > 0) {
      console.log(`\nPotentially still miscategorized (${suspicious.rowCount}):`);
      suspicious.rows.forEach(r => console.log(`  - ${r.name}: ${r.desc}`));
    } else {
      console.log('\nNo suspicious services remaining in Food Banks category.');
    }

    // Category distribution
    const categories = await client.query(`
      SELECT category, COUNT(*) as count
      FROM services
      GROUP BY category
      ORDER BY count DESC
    `);
    console.log(`\nCategory distribution (${categories.rowCount} categories):`);
    categories.rows.forEach(row => {
      console.log(`  ${row.category}: ${row.count}`);
    });

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
