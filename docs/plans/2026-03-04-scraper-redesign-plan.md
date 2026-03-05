# Scraper Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overhaul the scraper from 12 phases to 3 (Discover → Enrich → Finalize), with hybrid direct-scraping + AI-enrichment focused on process step and eligibility data quality.

**Architecture:** Phase 1 directly scrapes source directories (no AI) with change detection. Phase 2 uses Claude web search to find and extract process steps, required docs, eligibility, wait times — batched 5 services per call with anti-hallucination safeguards and inference as last resort. Phase 3 runs embeddings, normalization, dedup, and view refresh.

**Tech Stack:** Python 3.9+, SQLAlchemy, Anthropic Claude (web search + tool_use), OpenAI (embeddings), Playwright (211 Direct), BeautifulSoup/requests (other sources), pytest.

**Design doc:** `docs/plans/2026-03-04-scraper-redesign-design.md`

---

## Task 1: New Source Plugin Interface

**Files:**
- Create: `scraper/sources/plugin.py`
- Test: `scraper/tests/test_plugin_interface.py`

**Step 1: Write the failing test**

```python
# scraper/tests/test_plugin_interface.py
import pytest
from unittest.mock import MagicMock
from scraper.sources.plugin import Source, RawService


def test_raw_service_has_required_fields():
    svc = RawService(
        name="Test Service",
        category="addiction",
        location="Calgary, AB",
        phone="403-555-1234",
        source_url="https://example.com/test",
    )
    assert svc.name == "Test Service"
    assert svc.source_url == "https://example.com/test"


def test_raw_service_optional_fields_default_none():
    svc = RawService(name="Test", category="housing", source_url="https://example.com")
    assert svc.email is None
    assert svc.address is None
    assert svc.hours is None
    assert svc.website_url is None
    assert svc.description is None
    assert svc.tags is None


def test_source_requires_name_and_url():
    class MySource(Source):
        name = "test_source"
        url = "https://example.com"
        def discover(self, session, log, dry_run=False):
            return []
        def has_changed(self, service_id, last_hash):
            return True

    src = MySource()
    assert src.name == "test_source"
    assert src.url == "https://example.com"


def test_source_abstract_methods_raise():
    with pytest.raises(TypeError):
        Source()
```

**Step 2: Run test to verify it fails**

Run: `cd scraper && python -m pytest tests/test_plugin_interface.py -v`
Expected: FAIL with "ModuleNotFoundError"

**Step 3: Write minimal implementation**

```python
# scraper/sources/plugin.py
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RawService:
    """Minimal service data returned by a source plugin."""
    name: str
    category: str
    source_url: str
    location: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    website_url: Optional[str] = None
    hours: Optional[str] = None
    description: Optional[str] = None
    eligibility: Optional[str] = None
    tags: Optional[list[str]] = None
    contact: Optional[str] = None
    extra: Optional[dict] = field(default_factory=dict)


class Source(ABC):
    """Base class for all source plugins. Subclasses implement discover()."""
    name: str = "unknown"
    url: str = ""

    @abstractmethod
    def discover(self, session, log, dry_run=False) -> list[RawService]:
        """Scrape the directory. Return basic service data. No AI."""
        ...

    def has_changed(self, service_id: str, last_hash: str) -> bool:
        """Check if source page changed since last scrape. Default: always True."""
        return True
```

**Step 4: Run test to verify it passes**

Run: `cd scraper && python -m pytest tests/test_plugin_interface.py -v`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add scraper/sources/plugin.py scraper/tests/test_plugin_interface.py
git commit -m "feat(scraper): add new Source plugin interface and RawService dataclass"
```

---

## Task 2: Database Schema Changes

**Files:**
- Modify: `scraper/models.py` (add fields to Service and ServiceIntakeDetails)
- Modify: `shared/schema.ts` (add corresponding TypeScript columns)
- Test: `scraper/tests/test_models.py`

**Step 1: Write the failing test**

```python
# scraper/tests/test_models.py
import pytest
from scraper.models import Service, ServiceIntakeDetails


def test_service_has_enrichment_fields():
    """New fields for change detection and enrichment tracking."""
    assert hasattr(Service, "enrichment_source")
    assert hasattr(Service, "enrichment_date")
    assert hasattr(Service, "source_page_hash")


def test_intake_details_has_inference_fields():
    """New fields to track inferred vs found data."""
    assert hasattr(ServiceIntakeDetails, "is_inferred")
    assert hasattr(ServiceIntakeDetails, "source_urls")
```

**Step 2: Run test to verify it fails**

Run: `cd scraper && python -m pytest tests/test_models.py -v`
Expected: FAIL with "AssertionError" (fields don't exist yet)

**Step 3: Add fields to models.py**

Add to `Service` model (after line 68 in `scraper/models.py`):

```python
    # Enrichment tracking
    enrichment_source = Column(String)       # "found", "verified", "inferred"
    enrichment_date = Column(DateTime)        # When AI enrichment last ran
    source_page_hash = Column(String)         # For change detection
```

Add to `ServiceIntakeDetails` model (after line 235 in `scraper/models.py`):

```python
    is_inferred = Column(Boolean, default=False)  # True if steps were AI-inferred
    source_urls = Column(JSON)                     # URLs backing the extraction
```

**Step 4: Add fields to shared/schema.ts**

Add to the `services` table definition (after the existing columns):

```typescript
  enrichmentSource: text("enrichment_source"),
  enrichmentDate: timestamp("enrichment_date"),
  sourcePageHash: text("source_page_hash"),
