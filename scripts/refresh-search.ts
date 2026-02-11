/**
 * Refresh the search materialized view and clear search cache.
 *
 * Run this after marking services as inactive to remove them from search results.
 *
 * Usage: npx tsx scripts/refresh-search.ts
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function main() {
  console.log('Refreshing search view and clearing cache...\n');

  try {
    // 1. Refresh the materialized view (removes inactive services)
    console.log('1. Refreshing materialized view...');
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_service_search');
    console.log('   Done - inactive services removed from search view\n');

    // 2. Clear the search cache
    console.log('2. Clearing search cache...');
    const result = await pool.query('DELETE FROM searches');
    console.log(`   Done - cleared ${result.rowCount} cached search results\n`);

    // 3. Show current active service count
    const countResult = await pool.query('SELECT COUNT(*) FROM mv_service_search');
    console.log(`Active services in search view: ${countResult.rows[0].count}`);

    console.log('\nSearch refresh complete! Inactive services will no longer appear in results.');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
