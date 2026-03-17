# Crawl4AI Scraper Modernization — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ResourceHub's patchwork scraper fetching layer (requests + Playwright) with Crawl4AI as a unified backend, add config-driven and autonomous source discovery.

**Architecture:** A `CrawlBackend` abstraction wraps Crawl4AI's `AsyncWebCrawler`, providing sync `fetch_page()`, `crawl_site()`, and `fetch_pages()` methods. All source plugins are rewritten to use the injected backend. New `ConfigDrivenSource` and `AutonomousSource` classes enable adding sources via YAML or seed URLs.

**Tech Stack:** Python 3.11+, Crawl4AI (0.6-1.0), PyYAML, BeautifulSoup4, SQLAlchemy, existing Claude + OpenAI clients

**Spec:** `docs/superpowers/specs/2026-03-16-crawl4ai-scraper-modernization-design.md`

---

## Chunk 1: Backend Abstraction Layer + Tests

### Task 1: Install dependencies

**Files:**
- Modify: `scraper/requirements.txt`

- [ ] **Step 1: Add crawl4ai and pyyaml to requirements**

In `scraper/requirements.txt`, add after the existing entries:

```
# Crawl4AI (unified web crawling backend)
crawl4ai>=0.6.0,<1.0

# YAML config for config-driven sources
pyyaml>=6.0
```

- [ ] **Step 2: Install and set up Crawl4AI**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
pip install -r requirements.txt
crawl4ai-setup
```

Expected: Installs crawl4ai + Chromium browser. No errors.

- [ ] **Step 3: Verify import works**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -c "from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add scraper/requirements.txt
git commit -m "chore(scraper): add crawl4ai and pyyaml dependencies"
```

---

### Task 2: Create backend interface

**Files:**
- Create: `scraper/backends/__init__.py`
- Create: `scraper/backends/interface.py`

- [ ] **Step 1: Create backends directory**

```bash
mkdir -p /Users/adamyeo/Desktop/ResourceHub/scraper/backends
```

- [ ] **Step 2: Write the interface module**

Create `scraper/backends/interface.py`:

```python
"""
Abstract interface for web crawling backends.

Defines CrawlBackend ABC and data types (CrawlPage, CrawlSiteResult, CrawlConfig).
Reuses PageType from deep_crawler to avoid enum duplication.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, Dict, List

from deep_crawler.page_classifier import PageType


@dataclass
class CrawlPage:
    """Result of crawling a single page."""
    url: str
    status_code: int
    markdown: str
    html: str
    text: str
    links_internal: List[Dict[str, str]] = field(default_factory=list)
    links_external: List[Dict[str, str]] = field(default_factory=list)
    page_type: PageType = PageType.UNKNOWN
    error: Optional[str] = None
    depth: int = 0
    crawl_time_seconds: float = 0.0


@dataclass
class CrawlSiteResult:
    """Result of a multi-page site crawl."""
    base_url: str
    pages: Dict[str, CrawlPage] = field(default_factory=dict)
    total_pages: int = 0
    duration_seconds: float = 0.0
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
    wait_for_selector: Optional[str] = None
    js_code: Optional[str] = None
    cache_mode: str = "bypass"
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

- [ ] **Step 3: Write the __init__.py**

Create `scraper/backends/__init__.py`:

```python
from backends.interface import (
    CrawlBackend,
    CrawlPage,
    CrawlSiteResult,
    CrawlConfig,
    PageType,
)

__all__ = [
    "CrawlBackend",
    "CrawlPage",
    "CrawlSiteResult",
    "CrawlConfig",
    "PageType",
]
```

- [ ] **Step 4: Verify imports work**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -c "from backends import CrawlBackend, CrawlPage, CrawlSiteResult, CrawlConfig, PageType; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add scraper/backends/
git commit -m "feat(scraper): add CrawlBackend interface and data types"
```

---

### Task 3: Create MockBackend for tests

**Files:**
- Create: `scraper/tests/conftest.py` (or append if exists)

- [ ] **Step 1: Write MockBackend in conftest**

Create/update `scraper/tests/conftest.py`:

