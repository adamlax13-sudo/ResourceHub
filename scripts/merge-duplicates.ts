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
  // Lander Treatment Centre (AHS generic "Calgary Zone" entry duplicates proper facility name)
  {
    canonical: 'lander-treatment-centre-claresholm',
    duplicates: [
      'alberta-health-services-calgary-zone-addiction-and-mental-health-residential-treatment-services-adult-calgary',
    ],
  },
  // Elk Point DART (AHS generic entry duplicates proper facility name)
  {
    canonical: 'alberta-health-services-provincial-health-services-addiction-and-mental-health-domestic-abuse-response-team-5310-50-avenue-elk-point-ab-t0a-1a0',
    duplicates: [
      'addiction-and-mental-health-domestic-abuse-response-team-elk-point',
    ],
  },
  // Indigenous Mental Health Program (AHS generic entry duplicates existing)
  {
    canonical: 'ahs-indigenous-mental-health-program-calgary',
    duplicates: [
      'alberta-health-services-calgary-zone-indigenous-mental-health-program-1213-4-street-sw-calgary-ab-t2r-0x7',
    ],
  },
  // CAST Edmonton (AHS generic entry duplicates existing)
  {
    canonical: 'addiction-and-mental-health-crisis-and-stabilization-team-for-children-and-youth-cast-12803-116-avenue-nw-edmonton-ab-t5m-3c8',
    duplicates: [
      'alberta-health-services-edmonton-zone-addiction-and-mental-health-crisis-and-stabilization-team-for-children-and-youth-cast-12803-116-avenue-nw-edmonton-ab-t5m-3c8',
    ],
  },
  // Edmonton Adult Detox (AHS generic entry duplicates existing)
  {
    canonical: 'ahs-adult-detox-17-edmonton-area',
    duplicates: [
      'alberta-health-services-edmonton-zone-addiction-and-mental-health-detoxification-services-adult-edmonton-ab',
    ],
  },
  // Pastew Place / Fort McMurray Day Treatment (same address, same service)
  {
    canonical: 'pastew-place-detox-centre-alberta',
    duplicates: [
      'alberta-health-services-north-zone-addiction-services-adult-day-treatment-505-sakitawaw-trail-s-fort-mcmurray-ab-t9h-4p3',
    ],
  },
  // Police and Crisis Team Medicine Hat (AHS generic entry duplicates existing)
  {
    canonical: 'addiction-and-mental-health-police-and-crisis-team-adult-666-5-street-sw-medicine-hat-ab-t1a-4h6',
    duplicates: [
      'alberta-health-services-south-zone-police-and-crisis-team-adult-666-5-street-sw-medicine-hat-ab-t1a-4h6',
    ],
  },
  // NOTE: Lethbridge Recovery Centre and Detox are NOT duplicates
  // They have different phones ((403) 328-0955 vs (403) 388-6243)
  // and the Detox variant is specifically a youth program (ages 12-19)

  // --- New duplicates identified March 2026 ---

  // YW Calgary Transitional Housing / Shelter (same phone, same service)
  {
    canonical: 'yw-calgary-transitional-housing-110-11-avenue-se-calgary-ab-t2g-0x5',
    duplicates: [
      'yw-calgary-transitional-shelter-calgary-ab',
    ],
  },
  // HIV Edmonton - Support and Outreach (exact name, phone, address, website match)
  {
    canonical: 'hiv-edmonton-support-and-outreach-9702-111-avenue-edmonton-ab-t5g-0b1',
    duplicates: [
      'support-and-outreach-9702-111-avenue-edmonton-ab-t5g-0b1',
    ],
  },
  // Lethbridge Recovery Centre Detox (same facility, different name styles)
  {
    canonical: 'lethbridge-recovery-centre-detox-lethbridge',
    duplicates: [
      'alberta-health-services-south-zone-addiction-services-adult-detoxification-960-19-street-s-lethbridge-ab-t1j-1w5',
    ],
  },
  // Social Programs and Initiatives Grande Prairie (same service, two entries)
  {
    canonical: 'social-programs-and-initiatives-grande-prairie-ab',
    duplicates: [
      'social-programs-and-initiatives-12106-100-street-grande-prairie-ab-t8v-5p1',
    ],
  },
  // CASA Mental Health (Edmonton entry is subset of Calgary+Edmonton entry)
  {
    canonical: 'casa-mental-health-calgary-and-edmonton',
    duplicates: [
      'casa-mental-health-edmonton-edmonton',
    ],
  },
  // Métis Child and Family Services - Avenue Program (two entries for same program)
  {
    canonical: 'metis-child-and-family-services-society-edmonton-avenue-program-edmonton-ab',
    duplicates: [
      'avenue-program-edmonton-ab',
    ],
  },
  // George Spady Society (three entries for same facility — detox and meals variants)
  {
    canonical: 'george-spady-society-edmonton-edmonton',
    duplicates: [
      'george-spady-society-detox-edmonton',
      'george-spady-centre-edmonton',
    ],
  },
  // WIN House Edmonton (three entries for same women's shelter)
  {
    canonical: 'win-house-edmonton-3-locations-edmonton-3-locations',
    duplicates: [
      'win-house-edmonton-edmonton-3-locations',
      'women-in-need-iii-edmonton-ab',
    ],
  },
  // Women's Emergency Accommodation Centre / WEAC (same shelter, acronym variant)
  {
    canonical: 'women-s-emergency-accommodation-centre-9611-101a-avenue-nw-edmonton-ab-t5h-0c8',
    duplicates: [
      'weac-edmonton-edmonton',
    ],
  },
  // Thorpe Recovery Centre Blackfoot (two entries for same residential treatment)
  {
    canonical: 'thorpe-recovery-centre-residential-addiction-treatment-box-291-rr-21-21060-tranquility-way-blackfoot-ab-t0b-0l0',
    duplicates: [
      'thorpe-recovery-centre-blackfoot-blackfoot',
    ],
  },
  // Northern Addictions Centre Grande Prairie (AHS short name vs full entry)
  {
    canonical: 'alberta-health-services-north-zone-addiction-services-adult-residential-grande-prairie-alberta',
    duplicates: [
      'northern-addictions-centre-northern-alberta',
    ],
  },
  // Mustard Seed Women's Shelter Calgary (two entries, same shelter)
  {
    canonical: 'mustard-seed-womens-calgary-110-11-ave-se',
    duplicates: [
      'mustard-seed-calgary-110-11-avenue-se-calgary-ab-t2g-0x5',
    ],
  },
  // Mustard Seed Red Deer (general entry and shelter entry for same location)
  {
    canonical: 'mustard-seed-red-deer-6002-54-avenue-red-deer-ab-t4n-4m8',
    duplicates: [
      'mustard-seed-shelter-6002-54-avenue-red-deer-ab-t4n-4m8',
    ],
  },
  // Addiction Services - Prevention Fort McMurray (AHS long name vs short name)
  {
    canonical: 'addiction-services-prevention-339-powder-drive-fort-mcmurray-ab-t9k-0m4',
    duplicates: [
      'alberta-health-services-north-zone-addiction-services-prevention-339-powder-drive-fort-mcmurray-ab-t9k-0m4',
    ],
  },
  // Addiction Services Adult Day Treatment Red Deer (AHS long name vs short name)
  {
    canonical: 'alberta-health-services-central-zone-addiction-services-adult-day-treatment-4733-49-street-red-deer-ab-t4n-1t6',
    duplicates: [
      'addiction-services-adult-day-treatment-4733-49-street-red-deer-ab-t4n-1t6',
    ],
  },
  // Alpha House HELP Team (same outreach team, different name style)
  {
    canonical: 'calgary-alpha-house-society-help-team-203-15-avenue-se-calgary-ab-t2g-1g4',
    duplicates: [
      'help-team-calgary-calgary-mobile-outreach',
    ],
  },
  // Alpha House Needle Response / Needle Debris Program (same program)
  {
    canonical: 'alpha-house-needle-response-ambassador-teams-calgary',
    duplicates: [
      'calgary-alpha-house-society-needle-debris-program-203-15-avenue-se-calgary-ab-t2g-1g4',
    ],
  },
  // Aura Housing / Trellis Aura (same housing program)
  {
    canonical: 'aura-housing-calgary-calgary',
    duplicates: [
      'trellis-aura-938-15-avenue-sw-calgary-ab-t2r-0s3',
    ],
  },
  // Medicine Hat Recovery Centre / Medically Supported Detox (detox is within the centre)
  {
    canonical: 'recovery-centre-medically-supported-detoxification-370-kipling-street-se-medicine-hat-ab-t1a-1y6',
    duplicates: [
      'medicine-hat-recovery-centre-medicine-hat',
    ],
  },
  // Banff Mental Health (same service, different name styles)
  {
    canonical: 'banff-mental-health-urgent-care-banff-305-lynx-st',
    duplicates: [
      'alberta-health-services-calgary-zone-mental-health-services-303-lynx-street-banff-ab-t1l-1b3',
    ],
  },
  // AHS CUPS Addiction and Recovery Supports (AHS entry duplicates CUPS org entry)
  {
    canonical: 'cups-calgary-urban-project-society-1001-10-avenue-sw-calgary-ab-t2r-0b7',
    duplicates: [
      'alberta-health-services-calgary-zone-addiction-and-recovery-supports-1001-10-avenue-sw-calgary-ab-t2r-0b7',
    ],
  },
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
