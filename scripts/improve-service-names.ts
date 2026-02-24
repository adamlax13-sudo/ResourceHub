/**
 * Service Name Improver
 *
 * Identifies services where the name is generic but the description
 * reveals a more specific/recognizable name, and updates accordingly.
 */

import 'dotenv/config';
import { db } from '../server/db';
import { services } from '@shared/schema';
import { eq, sql, and, ilike } from 'drizzle-orm';

interface ServiceToImprove {
  serviceId: string;
  currentName: string;
  suggestedName: string;
  reason: string;
  description: string;
}

// Known cases where AHS generic name should include actual facility name
const NAME_IMPROVEMENTS: { serviceId: string; newName: string; reason: string }[] = [
  // Youth Services Centre
  {
    serviceId: 'alberta-health-services-calgary-zone-addiction-services-recovery-stabilization-and-detox-program-1005-17-street-nw-calgary-ab-t2n-2e5',
    newName: 'Youth Services Centre - Recovery & Detox (AHS Calgary)',
    reason: 'Description mentions Youth Services Centre',
  },
  // Southern Alcare Manor (Long-Term)
  {
    serviceId: 'alberta-health-services-south-zone-addiction-services-adult-long-term-residential-520-7-street-s-lethbridge-ab-t1j-2h1',
    newName: 'Southern Alcare Manor - Long-Term Residential (AHS)',
    reason: 'Description mentions Southern Alcare Manor',
  },
  // The Addiction Centre Calgary
  {
    serviceId: 'alberta-health-services-calgary-zone-addiction-centre-adult-program-1403-29-street-nw-calgary-ab-t2n-2t9',
    newName: 'The Addiction Centre Calgary - Adult Program',
    reason: 'Description mentions The Addiction Centre',
  },
  // Acute Care Addiction Recovery Program
  {
    serviceId: 'alberta-health-services-provincial-health-services-acute-care-addiction-recovery-program-1403-29-street-nw-calgary-ab-t2n-2t9',
    newName: 'Acute Care Addiction Recovery Program (ACARP)',
    reason: 'Description mentions ACARP program',
  },
  // Sheldon Kennedy Centre
  {
    serviceId: 'alberta-health-services-central-zone-child-youth-and-family-addiction-and-mental-health-drop-in-counseling-alberta-province-wide',
    newName: 'Sheldon Kennedy Centre - Drop-in Counselling',
    reason: 'Description mentions Sheldon Kennedy Centre',
  },
  // Fresh Start Recovery Centre (AHS program)
  {
    serviceId: 'alberta-health-services-calgary-zone-addiction-services-adult-residential-411-41-avenue-ne-calgary-ab-t2e-2n4',
    newName: 'Fresh Start Recovery Centre (AHS Calgary)',
    reason: 'Description mentions Fresh Start Recovery Centre',
  },
  // Bob Glasgow Grief Support Centre
  {
    serviceId: 'alberta-health-services-calgary-zone-grief-support-program-1820-richmond-road-sw-calgary-ab-t2t-5c7',
    newName: 'Bob Glasgow Grief Support Centre',
    reason: 'Description mentions Bob Glasgow Grief Support Centre',
  },
  // Lethbridge Youth Treatment Centre
  {
    serviceId: 'alberta-health-services-south-zone-addiction-and-mental-health-youth-addiction-treatment-centre-402-6-avenue-n-lethbridge-ab-t1h-6j9',
    newName: 'Lethbridge Youth Addiction Treatment Centre',
    reason: 'Description mentions Lethbridge Youth Treatment Centre',
  },
  // Fort McMurray Recovery Centre
  {
    serviceId: 'alberta-health-services-north-zone-addiction-services-adult-residential-451-sakitawaw-trail-fort-mcmurray-ab-t9h-4p3',
    newName: 'Fort McMurray Recovery Centre',
    reason: 'Description mentions Fort McMurray Recovery Centre',
  },
  // Northern Addictions Centre (Grande Prairie)
  {
    serviceId: 'alberta-health-services-north-zone-addiction-services-adult-residential-grande-prairie-alberta',
    newName: 'Northern Addictions Centre (Grande Prairie)',
    reason: 'Description mentions Northern Addictions Centre',
  },
  // Southern Alcare Manor (Transitional)
  {
    serviceId: 'alberta-health-services-south-zone-addiction-services-adult-transitional-520-7-street-s-lethbridge-ab-t1j-2h1',
    newName: 'Southern Alcare Manor - Transitional (AHS)',
    reason: 'Description mentions Southern Alcare Manor',
  },
  // Rocky Mountain House Health Centre
  {
    serviceId: 'alberta-health-services-central-zone-addiction-counselling-5016-52-avenue-rocky-mountain-house-ab-t4t-1t2',
    newName: 'Rocky Mountain House Health Centre - Addiction Counselling (AHS Central)',
    reason: 'Description mentions Rocky Mountain House Health Centre',
  },
  // Geriatric Psychiatry Clinic Edmonton
  {
    serviceId: 'alberta-health-services-edmonton-zone-geriatric-psychiatry-clinic-edmonton-ab',
    newName: 'Geriatric Psychiatry Clinic (AHS Edmonton)',
    reason: 'Description mentions The Geriatric Psychiatry Clinic',
  },
  // Grande Prairie Aberdeen Centre - Complex Needs
  {
    serviceId: 'alberta-health-services-north-zone-complex-needs-program-9728-101-avenue-grande-prairie-ab-t8v-5b6',
    newName: 'Grande Prairie Aberdeen Centre - Complex Needs (AHS North)',
    reason: 'Description mentions Grande Prairie Aberdeen Centre',
  },
  // Edmonton General Continuing Care Centre - Psychosocial Oncology
  {
    serviceId: 'alberta-health-services-cancer-care-alberta-psychosocial-oncology-11111-jasper-avenue-edmonton-ab-t5k-0l4',
    newName: 'Edmonton General Continuing Care Centre - Psychosocial Oncology (AHS)',
    reason: 'Description mentions Edmonton General Continuing Care Centre',
  },
  // Provincial Family Violence Treatment Program (Edmonton)
  {
    serviceId: 'alberta-health-services-provincial-health-services-provincial-family-violence-treatment-program-10225-106-street-edmonton-ab-t5j-1h5',
    newName: 'Provincial Family Violence Treatment Program - Edmonton (AHS)',
    reason: 'Description mentions Provincial Family Violence Treatment',
  },
  // Provincial Family Violence Treatment Program (Grande Prairie)
  {
    serviceId: 'alberta-health-services-north-zone-provincial-family-violence-treatment-program-10116-102-avenue-grande-prairie-ab-t8v-1c2',
    newName: 'Provincial Family Violence Treatment Program - Grande Prairie (AHS North)',
    reason: 'Description mentions Provincial Family Violence Treatment at The Community Village',
  },
  // Banff Community Health Centre - Mental Health
  {
    serviceId: 'alberta-health-services-calgary-zone-mental-health-services-303-lynx-street-banff-ab-t1l-1b3',
    newName: 'Banff Community Health Centre - Mental Health (AHS Calgary)',
    reason: 'Description mentions Banff Community Health Centre',
  },
  // The Recovery Centre - Detox (Lethbridge)
  {
    serviceId: 'alberta-health-services-south-zone-addiction-services-adult-detoxification-960-19-street-s-lethbridge-ab-t1j-1w5',
    newName: 'The Recovery Centre - Detox (AHS Lethbridge)',
    reason: 'Description mentions The Recovery Centre at Chinook Regional Hospital',
  },
  // Elk Point Healthcare Centre - DART
  {
    serviceId: 'alberta-health-services-provincial-health-services-addiction-and-mental-health-domestic-abuse-response-team-5310-50-avenue-elk-point-ab-t0a-1a0',
    newName: 'Elk Point Healthcare Centre - DART (AHS)',
    reason: 'Description mentions Elk Point Healthcare Centre',
  },
];

