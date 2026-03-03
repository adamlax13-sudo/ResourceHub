# ResourceHub UX Improvements — Design Document
Date: 2026-03-03

---

## Context

ResourceHub serves two audiences: people directly seeking help (often in distress) and caseworkers/advocates finding resources for clients. The current interface is intentionally lean — a single text input and a location dropdown — but the backend is rich: demographic filtering, crisis service pinning, AI intent detection, and many database fields (gender, age group, 24/7, faith-based, 12-step, language, service format) that are completely invisible to users.

This design adds eight UX improvements that layer depth without cluttering the default experience. Complexity is opt-in; the simple path stays simple.

**Design philosophy:** layered complexity, privacy by default (no user accounts), accessibility-first, non-intrusive.

---

## Feature Set

### 1. Category Quick-Start Tiles *(Landing state replacement)*

Replace the current flip-card tutorial (shown when no search has run) with a visual category grid.

- **6–8 tiles:** Housing, Addiction Recovery, Mental Health, Food & Basics, Crisis Support, Disability & Accessibility, Healthcare, Employment
- Each tile: large icon/emoji, label, soft gradient background per category
- On click: pre-populates search query with category name and triggers search
- Layout: 2-column grid on mobile, 4-column on desktop
- Tiles disappear once a search is active — they only show in the empty/landing state
- Framer Motion entrance animation (staggered, consistent with existing card animations)

**Files affected:** `client/src/pages/Home.tsx`, new `client/src/components/CategoryTiles.tsx`

---

### 2. Emergency Fast-Path *(Crisis access)*

A permanently visible "I need help right now" button in the Hero section.

- **Visual:** Solid warm-red, full-width on mobile, clear sans-serif label. Subtle pulse animation to draw attention without being alarming. Positioned above/near the search input.
- **Behavior:** Clicking runs a pre-canned crisis search immediately — no wizard, no typing needed. Bypasses normal query flow.
- **Backend:** Leverages existing crisis detection and service pinning logic in `server/search/strategies/comprehensive.ts`. The button fires a POST to `/api/search` with a preset crisis query string.

**Files affected:** `client/src/components/Hero.tsx`

---

### 3. Voice Search *(Accessibility)*

A microphone icon button inside the search input field.

- **Tech:** Browser-native Web Speech API — no backend calls, no cost, no privacy concern.
- **Behavior:** On click → request mic permission → listen → fill input on recognition → auto-trigger search.
- **Fallback:** Icon hidden if `window.SpeechRecognition` is not available (Firefox, Safari partial support).
- Mic button positioned as a trailing icon inside the existing search `<Input>` in `Hero.tsx`.

**Files affected:** `client/src/components/Hero.tsx`

---

### 4. Guided Intake Wizard *(For users who don't know what to search)*

A "Not sure what to search for? Let us guide you →" link below the search bar. Opens a multi-step modal.

**Steps:**
1. "Who needs help?" → Me / Someone I care for / A client I'm helping
2. "What's most urgent?" → category tile grid (same icons as landing tiles)
3. "Any specific requirements?" → checkbox list: Women-only, French language, Walk-in, 24/7, Faith-based, No referral needed

**Output:** Assembles answers into a natural-language query string + populates filter state in SearchContext → triggers search. No LLM calls.

**Files affected:** `client/src/components/Hero.tsx` (trigger link), new `client/src/components/IntakeWizard.tsx`

---

### 5. Collapsible "Refine" Filter Panel *(Search precision)*

On the results page, a "Refine" button opens a structured filter panel.

**Filter options:**
- Category (multi-select chips)
- Gender restriction (All / Women-only / Men-only)
- Age group (All ages / Youth / Adult / Senior)
- 24/7 only (toggle)
- Service format (dropdown)
- Faith-based (toggle)
- 12-step (toggle)
- Languages supported (multi-select)

**Note:** "Open now" explicitly excluded until `hoursOfOperation` data is more reliable.

**UX pattern:**
- Desktop: slides in from the right as a side panel
- Mobile: slides up from the bottom as a bottom sheet
- Active filters shown as dismissable chips below the search bar (visible without opening the panel)
- "Clear all" resets all filters. Filter changes re-run search automatically.

**API extension needed:**
- `POST /api/search` body gains optional fields: `category`, `genderRestriction`, `ageGroup`, `is24_7`, `isFaithBased`, `is12Step`, `languagesSupported[]`, `serviceFormat`
- Backend: existing filter stage in `server/search/strategies/comprehensive.ts` (pipeline step 7) applies these as **hard constraints** (not boosts)
- Extend `shared/routes.ts` Zod schema for the new fields

**Files affected:**
- New `client/src/components/RefinePanel.tsx`
- `client/src/pages/Home.tsx` (refine button + active filter chips display)
- `client/src/contexts/SearchContext.tsx` (store filter state)
- `shared/routes.ts` (extend API schema)
- `server/search/strategies/comprehensive.ts` (apply hard filters)
- `server/storage.ts` (pass filter params down if needed)

---

### 6. Thumbs Up/Down Micro-Feedback *(Passive quality signal)*

Two small icon buttons (👍 / 👎) at the bottom-right of each ServiceCard.

