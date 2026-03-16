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
        self.fetch_log: List[str] = []

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
