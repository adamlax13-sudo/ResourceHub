#!/usr/bin/env npx tsx
/**
 * Diagnose a single search query — shows what the pipeline does at each stage.
 * Usage: npx tsx server/evaluation/diagnose_query.ts "query text here"
 */
import 'dotenv/config';
import { search } from '../search/index.js';
import { analyzeQuery } from '../search/analyzer.js';
import type { LiteServiceWithDebug } from '../search/types.js';

async function main() {
  const query = process.argv.slice(2).join(' ');
  if (!query) {
    console.error('Usage: npx tsx server/evaluation/diagnose_query.ts "query text"');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log(`DIAGNOSING: "${query}"`);
  console.log('='.repeat(60));

  // Stage 1: Query Analysis
  console.log('\n--- STAGE 1: Query Analysis ---');
  const analysis = analyzeQuery(query);
  console.log(`  Raw query:      "${analysis.raw}"`);
  console.log(`  Normalized:     "${analysis.normalized}"`);
  console.log(`  Intent:         ${analysis.intent}`);
  console.log(`  Is crisis:      ${analysis.isCrisis}`);
  console.log(`  Keywords:       [${analysis.keywords.join(', ')}]`);
  console.log(`  Location:       ${analysis.location.specified || '(none — Alberta-wide)'}`);
  console.log(`  Province-wide:  ${analysis.location.isProvinceWide}`);
  console.log(`  Negative terms: [${analysis.negativeTerms?.join(', ') || ''}]`);
  if (analysis.substanceType) console.log(`  Substance type: ${analysis.substanceType}`);
  if (analysis.aliasMatch) console.log(`  Alias match:    ${analysis.aliasMatch}`);
  if (analysis.intents.secondary) {
    console.log(`  Secondary:      ${analysis.intents.secondary.intent} (${(analysis.intents.secondary.confidence * 100).toFixed(0)}%)`);
  }
  if (analysis.intents.tertiary) {
    console.log(`  Tertiary:       ${analysis.intents.tertiary.intent} (${(analysis.intents.tertiary.confidence * 100).toFixed(0)}%)`);
  }

  // Stage 2: Full Search (with debug)
  console.log('\n--- STAGE 2: Search Results ---');
  const startTime = Date.now();
  const response = await search({
    query,
    page: 1,
    pageSize: 20,
    debug: true,
  });
  const searchTimeMs = Date.now() - startTime;

  console.log(`  Search time:    ${searchTimeMs}ms`);
  console.log(`  Total results:  ${response.services.length}`);
  console.log(`  Cached:         ${response.cached}`);
  console.log(`  Search type:    ${response.searchType || 'unknown'}`);

  // Stage 3: Result Details
  console.log('\n--- STAGE 3: Top 15 Results ---');
  response.services.slice(0, 15).forEach((s, i) => {
    const svc = s as LiteServiceWithDebug;
    const score = svc.rrfScore?.toFixed(4) || 'pinned';
    console.log(`  ${String(i + 1).padStart(2)}. [${score}] ${svc.name}`);
    console.log(`      Category: ${svc.category} | Location: ${svc.location}`);
    console.log(`      Desc: ${(svc.description || '').substring(0, 100)}...`);
    if (svc.scoreExplanation) {
      console.log(`      Boosts: ${JSON.stringify(svc.scoreExplanation)}`);
    }
  });

  // Stage 4: Summary
  console.log('\n--- STAGE 4: Summary ---');
  console.log(`  ${response.summary || '(no summary)'}`);

  console.log('\n' + '='.repeat(60));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
