# Database Cleanup: Fix Generic Service Names & Data Quality Issues

## Your Task

You are working on the ResourceHub project — a service directory for Alberta social services. The PostgreSQL database has ~840 active services. Many services have **generic names** that don't identify which organization hosts them. For example, a search for "domestic abuse" returns "Domestic Abuse Programs" — but users can't tell this is hosted by Calgary Counselling. The title should be **"Calgary Counselling - Domestic Abuse Programs"**.

Your job is to find and fix ALL remaining services with this problem, plus fix duplicates and other data quality issues.

## Database Access

Connection credentials are in `scraper/.env`. Use the `DATABASE_URL` value. The project uses `"type": "module"` in package.json, so write scripts as `.cjs` files (CommonJS) to use `require('pg')`.

Example connection:
```js
const pg = require('pg');
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || '<from scraper/.env>',
  ssl: { rejectUnauthorized: false }
});
```

## Schema

The key table is `services` (defined in `shared/schema.ts`). Relevant columns:
- `service_id` (VARCHAR 255, unique) — generated from name + location
- `name` (VARCHAR 500) — the service title displayed to users
- `category` (VARCHAR 255) — service type
- `description` (TEXT) — often mentions the hosting organization
- `website_url` (TEXT) — often points to the hosting organization's site
- `is_active` (BOOLEAN) — set to false to soft-delete
- `last_updated` (TIMESTAMP) — update when modifying

There is NO separate "organization" column. The org name must be part of `name`.

## What Was Already Fixed

A previous session fixed 38 services and deactivated 4 duplicates. The fix script is at `scripts/fix_service_names.cjs` — review it to see exactly what was already done. Do NOT re-apply those fixes.

## Detection Methodology

### Step 1: Find generic names

Query all active services and analyze their descriptions to find org names not reflected in the title. A detection script exists at `scripts/find_generic_names.cjs` — run it first to see if there are new issues.

Common patterns in descriptions that reveal the hosting org:
- `"OrgName offers/provides/runs/delivers..."` at the start
- `"offered/provided/operated by OrgName"` anywhere
- `"part of OrgName"` or `"program of OrgName"`
- The `website_url` domain often reveals the org (e.g., calgarycounselling.com → Calgary Counselling)

### Step 2: Find duplicates

Look for services where:
- `similarity(a.name, b.name) > 0.7` (PostgreSQL pg_trgm extension is installed)
- Same `website_url` but different names
- One has a generic name, the other has the org-prefixed name (keep the prefixed one)

### Step 3: Find other issues

- Typos in names (e.g., "Mustard Seed Womens" → missing apostrophe)
- Inconsistent formatting (some use " - ", some use " – ", some use nothing)
- Missing "The" prefix for orgs that use it formally
- "Center" vs "Centre" inconsistency (Canadian English should use "Centre")

## Fix Format

The naming convention is: **`Organization - Program Name`**

Examples:
- "Domestic Abuse Programs" → "Calgary Counselling - Domestic Abuse Programs"
- "Service Hub" → "Bissell Centre - Service Hub"
- "BounceBack" → "CMHA - BounceBack"
- "Emergency Shelter and Support Services" → "Hope Mission - Emergency Shelter and Support Services"

Rules:
- Use ` - ` (space-dash-space) as the separator
- If the org name is already well-known by abbreviation, use it (CMHA, AHS, YW Calgary)
- For AHS programs, prefix with "Alberta Health Services - ..."
- Don't over-prefix — if the name already clearly identifies the org, leave it
- Use Canadian English spelling (Centre not Center, Counselling not Counseling)

## Implementation

1. **Always dry-run first** — write your fix script with a `--dry-run` flag that prints changes without applying them
2. **Show me the dry-run output** before applying
3. **Update via SQL**: `UPDATE services SET name = $1, last_updated = NOW() WHERE service_id = $2`
4. **Deactivate duplicates**: `UPDATE services SET is_active = false, last_updated = NOW() WHERE service_id = $1`
5. **Verify after applying** — query the changed rows to confirm

## Verification

After applying fixes, run these checks:
```sql
-- Verify no remaining obvious generic names
SELECT name FROM services WHERE is_active = true
  AND name !~ '[A-Z].*-.*[A-Z]'
  AND LENGTH(name) < 30
  ORDER BY name;

-- Verify the user's original example is fixed
SELECT name FROM services WHERE name ILIKE '%domestic abuse%';

-- Count active services (should be close to 840, minus any deactivated dupes)
SELECT COUNT(*) FROM services WHERE is_active = true;
```

## Important Notes

- This is a **production database** — be careful, always dry-run first
- Only update `name` and `last_updated` — don't touch other fields
- Don't regenerate `service_id` — that would break foreign key references
- If unsure about the correct org name, check the `website_url` domain and `description` text
- The scraper may add new services with generic names in the future — this is a recurring cleanup task
