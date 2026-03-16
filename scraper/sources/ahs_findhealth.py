"""AHS Find Healthcare scraper.

Scrapes Alberta Health Services' Find Healthcare directory for
facilities and service programs across the province.
Source: https://www.albertahealthservices.ca/findhealth/
"""
import logging
import re
import time
from typing import Dict, List, Optional, Tuple

import requests
from bs4 import BeautifulSoup

from sources.plugin import Source, RawService

logger = logging.getLogger(__name__)

BASE_URL = "https://www.albertahealthservices.ca/findhealth"
FACILITY_SEARCH_URL = f"{BASE_URL}/search.aspx?type=facility"
SERVICE_SEARCH_URL = f"{BASE_URL}/search.aspx?type=service"

TIMEOUT_SECONDS = 15

CATEGORY_MAP = {
    "addiction & mental health": "Addiction Treatment",
    "mental health": "Mental Health & Counselling",
    "hospitals": "Healthcare Access",
    "emergency departments": "Healthcare Access",
    "urgent care": "Healthcare Access",
    "community care": "Healthcare Access",
    "public health": "Healthcare Access",
    "cancer care": "Healthcare Access",
    "labs": "Healthcare Access",
    "x-ray": "Healthcare Access",
}


class AHSFindHealthSource(Source):
    name = "ahs_findhealth"
    url = "https://www.albertahealthservices.ca/findhealth/"
    CATEGORY = "Health Care Access"
    RATE_LIMIT_SECONDS = 2

    def discover(self, session, log, dry_run=False) -> list[RawService]:
        if not self.backend:
            log.error(f"[{self.name}] No CrawlBackend available, skipping")
            return []
        http = requests.Session()
        try:
            self._http = http
            results = []
            facility_results = self._scrape_search(FACILITY_SEARCH_URL, "facility")
            results.extend(facility_results)
            service_results = self._scrape_search(SERVICE_SEARCH_URL, "service")
            results.extend(service_results)
            return results
        finally:
            http.close()
            self._http = None

    def _fetch_page(self, url: str) -> Optional[BeautifulSoup]:
        """Fetch a URL via CrawlBackend for initial page load (returns parsed HTML)."""
        from backends.interface import CrawlConfig

        page = self.backend.fetch_page(url, CrawlConfig(
            js_rendering=False,
            timeout_seconds=TIMEOUT_SECONDS,
        ))
        if page.error:
            logger.error(f"[AHS] Failed to fetch {url}: {page.error}")
            return None
        return BeautifulSoup(page.html, "html.parser")

    def _scrape_search(self, url: str, search_type: str) -> List[RawService]:
        """Scrape all results from a search page by iterating dropdown options."""
        results = []

        soup = self._fetch_page(url)
        if not soup:
            logger.error(f"[AHS] Failed to fetch {search_type} search page")
            return []

        tokens = self.extract_viewstate(soup)
        if not tokens.get("__VIEWSTATE"):
            logger.error(f"[AHS] No ViewState found on {search_type} page")
            return []

        if search_type == "facility":
            dropdown_name = "FacilityTypeDropDownList"
        else:
            dropdown_name = "ServiceCategoryDropDownList"

        options = self.extract_dropdown_options(soup, dropdown_name)
        logger.info(f"[AHS] Found {len(options)} {search_type} types to search")

        for value, label in options:
            logger.info(f"[AHS] Searching {search_type}: {label}")

            form_data = {
                **tokens,
                f"ctl00$MainPlaceHolder${dropdown_name}": value,
                "ctl00$MainPlaceHolder$DistanceDropDownList": "0",
                "ctl00$MainPlaceHolder$SearchButtonSubmit": "Search",
            }

            try:
                resp = self._http.post(url, data=form_data, timeout=TIMEOUT_SECONDS)
                resp.raise_for_status()
                result_soup = BeautifulSoup(resp.content, "html.parser")

                page_results = self.parse_results(result_soup)
                for r in page_results:
                    category = self._map_category(label)
                    r["category"] = category
                    r["tags"] = r.get("tags", []) + [label.lower(), "ahs"]
                # Convert dicts to RawService
                for r in page_results:
                    results.append(self._dict_to_raw(r))

                tokens = self.extract_viewstate(result_soup)

            except Exception as e:
                logger.error(f"[AHS] Error searching {label}: {e}")

            time.sleep(self.RATE_LIMIT_SECONDS)

        return results

    def extract_viewstate(self, soup: BeautifulSoup) -> Dict[str, str]:
        """Extract ASP.NET ViewState tokens from the page."""
        tokens = {}
        for field_name in ["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION"]:
            field = soup.find("input", {"name": field_name})
            if field:
                tokens[field_name] = field.get("value", "")
        return tokens

    def extract_dropdown_options(self, soup: BeautifulSoup, dropdown_partial_name: str) -> List[Tuple[str, str]]:
        """Extract non-empty options from a dropdown select element."""
        options = []
        select = soup.find("select", {"name": re.compile(dropdown_partial_name)})
        if not select:
            return options
        for option in select.find_all("option"):
            value = option.get("value", "").strip()
            label = option.get_text(strip=True)
            if value:
                options.append((value, label))
        return options

    def parse_results(self, soup: BeautifulSoup) -> List[Dict]:
        """Parse facility/service results from search results page."""
        results = []

        result_divs = (
            soup.find_all("div", class_="facility-result") or
            soup.find_all("div", class_="service-result") or
            soup.find_all("div", class_="search-result") or
            soup.find_all("tr", class_="result-row")
        )

        if not result_divs:
            search_area = soup.find("div", class_="search-results") or soup.find("div", id="results")
            if search_area:
                result_divs = search_area.find_all("div", recursive=False)

        for div in result_divs:
            entry = self._parse_result_entry(div)
            if entry:
                results.append(entry)

        return results

    def _parse_result_entry(self, container) -> Optional[Dict]:
        """Parse a single result entry into a dict."""
        name_tag = container.find(["h3", "h4"])
        if not name_tag:
            link = container.find("a")
            if link:
                name_tag = link
        if not name_tag:
            return None

        name = name_tag.get_text(strip=True)
        if not name or len(name) < 3:
            return None

        detail_url = ""
        link = name_tag.find("a") if name_tag.name != "a" else name_tag
        if link and link.get("href"):
            href = link["href"]
            if not href.startswith("http"):
                detail_url = f"https://www.albertahealthservices.ca{href}"
            else:
                detail_url = href

        address = ""
        addr_tag = container.find(class_=re.compile(r"address", re.I))
        if addr_tag:
            address = addr_tag.get_text(strip=True)

        phone = ""
        phone_tag = container.find(class_=re.compile(r"phone", re.I))
        if phone_tag:
            phone = phone_tag.get_text(strip=True)
        if not phone:
            tel_link = container.find("a", href=re.compile(r"^tel:"))
            if tel_link:
                phone = tel_link.get_text(strip=True)

        type_tag = container.find(class_=re.compile(r"type", re.I))
        facility_type = type_tag.get_text(strip=True) if type_tag else ""

        city = self._city_from_address(address)

        return {
            "name": name.strip(),
            "category": self.CATEGORY,
            "location": city,
            "phone": phone,
            "email": "",
            "website_url": detail_url or f"{BASE_URL}/",
            "address": address,
            "contact": ", ".join([p for p in [phone, detail_url] if p]),
            "hours_of_operation": "",
            "description": f"{name} - Alberta Health Services {facility_type}." if facility_type else f"{name} - Alberta Health Services facility.",
            "eligibility": "",
            "tags": [facility_type.lower()] if facility_type else [],
        }

    def _dict_to_raw(self, d: Dict) -> RawService:
        """Convert a parsed dict to a RawService."""
        return RawService(
            name=d.get("name", ""),
            category=d.get("category", self.CATEGORY),
            source_url=self.url,
            location=d.get("location", "Alberta"),
            phone=d.get("phone", ""),
            email=d.get("email", ""),
            address=d.get("address", ""),
            website_url=d.get("website_url", ""),
            hours=d.get("hours_of_operation", ""),
            description=d.get("description", ""),
            eligibility=d.get("eligibility", ""),
            tags=d.get("tags", []),
        )

    def _map_category(self, type_label: str) -> str:
        """Map AHS facility/service type to our category taxonomy."""
        lower = type_label.lower()
        for key, category in CATEGORY_MAP.items():
            if key in lower:
                return category
        return self.CATEGORY

    def _city_from_address(self, address: str) -> str:
        """Extract city name from address string."""
        lower = address.lower()
        cities = {
            "calgary": "Calgary", "edmonton": "Edmonton",
            "lethbridge": "Lethbridge", "red deer": "Red Deer",
            "medicine hat": "Medicine Hat", "grande prairie": "Grande Prairie",
            "fort mcmurray": "Fort McMurray",
        }
        for key, name in cities.items():
            if key in lower:
                return name
        return "Alberta"


# Backward-compatible alias
AHSFindHealthScraper = AHSFindHealthSource
