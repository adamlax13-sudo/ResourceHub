/**
 * Search Quality Evaluation System
 *
 * Runs test queries against the search system and uses Claude to evaluate:
 * - Relevance: Do results match the query intent?
 * - Ranking: Are the best results at the top?
 * - Completeness: Are key services missing?
 * - Data Quality: Is the information accurate and helpful?
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { search } from '../search/index.js';
import { analyzeQuery } from '../search/analyzer.js';
import { LiteService, SearchResponse } from '../search/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestQuery {
  query: string;
  location?: string;
  intent: string;
  description: string;
  expectedPatterns?: string[];  // Keywords we expect in good results
  mustInclude?: string[];       // Service names that MUST appear
  mustExclude?: string[];       // Service names that should NOT appear
}

interface EvaluationResult {
  query: TestQuery;
  results: LiteService[];
  searchTimeMs: number;
  detectedIntent: string;
  scores: {
    relevance: number;      // 0-100: Do results match intent?
    ranking: number;        // 0-100: Best results first?
    completeness: number;   // 0-100: Key services present?
    dataQuality: number;    // 0-100: Info accurate/helpful?
    overall: number;        // Weighted average
  };
  issues: string[];
  suggestions: string[];
  claudeAnalysis: string;
}

interface EvaluationReport {
  timestamp: string;
  totalQueries: number;
  averageScores: {
    relevance: number;
    ranking: number;
    completeness: number;
    dataQuality: number;
    overall: number;
  };
  queryResults: EvaluationResult[];
  criticalIssues: string[];
  recommendations: string[];
}

// Test queries covering all major intents and edge cases
const TEST_QUERIES: TestQuery[] = [
  // Crisis queries
  {
    query: "I want to kill myself",
    intent: "crisis",
    description: "Explicit suicidal ideation - must show 988 first",
    mustInclude: ["988 Suicide Crisis Helpline"],
  },
  {
    query: "I don't want to be here anymore",
    intent: "crisis",
    description: "Implicit suicidal ideation - should detect crisis",
    expectedPatterns: ["crisis", "suicide", "helpline", "988"],
  },
  {
    query: "feeling hopeless and like a burden",
    intent: "crisis",
    description: "Subtle crisis language",
    expectedPatterns: ["mental health", "crisis", "support"],
  },

  // Substance abuse queries
  {
    query: "help with alcohol addiction Calgary",
    location: "Calgary",
    intent: "substance_abuse",
    description: "Alcohol-specific addiction help",
    expectedPatterns: ["alcohol", "addiction", "recovery", "AA"],
  },
  {
    query: "opioid treatment Edmonton",
    location: "Edmonton",
    intent: "substance_abuse",
    description: "Opioid-specific treatment",
    expectedPatterns: ["opioid", "ODP", "methadone", "suboxone"],
  },
  {
    query: "my son is addicted to drugs what can I do",
    intent: "family_addiction_support",
    description: "PCHAD query - parent seeking help for child",
    expectedPatterns: ["PCHAD", "family", "parent"],
  },

  // Mental health queries
  {
    query: "free counselling Calgary",
    location: "Calgary",
    intent: "mental_health",
    description: "Free mental health services",
    expectedPatterns: ["counselling", "free", "sliding scale"],
  },
  {
    query: "anxiety therapy no waitlist",
    intent: "mental_health",
    description: "Urgent mental health with no wait",
    expectedPatterns: ["therapy", "counselling", "anxiety"],
  },
  {
    query: "PTSD support for veterans",
    intent: "mental_health",
    description: "Veteran-specific trauma support",
    expectedPatterns: ["veteran", "PTSD", "trauma", "military"],
  },

  // Housing queries
  {
    query: "emergency shelter tonight Calgary",
    location: "Calgary",
    intent: "housing_urgent",
    description: "Immediate shelter need",
    expectedPatterns: ["shelter", "emergency", "overnight"],
  },
  {
    query: "women's shelter domestic violence",
    intent: "domestic_violence",
    description: "DV shelter for women",
    expectedPatterns: ["women", "shelter", "domestic violence", "abuse"],
  },
  {
    query: "youth shelter under 18",
    intent: "youth_services",
    description: "Youth-specific housing",
    expectedPatterns: ["youth", "shelter", "teen"],
  },

  // Food security
  {
    query: "food bank near downtown Edmonton",
    location: "Edmonton",
    intent: "food_insecurity",
    description: "Food assistance with location",
    expectedPatterns: ["food bank", "food", "hamper"],
  },
  {
    query: "free meals for homeless",
    intent: "food_insecurity",
    description: "Meal programs for unhoused",
    expectedPatterns: ["meal", "soup kitchen", "drop-in"],
  },

  // Demographic-specific
  {
    query: "indigenous mental health support",
    intent: "indigenous_services",
    description: "Indigenous-specific services",
    expectedPatterns: ["indigenous", "First Nations", "Métis"],
  },
  {
    query: "LGBTQ counselling Calgary",
    location: "Calgary",
    intent: "lgbtq_services",
    description: "LGBTQ-affirming services",
    expectedPatterns: ["LGBTQ", "Pride", "queer"],
  },
  {
    query: "newcomer settlement services",
    intent: "newcomer_services",
    description: "Immigrant/refugee support",
    expectedPatterns: ["immigrant", "refugee", "settlement", "newcomer"],
  },

  // Exclusion queries
  {
    query: "addiction help not religious",
    intent: "substance_abuse",
    description: "Non-faith-based addiction services",
    mustExclude: ["Salvation Army", "church"],
    expectedPatterns: ["secular", "addiction"],
  },
  {
    query: "recovery support no 12 step",
    intent: "substance_abuse",
    description: "Non-12-step recovery options",
    expectedPatterns: ["SMART Recovery", "recovery"],
  },

  // Student services
  {
    query: "UCalgary mental health",
    intent: "student_services",
    description: "University-specific services",
    expectedPatterns: ["UCalgary", "student", "campus"],
  },

  // Legal aid
  {
    query: "free legal help family court",
    intent: "legal_aid",
    description: "Family law assistance",
    expectedPatterns: ["legal", "family", "court", "lawyer"],
  },

  // Grief support
  {
    query: "grief counselling after losing spouse",
    intent: "grief_support",
    description: "Bereavement support",
    expectedPatterns: ["grief", "bereavement", "loss"],
  },

  // Disability
  {
    query: "autism support adult Edmonton",
    location: "Edmonton",
    intent: "disability_support",
    description: "Adult autism services",
    expectedPatterns: ["autism", "disability", "support"],
  },

  // Edge cases
  {
    query: "help",
    intent: "general",
    description: "Vague query - should show diverse options",
  },
  {
    query: "Calgary",
    intent: "location_only",
    description: "Location-only query",
  },
];

export class SearchEvaluator {
  private claude: Anthropic;
  private reportDir: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set');
    }
    this.claude = new Anthropic({ apiKey });
    this.reportDir = path.join(__dirname, 'reports');

    // Ensure reports directory exists
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  async evaluateQuery(testQuery: TestQuery): Promise<EvaluationResult> {
    console.log(`\nEvaluating: "${testQuery.query}"`);

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

  async runFullEvaluation(queries: TestQuery[] = TEST_QUERIES): Promise<EvaluationReport> {
    console.log(`\n${'='.repeat(60)}`);
    console.log('SEARCH QUALITY EVALUATION');
    console.log(`${'='.repeat(60)}`);
    console.log(`Running ${queries.length} test queries...\n`);

    const results: EvaluationResult[] = [];

    for (const query of queries) {
      try {
        const result = await this.evaluateQuery(query);
        results.push(result);

        // Print progress
        const emoji = result.scores.overall >= 80 ? '✅' :
                     result.scores.overall >= 60 ? '⚠️' : '❌';
        console.log(`${emoji} Score: ${result.scores.overall}/100 | Intent: ${result.detectedIntent}`);

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error evaluating "${query.query}":`, error);
      }
    }

    // Calculate averages
    const avgScores = {
      relevance: Math.round(results.reduce((sum, r) => sum + r.scores.relevance, 0) / results.length),
      ranking: Math.round(results.reduce((sum, r) => sum + r.scores.ranking, 0) / results.length),
      completeness: Math.round(results.reduce((sum, r) => sum + r.scores.completeness, 0) / results.length),
      dataQuality: Math.round(results.reduce((sum, r) => sum + r.scores.dataQuality, 0) / results.length),
      overall: Math.round(results.reduce((sum, r) => sum + r.scores.overall, 0) / results.length),
    };

    // Identify critical issues (appearing in multiple queries)
    const issueCount = new Map<string, number>();
    results.forEach(r => {
      r.issues.forEach(issue => {
        issueCount.set(issue, (issueCount.get(issue) || 0) + 1);
      });
    });
    const criticalIssues = Array.from(issueCount.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([issue, count]) => `${issue} (${count} occurrences)`);

    // Aggregate recommendations
    const recommendations = this.generateRecommendations(results, avgScores);

    const report: EvaluationReport = {
      timestamp: new Date().toISOString(),
      totalQueries: results.length,
      averageScores: avgScores,
      queryResults: results,
      criticalIssues,
      recommendations,
    };

    // Save report
    await this.saveReport(report);

    // Print summary
    this.printSummary(report);

    return report;
  }

  private generateRecommendations(results: EvaluationResult[], avgScores: any): string[] {
    const recommendations: string[] = [];

    // Score-based recommendations
    if (avgScores.relevance < 70) {
      recommendations.push('PRIORITY: Improve intent detection and keyword matching - many results don\'t match query intent');
    }
    if (avgScores.ranking < 70) {
      recommendations.push('PRIORITY: Review scoring weights - best services aren\'t consistently ranked first');
    }
    if (avgScores.completeness < 70) {
      recommendations.push('PRIORITY: Add more services to database or improve service coverage for common queries');
    }
    if (avgScores.dataQuality < 70) {
      recommendations.push('PRIORITY: Enrich service descriptions with more actionable information');
    }

    // Check for specific issues
    const crisisQueries = results.filter(r => r.query.intent === 'crisis');
    const crisisIssues = crisisQueries.filter(r => r.scores.relevance < 90);
    if (crisisIssues.length > 0) {
      recommendations.push('CRITICAL: Crisis queries not performing well - review crisis detection patterns');
    }

    // Intent mismatch detection
    const intentMismatches = results.filter(r =>
      r.query.intent !== r.detectedIntent &&
      r.query.intent !== 'general'
    );
    if (intentMismatches.length > 0) {
      recommendations.push(`Intent detection failing for ${intentMismatches.length} queries - review analyzer patterns`);
    }

    // Slow queries
    const slowQueries = results.filter(r => r.searchTimeMs > 1000);
    if (slowQueries.length > 0) {
      recommendations.push(`${slowQueries.length} queries taking >1s - optimize search performance`);
    }

    return recommendations;
  }

  private async saveReport(report: EvaluationReport): Promise<void> {
    const filename = `evaluation-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(this.reportDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    console.log(`\nReport saved: ${filepath}`);

    // Also save a summary markdown
    const mdFilename = filename.replace('.json', '.md');
    const mdFilepath = path.join(this.reportDir, mdFilename);

    const markdown = this.generateMarkdownReport(report);
    fs.writeFileSync(mdFilepath, markdown);
    console.log(`Summary saved: ${mdFilepath}`);
  }

  private generateMarkdownReport(report: EvaluationReport): string {
    let md = `# Search Quality Evaluation Report\n\n`;
    md += `**Date:** ${report.timestamp}\n`;
    md += `**Queries Tested:** ${report.totalQueries}\n\n`;

    md += `## Overall Scores\n\n`;
    md += `| Metric | Score |\n|--------|-------|\n`;
    md += `| Relevance | ${report.averageScores.relevance}/100 |\n`;
    md += `| Ranking | ${report.averageScores.ranking}/100 |\n`;
    md += `| Completeness | ${report.averageScores.completeness}/100 |\n`;
    md += `| Data Quality | ${report.averageScores.dataQuality}/100 |\n`;
    md += `| **Overall** | **${report.averageScores.overall}/100** |\n\n`;

    if (report.criticalIssues.length > 0) {
      md += `## Critical Issues\n\n`;
      report.criticalIssues.forEach(issue => {
        md += `- ${issue}\n`;
      });
      md += '\n';
    }

    if (report.recommendations.length > 0) {
      md += `## Recommendations\n\n`;
      report.recommendations.forEach((rec, i) => {
        md += `${i + 1}. ${rec}\n`;
      });
      md += '\n';
    }

    md += `## Query Results\n\n`;

    // Group by score range
    const excellent = report.queryResults.filter(r => r.scores.overall >= 80);
    const good = report.queryResults.filter(r => r.scores.overall >= 60 && r.scores.overall < 80);
    const poor = report.queryResults.filter(r => r.scores.overall < 60);

    if (poor.length > 0) {
      md += `### ❌ Poor (< 60)\n\n`;
      poor.forEach(r => {
        md += `**"${r.query.query}"** - Score: ${r.scores.overall}\n`;
        md += `- Intent: ${r.query.intent} → Detected: ${r.detectedIntent}\n`;
        md += `- Issues: ${r.issues.join('; ')}\n`;
        md += `- Analysis: ${r.claudeAnalysis}\n\n`;
      });
    }

    if (good.length > 0) {
      md += `### ⚠️ Needs Improvement (60-79)\n\n`;
      good.forEach(r => {
        md += `**"${r.query.query}"** - Score: ${r.scores.overall}\n`;
        md += `- Issues: ${r.issues.join('; ')}\n\n`;
      });
    }

    md += `### ✅ Good (80+): ${excellent.length} queries\n\n`;

    return md;
  }

  private printSummary(report: EvaluationReport): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log('EVALUATION SUMMARY');
    console.log(`${'='.repeat(60)}`);

    console.log(`\nOverall Scores:`);
    console.log(`  Relevance:    ${report.averageScores.relevance}/100`);
    console.log(`  Ranking:      ${report.averageScores.ranking}/100`);
    console.log(`  Completeness: ${report.averageScores.completeness}/100`);
    console.log(`  Data Quality: ${report.averageScores.dataQuality}/100`);
    console.log(`  ─────────────────────`);
    console.log(`  OVERALL:      ${report.averageScores.overall}/100`);

    if (report.criticalIssues.length > 0) {
      console.log(`\nCritical Issues:`);
      report.criticalIssues.forEach(issue => console.log(`  ⚠️  ${issue}`));
    }

    if (report.recommendations.length > 0) {
      console.log(`\nRecommendations:`);
      report.recommendations.forEach((rec, i) => console.log(`  ${i + 1}. ${rec}`));
    }

    // Score distribution
    const scores = report.queryResults.map(r => r.scores.overall);
    const excellent = scores.filter(s => s >= 80).length;
    const good = scores.filter(s => s >= 60 && s < 80).length;
    const poor = scores.filter(s => s < 60).length;

    console.log(`\nScore Distribution:`);
    console.log(`  ✅ Excellent (80+): ${excellent}`);
    console.log(`  ⚠️  Good (60-79):   ${good}`);
    console.log(`  ❌ Poor (<60):      ${poor}`);

    console.log(`\n${'='.repeat(60)}\n`);
  }
}

// CLI runner
async function main() {
  const evaluator = new SearchEvaluator();

  // Check for specific query argument
  const args = process.argv.slice(2);

  if (args.length > 0 && args[0] !== '--all') {
    // Evaluate single query
    const testQuery: TestQuery = {
      query: args.join(' '),
      intent: 'general',
      description: 'Ad-hoc query evaluation',
    };

    const result = await evaluator.evaluateQuery(testQuery);

    console.log('\n' + '='.repeat(60));
    console.log(`Query: "${testQuery.query}"`);
    console.log('='.repeat(60));
    console.log(`\nScores:`);
    console.log(`  Relevance:    ${result.scores.relevance}/100`);
    console.log(`  Ranking:      ${result.scores.ranking}/100`);
    console.log(`  Completeness: ${result.scores.completeness}/100`);
    console.log(`  Data Quality: ${result.scores.dataQuality}/100`);
    console.log(`  Overall:      ${result.scores.overall}/100`);
    console.log(`\nDetected Intent: ${result.detectedIntent}`);
    console.log(`Search Time: ${result.searchTimeMs}ms`);
    console.log(`\nResults (${result.results.length}):`);
    result.results.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.name} (${r.category})`);
    });
    console.log(`\nAnalysis: ${result.claudeAnalysis}`);
    if (result.issues.length > 0) {
      console.log(`\nIssues:`);
      result.issues.forEach(issue => console.log(`  - ${issue}`));
    }
    if (result.suggestions.length > 0) {
      console.log(`\nSuggestions:`);
      result.suggestions.forEach(sug => console.log(`  - ${sug}`));
    }
  } else {
    // Run full evaluation
    await evaluator.runFullEvaluation();
  }

  process.exit(0);
}

main().catch(console.error);
