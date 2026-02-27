# Codebase Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Comprehensive cleanup of dead code, security issues, code quality problems, and structural debt — phased by risk level.

**Architecture:** Four phases ordered by blast radius. Phase 1 (safe deletions) has zero runtime impact. Phase 2 (security) makes low-risk behavioral changes. Phase 3 (code quality) refactors internals. Phase 4 (structural) splits/reorganizes modules.

**Tech Stack:** TypeScript, Node/Express, React, Python, npm

---

## Phase 1 — Safe Deletions

### Task 1.1: Delete orphaned server route files

**Files:**
- Delete: `server/routes/feedback.ts`
- Delete: `server/routes/analytics.ts`
- Delete: `server/routes/index.ts`
- Keep: `server/routes/health.ts` (actively used by `server/index.ts`)

**Step 1: Delete the orphaned files**

```bash
rm server/routes/feedback.ts server/routes/analytics.ts server/routes/index.ts
```

**Step 2: Verify the server still compiles**

Run: `npm run check`
Expected: No errors (these files were never imported)

**Step 3: Commit**

```bash
git add -u server/routes/
git commit -m "chore: remove orphaned route modules (feedback, analytics, index)

These were an incomplete refactor — never registered or imported.
The inline implementations in server/routes.ts remain active."
```

---

### Task 1.2: Delete dead helper and scraper files

**Files:**
- Delete: `server/helpers/scoring.ts` (4 exports, 0 callers)
- Modify: `server/helpers/index.ts` — remove `export * from './scoring'`
- Delete: `scraper/reference_data.py.bak`
- Delete: `scraper/enrich_missing_steps.py` (superseded by `enrich_process_steps.py`)

**Step 1: Remove the scoring re-export from helpers/index.ts**

In `server/helpers/index.ts`, delete the line:
```typescript
export * from './scoring';
```

**Step 2: Delete the dead files**

```bash
rm server/helpers/scoring.ts
rm scraper/reference_data.py.bak
rm scraper/enrich_missing_steps.py
```

**Step 3: Verify server compiles**

Run: `npm run check`
Expected: No errors

**Step 4: Commit**

```bash
git add server/helpers/scoring.ts server/helpers/index.ts scraper/reference_data.py.bak scraper/enrich_missing_steps.py
git commit -m "chore: remove dead helper scoring, reference_data.bak, and old enrichment script"
```

---

### Task 1.3: Remove unused npm dependencies — auth cluster

**Files:**
- Modify: `package.json`

**Step 1: Uninstall auth packages**

```bash
npm uninstall passport passport-google-oauth20 passport-local openid-client connect-pg-simple express-session memorystore @types/connect-pg-simple @types/express-session @types/passport @types/passport-google-oauth20 @types/passport-local
```

**Step 2: Verify server compiles**

Run: `npm run check`
Expected: No errors (none of these are imported anywhere)

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused auth dependencies (passport, express-session, openid-client, etc.)

Auth was removed previously but these packages were left in package.json."
```

---

### Task 1.4: Remove unused npm dependencies — utilities

**Files:**
- Modify: `package.json`

**Step 1: Uninstall utility packages**

```bash
npm uninstall ws memoizee p-limit p-retry date-fns zod-validation-error next-themes @types/memoizee @types/ws
```

**Step 2: Check if `bufferutil` (optional dep of `ws`) is listed**

If `bufferutil` is in `optionalDependencies`, remove it too:
```bash
npm uninstall bufferutil
```

**Step 3: Verify server compiles**

Run: `npm run check`
Expected: No errors

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused utility dependencies (ws, memoizee, p-limit, date-fns, etc.)"
```

---

### Task 1.5: Delete unused Shadcn UI components

**Files:**
- Delete 35 files from `client/src/components/ui/`

**Keep these 12 (actively imported):**
- `badge.tsx`, `button.tsx`, `card.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `input.tsx`, `label.tsx`, `scroll-area.tsx`, `textarea.tsx`, `toast.tsx`, `toaster.tsx`, `tooltip.tsx`

**Delete everything else:**

```bash
cd client/src/components/ui
rm accordion.tsx alert-dialog.tsx alert.tsx aspect-ratio.tsx avatar.tsx \
   breadcrumb.tsx calendar.tsx carousel.tsx chart.tsx checkbox.tsx \
   collapsible.tsx command.tsx context-menu.tsx drawer.tsx form.tsx \
   hover-card.tsx input-otp.tsx menubar.tsx navigation-menu.tsx \
   pagination.tsx popover.tsx progress.tsx radio-group.tsx resizable.tsx \
   select.tsx separator.tsx sheet.tsx sidebar.tsx skeleton.tsx slider.tsx \
   switch.tsx table.tsx tabs.tsx toggle.tsx toggle-group.tsx
