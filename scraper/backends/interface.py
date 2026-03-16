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
