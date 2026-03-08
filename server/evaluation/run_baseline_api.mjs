#!/usr/bin/env node
/**
 * Baseline evaluation via production API.
 * No DB connection needed — hits the live API and scores deterministically.
 * Usage: node server/evaluation/run_baseline_api.mjs
 */

const API_BASE = process.env.API_BASE || 'https://resourcehub-wwg6.onrender.com';
const BATCH_SIZE = 18; // Stay under 20/15min rate limit
const BATCH_DELAY_MS = 16 * 60 * 1000; // 16 min between batches
const REQUEST_DELAY_MS = 1000; // 1s between requests within a batch
const SKIP = parseInt(process.env.SKIP || '0', 10); // Skip first N queries (for resuming)

const QUERIES = [
  // CRISIS
  { query: "I want to kill myself", intent: "crisis", mustInclude: ["988 Suicide Crisis Helpline"] },
  { query: "I don't want to be here anymore", intent: "crisis", expectedPatterns: ["crisis", "suicide", "helpline", "988"] },
  { query: "feeling hopeless and like a burden", intent: "crisis", expectedPatterns: ["mental health", "crisis", "support"] },
  // DV
  { query: "my husband hits me I need to leave", intent: "domestic_violence", expectedPatterns: ["shelter", "domestic", "violence", "safe"] },
  { query: "women's shelter domestic violence", intent: "domestic_violence", expectedPatterns: ["women", "shelter", "domestic violence", "abuse"] },
  // HOUSING
  { query: "emergency shelter tonight Calgary", location: "Calgary", intent: "housing_urgent", expectedPatterns: ["shelter", "emergency", "overnight"] },
  { query: "I'm homeless and have nowhere to sleep", intent: "housing_urgent", expectedPatterns: ["shelter", "homeless", "emergency"] },
  // FOOD
  { query: "food bank near downtown Edmonton", location: "Edmonton", intent: "food_insecurity", expectedPatterns: ["food bank", "food", "hamper"] },
  { query: "free meals for homeless", intent: "food_insecurity", expectedPatterns: ["meal", "soup kitchen", "drop-in"] },
  // MENTAL HEALTH
  { query: "free counselling Calgary", location: "Calgary", intent: "mental_health", expectedPatterns: ["counselling", "free", "sliding scale"] },
  { query: "anxiety therapy no waitlist", intent: "mental_health", expectedPatterns: ["therapy", "counselling", "anxiety"] },
  { query: "I feel depressed and can't get out of bed", intent: "mental_health", expectedPatterns: ["depression", "mental health", "counselling"] },
  // GRIEF
  { query: "grief counselling after losing spouse", intent: "grief_support", expectedPatterns: ["grief", "bereavement", "loss"] },
  // SUBSTANCE ABUSE
  { query: "help with alcohol addiction Calgary", location: "Calgary", intent: "substance_abuse", expectedPatterns: ["alcohol", "addiction", "recovery", "AA"] },
  { query: "opioid treatment Edmonton", location: "Edmonton", intent: "substance_abuse", expectedPatterns: ["opioid", "ODP", "methadone", "suboxone"] },
  { query: "addiction help not religious", intent: "substance_abuse", mustExclude: ["Salvation Army", "church"], expectedPatterns: ["secular", "addiction"] },
  { query: "recovery support no 12 step", intent: "substance_abuse", expectedPatterns: ["SMART Recovery", "recovery"] },
  // FAMILY ADDICTION
  { query: "my son is addicted to drugs what can I do", intent: "family_addiction_support", expectedPatterns: ["PCHAD", "family", "parent"] },
  // --- batch 2 starts here (index 18) ---
  { query: "my husband is an alcoholic", intent: "family_addiction_support", expectedPatterns: ["al-anon", "family", "support"] },
  { query: "indigenous mental health support", intent: "indigenous_services", expectedPatterns: ["indigenous", "First Nations", "Métis"] },
  { query: "LGBTQ counselling Calgary", location: "Calgary", intent: "lgbtq_services", expectedPatterns: ["LGBTQ", "Pride", "queer"] },
  { query: "newcomer settlement services", intent: "newcomer_services", expectedPatterns: ["immigrant", "refugee", "settlement", "newcomer"] },
  { query: "UCalgary mental health", intent: "student_services", expectedPatterns: ["UCalgary", "student", "campus"] },
  { query: "PTSD support for veterans", intent: "veteran_services", expectedPatterns: ["veteran", "PTSD", "trauma", "military", "OSI-CAN"] },
  { query: "autism support adult Edmonton", location: "Edmonton", intent: "disability_support", expectedPatterns: ["autism", "disability", "support"] },
  { query: "help with AISH application", intent: "disability_support", expectedPatterns: ["AISH", "disability", "benefits"] },
  { query: "free legal help family court", intent: "legal_aid", expectedPatterns: ["legal", "family", "court", "lawyer"] },
  { query: "I lost my job and need help", intent: "employment_support", expectedPatterns: ["employment", "job", "training"] },
  { query: "can't pay my bills in debt", intent: "financial_support", expectedPatterns: ["financial", "debt", "help"] },
  { query: "single mom needs help", intent: "parenting_support", expectedPatterns: ["parent", "support", "family"] },
  { query: "help", intent: "general" },
  { query: "Calgary", intent: "location_only" },
  { query: "dental services", intent: "general", mustExclude: ["mental health"] },
  { query: "counslling near me", intent: "mental_health", expectedPatterns: ["counselling", "therapy", "mental health"] },
  { query: "fud bank", intent: "food_insecurity", expectedPatterns: ["food", "bank", "hamper"] },
  { query: "SMART Recovery", intent: "substance_abuse", mustInclude: ["SMART Recovery"] },
  // --- batch 3 starts here (index 36) ---
  { query: "Kids Help Phone", intent: "youth_services", expectedPatterns: ["Kids Help Phone"] },
  { query: "homeless veteran with PTSD", intent: "veteran_services", expectedPatterns: ["veteran", "PTSD", "shelter"] },
  { query: "housing for women fleeing abuse", intent: "domestic_violence", expectedPatterns: ["shelter", "women", "domestic violence", "abuse"] },
];

