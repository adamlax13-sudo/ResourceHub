/**
 * Duplicate Service Merger
 *
 * Identifies and merges true duplicate services while preserving
 * legitimate distinct programs from the same organization.
 *
 * A duplicate is defined as:
 * - Same organization + same service type + same/similar location
 * - NOT just same phone number (orgs have multiple programs on same phone)
 */

import 'dotenv/config';
import { db } from '../server/db';
import { services, deduplicationLog } from '@shared/schema';
import { eq, sql, and, ilike } from 'drizzle-orm';

interface DuplicateGroup {
  canonical: ServiceRecord;
  duplicates: ServiceRecord[];
  reason: string;
}

interface ServiceRecord {
  id: number;
  serviceId: string;
  name: string;
  category: string;
  description: string | null;
  location: string | null;
  phone: string | null;
  address: string | null;
  websiteUrl: string | null;
  email: string | null;
  contact: string | null;
}

// Known duplicate patterns - manually identified
const KNOWN_DUPLICATES: { canonical: string; duplicates: string[] }[] = [
  // Alpha House detox duplicates
  {
    canonical: 'alpha-house-detox-transitional-calgary-203-15-ave-se',
    duplicates: [
      'alpha-house-calgary-detox-calgary-203-15-ave-se',
      'calgary-alpha-house-society-detoxification-and-transitional-bed-program-calgary',
    ],
  },
  // Alpha House shelter duplicates
  {
    canonical: 'alpha-house-shelter-calgary-203-15-ave-se',
    duplicates: [
      'alpha-house-society-calgary-calgary-203-15-ave-se',
    ],
  },
  // Akokatssini duplicates (spelling variation)
  {
    canonical: 'akokatssini-medical-detox-brocket-brocket',
    duplicates: [
      'akoka-tssini-medical-detox-brocket-brocket',
    ],
  },
  // Lander Treatment Centre duplicates
  {
    canonical: 'lander-treatment-centre-claresholm',
    duplicates: [
      'lander-treatment-centre-ahs-claresholm-221-fairway-dr',
    ],
  },
  // Wood's Homes duplicates
  {
    canonical: 'wood-s-homes-calgary-ab',
    duplicates: [
      'wood-s-homes-112-16-avenue-ne-calgary-ab-t2e-1j5',
    ],
  },
  // CMHA Edmonton Live Crisis Chat duplicates
  {
    canonical: 'canadian-mental-health-association-edmonton-region-live-crisis-chat-edmonton',
    duplicates: [
      'live-crisis-chat-cmha-edmonton-region-edmonton-ab',
    ],
  },
  // Distress Line duplicates
  {
    canonical: 'distress-and-suicide-prevention-line-of-southwestern-alberta-lethbridge-ab',
    duplicates: [
      'distress-and-suicide-prevention-line-of-southwestern-alberta-cmha-alberta-south-region-lethbridge-ab',
    ],
  },
  // Thorpe Recovery Centre duplicates (AHS generic name)
  {
    canonical: 'thorpe-recovery-centre-medically-supported-detox-box-291-rr-21-21060-tranquility-way-blackfoot-ab-t0b-0l0',
    duplicates: [
      'alberta-health-services-central-zone-addiction-services-adult-detoxification-box-291-rr-21-21060-tranquility-way-blackfoot-ab-t0b-0l0',
    ],
  },
  // Alpha House Shelter (AHS generic entry)
  {
    canonical: 'alpha-house-shelter-calgary-203-15-ave-se',
    duplicates: [
      'alberta-health-services-calgary-zone-addiction-services-shelters-calgary',
    ],
  },
  // Fort McMurray Recovery Centre (created by name improvement)
  {
    canonical: 'alberta-health-services-north-zone-addiction-services-adult-residential-451-sakitawaw-trail-fort-mcmurray-ab-t9h-4p3',
    duplicates: [
      'fort-mcmurray-recovery-centre-fort-mcmurray',
    ],
  },
  // EHN Sandstone Recovery duplicates
  {
    canonical: 'ehn-sandstone-recovery-centre-calgary-calgary',
    duplicates: [
      'ehn-sandstone-recovery-calgary-calgary',
    ],
  },
  // CMHA Mobile Addictions Outreach duplicates
  {
    canonical: 'canadian-mental-health-association-alberta-northwest-region-mobile-addictions-outreach-grande-prairie-ab',
    duplicates: [
      'mobile-addictions-outreach-canadian-mental-health-association-cmha-alberta-northwest-region-grande-prairie-ab',
    ],
  },
  // McMan Youth Services (same address - keep specific program)
  {
    canonical: 'mcman-youth-family-and-community-services-association-of-edmonton-and-north-region-family-intervention-services-12604-126-street-nw-edmonton-ab-t5l-0x6',
    duplicates: [
      'mcman-youth-family-and-community-services-association-of-edmonton-and-north-region-12604-126-street-nw-edmonton-ab-t5l-0x6',
    ],
  },
  // FCSS Fort Saskatchewan (same address - keep specific program)
  {
    canonical: 'family-and-community-support-services-of-fort-saskatchewan-counselling-services-10005-102-street-fort-saskatchewan-ab-t8l-2c5',
    duplicates: [
      'family-and-community-support-services-of-fort-saskatchewan-10005-102-street-fort-saskatchewan-ab-t8l-2c5',
    ],
  },
  // FCSS Cold Lake (same location - keep specific program)
  {
    canonical: 'family-and-community-support-services-of-cold-lake-and-district-counselling-service-cold-lake-ab',
    duplicates: [
      'family-and-community-support-services-of-cold-lake-and-district-cold-lake-ab',
    ],
  },
  // Wood Buffalo Food Bank (same address - keep specific program)
  {
    canonical: 'wood-buffalo-food-bank-association-food-hampers-10010-centennial-drive-fort-mcmurray-ab-t9h-4a2',
    duplicates: [
      'wood-buffalo-food-bank-association-10010-centennial-drive-fort-mcmurray-ab-t9h-4a2',
    ],
  },
  // Medicine Hat Recovery Centre (detox is program within centre, duplicate has invalid phone 111-0507)
  {
    canonical: 'medicine-hat-recovery-centre-medicine-hat',
    duplicates: [
      'medicine-hat-recovery-centre-detox-medicine-hat',
    ],
  },
  // Calgary Dream Centre (men's program is subset of main centre, same phone)
  {
    canonical: 'calgary-dream-centre-calgary',
    duplicates: [
      'calgary-dream-centre-mens-calgary',
    ],
  },
  // NOTE: Lethbridge Recovery Centre and Detox are NOT duplicates
  // They have different phones ((403) 328-0955 vs (403) 388-6243)
  // and the Detox variant is specifically a youth program (ages 12-19)
];

