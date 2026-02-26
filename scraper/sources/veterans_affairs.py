"""Veterans Affairs Canada office scraper.

Scrapes the VAC contact page for Alberta office locations.
Source: https://www.veterans.gc.ca/en/contact-us
"""
import logging
import re
from typing import Dict, List, Optional

from bs4 import BeautifulSoup, Tag

from sources.base import BaseDirectoryScraper

logger = logging.getLogger(__name__)

VAC_CONTACT_URL = "https://www.veterans.gc.ca/en/contact-us"


class VeteransAffairsScraper(BaseDirectoryScraper):
    SOURCE_NAME = "veterans_affairs"
    CATEGORY = "Veterans Services"

    def scrape(self) -> List[Dict]:
        soup = self.fetch_page(VAC_CONTACT_URL)
        if not soup:
            logger.error("Failed to fetch VAC contact page")
            return []
        return self.parse_offices(soup)

    def parse_offices(self, soup: BeautifulSoup) -> List[Dict]:
        """Parse Alberta offices from the VAC contact page."""
        results = []
        in_alberta = False

        for element in soup.find_all(["h2", "h3", "div"]):
            if element.name == "h2":
                heading_text = element.get_text(strip=True).lower()
                in_alberta = "alberta" in heading_text or element.get("id") == "ab"
                continue

            if not in_alberta:
                continue

            if element.name == "h3":
                office_name = element.get_text(strip=True)
                office_data = self._extract_office_data(element, office_name)
                if office_data:
                    results.append(office_data)

        logger.info(f"[VAC] Found {len(results)} Alberta offices")
        return results

    def _extract_office_data(self, h3_tag: Tag, office_name: str) -> Optional[Dict]:
        """Extract office details from the elements following an h3."""
        parent = h3_tag.parent
        if not parent:
            return None

        full_text = parent.get_text(separator="\n", strip=True)
        lines = [l.strip() for l in full_text.split("\n") if l.strip()]

        # Extract phone from tel: links
        phone = ""
        tel_link = parent.find("a", href=re.compile(r"^tel:"))
        if tel_link:
            phone = tel_link.get_text(strip=True)

        # Extract address (lines between name and hours/phone)
        address_lines = []
        found_name = False
        for line in lines:
            if office_name in line:
                found_name = True
                continue
            if found_name:
                if "monday" in line.lower() or "tel" in line.lower() or line == phone:
                    break
                address_lines.append(line)

        address = ", ".join(address_lines) if address_lines else ""

        # Extract hours
        hours = ""
        for line in lines:
            if "monday" in line.lower() or "hours" in line.lower():
                hours = line
                break

        # Determine city from address
        city = "Alberta"
        if "calgary" in address.lower():
            city = "Calgary"
        elif "edmonton" in address.lower():
            city = "Edmonton"
        elif "lethbridge" in address.lower():
            city = "Lethbridge"
        elif "red deer" in address.lower():
            city = "Red Deer"

        return self.build_service_data(
            name=f"Veterans Affairs Canada - {office_name}",
            category=self.CATEGORY,
            location=city,
            phone=phone,
            address=address,
            hours=hours,
            website_url=VAC_CONTACT_URL,
            description=f"Veterans Affairs Canada {office_name}. Provides services including disability benefits, mental health support, financial assistance, and transition services for veterans and their families.",
            eligibility="Canadian Armed Forces veterans, RCMP members, and their families",
            tags=["veterans", "military", "federal", office_name.lower().split()[0] if office_name else ""],
        )
