# Physical Health Services Expansion — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ~70 physical health services to ResourceHub: hospitals/ERs (new category), free clinics, and government health/accessibility programs across Alberta.

**Architecture:** Three parallel data research tracks produce JSON files. Matching `.mjs` insertion scripts load them into the database. Post-insert pipeline handles geocoding, embeddings, and view refresh. Search integration adds the new category to the filter UI and updates intent routing. Evaluation queries prevent regression.

**Tech Stack:** Node.js scripts (pg, dotenv, openai), JSON data files, existing Mapbox geocoding and OpenAI embedding infrastructure.

**Spec:** `docs/specs/2026-03-09-physical-health-services-expansion.md`

**Notes:**
- Insertion scripts use `field_sources` (`{"source": "manual-script-2026-03"}`) to mark services as manually added. This is an intentional improvement over existing scripts (e.g. `add-aa-alberta.mjs`) which don't set `field_sources`. The column is not in the Drizzle schema but exists in the DB and is accessed via raw SQL — no issues.
- `ER` is intentionally omitted from the `intent-boost.ts` categoryPatterns regex (Task 15) to avoid false positives on service descriptions containing "er" as a substring. The domain patterns in `analysis.ts` (Task 12) use word-boundary `\b` so `ER` is safe there. This deviates from the spec which says to add "ER" to intent-boost.

---

## Chunk 1: Data Research & JSON Files

### Task 1: Create data directory and hospital JSON schema

**Files:**
- Create: `scripts/data/hospitals.json`

- [ ] **Step 1: Create `scripts/data/` directory**

```bash
mkdir -p scripts/data
```

- [ ] **Step 2: Create `scripts/data/hospitals.json` with the schema and first 3 entries**

Research the first 3 hospitals via web search (AHS facility pages) to establish the pattern, then populate the rest. Every hospital entry must have ALL fields filled — no nulls except where explicitly noted.

```json
[
  {
    "name": "University of Alberta Hospital",
    "category": "Hospital & Emergency",
    "description": "Major teaching hospital and Level 1 trauma centre. Home to specialized programs including transplant, neurosciences, cardiac surgery, and the Stollery Children's Hospital. Full emergency department with 24/7 trauma services.",
    "location": "8440 112 Street NW, Edmonton, AB T6G 2B7",
    "address": "8440 112 Street NW, Edmonton, AB T6G 2B7",
    "phone": "780-407-8822",
    "website_url": "https://www.albertahealthservices.ca/findhealth/facility.aspx?id=6089",
    "hours_of_operation": "24 hours a day, 7 days a week",
    "is_24_7": true,
    "eligibility": "All Alberta residents. No referral needed for emergency department.",
    "process_steps": ["Go directly to the emergency department", "Check in at triage", "Wait times vary based on severity — life-threatening cases seen immediately"],
    "required_docs": ["Alberta Health Care card", "Government-issued photo ID"],
    "wait_times": "Varies by severity and volume. Life-threatening emergencies seen immediately.",
    "tags": ["emergency", "hospital", "24/7", "trauma centre", "teaching hospital"],
    "source_urls": ["https://www.albertahealthservices.ca/findhealth/facility.aspx?id=6089"],
    "confidence_score": 95,
    "age_group": null,
    "gender_restriction": null,
    "is_faith_based": false,
    "is_12_step": false,
    "service_format": "In-person"
  }
]
```

**Schema notes:**
- `name`: Official hospital name only — no em-dash descriptor
- `tags`: Base set `["emergency", "hospital", "24/7"]` plus facility-specific: `"trauma centre"`, `"children"`, `"psychiatric"`, `"rehabilitation"`, `"teaching hospital"`, `"community hospital"`
- `source_urls`: Array with AHS facility page URL
- `confidence_score`: 95 for all hospitals (authoritative AHS data)
- `address`: Full street address with postal code (same as `location`)
- `phone`: Main hospital switchboard number

- [ ] **Step 3: Research and add all remaining Alberta hospitals with emergency departments**

Use web search against AHS facility directory to compile the complete list. Target ~35-40 hospitals. For each, verify: name, address, phone, website URL, and note any specializations for the description.

**Major hospitals to include (verify all via web search):**

Edmonton area:
- University of Alberta Hospital (trauma centre)
- Royal Alexandra Hospital
- Misericordia Community Hospital
- Grey Nuns Community Hospital
- Sturgeon Community Hospital (St. Albert)

Calgary area:
- Foothills Medical Centre (trauma centre)
- Rockyview General Hospital
- Peter Lougheed Centre
- South Health Campus
- Alberta Children's Hospital

Regional centres:
- Red Deer Regional Hospital Centre
- Chinook Regional Hospital (Lethbridge)
- Medicine Hat Regional Hospital
- Queen Elizabeth II Hospital (Grande Prairie)
- Northern Lights Regional Health Centre (Fort McMurray)

Smaller communities (~20-25):
- Canmore General Hospital, Mineral Springs Hospital (Banff), Drumheller Health Centre, Ponoka Hospital, Olds Hospital, Innisfail Health Centre, Stettler Hospital, Wainwright Health Centre, Lloydminster Hospital, Cold Lake Healthcare Centre, Bonnyville Healthcare Centre, Slave Lake Healthcare Centre, Peace River Community Health Centre, Hinton Healthcare Centre, Edson Healthcare Centre, Whitecourt Healthcare Centre, Westlock (Immaculata Hospital), Drayton Valley Hospital, Lacombe Hospital, Brooks Health Centre, Claresholm General Hospital, Pincher Creek Health Centre, Crowsnest Pass Health Centre, Sundre Hospital, Rocky Mountain House Health Centre, etc.

