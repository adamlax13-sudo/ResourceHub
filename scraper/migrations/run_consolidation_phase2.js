/**
 * Category Consolidation Migration - Phase 2
 * Further cleanup of remaining duplicates
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
    console.log('Starting Phase 2 consolidation...\n');
    await client.query('BEGIN');

    // Food Banks consolidation
    let result = await client.query(`
      UPDATE services SET category = 'Food Banks & Meals'
      WHERE category ILIKE '%food bank%' OR category ILIKE '%meal program%'
    `);
    console.log(`Food Banks: ${result.rowCount} updated`);

    // Mental Health consolidation
    result = await client.query(`
      UPDATE services SET category = 'Mental Health & Counselling'
      WHERE category ILIKE '%mental health%counsell%' OR category ILIKE '%counselling services%'
    `);
    console.log(`Mental Health: ${result.rowCount} updated`);

    // Crisis consolidation
    result = await client.query(`
      UPDATE services SET category = 'Crisis Services'
      WHERE category ILIKE '%crisis intervention%' OR category ILIKE '%outreach%mobile crisis%'
    `);
    console.log(`Crisis Services: ${result.rowCount} updated`);

    // Emergency Shelter consolidation
    result = await client.query(`
      UPDATE services SET category = 'Emergency Shelter'
      WHERE category ILIKE '%emergency shelter%' OR category ILIKE '%homeless%'
    `);
    console.log(`Emergency Shelter: ${result.rowCount} updated`);

    // Domestic Violence consolidation
    result = await client.query(`
      UPDATE services SET category = 'Domestic Violence Support'
      WHERE category ILIKE '%domestic violence%' OR category ILIKE '%women%shelter%'
    `);
    console.log(`Domestic Violence: ${result.rowCount} updated`);

    // Addiction Treatment consolidation
    result = await client.query(`
      UPDATE services SET category = 'Addiction Treatment'
      WHERE category ILIKE '%addiction%treatment%' OR category ILIKE '%substance abuse%recovery%'
    `);
    console.log(`Addiction Treatment: ${result.rowCount} updated`);

    // Harm Reduction consolidation
    result = await client.query(`
      UPDATE services SET category = 'Harm Reduction'
      WHERE category ILIKE '%harm reduction%'
    `);
    console.log(`Harm Reduction: ${result.rowCount} updated`);

    // Detox consolidation
    result = await client.query(`
      UPDATE services SET category = 'Detox & Withdrawal'
      WHERE category ILIKE '%detox%'
    `);
    console.log(`Detox: ${result.rowCount} updated`);

    // Peer Support consolidation
    result = await client.query(`
      UPDATE services SET category = 'Recovery & Peer Support'
      WHERE category ILIKE '%peer support%' OR category ILIKE '%peer-based%'
    `);
    console.log(`Recovery & Peer Support: ${result.rowCount} updated`);

    // Youth Services consolidation
    result = await client.query(`
      UPDATE services SET category = 'Youth Services'
      WHERE category ILIKE '%youth%' AND (category ILIKE '%mental health%' OR category ILIKE '%addiction%' OR category ILIKE '%family%')
    `);
    console.log(`Youth Services: ${result.rowCount} updated`);

    // Senior Services consolidation
    result = await client.query(`
      UPDATE services SET category = 'Senior Services'
      WHERE category ILIKE '%senior%mental health%'
    `);
    console.log(`Senior Services: ${result.rowCount} updated`);

    // Disability Support consolidation
    result = await client.query(`
      UPDATE services SET category = 'Disability & Autism Support'
      WHERE category ILIKE '%disability%support%' OR category ILIKE '%disability services%'
    `);
    console.log(`Disability Support: ${result.rowCount} updated`);

    // Grief & Bereavement consolidation
    result = await client.query(`
      UPDATE services SET category = 'Grief & Bereavement'
      WHERE category ILIKE '%grief%' OR category ILIKE '%bereavement%'
    `);
    console.log(`Grief & Bereavement: ${result.rowCount} updated`);

    // LGBTQ+ consolidation
    result = await client.query(`
      UPDATE services SET category = 'LGBTQ2S+ Services'
      WHERE category ILIKE '%lgbtq%'
    `);
    console.log(`LGBTQ2S+ Services: ${result.rowCount} updated`);

    // Indigenous Services consolidation
    result = await client.query(`
      UPDATE services SET category = 'Indigenous Services'
      WHERE category ILIKE '%indigenous%'
    `);
    console.log(`Indigenous Services: ${result.rowCount} updated`);

    // Newcomer Services consolidation
    result = await client.query(`
      UPDATE services SET category = 'Newcomer & Settlement'
      WHERE category ILIKE '%newcomer%' OR category ILIKE '%immigrant%'
    `);
    console.log(`Newcomer & Settlement: ${result.rowCount} updated`);

    // Trauma/PTSD consolidation
    result = await client.query(`
      UPDATE services SET category = 'Trauma & PTSD Support'
      WHERE category ILIKE '%trauma%' OR category ILIKE '%PTSD%'
    `);
    console.log(`Trauma & PTSD: ${result.rowCount} updated`);

    // Employment consolidation
    result = await client.query(`
      UPDATE services SET category = 'Employment Services'
      WHERE category ILIKE '%employment%' OR category ILIKE '%job training%'
    `);
    console.log(`Employment Services: ${result.rowCount} updated`);

    // Legal Aid consolidation
    result = await client.query(`
      UPDATE services SET category = 'Legal Aid'
      WHERE category ILIKE '%legal aid%' OR category ILIKE '%legal support%'
    `);
    console.log(`Legal Aid: ${result.rowCount} updated`);

    // Family Counselling consolidation
    result = await client.query(`
      UPDATE services SET category = 'Family & Parenting Support'
      WHERE category ILIKE '%family counsell%' OR category ILIKE '%parenting%' OR category ILIKE '%baby%'
    `);
    console.log(`Family & Parenting: ${result.rowCount} updated`);

    // Transitional Housing consolidation
    result = await client.query(`
      UPDATE services SET category = 'Transitional Housing'
      WHERE category ILIKE '%transitional housing%'
    `);
    console.log(`Transitional Housing: ${result.rowCount} updated`);

    // Eating Disorders consolidation
    result = await client.query(`
      UPDATE services SET category = 'Eating Disorder Services'
      WHERE category ILIKE '%eating disorder%'
    `);
    console.log(`Eating Disorder Services: ${result.rowCount} updated`);

    // Gambling Support consolidation
    result = await client.query(`
      UPDATE services SET category = 'Gambling Support'
      WHERE category ILIKE '%gambling%'
    `);
    console.log(`Gambling Support: ${result.rowCount} updated`);

    // Basic Needs consolidation (clothing, material aid)
    result = await client.query(`
      UPDATE services SET category = 'Basic Needs & Material Aid'
      WHERE category ILIKE '%clothing%' OR category ILIKE '%basic needs%'
    `);
    console.log(`Basic Needs: ${result.rowCount} updated`);

    // Regional cleanup - consolidate location-based categories
    result = await client.query(`
      UPDATE services SET category = 'Regional Services'
      WHERE category ILIKE '%Lethbridge%'
         OR category ILIKE '%Grande Prairie%'
         OR category ILIKE '%Medicine Hat%'
         OR category ILIKE '%Red Deer%'
         OR category ILIKE '%Fort McMurray%'
         OR category ILIKE '%High Prairie%'
         OR category ILIKE '%Northern Alberta%'
         OR category ILIKE '%Central Alberta%'
    `);
    console.log(`Regional Services: ${result.rowCount} updated`);

    await client.query('COMMIT');

    // Get final counts
    const after = await client.query(`
      SELECT category, COUNT(*) as count
      FROM services
      GROUP BY category
      ORDER BY count DESC
    `);

    console.log('\n========================================');
    console.log('PHASE 2 MIGRATION COMPLETE');
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
