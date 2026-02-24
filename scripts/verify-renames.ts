import 'dotenv/config';
import { db } from '../server/db';
import { services } from '@shared/schema';
import { ilike, eq } from 'drizzle-orm';

async function verify() {
  const tests = [
    'Sheldon Kennedy',
    'Southern Alcare Manor',
    'Rocky Mountain House',
    'Banff Community Health',
  ];

  for (const search of tests) {
    const results = await db.select({ name: services.name, isActive: services.isActive })
      .from(services)
      .where(ilike(services.name, '%' + search + '%'))
      .limit(3);

    console.log(`Search: "${search}"`);
    for (const r of results) {
      console.log(`  - ${r.name} [${r.isActive ? 'ACTIVE' : 'INACTIVE'}]`);
    }
  }

  // Count deactivated duplicates
  const inactive = await db.select({ count: services.id })
    .from(services)
    .where(eq(services.isActive, false));

  console.log(`\nTotal inactive services: ${inactive.length}`);
  process.exit(0);
}
verify();