```python
"""Shared test fixtures for scraper tests."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
from typing import Dict, List, Optional

from backends.interface import (
    CrawlBackend, CrawlPage, CrawlSiteResult, CrawlConfig, PageType
)

logger = logging.getLogger("test")


class MockBackend(CrawlBackend):
    """Returns pre-loaded HTML pages for testing."""

    def __init__(self, pages: Dict[str, str] = None):
        self._pages = pages or {}
        self.fetch_log: List[str] = []  # Track URLs fetched for assertions

    def fetch_page(self, url: str, config: Optional[CrawlConfig] = None) -> CrawlPage:
        self.fetch_log.append(url)
        html = self._pages.get(url, "")
        return CrawlPage(
            url=url,
            status_code=200 if html else 404,
            markdown=html,
            html=html,
            text=html,
            links_internal=[],
            links_external=[],
            error=None if html else f"Not found: {url}",
        )

    def crawl_site(self, url: str, config: Optional[CrawlConfig] = None) -> CrawlSiteResult:
        page = self.fetch_page(url, config)
        pages = {url: page} if not page.error else {}
        return CrawlSiteResult(
            base_url=url,
            pages=pages,
            total_pages=len(pages),
            duration_seconds=0.0,
        )

    def fetch_pages(self, urls: List[str], config: Optional[CrawlConfig] = None) -> List[CrawlPage]:
        return [self.fetch_page(u, config) for u in urls]

    def close(self):
        pass
```

- [ ] **Step 2: Verify MockBackend import**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -c "from tests.conftest import MockBackend; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add scraper/tests/conftest.py
git commit -m "test(scraper): add MockBackend fixture for backend tests"
```

---

### Task 4: Write interface unit tests

**Files:**
- Create: `scraper/tests/test_crawl_backend.py`

- [ ] **Step 1: Write the failing tests**

Create `scraper/tests/test_crawl_backend.py`:

```python
"""Tests for CrawlBackend interface and data types."""
import pytest
from backends.interface import CrawlPage, CrawlSiteResult, CrawlConfig, PageType
from tests.conftest import MockBackend


class TestCrawlPage:
    def test_defaults(self):
        page = CrawlPage(url="https://example.com", status_code=200,
                         markdown="# Hello", html="<h1>Hello</h1>", text="Hello")
        assert page.page_type == PageType.UNKNOWN
        assert page.error is None
        assert page.depth == 0
        assert page.links_internal == []

    def test_error_page(self):
        page = CrawlPage(url="https://bad.com", status_code=0,
                         markdown="", html="", text="",
                         error="Connection refused")
        assert page.error == "Connection refused"


class TestCrawlSiteResult:
    def _make_page(self, url, page_type=PageType.UNKNOWN, markdown="content"):
        return CrawlPage(url=url, status_code=200, markdown=markdown,
                         html="", text="", page_type=page_type)

    def test_get_pages_by_type(self):
        result = CrawlSiteResult(
            base_url="https://example.com",
            pages={
                "/": self._make_page("/", PageType.HOME),
                "/apply": self._make_page("/apply", PageType.INTAKE),
                "/services": self._make_page("/services", PageType.SERVICES),
            },
            total_pages=3,
            duration_seconds=1.0,
        )
        assert len(result.get_pages_by_type(PageType.INTAKE)) == 1
        assert len(result.get_pages_by_type(PageType.HOME)) == 1
        assert len(result.get_pages_by_type(PageType.FAQ)) == 0

    def test_get_valuable_pages(self):
        result = CrawlSiteResult(
            base_url="https://example.com",
            pages={
                "/": self._make_page("/", PageType.HOME),
                "/apply": self._make_page("/apply", PageType.INTAKE),
                "/about": self._make_page("/about", PageType.ABOUT),
            },
            total_pages=3,
            duration_seconds=1.0,
        )
        valuable = result.get_valuable_pages()
        assert len(valuable) == 1
        assert valuable[0].page_type == PageType.INTAKE

    def test_get_all_markdown_respects_max_chars(self):
        result = CrawlSiteResult(
            base_url="https://example.com",
            pages={
                "/s": self._make_page("/s", PageType.SERVICES, "x" * 10000),
                "/e": self._make_page("/e", PageType.ELIGIBILITY, "y" * 10000),
            },
            total_pages=2,
            duration_seconds=1.0,
        )
        md = result.get_all_markdown(max_chars=500)
        assert len(md) <= 500

    def test_get_all_markdown_falls_back_to_all_pages(self):
        result = CrawlSiteResult(
            base_url="https://example.com",
            pages={"/": self._make_page("/", PageType.HOME, "home content")},
            total_pages=1,
            duration_seconds=1.0,
        )
        md = result.get_all_markdown()
        assert "home content" in md


class TestCrawlConfig:
    def test_defaults(self):
        config = CrawlConfig()
        assert config.js_rendering is True
        assert config.timeout_seconds == 30
        assert config.max_depth == 2
        assert config.max_pages == 15
        assert config.cache_mode == "bypass"

    def test_custom_config(self):
        config = CrawlConfig(js_rendering=False, timeout_seconds=10, max_pages=5)
        assert config.js_rendering is False
        assert config.timeout_seconds == 10
        assert config.max_pages == 5


