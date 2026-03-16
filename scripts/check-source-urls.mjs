/**
 * URL health checker + source_urls backfill for services missing source_urls.
 *
 * For each active service with no source_urls:
 *   1. If it has a website_url, check if that URL is reachable (HTTP HEAD, fallback GET)
 *   2. If reachable → backfill source_urls = [website_url]
 *   3. If unreachable → log to dead-urls report
 *   4. If no website_url at all → log as "no source"
 *
 * Usage:
 *   node scripts/check-source-urls.mjs                # DRY_RUN (report only)
 *   DRY_RUN=false node scripts/check-source-urls.mjs  # Apply backfill
 *
 * Output: scripts/data/source-url-report.json
 */
import pg from "pg";
const { Pool } = pg;
import "dotenv/config";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));

const DRY_RUN = process.env.DRY_RUN !== "false";
const CONCURRENCY = 10;
const TIMEOUT_MS = 8000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

/**
 * Check if a URL is reachable. Tries HEAD first (fast), falls back to GET.
 * Returns { ok, status, redirectUrl, error }
 */
async function checkUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Try HEAD first (lightweight)
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "ResourceHub-SourceChecker/1.0" },
    });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status, finalUrl: res.url };
  } catch {
    // HEAD failed — try GET (some servers block HEAD)
    const controller2 = new AbortController();
    const timer2 = setTimeout(() => controller2.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "GET",
        signal: controller2.signal,
        redirect: "follow",
        headers: { "User-Agent": "ResourceHub-SourceChecker/1.0" },
      });
      clearTimeout(timer2);
      return { ok: res.ok, status: res.status, finalUrl: res.url };
    } catch (err) {
      clearTimeout(timer2);
      return { ok: false, status: 0, error: err.cause?.code || err.message };
    }
  }
}

/**
 * Process a batch of services concurrently.
 */
async function processBatch(services) {
  return Promise.all(
    services.map(async (svc) => {
      if (!svc.website_url) {
        return { ...svc, result: "no_website" };
      }

      // Normalize URL
      let url = svc.website_url.trim();
      if (!url.startsWith("http")) url = "https://" + url;

      const check = await checkUrl(url);

      if (check.ok) {
        return { ...svc, result: "reachable", status: check.status, checkedUrl: url };
      } else {
        return {
          ...svc,
          result: "unreachable",
          status: check.status,
          error: check.error || `HTTP ${check.status}`,
          checkedUrl: url,
        };
      }
    })
  );
}

async function main() {
  const client = await pool.connect();
  try {
    // Get all active services with no source_urls
    const { rows: services } = await client.query(`
      SELECT id, name, category, website_url, confidence_score, location
      FROM services
      WHERE is_active = true
        AND (source_urls IS NULL OR source_urls = '[]' OR source_urls = 'null')
      ORDER BY confidence_score ASC NULLS FIRST, id
    `);

    console.log(`Found ${services.length} active services with no source_urls. DRY_RUN=${DRY_RUN}\n`);

    const report = {
      timestamp: new Date().toISOString(),
      total: services.length,
      reachable: [],
      unreachable: [],
      no_website: [],
    };

    // Process in batches
    let backfilled = 0;
    for (let i = 0; i < services.length; i += CONCURRENCY) {
      const batch = services.slice(i, i + CONCURRENCY);
      const results = await processBatch(batch);

      for (const r of results) {
        const entry = {
          id: r.id,
          name: r.name,
          category: r.category,
          location: r.location,
          confidence_score: r.confidence_score,
          website_url: r.website_url,
        };

        if (r.result === "reachable") {
          report.reachable.push(entry);

          if (!DRY_RUN) {
            await client.query(
              `UPDATE services SET source_urls = $1, last_updated = NOW() WHERE id = $2`,
              [JSON.stringify([r.checkedUrl]), r.id]
            );
          }
          backfilled++;
        } else if (r.result === "unreachable") {
          report.unreachable.push({ ...entry, error: r.error, status: r.status });
        } else {
          report.no_website.push(entry);
        }
      }

      // Progress indicator every 50
      if ((i + CONCURRENCY) % 50 === 0 || i + CONCURRENCY >= services.length) {
        const done = Math.min(i + CONCURRENCY, services.length);
        console.log(`  Checked ${done}/${services.length}...`);
      }
    }

    // Summary
    console.log(`\n=== SUMMARY ===`);
    console.log(`  Reachable (backfill-ready): ${report.reachable.length}`);
    console.log(`  Unreachable (need review):  ${report.unreachable.length}`);
    console.log(`  No website_url at all:      ${report.no_website.length}`);

    if (!DRY_RUN) {
      console.log(`\n  Backfilled source_urls: ${backfilled}`);
    }

    // Write report
    const reportPath = join(__dir, "data", "source-url-report.json");
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\nReport written to: ${reportPath}`);

    if (DRY_RUN) console.log("\n(DRY RUN — run with DRY_RUN=false to backfill source_urls.)");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
