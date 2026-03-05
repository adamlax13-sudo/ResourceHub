# Scraper Redesign — Design Document

**Date:** 2026-03-04
**Status:** Approved

## Problem Statement

The current scraper is costly (~$15-25+ per run), slow (60+ min), and produces inconsistent quality on the most important fields: process steps, required documents, eligibility, and wait times. It runs 12 sequential phases making ~700+ API calls per full run, with no change detection (re-processes everything every time).

## Goals

1. **Reduce cost** to $5-12 per full run, $1-3 incremental
2. **Reduce runtime** to 15-30 minutes
3. **Improve data quality** on process steps, required docs, eligibility, wait times
4. **Add CRA Charities Alberta** as a new source
5. **Make incremental runs near-instant** via change detection
6. **Simplify** from 12 phases to 3

## Architecture Overview

### Phase 1: Discover & Collect (Direct Scraping — No AI)

Scrapes source directories directly for the service roster and basic structured data.

**Sources (plugins):**

| Source | Method | Status |
|--------|--------|--------|
| 211 Alberta Direct | Playwright | Existing (refactor) |
| AHS FindHealth | HTTP scraping | Existing (refactor) |
| CRA Charities Alberta | HTTP scraping | **New** |
| Homeless Hub | HTTP scraping | Existing (refactor) |
| ACDS | HTTP scraping | Existing (refactor) |
| Veterans Affairs | HTTP scraping | Existing (refactor) |

**Collected fields:** Name, category, phone, email, address, hours, website URL, basic description. All from HTML — zero API calls.

**Change detection:** Hash each source page content. Skip services whose source hash hasn't changed since last run.

**Eliminated:**
- 211 Discovery via OpenAI web search (~380 API calls removed)
- Deep crawl phase (~25 min removed)
- InformAlberta AI enrichment (replaced by direct scrape or dropped)

### Phase 2: Deep Enrichment (AI-Powered — Targeted)

Uses Claude with web search tool to find and extract hard-to-get fields. This is where budget is concentrated for maximum data quality.

**Target fields:**
- Process steps (step-by-step intake procedure)
- Required documents
- Eligibility criteria (age, gender, residency, referral requirements)
- Wait times
- Cost / fee information

**One Claude call per batch of ~5 services** (same category), using web search tool + structured tool output. Claude searches for the information itself rather than relying on a crawler.

#### Output Schema

```json
{
  "process_steps": [
    { "step": "Call intake line", "action": "Phone", "details": "780-555-1234, Mon-Fri 9-5", "source_url": "..." }
  ],
  "required_docs": [
    { "document": "Alberta Health Care card", "context": "Must be presented at intake", "source_url": "..." }
  ],
  "eligibility": {
    "age_range": "18+",
    "gender": "all",
    "residency": "Alberta resident",
    "referral_required": true,
    "referral_source": "Doctor or social worker",
    "other_criteria": "...",
    "source_url": "..."
  },
  "wait_times": {
    "estimate": "2-4 weeks",
    "as_of": "2026-01",
    "source_url": "..."
  },
  "cost": {
    "is_free": true,
    "details": "...",
    "source_url": "..."
  },
  "confidence": 85
}
```

#### Data Quality Hierarchy

1. **Found with source** (confidence 70-100) — extracted from official or trusted site with citation
2. **Found on third-party site** (confidence 50-69) — verified with a second Claude call against the service's own website
3. **Inferred** (confidence 30-49) — generated from similar services in same category, marked `is_inferred: true`

**Critical rules:**
- Source URLs required for every extracted field. No source = null (unless inferred as last resort).
- `"I don't know"` is valid — Claude is explicitly told not to guess.
- Inferred data **never overwrites** found/verified data.
- Inferred steps are generated from similar services in the same category as a last resort to avoid blank fields.

#### Anti-Hallucination Strategy

1. Source URLs required for every field
2. Tiered confidence scoring (90-100 official, 70-89 trusted directory, 50-69 third-party, <50 rejected)
3. Explicit prompt: "If you cannot find specific intake steps, return null. Do NOT infer or generate plausible-sounding steps."
4. Verification pass for confidence 50-69 services
5. Inference only as absolute last resort, clearly marked

#### Budget Control

