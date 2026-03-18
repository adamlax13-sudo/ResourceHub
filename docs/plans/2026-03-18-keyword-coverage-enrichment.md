# Keyword Coverage Enrichment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close keyword coverage gaps in service tags and descriptions so searches find relevant services even when users use different terminology than what's in the database.

**Architecture:** A two-pronged approach: (1) a deterministic tag enrichment script that extracts missing keywords from descriptions into tags, and (2) a search-layer keyword expansion system that maps common search terms to service terminology without modifying data. Both approaches are safe — tags are additive, and keyword expansion only affects search, not stored data.

**Tech Stack:** Node.js `.mjs` scripts with `pg` for direct DB access, server-side keyword expansion in `server/helpers/keywords.ts`

---

## Problem Statement

The CI evaluation (52 queries, 98/100 avg) identifies 3 queries scoring 93/100 due to missing keyword patterns in the top 10 results:

| Query | Missing Pattern | Root Cause |
|-------|----------------|------------|
| "help caring for elderly parent" | `respite` | 11 services mention "respite" in description but not tags |
| "I need clothing and household items" | `donation` | 19 services mention donate/donation in description but not tags |
| "my teenager is self-harming" | `self-harm` | Only 4 services mention self-harm anywhere; 3 have it in description but not tags |

Beyond these 3, a broader analysis reveals significant desc-to-tag gaps:

| Keyword | In Description, NOT in Tags | Impact |
|---------|----------------------------|--------|
| outreach | 63 services | Service modality visibility |
| free | 45 services | Cost/access queries |
| caregiver | 21 services | Caregiver support queries |
| donation | 19 services | Basic needs queries |
| walk-in | 13 services | Access format queries |
| virtual | 11 services | Format preference queries |
| respite | 11 services | Caregiver queries |
| soup kitchen | 5 services | Food insecurity queries |
| self-harm | 3 services | Crisis/youth mental health |

## Design Decisions

1. **Tags, not descriptions** — Descriptions come from source websites (data integrity rule). Tags are our enrichment layer and are explicitly searched by `fastSearch()`.
2. **Script-based, not AI-generated** — Deterministic regex extraction from existing descriptions. No hallucination risk.
3. **Additive only** — Never remove existing tags. Only add missing ones.
4. **DRY_RUN default** — All scripts default to preview mode. Must pass `DRY_RUN=false` to apply.
5. **Keyword expansion in search layer** — For terms that don't exist in any service data (e.g., "donation" as a search concept), add expansion mappings so the search pipeline finds related services.

---

### Task 1: Description-to-Tag Extraction Script

Extract keywords from service descriptions that are missing from tags. This is the highest-impact change — closes 200+ gaps across all categories.

**Files:**
- Create: `scripts/enrich-tags-from-descriptions.mjs`
- Reference: `scripts/archive/enrich-tags-batch1.mjs` (prior art for pattern)

- [ ] **Step 1: Create the enrichment script**

```javascript
// scripts/enrich-tags-from-descriptions.mjs
// Scans active service descriptions for keywords not present in tags, adds them.
// Run: node scripts/enrich-tags-from-descriptions.mjs
// Apply: DRY_RUN=false node scripts/enrich-tags-from-descriptions.mjs

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
  // Service modalities (biggest gaps)
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
  console.log(`[TagEnrich] Mode: ${DRY_RUN ? 'DRY RUN (preview)' : 'LIVE (will update DB)'}`);

  const { rows: services } = await pool.query(`
    SELECT service_id, name, description, tags::text as tags_text, tags
    FROM services
    WHERE is_active = true AND description IS NOT NULL AND length(description) > 20
    ORDER BY service_id
  `);

  let totalUpdated = 0;
  let totalTagsAdded = 0;

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

  console.log(`\n[TagEnrich] Summary: ${totalUpdated} services updated, ${totalTagsAdded} tags added`);
  if (DRY_RUN) console.log(`[TagEnrich] Re-run with DRY_RUN=false to apply changes`);

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run in dry-run mode to preview changes**

Run: `node scripts/enrich-tags-from-descriptions.mjs`
Expected: List of services and new tags, summary showing ~200+ services affected

- [ ] **Step 3: Review dry-run output for correctness**

Spot-check:
- Services getting "free" tag — do they actually offer free services? (watch for "free parking" false positives)
- Services getting "self-harm" tag — are these crisis/mental health services?
- Services getting "caregiver" tag — are these support services, not just mentioning caregivers?

If false positives found, adjust the regex patterns (e.g., `\bfree\s+(?:of charge|services?|program|counselling|support)\b` instead of just `\bfree\b`).

- [ ] **Step 4: Apply changes**

Run: `DRY_RUN=false node scripts/enrich-tags-from-descriptions.mjs`
Expected: Same count as dry-run, tags now in DB

- [ ] **Step 5: Regenerate embeddings for affected services**

Tags feed into embeddings — updated tags need fresh embeddings for semantic search.

Run: `node scripts/regen-embeddings-by-id.mjs <affected_service_ids>`

Note: If >100 services affected, use the admin endpoint instead:
`POST /api/admin/system/regenerate-all-embeddings { "dryRun": false }`

- [ ] **Step 6: Refresh materialized view**

Run: `node scripts/refresh-search-view.mjs`

- [ ] **Step 7: Run CI evaluation to measure improvement**

Run: `npm run evaluate:ci`
Expected: Score improvement on "help caring for elderly parent", "I need clothing and household items", "my teenager is self-harming"

- [ ] **Step 8: Commit**

```bash
git add scripts/enrich-tags-from-descriptions.mjs
git commit -m "feat(data): add description-to-tag extraction script

