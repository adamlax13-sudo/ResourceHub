#!/usr/bin/env node
/**
 * Batch Geocode Services
 *
 * Geocodes all active services that have an address or location but no
 * latitude/longitude using the Mapbox Geocoding API. Results are constrained
 * to Alberta via bounding box.
 *
 * Run:
 *   node scripts/batch-geocode-services.mjs                  # DRY_RUN preview
 *   DRY_RUN=false node scripts/batch-geocode-services.mjs    # actually write
 *
 * Requires DATABASE_URL and MAPBOX_SECRET_TOKEN in env.
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DRY_RUN = process.env.DRY_RUN !== 'false';
const MAPBOX_TOKEN = process.env.MAPBOX_SECRET_TOKEN;
const RATE_LIMIT_MS = 100; // 10 req/sec (Mapbox free tier allows 600/min)
const MIN_RELEVANCE = 0.6; // Skip low-confidence geocoding results
const ALBERTA_BBOX = '-120.0,49.0,-110.0,60.0';
const MAPBOX_BASE_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

if (!MAPBOX_TOKEN) {
  console.error('ERROR: MAPBOX_SECRET_TOKEN environment variable is required');
  console.error('Get a secret token from https://account.mapbox.com/access-tokens/');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function sanitizeQuery(text) {
  return text
    .replace(/[`"\\<>]/g, '')
    .replace(/\n/g, ' ')
    .trim()
    .slice(0, 200);
}

function buildGeocodingQuery(service) {
  // Prefer full address over city name
  if (service.address && service.address.trim().length > 5) {
    return sanitizeQuery(service.address);
  }
  if (service.location && service.location.trim().length > 0) {
    return sanitizeQuery(`${service.location}, Alberta, Canada`);
  }
  return null;
}

async function geocodeAddress(query) {
  const url = `${MAPBOX_BASE_URL}/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=ca&bbox=${ALBERTA_BBOX}&limit=1`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Mapbox API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.features || data.features.length === 0) {
    return null;
  }

  const feature = data.features[0];
  return {
    latitude: feature.center[1],
    longitude: feature.center[0],
    relevance: feature.relevance,
    placeName: feature.place_name,
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log(`Batch geocoding services (DRY_RUN=${DRY_RUN})`);
  console.log(`Min relevance: ${MIN_RELEVANCE}, Rate limit: ${RATE_LIMIT_MS}ms\n`);

  // Get services that need geocoding (skip crisis lines — they're phone services, not physical locations)
  const { rows: services } = await pool.query(`
    SELECT id, service_id, name, address, location, category
    FROM services
    WHERE is_active = true
      AND latitude IS NULL
      AND (address IS NOT NULL OR location IS NOT NULL)
      AND category != 'Crisis Lines'
      -- Skip virtual/province-wide services with no street address
      AND NOT (
        (address IS NULL OR TRIM(address) = '')
        AND (
          location ILIKE 'alberta%' OR location ILIKE 'province%'
          OR location ILIKE 'serving alberta%' OR location ILIKE '%alberta-wide%'
          OR location ILIKE 'virtual%' OR location ILIKE 'online%'
          OR location ILIKE '%phone%' OR location ILIKE '%toll%'
        )
      )
    ORDER BY id
  `);

  console.log(`Found ${services.length} services to geocode\n`);

  let geocoded = 0;
  let skippedNoQuery = 0;
  let skippedLowRelevance = 0;
  let failed = 0;
  const lowConfidence = [];

  for (const svc of services) {
    const query = buildGeocodingQuery(svc);
    if (!query) {
      skippedNoQuery++;
      continue;
    }

    try {
      const result = await geocodeAddress(query);

      if (!result) {
        console.log(`  [MISS] #${svc.id} "${svc.name}" — no results for "${query}"`);
        failed++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      if (result.relevance < MIN_RELEVANCE) {
        console.log(`  [LOW]  #${svc.id} "${svc.name}" — relevance ${result.relevance.toFixed(2)} < ${MIN_RELEVANCE} (${result.placeName})`);
        lowConfidence.push({ id: svc.id, name: svc.name, relevance: result.relevance, placeName: result.placeName });
        skippedLowRelevance++;
        await sleep(RATE_LIMIT_MS);
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY]  #${svc.id} "${svc.name}" → ${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)} (${result.relevance.toFixed(2)}) — ${result.placeName}`);
      } else {
        await pool.query(
          `UPDATE services SET latitude = $1, longitude = $2, geocode_source = 'mapbox', geocoded_at = NOW() WHERE id = $3`,
          [result.latitude, result.longitude, svc.id]
        );
        console.log(`  [OK]   #${svc.id} "${svc.name}" → ${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`);
      }
      geocoded++;
    } catch (err) {
      console.error(`  [ERR]  #${svc.id} "${svc.name}" — ${err.message}`);
      failed++;
    }

    await sleep(RATE_LIMIT_MS);
  }

  // Summary
  console.log('\n--- Summary ---');
  console.log(`Total services:      ${services.length}`);
  console.log(`Geocoded:            ${geocoded}${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`Skipped (no query):  ${skippedNoQuery}`);
  console.log(`Skipped (low conf):  ${skippedLowRelevance}`);
  console.log(`Failed:              ${failed}`);

  if (lowConfidence.length > 0) {
    console.log('\n--- Low Confidence (manual review) ---');
    for (const lc of lowConfidence) {
      console.log(`  #${lc.id} "${lc.name}" — relevance ${lc.relevance.toFixed(2)} → ${lc.placeName}`);
    }
  }

  if (!DRY_RUN && geocoded > 0) {
    console.log('\nRefreshing materialized view...');
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_service_search');
    console.log('Done.');
  }

  await pool.end();
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
