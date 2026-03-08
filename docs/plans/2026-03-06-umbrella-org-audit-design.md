# Umbrella Organization Sub-Program Audit

**Date:** 2026-03-06
**Goal:** Identify umbrella organizations in the DB whose individual sub-programs are missing as separate entries.

## Gold Standard

Making Changes Association: 6 sub-programs, each with own entry, unique URL, rich description.

## Phases

### Phase 1: Identify Candidates
Query DB for active services where description signals multiple programs, has a website_url, and doesn't already have 3+ sub-program entries.

### Phase 2: Parallel Website Scraping
Dispatch subagents in batches of 5-8 orgs. Each subagent:
1. Navigates to org website via Playwright
2. Finds programs/services pages
3. Extracts distinct program names, descriptions, URLs, eligibility, contact

### Phase 3: Cross-Reference & Gap Report
Compare discovered programs against existing DB entries. Produce structured report of missing programs.

### Phase 4: Output
Markdown + JSON audit report with missing programs formatted for DB insertion. No DB writes without user approval.
