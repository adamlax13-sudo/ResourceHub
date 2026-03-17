# Crawl4AI Scraper Modernization — Design Spec

## Context

ResourceHub's scraper has 7 hand-coded source plugins using a patchwork of `requests`, BeautifulSoup, and Playwright. Key problems:

- **No JS rendering** except for 211 Alberta (which uses raw Playwright)
- **No unified fetching layer** — each plugin handles its own HTTP, rate limiting, retries
- **Unused deep_crawler** (~1,050 lines) that's barely integrated into the pipeline
- **Enrichment can't handle JS-heavy sites** — Claude extraction fails when content isn't in static HTML
- **Adding new sources requires writing Python plugins** — high friction for expanding coverage
- **20 known data gaps** (dental, LGBTQ, caregiver services) with no efficient way to fill them

**Solution:** Integrate Crawl4AI as a unified web fetching backend. Crawl4AI fetches and converts to markdown; Claude extracts structured data from that markdown. The existing enrichment pipeline, confidence scoring, upserter, and finalize phases remain untouched.

## Decisions

- Crawl4AI as **fetcher only** — Claude stays as extraction brain
- **Big bang rewrite** of all 7 source plugins
- **Hybrid discovery**: config-driven sources (YAML) + autonomous seed-URL crawler
- **Keep DB schema as-is** — changes are scraper-layer only
- **Fetcher abstraction layer**: `CrawlBackend` wraps Crawl4AI, injected into plugins + enrichment

---

## 1. CrawlBackend Abstraction (`scraper/backends/`)

### File Structure

```
scraper/backends/
    __init__.py              # Exports CrawlBackend, CrawlPage, CrawlSiteResult, CrawlConfig
    interface.py             # Abstract base class + data types
    crawl4ai_backend.py      # Crawl4AI implementation
```

### Interface (`scraper/backends/interface.py`)

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, Dict, List
from enum import Enum


# Reuse deep_crawler's PageType directly to avoid enum duplication
from deep_crawler.page_classifier import PageType


@dataclass
class CrawlPage:
    """Result of crawling a single page."""
    url: str
    status_code: int
    markdown: str                          # Clean markdown from Crawl4AI
    html: str                              # Original HTML
    text: str                              # Plain text extraction
    links_internal: List[Dict[str, str]]   # [{href, text, title}]
    links_external: List[Dict[str, str]]
    page_type: PageType = PageType.UNKNOWN
    error: Optional[str] = None
    depth: int = 0
    crawl_time_seconds: float = 0.0


@dataclass
class CrawlSiteResult:
    """Result of a multi-page site crawl."""
    base_url: str
    pages: Dict[str, CrawlPage]           # url -> CrawlPage
    total_pages: int
    duration_seconds: float
    errors: List[str] = field(default_factory=list)

    def get_pages_by_type(self, page_type: PageType) -> List[CrawlPage]:
        return [p for p in self.pages.values() if p.page_type == page_type]

    def get_valuable_pages(self) -> List[CrawlPage]:
        valuable = {PageType.INTAKE, PageType.ELIGIBILITY, PageType.SERVICES,
                     PageType.PROGRAM, PageType.CONTACT}
        return [p for p in self.pages.values() if p.page_type in valuable]

    def get_all_markdown(self, max_pages: int = 5, max_chars: int = 15000) -> str:
        """Concatenate markdown from valuable pages, formatted for Claude."""
        pages = self.get_valuable_pages() or list(self.pages.values())[:max_pages]
        parts = []
        total = 0
        for p in pages[:max_pages]:
            chunk = f"\n\n=== FROM {p.url} ===\n{p.markdown}"
            if total + len(chunk) > max_chars:
                chunk = chunk[:max_chars - total]
            parts.append(chunk)
            total += len(chunk)
            if total >= max_chars:
                break
        return "".join(parts)


@dataclass
class CrawlConfig:
    """Per-crawl configuration."""
    js_rendering: bool = True
    timeout_seconds: int = 30
    max_depth: int = 2
    max_pages: int = 15
    request_delay_seconds: float = 2.0
    user_agent: Optional[str] = None
    wait_for_selector: Optional[str] = None   # CSS selector to wait for
    js_code: Optional[str] = None              # JS to execute before extraction
    cache_mode: str = "bypass"                 # "bypass" or "enabled"
    viewport_width: int = 1280
    viewport_height: int = 800


