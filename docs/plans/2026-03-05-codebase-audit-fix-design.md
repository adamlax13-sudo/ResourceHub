# Codebase Audit Fix Overhaul — Design Document

**Date:** 2026-03-05
**Scope:** 29 issues (2 critical, 9 high, 11 medium, 7 low) across 95 audited files
**Strategy:** 6 parallel worktree-isolated subagents + 1 sequential verification/merge pass

---

## Context

A full codebase audit was conducted across 5 areas (server core, search pipeline, frontend, shared schemas, Python scraper). This document defines the fix plan for all 29 issues, organized into file-grouped workstreams to maximize parallelism and avoid git conflicts.

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Remove dead CSRF code** (H1) instead of enforcing it | Frontend never sends CSRF tokens. CORS origin checks are the real defense. Enforcing would require frontend changes = scope creep |
| **Zod-only fix for feedback field lengths** (H3) | Changing DB column widths requires `db:push` against production. Risk of migration failure if data exceeds limit. Zod catches it before DB |
| **Standalone SQL script for searches index** (H4) | Index creation on production table should be a controlled operation, not bundled into schema push |
| **Keep ref guard in Home.tsx** (H5) | Ref guard prevents StrictMode double-fire. Real fix is adding missing deps. Downgraded to MEDIUM |
| **Worktree isolation for all agents** | CLAUDE.md mandates `isolation: "worktree"` for subagents that write code to prevent git index corruption |

---

## Workstream 1: Safety Critical (C1, C2)

**Files:** `QuickExitButton.tsx`, `ProcessTimeline.tsx`, `ServiceModal.tsx`, **new** `client/src/lib/linkify.ts`

| Issue | Severity | Change |
|---|---|---|
| C1 | CRITICAL | Rewrite `handleExit()`: push `history.length` entries to Google URL before `location.replace()`. Eliminates trivial back-button return to ResourceHub |
| C2 | CRITICAL | Extract `isSafeUrl()` + `linkifyText()` from `ServiceModal.tsx` into new shared `lib/linkify.ts`. Import in both `ServiceModal.tsx` and `ProcessTimeline.tsx`. Add `isSafeUrl()` check to bare-domain branch (match[4]) |

**Why together:** C2 creates the only new file in the overhaul. Both ServiceModal and ProcessTimeline must import from it. No other workstream touches these files.

---

## Workstream 2: Frontend State Bugs (H6, H7, H8, M4, M5, M6, M7, H5)

**Files:** `SearchContext.tsx`, `use-favorites.ts`, `MyShortlist.tsx`, `Hero.tsx`, `use-toast.ts`, `use-focus-trap.ts`, `Home.tsx`

| Issue | Severity | Change |
|---|---|---|
| H6 | HIGH | `use-favorites.ts:32`: Add `if (!Array.isArray(parsed)) return;` after `JSON.parse` |
| H7 | HIGH | `MyShortlist.tsx:539`: Remove `onBlur` handler. Add `useRef<ReturnType<typeof setTimeout>>` with 3s auto-reset when `confirmingClear` becomes true. Clear timer on unmount |
| H8 | HIGH | `SearchContext.tsx:80-85`: Add `VALID_GENDERS`, `VALID_AGES`, `VALID_FORMATS` const arrays. Validate URL params with `.includes()` before casting |
| M4 | MEDIUM | `Hero.tsx:621`: Add `const locationsRef = useRef(locations)` updated each render. Use `locationsRef.current` in voice callback |
| M5 | MEDIUM | `use-toast.ts:182`: Change dep array from `[state]` to `[setState]`. `setState` is stable (React guarantee), so effect runs once on mount |
| M6 | MEDIUM | `use-focus-trap.ts:66`: Add `const onCloseRef = useRef(onClose)` updated via layout effect. Use `onCloseRef.current` in keydown handler. Change dep from `[isOpen, onClose]` to `[isOpen]` |
| M7 | MEDIUM | `Hero.tsx:97-110`: Add `resize` event listener alongside existing `scroll` listener — close dropdown on resize |
| H5 | MEDIUM | `Home.tsx:118`: Add `handleSearchWithFilters`, `searchState.locations`, `searchState.filters` to dep array. Keep ref guard. Remove `eslint-disable` comment |

**Why together:** All React hook/state fixes. These files form a connected graph (Home imports SearchContext, uses hooks). Single agent understands the full state flow.

---

## Workstream 3: Server Security (H1, H2, H9, M2)

**Files:** `server/index.ts`, `server/middleware/csrf.ts`, `server/middleware/adminAuth.ts`, `server/routes/analytics.ts`

