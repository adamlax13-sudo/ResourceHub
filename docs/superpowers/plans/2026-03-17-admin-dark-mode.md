# Admin Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a teal-tinted dark mode to the admin panel with Light/Dark/System toggle, localStorage persistence, and full coverage of all 13 admin pages, components, widgets, and charts.

**Architecture:** CSS variable migration approach — replace hardcoded Tailwind color classes with semantic CSS variable classes (`bg-card`, `text-foreground`, etc.) so the existing Tailwind `darkMode: ["class"]` system handles the rest. A React context provider manages the theme state, and a small inline script in index.html prevents flash-of-wrong-theme.

**Tech Stack:** React 18, Tailwind CSS (class-based dark mode), shadcn/ui (already CSS-variable-based), Recharts (needs runtime color bridging), localStorage, wouter (route detection)

---

## File Structure

### New Files (4)
| File | Responsibility |
|------|---------------|
| `client/src/hooks/useTheme.ts` | Theme context provider + hook — manages state, localStorage, system preference, route scoping |
| `client/src/components/admin/ThemeToggle.tsx` | Segmented control UI (Light/Dark/Auto) for sidebar |
| `client/src/lib/chart-theme.ts` | Bridge CSS variables → hex values for Recharts components |
| `client/index.html` (modify) | Inline flash-prevention script |

### Modified Files (~40)
| Category | Files | Change Type |
|----------|-------|-------------|
| CSS variables | `client/src/index.css` | Replace `.dark` block with teal-tinted palette, add glass/scrollbar dark variants |
| Layout | `AdminLayout.tsx`, `Login.tsx` | Add ThemeProvider, toggle, migrate colors |
| Admin pages | 11 page files | Replace hardcoded grays/teals with semantic classes |
| Admin components | `StatCard.tsx`, `ServiceForm.tsx`, `ServiceDetailPanel.tsx`, `DiffView.tsx`, `MasterDetailLayout.tsx`, `AddWidgetModal.tsx`, `InfoTip.tsx` | Migrate colors |
| Widgets | 22 widget files | Migrate colors + chart hex values |
| Category colors | `client/src/lib/category-colors.ts` | Add `dark:` variant classes |

---

## Task 1: Flash Prevention Script + CSS Dark Variables

**Files:**
- Modify: `client/index.html`
- Modify: `client/src/index.css:65-110`

- [ ] **Step 1: Add flash-prevention script to index.html**

In `client/index.html`, add this inline script inside `<body>` before the React script tag:

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

- [ ] **Step 2: Replace `.dark` CSS variables with teal-tinted palette**

In `client/src/index.css`, replace the entire `.dark { ... }` block (lines 65-110) with:

```css
.dark {
  --background: 170 25% 8%;
  --foreground: 170 20% 91%;

  --primary: 168 70% 50%;
  --primary-foreground: 0 0% 100%;

  --secondary: 170 30% 15%;
  --secondary-foreground: 170 20% 80%;

  --muted: 170 20% 15%;
  --muted-foreground: 170 15% 55%;

  --accent: 168 70% 50%;
  --accent-foreground: 0 0% 100%;

  --destructive: 0 70% 50%;
  --destructive-foreground: 0 0% 100%;

  --border: 170 20% 20%;
  --input: 170 20% 20%;
  --ring: 168 70% 50%;

  --card: 170 25% 11%;
  --card-foreground: 170 20% 91%;
  --card-border: 170 15% 18%;

  --popover: 170 25% 11%;
  --popover-foreground: 170 20% 91%;
  --popover-border: 170 15% 18%;

  --sidebar: 170 30% 7%;
  --sidebar-foreground: 170 15% 65%;
  --sidebar-border: 170 20% 15%;
  --sidebar-primary: 168 70% 50%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 170 30% 15%;
  --sidebar-accent-foreground: 170 20% 80%;
  --sidebar-ring: 168 70% 50%;

  --chart-1: 168 70% 50%;
  --chart-2: 258 60% 60%;
  --chart-3: 45 90% 55%;
  --chart-4: 168 50% 65%;
  --chart-5: 30 80% 60%;
}
```

