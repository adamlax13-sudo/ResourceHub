/**
 * Fix Final Clear Mismatches
 * Services that are clearly in wrong categories based on primary service type
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
    console.log('Fixing final clear mismatches...\n');
    await client.query('BEGIN');

    const fixes = [
      // Indigenous service in Food Banks
      { name: 'Iikaisskini Indigenous Services Lethbridge', to: 'Indigenous Services - Lethbridge' },

      // Pride Centre - primarily LGBTQ+
      { name: 'Pride Centre of Edmonton', to: 'LGBTQ2S+ Services' },

      // Golden Circle - primarily senior services
      { name: 'Golden Circle Senior Resource Centre', to: 'Senior Services' },
    ];

    let fixed = 0;
    for (const fix of fixes) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE name = $2 RETURNING name`,
        [fix.to, fix.name]
      );
      if (result.rowCount > 0) {
        console.log(`✓ "${fix.name}" → ${fix.to}`);
        fixed++;
      }
    }

    await client.query('COMMIT');
    console.log(`\nFixed ${fixed} services`);

    // Final category count
    const cats = await client.query(`
      SELECT category, COUNT(*) as count FROM services GROUP BY category ORDER BY count DESC
    `);
    console.log(`\nFinal category count: ${cats.rowCount}`);
    console.log('\nTop 15 categories:');
    cats.rows.slice(0, 15).forEach(r => console.log(`  ${r.category}: ${r.count}`));

    // Check regional categories
    const regional = await client.query(`
      SELECT category, COUNT(*) as count FROM services
      WHERE category LIKE '% - %'
      GROUP BY category ORDER BY category
    `);
    console.log(`\nRegional categories (${regional.rowCount}):`);
    regional.rows.forEach(r => console.log(`  ${r.category}: ${r.count}`));

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
