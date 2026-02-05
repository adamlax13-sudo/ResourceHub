import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = 'postgresql://db_resourcenavigator_user:sjZnkniL7937GHPmR3mNfACf2wTp4wz6@dpg-d5juaqffte5s738u3qng-a.oregon-postgres.render.com/db_resourcenavigator';

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
