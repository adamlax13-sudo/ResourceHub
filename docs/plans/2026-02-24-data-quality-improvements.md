# Data Quality Improvements Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Systematically improve data quality by merging duplicates, improving service names, and enriching service data.

**Architecture:** Work through improvements in priority order using existing scripts (`merge-duplicates.ts`, `improve-service-names.ts`) with incremental additions. Each task adds entries to the appropriate script and executes them.

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL, tsx

---

## Task 1: Merge Same-Address Duplicates

These are services at the same address that appear to be duplicates (parent org + specific service listed separately).

**Files:**
- Modify: `scripts/merge-duplicates.ts:96-124` (add to KNOWN_DUPLICATES array)

**Step 1: Add McMan Youth Services duplicate**

The McMan Youth Family Services and McMan Family Intervention Services are at the same address - merge into the more specific one.

Add to KNOWN_DUPLICATES in `scripts/merge-duplicates.ts`:

```typescript
  // McMan Youth Services (same address - keep specific program)
  {
    canonical: 'mcman-youth-family-and-community-services-association-of-edmonton-and-north-region-family-intervention-services-12604-126-street-nw-edmonton-ab-t5l-0x6',
    duplicates: [
      'mcman-youth-family-and-community-services-association-of-edmonton-and-north-region-12604-126-street-nw-edmonton-ab-t5l-0x6',
    ],
  },
```

**Step 2: Add FCSS Fort Saskatchewan duplicate**

```typescript
  // FCSS Fort Saskatchewan (same address - keep specific program)
  {
    canonical: 'family-and-community-support-services-of-fort-saskatchewan-counselling-services-10005-102-street-fort-saskatchewan-ab-t8l-2c5',
    duplicates: [
      'family-and-community-support-services-of-fort-saskatchewan-10005-102-street-fort-saskatchewan-ab-t8l-2c5',
    ],
  },
```

**Step 3: Add FCSS Cold Lake duplicate**

```typescript
  // FCSS Cold Lake (same location - keep specific program)
  {
    canonical: 'family-and-community-support-services-of-cold-lake-and-district-counselling-service-cold-lake-ab',
    duplicates: [
      'family-and-community-support-services-of-cold-lake-and-district-cold-lake-ab',
    ],
  },
```

**Step 4: Add Wood Buffalo Food Bank duplicate**

```typescript
  // Wood Buffalo Food Bank (same address - keep specific program)
  {
    canonical: 'wood-buffalo-food-bank-association-food-hampers-10010-centennial-drive-fort-mcmurray-ab-t9h-4a2',
    duplicates: [
      'wood-buffalo-food-bank-association-10010-centennial-drive-fort-mcmurray-ab-t9h-4a2',
    ],
  },
```

**Step 5: Run dry-run to verify**

Run: `npx tsx scripts/merge-duplicates.ts`
Expected: Shows 4 new duplicate groups to process

**Step 6: Execute merge**

Run: `npx tsx scripts/merge-duplicates.ts --execute`
Expected: 4 duplicates deactivated, canonical services updated with merged data

**Step 7: Commit**

```bash
git add scripts/merge-duplicates.ts
git commit -m "data: merge same-address duplicate services (McMan, FCSS, Wood Buffalo)"
```

---

## Task 2: Review and Merge Recovery Centre Variants

These need careful review - some may be different programs (centre vs detox), others may be true duplicates.

**Files:**
- Modify: `scripts/merge-duplicates.ts` (add to KNOWN_DUPLICATES if confirmed duplicates)

**Step 1: Investigate Medicine Hat Recovery Centre**

Run this query to compare the two services:

```bash
npx tsx -e "
import 'dotenv/config';
import { db } from './server/db';
import { services } from '@shared/schema';
import { ilike } from 'drizzle-orm';

async function check() {
  const results = await db.select({
    serviceId: services.serviceId,
    name: services.name,
    description: services.description,
    category: services.category,
  }).from(services).where(ilike(services.name, '%Medicine Hat Recovery%'));

  for (const r of results) {
    console.log('---');
    console.log('ID:', r.serviceId);
    console.log('Name:', r.name);
    console.log('Category:', r.category);
    console.log('Description:', r.description?.substring(0, 200));
  }
  process.exit(0);
}
check();
"
```

If they are the same service (detox is just a program within the centre), add to KNOWN_DUPLICATES:

```typescript
  // Medicine Hat Recovery Centre (detox is program within centre)
  {
    canonical: 'medicine-hat-recovery-centre-medicine-hat',
    duplicates: [
      'medicine-hat-recovery-centre-detox-medicine-hat',
    ],
  },
```

