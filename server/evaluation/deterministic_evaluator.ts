import type { TestQuery } from './comprehensive_test_queries';

interface DeterministicScores {
  mustInclude: number;
  mustExclude: number;
  patternMatch: number;
  intentAccuracy: number;
  hasResults: number;
  overall: number;
}

interface DeterministicResult {
  query: TestQuery;
  detectedIntent: string;
  resultCount: number;
  scores: DeterministicScores;
  failures: string[];
}

export function scoreDeterministic(
  testQuery: TestQuery,
  results: Array<{ name: string; category: string; description: string; location: string }>,
  detectedIntent: string
): DeterministicResult {
  const failures: string[] = [];

  if (results.length === 0) {
    return {
      query: testQuery,
      detectedIntent,
      resultCount: 0,
      scores: { mustInclude: 0, mustExclude: 0, patternMatch: 0, intentAccuracy: 0, hasResults: 0, overall: 0 },
      failures: ['Zero results returned'],
    };
  }

  const hasResults = 100;

  let mustInclude = 100;
  if (testQuery.mustInclude && testQuery.mustInclude.length > 0) {
    const resultNames = results.map(r => r.name.toLowerCase());
    const missing = testQuery.mustInclude.filter(
      name => !resultNames.some(rn => rn.includes(name.toLowerCase()))
    );
    if (missing.length > 0) {
      mustInclude = 0;
      failures.push(`Missing required services: ${missing.join(', ')}`);
    }
  }

  let mustExclude = 100;
  if (testQuery.mustExclude && testQuery.mustExclude.length > 0) {
    const resultText = results.map(r => `${r.name} ${r.description}`).join(' ').toLowerCase();
    const present = testQuery.mustExclude.filter(
      name => resultText.includes(name.toLowerCase())
    );
    if (present.length > 0) {
      mustExclude = 0;
      failures.push(`Excluded services present: ${present.join(', ')}`);
    }
  }

  let patternMatch = 100;
  if (testQuery.expectedPatterns && testQuery.expectedPatterns.length > 0) {
    const top10Text = results.slice(0, 10)
      .map(r => `${r.name} ${r.category} ${r.description}`)
      .join(' ')
      .toLowerCase();
    const hits = testQuery.expectedPatterns.filter(p => top10Text.includes(p.toLowerCase()));
    patternMatch = Math.round((hits.length / testQuery.expectedPatterns.length) * 100);
    const missed = testQuery.expectedPatterns.filter(p => !top10Text.includes(p.toLowerCase()));
    if (missed.length > 0) {
      failures.push(`Missing patterns: ${missed.join(', ')}`);
    }
  }

  const intentAccuracy = (testQuery.intent === detectedIntent || testQuery.intent === 'general') ? 100 : 0;
  if (intentAccuracy === 0) {
    failures.push(`Intent mismatch: expected "${testQuery.intent}", got "${detectedIntent}"`);
  }

  const overall = Math.round(
    intentAccuracy * 0.30 +
    mustInclude * 0.25 +
    patternMatch * 0.25 +
    mustExclude * 0.10 +
    hasResults * 0.10
  );

  return {
    query: testQuery,
    detectedIntent,
    resultCount: results.length,
    scores: { mustInclude, mustExclude, patternMatch, intentAccuracy, hasResults, overall },
    failures,
  };
}