**For each hospital, web search for:**
1. Official AHS facility page URL
2. Full street address with postal code
3. Main phone number
4. Any notable specializations (trauma centre, children's, psychiatric, etc.)
5. Brief description (2-3 sentences covering services and specializations)

- [ ] **Step 4: Validate JSON file**

```bash
node -e "const d = JSON.parse(require('fs').readFileSync('scripts/data/hospitals.json','utf8')); console.log(d.length + ' hospitals loaded'); d.forEach((h,i) => { if (!h.name || !h.address || !h.phone) console.error('Missing field at index ' + i + ': ' + h.name); });"
```

Expected: all entries have name, address, and phone. ~35-40 hospitals total.

- [ ] **Step 5: Commit**

```bash
git add scripts/data/hospitals.json
git commit -m "data: add Alberta hospitals JSON (N entries)"
```

---

### Task 2: Create free/drop-in clinics JSON

**Files:**
- Create: `scripts/data/clinics.json`

- [ ] **Step 1: Query existing clinics to avoid duplicates**

```sql
SELECT name, location FROM services
WHERE is_active = true
AND category = 'Healthcare Access'
ORDER BY name;
```

Already in DB (do NOT re-add): CUPS Calgary, The Alex Community Health Centre, Radius Community Health & Healing, Sheldon M. Chumir Health Centre, 811 Health Link, Hope Mission Health Services, The Mustard Seed Wellness Centre.

- [ ] **Step 2: Research and create `scripts/data/clinics.json`**

Web search for each clinic individually. **No templates** — every field must be verified from the clinic's own website or a trusted source (211 Alberta, AHS directory).

**Target clinics to research (verify via web search):**

AHS Community Health Centres:
- East Calgary Health Centre
- Eastwood Health Centre (Edmonton)
- Northeast Community Health Centre (Edmonton)
- South Calgary Health Centre
- Sunridge Health Centre (Calgary)
- Northgate Health Centre (Edmonton)

Charitable/low-barrier clinics not already in DB:
- Alex Bus (mobile health) — Calgary
- Boyle Street Community Services Health Centre — Edmonton
- Bissell Centre Health Services — Edmonton
- Mustard Seed Wellness Centre (already in DB — skip)
- Streetworks Edmonton (AHS)
- SHARP Foundation clinic — if any
- Mosaic PCN Community Clinic — Calgary

Specialized free clinics:
- AHS TB Services (Calgary + Edmonton)
- AHS Immunization clinics
- Travel Health clinics
- Baby-friendly/well-child clinics

**JSON entry schema (each clinic is unique):**

```json
{
  "name": "East Calgary Health Centre",
  "category": "Healthcare Access",
  "description": "AHS community health centre offering immunizations, prenatal care, chronic disease management, home care intake, and public health nursing. Walk-in and appointment-based services.",
  "location": "4715 8 Avenue SE, Calgary, AB T2A 3N4",
  "address": "4715 8 Avenue SE, Calgary, AB T2A 3N4",
  "phone": "403-955-1200",
  "website_url": "https://www.albertahealthservices.ca/findhealth/facility.aspx?id=1234",
  "hours_of_operation": "Monday-Friday 8:00 AM - 4:00 PM",
  "is_24_7": false,
  "eligibility": "All Alberta residents with active Alberta Health Care coverage.",
  "process_steps": ["Call to book an appointment or walk in during clinic hours", "Bring Alberta Health Care card", "Check in at reception"],
  "required_docs": ["Alberta Health Care card"],
  "wait_times": "Walk-in wait times vary. Appointments recommended.",
  "tags": ["clinic", "community health", "immunization", "prenatal", "public health"],
  "source_urls": ["https://www.albertahealthservices.ca/findhealth/facility.aspx?id=1234"],
  "confidence_score": 90,
  "age_group": null,
  "gender_restriction": null,
  "is_faith_based": false,
  "is_12_step": false,
  "service_format": "In-person"
}
```

**Critical: For each clinic, individually verify from primary sources:**
- Exact hours (many are limited days/times)
- Eligibility (some require low-income proof, some are population-specific)
- Services offered (varies widely)
- Cost (free? sliding scale? Alberta Health covered?)
- If a field can't be verified, set it to `null` — don't guess

- [ ] **Step 3: Validate JSON file**

```bash
node -e "const d = JSON.parse(require('fs').readFileSync('scripts/data/clinics.json','utf8')); console.log(d.length + ' clinics loaded'); d.forEach((c,i) => { if (!c.name || !c.website_url) console.error('Missing field at index ' + i + ': ' + c.name); });"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/data/clinics.json
git commit -m "data: add free/drop-in health clinics JSON (N entries)"
```

---

### Task 3: Create health coverage & accessibility programs JSON

**Files:**
- Create: `scripts/data/health-programs.json`

- [ ] **Step 1: Query existing programs to avoid duplicates**

```sql
SELECT name, location FROM services
WHERE is_active = true
AND (name ILIKE '%benefit%' OR name ILIKE '%AADL%' OR name ILIKE '%AISH%'
     OR name ILIKE '%RAMP%' OR name ILIKE '%pharmacare%' OR name ILIKE '%drug coverage%')
ORDER BY name;
```

Already in DB: Alberta Adult Health Benefit (AAHB), Alberta Child Health Benefit (ACHB). Do NOT re-add these.

- [ ] **Step 2: Research each program individually and create `scripts/data/health-programs.json`**

**Every program needs its own web search session.** Eligibility, application steps, and required docs ALL vary. Research from alberta.ca or the administering body's website.

**Programs to research:**

Coverage programs:
1. **Coverage for Seniors Program** — alberta.ca/coverage-for-seniors-program
2. **Seniors Health Benefit** — alberta.ca/seniors-health-benefits
3. **AADL (Alberta Aids to Daily Living)** — alberta.ca/alberta-aids-to-daily-living
4. **Alberta Blue Cross Non-Group Coverage** — ab.bluecross.ca
5. **AISH Health Benefits** (prescriptions, dental, optical for AISH recipients) — alberta.ca
6. **Palliative/End-of-Life Drug Coverage** — alberta.ca
7. **NIHB (Non-Insured Health Benefits)** — sac-isc.gc.ca
8. **Interim Federal Health Program** (refugees) — canada.ca

Accessibility & home modification:
9. **RAMP (Residential Access Modification Program)** — alberta.ca/residential-access-modification-program
10. **SHARP (Seniors Home Adaptation and Repair Program)** — alberta.ca
11. **Home Accessibility Tax Credit** — canada.ca
12. **Easter Seals AccessABILITIES Home Automation Program** — easterseals.ab.ca
13. **Alberta Disability Assistance Program** (launching July 2026) — alberta.ca/alberta-disability-assistance-program

**JSON entry schema (each program is unique — example with RAMP):**

```json
{
  "name": "Residential Access Modification Program (RAMP)",
  "category": "Healthcare Access",
  "description": "Provincial program providing funding for home modifications that improve accessibility for Albertans with permanent mobility limitations. Covers ramps, grab bars, door widening, bathroom modifications, and other accessibility improvements.",
  "location": "Alberta (province-wide)",
  "address": null,
  "phone": "1-877-644-9992",
  "website_url": "https://www.alberta.ca/residential-access-modification-program",
  "hours_of_operation": "Applications accepted year-round. Phone support Monday-Friday 8:15 AM - 4:30 PM.",
  "is_24_7": false,
  "eligibility": "Alberta residents with permanent mobility limitations. Standard funding up to $7,500/year. Low-income applicants may qualify for up to $12,000/year. Lifetime maximum $15,000 over 10 years.",
  "process_steps": [
    "Get an assessment from an occupational therapist",
    "Obtain renovation quotes from a licensed contractor",
    "Submit application to Alberta Seniors, Community and Social Services",
    "Wait for approval (processing times vary)",
    "Complete home modifications",
    "Submit receipts for reimbursement"
  ],
  "required_docs": [
    "Occupational therapist assessment",
    "Renovation quotes from licensed contractor",
    "Proof of income (for enhanced funding eligibility)",
    "Proof of Alberta residency"
  ],
  "wait_times": "Processing times vary. Applications accepted year-round subject to available funding.",
  "tags": ["accessibility", "home modification", "disability", "senior", "ramp", "wheelchair", "mobility"],
  "source_urls": ["https://www.alberta.ca/residential-access-modification-program"],
  "confidence_score": 95,
  "age_group": null,
  "gender_restriction": null,
  "is_faith_based": false,
  "is_12_step": false,
  "service_format": "Application-based"
}
```

**Example — Coverage for Seniors (very different process):**

```json
{
  "name": "Coverage for Seniors Program",
  "category": "Healthcare Access",
  "description": "Premium-free provincial program covering prescription drugs and other health services for Albertans aged 65 and older. Covers most medications on the Alberta Drug Benefit List. Co-payment of 30% up to $35 maximum per prescription (as of April 2026).",
  "location": "Alberta (province-wide)",
  "address": null,
  "phone": "310-0000",
  "website_url": "https://www.alberta.ca/coverage-for-seniors-program",
  "hours_of_operation": "Coverage is automatic. Phone support Monday-Friday 8:15 AM - 4:30 PM.",
  "is_24_7": false,
  "eligibility": "Alberta residents aged 65 and older with active Alberta Health Care Insurance Plan (AHCIP) coverage. No application required — coverage is automatic.",
  "process_steps": [
    "No application needed — coverage begins automatically when you turn 65 with active AHCIP",
    "Present your Alberta Health Care card at the pharmacy when filling prescriptions",
    "Pay the applicable co-payment (30% up to $35 maximum per prescription)"
  ],
  "required_docs": ["Alberta Health Care card"],
  "wait_times": "No wait — coverage is automatic at age 65.",
  "tags": ["senior", "prescription", "drug coverage", "medication", "pharmacare", "65+"],
  "source_urls": ["https://www.alberta.ca/coverage-for-seniors-program"],
  "confidence_score": 95,
  "age_group": "seniors",
  "gender_restriction": null,
  "is_faith_based": false,
  "is_12_step": false,
  "service_format": "Automatic enrollment"
}
```

**Critical for each program:**
- Verify CURRENT eligibility criteria (some change annually)
- Verify CURRENT application process (some are automatic, some need referrals, some are online)
- Verify CURRENT required documents
- Verify CURRENT co-payment amounts / funding limits
- Note if program has annual funding that runs out
- Set `age_group` to `"seniors"` for 65+ programs, `null` for all-ages

- [ ] **Step 3: Validate JSON file**

```bash
node -e "const d = JSON.parse(require('fs').readFileSync('scripts/data/health-programs.json','utf8')); console.log(d.length + ' programs loaded'); d.forEach((p,i) => { if (!p.name || !p.website_url || !p.eligibility) console.error('Missing critical field at index ' + i + ': ' + p.name); });"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/data/health-programs.json
git commit -m "data: add health coverage and accessibility programs JSON (N entries)"
```

---

## Chunk 2: Insertion Scripts

### Task 4: Hospital insertion script

**Files:**
- Create: `scripts/add-hospitals.mjs`

- [ ] **Step 1: Create `scripts/add-hospitals.mjs`**

```javascript
import pg from "pg";
const { Pool } = pg;
import "dotenv/config";
import { readFileSync } from "fs";

const DRY_RUN = process.env.DRY_RUN !== "false";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function makeServiceId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 200);
}

async function main() {
  const client = await pool.connect();
  try {
    const hospitals = JSON.parse(
      readFileSync(new URL("./data/hospitals.json", import.meta.url), "utf8")
    );
    console.log(`Loaded ${hospitals.length} hospitals. DRY_RUN=${DRY_RUN}\n`);

    let inserted = 0;
    let skipped = 0;

    for (const h of hospitals) {
      const serviceId = makeServiceId(h.name);

      // Check for duplicates
      const existing = await client.query(
        "SELECT id, name FROM services WHERE service_id = $1 OR name = $2",
        [serviceId, h.name]
      );
      if (existing.rows.length > 0) {
        console.log(`  SKIP (duplicate): ${h.name} — existing ID ${existing.rows[0].id}`);
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY] Would insert: ${h.name} | ${h.address} | ${h.phone}`);
        inserted++;
        continue;
      }

      const result = await client.query(
        `INSERT INTO services (
          service_id, name, category, description, location, address, phone,
          website_url, hours_of_operation, is_24_7, eligibility,
          process_steps, required_docs, wait_times, tags, source_urls,
          confidence_score, age_group, gender_restriction,
          is_faith_based, is_12_step, service_format,
          field_sources, is_active, last_updated
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, $14, $15, $16,
          $17, $18, $19,
          $20, $21, $22,
          $23, true, NOW()
        ) RETURNING id`,
        [
          serviceId, h.name, h.category, h.description, h.location, h.address, h.phone,
          h.website_url, h.hours_of_operation, h.is_24_7, h.eligibility,
          JSON.stringify(h.process_steps), JSON.stringify(h.required_docs),
          h.wait_times, JSON.stringify(h.tags), JSON.stringify(h.source_urls),
          h.confidence_score, h.age_group, h.gender_restriction,
          h.is_faith_based, h.is_12_step, h.service_format,
          JSON.stringify({ source: "manual-script-2026-03" }),
        ]
      );
      console.log(`  ✓ Inserted: ${h.name} (ID ${result.rows[0].id})`);
      inserted++;

      // Log to service_history
      await client.query(
        `INSERT INTO service_history (service_id, name, category, change_type, changed_fields, recorded_at)
         VALUES ($1, $2, $3, 'bulk_insert', $4, NOW())`,
        [result.rows[0].id, h.name, h.category, JSON.stringify({ source: "physical-health-expansion-hospitals" })]
      );
    }

    console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
    if (DRY_RUN) console.log("(DRY RUN — no changes written. Run with DRY_RUN=false to execute.)");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Dry run to verify**