**Step 2: Investigate Lethbridge Recovery Centre**

Same process - check if detox is a separate program or duplicate entry.

**Step 3: Investigate Calgary Dream Centre**

Check if "Calgary Dream Centre" and "Calgary Dream Centre Mens" should be merged or kept separate (men's program may be legitimately separate).

**Step 4: Run and execute if duplicates confirmed**

Run: `npx tsx scripts/merge-duplicates.ts --execute`

**Step 5: Commit**

```bash
git add scripts/merge-duplicates.ts
git commit -m "data: merge recovery centre duplicates after manual review"
```

---

## Task 3: Add Remaining Name Improvements

Add the 9 auto-detected AHS name improvements.

**Files:**
- Modify: `scripts/improve-service-names.ts:22-89` (add to NAME_IMPROVEMENTS array)

**Step 1: First verify the auto-detected candidates**

Run: `npx tsx scripts/improve-service-names.ts`

Review the 9 candidates in the output to confirm they make sense.

**Step 2: Add Rocky Mountain House Health Centre**

Add to NAME_IMPROVEMENTS:

```typescript
  // Rocky Mountain House Health Centre
  {
    serviceId: 'alberta-health-services-central-zone-addiction-counselling-rocky-mountain-house-ab',
    newName: 'Rocky Mountain House Health Centre - Addiction Counselling (AHS)',
    reason: 'Description mentions Rocky Mountain House Health Centre',
  },
```

**Step 3: Add Grande Prairie Aberdeen Centre**

```typescript
  // Grande Prairie Aberdeen Centre
  {
    serviceId: 'alberta-health-services-north-zone-complex-needs-program-grande-prairie-ab',
    newName: 'Grande Prairie Aberdeen Centre - Complex Needs (AHS)',
    reason: 'Description mentions Grande Prairie Aberdeen Centre',
  },
```

**Step 4: Add Banff Community Health Centre**

```typescript
  // Banff Community Health Centre
  {
    serviceId: 'alberta-health-services-calgary-zone-mental-health-services-banff-ab',
    newName: 'Banff Community Health Centre - Mental Health (AHS Calgary)',
    reason: 'Description mentions Banff Community Health Centre',
  },
```

**Step 5: Add remaining candidates**

Add entries for:
- Edmonton General Continuing Care Centre (Psychosocial Oncology)
- Elk Point Healthcare Centre (DART)
- The Recovery Centre Lethbridge (South Zone Detox)
- Geriatric Psychiatry Clinic Edmonton

**Step 6: Run dry-run**

Run: `npx tsx scripts/improve-service-names.ts`
Expected: Shows all new improvements with PROPOSED names

**Step 7: Execute**

Run: `npx tsx scripts/improve-service-names.ts --execute`
Expected: All services updated

**Step 8: Commit**

```bash
git add scripts/improve-service-names.ts
git commit -m "data: improve 9 additional AHS service names with facility names"
```

---

## Task 4: Add 24/7 Flags to Crisis Services

Identify crisis services that should have `is24_7: true` but don't.

**Files:**
- Create: `scripts/flag-24-7-services.ts`

**Step 1: Create the script**

Create `scripts/flag-24-7-services.ts`:

```typescript
/**
 * Flag services as 24/7 based on description/name patterns
 */
import 'dotenv/config';
import { db } from '../server/db';
import { services } from '@shared/schema';
import { eq, and, or, ilike, isNull } from 'drizzle-orm';

const PATTERNS_24_7 = [
  '%24/7%',
  '%24 hour%',
  '%24-hour%',
  '%around the clock%',
  '%24 hours a day%',
  '%available anytime%',
];

async function flag247Services(dryRun: boolean = true) {
  console.log('='.repeat(60));
  console.log('24/7 SERVICE FLAGGER');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Find services mentioning 24/7 in name or description
  const conditions = PATTERNS_24_7.map(p =>
    or(ilike(services.name, p), ilike(services.description, p))
  );

  const candidates = await db.select({
    serviceId: services.serviceId,
    name: services.name,
    is24_7: services.is24_7,
  })
  .from(services)
  .where(and(
    eq(services.isActive, true),
    or(...conditions),
    or(isNull(services.is24_7), eq(services.is24_7, false))
  ))
  .limit(100);

  console.log(`\nFound ${candidates.length} services to flag as 24/7:\n`);

  for (const svc of candidates) {
    console.log(`- ${svc.name}`);

    if (!dryRun) {
      await db.update(services)
        .set({ is24_7: true })
        .where(eq(services.serviceId, svc.serviceId));
    }
  }

  if (dryRun && candidates.length > 0) {
    console.log(`\nRun with --execute to flag ${candidates.length} services`);
  }

  process.exit(0);
}

const dryRun = !process.argv.includes('--execute');
flag247Services(dryRun).catch(console.error);
```

**Step 2: Run dry-run**

Run: `npx tsx scripts/flag-24-7-services.ts`
Expected: Lists services that will be flagged

**Step 3: Execute**

Run: `npx tsx scripts/flag-24-7-services.ts --execute`

**Step 4: Commit**

```bash
git add scripts/flag-24-7-services.ts
git commit -m "data: add script to flag 24/7 services and apply to existing data"
```

---

## Task 5: Standardize Phone Number Formatting

Create script to normalize phone numbers to consistent format.

**Files:**
- Create: `scripts/normalize-phones.ts`

**Step 1: Create the script**

Create `scripts/normalize-phones.ts`:

```typescript
/**
 * Normalize phone numbers to consistent format: (XXX) XXX-XXXX
 */
import 'dotenv/config';
import { db } from '../server/db';
import { services } from '@shared/schema';
import { eq, and, isNotNull, ne } from 'drizzle-orm';

function normalizePhone(phone: string): string | null {
  // Extract digits
  const digits = phone.replace(/\D/g, '');

  // Handle 10-digit numbers
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // Handle 11-digit (1 + 10)
  if (digits.length === 11 && digits.startsWith('1')) {
    const local = digits.slice(1);
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }

  // Return null if can't normalize
  return null;
}

async function normalizePhones(dryRun: boolean = true) {
  console.log('='.repeat(60));
  console.log('PHONE NUMBER NORMALIZER');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  const allServices = await db.select({
    serviceId: services.serviceId,
    phone: services.phone,
  })
  .from(services)
  .where(and(
    eq(services.isActive, true),
    isNotNull(services.phone),
    ne(services.phone, '')
  ));

  let updated = 0;
  for (const svc of allServices) {
    if (!svc.phone) continue;

    const normalized = normalizePhone(svc.phone);
    if (normalized && normalized !== svc.phone) {
      console.log(`${svc.phone} → ${normalized}`);
      updated++;

      if (!dryRun) {
        await db.update(services)
          .set({ phone: normalized })
          .where(eq(services.serviceId, svc.serviceId));
      }
    }
  }

  console.log(`\n${updated} phone numbers to normalize`);
  if (dryRun && updated > 0) {
    console.log(`Run with --execute to apply changes`);
  }

  process.exit(0);
}

const dryRun = !process.argv.includes('--execute');
normalizePhones(dryRun).catch(console.error);
```

**Step 2: Run dry-run**

Run: `npx tsx scripts/normalize-phones.ts`

**Step 3: Execute**

Run: `npx tsx scripts/normalize-phones.ts --execute`

**Step 4: Commit**

```bash
git add scripts/normalize-phones.ts
git commit -m "data: normalize phone numbers to (XXX) XXX-XXXX format"
```

---

## Task 6: Bump Cache Version

After all data changes, ensure cache is invalidated.

**Files:**
- Modify: `server/search/index.ts:10`

**Step 1: Update cache version**

Change:
```typescript
const CACHE_VERSION = 'v59';
```
To:
```typescript
const CACHE_VERSION = 'v60';
```

**Step 2: Commit all changes**

```bash
git add server/search/index.ts
git commit -m "chore: bump cache version to v60 after data quality improvements"
```

---

## Task 7: Verify Data Quality

Run final verification to confirm improvements.

**Step 1: Run duplicate detection**

Run: `npx tsx scripts/detect-duplicates.ts`

Expected: Fewer exact/similar duplicates than before

**Step 2: Run search evaluation**

Run: `npx tsx scripts/eval/run-eval.ts`

Expected: Scores maintained or improved

**Step 3: Spot-check renamed services**

Search for a few of the renamed services to verify they appear correctly in results.

---

## Summary

| Task | Action | Count |
|------|--------|-------|
| 1 | Merge same-address duplicates | 4 |
| 2 | Review recovery centre variants | 2-4 |
| 3 | Add AHS name improvements | 9 |
| 4 | Flag 24/7 services | ~20 |
| 5 | Normalize phone numbers | ~100 |
| 6 | Bump cache version | 1 |
| 7 | Verify improvements | - |

Total estimated duplicates removed: 6-8
Total services improved: ~130