```

**Step 5: Run test to verify it passes**

Run: `cd scraper && python -m pytest tests/test_models.py -v`
Expected: PASS (2 tests)

**Step 6: Push schema changes**

Run: `npm run db:push`
Expected: Schema synced to database

**Step 7: Commit**

```bash
git add scraper/models.py shared/schema.ts scraper/tests/test_models.py
git commit -m "feat(scraper): add enrichment tracking and change detection fields to schema"
```

---

## Task 3: CRA Charities Alberta Source Plugin

**Files:**
- Create: `scraper/sources/cra_charities.py`
- Test: `scraper/tests/test_cra_charities.py`

**Step 1: Research the CRA charity search API**

Before writing code, use the fetch MCP tool or browser to inspect:
- URL: `https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch`
- Identify: form parameters, result format, pagination, category codes
- Determine if it returns HTML or JSON
- Find the Alberta province filter and category/designation codes

Document findings in a comment block at the top of the source file.

**Step 2: Write the failing test**

```python
# scraper/tests/test_cra_charities.py
import pytest
from unittest.mock import MagicMock, patch
from scraper.sources.cra_charities import CRACharitiesSource
from scraper.sources.plugin import RawService


def test_source_name():
    src = CRACharitiesSource()
    assert src.name == "cra_charities"


def test_relevance_filter_accepts_social_services():
    src = CRACharitiesSource()
    charity = {"designation": "Welfare", "programs": "addiction counselling, housing support"}
    assert src._is_relevant(charity) is True


def test_relevance_filter_rejects_sports_club():
    src = CRACharitiesSource()
    charity = {"designation": "Recreation", "programs": "golf tournaments, club memberships"}
    assert src._is_relevant(charity) is False


def test_relevance_filter_rejects_foundation_only():
    src = CRACharitiesSource()
    charity = {"designation": "Foundation", "programs": "granting funds to other organizations"}
    assert src._is_relevant(charity) is False


def test_discover_returns_raw_services(mock_cra_response):
    """Integration-style test with mocked HTTP responses."""
    src = CRACharitiesSource()
    session = MagicMock()
    log = MagicMock()
    results = src.discover(session, log, dry_run=True)
    assert all(isinstance(r, RawService) for r in results)
    assert all(r.category for r in results)


@pytest.fixture
def mock_cra_response(monkeypatch):
    """Mock the CRA search results page. Actual HTML structure TBD after Step 1 research."""
    # This fixture will be fleshed out after researching the CRA website structure
    pass
```

**Step 3: Implement the CRA source plugin**

```python
# scraper/sources/cra_charities.py
"""
CRA Charities Alberta Source Plugin

Scrapes the Canada Revenue Agency's registered charity database for Alberta-based
organizations providing social services. Applies relevance filtering to exclude
charities that don't provide direct services to people (e.g., sports clubs, arts orgs).

Source: https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch
"""
import hashlib
import requests
from bs4 import BeautifulSoup
from scraper.sources.plugin import Source, RawService

# CRA designation codes relevant to social services
RELEVANT_DESIGNATIONS = {
    "Welfare", "Health", "Education", "Community",
    "Religion",  # Many religious orgs run social programs
    "Indigenous",
}

# Keywords indicating direct social service delivery
RELEVANCE_KEYWORDS = {
    "addiction", "recovery", "mental health", "housing", "shelter",
    "food bank", "food hamper", "meals", "crisis", "counselling",
    "counseling", "disability", "newcomer", "immigrant", "refugee",
    "family services", "youth", "senior", "elder", "domestic violence",
    "women's shelter", "harm reduction", "detox", "rehabilitation",
    "poverty", "homelessness", "employment", "legal aid", "advocacy",
    "support group", "peer support", "respite", "palliative",
    "grief", "trauma", "abuse", "sexual assault",
}

# Keywords indicating non-relevant organizations
EXCLUSION_KEYWORDS = {
    "golf", "curling", "hockey", "sports league", "arts council",
    "museum", "gallery", "symphony", "opera", "theatre company",
    "animal", "veterinary", "kennel", "humane society",
    "private foundation",  # Foundations that only grant, don't serve
}


class CRACharitiesSource(Source):
    name = "cra_charities"
    url = "https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyBscSrch"

    RATE_LIMIT_SECONDS = 2
    TIMEOUT = 15

    def discover(self, session, log, dry_run=False) -> list[RawService]:
        """Scrape CRA charity search for Alberta-based social service charities."""
        # Implementation depends on CRA site structure (Step 1 research)
        # General approach:
        # 1. POST search form with province=Alberta
        # 2. Paginate through results
        # 3. For each charity, extract name, city, designation, programs
        # 4. Filter through _is_relevant()
        # 5. Convert to RawService
        raise NotImplementedError("Complete after CRA site research in Step 1")

    def _is_relevant(self, charity: dict) -> bool:
        """Filter out charities that aren't social service providers."""
        designation = charity.get("designation", "").strip()
        programs = charity.get("programs", "").lower()

        # Reject if explicitly excluded
        if any(kw in programs for kw in EXCLUSION_KEYWORDS):
            return False

        # Reject foundations that only grant money
        if "foundation" in designation.lower() and "granting" in programs:
            return False

        # Accept if designation is relevant AND has service keywords
        if designation in RELEVANT_DESIGNATIONS:
            if any(kw in programs for kw in RELEVANCE_KEYWORDS):
                return True

        # Accept if strong keyword match regardless of designation
        keyword_matches = sum(1 for kw in RELEVANCE_KEYWORDS if kw in programs)
        if keyword_matches >= 2:
            return True

        return False

    def _map_to_category(self, charity: dict) -> str:
        """Map CRA charity data to ResourceHub categories."""
        programs = charity.get("programs", "").lower()
        # Category mapping based on keyword presence
        if any(kw in programs for kw in ("addiction", "recovery", "detox", "harm reduction")):
            return "addiction"
        if any(kw in programs for kw in ("mental health", "counselling", "counseling", "trauma")):
            return "mental_health"
        if any(kw in programs for kw in ("housing", "shelter", "homelessness")):
            return "housing"
        if any(kw in programs for kw in ("food bank", "food hamper", "meals")):
            return "basic_needs"
        if any(kw in programs for kw in ("disability", "accessibility")):
            return "disability"
        if any(kw in programs for kw in ("crisis", "emergency", "domestic violence")):
            return "crisis"
        if any(kw in programs for kw in ("youth", "children")):
            return "youth"
        if any(kw in programs for kw in ("senior", "elder")):
            return "seniors"
        if any(kw in programs for kw in ("newcomer", "immigrant", "refugee")):
            return "newcomer"
        return "community_support"
