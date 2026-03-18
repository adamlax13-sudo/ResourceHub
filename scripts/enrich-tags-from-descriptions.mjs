/**
 * Description-to-Tag Extraction Script
 *
 * Scans active service descriptions for keywords not present in tags, adds them.
 * Closes keyword coverage gaps for search (respite, donation, self-harm, outreach, etc.)
 *
 * Run (preview):  node scripts/enrich-tags-from-descriptions.mjs
 * Run (apply):    DRY_RUN=false node scripts/enrich-tags-from-descriptions.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DRY_RUN = process.env.DRY_RUN !== 'false';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Keywords to extract from descriptions into tags
// Format: [regex, tag_to_add]
const KEYWORD_EXTRACTIONS = [
  // Service modalities (biggest gaps: 63 outreach, 13 walk-in, 11 virtual)
  [/\boutreach\b/i, 'outreach'],
  [/\bdrop[- ]in\b/i, 'drop-in'],
  [/\bwalk[- ]in\b/i, 'walk-in'],
  [/\bmobile\b/i, 'mobile'],
  [/\bvirtual\b/i, 'virtual'],
  [/\bonline\b/i, 'online'],
  [/\b24\/7\b|\b24 hours?\b|\btwenty[- ]four hour/i, '24/7'],

  // Cost/access (45 gap for "free")
  [/\bfree\b/i, 'free'],
  [/\bsliding scale/i, 'sliding scale'],
  [/\bno[- ]cost\b|\bno charge\b/i, 'free'],
  [/\blow[- ]cost\b/i, 'low-cost'],
  [/\bsubsidized\b/i, 'subsidized'],

  // Caregiver/respite (21 + 11 gap)
  [/\bcaregiver\b/i, 'caregiver'],
  [/\brespite\b/i, 'respite'],

  // Basic needs specifics (19 gap for donation)
  [/\bdonat(?:e|ion|ions|ed)\b/i, 'donation'],
  [/\bsoup kitchen\b/i, 'soup kitchen'],
  [/\bclothing bank\b|\bclothing closet\b/i, 'clothing bank'],
  [/\bfood hamper\b/i, 'food hamper'],
  [/\bfurniture\b/i, 'furniture'],
  [/\bhygiene\b|\btoiletries\b/i, 'hygiene supplies'],

  // Crisis/mental health specifics (3 gap for self-harm)
  [/\bself[- ]harm\b/i, 'self-harm'],
  [/\bsuicid(?:e|al)\b/i, 'suicide prevention'],
  [/\btrauma\b/i, 'trauma'],
  [/\bPTSD\b/i, 'PTSD'],

  // Substance-specific
  [/\bmethadone\b/i, 'methadone'],
  [/\bsuboxone\b/i, 'suboxone'],
  [/\bopioid\b/i, 'opioid'],
  [/\bnaloxone\b|\bnarcan\b/i, 'naloxone'],
  [/\bharm reduction\b/i, 'harm reduction'],
  [/\b12[- ]step\b/i, '12-step'],

  // Demographics
  [/\bLGBTQ/i, 'LGBTQ+'],
  [/\bindigenous\b|\bFirst Nations\b|\bMétis\b|\bInuit\b/i, 'indigenous'],
  [/\bnewcomer\b|\bimmigrant\b|\brefugee\b/i, 'newcomer'],
  [/\bveteran\b/i, 'veteran'],

  // Service types
  [/\bpeer support\b/i, 'peer support'],
  [/\bsupport group\b/i, 'support group'],
  [/\bcounsell/i, 'counselling'],
  [/\btherapy\b|\btherapist\b/i, 'therapy'],
  [/\bhousing\b/i, 'housing'],
];

async function main() {
  console.log(`[TagEnrich] Mode: ${DRY_RUN ? 'DRY RUN (preview)' : 'LIVE (will update DB)'}\n`);

  const { rows: services } = await pool.query(`
    SELECT service_id, name, description, tags
    FROM services
    WHERE is_active = true AND description IS NOT NULL AND length(description) > 20
    ORDER BY service_id
  `);

  console.log(`[TagEnrich] Scanning ${services.length} active services...\n`);

  let totalUpdated = 0;
  let totalTagsAdded = 0;
  const affectedIds = [];

  for (const svc of services) {
    const existingTags = Array.isArray(svc.tags) ? svc.tags : [];
    const existingLower = new Set(existingTags.map(t => t.toLowerCase()));
    const newTags = [];

    for (const [regex, tag] of KEYWORD_EXTRACTIONS) {
      if (regex.test(svc.description) && !existingLower.has(tag.toLowerCase())) {
        newTags.push(tag);
        existingLower.add(tag.toLowerCase());
      }
    }

    if (newTags.length === 0) continue;

    totalUpdated++;
    totalTagsAdded += newTags.length;
    affectedIds.push(svc.service_id);
    const merged = [...existingTags, ...newTags];

    if (DRY_RUN) {
      console.log(`  ${svc.service_id}: +${newTags.length} tags → [${newTags.join(', ')}]`);
    } else {
      await pool.query(
        `UPDATE services SET tags = $1::jsonb WHERE service_id = $2`,
        [JSON.stringify(merged), svc.service_id]
      );
    }
  }

  console.log(`\n[TagEnrich] Summary: ${totalUpdated} services would be updated, ${totalTagsAdded} tags added`);
  if (DRY_RUN) {
    console.log(`[TagEnrich] Re-run with DRY_RUN=false to apply changes`);
  } else {
    console.log(`[TagEnrich] ✓ ${totalUpdated} services updated in database`);
    console.log(`[TagEnrich] Next steps:`);
    console.log(`  1. Refresh search view: node scripts/refresh-search-view.mjs`);
    console.log(`  2. Regen embeddings for affected services (or full regen via admin)`);
  }

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