Extracts 35+ keyword patterns from service descriptions into tags,
closing gaps for: respite, donation, self-harm, outreach, free,
caregiver, walk-in, virtual, and more. ~200+ services enriched."
```

---

### Task 2: Search-Layer Keyword Expansion

Some search terms don't appear in any service data at all. Rather than modifying service data, expand these terms at search time so the SQL/semantic pipeline finds related services.

**Files:**
- Modify: `server/helpers/keywords.ts` (existing keyword expansion system)

- [ ] **Step 1: Read the current keyword expansion system**

Read: `server/helpers/keywords.ts` — find the `expandKeywords()` function and the existing synonym/expansion mappings.

- [ ] **Step 2: Add missing search term expansions**

Add these mappings to the existing expansion dictionary in `server/helpers/keywords.ts`:

```typescript
// New expansions for CI coverage gaps
'respite': ['caregiver', 'caregiver support', 'relief', 'break'],
'donation': ['free', 'donate', 'clothing bank', 'furniture', 'hamper'],
'self-harm': ['self-injury', 'cutting', 'crisis', 'suicide prevention', 'mental health'],
'soup kitchen': ['meals', 'food', 'drop-in', 'hot meals', 'community meals'],
```

These go in the existing synonym/expansion map structure. The `expandKeywords()` function is called via `getExpandedKeywords()` in `server/search/analyzer.ts:527`, which feeds into the SQL query in `comprehensive.ts`.

- [ ] **Step 3: Run CI evaluation to verify improvement**

Run: `npm run evaluate:ci`
Expected: The 3 queries at 93/100 should now score higher (ideally 100/100)

- [ ] **Step 4: Commit**

```bash
git add server/helpers/keywords.ts
git commit -m "feat(search): expand keyword synonyms for coverage gaps

Adds search-time expansions for respite, donation, self-harm,
and soup kitchen so queries find relevant services even when
exact terms aren't in service data."
```

---

### Task 3: Weak-Tag Services Audit & Fix

Some services have very few tags (<5) or tags that don't reflect their actual services. This task identifies and fixes the worst offenders.

**Files:**
- Create: `scripts/audit-weak-tags.mjs`

- [ ] **Step 1: Create the audit script**

```javascript
// scripts/audit-weak-tags.mjs
// Finds active services with fewer than 5 tags and generates suggested additions.
// Run: node scripts/audit-weak-tags.mjs

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  // Services with fewer than 5 tags
  const { rows } = await pool.query(`
    SELECT service_id, name, category,
           jsonb_array_length(tags) as tag_count,
           tags::text as tags_text,
           substring(description, 1, 200) as desc_preview
    FROM services
    WHERE is_active = true
      AND jsonb_array_length(tags) < 5
    ORDER BY jsonb_array_length(tags) ASC, category
  `);

  console.log(`Found ${rows.length} services with fewer than 5 tags:\n`);

  for (const svc of rows) {
    console.log(`[${svc.tag_count} tags] ${svc.name}`);
    console.log(`  Category: ${svc.category}`);
    console.log(`  Tags: ${svc.tags_text}`);
    console.log(`  Desc: ${svc.desc_preview}`);
    console.log();
  }

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Run the audit and review output**

Run: `node scripts/audit-weak-tags.mjs`
Expected: List of services with <5 tags grouped by severity

- [ ] **Step 3: Fix weak-tag services using bulk-update script**

For each batch of weak-tag services, create a JSON data file and use the existing bulk-update infrastructure:

```bash
node scripts/bulk-update-services.mjs scripts/data/tag-fixes.json
```

The JSON file format (matches `bulk-update-services.mjs` which uses `u.id` and `u.fields`):
```json
[
  {
    "id": 123,
    "fields": {
      "tags": ["existing-tag-1", "existing-tag-2", "new-tag-1", "new-tag-2", "new-tag-3"]
    },
    "reason": "Tag enrichment: added missing keywords from description"
  }
]
```

Note: `id` is the integer primary key (not `serviceId`). Query with:
`SELECT id, service_id, name FROM services WHERE service_id = 'slug-here'`

- [ ] **Step 4: Refresh search view after fixes**

Run: `node scripts/refresh-search-view.mjs`

- [ ] **Step 5: Commit**

```bash
git add scripts/audit-weak-tags.mjs scripts/data/tag-fixes.json
git commit -m "fix(data): enrich weak-tag services (<5 tags)

Audit found N services with fewer than 5 tags. Added category-
appropriate tags extracted from descriptions and category context."
```

---

### Task 4: Hospital & Emergency Description Enrichment

