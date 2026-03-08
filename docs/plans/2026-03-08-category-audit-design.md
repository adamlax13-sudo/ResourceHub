# Category Audit Design — 2026-03-08

## Problem

Services are miscategorized (e.g., "Find a Doctor Alberta" under "Mental Health & Counselling" instead of "Healthcare Access"). With 1,248 active services across 40 categories — and no centralized taxonomy — miscategorizations degrade search quality.

## Approach

Full taxonomy overhaul: define canonical categories, then re-classify all 1,248 services using subagent-based review (no API cost).

## Canonical Taxonomy (36 categories)

Consolidated from 40 → 36 by merging:
- `Elder Support` (1) → `Senior Services`
- `Sexual Assault Support` (1) → `Domestic Violence Support` or `Trauma & PTSD Support`
- `Information & Referral` (4) → redistribute by actual service type
- `Child Welfare & Aging Out of Care` (4) → `Family & Parenting Support` or `Youth Services`

## Classification Process

1. Pull all services (id, name, description, process_steps, current_category)
2. Dispatch ~13 subagents (~100 services each) with canonical taxonomy + definitions
3. Each outputs KEEP or CHANGE → NewCategory per service
4. Aggregate into fix script (DRY_RUN by default)

## Search Pipeline Updates

After category changes:
1. Regenerate embeddings for changed services
2. Refresh `mv_service_search` materialized view
3. Update `INTENT_SERVICE_MAP` serviceTypes in `intent-boost.ts`
4. Update scraper `CATEGORY_MAP`s to canonical names
5. Bump `CACHE_VERSION` in `server/search/index.ts`
6. Run search evaluation to verify improvement