```

**Step 2: Verify client compiles**

Run: `npm run check`
Expected: No errors. If any component was actually used, the compile will catch it — re-add that file.

**Step 3: Commit**

```bash
git add -u client/src/components/ui/
git commit -m "chore: remove 35 unused Shadcn UI components

Kept: badge, button, card, dialog, dropdown-menu, input, label,
scroll-area, textarea, toast, toaster, tooltip"
```

---

### Task 1.6: Remove evaluation reports from git

**Files:**
- Modify: `.gitignore`
- Remove from tracking: `server/evaluation/reports/`

**Step 1: Add to .gitignore**

Add this line to `.gitignore`:
```
server/evaluation/reports/
```

**Step 2: Remove from git tracking (keep local files)**

```bash
git rm -r --cached server/evaluation/reports/
```

**Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: stop tracking evaluation reports (regenerated artifacts)

90 report files removed from git. Reports are regenerated by
npm run evaluate and don't need version control."
```

---

### Task 1.7: Clean up root-level doc clutter

**Files:**
- Move: `CATEGORY_RESTRUCTURE_PLAN.md` → `docs/plans/`
- Move: `CLEANUP_SUMMARY.md` → `docs/plans/`
- Move: `MIGRATION_SUMMARY.md` → `docs/plans/`
- Move: `design_guidelines.md` → `docs/`

**Step 1: Move files**

```bash
mv CATEGORY_RESTRUCTURE_PLAN.md docs/plans/
mv CLEANUP_SUMMARY.md docs/plans/
mv MIGRATION_SUMMARY.md docs/plans/
mv design_guidelines.md docs/
```

**Step 2: Commit**

```bash
git add CATEGORY_RESTRUCTURE_PLAN.md CLEANUP_SUMMARY.md MIGRATION_SUMMARY.md design_guidelines.md docs/
git commit -m "chore: move root-level docs into docs/ and docs/plans/"
```

---

## Phase 2 — Security Fixes

### Task 2.1: Remove scripts with hardcoded credentials

**Files:**
- Delete: `scripts/fix_service_names.cjs`
- Delete: `scripts/fix_service_names_v2.cjs`

These are one-shot scripts that have already been applied and contain plaintext database connection strings.

**Step 1: Delete the scripts**

```bash
rm scripts/fix_service_names.cjs scripts/fix_service_names_v2.cjs
```

**Step 2: Commit**

```bash
git add -u scripts/
git commit -m "security: remove one-shot scripts containing hardcoded database credentials

fix_service_names.cjs and v2 have already been applied.
They contained plaintext connection strings."
```

---

### Task 2.2: Wire up PII scrubbing

**Files:**
- Modify: `server/search/analyzer.ts` — call `scrubPii()` before query reaches AI

**Step 1: Add import and call scrubPii in analyzeQuery**

In `server/search/analyzer.ts`, add import:
```typescript
import { scrubPii } from '../helpers/pii';
```

Then in the `analyzeQuery` function, call `scrubPii` on the raw query before typo correction:
```typescript
export function analyzeQuery(query: string, ...) {
  const sanitized = scrubPii(query);
  const { corrected, corrections } = correctTypos(sanitized);
  // ... rest unchanged
```

Keep `analysis.raw` as the original `query` (for display), but use `sanitized` for all downstream processing.

**Step 2: Verify server compiles**

Run: `npm run check`
Expected: No errors

**Step 3: Test manually**

Search for a query like `"help at 780-555-1234"` and verify logs show `[PHONE]` replacement.

**Step 4: Commit**

```bash
git add server/search/analyzer.ts
git commit -m "security: wire up PII scrubbing before queries reach OpenAI

scrubPii() strips phone numbers, addresses, postal codes, and emails
from search queries before they're sent to the AI API."
```

---

### Task 2.3: Extract CORS origins to environment variable

**Files:**
- Modify: `server/index.ts` (lines 44-52)

**Step 1: Replace hardcoded origins with env var**

Replace the current CORS block:
```typescript
const allowedOrigins = [
  'https://resourcehub-wwg6.onrender.com',
  'https://recoveryoncampusalberta.ca',
  'https://www.recoveryoncampusalberta.ca',
];
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5000', 'http://localhost:5173');
}
```