- Silent — no prompt, no interrupt. Users give feedback at will.
- On click: POST to `/api/feedback` with `{ serviceId, vote: 'up' | 'down', queryContext: string }`
- Persists vote in localStorage to prevent duplicate votes (no re-prompting)
- New `service_feedback` DB table: `id, service_id, vote, query_context, created_at`
- Data informs future ranking improvements

**Files affected:**
- `client/src/components/ServiceCard.tsx`
- New `server/routes/feedback.ts`
- `server/routes.ts` (register route)
- `shared/schema.ts` (new `service_feedback` table)

---

### 7. Favorites + PDF Export *(Caseworker shortlist)*

Activate the existing `useFavorites` hook (fully implemented at `client/src/hooks/use-favorites.ts`, zero UI today).

**UI additions:**
- Heart/bookmark icon on each ServiceCard and inside ServiceModal
- "Shortlist (N)" badge button in the results header (shows count)
- "My Shortlist" drawer: lists all saved services with remove option
- "Export PDF" button → triggers `window.print()` with print CSS
- Print layout: service name, category, location, phone, website, eligibility summary, process steps
- "Share shortlist" encodes comma-separated service IDs into URL params (`?shortlist=123,456,789`)

**Storage:** localStorage only — no backend changes needed.

**Files affected:**
- `client/src/components/ServiceCard.tsx`
- `client/src/components/ServiceModal.tsx`
- `client/src/pages/Home.tsx` (shortlist button + drawer)
- New `client/src/components/MyShortlist.tsx`
- New `client/src/components/PrintLayout.tsx` (print CSS only)
- Possibly new `GET /api/services?ids=...` endpoint for shortlist URL restoration

---

### 8. Shareable Search Links *(Collaboration)*

"Share results" button on the results page. Encodes full search state into URL query params.

**URL format:** `?q=housing&loc=Edmonton&cat=Housing&gender=all&24h=true`

- SearchContext reads URL params on mount to restore query + location + filters
- Running a new search updates the URL (`history.replaceState`, no history spam)
- "Share" button copies current URL to clipboard with a toast confirmation

**Files affected:**
- `client/src/contexts/SearchContext.tsx` (read/write URL params)
- `client/src/pages/Home.tsx` (share button)

---

## Components Summary

| Component | Status | Purpose |
|-----------|--------|---------|
| `CategoryTiles.tsx` | New | Landing page quick-start grid |
| `IntakeWizard.tsx` | New | Guided multi-step intake modal |
| `RefinePanel.tsx` | New | Filter side panel / bottom sheet |
| `MyShortlist.tsx` | New | Favorites drawer with PDF export |
| `PrintLayout.tsx` | New | Print-only CSS layout |
| `Hero.tsx` | Modify | Emergency button, mic, wizard link |
| `ServiceCard.tsx` | Modify | Thumbs, heart icon |
| `ServiceModal.tsx` | Modify | Heart icon |
| `Home.tsx` | Modify | Tiles, refine button, chips, share, shortlist |
| `SearchContext.tsx` | Modify | Filter state + URL sync |

---

## API Changes

| Change | Type | Notes |
|--------|------|-------|
| `POST /api/search` — new filter fields | Extend | category, gender, age, 24h, faith, 12step, lang, format |
| `POST /api/feedback` | New route | serviceId, vote, queryContext |
| `GET /api/services?ids=...` | New route (maybe) | Shortlist URL restoration |
| `service_feedback` table | New DB table | Stores thumbs votes |

---

## Visual Design Notes (for frontend-design skill during implementation)

- **Category tiles:** Soft gradient per category (warm orange for crisis, calm blue for mental health, etc.), large Lucide icon or emoji, rounded corners, Framer Motion staggered entrance
- **Emergency button:** `bg-red-600 hover:bg-red-700`, `animate-pulse`, full-width on mobile — urgent but not panic-inducing
- **Refine panel:** Shadcn `Sheet` component. Right side on desktop, bottom sheet on mobile.
- **Filter chips:** Shadcn `Badge` toggled variant — solid fill when active, ghost when inactive
- **Thumbs:** Ghost icon buttons, `text-green-600` / `text-red-500` on active state. Subtle, no hover expansion.
- **Heart icon:** Lucide `Heart`, animated fill transition on click
- **Wizard:** Shadcn `Dialog`, progress dots at top, large tap targets throughout

---

## Verification

1. **Category tiles:** Load app with no search → tiles visible. Click "Housing" → search runs. Make a search → tiles hide.
2. **Emergency button:** Click → crisis services appear immediately. Verify backend crisis pinning is active.
3. **Voice search:** Click mic → browser requests permission → speak a phrase → input fills → search runs. Reload in unsupported browser → mic button absent.
4. **Intake wizard:** Click "Not sure?" → wizard opens → complete 3 steps → search runs with assembled query + filters active.
5. **Refine panel:** Run a search → click "Refine" → panel opens → toggle a filter → results refresh → active filter chip appears below search bar → click chip to remove → filter clears.
6. **Feedback:** Click thumbs up on a card → check `service_feedback` DB table for new row. Click again → no duplicate (localStorage guard).
7. **Favorites:** Click heart on card → shortlist count increments. Open "My Shortlist" → service listed. Click "Export PDF" → browser print dialog opens with clean layout. Click "Share shortlist" → URL updates with `?shortlist=...`.
8. **Share results:** Run a search → click "Share" → URL contains `?q=...&loc=...` → open URL in incognito → same results appear.
