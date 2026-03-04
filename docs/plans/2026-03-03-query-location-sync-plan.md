# Query-Location Dropdown Sync — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-sync the location dropdown when a user's search query mentions a different city than what's currently selected.

**Architecture:** A pure frontend utility extracts location from query text on submit. Hero.tsx calls it before dispatching the search and updates the dropdown if a mismatch is detected. No backend changes.

**Tech Stack:** React, TypeScript, Vitest

---

### Task 1: Create `extractQueryLocation` utility

**Files:**
- Create: `client/src/lib/extract-query-location.ts`

**Step 1: Create the utility file**

The function must return a dropdown-compatible value (one of the `ALBERTA_LOCATIONS` values from Hero.tsx) or `null`. It also handles province-wide terms by returning `''` (empty string = "All of Alberta").

```typescript
/**
 * Extracts a location from a search query and returns the corresponding
 * dropdown value, or null if no location is detected.
 *
 * Only returns values that exist in the Hero.tsx ALBERTA_LOCATIONS dropdown.
 * The backend has a broader set of locations it can detect on its own.
 */

// Dropdown values — must match ALBERTA_LOCATIONS in Hero.tsx
const DROPDOWN_LOCATIONS = [
  'calgary', 'edmonton', 'red deer', 'lethbridge', 'medicine hat',
  'grande prairie', 'fort mcmurray', 'airdrie', 'st albert',
  'spruce grove', 'leduc', 'okotoks', 'cochrane', 'sherwood park',
  'fort saskatchewan', 'camrose', 'lloydminster', 'cold lake',
  'brooks', 'canmore', 'banff',
];

// Common aliases that map to dropdown values
// Subset of server/helpers/locations.ts LOCATION_ALIASES
const ALIASES: Record<string, string> = {
  // Airport codes
  'yyc': 'calgary',
  'yeg': 'edmonton',
  'yqf': 'red deer',
  'yql': 'lethbridge',
  'ymm': 'fort mcmurray',
  'ygp': 'grande prairie',
  'yxh': 'medicine hat',
  'yqd': 'lloydminster',
  'yod': 'cold lake',
  // Fort McMurray variations
  'fort mac': 'fort mcmurray',
  'ft mac': 'fort mcmurray',
  'ft. mac': 'fort mcmurray',
  'ft mcmurray': 'fort mcmurray',
  'ft. mcmurray': 'fort mcmurray',
  'wood buffalo': 'fort mcmurray',
  // Fort Saskatchewan variations
  'fort sask': 'fort saskatchewan',
  'ft sask': 'fort saskatchewan',
  'ft. sask': 'fort saskatchewan',
  'ft saskatchewan': 'fort saskatchewan',
  'ft. saskatchewan': 'fort saskatchewan',
  // Medicine Hat variations
  'med hat': 'medicine hat',
  'the hat': 'medicine hat',
  // St. Albert variations
  'st. albert': 'st albert',
  'saint albert': 'st albert',
  // Grande Prairie variations
  'grand prairie': 'grande prairie',
  // Sherwood Park
  'sherwood': 'sherwood park',
};

const PROVINCE_WIDE_TERMS = [
  'alberta', 'province-wide', 'province wide', 'provincial',
  'across alberta', 'all of alberta', 'anywhere in alberta',
];

export function extractQueryLocation(query: string): string | null {
  const q = query.toLowerCase();

  // Check for province-wide terms first
  if (PROVINCE_WIDE_TERMS.some(term => q.includes(term))) {
    return '';  // empty string = "All of Alberta" in dropdown
  }

  // Check aliases before city names (aliases are more specific, e.g. "fort mac" before "fort")
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    if (q.includes(alias)) {
      return canonical;
    }
  }

  // Check dropdown city names (longest first to match "medicine hat" before "hat")
  const sorted = [...DROPDOWN_LOCATIONS].sort((a, b) => b.length - a.length);
  for (const city of sorted) {
    if (q.includes(city)) {
      return city;
    }
  }

  return null;
}
```

**Step 2: Commit**

```bash
git add client/src/lib/extract-query-location.ts
git commit -m "feat: add extractQueryLocation utility for query-location sync"
```

---

### Task 2: Wire up location sync in Hero.tsx

**Files:**
- Modify: `client/src/components/Hero.tsx:1` (add import)
- Modify: `client/src/components/Hero.tsx:320-325` (handleSubmit)
- Modify: `client/src/components/Hero.tsx:598-601` (voice search onResult)

**Step 1: Add import at top of Hero.tsx**

After the existing imports (line 7), add:

```typescript
import { extractQueryLocation } from "@/lib/extract-query-location";
```

**Step 2: Update `handleSubmit` to detect and sync location**

Replace the current `handleSubmit` (lines 320-325):

```typescript
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query, locations, hp);
    }
  };
```

With:

```typescript
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const detectedLocation = extractQueryLocation(query);
    // If query mentions a location that differs from the dropdown, sync it
    if (detectedLocation !== null && detectedLocation !== selectedLocation) {
      onLocationChange(detectedLocation);
      onSearch(query, detectedLocation ? [detectedLocation] : [], hp);
    } else {
      onSearch(query, locations, hp);
    }
  };
```

**Step 3: Update voice search callback to also sync location**

Replace the voice search `startListening` callback (lines 598-601):

```typescript
                    startListening((transcript) => {
                      setQuery(transcript);
                      onSearch(transcript, locations);
                    });
```

With:

```typescript
                    startListening((transcript) => {
                      setQuery(transcript);
                      const detectedLocation = extractQueryLocation(transcript);
                      if (detectedLocation !== null && detectedLocation !== selectedLocation) {
                        onLocationChange(detectedLocation);
                        onSearch(transcript, detectedLocation ? [detectedLocation] : []);
                      } else {
                        onSearch(transcript, locations);
                      }
                    });
```

**Step 4: Commit**

```bash
git add client/src/components/Hero.tsx
git commit -m "feat: auto-sync location dropdown when query mentions a different city"
```

---

### Task 3: Manual smoke test

**Step 1: Run dev server**

```bash
npm run dev
```

**Step 2: Test scenarios**

1. Set dropdown to "Calgary", search "shelters in Edmonton" → dropdown should switch to "Edmonton", results should be Edmonton
2. Set dropdown to "Edmonton", search "mental health calgary" → dropdown should switch to "Calgary"
3. Set dropdown to "Calgary", search "addiction support" (no city) → dropdown stays on "Calgary"
4. Set dropdown to "Calgary", search "services in alberta" → dropdown should switch to "All of Alberta"
5. Set dropdown to "All of Alberta", search "crisis yyc" → dropdown should switch to "Calgary"
6. Voice search (if available): say "help in Edmonton" with Calgary selected → should switch

**Step 3: TypeScript check**

```bash
npm run check
```

**Step 4: Commit design doc and plan**

```bash
git add docs/plans/2026-03-03-query-location-sync-design.md docs/plans/2026-03-03-query-location-sync-plan.md
git commit -m "docs: add design and implementation plan for query-location sync"
```
