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

    const sqlPath = path.join(__dirname, 'create_searches_feedback_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Running migration...');
    await client.query(sql);
    console.log('✓ Migration completed successfully!');
    console.log('✓ Tables "searches" and "feedback" created');
    console.log('✓ Indexes created for better performance');

  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