```

**Step 4: Run tests to verify they pass**

Run: `cd scraper && python -m pytest tests/test_cra_charities.py -v`
Expected: PASS for relevance filter tests. `discover()` test skipped/xfail until CRA research done.

**Step 5: Commit**

```bash
git add scraper/sources/cra_charities.py scraper/tests/test_cra_charities.py
git commit -m "feat(scraper): add CRA Charities Alberta source plugin with relevance filtering"
```

**Step 6: Complete CRA scraping implementation**

After the Step 1 research reveals the CRA site's structure:
- Implement the actual `discover()` method
- Update the mock fixture in tests with real HTML structure
- Add pagination support
- Test with `--dry-run`

**Step 7: Commit**

```bash
git add scraper/sources/cra_charities.py scraper/tests/test_cra_charities.py
git commit -m "feat(scraper): implement CRA charity discovery with pagination and filtering"
```

---

## Task 4: Refactor Existing Sources to New Plugin Interface

**Files:**
- Modify: `scraper/sources/ab211_direct.py`
- Modify: `scraper/sources/ahs_findhealth.py`
- Modify: `scraper/sources/homeless_hub.py`
- Modify: `scraper/sources/acds.py`
- Modify: `scraper/sources/veterans_affairs.py`
- Test: `scraper/tests/test_source_refactors.py`

**Step 1: Write the failing test**

```python
# scraper/tests/test_source_refactors.py
import pytest
from scraper.sources.plugin import Source
from scraper.sources.ab211_direct import AB211DirectSource
from scraper.sources.ahs_findhealth import AHSFindHealthSource
from scraper.sources.homeless_hub import HomelessHubSource
from scraper.sources.acds import ACDSSource
from scraper.sources.veterans_affairs import VeteransAffairsSource


ALL_SOURCES = [
    AB211DirectSource,
    AHSFindHealthSource,
    HomelessHubSource,
    ACDSSource,
    VeteransAffairsSource,
]


@pytest.mark.parametrize("source_cls", ALL_SOURCES)
def test_source_inherits_plugin_interface(source_cls):
    assert issubclass(source_cls, Source)


@pytest.mark.parametrize("source_cls", ALL_SOURCES)
def test_source_has_name_and_url(source_cls):
    src = source_cls()
    assert src.name and src.name != "unknown"
    assert src.url and src.url.startswith("http")


@pytest.mark.parametrize("source_cls", ALL_SOURCES)
def test_source_has_discover_method(source_cls):
    src = source_cls()
    assert callable(src.discover)
```

**Step 2: Run test to verify it fails**

Run: `cd scraper && python -m pytest tests/test_source_refactors.py -v`
Expected: FAIL — existing sources inherit `BaseDirectoryScraper`, not `Source`

**Step 3: Refactor each source**

For each source file, the changes are:
1. Import `Source` and `RawService` from `scraper.sources.plugin`
2. Change class to inherit from `Source` instead of `BaseDirectoryScraper`
3. Rename `scrape()` → `discover()`, return `list[RawService]` instead of `list[dict]`
4. Keep all existing scraping logic (HTML parsing, Playwright for 211)
5. Remove session/log from `__init__`, accept them as `discover()` params instead

The internal scraping logic stays the same — only the interface changes. Each source keeps its existing HTTP/parsing code.

**Step 4: Run tests to verify they pass**

Run: `cd scraper && python -m pytest tests/test_source_refactors.py -v`
Expected: PASS (15 tests — 3 per source × 5 sources)

**Step 5: Run existing source tests to ensure no regression**

Run: `cd scraper && python -m pytest tests/ -v`
Expected: All existing tests still PASS (may need minor fixture updates for new signatures)

**Step 6: Commit**

```bash
git add scraper/sources/ scraper/tests/
git commit -m "refactor(scraper): migrate all source scrapers to new Source plugin interface"
```

---

## Task 5: Service Upserter (extracted from BaseDirectoryScraper)

**Files:**
- Create: `scraper/upserter.py`
- Test: `scraper/tests/test_upserter.py`

The current upsert logic lives in `BaseDirectoryScraper._upsert_service()` (base.py:134-159). Extract it into a standalone module so all sources share it without inheriting a base class.

**Step 1: Write the failing test**

```python
# scraper/tests/test_upserter.py
import pytest
from unittest.mock import MagicMock, patch
from scraper.upserter import upsert_service, compute_page_hash
from scraper.sources.plugin import RawService


def test_compute_page_hash():
    """Same content = same hash, different content = different hash."""
    assert compute_page_hash("hello") == compute_page_hash("hello")
    assert compute_page_hash("hello") != compute_page_hash("world")


def test_upsert_creates_new_service():
    """New service (no fuzzy match) gets inserted."""
    session = MagicMock()
    log = MagicMock()
    session.query.return_value.filter.return_value.all.return_value = []
    raw = RawService(name="New Service", category="addiction", source_url="https://example.com")
    result = upsert_service(session, log, raw, source_name="test", dry_run=True)
    assert result == "created"