class TestMockBackend:
    def test_fetch_page_known_url(self):
        backend = MockBackend({"https://example.com": "<h1>Hello</h1>"})
        page = backend.fetch_page("https://example.com")
        assert page.status_code == 200
        assert page.html == "<h1>Hello</h1>"
        assert page.error is None

    def test_fetch_page_unknown_url(self):
        backend = MockBackend({})
        page = backend.fetch_page("https://unknown.com")
        assert page.status_code == 404
        assert page.error is not None

    def test_fetch_log_tracks_urls(self):
        backend = MockBackend({"https://a.com": "a", "https://b.com": "b"})
        backend.fetch_page("https://a.com")
        backend.fetch_page("https://b.com")
        assert backend.fetch_log == ["https://a.com", "https://b.com"]

    def test_crawl_site_returns_single_page(self):
        backend = MockBackend({"https://example.com": "<p>content</p>"})
        result = backend.crawl_site("https://example.com")
        assert result.total_pages == 1
        assert "https://example.com" in result.pages

    def test_fetch_pages_returns_list(self):
        backend = MockBackend({"https://a.com": "a"})
        pages = backend.fetch_pages(["https://a.com", "https://b.com"])
        assert len(pages) == 2
        assert pages[0].error is None
        assert pages[1].error is not None
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -m pytest tests/test_crawl_backend.py -v
```

Expected: All tests PASS (these test data types and MockBackend, no external deps).

- [ ] **Step 3: Commit**

```bash
git add scraper/tests/test_crawl_backend.py
git commit -m "test(scraper): add CrawlBackend interface and MockBackend tests"
```

---

### Task 5: Implement Crawl4AIBackend

**Files:**
- Create: `scraper/backends/crawl4ai_backend.py`

- [ ] **Step 1: Write the Crawl4AI backend implementation**

Create `scraper/backends/crawl4ai_backend.py` using the spec (section 1) as a **design guide** — do NOT copy verbatim since some Crawl4AI import paths in the spec may not match the installed version.

**Before writing code**, verify actual Crawl4AI module layout:

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -c "
import crawl4ai
print(dir(crawl4ai))
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
print('Core imports OK')
# Verify deep crawl imports — adjust paths if these fail:
try:
    from crawl4ai.deep_crawling import BestFirstCrawlingStrategy
    from crawl4ai.deep_crawling.scorers import KeywordRelevanceScorer
    from crawl4ai.deep_crawling.filters import FilterChain, URLPatternFilter
    print('Deep crawl imports OK')
except ImportError as e:
    print(f'Deep crawl import failed: {e}')
    print('Check crawl4ai docs for correct import paths')
"
```

If import paths differ from the spec, adjust accordingly. The implementation should include ~240 lines:

- `DEFAULT_USER_AGENT`, `SERVICE_KEYWORDS`, `SKIP_URL_PATTERNS` constants
- `Crawl4AIBackend(CrawlBackend)` class with:
  - `_ensure_started()` — lazy browser init via background thread event loop
  - `_run_async(coro, timeout)` — dispatches coroutines to the loop
  - `_make_run_config()` — converts CrawlConfig to CrawlerRunConfig
  - `_classify_page()` — uses `PageClassifier(openai_client=None)` regex only
  - `_result_to_page()` — maps CrawlResult to CrawlPage
  - `fetch_page()` — `arun()` WITHOUT deep_crawl_strategy, SSRF check first
  - `crawl_site()` — `arun()` WITH `BestFirstCrawlingStrategy` + `KeywordRelevanceScorer` + URL filter wired via `filter_chain=`
  - `fetch_pages()` — `arun_many()` for concurrent batch
  - `close()` — shuts down browser + event loop

Add retry logic to `fetch_page()` (2 retries, 2s/4s backoff) per spec section 10.

**Important**: The `CrawlPage` and other data types are already defined in Task 2's `interface.py` — do NOT redefine them. Only import from `backends.interface`.

- [ ] **Step 2: Update `backends/__init__.py` to export the implementation**

Add to `scraper/backends/__init__.py`:

```python
# Lazy import to avoid requiring crawl4ai at import time
def get_crawl4ai_backend(*args, **kwargs):
    from backends.crawl4ai_backend import Crawl4AIBackend
    return Crawl4AIBackend(*args, **kwargs)
```

- [ ] **Step 3: Verify import works (without starting browser)**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -c "from backends.crawl4ai_backend import Crawl4AIBackend; print('OK')"
```

Expected: `OK` (browser only starts on first `fetch_page()` call due to lazy init)

- [ ] **Step 4: Smoke test with a real URL**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -c "
from backends.crawl4ai_backend import Crawl4AIBackend
from backends.interface import CrawlConfig
backend = Crawl4AIBackend()
page = backend.fetch_page('https://example.com', CrawlConfig(js_rendering=False, timeout_seconds=10))
print(f'Status: {page.status_code}, MD length: {len(page.markdown)}, Error: {page.error}')
backend.close()
"
```

Expected: `Status: 200, MD length: >0, Error: None`

- [ ] **Step 5: Commit**

