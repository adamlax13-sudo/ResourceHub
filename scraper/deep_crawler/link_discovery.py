"""
Intelligent link discovery and prioritization.

Identifies links most likely to contain valuable intake, eligibility,
and service information on social service agency websites.
"""

import re
import logging
from dataclasses import dataclass
from typing import List, Set, Optional, Dict
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


@dataclass
class DiscoveredLink:
    """A discovered link with metadata for prioritization."""
    url: str
    link_text: str
    context: str  # Surrounding text
    priority_score: float  # 0.0 to 1.0
    likely_page_type: str
    in_main_nav: bool = False


class LinkDiscoverer:
    """
    Extract and prioritize links from HTML pages.

    Prioritizes links based on:
    1. Link text content (e.g., "Apply Now" > "About Us")
    2. URL patterns (e.g., /apply > /history)
    3. Link position (main nav > footer)
    4. Surrounding context
    """

    # High-value link text patterns (score: 1.0)
    HIGH_PRIORITY_PATTERNS = [
        (r'\b(apply|application)\b', 'intake'),
        (r'\bget\s+(help|started|support)\b', 'intake'),
        (r'\b(intake|admission)\b', 'intake'),
        (r'\baccess\s+(service|program|support)\b', 'intake'),
        (r'\b(how\s+to|getting\s+started)\b', 'intake'),
        (r'\b(referral|refer)\b', 'intake'),
        (r'\b(register|enrol|enroll)\b', 'intake'),
        (r'\b(book|schedule)\s+(appointment|session)\b', 'intake'),
        (r'\b(request|need)\s+help\b', 'intake'),
    ]

    # Medium-value link text patterns (score: 0.7)
    MEDIUM_PRIORITY_PATTERNS = [
        (r'\bservices?\b', 'services'),
        (r'\bprograms?\b', 'services'),
        (r'\btreatment\b', 'services'),
        (r'\bsupport\b', 'services'),
        (r'\beligibi?l', 'eligibility'),
        (r'\bwho\s+(can|we|is)\b', 'eligibility'),
        (r'\brequirements?\b', 'eligibility'),
        (r'\bcriteria\b', 'eligibility'),
        (r'\bqualify\b', 'eligibility'),
    ]

    # Lower-value but still useful (score: 0.4)
    LOW_PRIORITY_PATTERNS = [
        (r'\bcontact\b', 'contact'),
        (r'\bhours\b', 'contact'),
        (r'\blocation\b', 'contact'),
        (r'\bfaq\b', 'faq'),
        (r'\bquestions?\b', 'faq'),
    ]

    # Skip patterns - links to avoid (score: 0.0)
    SKIP_PATTERNS = [
        r'\b(donate|donation|give)\b',
        r'\b(career|job|hiring)\b',
        r'\b(volunteer|volunteering)\b',
        r'\b(news|blog|press)\b',
        r'\b(privacy|terms|legal)\b',
        r'\b(login|sign\s*in|account)\b',
        r'\b(facebook|twitter|instagram|linkedin|youtube)\b',
        r'\.(pdf|doc|docx|xls|xlsx)$',
    ]

    # URL path patterns to prioritize
    URL_PRIORITY_PATTERNS = [
        (r'/(apply|intake|get-help|access|how-to|referral|register)', 1.0),
        (r'/(services?|programs?|treatment|support)', 0.7),
        (r'/(eligibility|who-|criteria|requirements)', 0.7),
        (r'/(contact|hours|location|find-us)', 0.4),
        (r'/(faq|questions|help)', 0.3),
    ]

    def __init__(self):
        """Initialize with compiled regex patterns."""
        self._compile_patterns()

    def _compile_patterns(self):
        """Pre-compile regex patterns for efficiency."""
        self._high_patterns = [
            (re.compile(p, re.IGNORECASE), t) for p, t in self.HIGH_PRIORITY_PATTERNS
        ]
        self._medium_patterns = [
            (re.compile(p, re.IGNORECASE), t) for p, t in self.MEDIUM_PRIORITY_PATTERNS
        ]
        self._low_patterns = [
            (re.compile(p, re.IGNORECASE), t) for p, t in self.LOW_PRIORITY_PATTERNS
        ]
        self._skip_patterns = [
            re.compile(p, re.IGNORECASE) for p in self.SKIP_PATTERNS
        ]
        self._url_patterns = [
            (re.compile(p, re.IGNORECASE), s) for p, s in self.URL_PRIORITY_PATTERNS
        ]

    def extract_prioritized_links(
        self,
        html: str,
        base_url: str,
        already_crawled: Set[str] = None
    ) -> List[DiscoveredLink]:
        """
        Extract and prioritize internal links from HTML.

        Args:
            html: HTML content of the page
            base_url: Base URL for resolving relative links
            already_crawled: Set of URLs already crawled (to skip)

        Returns:
            List of DiscoveredLink objects, sorted by priority (highest first)
        """
        already_crawled = already_crawled or set()

        try:
            soup = BeautifulSoup(html, 'lxml')
        except Exception:
            soup = BeautifulSoup(html, 'html.parser')

        base_domain = urlparse(base_url).netloc
        discovered: Dict[str, DiscoveredLink] = {}

        # Identify main navigation areas
        nav_elements = soup.find_all(['nav', 'header'])
        nav_links = set()
        for nav in nav_elements:
            for a in nav.find_all('a', href=True):
                nav_links.add(a.get('href'))

        # Process all links
        for a in soup.find_all('a', href=True):
            href = a.get('href', '').strip()
            if not href or href.startswith('#') or href.startswith('javascript:'):
                continue

            # Resolve to absolute URL
            abs_url = urljoin(base_url, href)
            parsed = urlparse(abs_url)

            # Skip external links
            if parsed.netloc and parsed.netloc != base_domain:
                continue

            # Skip already crawled
            if abs_url in already_crawled:
                continue

            # Skip non-HTTP(S) links
            if parsed.scheme and parsed.scheme not in ('http', 'https'):
                continue

            # Normalize URL (remove fragments, trailing slashes)
            normalized_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            if normalized_url.endswith('/'):
                normalized_url = normalized_url[:-1]

            # Get link text and context
            link_text = a.get_text(strip=True)
            context = self._get_surrounding_context(a)

            # Check if should skip
            if self._should_skip(link_text, normalized_url):
                continue

            # Score the link
            score, page_type = self._score_link(link_text, normalized_url, context)

            # Boost for main nav links
            in_nav = href in nav_links
            if in_nav:
                score = min(score + 0.1, 1.0)

            # Only keep if we haven't seen this URL or this is higher priority
            if normalized_url not in discovered or discovered[normalized_url].priority_score < score:
                discovered[normalized_url] = DiscoveredLink(
                    url=normalized_url,
                    link_text=link_text[:100],
                    context=context[:200],
                    priority_score=score,
                    likely_page_type=page_type,
                    in_main_nav=in_nav
                )

        # Sort by priority score (highest first)
        result = sorted(discovered.values(), key=lambda x: x.priority_score, reverse=True)

        logger.debug(f"Discovered {len(result)} unique links from {base_url}")
        return result

    def _get_surrounding_context(self, element) -> str:
        """Get text surrounding a link element."""
        context_parts = []

        # Get parent paragraph or div text
        parent = element.parent
        if parent:
            siblings_text = parent.get_text(separator=' ', strip=True)
            context_parts.append(siblings_text[:150])

        return ' '.join(context_parts)

    def _should_skip(self, link_text: str, url: str) -> bool:
        """Check if a link should be skipped."""
        combined = f"{link_text} {url}".lower()

        for pattern in self._skip_patterns:
            if pattern.search(combined):
                return True

        return False

    def _score_link(self, link_text: str, url: str, context: str) -> tuple:
        """
        Score a link's priority for crawling.

        Returns:
            Tuple of (score, likely_page_type)
        """
        score = 0.1  # Base score
        page_type = 'unknown'

        # Check link text against patterns
        text_to_check = link_text.lower()

        # High priority patterns
        for pattern, ptype in self._high_patterns:
            if pattern.search(text_to_check):
                score = max(score, 1.0)
                page_type = ptype
                break

        # Medium priority patterns
        if score < 0.7:
            for pattern, ptype in self._medium_patterns:
                if pattern.search(text_to_check):
                    score = max(score, 0.7)
                    page_type = ptype
                    break

        # Low priority patterns
        if score < 0.4:
            for pattern, ptype in self._low_patterns:
                if pattern.search(text_to_check):
                    score = max(score, 0.4)
                    page_type = ptype
                    break

        # Check URL patterns
        for pattern, url_score in self._url_patterns:
            if pattern.search(url):
                score = max(score, url_score)
                break

        # Check context for additional signals
        if score < 0.5:
            context_lower = context.lower()
            if any(kw in context_lower for kw in ['how to', 'apply', 'intake', 'get help']):
                score = max(score, 0.5)

        return score, page_type

    def get_top_links(
        self,
        links: List[DiscoveredLink],
        max_links: int = 15,
        min_score: float = 0.2
    ) -> List[DiscoveredLink]:
        """
        Get top N links above minimum score threshold.

        Args:
            links: List of discovered links
            max_links: Maximum number to return
            min_score: Minimum priority score

        Returns:
            Filtered and limited list of links
        """
        filtered = [l for l in links if l.priority_score >= min_score]
        return filtered[:max_links]
