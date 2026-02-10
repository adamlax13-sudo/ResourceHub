/**
 * Database Migration Runner
 *
 * Runs SQL migration files against the database
 * Usage: npx tsx scripts/run-migration.ts migrations/add_category_improvements.sql
 */

import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

async function runMigration(migrationFile: string) {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🚀 Running Migration');
    console.log('====================\n');

    // Read migration file
    const migrationPath = path.resolve(migrationFile);
    console.log(`📄 Reading: ${migrationPath}`);

    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');
    console.log(`✓ Loaded ${sql.length} characters of SQL\n`);

    // Split by semicolons to run individual statements
    // But be careful with statements that contain semicolons in strings
    const statements = sql
      .split(/;(?=(?:[^']*'[^']*')*[^']*$)/g)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📦 Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.substring(0, 60).replace(/\n/g, ' ');

      try {
        await pool.query(stmt);
        console.log(`  ✓ [${i + 1}/${statements.length}] ${preview}...`);
      } catch (err: any) {
        // Ignore "already exists" errors for idempotent operations
        if (err.message.includes('already exists') ||
            err.message.includes('duplicate key') ||
            err.message.includes('does not exist') && stmt.includes('DROP')) {
          console.log(`  ⚠ [${i + 1}/${statements.length}] Skipped (already applied): ${preview}...`);
        } else {
          console.error(`  ❌ [${i + 1}/${statements.length}] Failed: ${preview}...`);
          console.error(`     Error: ${err.message}`);
        }
      }
    }

    console.log('\n✅ Migration complete!\n');

    // Show summary
    console.log('📊 Verification:');

    const result = await pool.query(`
      SELECT
        COUNT(*) as total_services,
        COUNT(gender_restriction) as with_gender_restriction,
        SUM(CASE WHEN is_24_7 THEN 1 ELSE 0 END) as is_24_7_count
      FROM services
      WHERE is_active = true
    `);

    const row = result.rows[0];
    console.log(`  Total active services: ${row.total_services}`);
    console.log(`  With gender_restriction: ${row.with_gender_restriction}`);
    console.log(`  24/7 services: ${row.is_24_7_count}`);

    // Gender restrictions
    const genderResult = await pool.query(`
      SELECT gender_restriction, COUNT(*) as count
      FROM services
      WHERE is_active = true AND gender_restriction IS NOT NULL
      GROUP BY gender_restriction
    `);

    if (genderResult.rows.length > 0) {
      console.log('\n📊 Gender restrictions:');
      for (const r of genderResult.rows) {
        console.log(`  ${r.gender_restriction}: ${r.count}`);
      }
    }

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Get migration file from command line args
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.log('Usage: npx tsx scripts/run-migration.ts <migration-file>');
  console.log('Example: npx tsx scripts/run-migration.ts migrations/add_category_improvements.sql');
  process.exit(1);
}

runMigration(migrationFile);