```bash
git add scraper/backends/crawl4ai_backend.py scraper/backends/__init__.py
git commit -m "feat(scraper): implement Crawl4AIBackend with async bridge, page classification, deep crawl"
```

---

### Task 5b: Unit tests for Crawl4AIBackend (mocked AsyncWebCrawler)

**Files:**
- Modify: `scraper/tests/test_crawl_backend.py`

- [ ] **Step 1: Add Crawl4AIBackend tests with mocked crawler**

Add to `scraper/tests/test_crawl_backend.py`:

```python
from unittest.mock import MagicMock, AsyncMock, patch
from backends.crawl4ai_backend import Crawl4AIBackend, SKIP_URL_PATTERNS, SERVICE_KEYWORDS


class TestCrawl4AIBackendSSRF:
    def test_fetch_page_ssrf_blocked(self):
        """Private IPs return error CrawlPage without starting browser."""
        with patch("backends.crawl4ai_backend.is_safe_url", return_value=False), \
             patch.object(Crawl4AIBackend, "_ensure_started"):
            backend = Crawl4AIBackend()
            page = backend.fetch_page("http://169.254.169.254/metadata")
        assert page.error is not None
        assert "SSRF" in page.error

    def test_crawl_site_ssrf_blocked(self):
        with patch("backends.crawl4ai_backend.is_safe_url", return_value=False), \
             patch.object(Crawl4AIBackend, "_ensure_started"):
            backend = Crawl4AIBackend()
            result = backend.crawl_site("http://10.0.0.1/")
        assert result.total_pages == 0
        assert len(result.errors) == 1


class TestSkipPatterns:
    def test_donate_pattern_matches(self):
        """SKIP_URL_PATTERNS are valid glob patterns."""
        from fnmatch import fnmatch
        assert fnmatch("https://example.com/donate/now", "*/donate*")
        assert fnmatch("https://example.com/report.pdf", "*.pdf")
        assert fnmatch("https://facebook.com/page", "*facebook.com*")

    def test_service_keywords_present(self):
        assert "intake" in SERVICE_KEYWORDS
        assert "eligibility" in SERVICE_KEYWORDS
        assert "services" in SERVICE_KEYWORDS
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -m pytest tests/test_crawl_backend.py -v
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add scraper/tests/test_crawl_backend.py
git commit -m "test(scraper): add Crawl4AIBackend unit tests with SSRF and pattern validation"
```

---

## Chunk 2: Source Plugin Base Class + Simple Rewrites

### Task 6: Add backend instance attribute to Source base class

**Files:**
- Modify: `scraper/sources/plugin.py`

- [ ] **Step 1: Add backend class attribute to Source**

Add `backend` as a class-level attribute (NOT a `@property` descriptor) after the `url` class attribute. Use TYPE_CHECKING to avoid circular import:

```python
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from backends.interface import CrawlBackend
```

Add to `Source` class body (after `url = ""`):

```python
    backend: Optional['CrawlBackend'] = None  # Injected by Pipeline
```

The `has_changed()` method already exists — no changes needed.

- [ ] **Step 2: Run existing plugin interface test**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -m pytest tests/test_plugin_interface.py -v
```

Expected: All existing tests PASS (backward compatible — `backend` defaults to None).

- [ ] **Step 3: Commit**

```bash
git add scraper/sources/plugin.py
git commit -m "feat(scraper): add backend property to Source base class"
```

---

### Task 7: Rewrite ACDS source

**Files:**
- Modify: `scraper/sources/acds.py`
- Test: `scraper/tests/test_acds.py`

- [ ] **Step 1: Read existing test to understand expected behavior**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -m pytest tests/test_acds.py -v
```

Note which tests exist and what they assert.

- [ ] **Step 2: Rewrite discover() to use backend**

In `scraper/sources/acds.py`, replace the `discover()` method:

```python
    def discover(self, session, log, dry_run=False) -> list[RawService]:
        from backends.interface import CrawlConfig

        page = self.backend.fetch_page(ACDS_MEMBERS_URL, CrawlConfig(
            js_rendering=False,
            timeout_seconds=TIMEOUT_SECONDS,
        ))
        if page.error:
            logger.error(f"Failed to fetch ACDS members page: {page.error}")
            return []

        soup = BeautifulSoup(page.html, "html.parser")
        return self.parse_members(soup)
```

Remove the `import requests` and `import time` imports if they're no longer used. Remove `USER_AGENT` constant. Keep `parse_members()` and `_parse_org_block()` unchanged.

- [ ] **Step 3: Write integration test with MockBackend**

Add to `scraper/tests/test_acds.py` (or create `test_source_with_backend.py`):

