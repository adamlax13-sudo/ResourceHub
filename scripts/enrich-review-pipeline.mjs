/**
 * Enrich inactive services in the review pipeline.
 *
 * Reads enrichment data from a JSON file and updates services by service_id.
 * Services remain inactive — changes are for manual review before activation.
 *
 * Usage:
 *   node scripts/enrich-review-pipeline.mjs
 *   DRY_RUN=false node scripts/enrich-review-pipeline.mjs
 */
import pg from "pg";
const { Pool } = pg;
import "dotenv/config";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.env.DRY_RUN !== "false";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const JSON_COLUMNS = new Set(["process_steps", "required_docs", "tags", "source_urls"]);

const dataFile = process.argv[2] || "data/review-pipeline-enrichments.json";
const dataPath = resolve(__dirname, dataFile);
const enrichments = JSON.parse(readFileSync(dataPath, "utf-8"));

console.log(`\n=== Review Pipeline Enrichment ===`);
console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
console.log(`Services to enrich: ${enrichments.length}\n`);

let updated = 0;
let skipped = 0;
let errors = 0;

for (const entry of enrichments) {
  const { service_id, updates } = entry;
  if (!service_id || !updates) {
    console.log(`[SKIP] Invalid entry: ${JSON.stringify(entry).slice(0, 80)}`);
    skipped++;
    continue;
  }

  // Check service exists and is inactive
  const existing = await pool.query(
    "SELECT service_id, name, is_active FROM services WHERE service_id = $1",
    [service_id]
  );

  if (existing.rows.length === 0) {
    console.log(`[SKIP] Service not found: ${service_id}`);
    skipped++;
    continue;
  }

  const svc = existing.rows[0];
  if (svc.is_active) {
    console.log(`[SKIP] Service already active (not in review pipeline): ${svc.name}`);
    skipped++;
    continue;
  }

  // Build SET clauses
  const setClauses = [];
  const values = [service_id]; // $1 = service_id
  let paramIdx = 2;

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null) continue;
    const dbValue = JSON_COLUMNS.has(key) && typeof value !== "string"
      ? JSON.stringify(value)
      : value;
    setClauses.push(`${key} = $${paramIdx}`);
    values.push(dbValue);
    paramIdx++;
  }

  if (setClauses.length === 0) {
    console.log(`[SKIP] No fields to update: ${svc.name}`);
    skipped++;
    continue;
  }

  const fieldNames = Object.keys(updates).join(", ");
  console.log(`[${DRY_RUN ? "DRY" : "UPD"}] ${svc.name} → ${fieldNames}`);

  if (!DRY_RUN) {
    try {
      // Update the service
      await pool.query(
        `UPDATE services SET ${setClauses.join(", ")}, last_updated = NOW() WHERE service_id = $1`,
        values
      );

      // Log to service_history (copies required NOT NULL fields from service)
      await pool.query(
        `INSERT INTO service_history (service_id, name, category, description, location, change_type, changed_fields)
         SELECT service_id, name, category, COALESCE(description,''), COALESCE(location,''), 'enrichment', $2::json
         FROM services WHERE service_id = $1`,
        [service_id, JSON.stringify(Object.keys(updates))]
      );

      updated++;
    } catch (err) {
      console.error(`[ERR] ${svc.name}: ${err.message}`);
      errors++;
    }
  } else {
    updated++;
  }
}

console.log(`\n=== Summary ===`);
console.log(`Updated: ${updated}`);
console.log(`Skipped: ${skipped}`);
console.log(`Errors: ${errors}`);
if (DRY_RUN) console.log(`\nThis was a DRY RUN. Run with DRY_RUN=false to apply changes.`);

await pool.end();
