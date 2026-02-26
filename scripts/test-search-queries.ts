/**
 * Quick test script to validate search queries
 */
import 'dotenv/config';
import { search } from '../server/search/index.js';

async function testQueries() {
  const queries = [
    // High confidence adult - should filter out youth-only
    'adult residential programs calgary',
    // High confidence youth - should filter out adult-only, senior-only
    'teen counselling edmonton',
    // High confidence senior - should filter out youth, youth_and_adult, adult
    'senior supports red deer',
    // No age signal - should show all
    'counselling calgary',
    // Medium confidence - should apply penalty, not filter
    'young adult housing calgary',
    // False positive test - should NOT trigger adult filter
    'adult children of alcoholics calgary',
    // Exclusion system tests
    'addiction help not religious calgary',
    'secular counselling edmonton',
    'recovery support no 12 step calgary',
  ];

  for (const q of queries) {
    console.log('\n' + '='.repeat(50));
    console.log('Query:', q);
    console.log('='.repeat(50));

    const start = Date.now();
    const result = await search({ query: q, page: 1, pageSize: 5 });
    console.log('Time:', Date.now() - start + 'ms');
    console.log('Results:');
    for (const svc of result.services) {
      console.log('  *', svc.name);
      console.log('    Age Group:', (svc as any).age_group || 'N/A');
      console.log('    Phone:', svc.phone || 'N/A');
      if ((svc as any).is_12_step) console.log('    [12-STEP]');
      if ((svc as any).is_faith_based) console.log('    [FAITH-BASED]');
    }
  }

  process.exit(0);
}

testQueries().catch(err => {
  console.error(err);
  process.exit(1);
});