function scoreDeterministic(testQuery, results) {
  const failures = [];
  if (!results || results.length === 0) {
    return { query: testQuery, resultCount: 0, scores: { mustInclude: 0, mustExclude: 0, patternMatch: 0, hasResults: 0, overall: 0 }, failures: ['Zero results'] };
  }

  const hasResults = 100;

  let mustInclude = 100;
  if (testQuery.mustInclude?.length > 0) {
    const names = results.map(r => r.name.toLowerCase());
    const missing = testQuery.mustInclude.filter(n => !names.some(rn => rn.includes(n.toLowerCase())));
    if (missing.length > 0) { mustInclude = 0; failures.push(`Missing: ${missing.join(', ')}`); }
  }

  let mustExclude = 100;
  if (testQuery.mustExclude?.length > 0) {
    const text = results.map(r => `${r.name} ${r.description || ''}`).join(' ').toLowerCase();
    const present = testQuery.mustExclude.filter(n => text.includes(n.toLowerCase()));
    if (present.length > 0) { mustExclude = 0; failures.push(`Should exclude: ${present.join(', ')}`); }
  }

  let patternMatch = 100;
  if (testQuery.expectedPatterns?.length > 0) {
    const top10Text = results.slice(0, 10).map(r => `${r.name} ${r.category || ''} ${r.description || ''}`).join(' ').toLowerCase();
    const hits = testQuery.expectedPatterns.filter(p => top10Text.includes(p.toLowerCase()));
    patternMatch = Math.round((hits.length / testQuery.expectedPatterns.length) * 100);
    const missed = testQuery.expectedPatterns.filter(p => !top10Text.includes(p.toLowerCase()));
    if (missed.length > 0) failures.push(`Missing patterns: ${missed.join(', ')}`);
  }

  const overall = Math.round(mustInclude * 0.30 + patternMatch * 0.30 + mustExclude * 0.20 + hasResults * 0.20);

  return { query: testQuery, resultCount: results.length, scores: { mustInclude, mustExclude, patternMatch, hasResults, overall }, failures };
}