```bash
node scripts/add-hospitals.mjs
```

Expected: prints `[DRY] Would insert: ...` for each hospital, 0 duplicates on first run.

- [ ] **Step 3: Commit**

```bash
git add scripts/add-hospitals.mjs
git commit -m "scripts: add hospital insertion script"
```

---

### Task 5: Clinic insertion script

**Files:**
- Create: `scripts/add-health-clinics.mjs`

- [ ] **Step 1: Create `scripts/add-health-clinics.mjs`**

Same pattern as `add-hospitals.mjs` but reads from `scripts/data/clinics.json`. Only differences:

- `change_type` in service_history: `'bulk_insert'`
- `changed_fields` source: `"physical-health-expansion-clinics"`

```javascript
import pg from "pg";
const { Pool } = pg;
import "dotenv/config";
import { readFileSync } from "fs";

const DRY_RUN = process.env.DRY_RUN !== "false";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function makeServiceId(name, address) {
  const raw = address ? `${name}-${address}` : name;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 200);
}

async function main() {
  const client = await pool.connect();
  try {
    const clinics = JSON.parse(
      readFileSync(new URL("./data/clinics.json", import.meta.url), "utf8")
    );
    console.log(`Loaded ${clinics.length} clinics. DRY_RUN=${DRY_RUN}\n`);

    let inserted = 0;
    let skipped = 0;

    for (const c of clinics) {
      const serviceId = makeServiceId(c.name, c.address);

      // Check for duplicates by name (clinics may share addresses)
      const existing = await client.query(
        "SELECT id, name FROM services WHERE name = $1",
        [c.name]
      );
      if (existing.rows.length > 0) {
        console.log(`  SKIP (duplicate): ${c.name} — existing ID ${existing.rows[0].id}`);
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY] Would insert: ${c.name} | ${c.location}`);
        inserted++;
        continue;
      }

      const result = await client.query(
        `INSERT INTO services (
          service_id, name, category, description, location, address, phone, email,
          website_url, hours_of_operation, is_24_7, eligibility,
          process_steps, required_docs, wait_times, tags, source_urls,
          confidence_score, age_group, gender_restriction,
          is_faith_based, is_12_step, service_format,
          field_sources, is_active, last_updated
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, $19, $20,
          $21, $22, $23,
          $24, true, NOW()
        ) RETURNING id`,
        [
          serviceId, c.name, c.category, c.description, c.location, c.address,
          c.phone || null, c.email || null,
          c.website_url, c.hours_of_operation, c.is_24_7, c.eligibility,
          JSON.stringify(c.process_steps), JSON.stringify(c.required_docs),
          c.wait_times, JSON.stringify(c.tags), JSON.stringify(c.source_urls),
          c.confidence_score, c.age_group, c.gender_restriction,
          c.is_faith_based, c.is_12_step, c.service_format,
          JSON.stringify({ source: "manual-script-2026-03" }),
        ]
      );
      console.log(`  ✓ Inserted: ${c.name} (ID ${result.rows[0].id})`);
      inserted++;

      await client.query(
        `INSERT INTO service_history (service_id, name, category, change_type, changed_fields, recorded_at)
         VALUES ($1, $2, $3, 'bulk_insert', $4, NOW())`,
        [result.rows[0].id, c.name, c.category, JSON.stringify({ source: "physical-health-expansion-clinics" })]
      );
    }

    console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
    if (DRY_RUN) console.log("(DRY RUN — no changes written. Run with DRY_RUN=false to execute.)");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Dry run to verify**

