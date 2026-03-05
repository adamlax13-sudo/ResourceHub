"""Homeless Hub scraper.

Scrapes community profiles and the Algolia-powered resource library
for Alberta-relevant homelessness services and resources.
Source: https://www.homelesshub.ca/
"""
import json
import logging
import re
import time
from typing import Dict, List, Optional

import requests
from bs4 import BeautifulSoup

from sources.plugin import Source, RawService

logger = logging.getLogger(__name__)

BASE_URL = "https://www.homelesshub.ca"
COMMUNITY_PROFILE_URL = BASE_URL + "/community_profile/{city}/"

USER_AGENT = "ResourceHubBot/2.0 (+https://resourcehub.ca)"
TIMEOUT_SECONDS = 15

ALBERTA_CITIES = [
    "calgary", "edmonton", "lethbridge", "red-deer",
    "medicine-hat", "grande-prairie", "fort-mcmurray",
]

CITY_DISPLAY = {
    "calgary": "Calgary", "edmonton": "Edmonton", "lethbridge": "Lethbridge",
    "red-deer": "Red Deer", "medicine-hat": "Medicine Hat",
    "grande-prairie": "Grande Prairie", "fort-mcmurray": "Fort McMurray",
}


class HomelessHubSource(Source):
    name = "homeless_hub"
    url = "https://www.homelesshub.ca/"
    CATEGORY = "Housing & Homelessness"

    def discover(self, session, log, dry_run=False) -> list[RawService]:
        self._http = requests.Session()
        self._http.headers.update({"User-Agent": USER_AGENT})

        results = []

        # Part A: Community profiles
        for city_slug in ALBERTA_CITIES:
            url = COMMUNITY_PROFILE_URL.format(city=city_slug)
            soup = self._fetch_page(url)
            if soup:
                city_name = CITY_DISPLAY.get(city_slug, city_slug.title())
                results.extend(self.parse_community_profile(soup, city_name))
                time.sleep(2)

        # Part B: Algolia resource library
        algolia_results = self._query_algolia()
        if algolia_results:
            results.extend(self.parse_algolia_results(algolia_results))

        return results

    def _fetch_page(self, url: str) -> Optional[BeautifulSoup]:
        """Fetch a URL and return parsed HTML."""
        try:
            resp = self._http.get(url, timeout=TIMEOUT_SECONDS)
            resp.raise_for_status()
            return BeautifulSoup(resp.content, "html.parser")
        except requests.RequestException as e:
            logger.error(f"[HomelessHub] Failed to fetch {url}: {e}")
            return None

    def parse_community_profile(self, soup: BeautifulSoup, city: str) -> List[RawService]:
        """Extract organization links from a community profile page."""
        results = []

        for link in soup.find_all("a", href=True):
            href = link["href"]
            text = link.get_text(strip=True)

            if not href.startswith("http"):
                continue
            if "homelesshub.ca" in href:
                continue
            if href.endswith(".pdf"):
                continue
            if len(text) < 5:
                continue

            results.append(RawService(
                name=text,
                category=self.CATEGORY,
                source_url=self.url,
                location=city,
                website_url=href,
                description=f"{text} - identified through the Homeless Hub {city} community profile as a homelessness-related organization.",
                tags=["homelessness", "housing", city.lower()],
            ))

        logger.info(f"[HomelessHub] {city} profile: {len(results)} organizations found")
        return results

    def _query_algolia(self) -> Optional[Dict]:
        """Query Algolia search API for Alberta resources."""
        soup = self._fetch_page(BASE_URL)
        if not soup:
            return None

        algolia_app_id = None
        algolia_api_key = None

        for script in soup.find_all("script"):
            text = script.string or ""
            app_match = re.search(r'(?:appId|applicationId)["\s:]+["\'](\w+)["\']', text)
            key_match = re.search(r'(?:apiKey|searchOnlyApiKey)["\s:]+["\'](\w+)["\']', text)
            if app_match:
                algolia_app_id = app_match.group(1)
            if key_match:
                algolia_api_key = key_match.group(1)

        if not algolia_app_id or not algolia_api_key:
            logger.warning("[HomelessHub] Could not find Algolia credentials in page source")
            return None

        try:
            url = f"https://{algolia_app_id}-dsn.algolia.net/1/indexes/posts_resources/query"
            headers = {
                "X-Algolia-Application-Id": algolia_app_id,
                "X-Algolia-API-Key": algolia_api_key,
                "Content-Type": "application/json",
            }
            payload = {
                "query": "Alberta",
                "hitsPerPage": 100,
                "attributesToRetrieve": [
                    "post_title", "content", "permalink", "taxonomies",
                ],
            }
            resp = self._http.post(url, json=payload, headers=headers, timeout=15)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"[HomelessHub] Algolia query failed: {e}")
            return None

    def parse_algolia_results(self, data: Dict) -> List[RawService]:
        """Parse Algolia search results into RawService objects."""
        results = []
        hits = data.get("hits", [])

        for hit in hits:
            title = hit.get("post_title", "").strip()
            if not title:
                continue

            content = hit.get("content", "")
            permalink = hit.get("permalink", "")
            taxonomies = hit.get("taxonomies", {})
            resource_type = taxonomies.get("resource_type", ["Resource"])[0] if taxonomies.get("resource_type") else "Resource"

            results.append(RawService(
                name=title,
                category=self.CATEGORY,
                source_url=self.url,
                location="Alberta",
                website_url=permalink,
                description=content[:500] if content else f"{title} - {resource_type} from the Homeless Hub resource library.",
                tags=["homelessness", "housing", "resource", resource_type.lower()],
            ))

        logger.info(f"[HomelessHub] Algolia: {len(results)} Alberta resources found")
        return results


# Backward-compatible alias
HomelessHubScraper = HomelessHubSource
