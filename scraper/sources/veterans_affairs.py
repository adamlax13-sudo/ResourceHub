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
        """Parse Alberta offices from the VAC contact page.

        The real page uses <details>/<summary> accordions for each province.
        Offices are <h3> elements inside the Alberta <details> block.
        """
        results = []

        # Find the <details> block whose <summary> contains "Alberta"
        for details in soup.find_all("details"):
            summary = details.find("summary")
            if not summary:
                continue
            if "alberta" not in summary.get_text(strip=True).lower():
                continue

            # Found Alberta section — extract all offices
            for h3 in details.find_all("h3"):
                office_name = h3.get_text(strip=True)
                office_data = self._extract_office_data(h3, office_name)
                if office_data:
                    results.append(office_data)
            break  # Only need the Alberta section

        logger.info(f"[VAC] Found {len(results)} Alberta offices")
        return results

    def _extract_office_data(self, h3_tag: Tag, office_name: str) -> Optional[Dict]:
        """Extract office details from the container around an h3.

        Real structure: h3 and sibling <p> tags live inside a col div.
        Address is in the first <p>, hours/phone/language in subsequent <p> tags.
        Phone is in <a href="tel:...">, hours after <span class="bold">Hours:</span>.
        """
        # Walk up to the column container that holds this office's info
        container = h3_tag.parent
        if not container:
            return None

        # Extract phone from tel: links
        phone = ""
        tel_link = container.find("a", href=re.compile(r"^tel:"))
        if tel_link:
            phone = tel_link.get_text(strip=True)

        # Extract address from the first <p> after the h3
        address = ""
        first_p = h3_tag.find_next_sibling("p")
        if first_p:
            # Check if this <p> contains hours/telephone labels — if so, skip it
            p_text = first_p.get_text(strip=True)
            if "hours:" not in p_text.lower() and "telephone:" not in p_text.lower():
                address = first_p.get_text(separator=", ", strip=True)

        # Extract hours from bold-labeled span
        hours = ""
        for span in container.find_all("span"):
            span_text = span.get_text(strip=True).lower()
            if "hours" in span_text:
                # Hours text is in the next sibling (often an <em> tag)
                em = span.find_next_sibling("em")
                if em:
                    hours = em.get_text(strip=True)
                else:
                    # Fall back to next text node
                    next_text = span.next_sibling
                    if next_text:
                        hours = str(next_text).strip().lstrip(":").strip()
                break

        # Determine city from address or office name
        city = "Alberta"
        combined = (address + " " + office_name).lower()
        if "calgary" in combined:
            city = "Calgary"
        elif "edmonton" in combined:
            city = "Edmonton"
        elif "lethbridge" in combined:
            city = "Lethbridge"
        elif "red deer" in combined:
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
