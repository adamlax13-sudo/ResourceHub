import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

const { Pool } = pg;

interface DuplicateGroup {
  type: string;
  matchValue: string;
  services: { serviceId: string; name: string; location: string | null }[];
}

async function detectDuplicates() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL environment variable is required");
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });
  const db = drizzle(pool);

  console.log("🔍 Scanning for duplicate services...\n");

  const duplicates: DuplicateGroup[] = [];

  // 1. Exact name duplicates
  console.log("1️⃣ Checking for exact name duplicates...");
  const exactNameDupes = await db.execute(sql`
    SELECT lower(trim(name)) as name, array_agg(service_id) as service_ids, array_agg(name) as names, array_agg(location) as locations, count(*) as cnt
    FROM services
    WHERE is_active = true
    GROUP BY lower(trim(name))
    HAVING count(*) > 1
    ORDER BY count(*) DESC
  `);

  for (const row of exactNameDupes.rows as any[]) {
    duplicates.push({
      type: "EXACT_NAME",
      matchValue: row.names[0],
      services: row.service_ids.map((id: string, i: number) => ({
        serviceId: id,
        name: row.names[i],
        location: row.locations[i],
      })),
    });
  }
  console.log(`   Found ${exactNameDupes.rows.length} groups with exact name matches\n`);

  // 2. Similar names (using trigram similarity)
  console.log("2️⃣ Checking for similar names (>80% similarity)...");
  let similarNames = { rows: [] as any[] };
  try {
    similarNames = await db.execute(sql`
      SELECT
        a.service_id as id1, a.name as name1, a.location as loc1,
        b.service_id as id2, b.name as name2, b.location as loc2,
        similarity(lower(a.name), lower(b.name)) as sim
      FROM services a
      JOIN services b ON a.id < b.id
      WHERE a.is_active = true AND b.is_active = true
        AND similarity(lower(a.name), lower(b.name)) > 0.8
        AND a.service_id != b.service_id
      ORDER BY sim DESC
      LIMIT 50
    `);

    for (const row of similarNames.rows as any[]) {
      duplicates.push({
        type: `SIMILAR_NAME (${Math.round(row.sim * 100)}%)`,
        matchValue: `"${row.name1}" ↔ "${row.name2}"`,
        services: [
          { serviceId: row.id1, name: row.name1, location: row.loc1 },
          { serviceId: row.id2, name: row.name2, location: row.loc2 },
        ],
      });
    }
    console.log(`   Found ${similarNames.rows.length} pairs with similar names\n`);
  } catch (err) {
    console.log("   ⚠️ Trigram extension not available, skipping similarity check\n");
  }

  // 3. Same phone number
  console.log("3️⃣ Checking for duplicate phone numbers...");
  const phoneDupes = await db.execute(sql`
    SELECT phone, array_agg(service_id) as service_ids, array_agg(name) as names, array_agg(location) as locations, count(*) as cnt
    FROM services
    WHERE is_active = true AND phone IS NOT NULL AND phone != ''
    GROUP BY phone
    HAVING count(*) > 1
    ORDER BY count(*) DESC
  `);

  for (const row of phoneDupes.rows as any[]) {
    duplicates.push({
      type: "SAME_PHONE",
      matchValue: row.phone,
      services: row.service_ids.map((id: string, i: number) => ({
        serviceId: id,
        name: row.names[i],
        location: row.locations[i],
      })),
    });
  }
  console.log(`   Found ${phoneDupes.rows.length} groups with same phone number\n`);

  // 4. Same website URL
  console.log("4️⃣ Checking for duplicate website URLs...");
  const websiteDupes = await db.execute(sql`
    SELECT lower(trim(website_url)) as website_url, array_agg(service_id) as service_ids, array_agg(name) as names, array_agg(location) as locations, count(*) as cnt
    FROM services
    WHERE is_active = true AND website_url IS NOT NULL AND website_url != ''
    GROUP BY lower(trim(website_url))
    HAVING count(*) > 1
    ORDER BY count(*) DESC
  `);

  for (const row of websiteDupes.rows as any[]) {
    duplicates.push({
      type: "SAME_WEBSITE",
      matchValue: row.website_url.substring(0, 60) + (row.website_url.length > 60 ? "..." : ""),
      services: row.service_ids.map((id: string, i: number) => ({
        serviceId: id,
        name: row.names[i],
        location: row.locations[i],
      })),
    });
  }
  console.log(`   Found ${websiteDupes.rows.length} groups with same website URL\n`);

  // 5. Same address
  console.log("5️⃣ Checking for duplicate addresses...");
  const addressDupes = await db.execute(sql`
    SELECT lower(trim(address)) as address, array_agg(service_id) as service_ids, array_agg(name) as names, array_agg(location) as locations, count(*) as cnt
    FROM services
    WHERE is_active = true AND address IS NOT NULL AND address != ''
    GROUP BY lower(trim(address))
    HAVING count(*) > 1
    ORDER BY count(*) DESC
    LIMIT 30
  `);

  for (const row of addressDupes.rows as any[]) {
    duplicates.push({
      type: "SAME_ADDRESS",
      matchValue: row.address.substring(0, 80) + (row.address.length > 80 ? "..." : ""),
      services: row.service_ids.map((id: string, i: number) => ({
        serviceId: id,
        name: row.names[i],
        location: row.locations[i],
      })),
    });
  }
  console.log(`   Found ${addressDupes.rows.length} groups with same address\n`);

  // 6. Check for empty/low-quality records
  console.log("6️⃣ Checking for low-quality records...");
  const lowQuality = await db.execute(sql`
    SELECT
      service_id, name, location,
      CASE
        WHEN description IS NULL OR description = '' THEN 'NO_DESCRIPTION'
        WHEN phone IS NULL AND email IS NULL AND contact IS NULL THEN 'NO_CONTACT'
        WHEN location IS NULL OR location = '' THEN 'NO_LOCATION'
      END as issue
    FROM services
    WHERE is_active = true
      AND (
        (description IS NULL OR description = '')
        OR (phone IS NULL AND email IS NULL AND (contact IS NULL OR contact = ''))
        OR (location IS NULL OR location = '')
      )
    ORDER BY issue, name
    LIMIT 50
  `);

  console.log(`   Found ${lowQuality.rows.length} low-quality records\n`);

  // Print results
  console.log("=".repeat(80));
  console.log("📊 DUPLICATE DETECTION RESULTS");
  console.log("=".repeat(80));

  // Summary counts
  const exactNameCount = duplicates.filter((d) => d.type === "EXACT_NAME").length;
  const similarNameCount = duplicates.filter((d) => d.type.startsWith("SIMILAR_NAME")).length;
  const phoneCount = duplicates.filter((d) => d.type === "SAME_PHONE").length;
  const websiteCount = duplicates.filter((d) => d.type === "SAME_WEBSITE").length;
  const addressCount = duplicates.filter((d) => d.type === "SAME_ADDRESS").length;

  console.log(`\n📈 SUMMARY:`);
  console.log(`   • Exact name duplicates: ${exactNameCount} groups`);
  console.log(`   • Similar name pairs: ${similarNameCount} pairs`);
  console.log(`   • Same phone number: ${phoneCount} groups`);
  console.log(`   • Same website URL: ${websiteCount} groups`);
  console.log(`   • Same address: ${addressCount} groups`);
  console.log(`   • Low-quality records: ${lowQuality.rows.length}`);

  // Detailed output
  if (duplicates.length > 0) {
    console.log(`\n${"─".repeat(80)}`);
    console.log("📋 DETAILED DUPLICATE GROUPS:");
    console.log("─".repeat(80));

    for (const dup of duplicates) {
      console.log(`\n[${dup.type}] ${dup.matchValue}`);
      for (const svc of dup.services) {
        console.log(`   • ${svc.serviceId}: "${svc.name}" (${svc.location || "No location"})`);
      }
    }
  }

  if (lowQuality.rows.length > 0) {
    console.log(`\n${"─".repeat(80)}`);
    console.log("⚠️ LOW-QUALITY RECORDS:");
    console.log("─".repeat(80));

    for (const row of lowQuality.rows as any[]) {
      console.log(`   [${row.issue}] ${row.service_id}: "${row.name}"`);
    }
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log("✅ Scan complete!");

  await pool.end();
  process.exit(0);
}

detectDuplicates().catch((err) => {
  console.error("Error running duplicate detection:", err);
  process.exit(1);
});
