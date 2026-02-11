/**
 * Generate embeddings for services that don't have them yet.
 *
 * Usage: npx tsx scripts/generate-embeddings.ts
 *
 * Optional: Pass a service_id to generate for a specific service:
 *   npx tsx scripts/generate-embeddings.ts health-upwardly-mobile-programs
 */

import 'dotenv/config';
import OpenAI from 'openai';
import pg from 'pg';

const { Pool } = pg;

const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 10;

const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey });

// Create pool with SSL enabled for remote databases
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

interface ServiceRow {
  id: number;
  service_id: string;
  name: string;
  category: string | null;
  description: string | null;
  eligibility: string | null;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

function buildEmbeddingText(service: ServiceRow): string {
  const parts = [
    service.name,
    service.category,
    service.description,
    service.eligibility,
  ].filter(Boolean);

  return parts.join(' ').substring(0, 8000);
}

async function generateForService(serviceId: string): Promise<void> {
  console.log(`Generating embedding for service: ${serviceId}`);

  const result = await pool.query(
    `SELECT id, service_id, name, category, description, eligibility
     FROM services WHERE service_id = $1`,
    [serviceId]
  );

  if (result.rows.length === 0) {
    console.error(`Service not found: ${serviceId}`);
    process.exit(1);
  }

  const service = result.rows[0] as ServiceRow;
  const text = buildEmbeddingText(service);

  console.log(`Text length: ${text.length} characters`);

  const embedding = await generateEmbedding(text);
  const embeddingStr = `[${embedding.join(',')}]`;

  await pool.query(
    `UPDATE services
     SET embedding = $1::vector, embedding_updated_at = NOW()
     WHERE service_id = $2`,
    [embeddingStr, serviceId]
  );

  console.log(`Embedding generated and saved for: ${service.name}`);
}

async function generateForAllMissing(): Promise<void> {
  const result = await pool.query(
    `SELECT id, service_id, name, category, description, eligibility
     FROM services
     WHERE is_active = true AND embedding IS NULL
     ORDER BY id`
  );

  const services = result.rows as ServiceRow[];
  console.log(`Found ${services.length} services without embeddings`);

  if (services.length === 0) {
    console.log('All services have embeddings!');
    return;
  }

  let processed = 0;
  let errors = 0;

  for (const service of services) {
    try {
      const text = buildEmbeddingText(service);
      const embedding = await generateEmbedding(text);
      const embeddingStr = `[${embedding.join(',')}]`;

      await pool.query(
        `UPDATE services
         SET embedding = $1::vector, embedding_updated_at = NOW()
         WHERE id = $2`,
        [embeddingStr, service.id]
      );

      processed++;
      console.log(`[${processed}/${services.length}] Generated for: ${service.name.substring(0, 50)}`);

      if (processed % BATCH_SIZE === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (err) {
      errors++;
      console.error(`Error for ${service.service_id}:`, err);
    }
  }

  console.log(`\nDone! Processed: ${processed}, Errors: ${errors}`);
}

async function main() {
  const specificServiceId = process.argv[2];

  if (!apiKey) {
    console.error('OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    if (specificServiceId) {
      await generateForService(specificServiceId);
    } else {
      await generateForAllMissing();
    }
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }

  process.exit(0);
}

main();
