"""Autonomous source discovery via seed URLs."""
import logging
import re
from dataclasses import dataclass, field
from typing import List, Optional

from sources.plugin import Source, RawService

logger = logging.getLogger(__name__)

PHONE_RE = re.compile(r'\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}')
EMAIL_RE = re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')


@dataclass
class SeedConfig:
    """Configuration for autonomous discovery from a seed URL."""
    url: str
    organization_name: str
    default_category: str = "Community Services"
    default_location: Optional[str] = None
    max_depth: int = 2
    max_pages: int = 15
    tags: List[str] = field(default_factory=list)


class AutonomousSource(Source):
    """Discovers services by deep-crawling seed URLs."""
    name = "autonomous"
    url = ""

    def __init__(self, seeds: List[SeedConfig]):
        self._seeds = seeds

    def discover(self, session, log, dry_run=False) -> List[RawService]:
        from backends.interface import CrawlConfig, PageType

        results = []
        for seed in self._seeds:
            if not self.backend:
                logger.error(f"No backend available for autonomous source: {seed.url}")
                continue

            config = CrawlConfig(
                js_rendering=True,
                max_depth=seed.max_depth,
                max_pages=seed.max_pages,
                request_delay_seconds=2.0,
            )

            try:
                crawl_result = self.backend.crawl_site(seed.url, config)
            except Exception as e:
                logger.error(f"Failed to crawl {seed.url}: {e}")
                continue

            # Extract contact info from CONTACT pages
            phone = None
            email = None
            for page in crawl_result.get_pages_by_type(PageType.CONTACT):
                if not phone:
                    match = PHONE_RE.search(page.text)
                    if match:
                        phone = match.group()
                if not email:
                    match = EMAIL_RE.search(page.text)
                    if match:
                        email = match.group()

            # Create entries from SERVICES/PROGRAM pages
            service_pages = (
                crawl_result.get_pages_by_type(PageType.SERVICES) +
                crawl_result.get_pages_by_type(PageType.PROGRAM)
            )

            if service_pages:
                for page in service_pages:
                    results.append(RawService(
                        name=seed.organization_name,
                        category=seed.default_category,
                        source_url=page.url,
                        location=seed.default_location,
                        phone=phone,
                        email=email,
                        website_url=seed.url,
                        description=page.markdown[:2000] if page.markdown else None,
                        tags=seed.tags or None,
                    ))
            else:
                # Fallback: org-level entry from all crawled content
                all_md = crawl_result.get_all_markdown(max_pages=3, max_chars=2000)
                results.append(RawService(
                    name=seed.organization_name,
                    category=seed.default_category,
                    source_url=seed.url,
                    location=seed.default_location,
                    phone=phone,
                    email=email,
                    website_url=seed.url,
                    description=all_md or None,
                    tags=seed.tags or None,
                ))

        return results