```bash
node scripts/add-health-clinics.mjs
```

- [ ] **Step 3: Commit**

```bash
git add scripts/add-health-clinics.mjs
git commit -m "scripts: add health clinics insertion script"
```

---

### Task 6: Health programs insertion script

**Files:**
- Create: `scripts/add-health-programs.mjs`

- [ ] **Step 1: Create `scripts/add-health-programs.mjs`**

Same pattern as clinics script but reads from `scripts/data/health-programs.json`:

```javascript
import pg from "pg";
const { Pool } = pg;
import "dotenv/config";
import { readFileSync } from "fs";

const DRY_RUN = process.env.DRY_RUN !== "false";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function makeServiceId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 200);
}

async function main() {
  const client = await pool.connect();
  try {
    const programs = JSON.parse(
      readFileSync(new URL("./data/health-programs.json", import.meta.url), "utf8")
    );
    console.log(`Loaded ${programs.length} programs. DRY_RUN=${DRY_RUN}\n`);

    let inserted = 0;
    let skipped = 0;

    for (const p of programs) {
      const serviceId = makeServiceId(p.name);

      const existing = await client.query(
        "SELECT id, name FROM services WHERE name = $1 OR service_id = $2",
        [p.name, serviceId]
      );
      if (existing.rows.length > 0) {
        console.log(`  SKIP (duplicate): ${p.name} — existing ID ${existing.rows[0].id}`);
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY] Would insert: ${p.name} | ${p.location}`);
        inserted++;
        continue;
      }

      const result = await client.query(
        `INSERT INTO services (
          service_id, name, category, description, location, address, phone, email,
          website_url, hours_of_operation, is_24_7, eligibility,
          process_steps, required_docs, wait_times, tags, source_urls,
          confidence_score, age_group, gender_restriction,
          is_faith_based, is_12_step, service_format,
          field_sources, is_active, last_updated
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, $19, $20,
          $21, $22, $23,
          $24, true, NOW()
        ) RETURNING id`,
        [
          serviceId, p.name, p.category, p.description, p.location,
          p.address || null, p.phone || null, p.email || null,
          p.website_url, p.hours_of_operation, p.is_24_7, p.eligibility,
          JSON.stringify(p.process_steps), JSON.stringify(p.required_docs),
          p.wait_times, JSON.stringify(p.tags), JSON.stringify(p.source_urls),
          p.confidence_score, p.age_group, p.gender_restriction,
          p.is_faith_based, p.is_12_step, p.service_format,
          JSON.stringify({ source: "manual-script-2026-03" }),
        ]
      );
      console.log(`  ✓ Inserted: ${p.name} (ID ${result.rows[0].id})`);
      inserted++;

      await client.query(
        `INSERT INTO service_history (service_id, name, category, change_type, changed_fields, recorded_at)
         VALUES ($1, $2, $3, 'bulk_insert', $4, NOW())`,
        [result.rows[0].id, p.name, p.category, JSON.stringify({ source: "physical-health-expansion-programs" })]
      );
    }

    console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
    if (DRY_RUN) console.log("(DRY RUN — no changes written. Run with DRY_RUN=false to execute.)");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Dry run to verify**

