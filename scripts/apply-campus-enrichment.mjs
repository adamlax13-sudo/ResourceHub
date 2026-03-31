/**
 * Apply campus service enrichment data from JSON files.
 * Reads enrichment data from .firecrawl/reenrich/campus-data/*.json
 *
 * Usage:
 *   node scripts/apply-campus-enrichment.mjs
 *   DRY_RUN=false node scripts/apply-campus-enrichment.mjs
 */
import pg from "pg";
const { Pool } = pg;
import "dotenv/config";
import fs from "fs";
import path from "path";

const DRY_RUN = process.env.DRY_RUN !== "false";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const BATCH_ID = `campus-reenrich-2026-03-29`;
const DATA_DIR = path.join(process.cwd(), ".firecrawl/reenrich/campus-data");

async function main() {
  // Read all JSON files from data dir
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json")).sort();
  let enrichments = [];
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf-8"));
    enrichments.push(...data);
  }

  // Filter out dead pages (confidence 0 or no description)
  const valid = enrichments.filter(e => e.confidence > 0 && e.description);
  const dead = enrichments.filter(e => e.confidence === 0 || !e.description);

  const client = await pool.connect();
  try {
    console.log(`\n=== Campus Services Enrichment ===`);
    console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
    console.log(`Total data entries: ${enrichments.length}`);
    console.log(`Enrichable: ${valid.length}`);
    console.log(`Dead/broken pages (skipped): ${dead.length}`);
    if (dead.length > 0) {
      console.log(`  Dead IDs: ${dead.map(d => d.id).join(", ")}`);
    }
    console.log();

    let updated = 0, reviewed = 0, errors = 0;

    for (const e of valid) {
      const setClauses = [];
      const values = [e.id];
      let idx = 2;

      const fields = {
        description: e.description,
        process_steps: e.process_steps ? JSON.stringify(e.process_steps) : null,
        eligibility: e.eligibility || null,
        hours_of_operation: e.hours || null,
        confidence_score: e.confidence,
        enrichment_source: "found",
        enrichment_date: new Date().toISOString(),
      };

      for (const [key, val] of Object.entries(fields)) {
        if (val === null || val === undefined) continue;
        setClauses.push(`${key} = $${idx}`);
        values.push(val);
        idx++;
      }

      if (setClauses.length === 0) continue;

      if (!DRY_RUN) {
        try {
          await client.query(
            `UPDATE services SET ${setClauses.join(", ")}, last_updated = NOW() WHERE id = $1`,
            values
          );

          const svc = (await client.query(
            `SELECT id, service_id, name, category, description, location, eligibility, process_steps,
                    hours_of_operation, phone, email, website_url, address
             FROM services WHERE id = $1`, [e.id]
          )).rows[0];

          if (svc) {
            const proposedChanges = {
              id: svc.id, name: svc.name, category: svc.category,
              description: svc.description || "", location: svc.location || "",
              eligibility: svc.eligibility || "", processSteps: svc.process_steps,
              hoursOfOperation: svc.hours_of_operation || "",
              phone: svc.phone || "", email: svc.email || "",
              websiteUrl: svc.website_url || "", address: svc.address || "",
              isActive: true,
            };

            await client.query(`
              INSERT INTO service_change_requests
                (service_id, change_type, proposed_changes, source, source_plugin, batch_id, status)
              VALUES ($1, 'update', $2, 'campus-reenrich', 'firecrawl-reenrich', $3, 'pending')
            `, [svc.id, JSON.stringify(proposedChanges), BATCH_ID]);
            reviewed++;
          }

          updated++;
          console.log(`  [UPD] id=${e.id} conf=${e.confidence}`);
        } catch (err) {
          console.error(`  [ERR] id=${e.id}: ${err.message}`);
          errors++;
        }
      } else {
        console.log(`  [DRY] id=${e.id} conf=${e.confidence}`);
        updated++;
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Updated: ${updated}`);
    console.log(`Change requests: ${reviewed}`);
    console.log(`Errors: ${errors}`);
    console.log(`Skipped (dead pages): ${dead.length}`);
    if (DRY_RUN) console.log(`\nDRY RUN. Run with DRY_RUN=false to apply.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