With:
```typescript
const defaultOrigins = [
  'https://resourcehub-wwg6.onrender.com',
  'https://recoveryoncampusalberta.ca',
  'https://www.recoveryoncampusalberta.ca',
];
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : defaultOrigins;
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:5000', 'http://localhost:5173');
}
```

**Step 2: Add `ALLOWED_ORIGINS` to `.env.example`**

```
ALLOWED_ORIGINS=https://resourcehub-wwg6.onrender.com,https://recoveryoncampusalberta.ca,https://www.recoveryoncampusalberta.ca
```

**Step 3: Verify server compiles**

Run: `npm run check`

**Step 4: Commit**

```bash
git add server/index.ts .env.example
git commit -m "security: extract CORS origins to ALLOWED_ORIGINS env var

Falls back to current hardcoded values if env var is not set."
```

---

### Task 2.4: Clean up CSRF middleware

**Files:**
- Modify: `server/middleware/csrf.ts`

**Step 1: Remove commented-out strict enforcement block**

In the `csrfProtection` middleware, remove the commented-out `return res.status(403)` line and its surrounding comments about "gradual rollout". Replace with a clear comment:

```typescript
// CSRF validation: log-only mode. Token mismatch is logged but not blocked.
// To enforce strict CSRF, use strictCsrfProtection middleware instead.
```

**Step 2: Verify server compiles**

Run: `npm run check`

**Step 3: Commit**

```bash
git add server/middleware/csrf.ts
git commit -m "chore: clean up CSRF middleware — clarify log-only vs strict mode"
```

---

## Phase 3 — Code Quality

### Task 3.1: Create search debug logger

**Files:**
- Create: `server/search/logger.ts`

**Step 1: Create the logger utility**

```typescript
/**
 * Search debug logger — silent in production unless DEBUG_SEARCH is set.
 */
const isDebug = process.env.DEBUG_SEARCH === '1' || process.env.DEBUG_SEARCH === 'true';

export const searchLog = {
  debug: (...args: unknown[]) => {
    if (isDebug) console.log(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDebug) console.warn(...args);
  },
};
```

**Step 2: Commit**

```bash
git add server/search/logger.ts
git commit -m "feat: add search debug logger (silent unless DEBUG_SEARCH=1)"
```

---

### Task 3.2: Replace console.log calls in scoring.ts

**Files:**
- Modify: `server/search/strategies/scoring.ts`

**Step 1: Add import**

```typescript
import { searchLog } from '../logger';
```

**Step 2: Replace all `console.log` with `searchLog.debug`**

Find and replace all ~99 instances of `console.log(` with `searchLog.debug(` in this file. Do NOT touch `console.warn` or `console.error` if any exist.

**Step 3: Verify server compiles**

Run: `npm run check`

**Step 4: Run search evaluation to verify no behavioral change**

Run: `npm run evaluate`
Expected: Same results as before (logging change only)

**Step 5: Commit**

```bash
git add server/search/strategies/scoring.ts
git commit -m "chore: replace 99 console.log calls in scoring with debug logger

Scoring logs are now silent in production. Set DEBUG_SEARCH=1 to enable."
```

---

### Task 3.3: Remove BOOST_CONFIG dead export

**Files:**
- Modify: `server/search/strategies/scoring.ts`

**Step 1: Delete the deprecated alias**

Remove these lines (around line 28-29):
```typescript
// Alias for backwards compatibility (deprecated - use SCORING_CONFIG instead)
export const BOOST_CONFIG = SCORING_CONFIG;
```

**Step 2: Grep for any imports of BOOST_CONFIG**

```bash
grep -r "BOOST_CONFIG" server/ client/
```
Expected: No results (confirmed unused)

**Step 3: Verify server compiles**

Run: `npm run check`

**Step 4: Commit**

```bash
git add server/search/strategies/scoring.ts
git commit -m "chore: remove dead BOOST_CONFIG export from scoring"
```

---

### Task 3.4: Fix `as any` casts for is24_7

**Files:**
- Modify: `server/search/strategies/merger.ts`
- Modify: `server/search/strategies/comprehensive.ts`

`FastSearchResult` already has `is24_7?: boolean | null` (types.ts:199), and `SemanticSearchResult` extends it. The `as any` casts are unnecessary.

**Step 1: In merger.ts (~line 162), replace:**

```typescript
(sr as any).is24_7
```
with:
```typescript
sr.is24_7
```

**Step 2: In comprehensive.ts (~line 309), same replacement**

**Step 3: Verify server compiles**

Run: `npm run check`
Expected: No errors — the type already includes `is24_7`