```bash
node scripts/add-health-programs.mjs
```

- [ ] **Step 3: Commit**

```bash
git add scripts/add-health-programs.mjs
git commit -m "scripts: add health programs insertion script"
```

---

## Chunk 3: Post-Insert Pipeline

### Task 7: Run insertion scripts (live)

- [ ] **Step 1: Run all 3 insertion scripts with DRY_RUN=false**

```bash
DRY_RUN=false node scripts/add-hospitals.mjs
DRY_RUN=false node scripts/add-health-clinics.mjs
DRY_RUN=false node scripts/add-health-programs.mjs
```

Record the total number of services inserted across all 3 scripts.

- [ ] **Step 2: Verify insertions**

```sql
SELECT category, COUNT(*) FROM services
WHERE is_active = true
AND field_sources->>'source' = 'manual-script-2026-03'
GROUP BY category ORDER BY category;
```

Expected: `"Hospital & Emergency"` with ~35-40, `"Healthcare Access"` with ~30 (15-20 clinics + ~15 programs).

---

### Task 8: Generate embeddings for new services

**Files:**
- Create: `scripts/generate-embeddings-new-health.mjs`

- [ ] **Step 1: Create embedding generation script**

```javascript
import pg from "pg";
const { Pool } = pg;
import "dotenv/config";
import OpenAI from "openai";

const DRY_RUN = process.env.DRY_RUN !== "false";
const BATCH_SIZE = 20;
const EMBEDDING_MODEL = "text-embedding-3-small";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY });

function buildEmbeddingText(svc) {
  const parts = [];
  if (svc.name) parts.push(`Service: ${svc.name}`);
  if (svc.category) {
    parts.push(`Category: ${svc.category}`);
    parts.push(`This is a ${svc.category} service.`);
  }
  if (svc.description) parts.push(`Description: ${svc.description}`);
  if (svc.eligibility) parts.push(`Eligibility: ${svc.eligibility}`);
  if (svc.location) parts.push(`Location: ${svc.location}`);
  if (svc.tags && Array.isArray(svc.tags)) parts.push(`Tags: ${svc.tags.join(", ")}`);
  return parts.join("\n").slice(0, 20000);
}

async function main() {
  const client = await pool.connect();
  try {
    // Find all new services without embeddings
    const { rows: services } = await client.query(
      `SELECT id, name, category, description, location, eligibility, tags
       FROM services
       WHERE is_active = true
       AND field_sources->>'source' = 'manual-script-2026-03'
       AND embedding IS NULL
       ORDER BY id`
    );
    console.log(`Found ${services.length} services needing embeddings. DRY_RUN=${DRY_RUN}\n`);

    let processed = 0;
    let errors = 0;

    for (let i = 0; i < services.length; i += BATCH_SIZE) {
      const batch = services.slice(i, i + BATCH_SIZE);

      for (const svc of batch) {
        const embedText = buildEmbeddingText(svc);

        if (DRY_RUN) {
          console.log(`  [DRY] ${svc.id}: ${svc.name} — ${embedText.length} chars`);
          processed++;
          continue;
        }

        try {
          const response = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: embedText,
          });
          const embedding = response.data[0].embedding;

          await client.query(
            `UPDATE services SET embedding = $1, embedding_updated_at = NOW() WHERE id = $2`,
            [`[${embedding.join(",")}]`, svc.id]
          );
          console.log(`  ✓ ${svc.id}: ${svc.name}`);
          processed++;
        } catch (err) {
          console.error(`  ✗ ${svc.id}: ${svc.name} — ${err.message}`);
          errors++;
        }
      }

      // Pause between batches
      if (i + BATCH_SIZE < services.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    console.log(`\nDone. Processed: ${processed}, Errors: ${errors}`);
    if (DRY_RUN) console.log("(DRY RUN — run with DRY_RUN=false to generate embeddings.)");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Dry run, then live run**

```bash
node scripts/generate-embeddings-new-health.mjs
DRY_RUN=false node scripts/generate-embeddings-new-health.mjs
```

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-embeddings-new-health.mjs
git commit -m "scripts: add embedding generation for new health services"
```

