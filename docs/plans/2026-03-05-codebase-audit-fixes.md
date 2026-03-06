# Codebase Audit Fix Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 29 issues found in the codebase audit — 2 critical, 8 high, 12 medium, 7 low — across frontend, server, schemas, and scraper.

**Architecture:** 6 parallel worktree-isolated workstreams grouped by file ownership (zero overlap). After all complete, merge sequentially smallest-first, then verify with TypeScript check, production build, and pytest.

**Tech Stack:** React 18, TypeScript, Express, Drizzle ORM, Python/SQLAlchemy

**Design doc:** `docs/plans/2026-03-05-codebase-audit-fix-design.md`

---

## Task 1: Safety Critical — QuickExit + Shared Linkify (C1, C2)

**Files:**
- Create: `client/src/lib/linkify.ts`
- Modify: `client/src/components/QuickExitButton.tsx:12-14`
- Modify: `client/src/components/ProcessTimeline.tsx:7-58`
- Modify: `client/src/components/ServiceModal.tsx:20-170`

### Step 1: Create shared linkify utility

Create `client/src/lib/linkify.ts` with `isSafeUrl` and `linkifyText` extracted from `ServiceModal.tsx:20-170`. The `linkifyText` function must include `isSafeUrl()` checks on ALL branches that produce `<a href>` tags — specifically the bare-domain branch (match[4]) which is missing the check in `ProcessTimeline.tsx`.

```tsx
// client/src/lib/linkify.ts
import React from 'react';

export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://placeholder.invalid');
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function linkifyText(text: string): React.ReactNode {
  if (!text) return text;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  const combinedRegex = /(https?:\/\/[^\s,]+)|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})|([a-zA-Z0-9][-a-zA-Z0-9]*\.(?:ca|com|org|net|edu|gov)(?:\/[^\s,]*)?)/gi;

  let match;
  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const matched = match[0];
    if (match[1]) {
      // Full URL — validate protocol
      if (isSafeUrl(matched)) {
        parts.push(
          <a key={key++} href={matched} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
            {matched}
          </a>
        );
      } else {
        parts.push(matched);
      }
    } else if (match[2]) {
      // Email
      parts.push(
        <a key={key++} href={`mailto:${matched}`} className="text-primary hover:underline">
          {matched}
        </a>
      );
    } else if (match[3]) {
      // Phone
      const cleanPhone = matched.replace(/[^\d+]/g, '');
      parts.push(
        <a key={key++} href={`tel:${cleanPhone}`} className="text-primary hover:underline">
          {matched}
        </a>
      );
    } else if (match[4]) {
      // Bare domain — MUST validate with isSafeUrl (this was the C2 bug)
      const url = matched.startsWith('http') ? matched : `https://${matched}`;
      if (isSafeUrl(url)) {
        parts.push(
          <a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
            {matched}
          </a>
        );
      } else {
        parts.push(matched);
      }
    }

    lastIndex = match.index + matched.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
```

### Step 2: Update ServiceModal to import from shared utility

In `client/src/components/ServiceModal.tsx`:
- Delete the `isSafeUrl` function (lines 20-27)
- Delete the `linkifyText` function (lines 110-170)
- Add import at top: `import { linkifyText } from '@/lib/linkify';`

All existing callsites in ServiceModal (lines 391, 401, 412, 471) remain unchanged.

### Step 3: Update ProcessTimeline to import from shared utility

In `client/src/components/ProcessTimeline.tsx`:
- Delete the inline `linkifyText` function (lines 7-58)
- Add import at top: `import { linkifyText } from '@/lib/linkify';`

### Step 4: Fix QuickExitButton history clearing

In `client/src/components/QuickExitButton.tsx`, replace `handleExit` (lines 12-14):

```tsx
const handleExit = () => {
  try {
    // Overwrite history entries so back button doesn't return to ResourceHub
    const depth = window.history.length;
    for (let i = 0; i < depth; i++) {
      window.history.pushState(null, '', 'https://www.google.com');
    }
  } catch {
    // pushState may fail in rare edge cases — still navigate away
  }
  window.location.replace('https://www.google.com');
};
```

### Step 5: Verify and commit

Run `npm run check` — expect zero errors. Commit all 4 files with message:
`fix(security): extract shared linkify with URL safety check, clear QuickExit history`

---

## Task 2: Frontend State Bugs (H6, H7, H8, M4, M5, M6, M7, H5)

**Files:**
- Modify: `client/src/hooks/use-favorites.ts:31-34`
- Modify: `client/src/components/MyShortlist.tsx:529-548`
- Modify: `client/src/contexts/SearchContext.tsx:78-86`
- Modify: `client/src/components/Hero.tsx:55-110,614-622`
- Modify: `client/src/hooks/use-toast.ts:171-182`
- Modify: `client/src/hooks/use-focus-trap.ts:13-66`
- Modify: `client/src/pages/Home.tsx:111-118`

### Step 1: Fix localStorage type validation (H6)

In `client/src/hooks/use-favorites.ts`, after the `JSON.parse` on line 32, add an array guard:

```ts
// Before:
const parsed = JSON.parse(stored) as FavoriteService[];
setFavorites(parsed);

