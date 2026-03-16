"""
Crawl4AI backend implementation.

Wraps Crawl4AI's AsyncWebCrawler to provide synchronous fetch_page(),
crawl_site(), and fetch_pages() methods via a background event loop thread.
The browser stays alive across calls for efficiency.
"""

import asyncio
import logging
import threading
import time
from typing import List, Optional

from crawl4ai import (
    AsyncWebCrawler,
    BrowserConfig,
    CrawlerRunConfig,
    CacheMode,
    BestFirstCrawlingStrategy,
    KeywordRelevanceScorer,
    FilterChain,
    URLPatternFilter,
)

from backends.interface import (
    CrawlBackend,
    CrawlConfig,
    CrawlPage,
    CrawlSiteResult,
    PageType,
)
from deep_crawler.page_classifier import PageClassifier
from utils import is_safe_url

logger = logging.getLogger(__name__)

DEFAULT_USER_AGENT = "ResourceHubBot/3.0 (+https://resourcehub.ca)"

SERVICE_KEYWORDS = [
    "intake", "eligibility", "services", "programs", "apply", "application",
    "contact", "hours", "fees", "referral", "registration", "requirements",
    "process", "forms", "faq", "about",
]

SKIP_URL_PATTERNS = [
    "*/donate*", "*/careers*", "*/jobs*", "*/login*", "*/admin*",
    "*.pdf", "*.doc*", "*.xls*",
    "*facebook.com*", "*twitter.com*", "*instagram.com*",
    "*linkedin.com*", "*youtube.com*",
]


