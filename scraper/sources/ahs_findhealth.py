"""AHS Find Healthcare scraper.

Scrapes Alberta Health Services' Find Healthcare directory for
facilities and service programs across the province.
Source: https://www.albertahealthservices.ca/findhealth/
"""
import logging
import re
from typing import Dict, List, Optional, Tuple

from bs4 import BeautifulSoup

from sources.base import BaseDirectoryScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://www.albertahealthservices.ca/findhealth"
FACILITY_SEARCH_URL = f"{BASE_URL}/search.aspx?type=facility"
SERVICE_SEARCH_URL = f"{BASE_URL}/search.aspx?type=service"

CATEGORY_MAP = {
    "addiction & mental health": "Addiction Treatment",
    "mental health": "Mental Health Counselling",
    "hospitals": "Health Care Access",
    "emergency departments": "Health Care Access",
    "urgent care": "Health Care Access",
    "community care": "Health Care Access",
    "public health": "Health Care Access",
    "cancer care": "Health Care Access",
    "labs": "Health Care Access",
    "x-ray": "Health Care Access",
}


class AHSFindHealthScraper(BaseDirectoryScraper):
    SOURCE_NAME = "ahs_findhealth"
    CATEGORY = "Health Care Access"
    RATE_LIMIT_SECONDS = 2

    def scrape(self) -> List[Dict]:
        results = []
        facility_results = self._scrape_search(FACILITY_SEARCH_URL, "facility")
        results.extend(facility_results)
        service_results = self._scrape_search(SERVICE_SEARCH_URL, "service")
        results.extend(service_results)
        return results

    def _scrape_search(self, url: str, search_type: str) -> List[Dict]:
        """Scrape all results from a search page by iterating dropdown options."""
        results = []

        soup = self.fetch_page(url)
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
                resp = self.http.post(url, data=form_data, timeout=self.TIMEOUT_SECONDS)
                resp.raise_for_status()
                result_soup = BeautifulSoup(resp.content, "html.parser")

                page_results = self.parse_results(result_soup)
                for r in page_results:
                    category = self._map_category(label)
                    r["category"] = category
                    r["tags"] = r.get("tags", []) + [label.lower(), "ahs"]
                results.extend(page_results)

                tokens = self.extract_viewstate(result_soup)

            except Exception as e:
                logger.error(f"[AHS] Error searching {label}: {e}")

            self.rate_limit()

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
        """Parse a single result entry."""
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

        return self.build_service_data(
            name=name,
            category=self.CATEGORY,
            location=city,
            phone=phone,
            address=address,
            website_url=detail_url or f"{BASE_URL}/",
            description=f"{name} - Alberta Health Services {facility_type}." if facility_type else f"{name} - Alberta Health Services facility.",
            tags=[facility_type.lower()] if facility_type else [],
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