---

### Task 9: Geocode new services and refresh view

- [ ] **Step 1: Geocode new services**

```bash
node scripts/batch-geocode-services.mjs
```

Review dry-run output. Hospitals should all geocode precisely (exact addresses). Province-wide programs will be skipped (no physical address). Then run live:

```bash
DRY_RUN=false node scripts/batch-geocode-services.mjs
```

- [ ] **Step 2: Refresh materialized view**

```bash
node scripts/refresh-search-view.mjs
```

- [ ] **Step 3: Verify counts**

```sql
SELECT category, COUNT(*) FROM services
WHERE is_active = true
GROUP BY category ORDER BY category;
```

Verify `"Hospital & Emergency"` appears with ~35-40 entries and `"Healthcare Access"` increased by ~30.

---

## Chunk 4: Search Integration

### Task 10: Add Hospital & Emergency to RefinePanel filter UI

**Files:**
- Modify: `client/src/components/RefinePanel.tsx:27-31` (CATEGORY_GROUPS)

- [ ] **Step 1: Add "Hospital & Emergency" to the Crisis & Safety group**

In `client/src/components/RefinePanel.tsx`, modify the first entry in `CATEGORY_GROUPS` (line 29-31):

```typescript
// Before:
    categories: ["Crisis Services", "Crisis Lines", "Domestic Violence Support", "Human Trafficking Support"],

// After:
    categories: ["Crisis Services", "Crisis Lines", "Hospital & Emergency", "Domestic Violence Support", "Human Trafficking Support"],
```

- [ ] **Step 2: Verify the app compiles**

```bash
npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/RefinePanel.tsx
git commit -m "feat: add Hospital & Emergency to category filter UI"
```

---

### Task 11: Update INTENT_CATEGORY_NAMES mapping

**Files:**
- Modify: `server/search/index.ts:478` (INTENT_CATEGORY_NAMES healthcare_access entry)

- [ ] **Step 1: Add "Hospital & Emergency" to healthcare_access set**

In `server/search/index.ts`, modify line 478:

```typescript
// Before:
  healthcare_access: new Set(['Healthcare Access', 'Sexual Health Services']),

// After:
  healthcare_access: new Set(['Healthcare Access', 'Sexual Health Services', 'Hospital & Emergency']),
```

- [ ] **Step 2: Bump cache version**

In `server/search/index.ts`, modify the CACHE_VERSION constant (line 10):

```typescript
// Before:
const CACHE_VERSION = 'v108';

// After:
const CACHE_VERSION = 'v109'; // Bumped: Hospital & Emergency category + health services expansion
```

- [ ] **Step 3: Commit**

```bash
git add server/search/index.ts
git commit -m "feat: add Hospital & Emergency to intent-category mapping, bump cache v109"
```

---

### Task 12: Update healthcare_access domain patterns

**Files:**
- Modify: `server/search/config/analysis.ts:568-576` (healthcare_access domain patterns)

- [ ] **Step 1: Add hospital/ER patterns**

In `server/search/config/analysis.ts`, add a new regex to the `healthcare_access` array (after line 573):

```typescript
// Before:
    healthcare_access: [
      /\b(?:doctor|physician|family doctor|walk-?in clinic|medical clinic)\b/i,
      /\b(?:prescription|medication|pharmacy|pharmacist)\b.*(?:help|afford|can't|program)/i,
      /\b(?:no doctor|need a doctor|find a doctor|finding a doctor)\b/i,
      /\b(?:health benefits|health coverage|health insurance)\b/i,
      /\b(?:community health|health centre|health center)\b/i,
      /\b(?:dental|dentist|dental clinic)\b.*(?:help|afford|low.?cost|free|program)/i,
      /\b(?:sexual health|STI|STD|contraception|family planning)\b/i,
    ],

// After:
    healthcare_access: [
      /\b(?:doctor|physician|family doctor|walk-?in clinic|medical clinic)\b/i,
      /\b(?:prescription|medication|pharmacy|pharmacist)\b.*(?:help|afford|can't|program)/i,
      /\b(?:no doctor|need a doctor|find a doctor|finding a doctor)\b/i,
      /\b(?:health benefits|health coverage|health insurance)\b/i,
      /\b(?:community health|health centre|health center)\b/i,
      /\b(?:dental|dentist|dental clinic)\b.*(?:help|afford|low.?cost|free|program)/i,
      /\b(?:sexual health|STI|STD|contraception|family planning)\b/i,
      /\b(?:hospital|emergency room|emergency department|ER|urgent care)\b/i,
      /\b(?:AADL|aids to daily living|wheelchair|mobility aid|home modification)\b/i,
      /\b(?:RAMP|SHARP|seniors? benefit|drug coverage|pharmacare)\b/i,
    ],
```

