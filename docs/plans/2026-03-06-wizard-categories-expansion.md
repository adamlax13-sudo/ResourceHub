# Wizard Categories Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the search wizard Step 2 from 8 to 12 category tiles, adding Social Connection, Domestic Violence, Family & Parenting, and Legal Aid.

**Architecture:** Add 4 new entries to the shared `CATEGORIES` array in `CategoryTiles.tsx` (used by both the home page tiles and the IntakeWizard). Widen the wizard modal to accommodate the extra tiles. No backend changes needed — queries are semantic.

**Tech Stack:** React, Lucide icons, Tailwind CSS

---

### Task 1: Add 4 new categories to CategoryTiles.tsx

**Files:**
- Modify: `client/src/components/CategoryTiles.tsx:1-29`

**Step 1: Add icon imports and new category entries**

Add these 4 icons to the existing import from `lucide-react`:
```
HandHeart, ShieldCheck, Baby, Scale
```

Replace the CATEGORIES array with the new 12-item array, reordered by urgency:

```typescript
export const CATEGORIES: Category[] = [
  { label: "Crisis Support",      icon: ShieldAlert,     query: "crisis support emergency help" },
  { label: "Domestic Violence",    icon: ShieldCheck,     query: "domestic violence abuse safety support" },
  { label: "Mental Health",        icon: Brain,           query: "mental health counselling therapy" },
  { label: "Addiction Recovery",   icon: Sprout,          query: "addiction recovery treatment" },
  { label: "Housing",              icon: Home,            query: "housing shelter accommodation" },
  { label: "Food & Basic Needs",   icon: UtensilsCrossed, query: "food bank meals basic needs" },
  { label: "Healthcare",           icon: HeartPulse,      query: "healthcare medical clinic" },
  { label: "Disability Support",   icon: Accessibility,   query: "disability support accessibility" },
  { label: "Social Connection",    icon: HandHeart,       query: "social connection community recreation programs" },
  { label: "Family & Parenting",   icon: Baby,            query: "family parenting pregnancy child support" },
  { label: "Employment",           icon: Briefcase,       query: "employment job training work" },
  { label: "Legal Aid",            icon: Scale,           query: "legal aid lawyer court advocacy" },
];
```

**Step 2: Verify dev server compiles without errors**

Run: `npm run check`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add client/src/components/CategoryTiles.tsx
git commit -m "feat(wizard): expand categories from 8 to 12

Add Social Connection, Domestic Violence, Family & Parenting, and Legal Aid.
Reorder by urgency (crisis/safety first, practical needs last)."
```

---

### Task 2: Widen the IntakeWizard modal

**Files:**
- Modify: `client/src/components/IntakeWizard.tsx:119`

**Step 1: Change modal max-width**

On line 119, change:
```
sm:max-w-lg
```
to:
```
sm:max-w-xl
```

This gives the 4-column grid more room for 12 tiles.

**Step 2: Verify dev server compiles**

Run: `npm run check`
Expected: No TypeScript errors

**Step 3: Visual check**

Run: `npm run dev`
- Open wizard → Step 2 should show 12 tiles in a 4-col grid (desktop) or 2-col grid (mobile)
- All tiles should be clickable and advance to Step 3
- Home page category tiles should also show 12 tiles

**Step 4: Commit**

```bash
git add client/src/components/IntakeWizard.tsx
git commit -m "feat(wizard): widen modal for 12-tile grid"
```
