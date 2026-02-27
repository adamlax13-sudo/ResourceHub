/**
 * Fix Regional Services Migration
 * Recategorize services from generic "Regional Services" to proper service type + location
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
    console.log('Fixing Regional Services categorization...\n');
    await client.query('BEGIN');

    // Map each service to its proper category + location
    const recategorizations = [
      // Lethbridge
      { name: "Alpha House Lethbridge Shelter", category: "Emergency Shelter - Lethbridge" },
      { name: "CMHA Lethbridge", category: "Mental Health & Counselling - Lethbridge" },
      { name: "Fresh Start Recovery Lethbridge", category: "Addiction Treatment - Lethbridge" },
      { name: "Iikaisskini Indigenous Services", category: "Indigenous Services - Lethbridge" },
      { name: "Lethbridge Provincial Building", category: "Mental Health & Counselling - Lethbridge" },
      { name: "Lethbridge Recovery Centre", category: "Detox & Withdrawal - Lethbridge" },
      { name: "Lethbridge Train Station (Recovery Alberta)", category: "Mental Health & Counselling - Lethbridge" },
      { name: "Lethbridge Wellness Shelter - Stabilization Unit", category: "Emergency Shelter - Lethbridge" },

      // Red Deer
      { name: "CAPS (Central Alberta Pride Society)", category: "LGBTQ2S+ Services - Red Deer" },
      { name: "Central Alberta Womens Emergency Shelter", category: "Domestic Violence Support - Red Deer" },
      { name: "Red Deer Dream Centre", category: "Residential Treatment - Red Deer" },
      { name: "Red Deer Medically Supported Detox", category: "Detox & Withdrawal - Red Deer" },
      { name: "Red Deer Recovery Community by EHN Canada", category: "Residential Treatment - Red Deer" },
      { name: "Safe Harbour Society Red Deer", category: "Emergency Shelter - Red Deer" },

      // Medicine Hat
      { name: "Intensive Outreach & Diversion", category: "Harm Reduction - Medicine Hat" },
      { name: "Medicine Hat Child/Youth Services", category: "Youth Services - Medicine Hat" },
      { name: "Medicine Hat Opioid Dependency Program", category: "Harm Reduction - Medicine Hat" },
      { name: "Medicine Hat Provincial Building", category: "Mental Health & Counselling - Medicine Hat" },
      { name: "Medicine Hat Recovery Centre", category: "Detox & Withdrawal - Medicine Hat" },
      { name: "Medicine Hat Women's Shelter Society 24-Hour Help Line", category: "Domestic Violence Support - Medicine Hat" },

      // Grande Prairie
      { name: "Grande Prairie AHS Addiction & Mental Health", category: "Mental Health & Counselling - Grande Prairie" },
      { name: "Northern Addictions Centre", category: "Residential Treatment - Grande Prairie" },

      // Fort McMurray / Wood Buffalo
      { name: "Fort McMurray Recovery Centre", category: "Residential Treatment - Fort McMurray" },
      { name: "Wood Buffalo Wellness Society", category: "Residential Treatment - Fort McMurray" },

      // Other Northern/Regional locations
      { name: "Grande Cache Transition House", category: "Domestic Violence Support - Grande Cache" },
      { name: "Northern Haven Support Society", category: "Domestic Violence Support - Slave Lake" },
      { name: "Peace River Regional Womens Shelter", category: "Domestic Violence Support - Peace River" },

      // M.I.T.A.A. - Indigenous detox (keep regional for now, or mark as Indigenous)
      { name: "M.I.T.A.A. Detox Centre", category: "Indigenous Services - Northern Alberta" },

      // High Prairie - very generic description, keep as regional for now
      { name: "High Prairie services", category: "Regional Services - High Prairie" },
    ];

    let updated = 0;
    for (const item of recategorizations) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE name = $2 AND category = 'Regional Services'`,
        [item.category, item.name]
      );
      if (result.rowCount > 0) {
        console.log(`✓ ${item.name} → ${item.category}`);
        updated++;
      }
    }

    await client.query('COMMIT');

    // Verify remaining Regional Services
    const remaining = await client.query(`
      SELECT name, category FROM services WHERE category LIKE 'Regional%' ORDER BY category, name
    `);

    console.log('\n========================================');
    console.log('REGIONAL SERVICES FIX COMPLETE');
    console.log('========================================');
    console.log(`Updated: ${updated} services`);

    if (remaining.rows.length > 0) {
      console.log(`\nRemaining regional categories (${remaining.rows.length}):`);
      remaining.rows.forEach(row => {
        console.log(`  ${row.category}: ${row.name}`);
      });
    }

    // Show new category distribution
    const categories = await client.query(`
      SELECT category, COUNT(*) as count
      FROM services
      WHERE category LIKE '%Lethbridge%'
         OR category LIKE '%Red Deer%'
         OR category LIKE '%Medicine Hat%'
         OR category LIKE '%Grande%'
         OR category LIKE '%Fort McMurray%'
         OR category LIKE '%Peace River%'
         OR category LIKE '%Slave Lake%'
         OR category LIKE '%High Prairie%'
         OR category LIKE '%Northern Alberta%'
      GROUP BY category
      ORDER BY category
    `);

    console.log('\nNew regional category distribution:');
    categories.rows.forEach(row => {
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
