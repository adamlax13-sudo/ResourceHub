#!/usr/bin/env node
/**
 * CI Search Quality Runner
 *
 * Runs all test queries against a local or remote API and fails if quality
 * drops below thresholds. Used in GitHub Actions CI pipeline.
 *
 * Usage:
 *   node server/evaluation/ci_runner.mjs                    # hits localhost:5000
 *   API_BASE=https://example.com node server/evaluation/ci_runner.mjs  # hits remote
 *
 * Exit codes:
 *   0 = all thresholds met
 *   1 = quality below thresholds
 */

const API_BASE = process.env.API_BASE || 'http://localhost:5000';
const REQUEST_DELAY_MS = 500; // 500ms between requests (52 queries need headroom)
const TIMEOUT_MS = 15000; // 15s per request (LLM cold starts can be slow)

// ============= THRESHOLDS =============
const THRESHOLDS = {
  overallMin: 85,          // Overall average must be >= 85
  criticalIntentMin: 90,   // Crisis, DV, housing_urgent must score >= 90
  intentMin: 60,           // No single intent average below 60
  maxFailures: 5,          // Max number of queries scoring < 50
};

const CRITICAL_INTENTS = ['crisis', 'domestic_violence', 'housing_urgent'];

// ============= TEST QUERIES =============
// Subset of comprehensive_test_queries.ts — 52 key regression tests.
// Kept inline to avoid tsx dependency in CI.
const QUERIES = [
  // CRISIS (must never regress)
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
  { query: "i cant stop doing coke", intent: "substance_abuse", expectedPatterns: ["addiction", "recovery", "treatment"], mustExclude: ["Gambling Support"] },
  { query: "recovery support no 12 step", intent: "substance_abuse", expectedPatterns: ["SMART Recovery", "recovery"] },
  // FAMILY ADDICTION
  { query: "my son is addicted to drugs what can I do", intent: "family_addiction_support", expectedPatterns: ["PCHAD", "family", "parent"] },
  { query: "my husband is an alcoholic", intent: "family_addiction_support", expectedPatterns: ["al-anon", "family", "support"] },
  // INDIGENOUS
  { query: "indigenous mental health support", intent: "indigenous_services", expectedPatterns: ["indigenous", "First Nations"] },
  // LGBTQ
  { query: "LGBTQ counselling Calgary", location: "Calgary", intent: "lgbtq_services", expectedPatterns: ["LGBTQ", "sexuality", "gender"] },
  // NEWCOMER
  { query: "newcomer settlement services", intent: "newcomer_services", expectedPatterns: ["immigrant", "refugee", "settlement", "newcomer"] },
  // STUDENT
  { query: "UCalgary mental health", intent: "student_services", expectedPatterns: ["UCalgary", "student", "campus"] },
  // VETERAN
  { query: "PTSD support for veterans", intent: "veteran_services", expectedPatterns: ["veteran", "PTSD", "trauma", "military"] },
  // DISABILITY
  { query: "autism support adult Edmonton", location: "Edmonton", intent: "disability_support", expectedPatterns: ["autism", "disability", "support"] },
  { query: "help with AISH application", intent: "disability_support", expectedPatterns: ["AISH", "disability", "benefits"] },
  // LEGAL
  { query: "free legal help family court", intent: "legal_aid", expectedPatterns: ["legal", "family", "court", "lawyer"] },
  // EMPLOYMENT
  { query: "I lost my job and need help", intent: "employment_support", expectedPatterns: ["employment", "job", "training"] },
  // FINANCIAL
  { query: "can't pay my bills in debt", intent: "financial_support", expectedPatterns: ["financial", "debt", "help"] },
  // PARENTING
  { query: "single mom needs help", intent: "parenting_support", expectedPatterns: ["parent", "support", "family"] },
  // EDGE CASES
  { query: "dental services", intent: "healthcare_access", expectedPatterns: ["dental"], mustExclude: ["mental health"] },
  { query: "counslling near me", intent: "mental_health", expectedPatterns: ["counselling", "therapy", "mental health"] },
  { query: "fud bank", intent: "food_insecurity", expectedPatterns: ["food", "bank", "hamper"] },
  // HEALTHCARE ACCESS
  { query: "hospital near me", intent: "healthcare_access", expectedPatterns: ["hospital", "emergency"] },
  { query: "emergency room Calgary", intent: "healthcare_access", expectedPatterns: ["hospital", "emergency", "Calgary"] },
  { query: "AADL wheelchair program", intent: "healthcare_access", expectedPatterns: ["AADL", "aids to daily living"] },
  // NAME SEARCHES
  { query: "SMART Recovery", intent: "substance_abuse", mustInclude: ["SMART Recovery"] },
  { query: "Kids Help Phone", intent: "youth_services", expectedPatterns: ["Kids Help Phone"] },
  // COMPOUND
  { query: "homeless veteran with PTSD", intent: "veteran_services", expectedPatterns: ["veteran", "PTSD", "shelter"] },
  { query: "housing for women fleeing abuse", intent: "domestic_violence", expectedPatterns: ["shelter", "women", "domestic violence", "abuse"] },
  // CAREGIVER SUPPORT
  { query: "caregiver burnout support", intent: "caregiver_support", expectedPatterns: ["caregiver", "respite", "support"] },
  { query: "help caring for elderly parent", intent: "caregiver_support", expectedPatterns: ["caregiver", "senior", "support", "respite"] },
  // COMMUNITY & SOCIAL
  { query: "community programs for social connection", intent: "community_social", expectedPatterns: ["community", "social", "program", "group"] },
  { query: "lonely and need friends", intent: "community_social", expectedPatterns: ["social", "community", "support", "group"] },
  // SENIOR SERVICES
  { query: "help for seniors living alone", intent: "senior_services", expectedPatterns: ["senior", "elderly", "home care", "support"] },
  { query: "senior meal delivery program", intent: "senior_services", expectedPatterns: ["senior", "meal", "delivery"] },
  // BASIC NEEDS
  { query: "I need clothing and household items", intent: "basic_needs", expectedPatterns: ["clothing", "household", "donation", "free"] },
  { query: "where can I get free furniture", intent: "basic_needs", expectedPatterns: ["free", "basic needs"] },
  // EDGE CASES
  { query: "my teenager is self-harming", intent: "mental_health", expectedPatterns: ["youth", "mental health", "self-harm", "crisis"] },
  { query: "my ex won't let me see my kids", intent: "legal_aid", expectedPatterns: ["legal", "custody", "family"] },
  { query: "addcition help", intent: "substance_abuse", expectedPatterns: ["addiction", "recovery"] },
  { query: "Indigenous youth mental health", intent: "indigenous_services", expectedPatterns: ["indigenous", "youth", "mental health"] },
];

