import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// IMPORTANT: Set DATABASE_URL environment variable before running
// Example: DATABASE_URL=postgresql://user:pass@host:5432/db node run-migration.js
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  console.error('Usage: DATABASE_URL=postgresql://user:pass@host:5432/db node run-migration.js');
  process.exit(1);
}

async function runMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected successfully!');

    // Run all migration files in order
    const migrationFiles = [
      'create_searches_feedback_tables.sql',
      'add_ai_service_enrichments.sql',
      'add_search_improvements.sql',
      'add_normalized_contact_fields.sql',
      'add_vector_embeddings.sql',
      'add_optimized_search.sql',
    ];

    for (const file of migrationFiles) {
      const sqlPath = path.join(__dirname, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log(`Running migration: ${file}...`);
      await client.query(sql);
      console.log(`✓ ${file} completed`);
    }

    console.log('✓ All migrations completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