```python
def test_acds_discover_with_mock_backend():
    """ACDS source uses backend.fetch_page() and parses HTML correctly."""
    from tests.conftest import MockBackend
    from sources.acds import ACDSSource, ACDS_MEMBERS_URL

    # Use a minimal HTML fixture that matches ACDS page structure
    html = """
    <h2>Calgary Region</h2>
    <p><strong>Test Org Calgary</strong><br>
    123 Main St, Calgary AB<br>
    Phone: (403) 555-0100<br>
    <a href="mailto:info@testorg.ca">info@testorg.ca</a><br>
    <a href="https://testorg.ca">testorg.ca</a></p>
    """
    backend = MockBackend({ACDS_MEMBERS_URL: html})
    source = ACDSSource()
    source.backend = backend
    results = source.discover(session=None, log=logging.getLogger("test"))
    assert len(results) >= 1
    assert results[0].name == "Test Org Calgary"
    assert results[0].location == "Calgary"
    assert backend.fetch_log == [ACDS_MEMBERS_URL]
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -m pytest tests/test_acds.py -v
```

Expected: All tests PASS (existing parse_members tests still work, new integration test passes).

- [ ] **Step 5: Commit**

```bash
git add scraper/sources/acds.py scraper/tests/test_acds.py
git commit -m "refactor(scraper): rewrite ACDS source to use CrawlBackend"
```

---

### Task 8: Rewrite Veterans Affairs source

**Files:**
- Modify: `scraper/sources/veterans_affairs.py`
- Test: `scraper/tests/test_veterans_affairs.py`

- [ ] **Step 1: Rewrite discover() to use backend**

Same pattern as ACDS — replace `requests.Session()` / `http.get()` with `self.backend.fetch_page()`. Keep `parse_offices()` and `_extract_office_data()` unchanged.

```python
    def discover(self, session, log, dry_run=False) -> list[RawService]:
        from backends.interface import CrawlConfig

        page = self.backend.fetch_page(VAC_CONTACT_URL, CrawlConfig(
            js_rendering=False,
            timeout_seconds=TIMEOUT_SECONDS,
        ))
        if page.error:
            logger.error(f"Failed to fetch VAC contact page: {page.error}")
            return []

        soup = BeautifulSoup(page.html, "html.parser")
        return self.parse_offices(soup)
```

- [ ] **Step 2: Write integration test with MockBackend**

Add test similar to ACDS pattern — create mock HTML with `<details>` Alberta section.

- [ ] **Step 3: Run tests**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -m pytest tests/test_veterans_affairs.py -v
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add scraper/sources/veterans_affairs.py scraper/tests/test_veterans_affairs.py
git commit -m "refactor(scraper): rewrite Veterans Affairs source to use CrawlBackend"
```

---

### Task 9: Rewrite Homeless Hub source (partial)

**Files:**
- Modify: `scraper/sources/homeless_hub.py`
- Test: `scraper/tests/test_homeless_hub.py`

- [ ] **Step 1: Read current source to understand the two parts**

Part A: Community profiles — uses `requests.get()` → replace with `self.backend.fetch_page()`
Part B: Algolia API — pure API call → keep as `requests` (not web scraping)

- [ ] **Step 2: Rewrite Part A (community profiles) to use backend**

Replace the community profile fetching loop with `self.backend.fetch_page()`. Keep the Algolia API part using `requests` directly (import `requests` only where needed).

- [ ] **Step 3: Run tests**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -m pytest tests/test_homeless_hub.py -v
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add scraper/sources/homeless_hub.py scraper/tests/test_homeless_hub.py
git commit -m "refactor(scraper): rewrite Homeless Hub community profiles to use CrawlBackend"
```

---

### Task 10: Rewrite AHS FindHealth source (hybrid)

**Files:**
- Modify: `scraper/sources/ahs_findhealth.py`
- Test: `scraper/tests/test_ahs_findhealth.py`

- [ ] **Step 1: Read current source**

Understand the ViewState form POST flow. Initial page load → extract ViewState → POST with dropdown selections.

- [ ] **Step 2: Rewrite initial page load to use backend, keep form POSTs as requests**

