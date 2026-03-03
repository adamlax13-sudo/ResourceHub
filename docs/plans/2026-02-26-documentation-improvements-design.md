# Documentation & Observability Improvements Design

## Context

ResourceHub is a solo-maintained Alberta social services directory. The codebase has grown significantly but lacks foundational documentation (no root README, no CLAUDE.md, no API reference). Search quality suffers from "missing results" that are hard to diagnose without observability. Data coverage gaps exist but aren't systematically tracked.

## Priorities (from user)

1. Developer experience — missing documentation is the biggest friction
2. Data coverage & quality — gaps and duplicates
3. Search quality — known good services don't appear in results

## Approach: Documentation-First

Build documentation and observability foundations first, then use them to systematically fix search and data gaps.

## Phase 1: Documentation (no code changes)

### 1. Root README.md
- What ResourceHub is (1-2 sentences)
- Quick start (local dev setup in 5 steps)
- Architecture diagram (text-based: scraper -> DB -> server -> client)
- Available scraper phases and how to run them
- Environment variables reference
- Link to deployment docs

### 2. CLAUDE.md
- Project structure overview
- Key file locations and their purposes
- Coding conventions (TypeScript style, Python style)
- Common commands (dev, build, test, scrape)
- Database schema overview
- Search pipeline summary

### 3. API Endpoint Reference (docs/API.md)
- All endpoints with parameters and response shapes
- Auth requirements per endpoint
- Rate limiting details

## Phase 2: Search Observability (small code changes)

- Debug trace on search API (`?debug=true`, admin auth)
- Captures: recognized terms, detected intents, SQL vs semantic counts, filter removals, score breakdowns
- Evaluation report aggregation script

## Phase 3: Data Coverage Audit (read-only scripts)

- Service category coverage breakdown
- Missing field counts (phone, email, address, embeddings)
- Source coverage matrix (which scrapers cover which service types)
- Geographic distribution analysis
- Generic name audit process

## Phase 4: Targeted Search & Data Fixes (informed by Phases 2-3)

- Fill embedding gaps for uncovered services
- Fix query analysis misses identified by debug logging
- Tune filter thresholds for small result sets
- Enrich existing services with missing fields

## Dependencies

Each phase builds on the previous. Phases 1-3 are low-risk (no production behavior changes). Phase 4 is where search quality improvements happen, informed by observability.