def test_upsert_enriches_existing_service():
    """Existing service (fuzzy match) gets enriched, empty fields filled."""
    session = MagicMock()
    log = MagicMock()
    existing = MagicMock()
    existing.name = "New Service"
    existing.phone = None  # Empty — should be filled
    existing.email = "existing@email.com"  # Set — should NOT be overwritten
    session.query.return_value.filter.return_value.all.return_value = [existing]
    raw = RawService(
        name="New Service",
        category="addiction",
        source_url="https://example.com",
        phone="403-555-1234",
        email="new@email.com",  # Should NOT overwrite existing
    )
    result = upsert_service(session, log, raw, source_name="test", dry_run=True)
    assert result == "enriched"


def test_upsert_skips_unchanged():
    """Service whose source page hash hasn't changed gets skipped."""
    session = MagicMock()
    log = MagicMock()
    existing = MagicMock()
    existing.name = "Same Service"
    existing.source_page_hash = compute_page_hash("same content")
    session.query.return_value.filter.return_value.all.return_value = [existing]
    raw = RawService(name="Same Service", category="addiction", source_url="https://example.com")
    result = upsert_service(
        session, log, raw, source_name="test",
        page_content="same content", dry_run=True
    )
    assert result == "skipped"
```

**Step 2: Run test to verify it fails**

Run: `cd scraper && python -m pytest tests/test_upserter.py -v`
Expected: FAIL with "ModuleNotFoundError"

**Step 3: Implement upserter**

Extract and adapt logic from `scraper/sources/base.py:134-237` into `scraper/upserter.py`. Key functions:
- `compute_page_hash(content: str) -> str` — SHA256 of page content
- `upsert_service(session, log, raw: RawService, source_name: str, page_content: str = None, dry_run: bool = False) -> str` — returns "created", "enriched", or "skipped"
- `fuzzy_match(a: str, b: str) -> float` — extracted from `base.py:221-237`

Enrichment rule: only fill empty fields, never overwrite existing data.

**Step 4: Run test to verify it passes**

Run: `cd scraper && python -m pytest tests/test_upserter.py -v`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add scraper/upserter.py scraper/tests/test_upserter.py
git commit -m "feat(scraper): extract service upserter with change detection"
```

---

## Task 6: AI Enrichment Engine (Phase 2)

**Files:**
- Create: `scraper/enrichment.py`
- Modify: `scraper/claude_client.py` (add batch enrichment method)
- Test: `scraper/tests/test_enrichment.py`

This is the core of the redesign — the AI-powered enrichment that replaces deep crawl + extraction.

**Step 1: Write the failing test**

```python
# scraper/tests/test_enrichment.py
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from scraper.enrichment import (
    EnrichmentEngine,
    EnrichmentResult,
    should_enrich,
    batch_services_by_category,
)


def test_enrichment_result_schema():
    """EnrichmentResult has all required fields."""
    result = EnrichmentResult(
        service_id="svc-123",
        process_steps=[{"step": "Call intake", "action": "Phone", "details": "555-1234", "source_url": "https://example.com"}],
        required_docs=[{"document": "Health card", "context": "At intake", "source_url": "https://example.com"}],
        eligibility={"age_range": "18+", "gender": "all", "source_url": "https://example.com"},
        wait_times={"estimate": "2-4 weeks", "source_url": "https://example.com"},
        cost={"is_free": True, "source_url": "https://example.com"},
        confidence=85,
        enrichment_source="found",
        source_urls=["https://example.com"],
    )
    assert result.confidence == 85
    assert result.enrichment_source == "found"
    assert len(result.process_steps) == 1


def test_should_enrich_new_service():
    """Services with no enrichment date should be enriched."""
    svc = MagicMock()
    svc.enrichment_date = None
    svc.process_steps = None
    assert should_enrich(svc) is True


def test_should_enrich_stale_service():
    """Services enriched >90 days ago should be re-enriched."""
    from datetime import datetime, timedelta
    svc = MagicMock()
    svc.enrichment_date = datetime.now() - timedelta(days=91)
    svc.process_steps = None
    assert should_enrich(svc) is True


def test_should_not_enrich_recent_service():
    """Services enriched recently with data should be skipped."""
    from datetime import datetime, timedelta
    svc = MagicMock()
    svc.enrichment_date = datetime.now() - timedelta(days=10)
    svc.process_steps = [{"step": "Call"}]
    svc.enrichment_source = "found"
    assert should_enrich(svc) is False


def test_batch_services_by_category():
    """Services are grouped by category in batches of 5."""
    services = [MagicMock(category="addiction", name=f"Svc {i}") for i in range(12)]
    batches = batch_services_by_category(services, batch_size=5)
    assert len(batches) == 3  # 5 + 5 + 2
    assert len(batches[0]) == 5
    assert len(batches[2]) == 2


def test_inferred_never_overwrites_found():
    """Inferred data must not overwrite existing found/verified data."""
    svc = MagicMock()
    svc.enrichment_source = "found"
    svc.process_steps = [{"step": "Call intake"}]
    inferred = EnrichmentResult(
        service_id="svc-123",
        process_steps=[{"step": "Inferred step"}],
        confidence=35,
        enrichment_source="inferred",
    )
    # The engine should skip this update
    engine = EnrichmentEngine(claude_client=MagicMock())
    assert engine._should_apply(svc, inferred) is False
```

**Step 2: Run test to verify it fails**

Run: `cd scraper && python -m pytest tests/test_enrichment.py -v`
Expected: FAIL with "ModuleNotFoundError"

**Step 3: Implement EnrichmentResult dataclass**

