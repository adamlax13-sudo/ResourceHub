# Pre-Search Filter Icon Design

## Problem
Refinement filters are only accessible after a search is performed (via the "Refine" button in the results toolbar). Users should be able to set filters before searching.

## Solution
Add a filter icon button inside the left side of the search input that opens the existing RefinePanel. This provides a second entry point to the same panel — one pre-search (in the Hero), one post-search (in the results toolbar).

## Design Decisions

- **Expandable, not always-visible:** A small icon button keeps the hero clean; filters appear on click via the existing RefinePanel slide-in.
- **Inside the search bar (left side):** Mirrors the mic/search buttons on the right. Follows the Airbnb/Booking pattern for hero-style search bars.
- **Reuse existing RefinePanel:** Scales to future filter additions without redesign. Same component, two trigger locations.
- **Active filter badge:** Small primary-colored count badge on the icon when filters are set, so users know filters are applied at a glance.
- **Pre-search chips:** Active filter chips render below the Hero even before a search is performed.

## Changes

### Hero.tsx
- Add `SlidersHorizontal` icon button positioned `absolute left-2 top-2` inside the search input container
- Badge overlay showing `activeFilterCount` when > 0
- Increase input `pl-6` to `pl-14` for icon space
- New props: `onOpenRefinePanel`, `activeFilterCount`

### Home.tsx
- Lift `isRefinePanelOpen` state so both Hero and results toolbar can trigger it
- Pass `onOpenRefinePanel` and `activeFilterCount` to Hero
- Show active filter chips below Hero even when `!hasSearched`

### No changes to
- RefinePanel.tsx (internals unchanged)
- SearchContext.tsx (state management unchanged)
- Backend / API
