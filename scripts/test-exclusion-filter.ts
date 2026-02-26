/**
 * Test the exclusion filtering logic
 */
import 'dotenv/config';
import { Pool } from 'pg';

async function testExclusions() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('=== Direct Database Exclusion Filter Test ===');
    console.log();

    // Simulate what the search would return
    console.log('Query: addiction help not religious calgary');
    console.log();

    // Get addiction-related services in Calgary
    const allAddictionResult = await pool.query(`
      SELECT service_id, name, is_12_step, is_faith_based, category
      FROM services
      WHERE is_active = true
        AND (
          LOWER(name) LIKE '%addiction%'
          OR LOWER(name) LIKE '%recovery%'
          OR LOWER(name) LIKE '%alcohol%'
          OR LOWER(category) LIKE '%addiction%'
        )
        AND (LOWER(location) LIKE '%calgary%' OR LOWER(location) LIKE '%alberta%')
      ORDER BY name
      LIMIT 50
    `);

    console.log(`Total addiction services found: ${allAddictionResult.rows.length}`);
    console.log();

    // Count before filter
    const total = allAddictionResult.rows.length;
    const filtered = allAddictionResult.rows.filter(r => r.is_12_step !== true && r.is_faith_based !== true);

    console.log('--- After Exclusion Filter ---');
    console.log(`Before: ${total}, After: ${filtered.length}`);
    console.log();

    console.log('Remaining services (should see SMART Recovery, AHS, etc.):');
    filtered.slice(0, 15).forEach(r => {
      console.log(`  ${r.name.substring(0, 60)}`);
    });

    console.log();
    console.log('Filtered out (12-step or faith-based):');
    const removed = allAddictionResult.rows.filter(r => r.is_12_step === true || r.is_faith_based === true);
    removed.slice(0, 10).forEach(r => {
      console.log(`  ${r.name.substring(0, 50)} [12step:${r.is_12_step}, faith:${r.is_faith_based}]`);
    });

    // Check for SMART Recovery
    const hasSmartRecovery = filtered.some(r => /SMART/i.test(r.name));
    console.log();
    console.log(`SMART Recovery in results: ${hasSmartRecovery}`);

    // Check for any leaks
    const leaks = filtered.filter(r => r.is_12_step === true || r.is_faith_based === true);
    if (leaks.length > 0) {
      console.log('FAIL: LEAKS DETECTED');
      process.exit(1);
    } else {
      console.log('SUCCESS: Exclusion filter works correctly!');
    }
  } finally {
    await pool.end();
  }
}

testExclusions().catch(err => {
  console.error(err);
  process.exit(1);
});