```python
# scraper/enrichment.py
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional


@dataclass
class EnrichmentResult:
    """Structured result from AI enrichment of a service."""
    service_id: str
    process_steps: Optional[list[dict]] = None
    required_docs: Optional[list[dict]] = None
    eligibility: Optional[dict] = None
    wait_times: Optional[dict] = None
    cost: Optional[dict] = None
    confidence: int = 0
    enrichment_source: str = "found"  # "found", "verified", "inferred"
    source_urls: list[str] = field(default_factory=list)


STALE_THRESHOLD_DAYS = 90


def should_enrich(service) -> bool:
    """Determine if a service needs AI enrichment."""
    if service.enrichment_date is None:
        return True
    if service.process_steps is None or service.process_steps == []:
        return True
    age = datetime.now() - service.enrichment_date
    if age > timedelta(days=STALE_THRESHOLD_DAYS):
        return True
    return False


def batch_services_by_category(services, batch_size=5) -> list[list]:
    """Group services by category into batches for efficient API calls."""
    by_category = {}
    for svc in services:
        by_category.setdefault(svc.category, []).append(svc)

    batches = []
    for category, svcs in by_category.items():
        for i in range(0, len(svcs), batch_size):
            batches.append(svcs[i:i + batch_size])
    return batches


class EnrichmentEngine:
    """Orchestrates AI enrichment for services using Claude web search."""

    def __init__(self, claude_client, budget_limit: float = None):
        self.claude = claude_client
        self.budget_limit = budget_limit
        self.total_cost = 0.0
        self.stats = {"found": 0, "verified": 0, "inferred": 0, "skipped": 0}

    def _should_apply(self, existing_service, result: EnrichmentResult) -> bool:
        """Inferred data never overwrites found/verified data."""
        if result.enrichment_source == "inferred":
            if existing_service.enrichment_source in ("found", "verified"):
                return False
            if existing_service.process_steps and len(existing_service.process_steps) > 0:
                return False
        return True

    def enrich_batch(self, session, log, services: list, dry_run=False) -> list[EnrichmentResult]:
        """Enrich a batch of services (same category) with one Claude call."""
        if self.budget_limit and self.total_cost >= self.budget_limit:
            log.info(f"Budget limit ${self.budget_limit:.2f} reached. Stopping enrichment.")
            return []

        results = self.claude.batch_enrich_services(services)

        for result in results:
            # Track costs (estimate ~$0.01-0.02 per service in batch)
            self.total_cost += 0.015

        return results

    def enrich_service_inferred(self, session, log, service, similar_services: list) -> EnrichmentResult:
        """Last resort: infer process steps from similar services in same category."""
        result = self.claude.infer_from_similar(service, similar_services)
        result.enrichment_source = "inferred"
        result.confidence = min(result.confidence, 49)  # Cap at 49
        self.stats["inferred"] += 1
        return result
```

**Step 4: Run tests to verify they pass**

Run: `cd scraper && python -m pytest tests/test_enrichment.py -v`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add scraper/enrichment.py scraper/tests/test_enrichment.py
git commit -m "feat(scraper): add enrichment engine with batching, budget control, and inference guard"
```

---

## Task 7: Claude Client — Batch Enrichment Method

**Files:**
- Modify: `scraper/claude_client.py` (add `batch_enrich_services` and `infer_from_similar`)
- Test: `scraper/tests/test_claude_enrichment.py`

**Step 1: Write the failing test**

```python
# scraper/tests/test_claude_enrichment.py
import pytest
from unittest.mock import MagicMock, patch
from scraper.claude_client import ClaudeClient


def test_batch_enrich_prompt_includes_all_services():
    """The prompt sent to Claude should include all service names in the batch."""
    client = ClaudeClient.__new__(ClaudeClient)
    client.client = MagicMock()
    client.model = "claude-sonnet-4-5-20250929"

    services = [
        MagicMock(name="Service A", category="addiction", location="Calgary", website_url="https://a.com"),
        MagicMock(name="Service B", category="addiction", location="Edmonton", website_url="https://b.com"),
    ]

    # Mock the API response
    mock_response = MagicMock()
    mock_response.content = [MagicMock(type="tool_use", input={"services": [
        {"service_name": "Service A", "process_steps": [], "confidence": 40},
        {"service_name": "Service B", "process_steps": [], "confidence": 40},
    ]})]
    mock_response.usage = MagicMock(input_tokens=500, output_tokens=500)
    client.client.messages.create.return_value = mock_response

    results = client.batch_enrich_services(services)
    assert len(results) == 2

    # Verify the prompt included both services
    call_args = client.client.messages.create.call_args
    messages = call_args.kwargs.get("messages") or call_args[1].get("messages")
    prompt_text = messages[0]["content"]
    assert "Service A" in prompt_text
    assert "Service B" in prompt_text


def test_batch_enrich_uses_web_search_tool():
    """Claude should be given the web search tool for finding intake info."""
    client = ClaudeClient.__new__(ClaudeClient)
    client.client = MagicMock()
    client.model = "claude-sonnet-4-5-20250929"

    mock_response = MagicMock()
    mock_response.content = [MagicMock(type="tool_use", input={"services": []})]
    mock_response.usage = MagicMock(input_tokens=100, output_tokens=100)
    client.client.messages.create.return_value = mock_response

    client.batch_enrich_services([])

    call_args = client.client.messages.create.call_args
    tools = call_args.kwargs.get("tools") or call_args[1].get("tools")
    tool_names = [t.get("name") for t in tools if isinstance(t, dict)]
    # Should have the structured output tool
    assert any("enrich" in name.lower() for name in tool_names)
```

**Step 2: Run test to verify it fails**

Run: `cd scraper && python -m pytest tests/test_claude_enrichment.py -v`
Expected: FAIL — `batch_enrich_services` method doesn't exist

**Step 3: Implement batch_enrich_services in claude_client.py**

Add to `ClaudeClient` class (after `web_search_extract_steps` method, ~line 867):

Key implementation details:
- System prompt includes anti-hallucination instructions
- User prompt lists all services in batch with name, category, location, website
- Uses `tool_use` with a schema matching `EnrichmentResult` for each service
- Instructs Claude to use web search to find process steps, required docs, eligibility, wait times
- Source URL required for every field; null if not found
- Returns list of `EnrichmentResult` objects

Also add `infer_from_similar()` method:
- Takes a target service and list of similar services with known process steps
- Asks Claude to generate plausible steps based on the similar services
- Explicitly marks output as inferred

**Step 4: Run tests to verify they pass**

Run: `cd scraper && python -m pytest tests/test_claude_enrichment.py -v`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add scraper/claude_client.py scraper/tests/test_claude_enrichment.py
git commit -m "feat(scraper): add batch enrichment and inference methods to Claude client"
```

