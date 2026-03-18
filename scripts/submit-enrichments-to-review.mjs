/**
 * Submit enriched inactive services to the review pipeline (service_change_requests).
 *
 * Takes all inactive services that were enriched (have eligibility + process_steps)
 * but aren't yet in the change request queue, and creates "update" change requests
 * so they appear in the admin Review page for approval.
 *
 * Usage:
 *   node scripts/submit-enrichments-to-review.mjs
 *   DRY_RUN=false node scripts/submit-enrichments-to-review.mjs
 */
import pg from "pg";
const { Pool } = pg;
import "dotenv/config";

const DRY_RUN = process.env.DRY_RUN !== "false";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const BATCH_ID = `web-scrape-enrichment-${new Date().toISOString().slice(0, 10)}`;

console.log(`\n=== Submit Enriched Services to Review Pipeline ===`);
console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
console.log(`Batch ID: ${BATCH_ID}\n`);

// Find enriched inactive services not already in the change request queue
const enriched = await pool.query(`
  SELECT s.id, s.service_id, s.name, s.category, s.description, s.location,
    s.eligibility, s.process_steps, s.hours_of_operation, s.phone, s.email,
    s.website_url, s.address
  FROM services s
  WHERE s.is_active = false
    AND s.category NOT LIKE 'NOT-DIRECT%'
    AND s.category NOT LIKE 'DUPLICATE%'
    AND s.eligibility IS NOT NULL AND s.eligibility != ''
    AND s.process_steps IS NOT NULL AND s.process_steps::text NOT IN ('[]', 'null', '')
    AND NOT EXISTS (
      SELECT 1 FROM service_change_requests cr
      WHERE cr.service_id = s.id AND cr.status = 'pending'
    )
  ORDER BY s.name
`);

console.log(`Found ${enriched.rows.length} enriched services not yet in review queue\n`);

let submitted = 0;
for (const svc of enriched.rows) {
  const proposedChanges = {
    id: svc.id,
    name: svc.name,
    category: svc.category,
    description: svc.description || "",
    location: svc.location || "",
    eligibility: svc.eligibility,
    processSteps: svc.process_steps,
    hoursOfOperation: svc.hours_of_operation || "",
    phone: svc.phone || "",
    email: svc.email || "",
    websiteUrl: svc.website_url || "",
    address: svc.address || "",
    isActive: false, // keep inactive until manually approved
  };

  console.log(`[${DRY_RUN ? "DRY" : "SUB"}] ${svc.name} (${svc.category})`);

  if (!DRY_RUN) {
    await pool.query(`
      INSERT INTO service_change_requests
        (service_id, change_type, proposed_changes, source, source_plugin, batch_id, status)
      VALUES ($1, 'update', $2, 'enrichment-audit', 'web-scrape', $3, 'pending')
    `, [svc.id, JSON.stringify(proposedChanges), BATCH_ID]);
    submitted++;
  } else {
    submitted++;
  }
}

console.log(`\n=== Summary ===`);
console.log(`Submitted: ${submitted}`);
if (DRY_RUN) console.log(`\nDRY RUN. Run with DRY_RUN=false to submit to review pipeline.`);

await pool.end();