**Step 4: Commit**

```bash
git add server/search/strategies/merger.ts server/search/strategies/comprehensive.ts
git commit -m "fix: remove unnecessary as any casts for is24_7 (already in type)"
```

---

### Task 3.5: Add logging to silent catch blocks

**Files:**
- Modify: `server/storage.ts` (lines ~842, ~874, ~993)

**Step 1: For each empty `catch {}` block at these locations, add error logging**

Pattern — replace:
```typescript
} catch {
  return [];
}
```
with:
```typescript
} catch (err) {
  console.error('[storage] getFailedQueries error:', err);
  return [];
}
```

Apply to all three locations (~842: `getFailedQueries`, ~874: `getQueryAffinities`, ~993: `getSearchQualityMetrics`). Keep the fallback return values.

**Step 2: Verify server compiles**

Run: `npm run check`

**Step 3: Commit**

```bash
git add server/storage.ts
git commit -m "fix: log errors in silent catch blocks instead of swallowing them

getFailedQueries, getQueryAffinities, getSearchQualityMetrics now log
errors instead of silently returning defaults."
```

---

## Phase 4 — Structural Improvements

### Task 4.1: Split scoring.ts into modules

**Files:**
- Create: `server/search/strategies/scoring/` directory
- Create: `server/search/strategies/scoring/index.ts` (re-exports)
- Create: `server/search/strategies/scoring/name-match.ts`
- Create: `server/search/strategies/scoring/intent-boost.ts`
- Create: `server/search/strategies/scoring/demographic-boost.ts`
- Create: `server/search/strategies/scoring/penalty.ts`
- Delete: `server/search/strategies/scoring.ts` (after extraction)

**Step 1: Read scoring.ts and identify function boundaries**

Map each exported function to its target module:
- `name-match.ts`: name matching / alias boosting functions
- `intent-boost.ts`: intent-based scoring (category relevance, crisis, substance type)
- `demographic-boost.ts`: age, gender, student, community, language, family context boosting
- `penalty.ts`: penalty/demotion functions (low quality, irrelevant, exclusion matches)

**Step 2: Create each module with its functions and imports**

Move functions into their target files. Each file imports what it needs from `../../config`, `../../types`, `../detectors`, and `../../logger`.

**Step 3: Create scoring/index.ts that re-exports everything**

```typescript
export { SCORING_CONFIG } from '../../config';
export * from './name-match';
export * from './intent-boost';
export * from './demographic-boost';
export * from './penalty';
```

This preserves all existing imports from `'./scoring'` in other files.

**Step 4: Delete old scoring.ts**

**Step 5: Verify server compiles**

Run: `npm run check`

**Step 6: Run evaluation**

Run: `npm run evaluate`
Expected: Identical results

**Step 7: Commit**

```bash
git add server/search/strategies/scoring/ server/search/strategies/scoring.ts
git commit -m "refactor: split scoring.ts (1267 lines) into 4 focused modules

name-match, intent-boost, demographic-boost, penalty.
Re-exports from scoring/index.ts preserve existing imports."
```

---

### Task 4.2: Split config.ts into modules

**Files:**
- Create: `server/search/config/` directory
- Create: `server/search/config/index.ts` (re-exports)
- Create: `server/search/config/scoring.ts` (scoring thresholds)
- Create: `server/search/config/pinned.ts` (crisis/pinning config)
- Create: `server/search/config/analysis.ts` (query analysis config)
- Delete: `server/search/config.ts` (after extraction)

**Step 1: Read config.ts and identify section boundaries**

Map each export to its target module.

**Step 2: Create modules and re-export from config/index.ts**

Same pattern as Task 4.1 — all existing `import from './config'` statements continue to work.

**Step 3: Verify and commit**

Run: `npm run check`

```bash
git add server/search/config/ server/search/config.ts
git commit -m "refactor: split config.ts (1055 lines) into focused modules

scoring, pinned, analysis config separated.
Re-exports from config/index.ts preserve existing imports."
```

---

### Task 4.3: Consolidate duplicate scripts

**Files:**
- Delete: `scripts/find_generic_names.cjs` (analysis now in `detect-duplicates.ts`)
- Delete: `scripts/generate-name-improvements.ts` (folded into `improve-service-names.ts`)
- Delete: `scripts/dry-run-duplicates.ts` (folded into `detect-duplicates.ts --dry-run`)
- Delete: `scripts/find-duplicate-services.ts` (overlaps with `detect-duplicates.ts`)
- Delete: `scripts/merge-confirmed-duplicates.ts` (folded into `merge-duplicates.ts`)
- Delete: `scripts/deactivate-safe-duplicates.ts` (one-shot, already applied)
- Delete: `scripts/verify-renames.ts` (one-shot verification, already applied)