// After:
const parsed = JSON.parse(stored);
if (Array.isArray(parsed)) {
  setFavorites(parsed as FavoriteService[]);
}
```

### Step 2: Fix "Clear all" keyboard accessibility (H7)

In `client/src/components/MyShortlist.tsx`:
- Add a ref: `const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);`
- Add a useEffect:
```tsx
useEffect(() => {
  if (confirmingClear) {
    confirmTimerRef.current = setTimeout(() => setConfirmingClear(false), 3000);
  }
  return () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
  };
}, [confirmingClear]);
```
- Remove the `onBlur={() => setConfirmingClear(false)}` from the button on line 539.

### Step 3: Validate URL params against known enums (H8)

In `client/src/contexts/SearchContext.tsx`, add validation constants and guards around lines 78-86:

```tsx
const VALID_GENDERS = ['all', 'women_only', 'men_only'];
const VALID_AGES = ['all_ages', 'youth', 'adult', 'senior', 'youth_and_adult'];
const VALID_FORMATS = ['in_person', 'virtual', 'both'];

// Replace lines 80-85:
const gender = params.get('gender');
if (gender && VALID_GENDERS.includes(gender)) {
  restoredFilters.genderRestriction = gender as SearchFilters['genderRestriction'];
}
const age = params.get('age');
if (age && VALID_AGES.includes(age)) {
  restoredFilters.ageGroup = age as SearchFilters['ageGroup'];
}
const format = params.get('format');
if (format && VALID_FORMATS.includes(format)) {
  restoredFilters.serviceFormat = format;
}
```

Lines 82-84 (`24h`, `faith`, `12step`) are boolean flags — already safe.

### Step 4: Fix stale locations in voice search callback (M4)

In `client/src/components/Hero.tsx`, in `HeroSearchBar`, add a ref:

```tsx
const locationsRef = useRef(locations);
locationsRef.current = locations;
```

Then in the voice search callback (line 621), change `onSearch(transcript, locations)` to `onSearch(transcript, locationsRef.current)`.

### Step 5: Fix toast listener leak (M5)

In `client/src/hooks/use-toast.ts`, change line 182 dep from `[state]` to `[setState]`.

### Step 6: Fix focus trap stale onClose (M6)

In `client/src/hooks/use-focus-trap.ts`:
- Add `const onCloseRef = useRef(onClose);` after line 15
- Add `onCloseRef.current = onClose;` right after
- In `handleKeyDown` (line 34), replace `onClose()` with `onCloseRef.current()`
- Change dep array on line 66 from `[isOpen, onClose]` to `[isOpen]`

### Step 7: Add resize listener to LocationDropdown (M7)

In `client/src/components/Hero.tsx`, after the scroll listener effect (lines 97-110), add:

```tsx
useEffect(() => {
  if (isOpen) {
    const handleResize = () => setIsOpen(false);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }
}, [isOpen]);
```

### Step 8: Fix Home.tsx URL-restoration deps (H5)

In `client/src/pages/Home.tsx`, replace lines 113-118. Keep the ref guard but add all deps:

```tsx
const hasTriggeredUrlSearch = useRef(false);
useEffect(() => {
  if (searchState.query && !searchState.hasSearched && !isPending && !hasTriggeredUrlSearch.current) {
    hasTriggeredUrlSearch.current = true;
    handleSearchWithFilters(searchState.query, searchState.locations, searchState.filters);
  }
}, [searchState.query, searchState.hasSearched, isPending, handleSearchWithFilters, searchState.locations, searchState.filters]);
```

Remove the `// eslint-disable-line` comment.

### Step 9: Verify and commit

Run `npm run check` — expect zero errors. Commit all 7 files with message:
`fix: frontend state bugs — localStorage validation, keyboard a11y, URL param validation, stale closures`

---

## Task 3: Server Security (H1, H2, H9, M2)