class CrawlBackend(ABC):
    """Abstract interface for web crawling backends."""

    @abstractmethod
    def fetch_page(self, url: str, config: Optional[CrawlConfig] = None) -> CrawlPage:
        """Fetch a single page. Returns markdown + HTML + metadata."""
        ...

    @abstractmethod
    def crawl_site(self, url: str, config: Optional[CrawlConfig] = None) -> CrawlSiteResult:
        """Multi-page crawl starting from url. Follows internal links."""
        ...

    @abstractmethod
    def fetch_pages(self, urls: List[str], config: Optional[CrawlConfig] = None) -> List[CrawlPage]:
        """Fetch multiple independent URLs concurrently."""
        ...

    @abstractmethod
    def close(self):
        """Release browser resources."""
        ...
```

### Crawl4AI Implementation (`scraper/backends/crawl4ai_backend.py`)

**Key design decisions:**

1. **Async-to-sync bridge**: Dedicated `asyncio` event loop in a background thread. The browser stays alive across all pipeline calls, avoiding repeated cold starts. The threaded approach avoids "event loop already running" issues.

2. **Page classification**: Crawl4AI doesn't classify pages by type. We preserve `PageClassifier` from `deep_crawler/page_classifier.py` (regex-only, no AI fallback — zero API cost).

3. **Deep crawling**: Use `BestFirstCrawlingStrategy` (NOT BFS) with a `KeywordRelevanceScorer` configured with service-relevant keywords. Combined with `URLPatternFilter` to skip donate/career/news pages. Deep crawl is triggered via `arun()` with `deep_crawl_strategy` in `CrawlerRunConfig`, which returns `List[CrawlResult]`.

4. **URL filtering**: `FilterChain` with `URLPatternFilter` excludes low-value URLs (donate, career, news, PDF, social media) — more efficient than scoring everything.

5. **SSRF protection**: Existing `utils.is_safe_url()` called before every URL.

6. **Robots.txt**: Crawl4AI respects robots.txt natively.

```python
import asyncio
import logging
import threading
import time
from typing import Optional, List, Dict

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from crawl4ai.deep_crawling import BestFirstCrawlingStrategy
from crawl4ai.deep_crawling.scorers import KeywordRelevanceScorer
from crawl4ai.deep_crawling.filters import FilterChain, URLPatternFilter

from backends.interface import (
    CrawlBackend, CrawlPage, CrawlSiteResult, CrawlConfig, PageType
)
from deep_crawler.page_classifier import PageClassifier
from utils import is_safe_url

logger = logging.getLogger(__name__)

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (compatible; ResourceHubBot/3.0; "
    "+https://github.com/resourcehub; respectful crawler for social services)"
)

# Keywords for BestFirstCrawlingStrategy scorer
SERVICE_KEYWORDS = [
    "apply", "intake", "eligibility", "services", "programs",
    "treatment", "support", "counselling", "contact", "hours",
    "referral", "requirements", "how to", "get help",
]

# URL glob patterns to EXCLUDE (URLPatternFilter uses glob, not regex)
SKIP_URL_PATTERNS = [
    "*/donate*", "*/career*", "*/job*", "*/volunteer*",
    "*/news*", "*/blog*", "*/press*", "*/media*",
    "*/privacy*", "*/terms*", "*/login*", "*/admin*",
    "*.pdf", "*.doc", "*.xls",
    "*facebook.com*", "*twitter.com*", "*instagram.com*",
    "*linkedin.com*", "*youtube.com*",
]


