/**
 * Re-embed all active services using text-embedding-3-large (truncated to 1536 dims).
 *
 * This is a one-time migration script to upgrade from text-embedding-3-small
 * to text-embedding-3-large, which provides better semantic separation between
 * categories (e.g., prevents "restraining order" from matching eating disorder services).
 *
 * Usage:
 *   node scripts/reembed-all-services.mjs            # DRY RUN (default)
 *   DRY_RUN=false node scripts/reembed-all-services.mjs   # LIVE run
 *   DRY_RUN=false FORCE=true node scripts/reembed-all-services.mjs  # Re-embed even existing
 *
 * Cost estimate: ~800 services × ~500 tokens avg = 400K tokens × $0.13/M = ~$0.05
 */

import pg from "pg";
const { Pool } = pg;
import "dotenv/config";
import OpenAI from "openai";

const DRY_RUN = process.env.DRY_RUN !== "false";
const FORCE = process.env.FORCE === "true"; // Re-embed even services that already have embeddings
const BATCH_SIZE = 20;
const DELAY_MS = 100; // 100ms between calls to stay under rate limits

const EMBEDDING_MODEL = "text-embedding-3-large";
const EMBEDDING_DIMENSIONS = 1536; // Truncate to 1536 to keep same DB schema

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY });

function buildEmbeddingText(svc) {
  const parts = [];
  if (svc.name) parts.push(`Service: ${svc.name}`);
  if (svc.category) {
    parts.push(`Category: ${svc.category}`);
    parts.push(`This is a ${svc.category} service.`);
  }
  if (svc.description) parts.push(`Description: ${svc.description}`);
  if (svc.eligibility) parts.push(`Eligibility: ${svc.eligibility}`);
  if (svc.location) parts.push(`Location: ${svc.location}`);
  if (svc.tags && Array.isArray(svc.tags)) parts.push(`Tags: ${svc.tags.join(", ")}`);
  return parts.join("\n").slice(0, 20000);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const client = await pool.connect();
  try {
    const whereClause = FORCE
      ? "WHERE is_active = true"
      : "WHERE is_active = true AND embedding IS NULL";

    const { rows: services } = await client.query(
      `SELECT id, name, category, description, location, eligibility, tags
       FROM services
       ${whereClause}
       ORDER BY id`
    );

    console.log(`\n=== Re-embed All Services: ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS}d) ===`);
    console.log(`Found ${services.length} services to process.`);
    console.log(`DRY_RUN=${DRY_RUN}, FORCE=${FORCE}\n`);

    if (DRY_RUN) {
      console.log("DRY RUN — no writes. Set DRY_RUN=false to execute.\n");
      let totalTokensEst = 0;
      for (const svc of services.slice(0, 10)) {
        const text = buildEmbeddingText(svc);
        const tokenEst = Math.ceil(text.length / 4);
        totalTokensEst += tokenEst;
        console.log(`  [${svc.id}] ${svc.name.slice(0, 60)} — ~${tokenEst} tokens`);
      }
      if (services.length > 10) console.log(`  ... and ${services.length - 10} more`);
      const fullEst = Math.ceil((totalTokensEst / Math.min(10, services.length)) * services.length);
      const costEst = (fullEst / 1_000_000 * 0.13).toFixed(4);
      console.log(`\nEstimated tokens: ~${fullEst.toLocaleString()}`);
      console.log(`Estimated cost:   ~$${costEst}`);
      return;
    }

    let processed = 0;
    let errors = 0;

    for (let i = 0; i < services.length; i++) {
      const svc = services[i];
      const embedText = buildEmbeddingText(svc);

      try {
        const response = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: embedText,
          dimensions: EMBEDDING_DIMENSIONS,
        });
        const embedding = response.data[0].embedding;

        await client.query(
          `UPDATE services
           SET embedding = CAST($1 AS vector), embedding_updated_at = NOW()
           WHERE id = $2`,
          [`[${embedding.join(",")}]`, svc.id]
        );

        processed++;
        if (processed % 50 === 0 || processed === services.length) {
          console.log(`  Progress: ${processed}/${services.length} (${Math.round(processed/services.length*100)}%)`);
        }

        await sleep(DELAY_MS);
      } catch (err) {
        errors++;
        console.error(`  ERROR service ${svc.id} (${svc.name}): ${err.message}`);
        if (errors > 20) {
          console.error("Too many errors — aborting.");
          break;
        }
      }
    }

    console.log(`\n=== Done ===`);
    console.log(`Processed: ${processed}`);
    console.log(`Errors:    ${errors}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Restart the server (embedding cache will be invalidated automatically)`);
    console.log(`  2. Run: npm run evaluate  (verify search quality improved)`);
    console.log(`  3. Bump CACHE_VERSION in server/search/index.ts`);

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
