/**
 * Generic service deactivation — deactivates services by ID with reason logging.
 * Optionally merges fields from deactivated services into keeper services.
 *
 * Usage:
 *   node scripts/deactivate-services.mjs <deactivations-file.json>
 *   DRY_RUN=false node scripts/deactivate-services.mjs <deactivations-file.json>
 *
 * The JSON file should be an array of deactivation objects:
 *   [
 *     {
 *       "id": 123,
 *       "name": "Service Name",
 *       "reason": "Duplicate of ID 456 / Dead website / Not a direct service"
 *     }
 *   ]
 *
 * For dedup with field merging, add keeperId and mergeFields:
 *   [
 *     {
 *       "id": 123,
 *       "name": "Duplicate Service",
 *       "reason": "Duplicate of ID 456",
 *       "keeperId": 456,
 *       "mergeFields": {
 *         "phone": "403-555-1234",
 *         "email": "info@example.com"
 *       }
 *     }
 *   ]
 *
 * Features:
 *   - DRY_RUN=true by default
 *   - Verifies service exists and is active before deactivating
 *   - Optional field merge into keeper service (for dedup)
 *   - Logs to service_history for audit trail
 *   - Reminds to refresh materialized view after deactivations
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

async function main() {
  const dataFile = process.argv[2];
  if (!dataFile) {
    console.error("Usage: node scripts/deactivate-services.mjs <deactivations-file.json>");
    console.error("  DRY_RUN=false to apply changes (default: preview only)");
    process.exit(1);
  }

  const filePath = resolve(dataFile);
  const deactivations = JSON.parse(readFileSync(filePath, "utf8"));

  if (!Array.isArray(deactivations)) {
    console.error("Error: JSON file must contain an array of deactivation objects.");
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    console.log(`Loaded ${deactivations.length} deactivations from ${dataFile}. DRY_RUN=${DRY_RUN}\n`);

    let deactivated = 0;
    let merged = 0;
    let skipped = 0;

    for (const d of deactivations) {
      if (!d.id) {
        console.log(`  SKIP (no id): ${JSON.stringify(d).slice(0, 100)}`);
        skipped++;
        continue;
      }

      const label = d.name || `ID ${d.id}`;

      // Verify service exists and is active
      const existing = await client.query(
        "SELECT id, name, is_active FROM services WHERE id = $1",
        [d.id]
      );
      if (existing.rows.length === 0) {
        console.log(`  SKIP (not found): ${label} (ID ${d.id})`);
        skipped++;
        continue;
      }
      if (!existing.rows[0].is_active) {
        console.log(`  SKIP (already inactive): ${label} (ID ${d.id})`);
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY] DEACTIVATE: ${label} (ID ${d.id})`);
        console.log(`         Reason: ${d.reason || "not specified"}`);
        if (d.keeperId && d.mergeFields) {
          console.log(`         Merge fields to keeper ID ${d.keeperId}: ${Object.keys(d.mergeFields).join(", ")}`);
        }
        deactivated++;
        continue;
      }

      // Deactivate
      await client.query(
        "UPDATE services SET is_active = false, last_updated = NOW() WHERE id = $1",
        [d.id]
      );
      console.log(`  ✓ DEACTIVATED: ${label} (ID ${d.id})`);
      console.log(`    Reason: ${d.reason || "not specified"}`);

      // Log to service_history
      await client.query(
        `INSERT INTO service_history (service_id, name, category, change_type, changed_fields, recorded_at)
         VALUES ($1, $2, $3, 'deactivate', $4, NOW())`,
        [
          existing.rows[0].id.toString(),
          existing.rows[0].name,
          null,
          JSON.stringify({ reason: d.reason, keeperId: d.keeperId || null }),
        ]
      );

      // Optional: merge fields into keeper
      if (d.keeperId && d.mergeFields && Object.keys(d.mergeFields).length > 0) {
        const fieldNames = Object.keys(d.mergeFields);
        const setClauses = fieldNames.map((f, i) => `${f} = $${i + 1}`).join(", ");
        const values = fieldNames.map(f => {
          const v = d.mergeFields[f];
          return (typeof v === "object" && v !== null) ? JSON.stringify(v) : v;
        });

        await client.query(
          `UPDATE services SET ${setClauses}, last_updated = NOW() WHERE id = $${fieldNames.length + 1}`,
          [...values, d.keeperId]
        );
        console.log(`    Merged ${fieldNames.join(", ")} → keeper ID ${d.keeperId}`);
        merged++;
      }

      deactivated++;
    }

    console.log(`\nDone. Deactivated: ${deactivated}, Field merges: ${merged}, Skipped: ${skipped}`);
    if (DRY_RUN) console.log("(DRY RUN — no changes written. Run with DRY_RUN=false to apply.)");
    if (deactivated > 0 && !DRY_RUN) {
      console.log("\nIMPORTANT: Refresh the materialized view:");
      console.log("  node scripts/refresh-search-view.mjs");
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