async function findDuplicatesToMerge(): Promise<DuplicateGroup[]> {
  const groups: DuplicateGroup[] = [];

  for (const known of KNOWN_DUPLICATES) {
    // Get canonical service
    const [canonical] = await db.select()
      .from(services)
      .where(and(
        eq(services.serviceId, known.canonical),
        eq(services.isActive, true)
      ))
      .limit(1);

    if (!canonical) {
      console.log(`⚠️ Canonical service not found: ${known.canonical}`);
      continue;
    }

    // Get duplicate services
    const duplicateServices: ServiceRecord[] = [];
    for (const dupId of known.duplicates) {
      const [dup] = await db.select()
        .from(services)
        .where(and(
          eq(services.serviceId, dupId),
          eq(services.isActive, true)
        ))
        .limit(1);

      if (dup) {
        duplicateServices.push(dup as ServiceRecord);
      }
    }

    if (duplicateServices.length > 0) {
      groups.push({
        canonical: canonical as ServiceRecord,
        duplicates: duplicateServices,
        reason: 'manually_identified',
      });
    }
  }

  return groups;
}

function mergeServiceData(canonical: ServiceRecord, duplicates: ServiceRecord[]): Partial<ServiceRecord> {
  // Merge data from all duplicates into canonical, preferring longer/better data
  const merged: Partial<ServiceRecord> = {};

  // Prefer longer description
  const allDescriptions = [canonical.description, ...duplicates.map(d => d.description)].filter(Boolean);
  if (allDescriptions.length > 0) {
    merged.description = allDescriptions.reduce((a, b) =>
      (a?.length || 0) > (b?.length || 0) ? a : b
    );
  }

  // Prefer more specific location
  const allLocations = [canonical.location, ...duplicates.map(d => d.location)].filter(Boolean);
  if (allLocations.length > 0) {
    merged.location = allLocations.reduce((a, b) =>
      (a?.length || 0) > (b?.length || 0) ? a : b
    );
  }

  // Take any phone if canonical doesn't have one
  if (!canonical.phone) {
    merged.phone = duplicates.find(d => d.phone)?.phone || null;
  }

  // Take any email if canonical doesn't have one
  if (!canonical.email) {
    merged.email = duplicates.find(d => d.email)?.email || null;
  }

  // Take any address if canonical doesn't have one
  if (!canonical.address) {
    merged.address = duplicates.find(d => d.address)?.address || null;
  }

  // Take any website if canonical doesn't have one
  if (!canonical.websiteUrl) {
    merged.websiteUrl = duplicates.find(d => d.websiteUrl)?.websiteUrl || null;
  }

  return merged;
}

