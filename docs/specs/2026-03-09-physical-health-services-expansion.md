# Physical Health Services Expansion — Design Spec

**Date:** 2026-03-09
**Status:** Approved

## Overview

Expand the ResourceHub database to include physical health services across Alberta. Three tracks:

1. **Hospitals & Emergency Rooms** (~35-40 services) — new `"Hospital & Emergency"` category
2. **Free/Drop-in Health Clinics** (~15-20 services) — existing `"Healthcare Access"` category
3. **Health Coverage & Accessibility Programs** (~15 services) — existing `"Healthcare Access"` category

Current state: 1,348 active services. Zero hospitals/ERs. "Healthcare Access" has 24 services (community health centres, dental, disease-specific). Missing major government programs (AADL, Coverage for Seniors, RAMP, etc.).

## Track 1: Hospitals & Emergency Rooms

### New Category: `"Hospital & Emergency"`

Placed in the "Crisis & Safety" filter group in RefinePanel (alongside Crisis Services, Crisis Lines, Domestic Violence Support, Human Trafficking Support).

### Service Data Shape

All hospitals share:

| Field | Value |
|-------|-------|
| `category` | `"Hospital & Emergency"` |
| `hours_of_operation` | `"24 hours a day, 7 days a week"` |
| `is_24_7` | `true` |
| `eligibility` | `"All Alberta residents. No referral needed for emergency department."` |
| `required_docs` | `["Alberta Health Care card", "Government-issued photo ID"]` |
| `process_steps` | `["Go directly to the emergency department", "Check in at triage", "Wait times vary based on severity — life-threatening cases seen immediately"]` |
| `wait_times` | `"Varies by severity and volume. Life-threatening emergencies seen immediately."` |
| `confidence_score` | `95` |
| `age_group` | `null` (serves everyone) |
| `gender_restriction` | `null` (serves everyone) |

Per-hospital research: name, address, phone, website URL, description (specializations, trauma centre status, notable programs).

### Naming Convention

Official hospital name only, no em-dash descriptor (since the entry represents the whole facility):
- `"Foothills Medical Centre"`
- `"University of Alberta Hospital"`
- `"Red Deer Regional Hospital Centre"`

### Tags

Base tags for all hospitals: `["emergency", "hospital", "24/7", "trauma", "urgent care"]`
Plus facility-specific tags: `["children"]`, `["psychiatric"]`, `["rehabilitation"]`, `["trauma centre"]`, etc.

### Scope

All Alberta hospitals with emergency departments. Estimated ~35-40 facilities including:
- Edmonton: University of Alberta Hospital, Royal Alexandra Hospital, Misericordia Community Hospital, Grey Nuns Community Hospital, Sturgeon Community Hospital (St. Albert)
- Calgary: Foothills Medical Centre, Rockyview General Hospital, Peter Lougheed Centre, South Health Campus, Alberta Children's Hospital
- Regional: Red Deer Regional Hospital Centre, Chinook Regional Hospital (Lethbridge), Medicine Hat Regional Hospital, Queen Elizabeth II Hospital (Grande Prairie), Northern Lights Regional Health Centre (Fort McMurray)
- Plus ~20-25 community hospitals across smaller centres

Source: AHS facility directory pages (authoritative, standardized).

## Track 2: Free/Drop-in Health Clinics

### Scope

Three subtypes (NOT regular walk-in medical clinics — those are private businesses better served by Google Maps):

1. **AHS Community Health Centres** — free, publicly funded (immunizations, prenatal, chronic disease management)
2. **Charitable/low-barrier clinics** — serve vulnerable populations regardless of coverage (beyond what we already have: CUPS, The Alex, Radius, Sheldon Chumir)
3. **Specialized free clinics** — immunization clinics, TB clinics, etc.

### Data Accuracy

Each clinic requires individual research (no templates). Per-clinic fields verified from primary sources:
- Official website (primary source of truth, NOT 211 listings)
- Services offered (medical, dental, both, specialized)
- Eligibility (anyone? low-income? population-specific?)
- Hours (many are limited — e.g. Tuesday/Thursday only)
- Cost (free? sliding scale? specific items free?)
- Address, phone, intake process

If a field can't be verified from the clinic's own website or a trusted source (211, AHS directory), it gets `null`. `confidence_score` set based on source quality: 90+ for own website, 70-80 for 211-only.

### Category

`"Healthcare Access"` (existing).

## Track 3: Health Coverage & Accessibility Programs

### Scope

Every program requires individual research — eligibility, application steps, required docs, and wait times all vary significantly per program.

**Coverage Programs:**
- Coverage for Seniors Program (premium-free prescription drug coverage, 65+)
- Seniors Health Benefit (dental, optical, prescriptions, ambulance)
- AADL — Alberta Aids to Daily Living (wheelchairs, walkers, prosthetics, oxygen)
- Alberta Blue Cross Non-Group Coverage (anyone without employer insurance)
- AISH health benefits (prescriptions, dental, optical for AISH recipients)
- Palliative/end-of-life drug coverage
- NIHB — Non-Insured Health Benefits (Indigenous peoples)
- Interim Federal Health Program (refugees)

**Accessibility & Home Modification:**
- RAMP — Residential Access Modification Program (up to $7,500-$12,000/yr)
- SHARP — Seniors Home Adaptation and Repair Program (up to $40,000 loan)
- Home Accessibility Tax Credit (up to $20,000 claim)
- Easter Seals AccessABILITIES Home Automation Program
- Alberta Disability Assistance Program (launching July 2026)