class Crawl4AIBackend(CrawlBackend):

    def __init__(self, default_config: Optional[CrawlConfig] = None):
        self._default_config = default_config or CrawlConfig()
        self._page_classifier = PageClassifier(openai_client=None)  # regex only
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None
        self._crawler: Optional[AsyncWebCrawler] = None
        self._started = False

    def _ensure_started(self):
        """Lazily start the event loop and browser."""
        if self._started:
            return
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._loop.run_forever, daemon=True)
        self._thread.start()
        future = asyncio.run_coroutine_threadsafe(self._start_crawler(), self._loop)
        future.result(timeout=60)
        self._started = True

    async def _start_crawler(self):
        cfg = self._default_config
        browser_config = BrowserConfig(
            headless=True,
            user_agent=cfg.user_agent or DEFAULT_USER_AGENT,
            viewport_width=cfg.viewport_width,
            viewport_height=cfg.viewport_height,
            verbose=False,
        )
        self._crawler = AsyncWebCrawler(config=browser_config)
        await self._crawler.__aenter__()

    def _run_async(self, coro, timeout=300):
        """Run an async coroutine from sync code."""
        self._ensure_started()
        future = asyncio.run_coroutine_threadsafe(coro, self._loop)
        return future.result(timeout=timeout)

    def _make_run_config(self, config: CrawlConfig) -> CrawlerRunConfig:
        return CrawlerRunConfig(
            cache_mode=CacheMode.BYPASS if config.cache_mode == "bypass"
                       else CacheMode.ENABLED,
            wait_for=config.wait_for_selector,
            js_code=config.js_code,
            word_count_threshold=50,
        )

    def _classify_page(self, url: str, html: str, text: str,
                       is_homepage: bool = False) -> PageType:
        classification = self._page_classifier.classify(
            url=url, html=html, text=text, is_homepage=is_homepage
        )
        return classification.page_type  # Same PageType enum, no conversion

    def _result_to_page(self, result, depth: int = 0,
                        is_homepage: bool = False) -> CrawlPage:
        if not result.success:
            return CrawlPage(
                url=result.url, status_code=result.status_code or 0,
                markdown="", html="", text="",
                links_internal=[], links_external=[],
                error=result.error_message, depth=depth,
            )

        md = str(result.markdown) if result.markdown else ""
        html = result.html or ""
        # Use markdown as plain text (cleaned_html still has tags)
        text = md

        page_type = self._classify_page(
            result.url, html, text, is_homepage=is_homepage
        )

        return CrawlPage(
            url=result.url,
            status_code=result.status_code or 200,
            markdown=md,
            html=html,
            text=text[:10000],
            links_internal=result.links.get("internal", []) if result.links else [],
            links_external=result.links.get("external", []) if result.links else [],
            page_type=page_type,
            depth=depth,
        )

    def fetch_page(self, url: str, config: Optional[CrawlConfig] = None) -> CrawlPage:
        """Single page fetch — NO deep crawl strategy."""
        if not is_safe_url(url):
            return CrawlPage(
                url=url, status_code=0, markdown="", html="", text="",
                links_internal=[], links_external=[],
                error=f"SSRF blocked: {url}",
            )
        cfg = config or self._default_config
        run_config = self._make_run_config(cfg)

        async def _fetch():
            return await self._crawler.arun(url, config=run_config)

        result = self._run_async(_fetch(), timeout=cfg.timeout_seconds + 10)
        return self._result_to_page(result, depth=0, is_homepage=True)

    def crawl_site(self, url: str, config: Optional[CrawlConfig] = None) -> CrawlSiteResult:
        """Multi-page crawl using BestFirstCrawlingStrategy."""
        if not is_safe_url(url):
            return CrawlSiteResult(
                base_url=url, pages={}, total_pages=0,
                duration_seconds=0, errors=[f"SSRF blocked: {url}"]
            )
        cfg = config or self._default_config
        start = time.time()

        # BestFirst prioritizes pages with service-relevant keywords
        scorer = KeywordRelevanceScorer(
            keywords=SERVICE_KEYWORDS,
            weight=1.0,
            case_sensitive=False,
        )
        # Filter out low-value URLs (reverse=True = exclude matching URLs)
        url_filter = FilterChain([
            URLPatternFilter(patterns=SKIP_URL_PATTERNS, reverse=True),
        ])

        strategy = BestFirstCrawlingStrategy(
            max_depth=cfg.max_depth,
            include_external=False,
            url_scorer=scorer,
            max_pages=cfg.max_pages,
            filter_chain=url_filter,  # Wire filter into strategy
        )

        run_config = CrawlerRunConfig(
            deep_crawl_strategy=strategy,
            cache_mode=CacheMode.BYPASS if cfg.cache_mode == "bypass"
                       else CacheMode.ENABLED,
            wait_for=cfg.wait_for_selector,
            word_count_threshold=50,
        )

        async def _crawl():
            # arun() with deep_crawl_strategy returns List[CrawlResult]
            return await self._crawler.arun(url, config=run_config)

        # Fixed timeout: deep crawls have internal concurrency, not sequential
        raw_results = self._run_async(_crawl(), timeout=300)

        # raw_results is a list when deep_crawl_strategy is set
        if not isinstance(raw_results, list):
            raw_results = [raw_results]

        pages: Dict[str, CrawlPage] = {}
        errors: List[str] = []
        for i, r in enumerate(raw_results):
            depth = r.metadata.get("depth", 0) if r.metadata else 0
            page = self._result_to_page(r, depth=depth, is_homepage=(i == 0))
            if page.error:
                errors.append(f"{page.url}: {page.error}")
            else:
                pages[page.url] = page

        return CrawlSiteResult(
            base_url=url,
            pages=pages,
            total_pages=len(pages),
            duration_seconds=time.time() - start,
            errors=errors,
        )

    def fetch_pages(self, urls: List[str],
                    config: Optional[CrawlConfig] = None) -> List[CrawlPage]:
        """Batch fetch independent URLs via arun_many."""
        safe_urls = [u for u in urls if is_safe_url(u)]
        if not safe_urls:
            return []
        cfg = config or self._default_config
        run_config = self._make_run_config(cfg)

        async def _fetch_all():
            # arun_many for concurrent independent fetches
            return await self._crawler.arun_many(safe_urls, config=run_config)

        raw_results = self._run_async(_fetch_all(), timeout=cfg.timeout_seconds * len(safe_urls))
        return [self._result_to_page(r) for r in raw_results]

    def close(self):
        if self._crawler and self._loop:
            future = asyncio.run_coroutine_threadsafe(
                self._crawler.__aexit__(None, None, None), self._loop
            )
            future.result(timeout=30)
        if self._loop:
            self._loop.call_soon_threadsafe(self._loop.stop)
        if self._thread:
            self._thread.join(timeout=10)
        self._started = False