// ============= SCORING =============
function scoreDeterministic(testQuery, results) {
  if (!results || results.length === 0) {
    return { query: testQuery, resultCount: 0, scores: { mustInclude: 0, mustExclude: 0, patternMatch: 0, hasResults: 0, overall: 0 }, failures: ['Zero results'] };
  }

  const hasResults = 100;
  const failures = [];

  let mustInclude = 100;
  if (testQuery.mustInclude?.length > 0) {
    const names = results.map(r => r.name.toLowerCase());
    const missing = testQuery.mustInclude.filter(n => !names.some(rn => rn.includes(n.toLowerCase())));
    if (missing.length > 0) { mustInclude = 0; failures.push(`Missing: ${missing.join(', ')}`); }
  }

  let mustExclude = 100;
  if (testQuery.mustExclude?.length > 0) {
    // Check name + category only (not description — multi-service centres mention many service types)
    const top10Text = results.slice(0, 10).map(r => `${r.name} ${r.category || ''}`).join(' ').toLowerCase();
    const present = testQuery.mustExclude.filter(n => top10Text.includes(n.toLowerCase()));
    if (present.length > 0) { mustExclude = 0; failures.push(`Should exclude from top 10: ${present.join(', ')}`); }
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

// ============= API CLIENT =============
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function searchAPI(query, location, retries = 3) {
  const body = { query, page: 1, pageSize: 20 };
  if (location) body.location = location;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status === 429 && attempt < retries) {
        // Exponential backoff: 10s, 20s, 40s — respects rate limit windows
        const backoff = 10000 * Math.pow(2, attempt);
        console.log(`     [429] Rate limited, retrying in ${backoff / 1000}s...`);
        await sleep(backoff);
        continue;
      }
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
      return res.json();
    } catch (err) {
      clearTimeout(timer);
      if (attempt < retries) { await sleep(3000); continue; }
      throw err;
    }
  }
}

// ============= MAIN =============
async function main() {
  console.log(`Search Quality CI Runner`);
  console.log(`API: ${API_BASE} | Queries: ${QUERIES.length}`);
  console.log('='.repeat(70));

  const results = [];
  let passed = 0, warned = 0, failed = 0, errors = 0;

  for (let i = 0; i < QUERIES.length; i++) {
    const tq = QUERIES[i];
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
      if (status === 'PASS') passed++; else if (status === 'WARN') warned++; else failed++;
      results.push({ ...score, searchTimeMs: ms });
    } catch (err) {
      console.log(`[ERR] "${tq.query}": ${err.message}`);
      errors++;
    }
  }

  // ============= SUMMARY =============
  const avg = results.length > 0 ? Math.round(results.reduce((s, r) => s + r.scores.overall, 0) / results.length) : 0;
  const avgMs = results.length > 0 ? Math.round(results.reduce((s, r) => s + r.searchTimeMs, 0) / results.length) : 0;
  const hardFails = results.filter(r => r.scores.overall < 50).length;

  console.log('\n' + '='.repeat(70));
  console.log('SEARCH QUALITY REPORT');
  console.log('='.repeat(70));
  console.log(`Queries: ${results.length} | Passed: ${passed} | Warned: ${warned} | Failed: ${failed} | Errors: ${errors}`);
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

  // ============= THRESHOLD CHECKS =============
  const violations = [];

  if (avg < THRESHOLDS.overallMin) {
    violations.push(`Overall average ${avg} < ${THRESHOLDS.overallMin} minimum`);
  }

  for (const intent of CRITICAL_INTENTS) {
    const scores = byIntent[intent];
    if (scores) {
      const intentAvg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
      if (intentAvg < THRESHOLDS.criticalIntentMin) {
        violations.push(`Critical intent "${intent}" avg ${intentAvg} < ${THRESHOLDS.criticalIntentMin} minimum`);
      }
    }
  }

  for (const [intent, scores] of Object.entries(byIntent)) {
    const intentAvg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    if (intentAvg < THRESHOLDS.intentMin) {
      violations.push(`Intent "${intent}" avg ${intentAvg} < ${THRESHOLDS.intentMin} minimum`);
    }
  }

  if (hardFails > THRESHOLDS.maxFailures) {
    violations.push(`${hardFails} queries scored < 50 (max allowed: ${THRESHOLDS.maxFailures})`);
  }

  if (errors > 3) {
    violations.push(`${errors} queries errored (likely server crash or connectivity failure)`);
  }

  // ============= VERDICT =============
  console.log('\n' + '='.repeat(70));
  if (violations.length === 0) {
    console.log('RESULT: PASS — All quality thresholds met');
    process.exit(0);
  } else {
    console.log('RESULT: FAIL — Quality thresholds violated:');
    violations.forEach(v => console.log(`  - ${v}`));
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