async function findServicesWithGenericNames(): Promise<ServiceToImprove[]> {
  const results: ServiceToImprove[] = [];

  // Find AHS services where description mentions a specific facility name
  const ahsServices = await db.select({
    serviceId: services.serviceId,
    name: services.name,
    description: services.description,
  })
  .from(services)
  .where(and(
    eq(services.isActive, true),
    ilike(services.name, 'Alberta Health Services%'),
  ))
  .limit(200);

  // Common facility names that appear in descriptions
  const facilityPatterns = [
    /^((?:The )?[A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)*(?:\s+(?:Centre|Center|House|Shelter|Recovery|Treatment|Hospital|Clinic|Manor)))/,
    /also known as ([^,\.]+)/i,
    /at (?:the )?([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)*(?:\s+(?:Centre|Center|House|Shelter|Recovery)))/,
  ];

  for (const svc of ahsServices) {
    if (!svc.description) continue;

    for (const pattern of facilityPatterns) {
      const match = svc.description.match(pattern);
      if (match && match[1]) {
        const facilityName = match[1].trim();
        // Skip if the facility name is just "The" or very short
        if (facilityName.length > 10 && !svc.name.includes(facilityName)) {
          results.push({
            serviceId: svc.serviceId,
            currentName: svc.name,
            suggestedName: `${facilityName} (AHS)`,
            reason: `Description mentions "${facilityName}"`,
            description: svc.description.substring(0, 200),
          });
          break;
        }
      }
    }
  }

  return results;
}

async function improveServiceNames(dryRun: boolean = true) {
  console.log('='.repeat(60));
  console.log('SERVICE NAME IMPROVER');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will modify database)'}`);
  console.log('='.repeat(60));

  // Apply known improvements
  console.log('\n=== KNOWN IMPROVEMENTS ===\n');
  for (const improvement of NAME_IMPROVEMENTS) {
    const [svc] = await db.select()
      .from(services)
      .where(eq(services.serviceId, improvement.serviceId))
      .limit(1);

    if (!svc) {
      console.log(`⚠️ Service not found: ${improvement.serviceId}`);
      continue;
    }

    console.log(`CURRENT: ${svc.name}`);
    console.log(`PROPOSED: ${improvement.newName}`);
    console.log(`REASON: ${improvement.reason}`);

    if (!dryRun) {
      await db.update(services)
        .set({ name: improvement.newName })
        .where(eq(services.serviceId, improvement.serviceId));
      console.log('✅ Updated');
    }
    console.log('');
  }

  // Find additional services to improve
  console.log('\n=== AUTO-DETECTED CANDIDATES ===\n');
  const candidates = await findServicesWithGenericNames();

  if (candidates.length === 0) {
    console.log('No additional candidates found.');
  } else {
    console.log(`Found ${candidates.length} candidates:\n`);
    for (const c of candidates.slice(0, 10)) {
      console.log(`CURRENT: ${c.currentName}`);
      console.log(`SUGGESTED: ${c.suggestedName}`);
      console.log(`REASON: ${c.reason}`);
      console.log(`DESC PREVIEW: ${c.description.substring(0, 100)}...`);
      console.log('');
    }

    if (candidates.length > 10) {
      console.log(`... and ${candidates.length - 10} more candidates`);
    }
  }

  console.log('='.repeat(60));
  if (dryRun && NAME_IMPROVEMENTS.length > 0) {
    console.log(`Run with --execute to apply ${NAME_IMPROVEMENTS.length} known improvements`);
  }
}

const dryRun = !process.argv.includes('--execute');
improveServiceNames(dryRun).then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
