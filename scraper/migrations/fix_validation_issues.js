/**
 * Fix Remaining Validation Issues
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
    console.log('Fixing remaining validation issues...\n');
    await client.query('BEGIN');

    // Fix Medicine Hat Women's Shelter - should be DV
    let result = await client.query(
      `UPDATE services SET category = 'Domestic Violence Support' WHERE name = $1 RETURNING name`,
      ["Medicine Hat Women's Shelter Society"]
    );
    if (result.rowCount > 0) console.log("✓ Medicine Hat Women's Shelter Society → Domestic Violence Support");

    // Youth Emergency Shelter - should be Youth Services
    result = await client.query(
      `UPDATE services SET category = 'Youth Services' WHERE name = 'Youth Emergency Shelter' RETURNING name`
    );
    if (result.rowCount > 0) console.log('✓ Youth Emergency Shelter → Youth Services');

    // AHS Calgary Shelters - move to Emergency Shelter
    result = await client.query(
      `UPDATE services SET category = 'Emergency Shelter' WHERE name = 'Alberta Health Services - Calgary Zone - Addiction Services - Shelters' RETURNING name`
    );
    if (result.rowCount > 0) console.log('✓ AHS Calgary Zone Addiction Shelters → Emergency Shelter');

    // Family Violence Helpline - should be DV - Red Deer
    result = await client.query(
      `UPDATE services SET category = 'Domestic Violence Support - Red Deer' WHERE name LIKE '%Family Violence Helpline%Central Alberta%' RETURNING name`
    );
    if (result.rowCount > 0) console.log('✓ Family Violence Helpline → Domestic Violence Support - Red Deer');

    await client.query('COMMIT');

    // Final counts
    const cats = await client.query(`
      SELECT category, COUNT(*) as count FROM services GROUP BY category ORDER BY count DESC
    `);
    console.log('\nFinal category count:', cats.rowCount);
    console.log('\nTop 20 categories:');
    cats.rows.slice(0, 20).forEach(r => console.log(`  ${r.category}: ${r.count}`));

    // Total services
    const total = await client.query(`SELECT COUNT(*) as total FROM services`);
    console.log(`\nTotal services: ${total.rows[0].total}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Fix failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runFix().catch(console.error);