| Scenario | Services | Claude calls | Est. cost |
|----------|----------|-------------|-----------|
| Full run (all services) | ~1,500 | ~300 batched + ~200 verification | ~$8-12 |
| Incremental (new/changed) | ~100-200 | ~20-40 batched + ~30 verification | ~$1-2 |
| Single source refresh | ~50 | ~10 batched | ~$0.50 |

### Phase 3: Finalize (Cheap Batch Operations)

- Generate/update embeddings (OpenAI text-embedding-3-small, ~$0.02)
- Normalize contacts (phone, email, address formatting)
- Enhance searchable tags
- Deduplicate services
- Refresh materialized views

No AI extraction — just data cleanup.

## Source Plugin Architecture

### Plugin Interface

```python
class Source:
    name: str           # e.g. "211_alberta"
    url: str            # base URL

    def discover(self) -> list[RawService]:
        """Scrape the directory. Return basic service data. No AI."""

    def has_changed(self, service_id, last_hash) -> bool:
        """Check if source page changed since last scrape."""
```

Each plugin only implements `discover()`. The pipeline handles enrichment, embeddings, dedup, and storage.

### CRA Charities Alberta — Relevance Filtering

CRA's database includes all registered charities (golf clubs, arts orgs, etc.). Filtering strategy:

1. **Category whitelist** — only pull CRA designation codes relevant to social services: welfare, health, education, housing, community services, Indigenous organizations, religious organizations (that run programs)
2. **Keyword relevance check** — match charity programs/activities against relevance keywords (addiction, mental health, housing, food bank, shelter, crisis, counselling, disability, newcomer, family services, etc.). Discard charities with zero matches.
3. **Direct services only** — only keep charities providing direct services to people. Foundations that only fund other charities are filtered out.

No AI needed — category codes and keyword matching. Deterministic and free.

## Database Changes

### New fields on `services` table

- `enrichment_source` — `"found"`, `"verified"`, or `"inferred"`
- `enrichment_date` — when AI enrichment last ran
- `source_page_hash` — for change detection

### Changes to `service_intake_details` table

- Add `is_inferred` boolean flag
- Add `source_urls` JSON array

### Dropped tables

- `website_crawl` — no longer deep crawling
- `crawled_page` — no longer storing intermediate HTML

## CLI Design

```bash
# Full pipeline
python scraper.py

# Individual phases
python scraper.py --phase discover
python scraper.py --phase enrich
python scraper.py --phase finalize

# Target a specific source
python scraper.py --source 211_alberta
python scraper.py --source cra_charities

# Incremental (default) vs full re-enrichment
python scraper.py --phase enrich                    # Only new/changed/stale
python scraper.py --phase enrich --full             # Re-enrich everything

# Budget cap
python scraper.py --phase enrich --budget 5.00

# Dry run
python scraper.py --dry-run

# Single service enrichment (testing)
python scraper.py --enrich-service "Service Name Here"
```

### Run Summary Output

```
=== Scraper Run Summary ===
Sources scraped:    6 (211, AHS, CRA, HomelessHub, ACDS, Veterans)
Services found:     1,847
New services:       23
Updated services:   67
Skipped (unchanged): 1,757

Enrichment:
  Enriched:         90 services (23 new + 67 changed)
  Found w/ source:  61 (68%)
  Verified:         12 (13%)
  Inferred:         17 (19%)
  API cost:         $1.84

Embeddings:         23 generated ($0.01)
Deduped:            3 services merged
Total cost:         $1.85
Duration:           18 minutes
```

## Comparison: Current vs Redesign

| | Current | Redesign |
|--|---------|----------|
| Phases | 12 | 3 |
| API calls (full run) | ~700+ | ~300 (batched 5:1) |
| Cost per full run | $15-25+ | $5-12 |
| Cost per incremental | Same as full | $1-3 |
| Runtime | 60+ min | 15-30 min |
| Process step quality | Crawler-dependent, often misses | AI-searched, source-cited, inferred as fallback |
| Sources | 5 + AI discovery | 6 direct scrapers (+ easy to add more) |
| Change detection | None | Hash-based |

## Skills / Tools for Implementation

- Claude web search tool for Phase 2 enrichment
- Playwright for 211 Alberta Direct (already in use)
- BeautifulSoup/requests for other sources (already in use)
- OpenAI for embeddings (already in use)
- SQLAlchemy for database access (already in use)
