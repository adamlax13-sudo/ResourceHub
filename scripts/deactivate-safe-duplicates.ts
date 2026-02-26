/**
 * Deactivate only the confirmed safe duplicates
 */
import 'dotenv/config';
import { Pool } from 'pg';

const SAFE_DEACTIVATIONS = [
  { id: 'iikaisskini-indigenous-services-lethbridge-lethbridge', reason: 'City suffix duplicate', keep: 'Iikaisskini Indigenous Services' },
  { id: 'connecteen-calgary-calgary', reason: 'City suffix duplicate', keep: 'ConnecTeen' },
  { id: 'red-deer-meals-on-wheels-meal-delivery-7429-49-avenue-red-deer-ab-t4p-1n2', reason: 'Subset service', keep: 'Red Deer Meals on Wheels' },
  { id: 'alberta-adolescent-recovery-centre-youth-addiction-treatment-303-forge-road-se-calgary-ab-t2h-0s9', reason: 'AARC duplicate', keep: 'AARC Adolescent Recovery Centre' },
  { id: 'aarc-calgary', reason: 'AARC duplicate', keep: 'AARC Adolescent Recovery Centre' },
];

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Deactivating safe duplicate services...\n');
    let count = 0;

    for (const item of SAFE_DEACTIVATIONS) {
      // Check if exists and is active
      const check = await pool.query(
        'SELECT name, is_active FROM services WHERE service_id = $1',
        [item.id]
      );

      if (check.rows.length === 0) {
        console.log(`SKIP: ${item.id} - not found`);
        continue;
      }

      if (!check.rows[0].is_active) {
        console.log(`SKIP: ${check.rows[0].name} - already inactive`);
        continue;
      }

      // Deactivate
      await pool.query('UPDATE services SET is_active = false WHERE service_id = $1', [item.id]);

      // Log to deduplication_log
      await pool.query(`
        INSERT INTO deduplication_log (kept_service_id, removed_service_id, duplicate_type, match_value, reason)
        VALUES ($1, $2, 'manual_review', $3, $4)
      `, [item.keep, item.id, 'embedding_similarity', item.reason]);

      console.log(`DEACTIVATED: ${check.rows[0].name}`);
      console.log(`   Reason: ${item.reason}`);
      console.log(`   Keep: ${item.keep}\n`);
      count++;
    }

    console.log(`\n=== Done: ${count} services deactivated ===`);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