---

## Task 8: New Pipeline Orchestrator

**Files:**
- Create: `scraper/pipeline.py`
- Test: `scraper/tests/test_pipeline.py`

This replaces the 12-phase `run_scraper()` function in `scraper.py` (lines 1917-2017).

**Step 1: Write the failing test**

```python
# scraper/tests/test_pipeline.py
import pytest
from unittest.mock import MagicMock, patch
from scraper.pipeline import Pipeline, PipelineStats


def test_pipeline_stats_summary():
    stats = PipelineStats()
    stats.sources_scraped = 3
    stats.services_found = 100
    stats.new_services = 5
    stats.enriched_found = 10
    stats.enriched_verified = 3
    stats.enriched_inferred = 2
    stats.api_cost = 1.84
    summary = stats.summary()
    assert "100" in summary
    assert "$1.84" in summary


def test_pipeline_discover_phase():
    """Discover phase calls all registered source plugins."""
    pipeline = Pipeline(session=MagicMock(), log=MagicMock())
    mock_source = MagicMock()
    mock_source.name = "test_source"
    mock_source.discover.return_value = []
    pipeline.sources = [mock_source]
    pipeline.run_discover(dry_run=True)
    mock_source.discover.assert_called_once()


def test_pipeline_enrich_phase_respects_budget():
    """Enrich phase stops when budget is exceeded."""
    pipeline = Pipeline(session=MagicMock(), log=MagicMock(), budget=0.01)
    pipeline.enrichment_engine = MagicMock()
    pipeline.enrichment_engine.total_cost = 0.02  # Already over budget
    pipeline.enrichment_engine.budget_limit = 0.01
    # Should not call enrich_batch
    pipeline.run_enrich(dry_run=True)
    pipeline.enrichment_engine.enrich_batch.assert_not_called()


def test_pipeline_phases_run_in_order():
    """Full pipeline runs discover → enrich → finalize in order."""
    call_order = []
    pipeline = Pipeline(session=MagicMock(), log=MagicMock())
    pipeline.run_discover = lambda **kw: call_order.append("discover")
    pipeline.run_enrich = lambda **kw: call_order.append("enrich")
    pipeline.run_finalize = lambda **kw: call_order.append("finalize")
    pipeline.run(dry_run=True)
    assert call_order == ["discover", "enrich", "finalize"]
```

**Step 2: Run test to verify it fails**

Run: `cd scraper && python -m pytest tests/test_pipeline.py -v`
Expected: FAIL with "ModuleNotFoundError"

**Step 3: Implement pipeline orchestrator**

```python
# scraper/pipeline.py
"""
3-Phase Pipeline Orchestrator

Phase 1: Discover — scrape source directories (no AI)
Phase 2: Enrich — AI-powered extraction of process steps, eligibility, etc.
Phase 3: Finalize — embeddings, normalization, dedup, view refresh
"""
from dataclasses import dataclass, field
from datetime import datetime

from scraper.sources.plugin import Source
from scraper.enrichment import EnrichmentEngine, should_enrich, batch_services_by_category
from scraper.upserter import upsert_service


@dataclass
class PipelineStats:
    sources_scraped: int = 0
    services_found: int = 0
    new_services: int = 0
    updated_services: int = 0
    skipped_unchanged: int = 0
    enriched_found: int = 0
    enriched_verified: int = 0
    enriched_inferred: int = 0
    embeddings_generated: int = 0
    deduped: int = 0
    api_cost: float = 0.0
    duration_seconds: float = 0.0

    def summary(self) -> str:
        return f"""=== Scraper Run Summary ===
Sources scraped:    {self.sources_scraped}
Services found:     {self.services_found}
New services:       {self.new_services}
Updated services:   {self.updated_services}
Skipped (unchanged): {self.skipped_unchanged}

Enrichment:
  Found w/ source:  {self.enriched_found}
  Verified:         {self.enriched_verified}
  Inferred:         {self.enriched_inferred}
  API cost:         ${self.api_cost:.2f}

Embeddings:         {self.embeddings_generated}
Deduped:            {self.deduped}
Total cost:         ${self.api_cost:.2f}
Duration:           {self.duration_seconds / 60:.0f} minutes"""


class Pipeline:
    def __init__(self, session, log, budget: float = None):
        self.session = session
        self.log = log
        self.budget = budget
        self.stats = PipelineStats()
        self.sources: list[Source] = []
        self.enrichment_engine: EnrichmentEngine = None

    def register_source(self, source: Source):
        self.sources.append(source)

    def run(self, phase: str = None, dry_run=False, full=False, source_name: str = None):
        """Run the pipeline. Optionally run a single phase or source."""
        start = datetime.now()

        if phase is None or phase == "discover":
            self.run_discover(dry_run=dry_run, source_name=source_name)
        if phase is None or phase == "enrich":
            self.run_enrich(dry_run=dry_run, full=full)
        if phase is None or phase == "finalize":
            self.run_finalize(dry_run=dry_run)

        self.stats.duration_seconds = (datetime.now() - start).total_seconds()
        self.log.info(self.stats.summary())

    def run_discover(self, dry_run=False, source_name=None):
        """Phase 1: Scrape source directories."""
        for source in self.sources:
            if source_name and source.name != source_name:
                continue
            self.log.info(f"Discovering from {source.name}...")
            raw_services = source.discover(self.session, self.log, dry_run=dry_run)
            self.stats.services_found += len(raw_services)
            self.stats.sources_scraped += 1

            for raw in raw_services:
                result = upsert_service(self.session, self.log, raw, source.name, dry_run=dry_run)
                if result == "created":
                    self.stats.new_services += 1
                elif result == "enriched":
                    self.stats.updated_services += 1
                elif result == "skipped":
                    self.stats.skipped_unchanged += 1

    def run_enrich(self, dry_run=False, full=False):
        """Phase 2: AI enrichment of process steps, eligibility, etc."""
        if not self.enrichment_engine:
            return
        if self.enrichment_engine.budget_limit and self.enrichment_engine.total_cost >= self.enrichment_engine.budget_limit:
            self.log.info("Budget already exceeded. Skipping enrichment.")
            return

        # Query services needing enrichment
        # (actual DB query will go here)
        # For now, this is the orchestration structure

    def run_finalize(self, dry_run=False):
        """Phase 3: Embeddings, normalization, dedup, view refresh."""
        # Reuse existing phase functions:
        # - phase_normalize_contacts (scraper.py:1463)
        # - phase_enhance_tags (scraper.py:1520)
        # - phase_generate_embeddings (scraper.py:1580)
        # - phase_dedupe_services (scraper.py:1666)
        # - phase_refresh_views (scraper.py:1757)
        pass
```

