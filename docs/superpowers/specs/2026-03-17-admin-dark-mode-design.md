# Admin Dark Mode — Design Spec

**Date:** 2026-03-17
**Scope:** Admin-only dark mode with teal-tinted palette, system preference support, and localStorage persistence

## Overview

Add a dark mode option to the admin panel. Users choose between Light, Dark, or System (auto) via a segmented control in the sidebar. The preference persists in localStorage. Dark mode is scoped to admin routes only — the public site always renders in light mode.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Activation | Manual toggle + system preference | Option C: defaults to system, admin can override |
| Persistence | localStorage (`admin-theme`) | Single admin for now; migrate to DB when multi-user auth lands |
| Toggle placement | Dedicated sidebar row with segmented control | Light / Dark / Auto — explicit and discoverable |
| Color palette | Teal-tinted dark | Keeps admin identity distinct from public site's red/gold brand |
| Implementation | CSS variable migration | Replace hardcoded Tailwind grays with semantic classes; `.dark` variables handle the rest |
| Scope | Full admin — all 12 pages, all components, charts | Single pass, no phased rollout |

## 1. Theme Provider & Toggle

### New: `client/src/hooks/useTheme.ts`

React context + hook that manages the admin theme:

- **State:** `theme` — `"light" | "dark" | "system"` (stored in `localStorage` key `admin-theme`)
- **Derived:** `effectiveTheme` — resolved to `"light"` or `"dark"` (checks `window.matchMedia('(prefers-color-scheme: dark)')` when `theme === "system"`)
- **Side effect:** Adds/removes `dark` class on `document.documentElement`
- **Route scoping:** Watches current path via `useLocation()` from wouter. Only applies `dark` class when path starts with `/admin`. Removes it on navigation to public pages.
- **System listener:** When `theme === "system"`, listens for `matchMedia` `change` events and updates `effectiveTheme` reactively.
- **Exposed API:** `{ theme, effectiveTheme, setTheme }`

### New: `client/src/components/admin/ThemeToggle.tsx`

A 3-option segmented control rendered in the sidebar bottom section:

- Sun icon (lucide `Sun`) | Moon icon (lucide `Moon`) | "Auto" text label
- Active segment has elevated background + accent text
- Uses `useTheme()` hook to read/write state
- Compact — fits in the existing sidebar bottom area above Logout

### Flash Prevention: `client/index.html`

Inline `<script>` added before the React bundle `<script>` tag:

```html
<script>
  (function() {
    var t = localStorage.getItem('admin-theme');
    var dark = t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark && window.location.pathname.startsWith('/admin')) {
      document.documentElement.classList.add('dark');
    }
  })();
</script>
```

This runs synchronously before first paint, preventing the white flash when loading admin pages in dark mode.

### Integration: `client/src/pages/admin/AdminLayout.tsx`

- Wrap the admin layout tree in `<ThemeProvider>`
- Add `<ThemeToggle />` to the sidebar bottom section (between Help and Logout)

### Integration: `client/src/pages/admin/Login.tsx`

- Wrap in its own `<ThemeProvider>` since Login renders outside AdminLayout
- Reads the same localStorage key, applies dark class independently

## 2. CSS Variable Migration

### Update: `client/src/index.css`

Replace the existing `.dark` block (lines 65-110) with teal-tinted values:

