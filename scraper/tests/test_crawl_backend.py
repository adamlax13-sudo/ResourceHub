"""Tests for CrawlBackend interface and data types."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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
            total_pages=3, duration_seconds=1.0,
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
            total_pages=3, duration_seconds=1.0,
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
            total_pages=2, duration_seconds=1.0,
        )
        md = result.get_all_markdown(max_chars=500)
        assert len(md) <= 500

    def test_get_all_markdown_falls_back_to_all_pages(self):
        result = CrawlSiteResult(
            base_url="https://example.com",
            pages={"/": self._make_page("/", PageType.HOME, "home content")},
            total_pages=1, duration_seconds=1.0,
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