```

---

## 2. Source Plugin Rewrites

### Updated Base Class (`scraper/sources/plugin.py`)

```python
class Source(ABC):
    name: str = "unknown"
    url: str = ""
    backend: Optional['CrawlBackend'] = None  # Injected by Pipeline

    @abstractmethod
    def discover(self, session, log, dry_run=False) -> list[RawService]:
        ...

    def has_changed(self, service_id: str, last_hash: str) -> bool:
        """Optional: Check if source page changed since last scrape."""
        return True
```

`RawService` dataclass stays unchanged. Additions: `backend` property + preserved `has_changed()` method.

### Per-Plugin Strategy

| Plugin | Current | Rewrite | Why |
|--------|---------|---------|-----|
| ab211_direct | Playwright | Full rewrite → `backend.fetch_page()` | Replace raw Playwright with Crawl4AI's stealth Chromium |
| ahs_findhealth | requests POST | Hybrid — initial GET via backend, form POST stays as `requests` | ViewState forms are too complex for `js_code` |
| homeless_hub | requests + Algolia | Partial — community profiles via backend, Algolia API stays as `requests` | API calls aren't web scraping |
| acds | requests | Trivial swap → `backend.fetch_page()` | Simple HTML, unified fetching |
| veterans_affairs | requests | Trivial swap → `backend.fetch_page()` | Same as ACDS |
| cra_charities | requests (CSV) | **No change** | CSV download, not web scraping |
| university_wellness | Static list | **No change** | No web fetching at all |

### Example: ab211_direct rewrite

```python
class AB211DirectSource(Source):
    name = "211_direct"
    url = "https://ab.211.ca/"

    def discover(self, session, log, dry_run=False) -> list[RawService]:
        config = CrawlConfig(
            js_rendering=True,
            timeout_seconds=30,
            request_delay_seconds=3.0,
            wait_for_selector=".result-item, .listing-item",
        )

        topics_page = self.backend.fetch_page("https://ab.211.ca/how-we-help/", config)
        if topics_page.error:
            log.error(f"[211Direct] Failed: {topics_page.error}")
            return []

        topic_urls = self._extract_topic_links(topics_page)
        results = []
        for topic_url, topic_name in topic_urls:
            page = self.backend.fetch_page(topic_url, config)
            if page.error:
                continue
            results.extend(self._extract_listings_from_html(page.html, topic_name))
        return results
