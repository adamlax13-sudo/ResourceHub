/**
 * Database Cleanup Migration
 * Comprehensive cleanup of services table
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runCleanup() {
  const client = await pool.connect();

  try {
    console.log('========================================');
    console.log('DATABASE CLEANUP MIGRATION');
    console.log('========================================\n');

    await client.query('BEGIN');

    // ============================================
    // PHASE 1: Remove Exact Duplicates
    // ============================================
    console.log('PHASE 1: Removing exact duplicates...');

    // First, show what we'll delete
    const duplicates = await client.query(`
      SELECT name, COUNT(*) as count,
             array_agg(id ORDER BY is_active DESC) as ids,
             array_agg(is_active ORDER BY is_active DESC) as active_status
      FROM services
      WHERE name IN (SELECT name FROM services GROUP BY name HAVING COUNT(*) > 1)
      GROUP BY name
    `);
    console.log(`  Found ${duplicates.rows.length} duplicate name groups`);

    // First, get the service_ids of duplicates we'll delete
    const duplicatesToDelete = await client.query(`
      SELECT s1.service_id
      FROM services s1
      WHERE s1.is_active = false
      AND EXISTS (
        SELECT 1 FROM services s2
        WHERE s2.name = s1.name AND s2.is_active = true AND s2.id != s1.id
      )
    `);

    // Delete their service_history entries first
    if (duplicatesToDelete.rows.length > 0) {
      const serviceIds = duplicatesToDelete.rows.map(r => r.service_id);
      const deleteHistory = await client.query(`
        DELETE FROM service_history
        WHERE service_id = ANY($1)
      `, [serviceIds]);
      console.log(`  Removed ${deleteHistory.rowCount} service_history entries`);
    }

    // Now delete inactive duplicates where an active version exists
    const deleteResult = await client.query(`
      DELETE FROM services s1
      WHERE is_active = false
      AND EXISTS (
        SELECT 1 FROM services s2
        WHERE s2.name = s1.name AND s2.is_active = true AND s2.id != s1.id
      )
      RETURNING name
    `);
    console.log(`  ✓ Removed ${deleteResult.rowCount} inactive duplicates\n`);

    // ============================================
    // PHASE 3: Normalize Locations
    // ============================================
    console.log('PHASE 3: Normalizing locations...');

    // Calgary variants
    let result = await client.query(`
      UPDATE services SET location = 'Calgary'
      WHERE location IN ('Calgary, AB', 'Calgary, Alberta', 'Calgary AB')
    `);
    if (result.rowCount > 0) console.log(`  Calgary: ${result.rowCount} normalized`);

    // Edmonton variants
    result = await client.query(`
      UPDATE services SET location = 'Edmonton'
      WHERE location IN ('Edmonton, AB', 'Edmonton, Alberta', 'Edmonton AB')
    `);
    if (result.rowCount > 0) console.log(`  Edmonton: ${result.rowCount} normalized`);

    // Red Deer variants
    result = await client.query(`
      UPDATE services SET location = 'Red Deer'
      WHERE location IN ('Red Deer, AB', 'Red Deer AB')
    `);
    if (result.rowCount > 0) console.log(`  Red Deer: ${result.rowCount} normalized`);

    // Lethbridge variants
    result = await client.query(`
      UPDATE services SET location = 'Lethbridge'
      WHERE location IN ('Lethbridge, AB', 'Lethbridge AB')
    `);
    if (result.rowCount > 0) console.log(`  Lethbridge: ${result.rowCount} normalized`);

    // Province-wide variants
    result = await client.query(`
      UPDATE services SET location = 'Alberta'
      WHERE location IN ('Alberta-wide', 'Alberta province-wide', 'Provincewide', 'Province-wide', 'Alberta Wide')
    `);
    if (result.rowCount > 0) console.log(`  Alberta (province-wide): ${result.rowCount} normalized`);

    console.log('  ✓ Location normalization complete\n');

    // ============================================
    // PHASE 5: Fix Category Fragmentation
    // ============================================
    console.log('PHASE 5: Fixing category fragmentation...');

    // Get categories with location suffixes
    const fragmentedCategories = await client.query(`
      SELECT DISTINCT category FROM services
      WHERE category LIKE '% - Lethbridge'
         OR category LIKE '% - Red Deer'
         OR category LIKE '% - Medicine Hat'
         OR category LIKE '% - Fort McMurray'
         OR category LIKE '% - Grande Prairie'
         OR category LIKE '% - Grande Cache'
         OR category LIKE '% - Peace River'
         OR category LIKE '% - Slave Lake'
         OR category LIKE '% - High Prairie'
         OR category LIKE '% - Northern Alberta'
    `);

    for (const row of fragmentedCategories.rows) {
      const parts = row.category.split(' - ');
      if (parts.length === 2) {
        const baseCategory = parts[0];
        const locationSuffix = parts[1];

        const updateResult = await client.query(`
          UPDATE services
          SET category = $1, location = $2
          WHERE category = $3
        `, [baseCategory, locationSuffix, row.category]);

        if (updateResult.rowCount > 0) {
          console.log(`  "${row.category}" → "${baseCategory}" (location: ${locationSuffix}): ${updateResult.rowCount}`);
        }
      }
    }
    console.log('  ✓ Category fragmentation fixed\n');

    // ============================================
    // PHASE 6: Drop Unused Indexes
    // ============================================
    console.log('PHASE 6: Dropping unused indexes...');

    const indexesToDrop = [
      'idx_services_search_vector',
      'idx_services_tags',
      'idx_services_ranking',
      'idx_services_location_lower',
      'idx_services_phone_normalized',
      'ix_services_category'
    ];

    for (const indexName of indexesToDrop) {
      try {
        await client.query(`DROP INDEX IF EXISTS ${indexName}`);
        console.log(`  ✓ Dropped ${indexName}`);
      } catch (err) {
        console.log(`  ⚠ Could not drop ${indexName}: ${err.message}`);
      }
    }
    console.log('');

    await client.query('COMMIT');

    // ============================================
    // FINAL VERIFICATION
    // ============================================
    console.log('========================================');
    console.log('VERIFICATION');
    console.log('========================================\n');

    // Check for remaining duplicates
    const remainingDupes = await client.query(`
      SELECT name, COUNT(*) FROM services GROUP BY name HAVING COUNT(*) > 1
    `);
    console.log(`Remaining duplicate names: ${remainingDupes.rowCount}`);

    // Category count
    const categoryCount = await client.query(`
      SELECT COUNT(DISTINCT category) as count FROM services
    `);
    console.log(`Total categories: ${categoryCount.rows[0].count}`);

    // Service count
    const serviceCount = await client.query(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN is_active THEN 1 END) as active
      FROM services
    `);
    console.log(`Services: ${serviceCount.rows[0].total} total, ${serviceCount.rows[0].active} active`);

    // Location distribution (top 10)
    const locations = await client.query(`
      SELECT location, COUNT(*) as count
      FROM services
      GROUP BY location
      ORDER BY count DESC
      LIMIT 10
    `);
    console.log('\nTop 10 locations:');
    locations.rows.forEach(row => {
      console.log(`  ${row.location || '(empty)'}: ${row.count}`);
    });

    // Category distribution
    const categories = await client.query(`
      SELECT category, COUNT(*) as count
      FROM services
      GROUP BY category
      ORDER BY count DESC
    `);
    console.log(`\nCategory distribution (${categories.rowCount} total):`);
    categories.rows.forEach(row => {
      console.log(`  ${row.category}: ${row.count}`);
    });

    console.log('\n========================================');
    console.log('CLEANUP COMPLETE');
    console.log('========================================');
    console.log('Remember to increment CACHE_VERSION in server/search/index.ts');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolled back:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runCleanup().catch(console.error);