Replace only the initial `requests.get()` for the search page with `self.backend.fetch_page()`. Keep `requests.Session()` for the form POST submissions (ViewState too complex for Crawl4AI's js_code).

- [ ] **Step 3: Run tests**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -m pytest tests/test_ahs_findhealth.py -v
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add scraper/sources/ahs_findhealth.py scraper/tests/test_ahs_findhealth.py
git commit -m "refactor(scraper): hybrid rewrite of AHS FindHealth to use CrawlBackend for initial load"
```

---

### Task 11: Rewrite AB 211 Direct source (full)

**Files:**
- Modify: `scraper/sources/ab211_direct.py`
- Test: `scraper/tests/test_ab211_direct.py`

- [ ] **Step 1: Read current source — understand Playwright flow**

This is the most complex rewrite. Currently uses raw Playwright with `sync_playwright`. Replace entire Playwright block with `self.backend.fetch_page()` calls with JS rendering enabled.

- [ ] **Step 2: Rewrite discover() to use backend**

Replace Playwright browser management with:
```python
config = CrawlConfig(
    js_rendering=True,
    timeout_seconds=30,
    request_delay_seconds=3.0,
    wait_for_selector=".result-item, .listing-item, .service-result",
)
```

Use `self.backend.fetch_page(url, config)` for each topic page. Keep all parsing logic (`_extract_topic_links`, `_extract_listings_from_html`, etc.) unchanged.

- [ ] **Step 3: Remove Playwright imports**

Remove `from playwright.sync_api import sync_playwright` and any Playwright-specific code.

- [ ] **Step 4: Verify Playwright import is fully removed**

```bash
grep -n "playwright" /Users/adamyeo/Desktop/ResourceHub/scraper/sources/ab211_direct.py
```

Expected: No output. If any lines match, remove those imports.

- [ ] **Step 5: Run tests**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -m pytest tests/test_ab211_direct.py -v
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add scraper/sources/ab211_direct.py scraper/tests/test_ab211_direct.py
git commit -m "refactor(scraper): rewrite AB 211 source from Playwright to CrawlBackend"
```

---

## Chunk 3: Pipeline Integration + Config Sources + Autonomous Discovery

### Task 12: Update Pipeline to inject backend

**Files:**
- Modify: `scraper/pipeline.py`

- [ ] **Step 1: Add backend parameter to Pipeline.__init__**

```python
def __init__(self, session, log, budget: float = None, backend=None):
    self.session = session
    self.log = log
    self.budget = budget
    self.stats = PipelineStats()
    self.sources: list[Source] = []
    self.enrichment_engine: EnrichmentEngine = None
    self._consecutive_errors = 0
    self._backend = backend
```

- [ ] **Step 2: Update register_source to inject backend**

```python
def register_source(self, source: Source):
    if self._backend:
        source.backend = self._backend
    self.sources.append(source)
```

- [ ] **Step 3: Add pages_crawled to PipelineStats**

```python
pages_crawled: int = 0
```

And add to `summary()` output.

- [ ] **Step 4: Add close() in run() finally block**

```python
def run(self, phase: str = None, dry_run=False, full=False, source_name: str = None):
    start = datetime.now()
    try:
        if phase is None or phase == "discover":
            self.run_discover(dry_run=dry_run, source_name=source_name)
        if phase is None or phase == "enrich":
            self.run_enrich(dry_run=dry_run, full=full, source_name=source_name)
        if phase is None or phase == "finalize":
            self.run_finalize(dry_run=dry_run)
    finally:
        if self._backend:
            self._backend.close()
        self.stats.duration_seconds = (datetime.now() - start).total_seconds()
        self.log.info(self.stats.summary())
```

- [ ] **Step 5: Wire backend into EnrichmentEngine**

The main pipeline uses `EnrichmentEngine.enrich_batch()` (from `enrichment.py`), NOT the standalone `enrich_process_steps.py` script. Both need the backend. Update `EnrichmentEngine.__init__` to accept an optional `backend` parameter:

```python
# In Pipeline.run_enrich(), pass backend to EnrichmentEngine:
self.enrichment_engine = EnrichmentEngine(
    session=self.session, log=self.log, budget=self.budget,
    backend=self._backend  # NEW: pass CrawlBackend
)
```

Also update `EnrichmentEngine.__init__` in `enrichment.py` to store `self.backend = backend` and use it in `fetch_page_content()` / deep crawl calls if available, falling back to `requests` if `backend is None`.

The standalone `enrich_process_steps.py` will be updated separately in Task 16.

- [ ] **Step 6: Run pipeline tests**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -m pytest tests/test_pipeline.py -v
```

Expected: All existing tests PASS (backend=None is default, backward compatible).

- [ ] **Step 7: Commit**

```bash
git add scraper/pipeline.py
git commit -m "feat(scraper): update Pipeline to accept and inject CrawlBackend"
```

---

### Task 13: Update scraper.py entry point

**Files:**
- Modify: `scraper/scraper.py`

- [ ] **Step 1: Add new CLI arguments**

In `parse_args()`, add:

```python
parser.add_argument("--no-js", action="store_true",
                    help="Disable JS rendering (faster, for static sites)")
parser.add_argument("--seed-url", type=str,
                    help="Autonomous discover from a seed URL")
parser.add_argument("--seed-name", type=str,
                    help="Organization name for seed URL discovery")
```

- [ ] **Step 2: Add --seed-url/--seed-name validation**

In `parse_args()`, after defining all arguments but before `return parser.parse_args()`:

```python
args = parser.parse_args()
if args.seed_url and not args.seed_name:
    parser.error("--seed-url requires --seed-name")
return args
```

This uses `parser.error()` which exits with code 2 (standard argparse behavior) rather than silently returning with code 0.

- [ ] **Step 3: Initialize CrawlBackend with graceful degradation**

In `main_v2()`, before pipeline creation:

```python
# Initialize Crawl4AI backend (graceful degradation if not installed)
backend = None
try:
    from backends.crawl4ai_backend import Crawl4AIBackend
    from backends.interface import CrawlConfig
    backend = Crawl4AIBackend(default_config=CrawlConfig(
        js_rendering=not getattr(args, 'no_js', False),
        request_delay_seconds=2.0,
    ))
    logger.info("Crawl4AI backend initialized")
except ImportError:
    logger.warning("crawl4ai not installed — sources will use their own HTTP fetching")
```

- [ ] **Step 4: Pass backend to Pipeline**

Change:
```python
pipeline = Pipeline(session=session, log=log, budget=args.budget)
```
To:
```python
pipeline = Pipeline(session=session, log=log, budget=args.budget, backend=backend)
```

- [ ] **Step 5: Register config-driven sources**

After registering the 7 built-in sources:

```python
# Register config-driven sources
try:
    from sources.config_source import load_config_sources
    for src in load_config_sources():
        pipeline.register_source(src)
        logger.info(f"Registered config source: {src.name}")
except ImportError:
    pass  # config_source not yet implemented
```

- [ ] **Step 6: Register autonomous source if --seed-url provided**

```python
if args.seed_url:
    try:
        from sources.autonomous_source import AutonomousSource, SeedConfig
        seed = SeedConfig(
            url=args.seed_url,
            organization_name=args.seed_name or "Unknown",
        )
        pipeline.register_source(AutonomousSource([seed]))
        logger.info(f"Registered autonomous source: {args.seed_url}")
    except ImportError:
        logger.warning("autonomous_source not yet implemented")
```

- [ ] **Step 7: Run CLI test**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -m pytest tests/test_cli.py -v
```

Expected: Existing tests PASS.

- [ ] **Step 8: Commit**

```bash
git add scraper/scraper.py
git commit -m "feat(scraper): update entry point with CrawlBackend init, new CLI args"
```

---

### Task 14: Create ConfigDrivenSource

**Files:**
- Create: `scraper/sources/config_source.py`
- Create: `scraper/sources/configs/` (empty directory with `.gitkeep`)
- Create: `scraper/tests/test_config_source.py`

- [ ] **Step 1: Write failing tests**

Create `scraper/tests/test_config_source.py` with tests for:
- `test_loads_yaml_config` — creates temp YAML, verifies fields parsed
- `test_extracts_listings_from_html` — mock HTML matching selectors → RawService list
- `test_pagination_follows_next_link` — mock backend returns pages with next links
- `test_location_detection` — address with "Calgary" → location="Calgary"
- `test_missing_fields_are_none` — selectors that don't match → None fields

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -m pytest tests/test_config_source.py -v
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement ConfigDrivenSource**

Create `scraper/sources/config_source.py` following the spec (section 3). Key elements:
- `ConfigDrivenSource(Source)` loads YAML config
- `discover()` uses `self.backend.fetch_page()` + BeautifulSoup CSS selectors
- Pagination via `next_selector`
- `_detect_location()` maps city patterns
- `load_config_sources()` loads all `*.yaml` from `sources/configs/`

- [ ] **Step 4: Create configs directory**

```bash
mkdir -p /Users/adamyeo/Desktop/ResourceHub/scraper/sources/configs
touch /Users/adamyeo/Desktop/ResourceHub/scraper/sources/configs/.gitkeep
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -m pytest tests/test_config_source.py -v
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add scraper/sources/config_source.py scraper/sources/configs/ scraper/tests/test_config_source.py
git commit -m "feat(scraper): add config-driven source plugin (YAML-based)"
```

---

### Task 15: Create AutonomousSource

**Files:**
- Create: `scraper/sources/autonomous_source.py`
- Create: `scraper/tests/test_autonomous_source.py`

- [ ] **Step 1: Write failing tests**

Create `scraper/tests/test_autonomous_source.py` with tests for:
- `test_creates_org_level_service_from_crawl` — mock crawl → RawService with page markdown
- `test_extracts_contact_from_contact_pages` — CONTACT-classified page → phone/email
- `test_no_claude_calls_during_discover` — verify no AI calls (discover = no AI cost)
- `test_respects_max_pages` — CrawlConfig.max_pages honored

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -m pytest tests/test_autonomous_source.py -v
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement AutonomousSource**

Create `scraper/sources/autonomous_source.py` following the spec (section 4). Key elements:
- `SeedConfig` dataclass (url, organization_name, default_category, default_location, max_depth, max_pages, tags)
- `AutonomousSource(Source)` with `discover()` that:
  1. Calls `self.backend.crawl_site(seed.url, config)`
  2. Extracts phone/email from CONTACT pages via regex
  3. Creates `RawService` entries from SERVICES/PROGRAM pages (markdown as description)
  4. Falls back to org-level entry if no service pages found
  5. Does NOT call Claude — enrichment handles that later

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -m pytest tests/test_autonomous_source.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scraper/sources/autonomous_source.py scraper/tests/test_autonomous_source.py
git commit -m "feat(scraper): add autonomous source discovery via seed URLs"
```

---

## Chunk 4: Enrichment Integration + Cleanup

### Task 16: Update enrichment to use CrawlBackend

**Files:**
- Modify: `scraper/enrich_process_steps.py`

- [ ] **Step 1: Read current enrich_process_steps.py**

Understand how Tier 1 (deep crawl) and Tier 2 (web search + fetch) currently work.

- [ ] **Step 2: Add backend parameter to run_enrich_process_steps()**

Add `backend=None` to the function signature.

- [ ] **Step 3: Update Tier 1 to use backend.crawl_site()**

Replace `DeepCrawler` initialization and usage with:
```python
if 1 in enabled_tiers and backend:
    crawl_result = backend.crawl_site(svc_url, CrawlConfig(
        js_rendering=True, max_depth=2, max_pages=10,
        request_delay_seconds=2.0,
    ))
    combined_markdown = crawl_result.get_all_markdown(max_pages=5, max_chars=15000)
    source_urls = [p.url for p in crawl_result.get_valuable_pages()[:5]]
```

- [ ] **Step 4: Update Tier 2 to use backend.fetch_pages()**

Replace `fetch_page_content()` calls with:
```python
pages = backend.fetch_pages(urls, CrawlConfig(js_rendering=False, timeout_seconds=15))
```

- [ ] **Step 5: Run enrichment tests**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -m pytest tests/test_enrichment.py tests/test_claude_enrichment.py -v
```

Expected: All existing tests PASS (backend=None falls back gracefully).

- [ ] **Step 6: Commit**

```bash
git add scraper/enrich_process_steps.py
git commit -m "feat(scraper): wire CrawlBackend into enrichment tiers 1 and 2"
```

---

### Task 17: Cross-source integration test + full verification

**Files:**
- Create: `scraper/tests/test_source_with_backend.py`

- [ ] **Step 1: Create cross-source integration test**

Create `scraper/tests/test_source_with_backend.py` that tests all 5 rewritten plugins (ACDS, Veterans Affairs, Homeless Hub, AHS FindHealth, AB211) with `MockBackend`. Each test should:
1. Create a `MockBackend` with canned HTML matching the source's expected page structure
2. Instantiate the source, set `source.backend = backend`
3. Call `source.discover(session=None, log=logger)`
4. Assert the returned `RawService` list is non-empty with correct field types

This ensures all plugins produce consistent output through the `CrawlBackend` interface.

- [ ] **Step 2: Run all scraper tests**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -m pytest tests/ -v
```

Expected: All tests PASS. Note any failures and fix.

- [ ] **Step 3: Dry-run single source**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python scraper.py --phase discover --source acds --dry-run
```

Expected: ACDS discovery runs via CrawlBackend, prints services found.

- [ ] **Step 4: Dry-run full pipeline**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python scraper.py --dry-run
```

Expected: All sources discover via CrawlBackend, no errors.

- [ ] **Step 5: Commit integration test**

```bash
git add scraper/tests/test_source_with_backend.py
git commit -m "test(scraper): add cross-source integration test with MockBackend"
```

---

### Task 18: Clean up and archive deep_crawler

**Files:**
- Keep: `scraper/deep_crawler/page_classifier.py` (used by Crawl4AIBackend)
- Keep: `scraper/deep_crawler/__init__.py`
- Archive: `scraper/deep_crawler/crawler.py` → add deprecation comment
- Archive: `scraper/deep_crawler/link_discovery.py` → add deprecation comment

- [ ] **Step 1: Add deprecation comments to archived files**

At the top of `crawler.py` and `link_discovery.py`:

```python
"""
DEPRECATED: This module is superseded by Crawl4AIBackend in backends/crawl4ai_backend.py.
Kept for reference. The page classification patterns from page_classifier.py are still
used by the new backend.
"""
```

- [ ] **Step 2: Remove playwright from requirements.txt**

Comment out or remove:
```
# playwright>=1.40.0  # Replaced by crawl4ai (manages its own Chromium)
```

- [ ] **Step 3: Run full test suite one more time**

```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper
python -m pytest tests/ -v
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add scraper/deep_crawler/ scraper/requirements.txt
git commit -m "chore(scraper): archive deep_crawler, remove standalone playwright dep"
```