- [ ] **Step 2: Commit**

```bash
git add server/search/config/analysis.ts
git commit -m "feat: add hospital, ER, and accessibility patterns to healthcare_access intent"
```

---

### Task 13: Update LLM intent prompt

**Files:**
- Modify: `server/search/llm-intent.ts:67` (healthcare_access description)

- [ ] **Step 1: Update the healthcare_access description**

In `server/search/llm-intent.ts`, modify line 67:

```typescript
// Before:
- healthcare_access: doctor, walk-in clinic, dental, medical

// After:
- healthcare_access: doctor, walk-in clinic, dental, medical, hospital, ER, emergency room, prescriptions, accessibility programs, home modification, AADL
```

- [ ] **Step 2: Commit**

```bash
git add server/search/llm-intent.ts
git commit -m "feat: update LLM intent prompt with hospital and accessibility terms"
```

---

### Task 14: Add keyword expansions

**Files:**
- Modify: `server/helpers/keywords.ts` (KEYWORD_EXPANSIONS)

- [ ] **Step 1: Add hospital, accessibility, and program acronym expansions**

In `server/helpers/keywords.ts`, add entries to the `KEYWORD_EXPANSIONS` object:

```typescript
// Add these entries to KEYWORD_EXPANSIONS:
  'hospital': ['emergency room', 'emergency department', 'ER', 'urgent care', 'trauma'],
  'er': ['emergency room', 'emergency department', 'hospital', 'urgent care'],
  'aadl': ['aids to daily living', 'wheelchair', 'mobility aid', 'medical equipment', 'prosthetic'],
  'ramp': ['residential access modification', 'home modification', 'accessibility', 'wheelchair ramp'],
  'aish': ['assured income severely handicapped', 'disability income', 'disability benefits'],
  'sharp': ['seniors home adaptation', 'home repair', 'home renovation', 'aging in place'],
  'prescription': ['medication', 'pharmacy', 'drug coverage', 'pharmacare'],
  'wheelchair': ['mobility aid', 'accessibility', 'aadl', 'disability equipment'],
```

- [ ] **Step 2: Add to COMMON_MISSPELLINGS if needed**

Check if any common misspellings of these terms should be added (e.g., `'emergancy': 'emergency'`, `'perscription': 'prescription'`, `'hosptal': 'hospital'`).

- [ ] **Step 3: Commit**

```bash
git add server/helpers/keywords.ts
git commit -m "feat: add hospital, accessibility, and program keyword expansions"
```

---

### Task 15: Update intent-boost categoryPatterns

**Files:**
- Modify: `server/search/strategies/scoring/intent-boost.ts:137-140` (healthcare_access entry)

- [ ] **Step 1: Add ER/accessibility terms to categoryPatterns**

In `server/search/strategies/scoring/intent-boost.ts`, modify lines 137-140:

```typescript
// Before:
  'healthcare_access': {
    serviceTypes: ['healthcare', 'medical'],
    categoryPatterns: /doctor|physician|clinic|hospital|health centre|health center|811|health link|prescription|medication|chronic pain|patient|medical|dental|dentist|sexual health|STI|family planning/i,
  },

// After:
  'healthcare_access': {
    serviceTypes: ['healthcare', 'medical'],
    categoryPatterns: /doctor|physician|clinic|hospital|health centre|health center|811|health link|prescription|medication|chronic pain|patient|medical|dental|dentist|sexual health|STI|family planning|emergency room|emergency department|urgent care|AADL|aids to daily living|wheelchair|mobility aid|home modification|RAMP|SHARP|drug coverage|pharmacare/i,
  },
```

- [ ] **Step 2: Commit**

```bash
git add server/search/strategies/scoring/intent-boost.ts
git commit -m "feat: add ER and accessibility terms to intent-boost patterns"
```

---

## Chunk 5: Evaluation & Verification

### Task 16: Add test queries to evaluation suite

**Files:**
- Modify: `server/evaluation/comprehensive_test_queries.ts`
- Modify: `server/evaluation/ci_runner.mjs`

- [ ] **Step 1: Add test queries to comprehensive_test_queries.ts**

Add a new section to the `TEST_QUERIES` array in `server/evaluation/comprehensive_test_queries.ts`:

```typescript
// Hospital & Emergency queries
{
  query: "hospital in Edmonton",
  location: "Edmonton",
  intent: "healthcare_access",
  description: "Hospital search by city",
  expectedPatterns: ["hospital", "emergency"],
},
{
  query: "nearest emergency room",
  intent: "healthcare_access",
  description: "ER search",
  expectedPatterns: ["hospital", "emergency"],
},
{
  query: "ER Calgary",
  location: "Calgary",
  intent: "healthcare_access",
  description: "ER abbreviation search",
  expectedPatterns: ["hospital", "emergency"],
},
// Free clinic queries
{
  query: "free clinic Edmonton",
  location: "Edmonton",
  intent: "healthcare_access",
  description: "Free health clinic search",
  expectedPatterns: ["health", "clinic", "community"],
},
{
  query: "walk in clinic no health card",
  intent: "healthcare_access",
  description: "Low-barrier clinic search",
  expectedPatterns: ["clinic", "health"],
},
// Health program queries
{
  query: "help paying for prescriptions",
  intent: "healthcare_access",
  description: "Prescription coverage search",
  expectedPatterns: ["prescription", "benefit", "coverage"],
},
{
  query: "wheelchair program Alberta",
  intent: "healthcare_access",
  description: "Mobility aid program search",
  expectedPatterns: ["aids to daily living", "AADL", "wheelchair", "mobility"],
},
{
  query: "home modification for disability",
  intent: "healthcare_access",
  description: "Accessibility modification search",
  expectedPatterns: ["RAMP", "modification", "accessibility"],
},
{
  query: "seniors drug coverage",
  intent: "healthcare_access",
  description: "Seniors prescription coverage",
  expectedPatterns: ["senior", "coverage", "prescription"],
},
```

