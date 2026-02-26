/**
 * Merge specific confirmed duplicate services.
 * Deactivates duplicates while keeping the canonical entry.
 */
import 'dotenv/config';
import { Pool } from 'pg';

interface MergePair {
  keepName: string;
  deactivateName: string;
  reason: string;
  preferWithAddress?: boolean;
}

// Confirmed duplicates from CSV review
const MERGE_PAIRS: MergePair[] = [
  {
    keepName: 'enCompass Community Safety Agency - Family Violence Prevention Centre - Nalah Centre',
    deactivateName: 'enCompass Community Safety Agency - Nalah Centre',
    reason: 'Same service, keep fuller name',
  },
  {
    keepName: 'Iikaisskini Indigenous Services',
    deactivateName: 'Iikaisskini Indigenous Services Lethbridge',
    reason: 'Duplicate with city suffix',
  },
  {
    keepName: 'ConnecTeen',
    deactivateName: 'ConnecTeen Calgary',
    reason: 'Duplicate with city suffix',
  },
  {
    keepName: 'Canadian Mental Health Association - Edmonton Region',
    deactivateName: 'CMHA Edmonton',
    reason: 'Abbreviated duplicate',
  },
  {
    keepName: 'Canadian Mental Health Association - Edmonton Region - Distress Line',
    deactivateName: 'Distress Line Edmonton',
    reason: 'Abbreviated duplicate without org name',
  },
  {
    keepName: 'Family Centre (of Northern Alberta), The',
    deactivateName: 'The Family Centre',
    reason: 'Shorter duplicate missing region',
  },
  {
    keepName: 'Lurana Shelter',
    deactivateName: 'Lurana Shelter',
    reason: 'Keep entry with address',
    preferWithAddress: true,
  },
  {
    keepName: 'University of Lethbridge - Counselling Services',
    deactivateName: 'U of Lethbridge Counselling Services',
    reason: 'Abbreviated duplicate',
  },
  {
    keepName: 'SAGE Seniors Safe House Edmonton',
    deactivateName: "Seniors' Safe House",
    reason: 'Duplicate without org name',
  },
  {
    keepName: 'University of Alberta - Wellness Supports',
    deactivateName: 'Wellness Supports',
    reason: 'Duplicate without institution name',
  },
  {
    keepName: 'Red Deer Meals on Wheels',
    deactivateName: 'Red Deer Meals on Wheels - Meal Delivery',
    reason: 'More specific service name is duplicate of main entry',
  },
];

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Merging confirmed duplicate services...\n');

    let totalDeactivated = 0;
    let totalSkipped = 0;

    for (const pair of MERGE_PAIRS) {
      console.log(`\n--- ${pair.reason} ---`);

      // Special handling for same-name duplicates (prefer one with address)
      if (pair.preferWithAddress) {
        const result = await pool.query(`
          SELECT service_id, name, address, is_active
          FROM services
          WHERE name ILIKE $1 AND is_active = true
          ORDER BY
            CASE WHEN address IS NOT NULL AND address != '' THEN 0 ELSE 1 END,
            LENGTH(COALESCE(description, '')) DESC
        `, [`%${pair.keepName}%`]);

        if (result.rows.length < 2) {
          console.log(`  SKIP: Only found ${result.rows.length} active service(s) matching "${pair.keepName}"`);
          totalSkipped++;
          continue;
        }

        const keep = result.rows[0];
        const deactivate = result.rows.slice(1);

        console.log(`  KEEP: ${keep.name}`);
        console.log(`        ID: ${keep.service_id}`);
        console.log(`        Address: ${keep.address || '(none)'}`);

        for (const dup of deactivate) {
          console.log(`  DEACTIVATE: ${dup.name}`);
          console.log(`              ID: ${dup.service_id}`);

          await pool.query(`UPDATE services SET is_active = false WHERE service_id = $1`, [dup.service_id]);
          await pool.query(`
            INSERT INTO deduplication_log (kept_service_id, removed_service_id, duplicate_type, match_value, reason)
            VALUES ($1, $2, 'embedding_similarity', $3, $4)
          `, [keep.service_id, dup.service_id, 'manual_review', pair.reason]);
          totalDeactivated++;
        }
        continue;
      }

      // Find the service to keep
      const keepResult = await pool.query(`
        SELECT service_id, name, address
        FROM services
        WHERE name ILIKE $1 AND is_active = true
        LIMIT 1
      `, [`%${pair.keepName}%`]);

      if (keepResult.rows.length === 0) {
        console.log(`  SKIP: Could not find service to KEEP matching: "${pair.keepName}"`);
        totalSkipped++;
        continue;
      }

      const keepService = keepResult.rows[0];

      // Find service to deactivate
      const deactivateResult = await pool.query(`
        SELECT service_id, name
        FROM services
        WHERE name ILIKE $1
          AND is_active = true
          AND service_id != $2
        LIMIT 1
      `, [`%${pair.deactivateName}%`, keepService.service_id]);

      if (deactivateResult.rows.length === 0) {
        console.log(`  SKIP: Could not find service to DEACTIVATE matching: "${pair.deactivateName}"`);
        console.log(`        (May already be inactive)`);
        totalSkipped++;
        continue;
      }

      const deactivateService = deactivateResult.rows[0];

      console.log(`  KEEP: ${keepService.name}`);
      console.log(`        ID: ${keepService.service_id}`);
      console.log(`  DEACTIVATE: ${deactivateService.name}`);
      console.log(`              ID: ${deactivateService.service_id}`);

      // Deactivate the duplicate
      await pool.query(`UPDATE services SET is_active = false WHERE service_id = $1`, [deactivateService.service_id]);

      // Log to deduplication_log
      await pool.query(`
        INSERT INTO deduplication_log (kept_service_id, removed_service_id, duplicate_type, match_value, reason)
        VALUES ($1, $2, 'embedding_similarity', $3, $4)
      `, [keepService.service_id, deactivateService.service_id, 'manual_review', pair.reason]);

      totalDeactivated++;
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`Total deactivated: ${totalDeactivated}`);
    console.log(`Total skipped: ${totalSkipped}`);

  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Merge failed:', err);
  process.exit(1);
});
