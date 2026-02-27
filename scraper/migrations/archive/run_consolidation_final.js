/**
 * Category Consolidation - Final Cleanup
 * Handle remaining single-service categories
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
    console.log('Starting final cleanup...\n');
    await client.query('BEGIN');

    // Merge stragglers into main categories
    const merges = [
      { from: "Calgary Low-Cost Counselling", to: "Mental Health & Counselling" },
      { from: "Calgary Mental Health Services", to: "Mental Health & Counselling" },
      { from: "mental health", to: "Mental Health & Counselling" },
      { from: "addiction support", to: "Addiction Treatment" },
      { from: "addiction counselling", to: "Addiction Treatment" },
      { from: "Virtual addiction support", to: "Addiction Treatment" },
      { from: "Women's Addiction Support", to: "Addiction Treatment" },
      { from: "Nicotine Addiction Support", to: "Addiction Treatment" },
      { from: "Licensed Residential Treatment- Calgary", to: "Residential Treatment" },
      { from: "Women's Residential Treatment Programs - Licensed Alberta", to: "Residential Treatment" },
      { from: "Residential Treatment Programs", to: "Residential Treatment" },
      { from: "Residential Treatment Programs - Blackfoot", to: "Residential Treatment" },
      { from: "Residential Treatment Programs - Drayton Valley", to: "Residential Treatment" },
      { from: "Residential Treatment Programs - Drumheller", to: "Residential Treatment" },
      { from: "Ally Resources", to: "LGBTQ2S+ Services" },
      { from: "social services", to: "Basic Needs & Material Aid" },
      { from: "Crisis Mental Health", to: "Crisis Services" },
    ];

    for (const merge of merges) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE category = $2`,
        [merge.to, merge.from]
      );
      if (result.rowCount > 0) {
        console.log(`"${merge.from}" → "${merge.to}": ${result.rowCount}`);
      }
    }

    await client.query('COMMIT');

    // Get final counts
    const after = await client.query(`
      SELECT category, COUNT(*) as count
      FROM services
      GROUP BY category
      ORDER BY count DESC
    `);

    console.log('\n========================================');
    console.log('FINAL MIGRATION COMPLETE');
    console.log(`========================================`);
    console.log(`Final category count: ${after.rows.length}\n`);
    console.log('Category distribution:');
    after.rows.forEach(row => {
      console.log(`  ${row.category}: ${row.count}`);
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