- [ ] **Step 2: Add CI test queries to ci_runner.mjs**

Add to the test queries array in `server/evaluation/ci_runner.mjs`:

```javascript
// Hospital & Emergency
{ query: "hospital Edmonton", intent: "healthcare_access", expectedPatterns: ["hospital", "emergency"] },
{ query: "nearest ER", intent: "healthcare_access", expectedPatterns: ["hospital", "emergency"] },
// Health programs
{ query: "help paying for prescriptions", intent: "healthcare_access", expectedPatterns: ["prescription", "benefit", "coverage"] },
{ query: "wheelchair program Alberta", intent: "healthcare_access", expectedPatterns: ["aids to daily living", "AADL", "wheelchair"] },
```

- [ ] **Step 3: Commit**

```bash
git add server/evaluation/comprehensive_test_queries.ts server/evaluation/ci_runner.mjs
git commit -m "test: add hospital, clinic, and health program evaluation queries"
```

---

### Task 17: End-to-end verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test search queries via diagnose tool**

```bash
npx tsx server/evaluation/diagnose_query.ts "hospital Edmonton"
npx tsx server/evaluation/diagnose_query.ts "nearest ER"
npx tsx server/evaluation/diagnose_query.ts "help paying for prescriptions"
npx tsx server/evaluation/diagnose_query.ts "wheelchair program Alberta"
npx tsx server/evaluation/diagnose_query.ts "free clinic Calgary"
npx tsx server/evaluation/diagnose_query.ts "AADL"
npx tsx server/evaluation/diagnose_query.ts "RAMP program"
```

Verify: hospitals appear for hospital queries, programs appear for program queries, clinics appear for clinic queries. Check that the `healthcare_access` intent is correctly detected.

- [ ] **Step 3: Verify filter UI in browser**

Open the app, click the category filter, expand "Crisis & Safety" group. Verify "Hospital & Emergency" appears. Select it and verify only hospitals are shown.

- [ ] **Step 4: Run CI evaluation**

```bash
node server/evaluation/ci_runner.mjs
```

Verify: overall score >= 85, no new failures. New hospital/program queries should score >= 60.

- [ ] **Step 5: Run TypeScript type check**

```bash
npm run check
```

Expected: no type errors.

- [ ] **Step 6: Final commit with all verification passing**

Stage specific files — do NOT use `git add -A` (per project git safety rules):

```bash
git add client/src/components/RefinePanel.tsx \
  server/search/index.ts \
  server/search/config/analysis.ts \
  server/search/llm-intent.ts \
  server/helpers/keywords.ts \
  server/search/strategies/scoring/intent-boost.ts \
  server/evaluation/comprehensive_test_queries.ts \
  server/evaluation/ci_runner.mjs \
  scripts/data/ \
  scripts/add-hospitals.mjs \
  scripts/add-health-clinics.mjs \
  scripts/add-health-programs.mjs \
  scripts/generate-embeddings-new-health.mjs
git diff --cached --stat  # Verify only expected files are staged
git commit -m "feat: physical health services expansion — hospitals, clinics, and programs

Adds ~70 new services across 3 tracks:
- Hospital & Emergency (new category): ~35-40 Alberta hospitals with ERs
- Free/drop-in health clinics: ~15-20 AHS and charitable clinics
- Health coverage & accessibility programs: ~15 government programs

Includes search integration (intent routing, keyword expansion, filter UI)
and evaluation queries for regression testing."
```

---

### Task 18: Update CLAUDE.md and MEMORY.md

**Files:**
- Modify: `CLAUDE.md`
- Modify: `/Users/adamyeo/.claude/projects/-Users-adamyeo-Desktop-ResourceHub/memory/MEMORY.md`

- [ ] **Step 1: Update CLAUDE.md**

Add new scripts to the Key Files table:

```markdown
| `scripts/add-hospitals.mjs` | Insert hospitals into DB from JSON data |
| `scripts/add-health-clinics.mjs` | Insert health clinics into DB from JSON data |
| `scripts/add-health-programs.mjs` | Insert health programs into DB from JSON data |
```

Update RefinePanel description: 37 categories → 38 categories, 7 groups.

- [ ] **Step 2: Update MEMORY.md**

Update cache version: v106 → v109 (MEMORY.md is outdated — currently says v106, actual is v108, bump to v109).

Add note about the new "Hospital & Emergency" category in the Filter System section.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md and MEMORY.md for health services expansion"
```

---

## Task Dependency Graph

```
Tasks 1, 2, 3 (data JSON files) — PARALLEL, no dependencies
    ↓
Tasks 4, 5, 6 (insertion scripts) — PARALLEL, each depends on its JSON file
    ↓
Task 7 (run insertions live) — depends on all scripts + data files
    ↓
Tasks 8, 9 (embeddings + geocoding) — SEQUENTIAL after insertions
    ↓
Tasks 10-15 (search integration) — PARALLEL, no dependencies on each other
    ↓
Task 16 (evaluation queries) — after search integration
    ↓
Task 17 (end-to-end verification) — after everything
```

**Parallelization opportunities:**
- Tasks 1, 2, 3 can run as 3 parallel subagents (each doing web research for its track)
- Tasks 4, 5, 6 can run as 3 parallel subagents (each writing its script)
- Tasks 10-15 can run as parallel subagents (each modifying one file)
