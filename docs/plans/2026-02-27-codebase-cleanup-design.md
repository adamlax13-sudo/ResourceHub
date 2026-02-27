# Codebase Cleanup — Design Document

**Date:** 2026-02-27
**Goal:** Comprehensive cleanup across security, dead code, code quality, and structural improvements.
**Approach:** Risk-layered phases — safest changes first, riskiest last. Each phase is independently committable and deployable.

---

## Phase 1 — Safe Deletions (zero runtime impact)

### Delete dead files
- `scraper/reference_data.py.bak` — 4,500-line backup with no active counterpart
- `server/routes/feedback.ts`, `server/routes/analytics.ts`, `server/routes/index.ts` — orphaned modular routes that duplicate `server/routes.ts` and are never registered
- `server/helpers/scoring.ts` — 4 exports, 0 callers
- `scraper/enrich_missing_steps.py` — superseded by `enrich_process_steps.py`

### Remove unused npm dependencies (~15 packages)
- Auth cluster (never implemented): `passport`, `passport-google-oauth20`, `passport-local`, `openid-client`, `connect-pg-simple`, `express-session`, `memorystore` + their `@types/*`
- Unused utilities: `ws`, `memoizee`, `p-limit`, `p-retry`, `date-fns`, `zod-validation-error`, `next-themes`

### Remove unused Shadcn UI components (~34 files)
- Keep the ~12 actually imported: `button`, `badge`, `dialog`, `tooltip`, `toaster`, `toast`, `textarea`, `input`, `label`, `card`, `scroll-area`, `skeleton`
- Delete the rest (accordion, calendar, carousel, chart, sidebar, etc.)

### Move evaluation reports out of git
- Add `server/evaluation/reports/` to `.gitignore`
- Remove the 90 tracked report files from git

### Clean up root-level docs clutter
- Move `CATEGORY_RESTRUCTURE_PLAN.md`, `CLEANUP_SUMMARY.md`, `MIGRATION_SUMMARY.md` into `docs/plans/` (or delete if outdated)

---

## Phase 2 — Security Fixes (behavioral changes, low risk)

### Remove hardcoded credentials
- `scripts/fix_service_names.cjs` and `scripts/fix_service_names_v2.cjs` contain plaintext database connection strings. Replace with `process.env.DATABASE_URL` or delete (one-shot scripts already applied).

### Wire up PII scrubbing
- `server/helpers/pii.ts` exports `scrubPii()` but it's never called. Wire it into `server/search/analyzer.ts` before queries reach OpenAI.

### Extract hardcoded CORS origins
- `server/index.ts` lines 46-48 hardcode production domains. Move to `ALLOWED_ORIGINS` env var, falling back to current values.

### CSRF middleware
- `server/middleware/csrf.ts` has token validation commented out. Remove the dead commented-out strict block; keep logging-only behavior. Clarify intent.

---

## Phase 3 — Code Quality (refactoring, moderate risk)

### Replace 99 console.log calls in scoring with a debug logger
- Create `server/search/logger.ts` — checks `DEBUG_SEARCH` env var
- Replace all 99 `console.log` in `server/search/strategies/scoring.ts`
- Leave intentional logs in `server/index.ts`, `adminAuth.ts`, `routes.ts`

### Fix `as any` casts
- Add `is24_7` to `SemanticSearchResult` in `server/search/types.ts` — eliminates duplicate casts in `merger.ts:162` and `comprehensive.ts:309`
- Review 20 `as any` casts in `server/storage.ts` — add proper return types for raw SQL queries where feasible

### Add logging to silent catch blocks
- `server/storage.ts` lines 842, 874, 993 — add `console.error` with context. Keep fallback behavior intact.

### Remove dead exports
- `BOOST_CONFIG` in `server/search/strategies/scoring.ts:29` — deprecated alias, never imported. Delete.

---

## Phase 4 — Structural Improvements (higher risk)

### Split large files
- `server/search/strategies/scoring.ts` (1,267 lines) → `scoring/name-match.ts`, `scoring/intent-boost.ts`, `scoring/demographic-boost.ts`, `scoring/penalty.ts`, `scoring/index.ts` (orchestrator/re-exports)
- `server/search/config.ts` (1,055 lines) → `search/config/pinned.ts`, `search/config/scoring.ts`, `search/config/analysis.ts`, `search/config/index.ts` (re-exports)

### Consolidate duplicate scripts
- Delete applied one-shot scripts: `fix_service_names.cjs`, `fix_service_names_v2.cjs`
- Consolidate 5 duplicate-detection scripts into `scripts/duplicates.ts` with subcommands
- Consolidate 3 name-improvement scripts similarly

### Consolidate scraper migrations
- `scraper/migrations/` — 13 applied one-shot scripts from Feb 15. Move to `scraper/migrations/archive/` or delete with a README noting what they did.

### Complete routes modular refactor
- Extract inline implementations from `server/routes.ts` into `server/routes/` modules (feedback, analytics, search, admin)
- `server/routes.ts` becomes a thin registrar importing and mounting route modules

### Clean up root `.venv/`
- Delete orphaned root-level `.venv/` (scraper has its own `scraper/venv/`)
