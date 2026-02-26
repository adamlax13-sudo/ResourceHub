#!/usr/bin/env npx tsx
/**
 * Automated Search Optimization Script
 *
 * Runs iterative evaluation cycles until all queries score >= 60.
 * Identifies patterns in poor-scoring queries and suggests fixes.
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { search } from '../search/index.js';
import { analyzeQuery } from '../search/analyzer.js';
import { LiteService, SearchResponse } from '../search/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { COMPREHENSIVE_QUERIES, TestQuery, getCategoryDistribution } from './comprehensive_test_queries.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  minAcceptableScore: 60,        // Minimum score to pass
  targetScore: 80,               // Target score (good)
  maxIterations: 50,             // Max optimization iterations
  rateLimitDelay: 500,           // Delay between evaluations (ms)
  reportDir: path.join(__dirname, 'reports'),
  fixLogPath: path.join(__dirname, 'optimization_log.json'),
};

interface EvaluationResult {
  query: TestQuery;
  results: LiteService[];
  searchTimeMs: number;
  detectedIntent: string;
  scores: {
    relevance: number;
    ranking: number;
    completeness: number;
    dataQuality: number;
    overall: number;
  };
  issues: string[];
  suggestions: string[];
  claudeAnalysis: string;
}

interface IterationReport {
  iteration: number;
  timestamp: string;
  totalQueries: number;
  poorQueries: number;
  goodQueries: number;
  excellentQueries: number;
  averageScore: number;
  poorQueryDetails: Array<{
    query: string;
    score: number;
    intent: string;
    detectedIntent: string;
    issues: string[];
  }>;
  recommendations: string[];
}

interface OptimizationLog {
  startTime: string;
  iterations: IterationReport[];
  totalIterations: number;
  finalScore: number;
  status: 'running' | 'complete' | 'max_iterations_reached';
}

class AutoOptimizer {
  private claude: Anthropic;
  private log: OptimizationLog;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set');
    }
    this.claude = new Anthropic({ apiKey });

    // Ensure reports directory exists
    if (!fs.existsSync(CONFIG.reportDir)) {
      fs.mkdirSync(CONFIG.reportDir, { recursive: true });
    }

    // Initialize or load log
    this.log = this.loadOrCreateLog();
  }

  private loadOrCreateLog(): OptimizationLog {
    if (fs.existsSync(CONFIG.fixLogPath)) {
      try {
        return JSON.parse(fs.readFileSync(CONFIG.fixLogPath, 'utf-8'));
      } catch {
        // If log is corrupted, start fresh
      }
    }
    return {
      startTime: new Date().toISOString(),
      iterations: [],
      totalIterations: 0,
      finalScore: 0,
      status: 'running',
    };
  }

  private saveLog(): void {
    fs.writeFileSync(CONFIG.fixLogPath, JSON.stringify(this.log, null, 2));
  }

  private async evaluateQuery(testQuery: TestQuery): Promise<EvaluationResult> {
    // Run the search
    const startTime = Date.now();
    const searchResponse = await search({
      query: testQuery.query,
      location: testQuery.location,
      page: 1,
      pageSize: 20,
    });
    const searchTimeMs = Date.now() - startTime;

    // Analyze the query to get detected intent
    const analysis = await analyzeQuery(testQuery.query, testQuery.location);

    // Use Claude to evaluate the results
    const claudeEval = await this.claudeEvaluate(testQuery, searchResponse.services, analysis);

    return {
      query: testQuery,
      results: searchResponse.services,
      searchTimeMs,
      detectedIntent: analysis.intent,
      scores: claudeEval.scores,
      issues: claudeEval.issues,
      suggestions: claudeEval.suggestions,
      claudeAnalysis: claudeEval.analysis,
    };
  }

  private async claudeEvaluate(
    testQuery: TestQuery,
    results: LiteService[],
    analysis: any
  ): Promise<{
    scores: EvaluationResult['scores'];
    issues: string[];
    suggestions: string[];
    analysis: string;
  }> {
    const resultsFormatted = results.slice(0, 10).map((r, i) =>
      `${i + 1}. ${r.name} (${r.category})\n   Location: ${r.location}\n   Description: ${r.description?.substring(0, 200)}...`
    ).join('\n\n');

    const prompt = `You are evaluating search results for a social services directory in Alberta, Canada.

QUERY: "${testQuery.query}"
${testQuery.location ? `LOCATION: ${testQuery.location}` : ''}
EXPECTED INTENT: ${testQuery.intent}
DETECTED INTENT: ${analysis.intent}
DESCRIPTION: ${testQuery.description}

${testQuery.expectedPatterns ? `EXPECTED PATTERNS: ${testQuery.expectedPatterns.join(', ')}` : ''}
${testQuery.mustInclude ? `MUST INCLUDE: ${testQuery.mustInclude.join(', ')}` : ''}
${testQuery.mustExclude ? `MUST EXCLUDE: ${testQuery.mustExclude.join(', ')}` : ''}

TOP 10 RESULTS:
${resultsFormatted || 'NO RESULTS RETURNED'}

Evaluate these results on:

1. RELEVANCE (0-100): Do the results match what someone with this query actually needs?
   - Consider the emotional state implied by the query
   - Are results appropriate for the crisis level?
   - Do results address the specific need (not just keyword matches)?

2. RANKING (0-100): Are the most helpful services at the top?
   - First result should be the most actionable
   - Crisis queries need crisis services first
   - Location-specific results should be prioritized

3. COMPLETENESS (0-100): Are key services present?
   - Check if mustInclude services appear
   - Check if expected patterns appear in results
   - Are there obvious missing service types?

4. DATA QUALITY (0-100): Is the information helpful?
   - Are descriptions clear and informative?
   - Is location info useful?
   - Would someone know how to access these services?

Provide your evaluation as JSON:
{
  "scores": {
    "relevance": <0-100>,
    "ranking": <0-100>,
    "completeness": <0-100>,
    "dataQuality": <0-100>
  },
  "issues": [
    "Specific issue 1",
    "Specific issue 2"
  ],
  "suggestions": [
    "Actionable improvement 1",
    "Actionable improvement 2"
  ],
  "analysis": "2-3 sentence summary of the evaluation"
}`;

    try {
      const response = await this.claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      // Extract JSON from response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Calculate overall score (weighted average)
      const overall = Math.round(
        parsed.scores.relevance * 0.35 +
        parsed.scores.ranking * 0.25 +
        parsed.scores.completeness * 0.25 +
        parsed.scores.dataQuality * 0.15
      );

      return {
        scores: { ...parsed.scores, overall },
        issues: parsed.issues || [],
        suggestions: parsed.suggestions || [],
        analysis: parsed.analysis || '',
      };
    } catch (error) {
      console.error('Claude evaluation error:', error);
      return {
        scores: { relevance: 0, ranking: 0, completeness: 0, dataQuality: 0, overall: 0 },
        issues: ['Evaluation failed: ' + String(error)],
        suggestions: [],
        analysis: 'Evaluation failed',
      };
    }
  }

  async runIteration(iterationNum: number, queries: TestQuery[] = COMPREHENSIVE_QUERIES): Promise<IterationReport> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`ITERATION ${iterationNum}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Evaluating ${queries.length} queries...\n`);

    const results: EvaluationResult[] = [];

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      try {
        process.stdout.write(`[${i + 1}/${queries.length}] "${query.query.substring(0, 40)}..." `);
        const result = await this.evaluateQuery(query);
        results.push(result);

        // Print progress
        const emoji = result.scores.overall >= CONFIG.targetScore ? '✅' :
                     result.scores.overall >= CONFIG.minAcceptableScore ? '⚠️' : '❌';
        console.log(`${emoji} ${result.scores.overall}`);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, CONFIG.rateLimitDelay));
      } catch (error) {
        console.error(`\nError evaluating "${query.query}":`, error);
      }
    }

    // Calculate statistics
    const scores = results.map(r => r.scores.overall);
    const poorQueries = results.filter(r => r.scores.overall < CONFIG.minAcceptableScore);
    const goodQueries = results.filter(r => r.scores.overall >= CONFIG.minAcceptableScore && r.scores.overall < CONFIG.targetScore);
    const excellentQueries = results.filter(r => r.scores.overall >= CONFIG.targetScore);
    const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    // Generate recommendations based on poor queries
    const recommendations = this.generateRecommendations(poorQueries, goodQueries);

    const report: IterationReport = {
      iteration: iterationNum,
      timestamp: new Date().toISOString(),
      totalQueries: results.length,
      poorQueries: poorQueries.length,
      goodQueries: goodQueries.length,
      excellentQueries: excellentQueries.length,
      averageScore,
      poorQueryDetails: poorQueries.map(r => ({
        query: r.query.query,
        score: r.scores.overall,
        intent: r.query.intent,
        detectedIntent: r.detectedIntent,
        issues: r.issues,
      })),
      recommendations,
    };

    // Print summary
    this.printIterationSummary(report);

    // Save iteration report
    this.saveIterationReport(report, results);

    return report;
  }

  private generateRecommendations(poorQueries: EvaluationResult[], goodQueries: EvaluationResult[]): string[] {
    const recommendations: string[] = [];

    // Group poor queries by intent
    const intentGroups = new Map<string, EvaluationResult[]>();
    for (const result of poorQueries) {
      const intent = result.query.intent;
      if (!intentGroups.has(intent)) {
        intentGroups.set(intent, []);
      }
      intentGroups.get(intent)!.push(result);
    }

    // Check for intent detection mismatches
    const mismatches = [...poorQueries, ...goodQueries].filter(r =>
      r.query.intent !== r.detectedIntent && r.query.intent !== 'general'
    );
    if (mismatches.length > 0) {
      const intents = [...new Set(mismatches.map(m => m.query.intent))];
      recommendations.push(`INTENT DETECTION: Fix detection for intents: ${intents.join(', ')}`);
    }

    // Recommend fixes for each problematic intent group
    for (const [intent, queries] of intentGroups) {
      if (queries.length >= 2) {
        recommendations.push(`BOOSTING: Multiple ${intent} queries failing - review ${intent} boosting patterns`);
      }

      // Check for common issues
      const allIssues = queries.flatMap(q => q.issues);
      const issueCount = new Map<string, number>();
      for (const issue of allIssues) {
        const normalized = issue.toLowerCase();
        if (normalized.includes('contact') || normalized.includes('phone')) {
          issueCount.set('missing_contact', (issueCount.get('missing_contact') || 0) + 1);
        }
        if (normalized.includes('duplicate')) {
          issueCount.set('duplicates', (issueCount.get('duplicates') || 0) + 1);
        }
        if (normalized.includes('wrong') || normalized.includes('irrelevant')) {
          issueCount.set('wrong_results', (issueCount.get('wrong_results') || 0) + 1);
        }
        if (normalized.includes('ranking') || normalized.includes('top')) {
          issueCount.set('ranking', (issueCount.get('ranking') || 0) + 1);
        }
      }

      if ((issueCount.get('wrong_results') || 0) >= 2) {
        recommendations.push(`PENALTY: Add penalties for irrelevant services in ${intent} queries`);
      }
      if ((issueCount.get('ranking') || 0) >= 2) {
        recommendations.push(`RANKING: Review ranking weights for ${intent} - best services not at top`);
      }
    }

    // Deduplicate recommendations
    return [...new Set(recommendations)];
  }

  private printIterationSummary(report: IterationReport): void {
    console.log(`\n${'─'.repeat(60)}`);
    console.log('ITERATION SUMMARY');
    console.log(`${'─'.repeat(60)}`);
    console.log(`Average Score: ${report.averageScore}/100`);
    console.log(`\nScore Distribution:`);
    console.log(`  ✅ Excellent (80+): ${report.excellentQueries}`);
    console.log(`  ⚠️  Good (60-79):   ${report.goodQueries}`);
    console.log(`  ❌ Poor (<60):      ${report.poorQueries}`);

    if (report.poorQueries > 0) {
      console.log(`\n❌ Poor Queries:`);
      for (const pq of report.poorQueryDetails) {
        console.log(`  • "${pq.query}" - Score: ${pq.score}`);
        console.log(`    Intent: ${pq.intent} → Detected: ${pq.detectedIntent}`);
        if (pq.issues.length > 0) {
          console.log(`    Issues: ${pq.issues[0].substring(0, 100)}...`);
        }
      }
    }

    if (report.recommendations.length > 0) {
      console.log(`\n📋 Recommendations:`);
      for (const rec of report.recommendations) {
        console.log(`  • ${rec}`);
      }
    }

    console.log(`${'─'.repeat(60)}\n`);
  }

  private saveIterationReport(report: IterationReport, results: EvaluationResult[]): void {
    const filename = `iteration-${report.iteration}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(CONFIG.reportDir, filename);

    const fullReport = {
      ...report,
      fullResults: results.map(r => ({
        query: r.query.query,
        intent: r.query.intent,
        detectedIntent: r.detectedIntent,
        scores: r.scores,
        issues: r.issues,
        suggestions: r.suggestions,
        analysis: r.claudeAnalysis,
        topResults: r.results.slice(0, 5).map(s => ({
          name: s.name,
          category: s.category,
          location: s.location,
        })),
      })),
    };

    fs.writeFileSync(filepath, JSON.stringify(fullReport, null, 2));
    console.log(`Report saved: ${filepath}`);
  }

  async runOptimizationLoop(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('AUTOMATED SEARCH OPTIMIZATION');
    console.log('='.repeat(60));
    console.log(`Total queries: ${COMPREHENSIVE_QUERIES.length}`);
    console.log(`Min acceptable score: ${CONFIG.minAcceptableScore}`);
    console.log(`Target score: ${CONFIG.targetScore}`);
    console.log(`Max iterations: ${CONFIG.maxIterations}`);
    console.log('\nQuery distribution by intent:');
    const dist = getCategoryDistribution();
    for (const [intent, count] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${intent}: ${count}`);
    }
    console.log('='.repeat(60) + '\n');

    let iteration = this.log.iterations.length + 1;

    while (iteration <= CONFIG.maxIterations) {
      const report = await this.runIteration(iteration);

      // Update log
      this.log.iterations.push(report);
      this.log.totalIterations = iteration;
      this.log.finalScore = report.averageScore;
      this.saveLog();

      // Check if we've achieved our goal
      if (report.poorQueries === 0) {
        console.log('\n🎉 SUCCESS! All queries now score >= 60!');
        this.log.status = 'complete';
        this.saveLog();
        break;
      }

      // Ask if user wants to continue or make manual fixes
      console.log(`\n⏸️  Iteration ${iteration} complete.`);
      console.log(`   ${report.poorQueries} queries still need improvement.`);
      console.log(`\n   Options:`);
      console.log(`   1. Continue to next iteration (automatic)`);
      console.log(`   2. Review recommendations and make manual fixes`);
      console.log(`   3. Exit optimization loop`);

      // In automated mode, just continue
      // You can modify this to pause and wait for manual fixes if desired
      iteration++;

      // Small delay between iterations
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (iteration > CONFIG.maxIterations) {
      console.log(`\n⚠️  Max iterations (${CONFIG.maxIterations}) reached.`);
      this.log.status = 'max_iterations_reached';
      this.saveLog();
    }

    // Final summary
    this.printFinalSummary();
  }

  private printFinalSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('OPTIMIZATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`Total iterations: ${this.log.totalIterations}`);
    console.log(`Final average score: ${this.log.finalScore}/100`);
    console.log(`Status: ${this.log.status}`);

    if (this.log.iterations.length > 0) {
      const firstReport = this.log.iterations[0];
      const lastReport = this.log.iterations[this.log.iterations.length - 1];

      console.log(`\nProgress:`);
      console.log(`  Initial poor queries: ${firstReport.poorQueries}`);
      console.log(`  Final poor queries:   ${lastReport.poorQueries}`);
      console.log(`  Initial avg score:    ${firstReport.averageScore}`);
      console.log(`  Final avg score:      ${lastReport.averageScore}`);
      console.log(`  Improvement:          +${lastReport.averageScore - firstReport.averageScore} points`);

      if (lastReport.poorQueries > 0) {
        console.log(`\n⚠️  Remaining poor queries:`);
        for (const pq of lastReport.poorQueryDetails) {
          console.log(`  • "${pq.query}" - Score: ${pq.score} (${pq.intent})`);
        }
      }
    }

    console.log(`\nLog saved to: ${CONFIG.fixLogPath}`);
    console.log('='.repeat(60) + '\n');
  }

  // Run a single evaluation without the full loop (for testing)
  async runSingleEvaluation(): Promise<IterationReport> {
    return this.runIteration(1);
  }
}

// CLI runner
async function main() {
  const optimizer = new AutoOptimizer();
  const args = process.argv.slice(2);

  if (args.includes('--single')) {
    // Run a single evaluation
    console.log('Running single evaluation...');
    await optimizer.runSingleEvaluation();
  } else if (args.includes('--loop')) {
    // Run the full optimization loop
    console.log('Starting optimization loop...');
    await optimizer.runOptimizationLoop();
  } else {
    // Default: run single evaluation
    console.log('Running comprehensive evaluation...');
    console.log('Use --loop for continuous optimization\n');
    await optimizer.runSingleEvaluation();
  }

  process.exit(0);
}

main().catch(console.error);
