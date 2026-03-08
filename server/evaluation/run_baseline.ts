#!/usr/bin/env npx tsx
/**
 * Run deterministic baseline evaluation and save results.
 * Usage: npx tsx server/evaluation/run_baseline.ts
 */
import 'dotenv/config';
import { search } from '../search/index.js';
import { analyzeQuery } from '../search/analyzer.js';
import { COMPREHENSIVE_QUERIES, getCategoryDistribution } from './comprehensive_test_queries.js';
import { scoreDeterministic } from './deterministic_evaluator.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const reportDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  console.log(`Running deterministic baseline: ${COMPREHENSIVE_QUERIES.length} queries\n`);
  console.log('Intent distribution:', getCategoryDistribution());

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const testQuery of COMPREHENSIVE_QUERIES) {
    try {
      const startTime = Date.now();
      const searchResponse = await search({
        query: testQuery.query,
        location: testQuery.location,
        page: 1,
        pageSize: 20,
      });
      const searchTimeMs = Date.now() - startTime;

      const analysis = analyzeQuery(testQuery.query, testQuery.location);
      const score = scoreDeterministic(testQuery, searchResponse.services as any, analysis.intent);

      const status = score.scores.overall >= 80 ? 'PASS' : score.scores.overall >= 60 ? 'WARN' : 'FAIL';
      const icon = status === 'PASS' ? '[OK]' : status === 'WARN' ? '[!!]' : '[XX]';
      console.log(`${icon} ${score.scores.overall}/100 | ${searchTimeMs}ms | "${testQuery.query}" (${analysis.intent})`);

      if (score.failures.length > 0) {
        score.failures.forEach(f => console.log(`     -> ${f}`));
      }

      if (score.scores.overall >= 60) passed++;
      else failed++;

      results.push({ ...score, searchTimeMs });
    } catch (error) {
      console.log(`[ERR] "${testQuery.query}": ${error}`);
      failed++;
    }
  }

  const overallAvg = Math.round(results.reduce((s, r) => s + r.scores.overall, 0) / results.length);
  const intentAvg = Math.round(results.reduce((s, r) => s + r.scores.intentAccuracy, 0) / results.length);
  const avgTime = Math.round(results.reduce((s, r) => s + r.searchTimeMs, 0) / results.length);

  console.log('\n' + '='.repeat(60));
  console.log('BASELINE SUMMARY');
  console.log('='.repeat(60));
  console.log(`Queries: ${results.length} | Passed (>=60): ${passed} | Failed (<60): ${failed}`);
  console.log(`Overall avg: ${overallAvg}/100 | Intent accuracy: ${intentAvg}% | Avg latency: ${avgTime}ms`);

  const byIntent: Record<string, number[]> = {};
  results.forEach(r => {
    const intent = r.query.intent;
    if (!byIntent[intent]) byIntent[intent] = [];
    byIntent[intent].push(r.scores.overall);
  });
  console.log('\nPer-intent averages:');
  for (const [intent, scores] of Object.entries(byIntent).sort((a, b) => {
    const avgA = a[1].reduce((s, v) => s + v, 0) / a[1].length;
    const avgB = b[1].reduce((s, v) => s + v, 0) / b[1].length;
    return avgA - avgB;
  })) {
    const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    const icon = avg >= 80 ? '[OK]' : avg >= 60 ? '[!!]' : '[XX]';
    console.log(`  ${icon} ${intent}: ${avg}/100 (${scores.length} queries)`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `baseline-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalQueries: results.length,
    overallAvg,
    intentAvg,
    avgLatencyMs: avgTime,
    passed,
    failed,
    byIntent: Object.fromEntries(
      Object.entries(byIntent).map(([k, v]) => [k, Math.round(v.reduce((s, x) => s + x, 0) / v.length)])
    ),
    results,
  }, null, 2));

  console.log(`\nReport saved: ${reportPath}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
