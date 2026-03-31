"""211 Alberta direct directory scraper.

Uses CrawlBackend with JS rendering to browse ab.211.ca, bypassing
Cloudflare Turnstile CAPTCHA that blocks standard HTTP requests.

Source: https://ab.211.ca/
"""
import logging
import re
from typing import Dict, List, Optional

from bs4 import BeautifulSoup

from sources.plugin import Source, RawService

logger = logging.getLogger(__name__)

AB211_URL = "https://ab.211.ca/"
AB211_TOPICS_URL = "https://ab.211.ca/how-we-help/"


class AB211DirectSource(Source):
    name = "211_direct"
    url = "https://ab.211.ca/"
    CATEGORY = "Social Services"
    RATE_LIMIT_SECONDS = 3

    TOPIC_IDS = {
        "mental_health": "Mental Health & Addiction",
        "crisis": "Crisis Services",
        "housing": "Housing & Shelter",
        "food": "Food & Basic Needs",
        "employment": "Employment & Financial",
        "health": "Health Care",
        "family": "Family & Children",
        "seniors": "Seniors Services",
        "disability": "Disability Services",
        "legal": "Legal & Advocacy",
    }

    def discover(self, session, log, dry_run=False) -> list[RawService]:
        """Scrape 211 Alberta using CrawlBackend with JS rendering."""
        if not self.backend:
            log.error(f"[{self.name}] No CrawlBackend available, skipping")
            return []
        from backends.interface import CrawlConfig

        config = CrawlConfig(
            js_rendering=True,
            timeout_seconds=30,
            request_delay_seconds=3.0,
            wait_for_selector=".result-item, .listing-item, .service-result",
        )

        results = []

        logger.info("[211Direct] Navigating to ab.211.ca topics page...")
        topics_page = self.backend.fetch_page(AB211_TOPICS_URL, CrawlConfig(
            js_rendering=True,
            timeout_seconds=30,
        ))
        if topics_page.error:
            logger.error(f"[211Direct] Failed to fetch topics page: {topics_page.error}")
            return []

        topic_urls = self._extract_topic_links(topics_page.html)
        logger.info(f"[211Direct] Found {len(topic_urls)} topic categories")

        for topic_url, topic_name in topic_urls:
            try:
                logger.info(f"[211Direct] Browsing topic: {topic_name}")
                full_url = topic_url if topic_url.startswith("http") else AB211_URL.rstrip("/") + topic_url

                page = self.backend.fetch_page(full_url, config)
                if page.error:
                    logger.error(f"[211Direct] Error fetching {topic_name}: {page.error}")
                    continue

                listings = self._extract_page_listings(page.html)
                for listing in listings:
                    listing["category"] = topic_name
                    normalized = self._normalize_listing(listing)
                    results.append(normalized)

            except Exception as e:
                logger.error(f"[211Direct] Error browsing {topic_name}: {e}")

        logger.info(f"[211Direct] Total new services found: {len(results)}")
        return results

    def _extract_topic_links(self, html: str) -> List[tuple]:
        """Extract topic links from the how-we-help page."""
        soup = BeautifulSoup(html, "html.parser")
        topic_urls = []
        for link in soup.find_all("a", onclick=re.compile(r"getSubTopics")):
            href = link.get("href")
            text = link.get_text(strip=True)
            if href:
                topic_urls.append((href, text))
        return topic_urls

    def _extract_page_listings(self, html: str) -> List[Dict]:
        """Extract service listings from HTML."""
        listings = []
        soup = BeautifulSoup(html, "html.parser")

        results_elements = soup.select(".result-item, .listing-item, .service-result")
        if not results_elements:
            return listings

        for elem in results_elements:
            try:
                name_el = elem.find(["h3", "h4"]) or elem.select_one(".title, .name")
                name = name_el.get_text(strip=True) if name_el else ""

                desc_el = elem.select_one(".description, .summary") or elem.find("p")
                description = desc_el.get_text(strip=True) if desc_el else ""

                phone_el = elem.find("a", href=re.compile(r"^tel:")) or elem.select_one(".phone")
                phone = phone_el.get_text(strip=True) if phone_el else ""

                addr_el = elem.select_one(".address, .location")
                address = addr_el.get_text(strip=True) if addr_el else ""

                link_el = elem.find("a", href=True)
                website = link_el["href"] if link_el else ""

                if name:
                    listings.append({
                        "name": name,
                        "description": description,
                        "phone": phone,
                        "address": address,
                        "website": website,
                        "category": "",
                    })
            except Exception:
                continue

        return listings

    def _normalize_listing(self, listing: Dict) -> RawService:
        """Normalize a raw listing into a RawService."""
        address = listing.get("address", "")
        city = "Alberta"
        for test_city in [
            "Calgary", "Edmonton", "Lethbridge", "Red Deer", "Medicine Hat",
            "Grande Prairie", "Fort McMurray", "Banff", "Canmore", "Jasper",
            "Drumheller", "Wetaskiwin", "Peace River", "Slave Lake",
            "Cold Lake", "Lloydminster", "Airdrie", "Sherwood Park",
            "St. Albert", "Spruce Grove", "Leduc", "Camrose", "Brooks",
        ]:
            if test_city.lower() in address.lower():
                city = test_city
                break

        return RawService(
            name=listing.get("name", "").strip(),
            category=listing.get("category", self.CATEGORY),
            source_url=self.url,
            location=city,
            phone=listing.get("phone", ""),
            address=address,
            website_url=listing.get("website", ""),
            description=listing.get("description", ""),
            tags=["211", city.lower()],
        )

    # Keep for backward compat with old tests
    def normalize_listing(self, listing: Dict) -> Dict:
        """Normalize a raw listing into a service data dict (legacy)."""
        raw = self._normalize_listing(listing)
        contact_parts = [p for p in [raw.phone, raw.website_url] if p]
        return {
            "name": raw.name,
            "category": raw.category,
            "location": raw.location,
            "phone": raw.phone or "",
            "email": "",
            "website_url": raw.website_url or "",
            "address": raw.address or "",
            "contact": ", ".join(contact_parts),
            "hours_of_operation": "",
            "description": raw.description or "",
            "eligibility": "",
            "tags": raw.tags or [],
        }

    def is_already_known(self, name: str) -> bool:
        """Check if a service name already exists (uses _existing_lookup if set)."""
        if not name:
            return True
        normalized = name.lower().strip()
        if hasattr(self, '_existing_lookup') and self._existing_lookup is not None:
            if normalized in self._existing_lookup:
                return True
            short = re.sub(r"\s*\(.*?\)\s*", "", normalized).strip()
            if short in self._existing_lookup:
                return True
            for existing_name in self._existing_lookup:
                if len(normalized) > 5 and len(existing_name) > 5:
                    if normalized in existing_name or existing_name in normalized:
                        return True
        return False


# Backward-compatible alias
AB211DirectScraper = AB211DirectSource