**Files:**
- Modify: `server/index.ts:15,87,90`
- Modify: `server/middleware/csrf.ts` (simplify to keep only strictCsrfProtection)
- Modify: `server/middleware/adminAuth.ts:47-60`
- Modify: `server/db.ts:25`
- Modify: `server/routes/analytics.ts:28`

### Step 1: Remove dead CSRF middleware (H1)

In `server/index.ts`:
- Remove import of `csrfProtection, csrfTokenEndpoint` (line 15)
- Remove `app.use('/api', csrfProtection(allowedOrigins));` (line 87)
- Remove `app.get('/api/csrf-token', csrfTokenEndpoint);` (line 90)
- Add comment where middleware was:
```ts
// CSRF defense: CORS origin allowlist (lines 60-66) rejects cross-origin requests.
// See middleware/csrf.ts for strictCsrfProtection if token-based CSRF is needed later.
```

In `server/middleware/csrf.ts`:
- Delete `csrfTokens` Map, `setInterval` cleanup, `generateCsrfToken`, `getOrCreateToken`, `csrfTokenEndpoint`, `csrfProtection`
- Keep only `strictCsrfProtection` (lines 97-121) for future use
- Keep necessary imports for `strictCsrfProtection`

### Step 2: Fix timing-safe comparison (H2)

In `server/middleware/adminAuth.ts`, replace the custom `constantTimeCompare` (lines 47-60):

```ts
import { timingSafeEqual, createHash } from 'crypto';

/**
 * Constant-time string comparison that doesn't leak string length.
 * Hashes both values to fixed length before comparing.
 */
function constantTimeCompare(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}
```

### Step 3: Document SSL accepted risk (H9)

In `server/db.ts`, add comment before line 25:
```ts
// Render.com free tier does not provide a CA certificate for client verification.
// rejectUnauthorized:false is an accepted risk for this deployment target.
```

### Step 4: Truncate User-Agent before storage (M2)

In `server/routes/analytics.ts`, change line 28:
```ts
const userAgent = (Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader)?.slice(0, 500);
```

### Step 5: Verify and commit

Run `npm run check` — expect zero errors. Commit all 5 files with message:
`fix(security): remove dead CSRF code, use timingSafeEqual, truncate User-Agent`

---

## Task 4: Schema and DB Hardening (H3, H4, M1, M3, L3)

**Files:**
- Modify: `shared/schema.ts:14-15,64,142,156-168`
- Modify: `server/routes/feedback.ts:14-16`
- Modify: `server/storage.ts:146,798-805`
- Modify: `server/routes/admin.ts:17-31`
- Create: `scripts/add-searches-index.sql`

### Step 1: Add Zod length limits to feedback (H3)

In `server/routes/feedback.ts`, change lines 15-16:
```ts
name: z.string().max(255).optional(),
email: z.string().email().max(255).optional().or(z.literal('')),
```

Do NOT change DB columns — Zod catches oversized input before DB.

### Step 2: Add stale search cache cleanup (H4)

Add `clearStaleSearches(maxAgeDays?: number): Promise<number>` to `IStorage` interface in `server/storage.ts` after line 146.

Add implementation in `DatabaseStorage` after line 805:
```ts
async clearStaleSearches(maxAgeDays: number = 7): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    const deleted = await db.delete(searches).where(
      sql`${searches.createdAt} < ${cutoff}`
    ).returning();
    const count = deleted.length;
    if (count > 0) {
      console.log(`[Search] Cleared ${count} stale cache entries (older than ${maxAgeDays} days)`);
    }
    return count;
  } catch (err) {
    console.warn('[Search] Failed to clear stale searches:', err);
    return 0;
  }
}
```

In `server/routes/admin.ts`, add call in refresh-search handler after line 23:
```ts
const staleCleared = await storage.clearStaleSearches();
```

Create `scripts/add-searches-index.sql`:
```sql
-- Run manually against production DB. Uses CONCURRENTLY to avoid locking.
-- Execute: psql $DATABASE_URL -f scripts/add-searches-index.sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS searches_query_idx ON searches (query);
```

### Step 3: Delete unused ServiceDetail interface (M1)

In `shared/schema.ts`, delete lines 156-168 (the `interface ServiceDetail` block). Confirmed no imports use it.

### Step 4: Add documentation comments (M3, L3)

In `shared/schema.ts`:
- Line 142: change comment to `// 'up' | 'down' — enforced by Zod in routes/feedback.ts`
- Line 64: add comment `// Intentionally no FK — archive rows survive service deletion`

### Step 5: Verify and commit

