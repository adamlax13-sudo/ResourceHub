"""
DEPRECATED: This module is superseded by Crawl4AIBackend in backends/crawl4ai_backend.py.
Kept for reference. The page classification patterns from page_classifier.py are still
used by the new backend.

Deep website crawler for extracting detailed service information.

Crawls service provider websites 2-3 levels deep, identifying key pages
like intake procedures, eligibility criteria, and program details.
"""

import logging
import time
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Set, Optional
from urllib.parse import urlparse, urljoin
from urllib.robotparser import RobotFileParser

import requests
from bs4 import BeautifulSoup

from .page_classifier import PageClassifier, PageType, PageClassification
from .link_discovery import LinkDiscoverer, DiscoveredLink

logger = logging.getLogger(__name__)


@dataclass
class CrawlResult:
    """Result of crawling a single page."""
    url: str
    page_type: PageType
    classification: PageClassification
    html: str
    text_content: str
    links_found: List[DiscoveredLink]
    crawl_time: float
    status_code: int
    depth: int
    error: Optional[str] = None


@dataclass
class WebsiteCrawlResult:
    """Complete result of crawling a website."""
    base_url: str
    pages: Dict[str, CrawlResult]  # url -> CrawlResult
    page_types: Dict[str, List[str]]  # page_type -> [urls]
    total_pages_crawled: int
    crawl_duration_seconds: float
    started_at: datetime
    completed_at: datetime
    errors: List[str] = field(default_factory=list)
    robots_respected: bool = True

    def get_pages_of_type(self, page_type: PageType) -> List[CrawlResult]:
        """Get all pages of a specific type."""
        urls = self.page_types.get(page_type.value, [])
        return [self.pages[url] for url in urls if url in self.pages]

    def get_best_intake_page(self) -> Optional[CrawlResult]:
        """Get the best intake/application page."""
        intake_pages = self.get_pages_of_type(PageType.INTAKE)
        if not intake_pages:
            return None
        # Sort by classification confidence
        return max(intake_pages, key=lambda p: p.classification.confidence)

    def get_all_valuable_pages(self) -> List[CrawlResult]:
        """Get all pages worth extracting from."""
        valuable_types = [
            PageType.INTAKE,
            PageType.ELIGIBILITY,
            PageType.SERVICES,
            PageType.PROGRAM,
            PageType.CONTACT
        ]
        result = []
        for ptype in valuable_types:
            result.extend(self.get_pages_of_type(ptype))
        return result