```css
.dark {
  --background: 170 25% 8%;        /* #0f1f1f — teal-tinted dark bg */
  --foreground: 170 20% 91%;       /* #e2efef — warm off-white */

  --primary: 168 70% 50%;          /* #2dd4bf — bright teal */
  --primary-foreground: 0 0% 100%;

  --secondary: 170 30% 15%;        /* #1a3535 */
  --secondary-foreground: 170 20% 80%;

  --muted: 170 20% 15%;            /* #1e3333 */
  --muted-foreground: 170 15% 55%; /* #7a9e9e */

  --accent: 168 70% 50%;           /* same as primary for admin */
  --accent-foreground: 0 0% 100%;

  --destructive: 0 70% 50%;
  --destructive-foreground: 0 0% 100%;

  --border: 170 20% 20%;           /* #1e3d3d */
  --input: 170 20% 20%;
  --ring: 168 70% 50%;

  --card: 170 25% 11%;             /* #132929 */
  --card-foreground: 170 20% 91%;
  --card-border: 170 15% 18%;

  --popover: 170 25% 11%;
  --popover-foreground: 170 20% 91%;
  --popover-border: 170 15% 18%;

  --sidebar: 170 30% 7%;           /* #0c1a1a */
  --sidebar-foreground: 170 15% 65%;
  --sidebar-border: 170 20% 15%;
  --sidebar-primary: 168 70% 50%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 170 30% 15%;
  --sidebar-accent-foreground: 170 20% 80%;
  --sidebar-ring: 168 70% 50%;

  --chart-1: 168 70% 50%;          /* teal */
  --chart-2: 258 60% 60%;          /* violet */
  --chart-3: 45 90% 55%;           /* amber */
  --chart-4: 168 50% 65%;          /* light teal */
  --chart-5: 30 80% 60%;           /* orange */
}
```

### Class Replacement Across Admin Files

Replace hardcoded Tailwind color classes with semantic CSS variable classes:

| Hardcoded (light) | Semantic replacement |
|---|---|
| `bg-white` | `bg-card` or `bg-background` |
| `bg-gray-50` | `bg-background` or `bg-muted` |
| `text-gray-900`, `text-gray-800` | `text-foreground` |
| `text-gray-600`, `text-gray-500` | `text-muted-foreground` |
| `text-gray-400` | `text-muted-foreground` |
| `border-gray-200`, `border-gray-100` | `border-border` |
| `hover:bg-gray-50` | `hover:bg-muted` |
| `bg-teal-50` (active state) | `bg-primary/10` |
| `text-teal-600`, `text-teal-700` | `text-primary` |
| `bg-teal-500` (badges, loader) | `bg-primary` |
| `text-teal-500` (loader) | `text-primary` |
| `hover:bg-teal-700` | `hover:bg-primary/80` |
| `bg-gradient-to-b from-white to-gray-50` | `bg-gradient-to-b from-background to-muted` |

### Files to Migrate

**Pages (13):**
- AdminLayout.tsx, Dashboard.tsx, Services.tsx, Review.tsx, Feedback.tsx
- Quality.tsx, Analytics.tsx, Scraper.tsx, SearchTest.tsx, System.tsx
- ServiceCreate.tsx, ServiceImport.tsx, Login.tsx

**Components (~8):**
- StatCard.tsx, ServiceForm.tsx, ServiceDetailPanel.tsx, DiffView.tsx
- MasterDetailLayout.tsx, AddWidgetModal.tsx, InfoTip.tsx, ThemeToggle.tsx (new)

**Widgets (~20):**
- All files in `client/src/components/admin/widgets/`

**Not touched:**
- Public-facing pages (Home, search results, etc.)
- Non-admin components and layouts

## 3. Chart & Data Visualization Colors

### New: `client/src/lib/chart-theme.ts`

Utility that bridges CSS variables to hex values for Recharts:

```ts
export function getChartColors(): {
  primary: string;      // main series color (teal)
  secondary: string;    // secondary series (muted)
  grid: string;         // CartesianGrid stroke
  axis: string;         // XAxis/YAxis tick color
  tooltip: {
    bg: string;
    border: string;
    text: string;
    muted: string;
  };
  series: string[];     // 5 chart colors from CSS variables
}
```

Reads computed CSS variable values from `document.documentElement` using `getComputedStyle()`, converts HSL to hex. Returns theme-appropriate colors for the current effective theme.

Chart components should call `getChartColors()` inside their render body and pass `effectiveTheme` from `useTheme()` as a React dependency (or use it as a `key` on the chart container) to ensure charts re-read colors when the theme toggles.