### Data Accuracy — No Templates

Each program gets its own research session against alberta.ca or the administering body's site. Example of how fields vary:

**RAMP:** eligibility = "Alberta residents with permanent mobility limitations"; process = OT assessment → renovation quotes → application → approval → modifications; required_docs = OT assessment, renovation quotes, proof of income

**Coverage for Seniors:** eligibility = "Alberta residents aged 65+"; process = automatic once you turn 65 with active AHCIP — no application needed; required_docs = Alberta Health Care card

### Category

`"Healthcare Access"` (existing). Seniors-specific programs tagged with `["senior"]` for age filter routing.

## Implementation Pipeline

### Phase 1: Research & Data Collection

Three parallel research tracks producing JSON data files:

| Track | Count | Primary Sources | Output |
|-------|-------|-----------------|--------|
| Hospitals/ERs | ~35-40 | AHS facility directory, hospital websites | `scripts/data/hospitals.json` |
| Free clinics | ~15-20 | Clinic websites, 211 Alberta | `scripts/data/clinics.json` |
| Programs | ~15 | alberta.ca, program-specific sites | `scripts/data/health-programs.json` |

### Phase 2: Insertion Scripts

Three `.mjs` scripts following existing patterns (`pg.Pool`, `DRY_RUN=true` default, `ssl: { rejectUnauthorized: false }`):

- `scripts/add-hospitals.mjs`
- `scripts/add-health-clinics.mjs`
- `scripts/add-health-programs.mjs`

Each script:
1. Generates `service_id` slug from name (e.g. `"foothills-medical-centre"`)
2. Checks for duplicates by name before inserting
3. Sets `field_sources` to `{"source": "manual-script-2026-03"}` (prevents scraper overwrite)
4. Sets all metadata: tags, confidence_score, source_urls (as jsonb array), etc.
5. Formats `process_steps` and `required_docs` as `string[]` (consistent with `parseArrayField`)
6. DRY_RUN mode first, real run on confirmation

### Phase 3: Post-Insert Pipeline

Run in sequence after all insertions:

1. `scripts/batch-geocode-services.mjs` — geocode new services via Mapbox
2. Generate embeddings for new services — following exact composition format:
   ```
   Service: {name}\nCategory: {category}\nThis is a {category} service.\nDescription: {desc}\nEligibility: {elig}\nLocation: {loc}\nTags: {tags}
   ```
   (20k char limit, category repetition for cross-category separation)
3. `scripts/refresh-search-view.mjs` — refresh `mv_service_search` materialized view
4. Bump cache version in `server/search/index.ts` (v106 → v107)

### Phase 4: Search Integration

**RefinePanel (`client/src/components/RefinePanel.tsx`):**
- Add `"Hospital & Emergency"` to `CATEGORY_GROUPS` under the "Crisis & Safety" group

**Intent routing (`server/search/index.ts`):**
- Add `"Hospital & Emergency"` to `INTENT_CATEGORY_NAMES` for `healthcare_access`:
  ```ts
  healthcare_access: new Set(['Healthcare Access', 'Sexual Health Services', 'Hospital & Emergency']),
  ```

**Domain patterns (`server/search/config/analysis.ts`):**
- Add to `healthcare_access` domain patterns:
  ```ts
  /\b(?:hospital|emergency room|emergency department|ER|urgent care)\b/i,
  ```

**LLM intent prompt (`server/search/llm-intent.ts`):**
- Update healthcare_access description:
  ```
  - healthcare_access: doctor, walk-in clinic, dental, medical, hospital, ER, emergency room, prescriptions, accessibility programs
  ```

**Keyword expansion (`server/helpers/keywords.ts`):**
- Add synonym mappings: ER → emergency room / emergency department, AADL → aids to daily living, RAMP → residential access modification program, AISH → assured income severely handicapped, SHARP → seniors home adaptation repair program

**Intent boost patterns (`server/search/strategies/scoring/intent-boost.ts`):**
- Add "emergency room", "emergency department", "ER" to healthcare_access categoryPatterns (already has "hospital")

### Phase 5: Evaluation & Testing

**Add test queries to evaluation suite:**
- `server/evaluation/comprehensive_test_queries.ts`: hospital queries, free clinic queries, health program queries
- `server/evaluation/ci_runner.mjs`: add 3-5 deterministic test queries with thresholds

**Queries to test:**
- "hospitals near me", "nearest ER", "emergency room calgary"
- "free clinic edmonton", "walk in clinic no health card"
- "help paying for prescriptions", "wheelchair program alberta", "home modification disability"
- "AADL", "RAMP program", "seniors drug coverage"

**Manual verification:**
- `npx tsx server/evaluation/diagnose_query.ts "hospitals near me"`
- Spot-check geocoding accuracy for hospitals (exact addresses should geocode precisely)
- Verify filter UI shows new category correctly

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hospital category | New `"Hospital & Emergency"` | Distinct search intent, cleaner filters, better routing |
| Category placement | Crisis & Safety group | People search for hospitals in emergencies |
| One entry per hospital | Yes (not separate ER entries) | Avoids duplication, description covers ER |
| Naming convention | Official name, no em-dash | Hospitals are the whole facility |
| Regular walk-in clinics | Excluded | Private businesses, hundreds of them, better served by Google Maps |
| Implementation method | Research-then-script | Stable data, finite scope, follows existing 60+ script pattern |
| No new QueryIntent | Reuse `healthcare_access` | Already matches hospital/clinic/prescription patterns |
