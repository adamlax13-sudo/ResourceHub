/**
 * Generate name improvements list for AHS services
 */
import 'dotenv/config';
import { db } from '../server/db';
import { services } from '@shared/schema';
import { and, eq, ilike } from 'drizzle-orm';

async function findCandidates() {
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

  const facilityPatterns = [
    /^((?:The )?[A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)*(?:\s+(?:Centre|Center|House|Shelter|Recovery|Treatment|Hospital|Clinic|Manor)))/,
    /also known as ([^,\.]+)/i,
    /at (?:the )?([A-Z][a-zA-Z]+(?: [A-Z][a-zA-Z]+)*(?:\s+(?:Centre|Center|House|Shelter|Recovery)))/,
  ];

  const candidates = [];
  for (const svc of ahsServices) {
    if (!svc.description) continue;
    for (const pattern of facilityPatterns) {
      const match = svc.description.match(pattern);
      if (match && match[1]) {
        const facilityName = match[1].trim();
        if (facilityName.length > 10 && !svc.name.includes(facilityName)) {
          candidates.push({
            serviceId: svc.serviceId,
            currentName: svc.name,
            facilityName: facilityName,
          });
          break;
        }
      }
    }
  }

  // Output as TypeScript code for the improvements array
  console.log('const NAME_IMPROVEMENTS = [');
  for (const c of candidates) {
    // Create cleaner name: Facility Name (AHS Zone)
    const zone = c.currentName.match(/- (Calgary|Edmonton|North|South|Central|Provincial).*?Zone/i);
    const zoneStr = zone ? zone[1] + ' Zone' : '';
    const newName = zoneStr ? `${c.facilityName} (AHS ${zoneStr})` : `${c.facilityName} (AHS)`;

    console.log('  {');
    console.log(`    serviceId: '${c.serviceId}',`);
    console.log(`    newName: '${newName}',`);
    console.log(`    reason: 'Description mentions ${c.facilityName}',`);
    console.log('  },');
  }
  console.log('];');

  process.exit(0);
}

findCandidates().catch(console.error);