### Files to Update (5)

| File | Changes |
|------|---------|
| `Analytics.tsx` | Replace hardcoded `tooltipStyle` object + chart color props with `getChartColors()` |
| `AnalyticsDailyTrendWidget.tsx` | Replace `#14b8a6` / `#94a3b8` gradient fills |
| `AnalyticsPeakHoursWidget.tsx` | Replace `#14b8a6` bar fill |
| `AnalyticsSessionsWidget.tsx` | Replace `#8b5cf6` bar fill |
| `AnalyticsClickPositionsWidget.tsx` | Replace `#0d9488` bar fill |

### SVG Status Indicators — No Change Needed

The threshold colors in EmbeddingCoverageWidget, FieldCoverageWidget, and QualityOverviewWidget (`#10b981` green, `#f59e0b` amber, `#ef4444` red) are saturated colors on contained elements. They have sufficient contrast against both light and dark card backgrounds.

## 4. Category Color Dark Variants

### Update: `client/src/lib/category-colors.ts`

Append `dark:` variants to each of the 38 category color strings:

**Pattern:**
- Light `*-50` backgrounds → `dark:*-950`
- Light `*-700` text → `dark:*-300`
- Light `*-200` borders → `dark:*-800`

**Example:**
```ts
// Before:
"Crisis Services": "bg-red-50 text-red-700 border-red-200"

// After:
"Crisis Services": "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
```

All 38 categories follow this mechanical transformation. The `AnalyticsCategoriesWidget` that parses these strings to extract `bg-*` classes continues to work — Tailwind handles `dark:` variants at render time.

### Device Colors Widget

`AnalyticsDevicesWidget.tsx` — the existing `bg-teal-500`, `bg-violet-500`, `bg-amber-500` classes work well against both light and dark backgrounds. No changes needed.

## 5. Miscellaneous Dark-Mode Fixes

| Item | File | Fix |
|------|------|-----|
| **Dev environment banner** | `AdminLayout.tsx` | Add `dark:bg-amber-700 dark:text-amber-100` to the fixed amber banner |
| **Glass utilities** | `index.css` | Add `.dark .glass { @apply bg-card/80 }` and `.dark .glass-card { @apply bg-card/80 }` |
| **Scrollbar styling** | `index.css` | Add `.dark` variants — track: `#1a2e2e`, thumb: `#2a4a4a`, thumb hover: `#3a5a5a` |
| **Admin route scoping** | `useTheme.ts` | Remove `dark` class when path doesn't start with `/admin`; public site always light |
| **Login page** | `Login.tsx` | Wrap in `ThemeProvider`, migrate gradient + card classes to semantic variables |

## File Inventory

### New Files (3)
- `client/src/hooks/useTheme.ts`
- `client/src/components/admin/ThemeToggle.tsx`
- `client/src/lib/chart-theme.ts`

### Modified Files (~43)
- `client/index.html` (flash prevention script)
- `client/src/index.css` (dark variables, glass, scrollbar)
- `client/src/lib/category-colors.ts` (dark variants)
- `client/src/pages/admin/*.tsx` (13 page files)
- `client/src/components/admin/*.tsx` (~7 component files)
- `client/src/components/admin/widgets/*.tsx` (~20 widget files)

### Not Modified
- Public-facing pages and components
- Server code
- shadcn/ui base components (already use CSS variables)

## Testing Strategy

- **Visual smoke test:** Toggle through Light / Dark / System on each admin page
- **Flash test:** Hard-refresh admin page in dark mode — no white flash
- **Route scoping test:** Navigate from admin to public site — dark class removed, public renders light
- **System preference test:** Set to "Auto", change OS dark mode setting — admin theme follows
- **Chart readability:** Verify all 5 chart widgets render with correct colors in both themes
- **Category badges:** Spot-check badges across Services, Quality, Analytics pages
- **Contrast:** Verify text is readable on all card/background combinations (WCAG AA target: 4.5:1 for body text)