class Crawl4AIBackend(CrawlBackend):
    """Crawl4AI-based web crawling backend with persistent browser."""

    def __init__(self, default_config: Optional[CrawlConfig] = None):
        self._default_config = default_config or CrawlConfig()
        self._started = False
        self._crawler: Optional[AsyncWebCrawler] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None
        self._classifier = PageClassifier(openai_client=None)

    def _ensure_started(self):
        """Lazy-initialize the background event loop, browser, and crawler."""
        if self._started:
            return

        self._loop = asyncio.new_event_loop()

        def _run_loop(loop: asyncio.AbstractEventLoop):
            asyncio.set_event_loop(loop)
            loop.run_forever()

        self._thread = threading.Thread(
            target=_run_loop, args=(self._loop,), daemon=True
        )
        self._thread.start()

        # Create and start the crawler on the background loop
        browser_config = BrowserConfig(
            headless=True,
            user_agent=DEFAULT_USER_AGENT,
            verbose=False,
        )
        self._crawler = AsyncWebCrawler(config=browser_config)
        self._run_async(self._crawler.start(), timeout=30)
        self._started = True
        logger.info("Crawl4AIBackend: browser started")

    def _run_async(self, coro, timeout: float = 60):
        """Submit a coroutine to the background loop and block for the result."""
        future = asyncio.run_coroutine_threadsafe(coro, self._loop)
        return future.result(timeout=timeout)

    def _make_run_config(self, cfg: CrawlConfig, **overrides) -> CrawlerRunConfig:
        """Convert our CrawlConfig to Crawl4AI's CrawlerRunConfig."""
        cache_map = {
            "bypass": CacheMode.BYPASS,
            "enabled": CacheMode.ENABLED,
            "disabled": CacheMode.DISABLED,
            "read_only": CacheMode.READ_ONLY,
            "write_only": CacheMode.WRITE_ONLY,
        }
        cache_mode = cache_map.get(cfg.cache_mode, CacheMode.BYPASS)

        kwargs = dict(
            page_timeout=cfg.timeout_seconds * 1000,  # seconds -> milliseconds
            cache_mode=cache_mode,
            verbose=False,
        )

        if cfg.wait_for_selector:
            kwargs["wait_for"] = f"css:{cfg.wait_for_selector}"

        if cfg.js_code:
            kwargs["js_code"] = cfg.js_code

        if cfg.user_agent:
            kwargs["user_agent"] = cfg.user_agent

        kwargs.update(overrides)
        return CrawlerRunConfig(**kwargs)

    def _classify_page(self, url: str, html: str, text: str) -> PageType:
        """Classify a page using the regex-only classifier."""
        try:
            classification = self._classifier.classify(
                url=url, html=html, text=text
            )
            return classification.page_type
        except Exception as e:
            logger.debug("Page classification failed for %s: %s", url, e)
            return PageType.UNKNOWN

    def _result_to_page(self, result, depth: int = 0) -> CrawlPage:
        """Map a Crawl4AI CrawlResult to our CrawlPage dataclass."""
        markdown = str(result.markdown) if result.markdown else ""
        html = result.html or ""
        status_code = result.status_code or (200 if result.success else 0)

        # Extract links from result
        links = getattr(result, "links", {}) or {}
        links_internal = links.get("internal", [])
        links_external = links.get("external", [])

        page_type = self._classify_page(result.url, html, markdown)

        error = result.error_message if not result.success else None

        return CrawlPage(
            url=result.url,
            status_code=status_code,
            markdown=markdown,
            html=html,
            text=markdown,
            links_internal=links_internal,
            links_external=links_external,
            page_type=page_type,
            error=error,
            depth=depth,
        )

    # ── Public API ──────────────────────────────────────────────────

    def fetch_page(self, url: str, config: Optional[CrawlConfig] = None) -> CrawlPage:
        """Fetch a single page with SSRF protection and retry logic."""
        if not is_safe_url(url):
            return CrawlPage(
                url=url,
                status_code=0,
                markdown="",
                html="",
                text="",
                error=f"SSRF blocked: {url}",
            )

        self._ensure_started()
        cfg = config or self._default_config
        run_config = self._make_run_config(cfg)

        max_retries = 2
        last_error = None

        for attempt in range(max_retries + 1):
            try:
                start_time = time.monotonic()
                container = self._run_async(
                    self._crawler.arun(url=url, config=run_config),
                    timeout=cfg.timeout_seconds + 10,
                )
                elapsed = time.monotonic() - start_time

                # CrawlResultContainer delegates attribute access to first result
                page = self._result_to_page(container, depth=0)
                page.crawl_time_seconds = elapsed

                if page.error and attempt < max_retries:
                    raise RuntimeError(page.error)

                return page

            except Exception as e:
                last_error = str(e)
                if attempt < max_retries:
                    backoff = 2 ** (attempt + 1)  # 2s, 4s
                    logger.warning(
                        "fetch_page retry %d/%d for %s (backoff %ds): %s",
                        attempt + 1, max_retries, url, backoff, last_error,
                    )
                    time.sleep(backoff)

        return CrawlPage(
            url=url,
            status_code=0,
            markdown="",
            html="",
            text="",
            error=f"Failed after {max_retries + 1} attempts: {last_error}",
        )

    def crawl_site(
        self, url: str, config: Optional[CrawlConfig] = None
    ) -> CrawlSiteResult:
        """Multi-page crawl using BestFirstCrawlingStrategy."""
        if not is_safe_url(url):
            return CrawlSiteResult(
                base_url=url,
                errors=[f"SSRF blocked: {url}"],
            )

        self._ensure_started()
        cfg = config or self._default_config

        # Build deep crawl strategy
        url_filter = URLPatternFilter(patterns=SKIP_URL_PATTERNS, reverse=True)
        filter_chain = FilterChain(filters=[url_filter])
        scorer = KeywordRelevanceScorer(keywords=SERVICE_KEYWORDS)
        strategy = BestFirstCrawlingStrategy(
            max_depth=cfg.max_depth,
            max_pages=cfg.max_pages,
            filter_chain=filter_chain,
            url_scorer=scorer,
            include_external=False,
        )

        run_config = self._make_run_config(cfg, deep_crawl_strategy=strategy)

        start_time = time.monotonic()
        try:
            # With deep_crawl_strategy, arun returns List[CrawlResult] directly
            # (from DeepCrawlDecorator, bypassing CrawlResultContainer)
            raw_results = self._run_async(
                self._crawler.arun(url=url, config=run_config),
                timeout=cfg.timeout_seconds * cfg.max_pages + 30,
            )
        except Exception as e:
            elapsed = time.monotonic() - start_time
            logger.error("crawl_site failed for %s: %s", url, e)
            return CrawlSiteResult(
                base_url=url,
                duration_seconds=elapsed,
                errors=[str(e)],
            )

        elapsed = time.monotonic() - start_time

        # raw_results may be a list or iterable of CrawlResult
        if not isinstance(raw_results, list):
            raw_results = list(raw_results)

        pages = {}
        errors = []
        for i, result in enumerate(raw_results):
            try:
                page = self._result_to_page(result, depth=i)
                page.crawl_time_seconds = elapsed / max(len(raw_results), 1)
                pages[result.url] = page
            except Exception as e:
                errors.append(f"Error processing {getattr(result, 'url', '?')}: {e}")

        return CrawlSiteResult(
            base_url=url,
            pages=pages,
            total_pages=len(pages),
            duration_seconds=elapsed,
            errors=errors,
        )

    def fetch_pages(
        self, urls: List[str], config: Optional[CrawlConfig] = None
    ) -> List[CrawlPage]:
        """Fetch multiple independent URLs concurrently via arun_many."""
        cfg = config or self._default_config

        # SSRF filter
        safe_urls = []
        results = []
        for u in urls:
            if is_safe_url(u):
                safe_urls.append(u)
            else:
                results.append(
                    CrawlPage(
                        url=u,
                        status_code=0,
                        markdown="",
                        html="",
                        text="",
                        error=f"SSRF blocked: {u}",
                    )
                )

        if not safe_urls:
            return results

        self._ensure_started()
        run_config = self._make_run_config(cfg)

        try:
            start_time = time.monotonic()
            raw_results = self._run_async(
                self._crawler.arun_many(urls=safe_urls, config=run_config),
                timeout=cfg.timeout_seconds * len(safe_urls) + 30,
            )
            elapsed = time.monotonic() - start_time

            for r in raw_results:
                page = self._result_to_page(r, depth=0)
                page.crawl_time_seconds = elapsed / max(len(safe_urls), 1)
                results.append(page)

        except Exception as e:
            logger.error("fetch_pages failed: %s", e)
            for u in safe_urls:
                results.append(
                    CrawlPage(
                        url=u,
                        status_code=0,
                        markdown="",
                        html="",
                        text="",
                        error=str(e),
                    )
                )

        return results

    def close(self):
        """Shut down browser, stop event loop, join thread."""
        if not self._started:
            return

        try:
            if self._crawler:
                self._run_async(self._crawler.close(), timeout=10)
        except Exception as e:
            logger.warning("Error closing crawler: %s", e)

        if self._loop and self._loop.is_running():
            self._loop.call_soon_threadsafe(self._loop.stop)

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)

        self._started = False
        self._crawler = None
        self._loop = None
        self._thread = None
        logger.info("Crawl4AIBackend: shut down")
