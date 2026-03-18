/**
 * Category Cache Warmer
 *
 * Pre-warms the search cache for common category queries so users
 * get instant results when clicking category tiles.
 *
 * Triggers: server startup (staggered), after cache clear, every 6 hours.
 */

import { search } from './index';

// Category queries matching the frontend CategoryTiles
const CATEGORY_QUERIES = [
  'crisis support emergency help',
  'domestic violence abuse safety support',
  'mental health counselling therapy',
  'addiction recovery treatment',
  'housing shelter accommodation',
  'food bank meals basic needs',
  'healthcare medical clinic',
  'disability support accessibility',
  'social connection community recreation programs',
  'family parenting pregnancy child support',
  'employment job training work',
  'legal aid lawyer court advocacy',
];

let isWarming = false;

/**
 * Pre-warm cache by running each category query through the search pipeline.
 * Staggered with 500ms delay between queries to avoid overwhelming the DB/LLM.
 */
export async function prewarmCategoryCache(): Promise<void> {
  if (isWarming) {
    console.log('[CacheWarmer] Already warming, skipping');
    return;
  }

  isWarming = true;
  const startTime = Date.now();
  let success = 0;
  let errors = 0;

  console.log(`[CacheWarmer] Starting prewarm for ${CATEGORY_QUERIES.length} categories`);

  for (const query of CATEGORY_QUERIES) {
    try {
      await search({
        query,
        page: 1,
        pageSize: 30,
      });
      success++;
    } catch (err) {
      errors++;
      console.warn(`[CacheWarmer] Failed to warm "${query}":`, err instanceof Error ? err.message : err);
    }
    // Stagger to avoid rate limits and DB load spikes
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  isWarming = false;
  console.log(`[CacheWarmer] Complete in ${((Date.now() - startTime) / 1000).toFixed(1)}s: ${success} cached, ${errors} errors`);
}

// 6-hour interval timer handle
let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Schedule recurring cache warm (every 6 hours).
 * Call once at server startup.
 */
export function startCacheWarmerSchedule(): void {
  // Non-blocking startup warm (30s delay to let server finish booting)
  setTimeout(() => {
    prewarmCategoryCache().catch(err => {
      console.warn('[CacheWarmer] Startup prewarm failed:', err instanceof Error ? err.message : err);
    });
  }, 30_000);

  // Recurring every 6 hours
  intervalHandle = setInterval(() => {
    prewarmCategoryCache().catch(err => {
      console.warn('[CacheWarmer] Scheduled prewarm failed:', err instanceof Error ? err.message : err);
    });
  }, 6 * 60 * 60 * 1000);
}

export function stopCacheWarmerSchedule(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
