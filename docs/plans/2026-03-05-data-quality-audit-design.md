# Data Quality Audit — Design Doc

**Date:** 2026-03-05
**Scope:** 1,061 active services (~1,045 newly added)

## Problem

Newly added services (primarily from CRA scraper) have formatting issues and missing contact/operational data that degrades search quality and user experience.

## Data Quality Summary

| Issue | Count |
|-------|-------|
| Missing email | 364 |
| Missing eligibility | 88 |
| Missing hours | 84 |
| Missing address | 59 |
| Missing contact | 47 |
| Missing phone | 37 |
| ALL CAPS names | 180 |
| Uppercase URLs | 120 |
| PO Box-only addresses | 42 |
| Snake_case categories | ~209 |
| City-suffix categories | ~45 |

## Phase 1: Bulk SQL Formatting Fixes

Instant fixes, no web research needed:

1. **Title-case service names** — 180 ALL CAPS names → proper title case
2. **Lowercase URLs** — 120 uppercase URLs → lowercase, fix 1 URL with spaces
3. **Lowercase emails** — 5 uppercase emails → lowercase
4. **Normalize city-suffix categories** — "Category - City" → "Category" (location already stored in `location` field)
5. **Map snake_case categories** — `housing` → best-fit from 37 existing proper categories (requires per-service review)

## Phase 2: Web Research (Batches of 30)

For each batch of 30 services, ordered by most missing fields first:

1. Query services with most missing fields
2. Web search each service (name + city, or visit website_url) to find:
   - Phone, email, address, hours of operation
   - Eligibility information
   - Better category assignment for snake_case services
3. Build and execute UPDATE statements
4. Report findings before proceeding to next batch

### Target Categories (37 existing)

Addiction Treatment, Affordable Housing, Basic Needs & Material Aid, Campus & Student Services, Child Welfare & Aging Out of Care, Community & Social Connection, Criminal Justice Reintegration, Crisis Lines, Crisis Services, Detox & Withdrawal, Disability & Autism Support, Domestic Violence Support, Eating Disorder Services, Emergency Shelter, Employment Services, Family & Parenting Support, Financial Counselling & Debt Help, Food Banks & Meals, Gambling Support, Grief & Bereavement, Harm Reduction, Healthcare Access, Human Trafficking Support, Indigenous Services, Legal Aid, LGBTQ2S+ Services, Mental Health & Counselling, Newcomer & Settlement, Recovery & Peer Support, Residential Treatment, Senior Services, Sexual Health Services, Transitional Housing, Transportation Assistance, Trauma & PTSD Support, Veterans Services, Youth Services

### Priority Order

1. Services missing 3+ fields
2. Services missing 1-2 fields
3. Services needing only category reclassification

### Out of Scope

- Descriptions (already good quality)
- Tags and embeddings (require scraper pipeline)
- Services with complete data
