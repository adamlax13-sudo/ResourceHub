# Pre-Search Filter Icon Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a filter icon inside the search bar that opens the RefinePanel before a search is performed.

**Architecture:** Two-prop addition to Hero (callback + count), one icon button with badge overlay, padding adjustment on search input. No new components, no backend changes.

**Tech Stack:** React, Tailwind CSS, Lucide icons, Framer Motion

---

### Task 1: Add filter icon props to Hero and wire from Home

**Files:**
- Modify: `client/src/components/Hero.tsx:37-44` (HeroProps interface)
- Modify: `client/src/components/Hero.tsx:322` (destructured props)
- Modify: `client/src/pages/Home.tsx:249-257` (Hero JSX)

**Step 1: Add props to HeroProps interface**

In `Hero.tsx`, add two new props to the `HeroProps` interface:

```tsx
interface HeroProps {
  onSearch: (query: string, locations: string[], hp?: string) => void;
  isLoading: boolean;
  initialQuery?: string;
  locations: string[];
  onLocationChange: (location: string) => void;
  onEmergencySearch: () => void;
  onOpenWizard: () => void;
  onOpenRefinePanel: () => void;
  activeFilterCount: number;
}
```

**Step 2: Destructure new props in Hero component**

Update the function signature at line 322:

```tsx
export function Hero({ onSearch, isLoading, initialQuery = "", locations, onLocationChange, onEmergencySearch, onOpenWizard, onOpenRefinePanel, activeFilterCount }: HeroProps) {
```

**Step 3: Pass props from Home.tsx**

Update the `<Hero>` JSX in Home.tsx (around line 249):

```tsx
<Hero
  onSearch={handleSearch}
  isLoading={isPending}
  initialQuery={searchState.query}
  locations={searchState.locations}
  onLocationChange={handleLocationChange}
  onEmergencySearch={handleEmergencySearch}
  onOpenWizard={handleOpenWizard}
  onOpenRefinePanel={() => setRefinePanelOpen(true)}
  activeFilterCount={activeFilterCount}
/>
```

**Step 4: Verify no TypeScript errors**

Run: `npm run check`
Expected: No errors

**Step 5: Commit**

```bash
git add client/src/components/Hero.tsx client/src/pages/Home.tsx
git commit -m "feat: wire refine panel props from Home to Hero"
```

---

### Task 2: Add filter icon button inside search input

**Files:**
- Modify: `client/src/components/Hero.tsx:1` (add SlidersHorizontal import)
- Modify: `client/src/components/Hero.tsx:605-673` (search input area)

**Step 1: Add SlidersHorizontal to the lucide import**

Change line 1:
```tsx
import { Search, MapPin, ChevronDown, Check, Mic, MicOff, SlidersHorizontal } from "lucide-react";
```

**Step 2: Adjust search input left padding**

Change the input's `pl-6` to `pl-14` to make room for the icon. The input is around line 608-619. Update the className:

```tsx
className={`relative w-full h-16 pl-14 rounded-2xl text-lg text-foreground bg-white shadow-2xl border-2 border-transparent focus:border-primary/30 focus:outline-none transition-all placeholder:text-muted-foreground focus:shadow-[0_0_30px_rgba(255,255,255,0.3)] ${voiceSupported ? 'pr-28' : 'pr-16'}`}
```

**Step 3: Add the filter icon button before the input element**

Inside the `<div className="relative group">` block (line 605), right after the glow div and label, add the filter button before the `<input>`. Place it after the `<label>` (line 607) and before the `<input>` (line 608):

```tsx
{/* Filter icon — opens RefinePanel for pre-search refinement */}
<button
  type="button"
  onClick={onOpenRefinePanel}
  className="absolute left-2 top-2 h-12 w-12 rounded-xl flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all z-10"
  aria-label="Open search filters"
>
  <SlidersHorizontal className="w-5 h-5" aria-hidden="true" />
  {activeFilterCount > 0 && (
    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold shadow-sm">
      {activeFilterCount}
    </span>
  )}
</button>
```

**Step 4: Verify visually**

Run: `npm run dev`
- Filter icon should appear on the left side of the search input
- Clicking it should open the RefinePanel
- Setting filters should show the count badge
- Search input text should not overlap the icon

**Step 5: Commit**

```bash
git add client/src/components/Hero.tsx
git commit -m "feat: add filter icon with badge inside search bar"
```
