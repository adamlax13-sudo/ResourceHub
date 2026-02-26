/**
 * Find Near-Duplicate Services Script
 *
 * Identifies potential duplicate services by finding pairs with:
 * - >0.9 cosine similarity on their embeddings
 * - Same city (extracted from location/address)
 *
 * Outputs a CSV file for manual review.
 */
import 'dotenv/config';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SIMILARITY_THRESHOLD = 0.9;
const OUTPUT_DIR = path.join(__dirname, '../server/evaluation/reports');

interface ServicePair {
  service1_id: string;
  service1_name: string;
  service2_id: string;
  service2_name: string;
  similarity: number;
  city: string;
  service1_org: string;
  service2_org: string;
  service1_address: string;
  service2_address: string;
}

/**
 * Extract city from location or address string
 */
function extractCity(location: string | null, address: string | null): string {
  const text = (location || address || '').toLowerCase();

  // Common Alberta cities
  const cities = [
    'calgary', 'edmonton', 'red deer', 'lethbridge', 'medicine hat',
    'grande prairie', 'airdrie', 'st. albert', 'spruce grove', 'leduc',
    'fort mcmurray', 'lloydminster', 'camrose', 'brooks', 'cold lake',
    'wetaskiwin', 'okotoks', 'cochrane', 'sylvan lake', 'chestermere',
    'beaumont', 'stony plain', 'hinton', 'drumheller', 'high river',
    'lacombe', 'ponoka', 'taber', 'canmore', 'banff', 'jasper'
  ];

  for (const city of cities) {
    if (text.includes(city)) {
      return city.charAt(0).toUpperCase() + city.slice(1);
    }
  }

  return 'Unknown';
}

/**
 * Extract organization name from service name (first part before dash or comma)
 */
function extractOrg(name: string): string {
  // Try to extract org name from patterns like "Org Name - Service Type"
  const dashMatch = name.match(/^([^-–]+)[-–]/);
  if (dashMatch) {
    return dashMatch[1].trim();
  }

  // Try comma separation
  const commaMatch = name.match(/^([^,]+),/);
  if (commaMatch) {
    return commaMatch[1].trim();
  }

  // Return first 3 words as org identifier
  return name.split(/\s+/).slice(0, 3).join(' ');
}

/**
 * Escape CSV field
 */
function escapeCSV(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 60000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Finding services with >0.9 embedding similarity...\n');
    console.log('This may take a few minutes for large datasets...\n');

    // First, get count of services with embeddings
    const countResult = await pool.query(`
      SELECT COUNT(*) as cnt FROM services
      WHERE is_active = true AND embedding IS NOT NULL
    `);
    const totalServices = parseInt(countResult.rows[0].cnt);
    console.log(`Total services with embeddings: ${totalServices}`);

    // Process in batches to avoid timeout
    // For each service, find its nearest neighbors above threshold
    const { rows } = await pool.query<{
      service1_id: string;
      service1_name: string;
      service1_location: string | null;
      service1_address: string | null;
      service2_id: string;
      service2_name: string;
      service2_location: string | null;
      service2_address: string | null;
      similarity: number;
    }>(`
      SELECT
        s1.service_id as service1_id,
        s1.name as service1_name,
        s1.location as service1_location,
        s1.address as service1_address,
        s2.service_id as service2_id,
        s2.name as service2_name,
        s2.location as service2_location,
        s2.address as service2_address,
        1 - (s1.embedding <=> s2.embedding) as similarity
      FROM services s1
      JOIN services s2 ON s1.service_id < s2.service_id
      WHERE s1.is_active = true
        AND s2.is_active = true
        AND s1.embedding IS NOT NULL
        AND s2.embedding IS NOT NULL
        AND 1 - (s1.embedding <=> s2.embedding) > $1
      ORDER BY similarity DESC
      LIMIT 500
    `, [SIMILARITY_THRESHOLD]);

    console.log(`Found ${rows.length} pairs with similarity > ${SIMILARITY_THRESHOLD}\n`);

    // Filter to same city and enrich data
    const duplicatePairs: ServicePair[] = [];

    for (const row of rows) {
      const city1 = extractCity(row.service1_location, row.service1_address);
      const city2 = extractCity(row.service2_location, row.service2_address);

      // Only include if both are in the same city (and city is known)
      if (city1 === city2 && city1 !== 'Unknown') {
        duplicatePairs.push({
          service1_id: row.service1_id,
          service1_name: row.service1_name,
          service2_id: row.service2_id,
          service2_name: row.service2_name,
          similarity: row.similarity,
          city: city1,
          service1_org: extractOrg(row.service1_name),
          service2_org: extractOrg(row.service2_name),
          service1_address: row.service1_address || '',
          service2_address: row.service2_address || '',
        });
      }
    }

    console.log(`${duplicatePairs.length} pairs are in the same city\n`);

    // Group by same org
    const sameOrgPairs = duplicatePairs.filter(
      p => p.service1_org.toLowerCase() === p.service2_org.toLowerCase()
    );
    const diffOrgPairs = duplicatePairs.filter(
      p => p.service1_org.toLowerCase() !== p.service2_org.toLowerCase()
    );

    console.log(`  - Same organization: ${sameOrgPairs.length}`);
    console.log(`  - Different organization: ${diffOrgPairs.length}\n`);

    // Print top 10 same-org duplicates
    if (sameOrgPairs.length > 0) {
      console.log('=== Top Same-Org Potential Duplicates ===');
      for (const pair of sameOrgPairs.slice(0, 10)) {
        console.log(`\nSimilarity: ${(pair.similarity * 100).toFixed(1)}% | City: ${pair.city}`);
        console.log(`  1. ${pair.service1_name.substring(0, 60)}`);
        console.log(`     ID: ${pair.service1_id}`);
        console.log(`  2. ${pair.service2_name.substring(0, 60)}`);
        console.log(`     ID: ${pair.service2_id}`);
      }
    }

    // Output to CSV
    if (duplicatePairs.length > 0) {
      // Ensure output directory exists
      if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const csvPath = path.join(OUTPUT_DIR, `duplicate-services-${timestamp}.csv`);

      const csvHeader = 'similarity,city,same_org,service1_id,service1_name,service1_org,service1_address,service2_id,service2_name,service2_org,service2_address\n';
      const csvRows = duplicatePairs.map(p => [
        p.similarity.toFixed(4),
        escapeCSV(p.city),
        p.service1_org.toLowerCase() === p.service2_org.toLowerCase() ? 'yes' : 'no',
        escapeCSV(p.service1_id),
        escapeCSV(p.service1_name),
        escapeCSV(p.service1_org),
        escapeCSV(p.service1_address),
        escapeCSV(p.service2_id),
        escapeCSV(p.service2_name),
        escapeCSV(p.service2_org),
        escapeCSV(p.service2_address),
      ].join(','));

      fs.writeFileSync(csvPath, csvHeader + csvRows.join('\n'));
      console.log(`\nCSV exported to: ${csvPath}`);
    }

    // Summary statistics
    console.log('\n=== Summary ===');
    console.log(`Total pairs > ${SIMILARITY_THRESHOLD * 100}% similarity: ${rows.length}`);
    console.log(`Same city pairs: ${duplicatePairs.length}`);
    console.log(`Same org + same city: ${sameOrgPairs.length} (likely duplicates)`);
    console.log(`Different org + same city: ${diffOrgPairs.length} (may be related services)`);

  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
