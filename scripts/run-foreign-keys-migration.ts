/**
 * Run the foreign key migration
 * Usage: npx tsx scripts/run-foreign-keys-migration.ts
 */

import 'dotenv/config';
import { pool } from '../server/db';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  console.log('Running foreign key migration...');

  const migrationPath = join(__dirname, '../migrations/add_foreign_keys.sql');
  const sql = readFileSync(migrationPath, 'utf-8');

  const client = await pool.connect();

  try {
    // Execute the migration
    await client.query(sql);
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
