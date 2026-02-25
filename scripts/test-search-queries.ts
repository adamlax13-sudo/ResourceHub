/**
 * Quick test script to validate search queries
 */
import 'dotenv/config';
import { search } from '../server/search/index.js';

async function testQueries() {
  const queries = [
    'addiction help not religious',
    'recovery support no 12 step',
    'SMART Recovery',
    'UCalgary mental health',
    'PTSD support for veterans',
    'emergency shelter tonight Calgary',
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
      console.log('    Phone:', svc.phone || 'N/A');
    }
  }

  process.exit(0);
}

testQueries().catch(err => {
  console.error(err);
  process.exit(1);
});