Run `npm run check` — expect zero errors. Commit all files with message:
`fix: harden schemas — Zod length limits, stale cache cleanup, remove dead type`

---

## Task 5: Frontend A11y and UX (M11, L1, L2)

**Files:**
- Modify: `client/src/components/CategoryTiles.tsx:45-61`
- Modify: `client/src/pages/not-found.tsx:14-15`
- Modify: `client/src/components/ServiceCard.tsx:77`

### Step 1: Add aria-labels to category tiles (M11)

In `client/src/components/CategoryTiles.tsx`, add to `motion.button` (line 45):
```tsx
aria-label={`Search for ${cat.label} services`}
```

### Step 2: Fix 404 page copy (L1)

In `client/src/pages/not-found.tsx`, replace line 14-15 text:
```
"This page doesn't exist. Try searching for the service you need."
```

### Step 3: Cap animation stagger delay (L2)

In `client/src/components/ServiceCard.tsx`, change line 77:
```tsx
transition={{ delay: Math.min(index * 0.1, 0.5), duration: 0.4 }}
```

### Step 4: Verify and commit

Run `npm run check` — expect zero errors. Commit all 3 files with message:
`fix: a11y aria-labels, user-facing 404 copy, cap animation stagger`

---

## Task 6: Scraper Fixes (M8, M9, M10, L4, L5, L6, L7)

**Files:**
- Modify: `scraper/finalize.py:102,339`
- Modify: `scraper/upserter.py:23`
- Modify: `scraper/pipeline.py:59`
- Modify: `scraper/enrichment.py:127`
- Modify: `scraper/scraper.py:74`

### Step 1: Filter contact normalization query (M8, M10)

In `scraper/finalize.py`, replace line 102:
```python
from sqlalchemy import or_
all_services = session.query(Service).filter(
    or_(
        Service.phone.is_(None),
        Service.email.is_(None),
        Service.address.is_(None),
    )
).all()
```

### Step 2: Add hasattr guard to dedup log (L7)

In `scraper/finalize.py`, replace line 339:
```python
if hasattr(log, 'services_deactivated'):
    log.services_deactivated += deactivated
else:
    log.services_deactivated = deactivated
```

### Step 3: Add scaling comment to fuzzy_match (M9)

In `scraper/upserter.py`, add comment before line 23:
```python
# O(n*m) character-level LCS — acceptable for current dataset (~500 services).
# If scaling past 5K, consider pg_trgm index for fuzzy matching.
```

### Step 4: Require DATABASE_URL in scraper (L4)

In `scraper/scraper.py`, replace lines 74-75:
```python
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL must be set. Check your .env file.")
engine = create_engine(DATABASE_URL)
```

### Step 5: Add cost estimate comment (L5)

In `scraper/enrichment.py`, add comment before line 127:
```python
# Conservative fallback ($0.10/service) when API usage data unavailable
```

### Step 6: Initialize _consecutive_errors (L6)

In `scraper/pipeline.py`, add to `Pipeline.__init__` after line 65:
```python
self._consecutive_errors = 0
```

### Step 7: Verify and commit

Run scraper tests: `cd scraper && python -m pytest tests/ -v` — expect no new failures.
Commit all 5 files with message:
`fix: scraper hardening — filter contacts query, require DATABASE_URL, init errors counter`

---

## Task 7: Verification and Merge

**This task runs sequentially in the main session after Tasks 1-6 complete.**

### Step 1: Merge branches in order

Merge smallest/most isolated first to catch conflicts early:
1. WS5 branch (a11y — 3 files)
2. WS6 branch (Python — no TS conflict possible)
3. WS4 branch (schema + storage)
4. WS3 branch (server middleware)
5. WS1 branch (new shared file + components)
6. WS2 branch (7 component/hook files — largest)

### Step 2: Full verification

Run TypeScript check, production build, and scraper tests. All must pass clean.

### Step 3: Fix any merge issues

If verification reveals problems, fix and commit.

---

## Summary Table

| Task | Issues | Files | Parallel? |
|------|--------|-------|-----------|
| 1 — Safety Critical | C1, C2 | 4 | Yes |
| 2 — Frontend State | H6, H7, H8, M4-M7, H5 | 7 | Yes |
| 3 — Server Security | H1, H2, H9, M2 | 5 | Yes |
| 4 — Schema/DB | H3, H4, M1, M3, L3 | 5 | Yes |
| 5 — A11y/UX | M11, L1, L2 | 3 | Yes |
| 6 — Scraper | M8-M10, L4-L7 | 5 | Yes |
| 7 — Verify/Merge | — | 0 | Sequential |