```

### Example: simple plugin rewrite (ACDS)

```python
class ACDSSource(Source):
    name = "acds"

    def discover(self, session, log, dry_run=False) -> list[RawService]:
        page = self.backend.fetch_page(ACDS_MEMBERS_URL, CrawlConfig(
            js_rendering=False,
            timeout_seconds=15,
        ))
        if page.error:
            log.error(f"Failed to fetch ACDS: {page.error}")
            return []
        soup = BeautifulSoup(page.html, "html.parser")
        return self.parse_members(soup)  # parsing logic unchanged
```

---

## 3. Config-Driven Sources (`scraper/sources/config_source.py`)

Define new sources via YAML instead of Python code.

### Config format (`scraper/sources/configs/*.yaml`)

```yaml
name: "example_directory"
url: "https://example.org/services"
category: "Social Services"

crawl:
  js_rendering: true
  wait_for_selector: ".service-card"
  max_pages: 1
  request_delay: 2.0

listing:
  container: ".service-card, .listing-item"
  fields:
    name:
      selector: "h3, h4, .title"
      attribute: "text"
    description:
      selector: ".description, .summary, p"
      attribute: "text"
    phone:
      selector: "a[href^='tel:'], .phone"
      attribute: "text"
    website_url:
      selector: "a.external-link"
      attribute: "href"

pagination:
  next_selector: "a.next-page"
  max_pages: 10

location:
  default: "Alberta"
  city_detection: true

tags: ["community", "directory"]
```

### Implementation

`ConfigDrivenSource` class:
- Loads YAML config on init
- `discover()` uses `self.backend.fetch_page()` with config-specified `CrawlConfig`
- Extracts listings via BeautifulSoup with config-specified CSS selectors
- Handles pagination by following `next_selector` links
- Auto-detects city from address field using `CITY_PATTERNS` dict
- `load_config_sources()` function loads all `*.yaml` from `configs/` directory

---

## 4. Autonomous Discovery (`scraper/sources/autonomous_source.py`)

Given a seed URL + org name, deep crawl the site and extract services.

### Flow

1. `crawl_site()` with `BestFirstCrawlingStrategy` (max_depth=2, max_pages=20)
2. Classify all pages via `PageClassifier`
3. Extract contact info from CONTACT pages (regex — phone/email from markdown)
4. SERVICES/PROGRAM pages → return as org-level `RawService` entries
5. Enrichment phase later handles detailed extraction via Claude

**Important**: Autonomous discover does NOT call Claude. It creates org-level entries with the page markdown as description. The enrichment phase handles structured extraction (process_steps, eligibility, etc.), preserving the "discover = no AI cost" principle.

### Interface

```python
@dataclass
class SeedConfig:
    url: str
    organization_name: str
    default_category: str = "Social Services"
    default_location: str = "Alberta"
    max_depth: int = 2
    max_pages: int = 20
    tags: list = None


class AutonomousSource(Source):
    name = "autonomous"

    def __init__(self, seeds: List[SeedConfig]):
        self._seeds = seeds

    def discover(self, session, log, dry_run=False) -> list[RawService]:
        # For each seed:
        # 1. backend.crawl_site(seed.url, config)
        # 2. Extract contact info from CONTACT pages (regex only)
        # 3. For SERVICES/PROGRAM pages, create RawService with page markdown
        # 4. If no service pages found, create single org-level entry
        ...
```

### CLI Integration

```bash
python scraper.py --seed-url https://example.org --seed-name "Example Org"
```

---

## 5. Enrichment Integration

### What Changes

The enrichment pipeline currently uses two code paths in `enrich_process_steps.py`:
- **Tier 1**: `DeepCrawler` (barely used) + Claude extraction
- **Tier 2**: DuckDuckGo search + `fetch_page_content()` + Claude extraction

Both are updated to use `CrawlBackend`:

**Tier 1** (`tier1_website_crawl`):
- `backend.crawl_site(service.website_url)` replaces `DeepCrawler`
- `CrawlSiteResult.get_all_markdown()` produces Claude-ready content
- Markdown output is cleaner than old BeautifulSoup `get_text()`, improving extraction quality

**Tier 2** (`tier2_web_search`):
- After DuckDuckGo search returns URLs, `backend.fetch_pages(urls)` batch-fetches concurrently
- Replaces `fetch_page_content()` with its manual requests + BeautifulSoup cleanup

**Tier 3** (AI inference): Unchanged — no web fetching involved.

### Pipeline Injection

`run_enrich_process_steps()` gains a `backend: CrawlBackend` parameter. The `Pipeline` passes its shared backend instance.

---

## 6. Deep Crawler Disposition

| Component | Keep? | Reason |
|-----------|-------|--------|
| `page_classifier.py` | YES | Battle-tested regex patterns, 9 page types, zero API cost |
| `link_discovery.py` | Archive | Scoring patterns → replicated via Crawl4AI's `KeywordRelevanceScorer` + `URLPatternFilter` |
| `crawler.py` | Archive | Replaced by `Crawl4AIBackend.crawl_site()` |
| `__init__.py` | Keep | Still exports `PageClassifier` for backend use |

The `deep_crawler/` directory stays as a dependency of `backends/crawl4ai_backend.py` for `PageClassifier`. The crawler and link discovery modules are archived but not deleted.

---

## 7. Pipeline Changes (`scraper/pipeline.py`)

### Pipeline Init

```python
class Pipeline:
    def __init__(self, session, log, budget=None, backend: CrawlBackend = None):
        self._backend = backend
        # ...existing fields...

    def register_source(self, source: Source):
        if self._backend:
            source.backend = self._backend
        self.sources.append(source)

    def run(self, phase=None, dry_run=False, full=False, source_name=None):
        try:
            # ...existing phase dispatch...
        finally:
            if self._backend:
                self._backend.close()
```

### Entry Point (`scraper/scraper.py`)

```python
def main_v2():
    from backends.crawl4ai_backend import Crawl4AIBackend
    from backends.interface import CrawlConfig

    backend = Crawl4AIBackend(default_config=CrawlConfig(
        js_rendering=True,
        request_delay_seconds=2.0,
    ))

    pipeline = Pipeline(session=session, log=log, budget=args.budget, backend=backend)

    # Register all sources (backend auto-injected)
    pipeline.register_source(AB211DirectSource())
    # ...

    # Config-driven sources
    from sources.config_source import load_config_sources
    for src in load_config_sources():
        pipeline.register_source(src)

    # Autonomous discovery (if --seed-url provided)
    if args.seed_url:
        from sources.autonomous_source import AutonomousSource, SeedConfig
        seed = SeedConfig(url=args.seed_url, organization_name=args.seed_name)
        pipeline.register_source(AutonomousSource([seed]))

    pipeline.run(phase=args.phase, dry_run=args.dry_run, full=args.full)
```

### New CLI Arguments

```python
parser.add_argument("--no-js", action="store_true",
                    help="Disable JS rendering (faster, static sites)")
parser.add_argument("--seed-url", type=str,
                    help="Autonomous discover from a seed URL")
parser.add_argument("--seed-name", type=str,
                    help="Organization name for seed URL discovery")
```

---

## 8. Dependencies

### Add to `scraper/requirements.txt`

```
crawl4ai>=0.6.0,<1.0  # Pin to 0.x — deep crawling API may change in 1.0
pyyaml>=6.0
```

### Remove after migration

```
# playwright>=1.40.0  # Now managed by crawl4ai internally
```

### Post-install

```bash
crawl4ai-setup  # Installs Chromium for Crawl4AI
```

---

## 9. Testing Strategy

### Unit Tests

**`scraper/tests/test_crawl_backend.py`** — Mock `AsyncWebCrawler`:
- SSRF blocking returns error CrawlPage
- Successful fetch maps CrawlResult → CrawlPage with correct fields
- Page classification runs on HTML (regex patterns)
- `crawl_site` creates BestFirstCrawlingStrategy
- `fetch_pages` calls `arun_many`
- `close()` releases browser

**`scraper/tests/test_config_source.py`**:
- Loads YAML config correctly
- Extracts listings matching CSS selectors
- Handles pagination
- Location detection from address

**`scraper/tests/test_autonomous_source.py`**:
- Deep crawl classifies pages
- Contact regex extracts phone/email from CONTACT pages
- Creates org-level RawService entries (no Claude call)

### Integration Tests

**`scraper/tests/test_source_with_backend.py`** — `MockBackend` returns canned HTML:
- Each rewritten plugin produces same `RawService` output as before
- Existing test fixtures reused with MockBackend injection

**MockBackend** (shared test utility in `scraper/tests/conftest.py`):
```python
class MockBackend(CrawlBackend):
    """Returns pre-loaded HTML pages for testing."""
    def __init__(self, pages: Dict[str, str]):
        self._pages = pages  # url -> html content

    def fetch_page(self, url, config=None):
        html = self._pages.get(url, "")
        return CrawlPage(
            url=url, status_code=200 if html else 404,
            markdown=html, html=html, text=html,
            links_internal=[], links_external=[],
            error=None if html else f"Not found: {url}",
        )

    def crawl_site(self, url, config=None):
        page = self.fetch_page(url, config)
        pages = {url: page} if not page.error else {}
        return CrawlSiteResult(
            base_url=url, pages=pages,
            total_pages=len(pages), duration_seconds=0,
        )

    def fetch_pages(self, urls, config=None):
        return [self.fetch_page(u, config) for u in urls]

    def close(self):
        pass
```

### Existing Tests

The 19 existing test files test parsing logic (`parse_members()`, `parse_community_profile()`, etc.) which stays unchanged. These tests should still pass without modification.

---

## 10. Error Handling & Graceful Degradation

### Retry Logic

`fetch_page()` retries up to 2 times on transient failures (timeout, connection reset, browser tab crash) with exponential backoff (2s, 4s). `crawl_site()` does NOT retry the entire crawl — individual page failures within a deep crawl are logged but don't stop the crawl.

```python
MAX_RETRIES = 2
RETRY_BACKOFF = [2, 4]  # seconds

def fetch_page(self, url, config=None):
    for attempt in range(MAX_RETRIES + 1):
        try:
            result = self._run_async(_fetch(), timeout=cfg.timeout_seconds + 10)
            page = self._result_to_page(result)
            if not page.error:
                return page
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_BACKOFF[attempt])
        except (asyncio.TimeoutError, Exception) as e:
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_BACKOFF[attempt])
            else:
                return CrawlPage(url=url, ..., error=str(e))
```

### Graceful Degradation (Crawl4AI not installed)

If `crawl4ai` is not installed, the backend import fails. `scraper.py` wraps the import in try/except:

```python
try:
    from backends.crawl4ai_backend import Crawl4AIBackend
    backend = Crawl4AIBackend(...)
except ImportError:
    log.warning("crawl4ai not installed — falling back to requests-only mode")
    backend = None
```

When `backend=None`, the Pipeline still works — sources that need `self.backend` will fail at `discover()` and be skipped with an error log. Sources that don't use the backend (cra_charities, university_wellness) continue normally. This allows the scraper to run in degraded mode without Crawl4AI.

### Enrichment Pipeline Wiring

The current enrichment has two code paths:
1. `Pipeline.run_enrich()` → `EnrichmentEngine.enrich_batch()` — batches services by category, calls Claude
2. `run_enrich_process_steps()` — standalone function with 3 tiers, called separately

**Both need the backend:**
- `Pipeline.run_enrich()` is updated to pass `self._backend` to the enrichment engine, which uses it in `tier1_website_crawl()` and `tier2_web_search()`
- `run_enrich_process_steps()` gets a `backend` parameter, used directly in tiers 1 and 2
- The `Pipeline` calls `run_enrich_process_steps(backend=self._backend, ...)` if it's configured to use the 3-tier path

### CLI Validation

`--seed-url` requires `--seed-name`:
```python
if args.seed_url and not args.seed_name:
    parser.error("--seed-url requires --seed-name")
```

---

## 11. Edge Cases

**Crawl4AI can't render JS?** `CrawlConfig.js_rendering=False` falls back to HTTP-only. Plugins like ACDS explicitly set this.

**Cloudflare on 211?** Crawl4AI's stealth Chromium handles most challenges. If Turnstile blocks, enable `magic=True` mode or use `js_code` to interact with CAPTCHA.

**Sites behind login?** Not currently needed. If future requirement: `BrowserConfig.cookies` and `CrawlerRunConfig.js_code` can inject auth.

**Rate limits?** `CrawlConfig.request_delay_seconds` controls delay. Crawl4AI has built-in adaptive rate limiting in `arun_many`. No global cross-source rate limit needed since sources are crawled sequentially.

**Crawl4AI + existing Playwright conflict?** Crawl4AI manages its own Playwright/Chromium internally. Remove standalone `playwright` from requirements after migration.

**Memory/browser lifecycle?** Single Chromium instance shared across pipeline. `close()` is called in `Pipeline.run()`'s `finally` block. For very long runs, consider adding a `restart()` method that calls `close()` + clears `_started` flag, allowing `_ensure_started()` to reinitialize.

---

## 12. Files to Create/Modify

### New Files
- `scraper/backends/__init__.py`
- `scraper/backends/interface.py`
- `scraper/backends/crawl4ai_backend.py`
- `scraper/sources/config_source.py`
- `scraper/sources/autonomous_source.py`
- `scraper/sources/configs/` (directory for YAML configs)
- `scraper/tests/test_crawl_backend.py`
- `scraper/tests/test_config_source.py`
- `scraper/tests/test_autonomous_source.py`
- `scraper/tests/test_source_with_backend.py`

### Modified Files
- `scraper/sources/plugin.py` — Add `backend` property to `Source`
- `scraper/sources/ab211_direct.py` — Full rewrite
- `scraper/sources/ahs_findhealth.py` — Hybrid rewrite
- `scraper/sources/homeless_hub.py` — Partial rewrite (Part A)
- `scraper/sources/acds.py` — Trivial swap
- `scraper/sources/veterans_affairs.py` — Trivial swap
- `scraper/pipeline.py` — Accept + inject backend, close on exit
- `scraper/scraper.py` — Initialize backend, register config sources, new CLI args
- `scraper/enrich_process_steps.py` — Tier 1 + Tier 2 use backend
- `scraper/requirements.txt` — Add crawl4ai, pyyaml; remove playwright

### Archived (kept but no longer primary)
- `scraper/deep_crawler/crawler.py`
- `scraper/deep_crawler/link_discovery.py`

### Unchanged
- `scraper/sources/cra_charities.py`
- `scraper/sources/university_wellness.py`
- `scraper/enrichment.py` (EnrichmentEngine)
- `scraper/finalize.py`
- `scraper/scoring.py`
- `scraper/models.py`
- `scraper/utils.py`
- All existing tests

---

## 13. Verification

1. **Install**: `pip install crawl4ai pyyaml && crawl4ai-setup`
2. **Unit tests**: `pytest scraper/tests/test_crawl_backend.py -v`
3. **Source tests**: `pytest scraper/tests/test_source_with_backend.py -v`
4. **Existing tests**: `pytest scraper/tests/ -v` (all should still pass)
5. **Single source dry run**: `python scraper.py --phase discover --source acds --dry-run`
6. **Full dry run**: `python scraper.py --dry-run`
7. **Autonomous test**: `python scraper.py --seed-url https://www.distresscentre.com --seed-name "Distress Centre Calgary" --phase discover --dry-run`
8. **Enrichment test**: `python scraper.py --phase enrich --dry-run` (verify Tier 1 uses Crawl4AI)
