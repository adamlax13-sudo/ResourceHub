"""Config-driven source plugin — define sources via YAML files."""
import logging
import os
from pathlib import Path
from typing import List, Optional

import yaml
from bs4 import BeautifulSoup

from sources.plugin import Source, RawService

logger = logging.getLogger(__name__)

CONFIGS_DIR = Path(__file__).parent / "configs"

CITY_PATTERNS = {
    "calgary": "Calgary", "edmonton": "Edmonton", "red deer": "Red Deer",
    "lethbridge": "Lethbridge", "medicine hat": "Medicine Hat",
    "grande prairie": "Grande Prairie", "fort mcmurray": "Fort McMurray",
}


class ConfigDrivenSource(Source):
    """Source that extracts service listings using CSS selectors from YAML config."""

    def __init__(self, config: dict):
        self.name = config["name"]
        self.url = config["url"]
        self._config = config

    def discover(self, session, log, dry_run=False) -> List[RawService]:
        from backends.interface import CrawlConfig

        cfg = CrawlConfig(
            js_rendering=self._config.get("js_rendering", False),
            timeout_seconds=self._config.get("timeout", 15),
        )

        results = []
        url = self.url
        max_pages = self._config.get("max_pages", 10)

        for _ in range(max_pages):
            page = self.backend.fetch_page(url, cfg)
            if page.error:
                logger.error(f"[{self.name}] Failed to fetch {url}: {page.error}")
                break

            soup = BeautifulSoup(page.html, "html.parser")
            results.extend(self._extract_listings(soup))

            # Pagination
            next_sel = self._config.get("next_selector")
            if next_sel:
                next_link = soup.select_one(next_sel)
                if next_link and next_link.get("href"):
                    url = next_link["href"]
                    if not url.startswith("http"):
                        from urllib.parse import urljoin
                        url = urljoin(self.url, url)
                    continue
            break

        return results

    def _extract_listings(self, soup: BeautifulSoup) -> List[RawService]:
        selectors = self._config.get("selectors", {})
        listing_sel = selectors.get("listing", "article")
        results = []

        for item in soup.select(listing_sel):
            name = self._extract_text(item, selectors.get("name"))
            if not name:
                continue

            address = self._extract_text(item, selectors.get("address"))
            results.append(RawService(
                name=name,
                category=self._config.get("category", "Community Services"),
                source_url=self.url,
                location=self._detect_location(address),
                phone=self._extract_text(item, selectors.get("phone")),
                email=self._extract_text(item, selectors.get("email")),
                address=address,
                website_url=self._extract_href(item, selectors.get("website")),
                description=self._extract_text(item, selectors.get("description")),
            ))
        return results

    def _extract_text(self, element, selector: Optional[str]) -> Optional[str]:
        if not selector:
            return None
        found = element.select_one(selector)
        return found.get_text(strip=True) if found else None

    def _extract_href(self, element, selector: Optional[str]) -> Optional[str]:
        if not selector:
            return None
        found = element.select_one(selector)
        return found.get("href") if found else None

    def _detect_location(self, address: Optional[str]) -> Optional[str]:
        if not address:
            return None
        lower = address.lower()
        for pattern, city in CITY_PATTERNS.items():
            if pattern in lower:
                return city
        return "Alberta"


def load_config_sources() -> List[ConfigDrivenSource]:
    """Load all YAML config files from the configs directory."""
    sources = []
    if not CONFIGS_DIR.exists():
        return sources
    for path in sorted(CONFIGS_DIR.glob("*.yaml")):
        try:
            with open(path) as f:
                config = yaml.safe_load(f)
            if config and config.get("name"):
                sources.append(ConfigDrivenSource(config))
                logger.info(f"Loaded config source: {config['name']} from {path.name}")
        except Exception as e:
            logger.error(f"Failed to load config {path}: {e}")
    return sources
