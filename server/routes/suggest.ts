/**
 * Autocomplete / Search Suggestions — GET /api/suggest?q=<prefix>
 *
 * Returns grouped suggestions (services, categories, popular queries)
 * from an in-memory index that rebuilds periodically.
 * Supports typo tolerance via trigram similarity.
 */

import type { Express } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../helpers/errors';
import { storage } from '../storage';
import { apiLimiter } from '../middleware/rateLimiter';

// Index data types
interface SuggestionEntry {
  text: string;
  type: 'service' | 'category' | 'query';
  /** Lowercased text for matching */
  lower: string;
  /** Trigram set for fuzzy matching */
  trigrams: Set<string>;
}

interface SuggestResponse {
  services: string[];
  categories: string[];
  queries: string[];
}

// In-memory suggestion index
let suggestionIndex: SuggestionEntry[] = [];
let indexLastBuilt = 0;
const INDEX_TTL = 10 * 60 * 1000; // 10 minutes (matches services cache refresh)
let indexBuildPromise: Promise<void> | null = null;

// Crisis-related terms — filter these from service name suggestions (UX sensitivity)
const CRISIS_FILTER = /\b(suicide|crisis line|helpline|988|crisis hotline|self[- ]harm)\b/i;

// Category list (mirrors frontend CategoryTiles)
const CATEGORIES = [
  'Crisis Support', 'Domestic Violence', 'Mental Health', 'Addiction Recovery',
  'Housing', 'Food & Basic Needs', 'Healthcare', 'Disability Support',
  'Social Connection', 'Family & Parenting', 'Employment', 'Legal Aid',
];

/**
 * Generate character trigrams from a string (for fuzzy matching).
 */
function buildTrigrams(text: string): Set<string> {
  const s = text.toLowerCase();
  const trigrams = new Set<string>();
  for (let i = 0; i <= s.length - 3; i++) {
    trigrams.add(s.slice(i, i + 3));
  }
  return trigrams;
}

/**
 * Trigram similarity: |intersection| / |union| (Jaccard coefficient).
 */
function trigramSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  Array.from(a).forEach(t => {
    if (b.has(t)) intersection++;
  });
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function buildEntry(text: string, type: SuggestionEntry['type']): SuggestionEntry {
  return { text, type, lower: text.toLowerCase(), trigrams: buildTrigrams(text) };
}

/**
 * Build or refresh the suggestion index from active services + categories + analytics.
 */
async function ensureIndex(): Promise<void> {
  const now = Date.now();
  if (suggestionIndex.length > 0 && (now - indexLastBuilt) < INDEX_TTL) return;

  // Deduplicate concurrent rebuild calls
  if (indexBuildPromise) {
    await indexBuildPromise;
    return;
  }

  indexBuildPromise = (async () => {
    try {
      const entries: SuggestionEntry[] = [];

      // 1. Active service names (excluding crisis-sensitive names)
      const activeServices = await storage.getAllActiveServices();
      for (const svc of activeServices) {
        if (svc.name && !CRISIS_FILTER.test(svc.name)) {
          entries.push(buildEntry(svc.name, 'service'));
        }
      }

      // 2. Category names
      for (const cat of CATEGORIES) {
        entries.push(buildEntry(cat, 'category'));
      }

      // 3. Popular search queries (top 100 from last 30 days)
      const popularQueries = await storage.getPopularQueries(100, 30);
      const serviceNames = new Set(entries.filter(e => e.type === 'service').map(e => e.lower));
      for (const q of popularQueries) {
        if (!CRISIS_FILTER.test(q) && !serviceNames.has(q.toLowerCase())) {
          entries.push(buildEntry(q, 'query'));
        }
      }

      suggestionIndex = entries;
      indexLastBuilt = Date.now();
      console.log(`[Suggest] Index built: ${entries.length} entries (${activeServices.length} services, ${CATEGORIES.length} categories, ${popularQueries.length} queries)`);
    } finally {
      indexBuildPromise = null;
    }
  })();

  await indexBuildPromise;
}

/**
 * Search the index for matches, returning grouped results.
 */
function searchIndex(prefix: string, maxResults: number = 7): SuggestResponse {
  const lower = prefix.toLowerCase();
  const queryTrigrams = buildTrigrams(prefix);

  interface ScoredEntry {
    entry: SuggestionEntry;
    score: number;
  }

  const scored: ScoredEntry[] = [];

  for (const entry of suggestionIndex) {
    let score = 0;

    // Exact prefix match (strongest signal)
    if (entry.lower.startsWith(lower)) {
      score = 1.0;
    }
    // Contains the prefix
    else if (entry.lower.includes(lower)) {
      score = 0.7;
    }
    // Trigram fuzzy match (typo tolerance)
    else if (prefix.length >= 3) {
      const sim = trigramSimilarity(queryTrigrams, entry.trigrams);
      if (sim >= 0.25) {
        score = sim * 0.6; // Scale down fuzzy matches
      }
    }

    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  // Sort by score descending, then alphabetically
  scored.sort((a, b) => b.score - a.score || a.entry.text.localeCompare(b.entry.text));

  // Group by type, respecting max results
  const result: SuggestResponse = { services: [], categories: [], queries: [] };
  let total = 0;

  for (const { entry } of scored) {
    if (total >= maxResults) break;
    if (entry.type === 'category' && result.categories.length < 2) {
      result.categories.push(entry.text);
      total++;
    } else if (entry.type === 'service' && result.services.length < 4) {
      result.services.push(entry.text);
      total++;
    } else if (entry.type === 'query' && result.queries.length < 3) {
      result.queries.push(entry.text);
      total++;
    }
  }

  return result;
}

const suggestInput = z.object({
  q: z.string().min(1).max(200),
});

export function registerSuggestRoutes(app: Express): void {
  app.get('/api/suggest', apiLimiter, asyncHandler(async (req, res) => {
    const parsed = suggestInput.safeParse(req.query);
    if (!parsed.success) {
      return res.json({ services: [], categories: [], queries: [] });
    }

    await ensureIndex();
    const results = searchIndex(parsed.data.q);
    res.json(results);
  }));
}