class DeepCrawler:
    """
    Intelligent multi-page website crawler.

    Features:
    - Respects robots.txt
    - Configurable crawl depth (default: 2 levels)
    - Rate limiting (default: 2 seconds between requests)
    - Page type classification
    - Intelligent link prioritization
    - Focuses on intake/eligibility/service pages
    """

    DEFAULT_USER_AGENT = (
        "Mozilla/5.0 (compatible; ResourceHubBot/2.0; "
        "+https://github.com/resourcehub; respectful crawler for social services)"
    )

    def __init__(
        self,
        max_depth: int = 2,
        max_pages: int = 15,
        request_delay: float = 2.0,
        timeout: int = 15,
        user_agent: str = None,
        openai_client=None
    ):
        """
        Initialize the crawler.

        Args:
            max_depth: Maximum crawl depth (1 = homepage only, 2 = homepage + linked pages)
            max_pages: Maximum pages to crawl per website
            request_delay: Seconds to wait between requests
            timeout: Request timeout in seconds
            user_agent: Custom user agent string
            openai_client: OpenAI client for AI-based page classification
        """
        self.max_depth = max_depth
        self.max_pages = max_pages
        self.request_delay = request_delay
        self.timeout = timeout
        self.user_agent = user_agent or self.DEFAULT_USER_AGENT

        self.page_classifier = PageClassifier(openai_client)
        self.link_discoverer = LinkDiscoverer()

        # Session for connection reuse
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': self.user_agent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
        })

        # Robots.txt cache
        self._robots_cache: Dict[str, RobotFileParser] = {}

    def crawl_website(self, start_url: str) -> WebsiteCrawlResult:
        """
        Crawl website starting from URL, discovering and prioritizing key pages.

        Strategy:
        1. Fetch homepage, identify site structure
        2. Prioritize links to intake/application pages
        3. Crawl programs/services pages
        4. Extract from contact/eligibility pages
        5. Stop at max_depth or max_pages

        Args:
            start_url: Starting URL (usually homepage)

        Returns:
            WebsiteCrawlResult with all crawled pages and metadata
        """
        started_at = datetime.now()
        pages: Dict[str, CrawlResult] = {}
        page_types: Dict[str, List[str]] = {ptype.value: [] for ptype in PageType}
        errors: List[str] = []
        crawled_urls: Set[str] = set()

        # Normalize start URL
        start_url = self._normalize_url(start_url)
        base_domain = urlparse(start_url).netloc

        # Check robots.txt
        robots_ok = self._check_robots(start_url)
        if not robots_ok:
            logger.warning(f"robots.txt disallows crawling {start_url}")
            return WebsiteCrawlResult(
                base_url=start_url,
                pages={},
                page_types=page_types,
                total_pages_crawled=0,
                crawl_duration_seconds=0,
                started_at=started_at,
                completed_at=datetime.now(),
                errors=["Blocked by robots.txt"],
                robots_respected=True
            )

        # Queue: (url, depth, priority_score)
        to_crawl: List[tuple] = [(start_url, 0, 1.0)]
        pages_crawled = 0

        while to_crawl and pages_crawled < self.max_pages:
            # Sort by priority (depth first, then priority score)
            to_crawl.sort(key=lambda x: (x[1], -x[2]))
            url, depth, _ = to_crawl.pop(0)

            # Skip if already crawled
            if url in crawled_urls:
                continue

            # Skip if too deep
            if depth > self.max_depth:
                continue

            crawled_urls.add(url)

            # Rate limiting
            if pages_crawled > 0:
                time.sleep(self.request_delay)

            # Crawl the page
            logger.info(f"Crawling [{depth}]: {url}")
            result = self._crawl_page(url, depth, is_homepage=(depth == 0))

            if result.error:
                errors.append(f"{url}: {result.error}")
                continue

            pages[url] = result
            page_types[result.page_type.value].append(url)
            pages_crawled += 1

            # Add discovered links to queue
            if depth < self.max_depth:
                for link in result.links_found:
                    if link.url not in crawled_urls:
                        # Check if allowed by robots.txt
                        if self._is_allowed(link.url, base_domain):
                            to_crawl.append((link.url, depth + 1, link.priority_score))

        completed_at = datetime.now()
        duration = (completed_at - started_at).total_seconds()

        logger.info(
            f"Crawl complete: {pages_crawled} pages in {duration:.1f}s "
            f"(intake: {len(page_types.get('intake', []))}, "
            f"eligibility: {len(page_types.get('eligibility', []))}, "
            f"services: {len(page_types.get('services', []))})"
        )

        return WebsiteCrawlResult(
            base_url=start_url,
            pages=pages,
            page_types=page_types,
            total_pages_crawled=pages_crawled,
            crawl_duration_seconds=duration,
            started_at=started_at,
            completed_at=completed_at,
            errors=errors,
            robots_respected=True
        )

    def _crawl_page(self, url: str, depth: int, is_homepage: bool = False) -> CrawlResult:
        """Crawl a single page and extract content."""
        start_time = time.time()

        try:
            response = self.session.get(url, timeout=self.timeout, allow_redirects=True)
            response.raise_for_status()

            html = response.text
            text = self._extract_text(html)

            # Classify the page
            classification = self.page_classifier.classify(
                url=url,
                html=html,
                text=text,
                is_homepage=is_homepage
            )

            # Discover links for further crawling
            links = self.link_discoverer.extract_prioritized_links(
                html=html,
                base_url=url,
                already_crawled=set()
            )

            # Limit links to top priorities
            links = self.link_discoverer.get_top_links(links, max_links=20)

            crawl_time = time.time() - start_time

            return CrawlResult(
                url=url,
                page_type=classification.page_type,
                classification=classification,
                html=html,
                text_content=text,
                links_found=links,
                crawl_time=crawl_time,
                status_code=response.status_code,
                depth=depth,
                error=None
            )

        except requests.exceptions.Timeout:
            return self._error_result(url, depth, "Request timeout")
        except requests.exceptions.SSLError:
            return self._error_result(url, depth, "SSL certificate error")
        except requests.exceptions.ConnectionError:
            return self._error_result(url, depth, "Connection error")
        except requests.exceptions.HTTPError as e:
            return self._error_result(url, depth, f"HTTP error: {e.response.status_code}")
        except Exception as e:
            logger.exception(f"Error crawling {url}")
            return self._error_result(url, depth, str(e))

    def _error_result(self, url: str, depth: int, error: str) -> CrawlResult:
        """Create an error result."""
        return CrawlResult(
            url=url,
            page_type=PageType.UNKNOWN,
            classification=PageClassification(PageType.UNKNOWN, 0.0, []),
            html="",
            text_content="",
            links_found=[],
            crawl_time=0,
            status_code=0,
            depth=depth,
            error=error
        )

    def _extract_text(self, html: str) -> str:
        """Extract clean text content from HTML."""
        try:
            soup = BeautifulSoup(html, 'lxml')
        except Exception:
            soup = BeautifulSoup(html, 'html.parser')

        # Remove script, style, nav, footer, header elements
        for element in soup.find_all(['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript']):
            element.decompose()

        # Get text
        text = soup.get_text(separator=' ', strip=True)

        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text)

        return text[:10000]  # Limit to 10k chars

    def _normalize_url(self, url: str) -> str:
        """Normalize URL for consistency."""
        # Add https if no scheme
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url

        parsed = urlparse(url)

        # Remove trailing slash from path
        path = parsed.path.rstrip('/') or '/'

        # Remove fragments
        return f"{parsed.scheme}://{parsed.netloc}{path}"

    def _check_robots(self, url: str) -> bool:
        """Check if URL is allowed by robots.txt.

        Fetches robots.txt using our requests session (with browser UA)
        instead of urllib's default UA which gets 403'd by most sites.
        """
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"

        if robots_url not in self._robots_cache:
            rp = RobotFileParser()
            rp.set_url(robots_url)
            try:
                resp = self.session.get(robots_url, timeout=10)
                if resp.status_code == 200 and 'text' in resp.headers.get('content-type', ''):
                    rp.parse(resp.text.splitlines())
                else:
                    # No valid robots.txt (404, 403, etc.) — assume allowed
                    rp.allow_all = True
            except Exception:
                # Network error fetching robots.txt — assume allowed
                rp.allow_all = True

            self._robots_cache[robots_url] = rp

        rp = self._robots_cache[robots_url]
        return rp.can_fetch(self.user_agent, url)

    def _is_allowed(self, url: str, expected_domain: str) -> bool:
        """Check if URL is allowed to crawl (same domain + robots.txt)."""
        parsed = urlparse(url)

        # Must be same domain
        if parsed.netloc != expected_domain:
            return False

        # Check robots.txt
        return self._check_robots(url)

    def crawl_single_page(self, url: str) -> CrawlResult:
        """Crawl just a single page (no link following)."""
        url = self._normalize_url(url)
        return self._crawl_page(url, depth=0, is_homepage=True)
