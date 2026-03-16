/**
 * Generic service inserter — adds new services from a JSON data file.
 *
 * Usage:
 *   node scripts/add-services.mjs <data-file> [--source <source-label>]
 *
 * Examples:
 *   node scripts/add-services.mjs scripts/data/hospitals.json
 *   node scripts/add-services.mjs scripts/data/clinics.json --source "health-clinics-2026-03"
 *   DRY_RUN=false node scripts/add-services.mjs scripts/data/new-services.json
 *
 * The JSON file should be an array of service objects with fields matching the
 * services table (name, category, description, location, phone, etc.).
 *
 * Features:
 *   - Dedup check by service_id (slug) and name before inserting
 *   - DRY_RUN=true by default (preview mode)
 *   - Logs to service_history for audit trail
 *   - Generates service_id slug from name automatically
 */
import pg from "pg";
const { Pool } = pg;
import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";

const DRY_RUN = process.env.DRY_RUN !== "false";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Parse args
const args = process.argv.slice(2);
const dataFile = args.find(a => !a.startsWith("--"));
const sourceIdx = args.indexOf("--source");
const sourceLabel = sourceIdx !== -1 ? args[sourceIdx + 1] : null;

if (!dataFile) {
  console.error("Usage: node scripts/add-services.mjs <data-file.json> [--source <label>]");
  console.error("  DRY_RUN=false to apply changes (default: preview only)");
  process.exit(1);
}

function makeServiceId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 200);
}

async function main() {
  const client = await pool.connect();
  try {
    const filePath = resolve(dataFile);
    const services = JSON.parse(readFileSync(filePath, "utf8"));

    if (!Array.isArray(services)) {
      console.error("Error: JSON file must contain an array of service objects.");
      process.exit(1);
    }

    const source = sourceLabel || `manual-script-${new Date().toISOString().slice(0, 10)}`;
    console.log(`Loaded ${services.length} services from ${dataFile}`);
    console.log(`Source label: ${source}`);
    console.log(`DRY_RUN=${DRY_RUN}\n`);

    let inserted = 0;
    let skipped = 0;

    for (const s of services) {
      if (!s.name) {
        console.log(`  SKIP (no name): ${JSON.stringify(s).slice(0, 100)}`);
        skipped++;
        continue;
      }

      const serviceId = makeServiceId(s.name);

      // Check for duplicates
      const existing = await client.query(
        "SELECT id, name FROM services WHERE service_id = $1 OR name = $2",
        [serviceId, s.name]
      );
      if (existing.rows.length > 0) {
        console.log(`  SKIP (duplicate): ${s.name} — existing ID ${existing.rows[0].id}`);
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY] Would insert: ${s.name} | ${s.location || "no location"} | ${s.phone || "no phone"}`);
        inserted++;
        continue;
      }

      const result = await client.query(
        `INSERT INTO services (
          service_id, name, category, description, location, address, phone, email,
          website_url, hours_of_operation, is_24_7, eligibility,
          process_steps, required_docs, wait_times, tags, source_urls,
          confidence_score, age_group, gender_restriction,
          is_faith_based, is_12_step, service_format,
          field_sources, is_active, last_updated
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, $19, $20,
          $21, $22, $23,
          $24, true, NOW()
        ) RETURNING id`,
        [
          serviceId, s.name, s.category, s.description,
          s.location, s.address || null, s.phone || null, s.email || null,
          s.website_url, s.hours_of_operation, s.is_24_7 || false, s.eligibility,
          JSON.stringify(s.process_steps || []), JSON.stringify(s.required_docs || []),
          s.wait_times || null, JSON.stringify(s.tags || []), JSON.stringify(s.source_urls || []),
          s.confidence_score || 70, s.age_group || null, s.gender_restriction || null,
          s.is_faith_based || false, s.is_12_step || false, s.service_format || null,
          JSON.stringify({ source }),
        ]
      );
      console.log(`  ✓ Inserted: ${s.name} (ID ${result.rows[0].id})`);
      inserted++;

      await client.query(
        `INSERT INTO service_history (service_id, name, category, change_type, changed_fields, recorded_at)
         VALUES ($1, $2, $3, 'bulk_insert', $4, NOW())`,
        [serviceId, s.name, s.category, JSON.stringify({ source })]
      );
    }

    console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
    if (DRY_RUN) console.log("(DRY RUN — no changes written. Run with DRY_RUN=false to execute.)");
    if (inserted > 0 && !DRY_RUN) {
      console.log("\nNext steps:");
      console.log("  1. Generate embeddings: node scripts/regen-embeddings-by-id.mjs <IDs>");
      console.log("  2. Refresh search view: node scripts/refresh-search-view.mjs");
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