| Issue | Severity | Change |
|---|---|---|
| H1 | HIGH | Remove `csrfProtection(allowedOrigins)` middleware and `/api/csrf-token` endpoint from `index.ts`. Add comment documenting CORS origin allowlist as primary CSRF defense. Keep `csrf.ts` with `strictCsrfProtection` exported for future use. Remove `csrfTokens` Map, cleanup interval, `getOrCreateToken`, `generateCsrfToken`, `csrfTokenEndpoint` (all dead code) |
| H2 | HIGH | Replace custom `constantTimeCompare` with `crypto.timingSafeEqual`. Handle length mismatch by comparing against a fixed-length hash of both values (avoids leaking key length) |
| H9 | DOC | `db.ts:25`: Add comment: `// Render.com free tier does not provide CA certificate; accepted risk` |
| M2 | MEDIUM | `analytics.ts:28`: Truncate userAgent to 500 chars before storage |

---

## Workstream 4: Schema & DB Hardening (H3, H4, M1, M3, L3)

**Files:** `shared/schema.ts`, `server/routes/feedback.ts`, `server/storage.ts`, **new** `scripts/add-searches-index.sql`

| Issue | Severity | Change |
|---|---|---|
| H3 | HIGH | `feedback.ts:15-16`: Add `.max(255)` to Zod name/email fields. Do NOT change DB columns — Zod catches oversized input before DB |
| H4 | HIGH | Add `clearStaleSearches()` to storage: `DELETE FROM searches WHERE created_at < NOW() - INTERVAL '7 days'`. Call from admin refresh endpoint. Create `scripts/add-searches-index.sql` for manual production run |
| M1 | MEDIUM | `schema.ts:156-168`: Delete unused `interface ServiceDetail` (all imports use `@shared/routes`) |
| M3 | MEDIUM | `schema.ts:142`: Add comment documenting Zod enforcement of vote values |
| L3 | LOW | `schema.ts:64`: Add comment documenting intentional soft reference (no FK) |

---

## Workstream 5: Frontend A11y & UX (M11, L1, L2)

**Files:** `CategoryTiles.tsx`, `not-found.tsx`, `ServiceCard.tsx`

| Issue | Severity | Change |
|---|---|---|
| M11 | MEDIUM | Add `aria-label` with action context to category tile buttons |
| L1 | LOW | Replace developer-facing 404 copy with user-friendly message |
| L2 | LOW | Cap animation stagger delay at 0.5s: `Math.min(index * 0.1, 0.5)` |

---

## Workstream 6: Scraper Fixes (M8, M9, M10, L4, L5, L6, L7)

**Files:** `scraper/finalize.py`, `scraper/upserter.py`, `scraper/pipeline.py`, `scraper/enrichment.py`, `scraper/scraper.py`

| Issue | Severity | Change |
|---|---|---|
| M8+M10 | MEDIUM | `finalize.py:102`: Filter query to only load services where phone/email/address IS NULL |
| M9 | MEDIUM | `upserter.py:23`: Add scaling comment documenting O(n*m) as acceptable for ~500 services |
| L4 | LOW | `scraper.py:74`: Remove default DATABASE_URL value; require env var with clear error |
| L5 | LOW | `enrichment.py:127`: Add comment documenting conservative fallback estimate |
| L6 | LOW | `pipeline.py:59`: Initialize `self._consecutive_errors = 0` in `__init__` |
| L7 | LOW | `finalize.py:339`: Add `hasattr` guard before setting `log.services_deactivated` |

---

## Workstream 7: Verification & Merge (sequential, after WS1-6)

**Merge order** (smallest/most isolated first):

1. WS5 (3 files, a11y — lowest risk)
2. WS6 (Python only — no TS conflicts possible)
3. WS4 (schema + storage)
4. WS3 (server middleware)
5. WS1 (new shared file + component changes)
6. WS2 (largest — 7 component/hook files)

**Verification after merge:**

1. `npm run check` — zero TypeScript errors
2. `npm run build` — production build succeeds
3. `cd scraper && python -m pytest tests/ -v` — scraper tests pass

---

## File Conflict Matrix

No two workstreams touch the same file:

| File | WS |
|---|---|
| `QuickExitButton.tsx`, `ProcessTimeline.tsx`, `ServiceModal.tsx`, `lib/linkify.ts` | 1 |
| `Home.tsx`, `SearchContext.tsx`, `use-favorites.ts`, `MyShortlist.tsx`, `Hero.tsx`, `use-toast.ts`, `use-focus-trap.ts` | 2 |
| `server/index.ts`, `csrf.ts`, `adminAuth.ts`, `analytics.ts` | 3 |
| `shared/schema.ts`, `feedback.ts`, `storage.ts` | 4 |
| `CategoryTiles.tsx`, `not-found.tsx`, `ServiceCard.tsx` | 5 |
| `scraper/*.py` | 6 |

Zero overlap confirmed. All 6 agents can run in parallel without merge conflicts.

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Schema changes break production DB | Zod-only fix (H3). Index via manual SQL script (H4) |
| CSRF removal reduces security | CORS origin allowlist is already enforced. Origin check rejects cross-origin requests |
| QuickExit history push doesn't work in all browsers | `try/catch` wrapper. `location.replace` still fires as fallback |
| Merge conflicts between worktrees | File matrix confirms zero overlap. Merge order is smallest-first |
| Stale worktree branches | Verify all based on same HEAD before launching |
