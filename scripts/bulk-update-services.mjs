/**
 * Generic bulk field updater — updates any fields on services by ID.
 *
 * Usage:
 *   node scripts/bulk-update-services.mjs <updates-file.json>
 *   DRY_RUN=false node scripts/bulk-update-services.mjs <updates-file.json>
 *
 * The JSON file should be an array of update objects:
 *   [
 *     {
 *       "id": 123,
 *       "name": "Service Name (for logging only)",
 *       "fields": {
 *         "phone": "403-555-1234",
 *         "hours_of_operation": "Mon-Fri 9am-5pm",
 *         "confidence_score": 85,
 *         "process_steps": ["Step 1", "Step 2"],
 *         "tags": ["food", "emergency"]
 *       },
 *       "reason": "Optional: why this change is being made"
 *     }
 *   ]
 *
 * Features:
 *   - Updates any combination of fields per service
 *   - Auto-stringifies arrays/objects for JSON columns
 *   - DRY_RUN=true by default
 *   - Logs all changes with reasons
 *
 * JSON columns (auto-stringified): process_steps, required_docs, tags, source_urls, field_sources
 *
 * Examples:
 *   # Fix phone numbers
 *   echo '[{"id": 123, "fields": {"phone": "403-555-0000"}, "reason": "wrong number"}]' > fix.json
 *   DRY_RUN=false node scripts/bulk-update-services.mjs fix.json
 *
 *   # Enrich multiple fields at once
 *   echo '[{"id": 456, "fields": {"hours_of_operation": "24/7", "is_24_7": true, "confidence_score": 90}}]' > enrich.json
 *   node scripts/bulk-update-services.mjs enrich.json
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

// Columns stored as JSON in the DB
const JSON_COLUMNS = new Set([
  "process_steps", "required_docs", "tags", "source_urls", "field_sources",
]);

function prepareValue(key, value) {
  if (JSON_COLUMNS.has(key) && typeof value !== "string") {
    return JSON.stringify(value);
  }
  return value;
}

async function main() {
  const dataFile = process.argv[2];
  if (!dataFile) {
    console.error("Usage: node scripts/bulk-update-services.mjs <updates-file.json>");
    console.error("  DRY_RUN=false to apply changes (default: preview only)");
    process.exit(1);
  }

  const filePath = resolve(dataFile);
  const updates = JSON.parse(readFileSync(filePath, "utf8"));

  if (!Array.isArray(updates)) {
    console.error("Error: JSON file must contain an array of update objects.");
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    console.log(`Loaded ${updates.length} updates from ${dataFile}. DRY_RUN=${DRY_RUN}\n`);

    let updated = 0;
    let skipped = 0;

    for (const u of updates) {
      if (!u.id || !u.fields || Object.keys(u.fields).length === 0) {
        console.log(`  SKIP (missing id or fields): ${JSON.stringify(u).slice(0, 100)}`);
        skipped++;
        continue;
      }

      const fieldNames = Object.keys(u.fields);
      const label = u.name || `ID ${u.id}`;

      if (DRY_RUN) {
        console.log(`  [DRY] ${label} (ID ${u.id}):`);
        console.log(`         Fields: ${fieldNames.join(", ")}`);
        if (u.reason) console.log(`         Reason: ${u.reason}`);
        updated++;
        continue;
      }

      const setClauses = fieldNames.map((f, i) => `${f} = $${i + 1}`).join(", ");
      const values = fieldNames.map(f => prepareValue(f, u.fields[f]));

      await client.query(
        `UPDATE services SET ${setClauses}, last_updated = NOW() WHERE id = $${fieldNames.length + 1}`,
        [...values, u.id]
      );
      console.log(`  ✓ ${label} (ID ${u.id}): ${fieldNames.join(", ")}`);
      if (u.reason) console.log(`    Reason: ${u.reason}`);
      updated++;
    }

    console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
    if (DRY_RUN) console.log("(DRY RUN — no changes written. Run with DRY_RUN=false to apply.)");
    if (updated > 0 && !DRY_RUN) {
      console.log("\nIf descriptions/names/tags changed, regenerate embeddings:");
      console.log("  node scripts/regen-embeddings-by-id.mjs <IDs>");
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