**Step 4: Run tests to verify they pass**

Run: `cd scraper && python -m pytest tests/test_pipeline.py -v`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add scraper/pipeline.py scraper/tests/test_pipeline.py
git commit -m "feat(scraper): add 3-phase pipeline orchestrator"
```

---

## Task 9: New CLI Entry Point

**Files:**
- Modify: `scraper/scraper.py` (replace argparse and main function)
- Test: `scraper/tests/test_cli.py`

**Step 1: Write the failing test**

```python
# scraper/tests/test_cli.py
import pytest
from unittest.mock import patch, MagicMock


def test_cli_accepts_new_phase_args():
    """New CLI accepts --phase discover/enrich/finalize."""
    with patch("sys.argv", ["scraper.py", "--phase", "discover"]):
        from scraper.scraper import parse_args
        args = parse_args()
        assert args.phase == "discover"


def test_cli_accepts_budget_flag():
    with patch("sys.argv", ["scraper.py", "--phase", "enrich", "--budget", "5.00"]):
        from scraper.scraper import parse_args
        args = parse_args()
        assert args.budget == 5.00


def test_cli_accepts_source_flag():
    with patch("sys.argv", ["scraper.py", "--source", "cra_charities"]):
        from scraper.scraper import parse_args
        args = parse_args()
        assert args.source == "cra_charities"


def test_cli_accepts_enrich_service():
    with patch("sys.argv", ["scraper.py", "--enrich-service", "Some Service Name"]):
        from scraper.scraper import parse_args
        args = parse_args()
        assert args.enrich_service == "Some Service Name"
```

**Step 2: Run test to verify it fails**

Run: `cd scraper && python -m pytest tests/test_cli.py -v`
Expected: FAIL — `parse_args` doesn't exist or has old args

**Step 3: Implement new CLI**

Replace the argparse block in `scraper.py` (lines 2020-2048) with:

```python
def parse_args():
    parser = argparse.ArgumentParser(description="ResourceHub Scraper v2")
    parser.add_argument("--phase", choices=["discover", "enrich", "finalize"],
                        help="Run a single phase (default: all)")
    parser.add_argument("--source", type=str,
                        help="Run only this source plugin (e.g. 211_alberta, cra_charities)")
    parser.add_argument("--budget", type=float,
                        help="Stop enrichment after this dollar amount")
    parser.add_argument("--full", action="store_true",
                        help="Re-enrich all services, not just new/stale")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview changes without saving")
    parser.add_argument("--enrich-service", type=str,
                        help="Enrich a single service by name (for testing)")
    return parser.parse_args()
```

Replace the main execution block (lines 2041-2048) to instantiate `Pipeline`, register all sources, and call `pipeline.run()`.

**Step 4: Run tests to verify they pass**

Run: `cd scraper && python -m pytest tests/test_cli.py -v`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add scraper/scraper.py scraper/tests/test_cli.py
git commit -m "feat(scraper): replace 12-phase CLI with 3-phase pipeline CLI"
```

---

## Task 10: Wire Finalize Phase to Existing Functions

**Files:**
- Modify: `scraper/pipeline.py` (implement `run_finalize`)
- Modify: `scraper/scraper.py` (extract phase functions into importable module)
- Test: `scraper/tests/test_finalize.py`

**Step 1: Extract reusable phase functions**

Move these functions from `scraper.py` into a new `scraper/finalize.py`:
- `phase_normalize_contacts` (scraper.py:1463-1518)
- `phase_enhance_tags` (scraper.py:1520-1578)
- `phase_generate_embeddings` (scraper.py:1580-1664)
- `phase_dedupe_services` (scraper.py:1666-1706)
- `phase_refresh_views` (scraper.py:1757-1766)

These functions already work — just move them to a separate module so `pipeline.py` can import them.

**Step 2: Write the test**

```python
# scraper/tests/test_finalize.py
import pytest
from scraper.finalize import (
    phase_normalize_contacts,
    phase_enhance_tags,
    phase_generate_embeddings,
    phase_dedupe_services,
    phase_refresh_views,
)


def test_finalize_functions_importable():
    """All finalize functions are importable from the finalize module."""
    assert callable(phase_normalize_contacts)
    assert callable(phase_enhance_tags)
    assert callable(phase_generate_embeddings)
    assert callable(phase_dedupe_services)
    assert callable(phase_refresh_views)
```