async function mergeDuplicates(dryRun: boolean = true) {
  console.log('='.repeat(60));
  console.log('DUPLICATE SERVICE MERGER');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will modify database)'}`);
  console.log('='.repeat(60));

  const groups = await findDuplicatesToMerge();

  console.log(`\nFound ${groups.length} duplicate groups to process\n`);

  for (const group of groups) {
    console.log('-'.repeat(50));
    console.log(`CANONICAL: ${group.canonical.name}`);
    console.log(`  ID: ${group.canonical.serviceId}`);
    console.log(`  Location: ${group.canonical.location}`);
    console.log(`\nDUPLICATES TO MERGE:`);
    for (const dup of group.duplicates) {
      console.log(`  - ${dup.name}`);
      console.log(`    ID: ${dup.serviceId}`);
    }

    // Calculate merged data
    const mergedData = mergeServiceData(group.canonical, group.duplicates);
    if (Object.keys(mergedData).length > 0) {
      console.log(`\nDATA TO MERGE INTO CANONICAL:`);
      for (const [key, value] of Object.entries(mergedData)) {
        if (value) {
          console.log(`  ${key}: ${String(value).substring(0, 60)}...`);
        }
      }
    }

    if (!dryRun) {
      // Update canonical with merged data
      if (Object.keys(mergedData).length > 0) {
        await db.update(services)
          .set(mergedData)
          .where(eq(services.serviceId, group.canonical.serviceId));
        console.log(`\n✅ Updated canonical service with merged data`);
      }

      // Deactivate duplicates and log
      for (const dup of group.duplicates) {
        await db.update(services)
          .set({ isActive: false })
          .where(eq(services.serviceId, dup.serviceId));

        await db.insert(deduplicationLog).values({
          keptServiceId: group.canonical.serviceId,
          removedServiceId: dup.serviceId,
          duplicateType: group.reason,
          matchValue: dup.name,
          reason: `Merged into ${group.canonical.name}`,
        });

        console.log(`✅ Deactivated duplicate: ${dup.name}`);
      }
    } else {
      console.log(`\n[DRY RUN] Would deactivate ${group.duplicates.length} duplicate(s)`);
    }

    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`Summary: ${groups.length} duplicate groups`);
  console.log(`Total duplicates to remove: ${groups.reduce((sum, g) => sum + g.duplicates.length, 0)}`);
  if (dryRun) {
    console.log(`\nRun with --execute to apply changes`);
  }
}

// Check command line args
const dryRun = !process.argv.includes('--execute');
mergeDuplicates(dryRun).then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
