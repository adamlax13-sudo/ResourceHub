/**
 * Comprehensive Category Fix Migration
 * Based on thorough audit of all 62 categories
 * Fixes mismatched services identified by name/description analysis
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
    console.log('COMPREHENSIVE CATEGORY FIX');
    console.log('========================================\n');

    await client.query('BEGIN');

    let totalFixed = 0;

    // ============================================
    // PHASE 1: Food Banks - Remove non-food services
    // ============================================
    console.log('PHASE 1: Food Banks & Meals fixes...');

    const foodBankFixes = [
      { name: 'Find a Doctor Alberta', to: 'Mental Health & Counselling' },
    ];

    for (const fix of foodBankFixes) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE name = $2 RETURNING name`,
        [fix.to, fix.name]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ "${fix.name}" → ${fix.to}`);
        totalFixed++;
      }
    }

    // ============================================
    // PHASE 2: Mental Health - Fix misplaced services
    // ============================================
    console.log('\nPHASE 2: Mental Health & Counselling fixes...');

    const mhFixes = [
      { name: 'Calgary Dream Centre', to: 'Residential Treatment' },
      { name: 'Radiance Family Society - Centre Safe Housing', to: 'Transitional Housing' },
      { name: 'Rapid Access Addiction Medicine (RAAM)', to: 'Addiction Treatment' },
      { name: 'Stepping Stones Youth Shelter- Woods Homes', to: 'Youth Services' },
    ];

    for (const fix of mhFixes) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE name = $2 RETURNING name`,
        [fix.to, fix.name]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ "${fix.name}" → ${fix.to}`);
        totalFixed++;
      }
    }

    // ============================================
    // PHASE 3: Crisis Services - Fix non-crisis services
    // ============================================
    console.log('\nPHASE 3: Crisis Services fixes...');

    const crisisFixes = [
      { name: 'Alberta Health Services - South Zone (Community Mental Health Services)', to: 'Mental Health & Counselling' },
      { name: 'Central Alberta Pregnancy Care Centre Society', to: 'Family & Parenting Support' },
      { name: 'Child, Youth, and Family Mental Health Therapy - Alberta Health Services - Central Zone', to: 'Mental Health & Counselling' },
      { name: 'Domestic Violence Treatment Services - Grand Prairie', to: 'Domestic Violence Support' },
      { name: 'Fyrefly Institute for Gender and Sexual Diversity - Community, Health, Empowerment, Wellness Project', to: 'LGBTQ2S+ Services' },
      { name: 'Mainsprings Pregnancy and Family Support', to: 'Family & Parenting Support' },
      { name: 'McMan Youth, Family, and Community Services Association of Southeast Alberta', to: 'Youth Services' },
      { name: 'Metis Child and Family Services Society Edmonton', to: 'Indigenous Services' },
      { name: 'Mobile Addictions Outreach – Canadian Mental Health Association (CMHA) – Alberta Northwest Region', to: 'Addiction Treatment' },
      { name: 'Mobile Outreach Addictions Team', to: 'Harm Reduction' },
      { name: 'Nistawoyou Association Friendship Centre - Outreach Team', to: 'Indigenous Services' },
      { name: 'Outreach Housing Team', to: 'Transitional Housing' },
      { name: 'Pregnancy Options Support - Central Alberta Pregnancy Care Centre Society', to: 'Family & Parenting Support' },
      { name: 'SafeLink Alberta', to: 'Harm Reduction' },
      { name: 'The city of Grand Prairie Social Programs and Initiatives', to: 'Basic Needs & Material Aid' },
      { name: 'YOUCAN Youth Services - Relentless Youth Outreach Worker Project', to: 'Youth Services' },
    ];

    for (const fix of crisisFixes) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE name = $2 RETURNING name`,
        [fix.to, fix.name]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ "${fix.name}" → ${fix.to}`);
        totalFixed++;
      }
    }

    // Keep in Crisis Services (they have crisis components):
    // - City of Edmonton (extreme weather response)
    // - City of Grande Prairie (diversion program)

    // ============================================
    // PHASE 4: Recovery & Peer Support fixes
    // ============================================
    console.log('\nPHASE 4: Recovery & Peer Support fixes...');

    const recoveryFixes = [
      { name: 'Sexually Transmitted Infections (STI) Clinic', to: 'LGBTQ2S+ Services' },
      { name: 'Alberta Health Services - Central Zone - Adult Addiction and Mental Health Services - Assertive Outreach', to: 'Addiction Treatment' },
      { name: 'Alberta Health Services - Edmonton Zone - Addiction and Mental Health - Young Adult Walk-In Clinic', to: 'Mental Health & Counselling' },
      { name: 'Sagesse - Stand By: for Informal Supporters', to: 'Domestic Violence Support' },
    ];

    for (const fix of recoveryFixes) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE name = $2 RETURNING name`,
        [fix.to, fix.name]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ "${fix.name}" → ${fix.to}`);
        totalFixed++;
      }
    }

    // Keep in Recovery (they're appropriate):
    // - Al-Anon Family Groups
    // - Clean Scene
    // - Co-Dependents Anonymous

    // ============================================
    // PHASE 5: Harm Reduction fixes
    // ============================================
    console.log('\nPHASE 5: Harm Reduction fixes...');

    const hrFixes = [
      { name: 'Calgary Alternative Support Services - Langin Place', to: 'Transitional Housing' },
      { name: 'Peer Bereavement Support for Substance Use / Overdose Loss', to: 'Grief & Bereavement' },
      { name: 'sakihta kikinaw', to: 'Transitional Housing' },
      { name: 'University of Alberta - Wellness Supports', to: 'Campus & Student Services' },
      { name: 'Wellness Supports', to: 'Campus & Student Services' },
    ];

    for (const fix of hrFixes) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE name = $2 RETURNING name`,
        [fix.to, fix.name]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ "${fix.name}" → ${fix.to}`);
        totalFixed++;
      }
    }

    // Keep in Harm Reduction (they're outreach/engagement for substance users):
    // - Alpha House DOAP Team
    // - Calgary Alpha House Society - HELP Team
    // - City of Edmonton - Community Outreach Transit Team
    // - Community Outreach Transit Team Program

    // ============================================
    // PHASE 6: Detox & Withdrawal fixes
    // ============================================
    console.log('\nPHASE 6: Detox & Withdrawal fixes...');

    const detoxFixes = [
      { name: 'Addiction and Mental Health - Day Hospital', to: 'Mental Health & Counselling' },
      { name: 'Hope in Strathcona - Sober Living', to: 'Recovery & Peer Support' },
      { name: "Iskwew Healing Lodge - Poundmaker's Lodge Treatment Centres", to: 'Indigenous Services' },
    ];

    for (const fix of detoxFixes) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE name = $2 RETURNING name`,
        [fix.to, fix.name]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ "${fix.name}" → ${fix.to}`);
        totalFixed++;
      }
    }

    // ============================================
    // PHASE 7: LGBTQ2S+ fixes
    // ============================================
    console.log('\nPHASE 7: LGBTQ2S+ Services fixes...');

    const lgbtqFixes = [
      { name: 'Sexual Assault Centre of Edmonton (SACE)', to: 'Trauma & PTSD Support' },
      { name: 'Youth Health Bus Calgary', to: 'Youth Services' },
    ];

    for (const fix of lgbtqFixes) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE name = $2 RETURNING name`,
        [fix.to, fix.name]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ "${fix.name}" → ${fix.to}`);
        totalFixed++;
      }
    }

    // Keep (they serve LGBTQ+ community):
    // - Alberta Gay Straight Alliance Network
    // - Centre for Sexuality Calgary
    // - ShiftGrit LGBTQ+ Counselling

    // ============================================
    // PHASE 8: Crisis Lines fixes
    // ============================================
    console.log('\nPHASE 8: Crisis Lines fixes...');

    const crisisLineFixes = [
      { name: 'Alberta Emergency Financial Assistance', to: 'Basic Needs & Material Aid' },
      { name: 'Protection for Persons in Care', to: 'Legal Aid' },
    ];

    for (const fix of crisisLineFixes) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE name = $2 RETURNING name`,
        [fix.to, fix.name]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ "${fix.name}" → ${fix.to}`);
        totalFixed++;
      }
    }

    // ============================================
    // PHASE 9: Indigenous Services fixes
    // ============================================
    console.log('\nPHASE 9: Indigenous Services fixes...');

    // BIPOC is broader than Indigenous-specific
    const indigenousFixes = [
      { name: 'BIPOC Healing and Wellness Centre', to: 'Mental Health & Counselling' },
    ];

    for (const fix of indigenousFixes) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE name = $2 RETURNING name`,
        [fix.to, fix.name]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ "${fix.name}" → ${fix.to}`);
        totalFixed++;
      }
    }

    // Keep (appropriate for Indigenous Services):
    // - Alpha House Wellbriety (indigenous-focused recovery program)
    // - Family Counselling (Sunrise Healing Lodge)

    // ============================================
    // PHASE 10: Newcomer & Settlement fixes
    // ============================================
    console.log('\nPHASE 10: Newcomer & Settlement fixes...');

    const newcomerFixes = [
      { name: 'Mustard Seed - Edmonton - Health and Wellness Program', to: 'Emergency Shelter' },
      { name: 'The Mustard Seed - Edmonton', to: 'Emergency Shelter' },
    ];

    for (const fix of newcomerFixes) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE name = $2 RETURNING name`,
        [fix.to, fix.name]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ "${fix.name}" → ${fix.to}`);
        totalFixed++;
      }
    }

    // ============================================
    // PHASE 11: Eating Disorder fixes
    // ============================================
    console.log('\nPHASE 11: Eating Disorder Services fixes...');

    const eatingFixes = [
      { name: 'AHS Access Mental Health', to: 'Mental Health & Counselling' },
    ];

    for (const fix of eatingFixes) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE name = $2 RETURNING name`,
        [fix.to, fix.name]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ "${fix.name}" → ${fix.to}`);
        totalFixed++;
      }
    }

    // ============================================
    // PHASE 12: Grief & Bereavement fixes
    // ============================================
    console.log('\nPHASE 12: Grief & Bereavement fixes...');

    const griefFixes = [
      { name: 'Alzheimer Society of Calgary - Club 36 Day Program', to: 'Senior Services' },
      { name: 'Alzheimer Society of Calgary - Support Services', to: 'Senior Services' },
    ];

    for (const fix of griefFixes) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE name = $2 RETURNING name`,
        [fix.to, fix.name]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ "${fix.name}" → ${fix.to}`);
        totalFixed++;
      }
    }

    // Keep Wellspring Alberta - cancer support includes grief/loss

    // ============================================
    // PHASE 13: Youth Services fixes
    // ============================================
    console.log('\nPHASE 13: Youth Services fixes...');

    // Hull Services serves 16-24, so it's appropriate for Youth Services
    // Street Connect is outreach but serves vulnerable youth

    // ============================================
    // PHASE 14: Emergency Shelter fixes
    // ============================================
    console.log('\nPHASE 14: Emergency Shelter fixes...');

    const shelterFixes = [
      { name: 'Residence Safe House Program', to: 'Campus & Student Services' },
    ];

    for (const fix of shelterFixes) {
      const result = await client.query(
        `UPDATE services SET category = $1 WHERE name = $2 RETURNING name`,
        [fix.to, fix.name]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ "${fix.name}" → ${fix.to}`);
        totalFixed++;
      }
    }

    await client.query('COMMIT');

    // ============================================
    // VERIFICATION
    // ============================================
    console.log('\n========================================');
    console.log('VERIFICATION');
    console.log('========================================\n');

    console.log(`Total services recategorized: ${totalFixed}`);

    // Category distribution
    const categories = await client.query(`
      SELECT category, COUNT(*) as count
      FROM services
      GROUP BY category
      ORDER BY count DESC
    `);
    console.log(`\nFinal category count: ${categories.rowCount}\n`);
    console.log('Top 25 categories:');
    categories.rows.slice(0, 25).forEach(row => {
      console.log(`  ${row.category}: ${row.count}`);
    });

    // Check for any remaining obvious mismatches
    console.log('\n--- Remaining validation checks ---');

    // Check for detox services not in Detox category
    const detoxCheck = await client.query(`
      SELECT name, category FROM services
      WHERE name ILIKE '%detox%'
      AND category NOT LIKE '%Detox%'
      AND category NOT LIKE '%Indigenous%'
    `);
    console.log(`\nDetox services in wrong categories: ${detoxCheck.rowCount}`);
    detoxCheck.rows.forEach(r => console.log(`  - ${r.name}: ${r.category}`));

    // Check for shelter services not in Shelter/Housing category
    const shelterCheck = await client.query(`
      SELECT name, category FROM services
      WHERE name ILIKE '%shelter%'
      AND category NOT LIKE '%Shelter%'
      AND category NOT LIKE '%Housing%'
      AND category NOT LIKE '%Domestic%'
      AND category NOT LIKE '%Youth%'
    `);
    console.log(`\nShelter services in wrong categories: ${shelterCheck.rowCount}`);
    shelterCheck.rows.forEach(r => console.log(`  - ${r.name}: ${r.category}`));

    console.log('\n========================================');
    console.log('COMPREHENSIVE FIX COMPLETE');
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