Hospital & Emergency services have the shortest average descriptions (182 chars) and often lack contextual keywords. These need richer descriptions from their source websites.

**Files:**
- Create: `scripts/data/hospital-enrichments.json`
- Use existing: `scripts/bulk-update-services.mjs`

- [ ] **Step 1: Query hospital services needing enrichment**

```sql
SELECT service_id, name, length(description) as desc_len,
       substring(description, 1, 100) as desc_preview,
       website_url, source_urls
FROM services
WHERE is_active = true
  AND category IN ('Hospital & Emergency', 'Healthcare Access')
  AND length(description) < 200
ORDER BY length(description) ASC;
```

- [ ] **Step 2: Enrich descriptions from source websites**

For each service with a short description:
1. Visit the `website_url` or `source_urls`
2. Extract a factual 2-3 sentence description of services offered
3. Include: department types, emergency capabilities, hours, accessibility

**Data integrity rule:** All description text must come from the actual service website — never AI-generated.

- [ ] **Step 3: Create enrichment data file**

Create `scripts/data/hospital-enrichments.json` with the format:
```json
[
  {
    "serviceId": "hospital-id",
    "description": "Factual description from website...",
    "tags": ["hospital", "emergency", "24/7", "specific-department-tags"]
  }
]
```

- [ ] **Step 4: Apply enrichments**

Run: `DRY_RUN=false node scripts/bulk-update-services.mjs scripts/data/hospital-enrichments.json`

- [ ] **Step 5: Refresh search view and regenerate embeddings**

```bash
node scripts/refresh-search-view.mjs
node scripts/regen-embeddings-by-id.mjs <affected_ids>
```

- [ ] **Step 6: Run CI evaluation**

Run: `npm run evaluate:ci`
Expected: Healthcare queries maintain or improve scores

- [ ] **Step 7: Commit**

```bash
git add scripts/data/hospital-enrichments.json
git commit -m "fix(data): enrich hospital service descriptions

Updated N hospital/healthcare services with richer descriptions
from source websites. Avg description length: 182 → ~300 chars."
```

---

### Task 5: CI Test Expansion for New Coverage

Add new CI test queries to prevent future regressions on the patterns we just fixed.

**Files:**
- Modify: `server/evaluation/ci_runner.mjs`

- [ ] **Step 1: Add new test queries targeting previously weak patterns**

Add to the `QUERIES` array in `server/evaluation/ci_runner.mjs`:

```javascript
// CAREGIVER (expanded — respite was missing)
{ query: "respite care for caregivers", intent: "caregiver_support", expectedPatterns: ["respite", "caregiver", "support"] },
// BASIC NEEDS (expanded — donation was missing)
{ query: "where to donate clothing Calgary", intent: "basic_needs", expectedPatterns: ["clothing", "donation", "free"] },
{ query: "free baby supplies", intent: "parenting_support", expectedPatterns: ["baby", "free", "supplies", "hamper"] },
// CRISIS (expanded — self-harm was missing)
{ query: "teen cutting and self-injury", intent: "mental_health", expectedPatterns: ["self-harm", "youth", "crisis", "mental health"] },
// SUBSTANCE-SPECIFIC
{ query: "methadone clinic Edmonton", location: "Edmonton", intent: "substance_abuse", expectedPatterns: ["methadone", "opioid"] },
// FORMAT-SPECIFIC
{ query: "online counselling Alberta", intent: "mental_health", expectedPatterns: ["online", "virtual", "counselling"] },
{ query: "free walk-in clinic Calgary", location: "Calgary", intent: "healthcare_access", expectedPatterns: ["walk-in", "free", "clinic"] },
```

- [ ] **Step 2: Run CI evaluation with new queries**

Run: `npm run evaluate:ci`
Expected: All new queries pass at >=60/100, overall average stays >=85/100

- [ ] **Step 3: Commit**

```bash
git add server/evaluation/ci_runner.mjs
git commit -m "test(search): add CI queries for keyword coverage gaps

7 new regression tests covering: respite, donation, self-harm,
methadone, online counselling, walk-in clinic, baby supplies."
```

---

## Implementation Order

| Task | Effort | Impact | Dependencies |
|------|--------|--------|-------------|
| 1. Description-to-tag extraction | Small (script) | High — closes 200+ gaps | None |
| 2. Search keyword expansion | Small (config) | Medium — 4 gap closures | None |
| 3. Weak-tag audit & fix | Medium (manual review) | Medium — improves worst services | After Task 1 |
| 4. Hospital description enrichment | Medium (manual research) | Medium — shortest descriptions | Independent |
| 5. CI test expansion | Small | Regression prevention | After Tasks 1-2 |

Tasks 1 and 2 are independent and can run in parallel. Task 3 should run after Task 1 (the extraction script closes many weak-tag gaps automatically). Task 4 is independent but requires manual website research. Task 5 should be last to validate all improvements.

## Success Criteria

- CI evaluation: 52+ queries, >=99/100 average (up from 98)
- The 3 currently-93/100 queries all score 100/100
- No regressions: 0 queries below 60/100
- New CI queries (Task 5) all score reasonably (the CI runner enforces intent-level averages >=60 and overall >=85, not per-query minimums)
