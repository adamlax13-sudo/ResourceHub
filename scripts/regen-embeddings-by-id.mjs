/**
 * Regenerate embeddings for specific service IDs.
 * Usage: node scripts/regen-embeddings-by-id.mjs 3529 3533 3534 ...
 * Or: IDS="3529,3533" node scripts/regen-embeddings-by-id.mjs
 */
import pg from "pg";
const { Pool } = pg;
import "dotenv/config";
import OpenAI from "openai";

const DRY_RUN = process.env.DRY_RUN !== "false";
const EMBEDDING_MODEL = "text-embedding-3-large";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY });

// Get IDs from args or env
const ids = process.env.IDS
  ? process.env.IDS.split(",").map(Number)
  : process.argv.slice(2).map(Number);

if (ids.length === 0) {
  console.error("Usage: node scripts/regen-embeddings-by-id.mjs ID1 ID2 ...");
  console.error("   or: IDS=3529,3533 node scripts/regen-embeddings-by-id.mjs");
  process.exit(1);
}

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

async function main() {
  const client = await pool.connect();
  try {
    const { rows: services } = await client.query(
      `SELECT id, name, category, description, location, eligibility, tags
       FROM services WHERE id = ANY($1) ORDER BY id`,
      [ids]
    );
    console.log(`Found ${services.length} services. Model: ${EMBEDDING_MODEL}. DRY_RUN=${DRY_RUN}\n`);

    let processed = 0;
    for (const svc of services) {
      const embedText = buildEmbeddingText(svc);

      if (DRY_RUN) {
        console.log(`  [DRY] ${svc.id}: ${svc.name} — ${embedText.length} chars`);
        processed++;
        continue;
      }

      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: embedText,
        dimensions: 1536,
      });
      const embedding = response.data[0].embedding;

      await client.query(
        `UPDATE services SET embedding = $1, embedding_updated_at = NOW() WHERE id = $2`,
        [`[${embedding.join(",")}]`, svc.id]
      );
      console.log(`  ✓ ${svc.id}: ${svc.name}`);
      processed++;
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`\nDone. Processed: ${processed}`);
    if (DRY_RUN) console.log("(DRY RUN — run with DRY_RUN=false to generate embeddings.)");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