- [ ] **Step 3: Add dark variants for glass utilities and scrollbars**

In `client/src/index.css`, after the existing `.glass` and `.glass-card` rules, add:

```css
.dark .glass {
  @apply bg-card/80;
}
.dark .glass-card {
  @apply bg-card/80;
}
```

Find the existing webkit scrollbar styles and add dark variants:

```css
.dark ::-webkit-scrollbar-track {
  background: hsl(170 20% 11%);
}
.dark ::-webkit-scrollbar-thumb {
  background: hsl(170 15% 25%);
}
.dark ::-webkit-scrollbar-thumb:hover {
  background: hsl(170 15% 35%);
}
```

- [ ] **Step 4: Verify dev server starts**

Run: `npm run dev`
Expected: No CSS errors, site loads normally in light mode (dark class not applied yet)

- [ ] **Step 5: Commit**

```bash
git add client/index.html client/src/index.css
git commit -m "feat(admin): add teal-tinted dark mode CSS variables and flash prevention script"
```

---

## Task 2: Theme Provider Hook

**Files:**
- Create: `client/src/hooks/useTheme.ts`

- [ ] **Step 1: Create the useTheme hook with context provider**

Create `client/src/hooks/useTheme.ts`:

```ts
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useLocation } from "wouter";

type Theme = "light" | "dark" | "system";
type EffectiveTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  effectiveTheme: EffectiveTheme;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "admin-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveEffective(theme: Theme): EffectiveTheme {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function applyDarkClass(effective: EffectiveTheme, isAdmin: boolean) {
  if (effective === "dark" && isAdmin) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");

  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
    return "system";
  });

  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>(() =>
    resolveEffective(theme)
  );

  const setTheme = useCallback((newTheme: Theme) => {
    localStorage.setItem(STORAGE_KEY, newTheme);
    setThemeState(newTheme);
  }, []);

  // Resolve effective theme when theme or system preference changes
  useEffect(() => {
    const update = () => {
      const effective = resolveEffective(theme);
      setEffectiveTheme(effective);
    };

    update();

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
  }, [theme]);

  // Apply/remove dark class based on effective theme and route
  useEffect(() => {
    applyDarkClass(effectiveTheme, isAdmin);
    return () => {
      // Clean up dark class when unmounting (e.g., navigating away)
      document.documentElement.classList.remove("dark");
    };
  }, [effectiveTheme, isAdmin]);

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run check`
Expected: No type errors related to useTheme.ts

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useTheme.ts
git commit -m "feat(admin): add ThemeProvider hook with localStorage and system preference support"
```

---

## Task 3: Theme Toggle Component + AdminLayout Integration

**Files:**
- Create: `client/src/components/admin/ThemeToggle.tsx`
- Modify: `client/src/pages/admin/AdminLayout.tsx`

- [ ] **Step 1: Create ThemeToggle component**

Create `client/src/components/admin/ThemeToggle.tsx`:

```tsx
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

type ThemeOption = "light" | "dark" | "system";

