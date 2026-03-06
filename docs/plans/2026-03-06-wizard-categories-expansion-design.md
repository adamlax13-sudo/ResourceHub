# Design: Expand Search Wizard Categories from 8 to 12

**Date:** 2026-03-06
**Status:** Approved

## Problem

The search walkthrough wizard (Step 2: "What's most urgent right now?") only surfaces 8 categories, while the database has 30+ category types. Most notably, "Community & Social Connection" (114 active services, 2nd largest category) and "Domestic Violence Support" (81 services, 4th largest) are completely missing from the wizard.

## Solution

Add 4 new category tiles to the wizard and home page CategoryTiles, going from 8 to 12. Keep the flat grid layout (no grouping/collapsing).

### New Categories

| Label | Lucide Icon | Search Query | DB Services |
|-------|-------------|-------------|-------------|
| Social Connection | `HandHeart` | `"social connection community recreation programs"` | 114 |
| Domestic Violence | `ShieldCheck` | `"domestic violence abuse safety support"` | 81 |
| Family & Parenting | `Baby` | `"family parenting pregnancy child support"` | 34 |
| Legal Aid | `Scale` | `"legal aid lawyer court advocacy"` | 21 |

### Category Order (by urgency/frequency)

1. Crisis Support
2. Domestic Violence *(new)*
3. Mental Health
4. Addiction Recovery
5. Housing
6. Food & Basic Needs
7. Healthcare
8. Disability Support
9. Social Connection *(new)*
10. Family & Parenting *(new)*
11. Employment
12. Legal Aid *(new)*

## Files Changed

- `client/src/components/CategoryTiles.tsx` — add 4 entries to CATEGORIES array, add 4 icon imports
- `client/src/components/IntakeWizard.tsx` — widen modal from `sm:max-w-lg` to `sm:max-w-xl`

## What Stays the Same

- Step 1 (Who needs help?) — unchanged
- Step 3 (Requirements) — unchanged
- `assembleSearch()` logic — unchanged
- No backend changes — queries are semantic, search engine handles them
- Grid layout: `grid-cols-2 sm:grid-cols-4` works for 12 tiles (3 rows desktop, 6 rows mobile)