**Step 1: Verify each script is a one-shot that's been applied**

Check git log for each script to confirm they've been run.

**Step 2: Delete the redundant scripts**

**Step 3: Commit**

```bash
git add -u scripts/
git commit -m "chore: remove applied one-shot and redundant data maintenance scripts

Kept: detect-duplicates, merge-duplicates, improve-service-names,
and other scripts still needed for ongoing maintenance."
```

---

### Task 4.4: Archive scraper migrations

**Files:**
- Move: `scraper/migrations/*.js` (11 files from Feb 15) → `scraper/migrations/archive/`
- Keep: `scraper/migrations/add_confidence_fields.sql` (schema migration, Feb 22)

**Step 1: Create archive directory and move**

```bash
mkdir -p scraper/migrations/archive
mv scraper/migrations/comprehensive_category_fix.js scraper/migrations/archive/
mv scraper/migrations/database_cleanup.js scraper/migrations/archive/
mv scraper/migrations/fix_categories_and_duplicates.js scraper/migrations/archive/
mv scraper/migrations/fix_final_mismatches.js scraper/migrations/archive/
mv scraper/migrations/fix_food_bank_miscategorization.js scraper/migrations/archive/
mv scraper/migrations/fix_regional_services.js scraper/migrations/archive/
mv scraper/migrations/fix_remaining_miscategorized.js scraper/migrations/archive/
mv scraper/migrations/fix_validation_issues.js scraper/migrations/archive/
mv scraper/migrations/run_consolidation.js scraper/migrations/archive/
mv scraper/migrations/run_consolidation_final.js scraper/migrations/archive/
mv scraper/migrations/run_consolidation_phase2.js scraper/migrations/archive/
mv scraper/migrations/consolidate_categories.sql scraper/migrations/archive/
```

**Step 2: Commit**

```bash
git add scraper/migrations/
git commit -m "chore: archive applied one-shot scraper migrations from Feb 15"
```

---

### Task 4.5: Complete routes modular refactor

**Files:**
- Create: `server/routes/search.ts`
- Create: `server/routes/feedback.ts` (fresh, not the deleted orphan)
- Create: `server/routes/analytics.ts` (fresh, not the deleted orphan)
- Create: `server/routes/admin.ts`
- Modify: `server/routes.ts` → thin registrar that imports and mounts route modules

**Step 1: Read `server/routes.ts` to identify route groups**

Map each endpoint to its target module:
- `search.ts`: `/api/search`, `/api/services/:id`
- `feedback.ts`: `/api/feedback`
- `analytics.ts`: `/api/track-click`, `/api/analytics/popular-searches`
- `admin.ts`: `/api/admin/*` endpoints

**Step 2: Extract each group into its module**

Each module exports a function like:
```typescript
export function registerSearchRoutes(app: Express) { ... }
```

**Step 3: Simplify routes.ts to a registrar**

```typescript
import { registerSearchRoutes } from './routes/search';
import { registerFeedbackRoutes } from './routes/feedback';
import { registerAnalyticsRoutes } from './routes/analytics';
import { registerAdminRoutes } from './routes/admin';

export function registerRoutes(app: Express) {
  registerSearchRoutes(app);
  registerFeedbackRoutes(app);
  registerAnalyticsRoutes(app);
  registerAdminRoutes(app);
}
```

**Step 4: Verify server compiles and all endpoints work**

Run: `npm run check`
Test key endpoints manually: search, feedback, admin health

**Step 5: Commit**

```bash
git add server/routes.ts server/routes/
git commit -m "refactor: extract routes.ts into modular route files

search, feedback, analytics, admin routes each in their own module.
routes.ts is now a thin registrar."
```

---

### Task 4.6: Delete orphaned root .venv

**Files:**
- Delete: `.venv/` directory

**Step 1: Verify .venv is not used**

```bash
ls -la .venv/
```

Confirm it's a stale Python venv. The scraper uses `scraper/venv/`.

**Step 2: Delete and add to .gitignore if not already there**

```bash
rm -rf .venv/
```

Check `.gitignore` for `.venv/` — add if missing.

**Step 3: Commit (if .gitignore changed)**

```bash
git add .gitignore
git commit -m "chore: remove orphaned root .venv and ensure it's gitignored"
```
