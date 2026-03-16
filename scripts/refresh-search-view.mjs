import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await pool.connect();
  try {
    console.log('Refreshing mv_service_search...');
    await client.query('REFRESH MATERIALIZED VIEW mv_service_search');
    console.log('Done. Verifying...');
    const result = await client.query(
      "SELECT count(*) FROM mv_service_search WHERE name ILIKE '%making changes employment assoc%'"
    );
    console.log(`"Making Changes Employment Association" in view: ${result.rows[0].count} (should be 0)`);
  } finally {
    client.release();
    await pool.end();
  }
}
main();
