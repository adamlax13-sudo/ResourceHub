/**
 * Clear coordinates from virtual/province-wide services that have no physical address.
 *
 * These services were incorrectly geocoded to Alberta's centroid or random points
 * because their location field says "Alberta (province-wide)", "Virtual", "Online", etc.
 * but they have no street address. The map pins are misleading.
 *
 * Services with a city anchor (e.g. "Edmonton (province-wide)") are KEPT —
 * they have a physical base even if they serve province-wide.
 *
 * DRY_RUN by default. Pass --execute to apply changes.
 */

import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const DRY_RUN = !process.argv.includes("--execute");
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== EXECUTING ===");

  // Find virtual/province-wide services with no address that were geocoded.
  // Exclude services that have a specific city anchor in their location field
  // (e.g. "Edmonton (province-wide)" or "Calgary (Foothills Medical Centre)")
  const { rows } = await pool.query(`
    SELECT id, name, location, latitude, longitude
    FROM services
    WHERE is_active = true
      AND latitude IS NOT NULL
      AND (address IS NULL OR TRIM(address) = '')
      AND (
        -- Province-wide / Alberta-wide with no city prefix
        location ILIKE 'alberta%'
        OR location ILIKE 'province%'
        OR location ILIKE 'serving alberta%'
        OR location ILIKE '%alberta-wide%'
        -- Virtual / online / phone-only
        OR location ILIKE 'virtual%'
        OR location ILIKE 'online%'
        OR location ILIKE '%phone%'
        OR location ILIKE '%toll%'
      )
      AND NOT (
        -- Keep city-anchored services (city name before parenthetical)
        location ~* '^(calgary|edmonton|red deer|lethbridge|medicine hat|grande prairie|fort mcmurray|st\\.? albert|sherwood park|airdrie|spruce grove|cold lake|camrose|wetaskiwin|lloydminster|brooks|canmore|banff|cochrane|okotoks|stony plain|leduc|beaumont|sylvan lake|hinton|drayton valley)'
        -- Keep services at specific facilities
        OR location ILIKE '%(hospital)%'
        OR location ILIKE '%(centre)%'
        OR location ILIKE '%(center)%'
        OR location ILIKE '%(clinic)%'
        OR location ILIKE '%HQ%'
      )
    ORDER BY name
  `);

  console.log(`\nFound ${rows.length} virtual/province-wide services with misleading pins:\n`);

  for (const svc of rows) {
    console.log(`  [${svc.id}] ${svc.name}`);
    console.log(`       location: ${svc.location}`);
    console.log(`       coords:   ${svc.latitude}, ${svc.longitude}`);
  }

  if (DRY_RUN) {
    console.log(`\n${rows.length} services would have coordinates cleared.`);
    console.log("Run with --execute to apply changes.");
  } else {
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) {
      console.log("\nNo services to update.");
    } else {
      const result = await pool.query(
        `UPDATE services
         SET latitude = NULL, longitude = NULL, geocode_source = NULL, geocoded_at = NULL
         WHERE id = ANY($1::int[])`,
        [ids]
      );
      console.log(`\nCleared coordinates from ${result.rowCount} services.`);
    }
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