async function searchAPI(query, location, retries = 3) {
  const body = { query, page: 1, pageSize: 20 };
  if (location) body.location = location;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${API_BASE}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429 && attempt < retries) {
      const wait = Math.min(60000, (attempt + 1) * 20000); // 20s, 40s, 60s
      console.log(`     [429] Rate limited, waiting ${wait/1000}s...`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json();
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const queriesToRun = QUERIES.slice(SKIP);
  console.log(`Running baseline: ${queriesToRun.length} queries (skip ${SKIP}) against ${API_BASE}\n`);

  const results = [];
  let passed = 0, warned = 0, failed = 0;

  for (let i = 0; i < queriesToRun.length; i++) {
    const tq = queriesToRun[i];
    if (i > 0) await sleep(REQUEST_DELAY_MS);
    try {
      const start = Date.now();
      const response = await searchAPI(tq.query, tq.location);
      const ms = Date.now() - start;
      const score = scoreDeterministic(tq, response.services || []);
      const status = score.scores.overall >= 80 ? 'PASS' : score.scores.overall >= 60 ? 'WARN' : 'FAIL';
      const icon = status === 'PASS' ? '[OK]' : status === 'WARN' ? '[!!]' : '[XX]';
      console.log(`${icon} ${String(score.scores.overall).padStart(3)}/100 | ${String(ms).padStart(5)}ms | "${tq.query}"`);
      if (score.failures.length > 0) score.failures.forEach(f => console.log(`     -> ${f}`));
      if (status === 'PASS') passed++;
      else if (status === 'WARN') warned++;
      else failed++;
      results.push({ ...score, searchTimeMs: ms });
    } catch (err) {
      console.log(`[ERR] "${tq.query}": ${err.message}`);
      failed++;
    }
  }

  const avg = results.length > 0 ? Math.round(results.reduce((s, r) => s + r.scores.overall, 0) / results.length) : 0;
  const avgMs = results.length > 0 ? Math.round(results.reduce((s, r) => s + r.searchTimeMs, 0) / results.length) : 0;

  console.log('\n' + '='.repeat(60));
  console.log('BASELINE SUMMARY');
  console.log('='.repeat(60));
  console.log(`Queries: ${results.length} | Passed: ${passed} | Warned: ${warned} | Failed: ${failed}`);
  console.log(`Overall avg: ${avg}/100 | Avg latency: ${avgMs}ms`);

  // Per-intent breakdown
  const byIntent = {};
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
    const intentAvg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    const icon = intentAvg >= 80 ? '[OK]' : intentAvg >= 60 ? '[!!]' : '[XX]';
    console.log(`  ${icon} ${intent}: ${intentAvg}/100 (${scores.length} queries)`);
  }

  // Worst queries
  const sorted = [...results].sort((a, b) => a.scores.overall - b.scores.overall);
  console.log('\nWorst 10 queries:');
  sorted.slice(0, 10).forEach(r => {
    console.log(`  ${r.scores.overall}/100 "${r.query.query}" — ${r.failures.join('; ') || 'no specific failures'}`);
  });

  // Save report
  const fs = await import('fs');
  const path = await import('path');
  const reportDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `baseline-api-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ timestamp: new Date().toISOString(), totalQueries: results.length, overallAvg: avg, avgLatencyMs: avgMs, passed, warned, failed, byIntent: Object.fromEntries(Object.entries(byIntent).map(([k, v]) => [k, Math.round(v.reduce((s, x) => s + x, 0) / v.length)])), results }, null, 2));
  console.log(`\nReport saved: ${reportPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