const OPTIONS: { value: ThemeOption; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "Auto" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="px-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
        Theme
      </p>
      <div className="flex bg-muted rounded-md p-0.5">
        {OPTIONS.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 py-1 rounded text-xs transition-colors",
              theme === value
                ? "bg-background text-foreground shadow-sm font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={label}
          >
            <Icon className="h-3 w-3" />
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Integrate ThemeProvider and ThemeToggle into AdminLayout**

In `client/src/pages/admin/AdminLayout.tsx`:

1. Add imports at top:
```ts
import { ThemeProvider } from "@/hooks/useTheme";
import { ThemeToggle } from "@/components/admin/ThemeToggle";
```

2. In the `Sidebar` component, find the bottom section (the `div` with `px-2 py-2 border-t border-gray-100 space-y-0.5` containing Help and Quick Actions). Add the ThemeToggle above the logout section:

```tsx
{/* Theme Toggle */}
<div className="px-2 py-2 border-t border-border">
  <ThemeToggle />
</div>
```

3. Wrap the return JSX of `AdminLayout` component in `<ThemeProvider>`:
```tsx
return (
  <ThemeProvider>
    <div className="min-h-screen bg-background">
      {/* ... existing content ... */}
    </div>
  </ThemeProvider>
);
```

- [ ] **Step 3: Verify toggle renders and works**

Run: `npm run dev`, navigate to `/admin`
Expected: Theme toggle visible at bottom of sidebar. Clicking Dark applies `dark` class to `<html>`, visual change occurs (at minimum the shadcn components like buttons should change since they already use CSS variables).

- [ ] **Step 4: Commit**

```bash
git add client/src/components/admin/ThemeToggle.tsx client/src/pages/admin/AdminLayout.tsx
git commit -m "feat(admin): add theme toggle component in sidebar with Light/Dark/Auto options"
```

---

## Task 4: AdminLayout Color Migration

**Files:**
- Modify: `client/src/pages/admin/AdminLayout.tsx`

- [ ] **Step 1: Migrate Sidebar colors**

In the `Sidebar` component, replace all hardcoded color classes:

| Find | Replace |
|------|---------|
| `bg-white border-r border-gray-200` | `bg-sidebar border-r border-sidebar-border` |
| `border-b border-gray-100` | `border-b border-border` |
| `text-lg font-bold text-teal-600` | `text-lg font-bold text-primary` |
| `text-xs text-gray-400` | `text-xs text-muted-foreground` |
| `text-gray-400 font-medium` (section labels) | `text-muted-foreground font-medium` |
| `bg-teal-50 text-teal-700 font-medium` (active nav) | `bg-primary/10 text-primary font-medium` |
| `text-gray-600 hover:bg-gray-50 hover:text-gray-900` (inactive nav) | `text-muted-foreground hover:bg-muted hover:text-foreground` |
| `bg-teal-500 rounded-r-full` (active indicator) | `bg-primary rounded-r-full` |
| `text-teal-600` (active icon) | `text-primary` |
| `text-gray-400` (inactive icon) | `text-muted-foreground` |
| `bg-teal-500 text-white` (review badge) | `bg-primary text-primary-foreground` |
| `bg-blue-500 text-white` (feedback badge) | `bg-blue-500 text-white` (keep — semantic blue for feedback) |
| `text-gray-500 hover:text-teal-700 hover:bg-gray-50` (quick actions) | `text-muted-foreground hover:text-primary hover:bg-muted` |
| `border-t border-gray-100` | `border-t border-border` |
| `text-gray-400 hover:text-gray-700 hover:bg-gray-50` (logout) | `text-muted-foreground hover:text-foreground hover:bg-muted` |

- [ ] **Step 2: Migrate main content area and misc colors**

| Find | Replace |
|------|---------|
| `min-h-screen bg-gray-50` (root div) | `min-h-screen bg-background` |
| `text-teal-500` (loader) | `text-primary` |
| `text-gray-400` (404 message) | `text-muted-foreground` |
| `bg-amber-400 text-amber-900` (dev banner) | `bg-amber-400 text-amber-900 dark:bg-amber-700 dark:text-amber-100` |

- [ ] **Step 3: Verify AdminLayout in both themes**

Run: `npm run dev`, navigate to `/admin`
Expected: Toggle between Light and Dark — sidebar and main background should fully change. No hardcoded light colors remaining in the layout chrome.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/AdminLayout.tsx
git commit -m "feat(admin): migrate AdminLayout to semantic color classes for dark mode"
```

---

## Task 5: Login Page Migration

**Files:**
- Modify: `client/src/pages/admin/Login.tsx`

- [ ] **Step 1: Add ThemeProvider wrapper and migrate colors**

1. Add import: `import { ThemeProvider } from "@/hooks/useTheme";`

2. Wrap the outermost `div` in `<ThemeProvider>`:
```tsx
return (
  <ThemeProvider>
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      {/* ... */}
    </div>
  </ThemeProvider>
);
```

3. Replace hardcoded colors:

| Find | Replace |
|------|---------|
| `bg-gradient-to-b from-white to-gray-50` | `bg-gradient-to-b from-background to-muted` |
| `bg-white` (card) | `bg-card` |
| `border-gray-200` | `border-border` |
| `text-gray-900` | `text-foreground` |
| `text-gray-600`, `text-gray-500` | `text-muted-foreground` |
| `bg-teal-50` (icon bg) | `bg-primary/10` |
| `text-teal-600` (icon, link) | `text-primary` |
| `bg-teal-600 hover:bg-teal-700` (button) | `bg-primary hover:bg-primary/80` |

- [ ] **Step 2: Verify Login page in both themes**

Run: `npm run dev`, navigate to `/admin/login`
Expected: Login page renders correctly in both light and dark mode. Set localStorage `admin-theme` to `"dark"` manually in devtools and refresh — no white flash.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/admin/Login.tsx
git commit -m "feat(admin): migrate Login page to semantic colors with ThemeProvider"
```

---

## Task 6: Admin Components Color Migration

**Files:**
- Modify: `client/src/components/admin/StatCard.tsx`
- Modify: `client/src/components/admin/MasterDetailLayout.tsx`
- Modify: `client/src/components/admin/ServiceDetailPanel.tsx`
- Modify: `client/src/components/admin/ServiceForm.tsx`
- Modify: `client/src/components/admin/DiffView.tsx`
- Modify: `client/src/components/admin/AddWidgetModal.tsx`
- Modify: `client/src/components/admin/InfoTip.tsx`

- [ ] **Step 1: Migrate StatCard.tsx**

Replace in `StatCard.tsx`:

| Find | Replace |
|------|---------|
| `bg-white` | `bg-card` |
| `border-gray-100` | `border-border` |
| `text-gray-900` | `text-foreground` |
| `text-gray-500` | `text-muted-foreground` |
| `bg-teal-50` (icon bg) | `bg-primary/10` |
| `text-teal-600` (icon) | `text-primary` |

- [ ] **Step 2: Migrate MasterDetailLayout.tsx**

Replace in `MasterDetailLayout.tsx`:

| Find | Replace |
|------|---------|
| `border-r border-gray-200` | `border-r border-border` |
| `text-gray-400` | `text-muted-foreground` |
| `bg-white` | `bg-card` |
| `bg-gray-50` | `bg-muted` |

- [ ] **Step 3: Migrate ServiceDetailPanel.tsx**

This file has ~27 hardcoded color instances. Apply the standard mapping:

| Find | Replace |
|------|---------|
| `bg-white` | `bg-card` |
| `border-gray-*` (any shade) | `border-border` |
| `text-gray-900`, `text-gray-800` | `text-foreground` |
| `text-gray-700` | `text-foreground` |
| `text-gray-600`, `text-gray-500` | `text-muted-foreground` |
| `text-gray-400` | `text-muted-foreground` |
| `bg-gray-50` | `bg-muted` |
| `hover:bg-gray-50` | `hover:bg-muted` |
| `bg-teal-*` | `bg-primary` or `bg-primary/10` as appropriate |
| `text-teal-*` | `text-primary` |

- [ ] **Step 4: Migrate ServiceForm.tsx, DiffView.tsx, AddWidgetModal.tsx, InfoTip.tsx**

Apply the same standard mapping to each file. These files follow the same patterns — `bg-white`, `border-gray-*`, `text-gray-*`, `bg-teal-*`, `text-teal-*`.

- [ ] **Step 5: Verify components in both themes**

Run: `npm run dev`, navigate to `/admin/services` (uses MasterDetailLayout, ServiceDetailPanel), `/admin/services/new` (uses ServiceForm), `/admin/review` (uses DiffView).
Expected: All components render correctly in light and dark mode with no hardcoded light patches.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/admin/StatCard.tsx client/src/components/admin/MasterDetailLayout.tsx client/src/components/admin/ServiceDetailPanel.tsx client/src/components/admin/ServiceForm.tsx client/src/components/admin/DiffView.tsx client/src/components/admin/AddWidgetModal.tsx client/src/components/admin/InfoTip.tsx
git commit -m "feat(admin): migrate shared admin components to semantic color classes"
```

---

## Task 7: Admin Pages Color Migration (Non-Dashboard)

**Files:**
- Modify: `client/src/pages/admin/Services.tsx`
- Modify: `client/src/pages/admin/Review.tsx`
- Modify: `client/src/pages/admin/Feedback.tsx`
- Modify: `client/src/pages/admin/Quality.tsx`
- Modify: `client/src/pages/admin/Scraper.tsx`
- Modify: `client/src/pages/admin/SearchTest.tsx`
- Modify: `client/src/pages/admin/System.tsx`
- Modify: `client/src/pages/admin/ServiceCreate.tsx`
- Modify: `client/src/pages/admin/ServiceImport.tsx`

- [ ] **Step 1: Migrate Services.tsx and Review.tsx**

Apply the standard color mapping. These two pages are the most complex (master-detail pattern). Key replacements:

| Find | Replace |
|------|---------|
| `bg-white` | `bg-card` |
| `bg-gray-50` | `bg-muted` |
| `border-gray-*` | `border-border` |
| `text-gray-900`/`800` | `text-foreground` |
| `text-gray-600`/`500`/`400` | `text-muted-foreground` |
| `hover:bg-gray-50`/`100` | `hover:bg-muted` |
| `bg-teal-*` | `bg-primary` or `bg-primary/10` |
| `text-teal-*` | `text-primary` |
| `ring-teal-*` | `ring-primary` |

- [ ] **Step 2: Migrate remaining 7 pages**

Apply the same mapping to Quality.tsx, Feedback.tsx, Analytics.tsx, Scraper.tsx, SearchTest.tsx, System.tsx, ServiceCreate.tsx, ServiceImport.tsx.

Each page follows the same patterns. Watch for:
- Status colors (red/amber/green) — keep these as-is, they're semantic
- `bg-blue-*` for info states — keep as-is
- Only replace gray and teal hardcoded classes

- [ ] **Step 3: Verify all pages in both themes**

Run: `npm run dev`. Click through every admin page in dark mode:
- Dashboard, Services, Review, Feedback, Quality, Analytics, Scraper, Search Test, System, New Service, Import

Expected: No light-mode patches visible. All text readable against dark backgrounds.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/Services.tsx client/src/pages/admin/Review.tsx client/src/pages/admin/Feedback.tsx client/src/pages/admin/Quality.tsx client/src/pages/admin/Scraper.tsx client/src/pages/admin/SearchTest.tsx client/src/pages/admin/System.tsx client/src/pages/admin/ServiceCreate.tsx client/src/pages/admin/ServiceImport.tsx
git commit -m "feat(admin): migrate all admin pages to semantic color classes for dark mode"
```

---

## Task 8: Dashboard Page + Widget Migration

**Files:**
- Modify: `client/src/pages/admin/Dashboard.tsx`
- Modify: All 22 files in `client/src/components/admin/widgets/`

- [ ] **Step 1: Migrate Dashboard.tsx**

Apply the standard color mapping. Dashboard.tsx primarily renders the widget grid and drag-and-drop controls.

- [ ] **Step 2: Migrate non-chart widgets (18 files)**

Apply the standard mapping to these widgets that don't use Recharts:

1. `HeroStatsWidget.tsx`
2. `ServiceOverviewWidget.tsx`
3. `StatCardsWidget.tsx`
4. `PendingReviewsWidget.tsx`
5. `RecentActivityWidget.tsx`
6. `RecentFeedbackWidget.tsx`
7. `TopSearchesWidget.tsx`
8. `ScraperStatusWidget.tsx`
9. `QualityOverviewWidget.tsx`
10. `EmbeddingCoverageWidget.tsx`
11. `FieldCoverageWidget.tsx`
12. `AnalyticsCategoriesWidget.tsx`
13. `AnalyticsDevicesWidget.tsx`
14. `AnalyticsLeastClickedWidget.tsx`
15. `AnalyticsMostClickedWidget.tsx`
16. `AnalyticsTopQueriesWidget.tsx`
17. `AnalyticsUnmetNeedsWidget.tsx`
18. `VoteSummaryWidget.tsx`

Standard mapping: `bg-white` → `bg-card`, `border-gray-*` → `border-border`, `text-gray-*` → `text-foreground`/`text-muted-foreground`, etc.

Note: SVG status indicators in `EmbeddingCoverageWidget.tsx`, `FieldCoverageWidget.tsx`, and `QualityOverviewWidget.tsx` use hardcoded hex for thresholds (`#10b981`, `#f59e0b`, `#ef4444`) — leave these as-is, they have good contrast on both light and dark card backgrounds.

- [ ] **Step 3: Verify widgets in both themes**

Run: `npm run dev`, navigate to `/admin` Dashboard.
Expected: All widget cards render cleanly in both themes. Drag-and-drop still works.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/Dashboard.tsx client/src/components/admin/widgets/
git commit -m "feat(admin): migrate Dashboard and all non-chart widgets to semantic color classes"
```

---

## Task 9: Chart Theme Utility + Chart Widget Migration

**Files:**
- Create: `client/src/lib/chart-theme.ts`
- Modify: `client/src/pages/admin/Analytics.tsx`
- Modify: `client/src/components/admin/widgets/AnalyticsDailyTrendWidget.tsx`
- Modify: `client/src/components/admin/widgets/AnalyticsPeakHoursWidget.tsx`
- Modify: `client/src/components/admin/widgets/AnalyticsSessionsWidget.tsx`
- Modify: `client/src/components/admin/widgets/AnalyticsClickPositionsWidget.tsx`

- [ ] **Step 1: Create chart-theme.ts utility**

Create `client/src/lib/chart-theme.ts`:

```ts
function getCSSVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function hslToHex(hsl: string): string {
  const parts = hsl.split(/\s+/);
  if (parts.length < 3) return "#888888";
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;

  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function getChartColors() {
  const bg = getCSSVar("--card");
  const fg = getCSSVar("--foreground");
  const muted = getCSSVar("--muted-foreground");
  const border = getCSSVar("--border");

  return {
    primary: hslToHex(getCSSVar("--chart-1")),
    secondary: hslToHex(getCSSVar("--chart-2")),
    grid: hslToHex(getCSSVar("--border")),
    axis: hslToHex(getCSSVar("--muted-foreground")),
    tooltip: {
      bg: hslToHex(bg),
      border: hslToHex(border),
      text: hslToHex(fg),
      muted: hslToHex(muted),
    },
    series: [
      hslToHex(getCSSVar("--chart-1")),
      hslToHex(getCSSVar("--chart-2")),
      hslToHex(getCSSVar("--chart-3")),
      hslToHex(getCSSVar("--chart-4")),
      hslToHex(getCSSVar("--chart-5")),
    ],
  };
}
```

- [ ] **Step 2: Update chart widget files to use getChartColors()**

In each of the 5 chart files:

1. Add imports:
```ts
import { getChartColors } from "@/lib/chart-theme";
import { useTheme } from "@/hooks/useTheme";
```

2. Inside the component, get colors reactively:
```ts
const { effectiveTheme } = useTheme();
const chartColors = getChartColors();
```

3. Replace hardcoded hex values:
- `"#14b8a6"` / `"#0d9488"` → `chartColors.primary`
- `"#94a3b8"` → `chartColors.secondary`
- `"#8b5cf6"` → `chartColors.series[1]` (violet)
- `"#f3f4f6"` (grid) → `chartColors.grid`
- `"#9ca3af"` (axis) → `chartColors.axis`
- Tooltip `contentStyle.backgroundColor: "#ffffff"` → `chartColors.tooltip.bg`
- Tooltip `contentStyle.border` → `"1px solid " + chartColors.tooltip.border`
- Tooltip `labelStyle.color: "#111827"` → `chartColors.tooltip.text`
- Tooltip `itemStyle.color: "#6b7280"` → `chartColors.tooltip.muted`

4. For SVG gradient `<stop>` elements (in AnalyticsDailyTrendWidget), replace `stopColor="#14b8a6"` with `stopColor={chartColors.primary}`.

5. Add `key={effectiveTheme}` to the outermost chart container `<ResponsiveContainer>` to force re-render on theme change.

Also migrate any remaining hardcoded Tailwind gray/teal classes in these files using the standard mapping.

- [ ] **Step 3: Migrate Analytics.tsx page colors**

Apply the standard color mapping to the Analytics.tsx page (contains its own chart instances + layout). Replace the hardcoded `tooltipStyle` object with `getChartColors()` values.

- [ ] **Step 4: Verify charts in both themes**

Run: `npm run dev`, navigate to `/admin/analytics` and `/admin` Dashboard (which embeds chart widgets).
Expected: Charts render with teal-on-dark-card in dark mode, teal-on-white in light mode. Tooltips readable in both themes. Toggle between themes — charts update immediately (no stale colors).

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/chart-theme.ts client/src/pages/admin/Analytics.tsx client/src/components/admin/widgets/AnalyticsDailyTrendWidget.tsx client/src/components/admin/widgets/AnalyticsPeakHoursWidget.tsx client/src/components/admin/widgets/AnalyticsSessionsWidget.tsx client/src/components/admin/widgets/AnalyticsClickPositionsWidget.tsx
git commit -m "feat(admin): add chart theme utility and migrate chart widgets to dynamic colors"
```

---

## Task 10: Category Color Dark Variants

**Files:**
- Modify: `client/src/lib/category-colors.ts`

- [ ] **Step 1: Add dark variants to all 38 categories**

In `client/src/lib/category-colors.ts`, append `dark:` variant classes to each category string.

Pattern:
- `bg-{color}-50` → add `dark:bg-{color}-950`
- `bg-{color}-100` → add `dark:bg-{color}-900`
- `text-{color}-700` → add `dark:text-{color}-300`
- `text-{color}-800` → add `dark:text-{color}-200`
- `text-{color}-600` → add `dark:text-{color}-400`
- `border-{color}-200` → add `dark:border-{color}-800`
- `border-{color}-300` → add `dark:border-{color}-700`

Example transformations:
```ts
"Crisis Services": "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
"Mental Health & Counselling": "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
"Addiction Treatment": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
"Emergency Shelter": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
```

Apply this transformation to all 38 entries. Each one follows the mechanical pattern based on the base color used.

- [ ] **Step 2: Verify category badges in both themes**

Run: `npm run dev`, navigate to `/admin/services` and click on a service to see category badges.
Expected: Badges are readable in both light and dark mode — dark backgrounds with light text in dark mode.

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/category-colors.ts
git commit -m "feat(admin): add dark mode variants to all 38 category color definitions"
```

---

## Task 11: Final Verification + Route Scoping Test

- [ ] **Step 1: Full smoke test — all admin pages in dark mode**

Run: `npm run dev`. Set theme to Dark. Visit every admin page:
1. `/admin` (Dashboard)
2. `/admin/services` (Services list + detail panel)
3. `/admin/services/new` (Create form)
4. `/admin/services/import` (Import)
5. `/admin/review` (Review queue + diff view)
6. `/admin/feedback` (Feedback list)
7. `/admin/quality` (Quality dashboard)
8. `/admin/analytics` (Charts + metrics)
9. `/admin/scraper` (Scraper status)
10. `/admin/search-test` (Search testing)
11. `/admin/system` (System health)
12. `/admin/login` (Login page — test by logging out)

For each page, check:
- No white/light patches visible
- Text readable (sufficient contrast)
- Interactive elements (buttons, inputs, dropdowns) look correct
- Charts render with appropriate dark-mode colors

- [ ] **Step 2: Route scoping test**

1. Set theme to Dark in admin
2. Navigate to the public site (e.g., `/`)
3. Verify: public site renders in light mode (no `dark` class on `<html>`)
4. Navigate back to `/admin`
5. Verify: dark mode re-applies

- [ ] **Step 3: System preference test**

1. Set theme to "Auto"
2. Change OS dark mode setting
3. Verify: admin theme follows OS preference

- [ ] **Step 4: Flash prevention test**

1. Set theme to Dark
2. Hard refresh (`Cmd+Shift+R`) on `/admin`
3. Verify: no white flash before dark mode applies

- [ ] **Step 5: TypeScript check**

Run: `npm run check`
Expected: No type errors

- [ ] **Step 6: Build check**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 7: Commit any final fixes**

If any issues were found and fixed during verification:
```bash
git add -A
git commit -m "fix(admin): dark mode polish and edge case fixes"
```
