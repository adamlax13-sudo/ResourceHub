/**
 * Normalize location field values to city names.
 * Full addresses are moved to the `address` field; location becomes just the city.
 *
 * DRY_RUN=true by default. Run with DRY_RUN=false to apply changes.
 *
 * Usage:
 *   node scripts/normalize-locations.mjs          # dry run
 *   DRY_RUN=false node scripts/normalize-locations.mjs  # apply
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DRY_RUN = process.env.DRY_RUN !== 'false';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Known Alberta cities/towns for extraction from addresses
const KNOWN_CITIES = [
  'Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'Grande Prairie',
  'Medicine Hat', 'Fort McMurray', 'Airdrie', 'St. Albert', 'Sherwood Park',
  'Spruce Grove', 'Leduc', 'Camrose', 'Brooks', 'Lloydminster',
  'Cold Lake', 'Wetaskiwin', 'Okotoks', 'Cochrane', 'Stony Plain',
  'Canmore', 'Banff', 'Jasper', 'Drumheller', 'Peace River',
  'High River', 'Hinton', 'Ponoka', 'Olds', 'Innisfail',
  'Stettler', 'Vermilion', 'Lac La Biche', 'Slave Lake', 'Athabasca',
  'Drayton Valley', 'Sylvan Lake', 'Strathmore', 'Beaumont', 'Lacombe',
  'Taber', 'Edson', 'Whitecourt', 'Rocky Mountain House', 'Crowsnest Pass',
  'Morinville', 'Wainwright', 'Bonnyville', 'Claresholm', 'Cardston',
  'Pincher Creek', 'Fort Saskatchewan', 'Devon',
];

// Special mappings for known non-standard locations
const SPECIAL_MAPPINGS = {
  'Alberta (Province-wide)': 'Alberta',
  'Canada-wide': 'Alberta',        // Treat national as province for filtering
  'Calgary - multiple locations': 'Calgary',
  'Edmonton area': 'Edmonton',
  'University of Calgary': 'Calgary',
  'University of Alberta': 'Edmonton',
  'Blood Reserve': 'Blood Reserve', // Keep as-is (Indigenous community)
};

function extractCity(location) {
  // Check special mappings first
  if (SPECIAL_MAPPINGS[location]) return SPECIAL_MAPPINGS[location];

  // Already a known city name (case-insensitive)
  const match = KNOWN_CITIES.find(c => c.toLowerCase() === location.toLowerCase().replace(/, ab$/i, '').trim());
  if (match) return match;

  // Try to extract city from address patterns like "123 Street, City, AB T1X 2Y3"
  for (const city of KNOWN_CITIES) {
    const cityPattern = new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (cityPattern.test(location)) return city;
  }

  // Match "CITY, AB" pattern (all caps)
  const capsMatch = location.match(/^([A-Z][A-Z\s]+),?\s*AB$/i);
  if (capsMatch) {
    const name = capsMatch[1].trim();
    // Title-case it
    const titleCased = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    const knownMatch = KNOWN_CITIES.find(c => c.toLowerCase() === titleCased.toLowerCase());
    return knownMatch || titleCased;
  }

  return null; // Can't determine city
}

async function main() {
  console.log(`\n=== Location Normalization ${DRY_RUN ? '(DRY RUN)' : '(APPLYING CHANGES)'} ===\n`);

  const { rows } = await pool.query(`
    SELECT id, service_id, location, address
    FROM services
    WHERE is_active = true AND location IS NOT NULL
    ORDER BY location
  `);

  // Already-normalized cities we should skip
  const alreadyNormalized = new Set([...KNOWN_CITIES.map(c => c.toLowerCase()), 'alberta']);

  let updated = 0;
  let skipped = 0;
  let unresolved = [];

  for (const row of rows) {
    const loc = row.location.trim();

    // Skip if already a known city name
    if (alreadyNormalized.has(loc.toLowerCase())) {
      skipped++;
      continue;
    }

    const city = extractCity(loc);
    if (!city) {
      unresolved.push({ id: row.id, serviceId: row.service_id, location: loc });
      continue;
    }

    // If location is already the city, skip
    if (city.toLowerCase() === loc.toLowerCase()) {
      skipped++;
      continue;
    }

    // Determine if the current location looks like a full address
    const isAddress = /\d/.test(loc) || loc.includes(',');

    // Only update address if the service doesn't already have one and the location looks like an address
    const shouldUpdateAddress = isAddress && (!row.address || row.address.trim() === '');

    console.log(`  [${row.service_id}] "${loc}" → location: "${city}"${shouldUpdateAddress ? `, address: "${loc}"` : ''}`);

    if (!DRY_RUN) {
      if (shouldUpdateAddress) {
        await pool.query(
          `UPDATE services SET location = $1, address = $2 WHERE id = $3`,
          [city, loc, row.id]
        );
      } else {
        await pool.query(
          `UPDATE services SET location = $1 WHERE id = $2`,
          [city, row.id]
        );
      }
    }
    updated++;
  }

  console.log(`\n=== Summary ===`);
  console.log(`  Normalized: ${updated}`);
  console.log(`  Already OK: ${skipped}`);
  console.log(`  Unresolved: ${unresolved.length}`);

  if (unresolved.length > 0) {
    console.log(`\n  Unresolved locations (need manual review):`);
    for (const u of unresolved.slice(0, 20)) {
      console.log(`    [${u.serviceId}] "${u.location}"`);
    }
    if (unresolved.length > 20) {
      console.log(`    ... and ${unresolved.length - 20} more`);
    }
  }

  if (DRY_RUN) {
    console.log(`\n  ⚠️  DRY RUN — no changes made. Run with DRY_RUN=false to apply.\n`);
  } else {
    console.log(`\n  ✅ Changes applied.\n`);
  }

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
