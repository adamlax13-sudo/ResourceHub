/**
 * Standalone script to pre-translate all active services into French.
 *
 * Usage: node --env-file=.env --import tsx scripts/warm-french-translations.mjs
 *
 * Respects existing cached translations — only translates missing or stale entries.
 * Rate-limited to avoid hammering LibreTranslate.
 */

import { warmTranslations } from '../server/translation/batch.ts';

const lang = process.argv[2] || 'fr';

console.log(`[WarmTranslations] Starting ${lang} translation warming...`);
const start = Date.now();

try {
  const result = await warmTranslations(lang, (done, total) => {
    if (done % 25 === 0 || done === total) {
      const pct = ((done / total) * 100).toFixed(1);
      console.log(`  Progress: ${done}/${total} (${pct}%)`);
    }
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n[WarmTranslations] Complete in ${elapsed}s`);
  console.log(`  Total:      ${result.total}`);
  console.log(`  Translated: ${result.translated}`);
  console.log(`  Skipped:    ${result.skipped} (already cached)`);
  console.log(`  Errors:     ${result.errors}`);
} catch (err) {
  console.error('[WarmTranslations] Fatal error:', err);
  process.exit(1);
}

process.exit(0);
