import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DRY_RUN = process.env.DRY_RUN !== 'false';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const createTable = `
      CREATE TABLE IF NOT EXISTS service_change_requests (
        id SERIAL PRIMARY KEY,
        service_id INTEGER REFERENCES services(id),
        change_type VARCHAR(20) NOT NULL,
        proposed_changes JSONB NOT NULL,
        previous_values JSONB,
        source VARCHAR(20) NOT NULL,
        source_plugin VARCHAR(100),
        source_url TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        batch_id VARCHAR(100),
        duplicate_of INTEGER REFERENCES services(id),
        submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
        reviewed_at TIMESTAMP,
        reviewed_by VARCHAR(100),
        review_notes TEXT
      );
    `;

  const createIndexes = `
      CREATE INDEX IF NOT EXISTS idx_scr_status ON service_change_requests(status);
      CREATE INDEX IF NOT EXISTS idx_scr_batch_id ON service_change_requests(batch_id);
      CREATE INDEX IF NOT EXISTS idx_scr_service_id ON service_change_requests(service_id);
      CREATE INDEX IF NOT EXISTS idx_scr_submitted_at ON service_change_requests(submitted_at DESC);
    `;

  const alterScraperLogs = `
      ALTER TABLE scraper_logs ADD COLUMN IF NOT EXISTS source_results JSONB;
      ALTER TABLE scraper_logs ADD COLUMN IF NOT EXISTS phases_run JSONB;
      ALTER TABLE scraper_logs ADD COLUMN IF NOT EXISTS config JSONB;
    `;

  if (DRY_RUN) {
    console.log('[DRY RUN] Would execute:');
    console.log(createTable);
    console.log(createIndexes);
    console.log(alterScraperLogs);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query(createTable);
    console.log('Created service_change_requests table');
    await client.query(createIndexes);
    console.log('Created indexes');
    await client.query(alterScraperLogs);
    console.log('Extended scraper_logs with new columns');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