**Step 3: Run test, verify pass after extraction**

Run: `cd scraper && python -m pytest tests/test_finalize.py -v`

**Step 4: Wire into pipeline.py**

Update `Pipeline.run_finalize()` to call each function in order.

**Step 5: Commit**

```bash
git add scraper/finalize.py scraper/pipeline.py scraper/scraper.py scraper/tests/test_finalize.py
git commit -m "refactor(scraper): extract finalize phases into importable module"
```

---

## Task 11: Integration Test — Full Pipeline Dry Run

**Files:**
- Create: `scraper/tests/test_integration.py`

**Step 1: Write integration test**

```python
# scraper/tests/test_integration.py
import pytest
from unittest.mock import MagicMock, patch
from scraper.pipeline import Pipeline
from scraper.sources.plugin import Source, RawService


class FakeSource(Source):
    name = "fake"
    url = "https://fake.com"

    def discover(self, session, log, dry_run=False):
        return [
            RawService(name="Fake Service 1", category="addiction", source_url="https://fake.com/1"),
            RawService(name="Fake Service 2", category="housing", source_url="https://fake.com/2"),
        ]


def test_full_pipeline_dry_run():
    """Full pipeline runs all 3 phases without errors in dry-run mode."""
    session = MagicMock()
    log = MagicMock()
    session.query.return_value.filter.return_value.all.return_value = []

    pipeline = Pipeline(session=session, log=log)
    pipeline.register_source(FakeSource())
    pipeline.run(dry_run=True)

    assert pipeline.stats.sources_scraped == 1
    assert pipeline.stats.services_found == 2


def test_single_source_run():
    """Running with --source only executes that source."""
    session = MagicMock()
    log = MagicMock()
    session.query.return_value.filter.return_value.all.return_value = []

    source_a = FakeSource()
    source_a.name = "source_a"
    source_b = FakeSource()
    source_b.name = "source_b"
    source_b.discover = MagicMock(return_value=[])

    pipeline = Pipeline(session=session, log=log)
    pipeline.register_source(source_a)
    pipeline.register_source(source_b)
    pipeline.run(source_name="source_a", dry_run=True)

    assert pipeline.stats.sources_scraped == 1
    source_b.discover.assert_not_called()
```

**Step 2: Run integration test**

Run: `cd scraper && python -m pytest tests/test_integration.py -v`
Expected: PASS (2 tests)

**Step 3: Commit**

```bash
git add scraper/tests/test_integration.py
git commit -m "test(scraper): add integration tests for new pipeline"
```

---

## Task 12: Cleanup — Remove Dead Code

**Files:**
- Modify: `scraper/scraper.py` (remove old phase functions and run modes)
- Modify: `scraper/models.py` (drop WebsiteCrawl and CrawledPage models)
- Remove: `scraper/sources/base.py` (replaced by `plugin.py` + `upserter.py`)

**Step 1: Identify dead code**

Old functions to remove from `scraper.py`:
- `phase_211_discovery` (lines 915-960)
- `phase_211_enrich` (lines 962-994)
- `phase_website_enrich` (lines 996-1033)
- `phase_deep_crawl` (lines 1035-1122)
- `phase_enhanced_extraction` (lines 1124-1416)
- `phase_informalberta_enrich` (lines 1418-1449)
- `run_daily_refresh` (lines 1773-1857)
- `run_quick_test` (lines 1859-1910)
- Old `run_scraper` function (lines 1917-2017)
- Old argparse block (lines 2020-2048)
- Helper functions only used by removed phases

Models to remove from `models.py`:
- `WebsiteCrawl` (lines 145-171)
- `CrawledPage` (lines 173-198)

**Step 2: Remove dead code**

Work through each file, removing the identified functions/classes. Keep `scraper.py` helper functions that are reused by finalize phases (e.g., `update_service_confidence`).

**Step 3: Run full test suite**

Run: `cd scraper && python -m pytest tests/ -v`
Expected: All tests PASS. Some old test files may need updating if they referenced removed code.

**Step 4: Commit**

```bash
git add scraper/
git commit -m "refactor(scraper): remove 12-phase pipeline code, deep crawl models, and old base class"
```

---

## Task 13: End-to-End Test with Real CRA Source

**Step 1:** Run the CRA source in dry-run mode:

```bash
cd scraper && python scraper.py --source cra_charities --dry-run
```

Verify: services discovered, relevance filter working, no crashes.

**Step 2:** Run full pipeline dry-run:

```bash
cd scraper && python scraper.py --dry-run
```

Verify: all sources discovered, summary output looks correct.

**Step 3:** Run enrichment on a single service:

```bash
cd scraper && python scraper.py --enrich-service "Calgary Alpha House" --dry-run
```

Verify: Claude returns process steps with source URLs, confidence scores look reasonable.

**Step 4:** Commit any fixes discovered during E2E testing.

---

## Summary

| Task | Description | New Files | Est. Time |
|------|-------------|-----------|-----------|
| 1 | Source plugin interface | `plugin.py`, test | Small |
| 2 | Database schema changes | models.py, schema.ts | Small |
| 3 | CRA Charities source | `cra_charities.py`, test | Medium |
| 4 | Refactor existing sources | 5 source files, test | Medium |
| 5 | Service upserter | `upserter.py`, test | Small |
| 6 | Enrichment engine | `enrichment.py`, test | Medium |
| 7 | Claude batch enrichment | `claude_client.py`, test | Medium |
| 8 | Pipeline orchestrator | `pipeline.py`, test | Medium |
| 9 | New CLI | `scraper.py`, test | Small |
| 10 | Wire finalize phase | `finalize.py`, test | Small |
| 11 | Integration tests | test | Small |
| 12 | Dead code cleanup | removals | Small |
| 13 | E2E testing | — | Medium |
