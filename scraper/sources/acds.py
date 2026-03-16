"""ACDS member directory scraper.

Scrapes the Alberta Council of Disability Services member listing.
Source: https://acds.ca/memberships/current-members.html
"""
import logging
import re
from typing import Dict, List, Optional

from bs4 import BeautifulSoup, Tag

from sources.plugin import Source, RawService

logger = logging.getLogger(__name__)

ACDS_MEMBERS_URL = "https://acds.ca/memberships/current-members.html"

TIMEOUT_SECONDS = 15

REGIONS = ["calgary", "edmonton", "central", "south", "northeast", "northwest"]

REGION_LOCATIONS = {
    "calgary": "Calgary",
    "edmonton": "Edmonton",
    "central": "Central Alberta",
    "south": "Southern Alberta",
    "northeast": "Northeast Alberta",
    "northwest": "Northwest Alberta",
}


class ACDSSource(Source):
    name = "acds"
    url = "https://acds.ca/memberships/current-members.html"
    CATEGORY = "Disability Support Services"

    def discover(self, session, log, dry_run=False) -> list[RawService]:
        if not self.backend:
            log.error(f"[{self.name}] No CrawlBackend available, skipping")
            return []
        from backends.interface import CrawlConfig

        page = self.backend.fetch_page(ACDS_MEMBERS_URL, CrawlConfig(
            js_rendering=False,
            timeout_seconds=TIMEOUT_SECONDS,
        ))
        if page.error:
            logger.error(f"Failed to fetch ACDS members page: {page.error}")
            return []

        soup = BeautifulSoup(page.html, "html.parser")
        return self.parse_members(soup)

    def parse_members(self, soup: BeautifulSoup) -> List[RawService]:
        """Parse member organizations from the ACDS page."""
        results = []
        current_region = "Alberta"

        for element in soup.find_all(["h2", "h3", "p"]):
            if element.name in ("h2", "h3"):
                heading = element.get_text(strip=True).lower()
                for region_key in REGIONS:
                    if region_key in heading:
                        current_region = REGION_LOCATIONS.get(region_key, "Alberta")
                        break
                if "associate" in heading or "alumni" in heading or "affiliate" in heading:
                    current_region = None
                continue

            if current_region is None:
                continue

            if element.name == "p":
                org = self._parse_org_block(element, current_region)
                if org:
                    results.append(org)

        logger.info(f"[ACDS] Found {len(results)} member organizations")
        return results

    def _parse_org_block(self, p_tag: Tag, region: str) -> Optional[RawService]:
        """Parse a single organization entry from a paragraph block."""
        strong = p_tag.find(["strong", "b"])
        if not strong:
            return None

        name = strong.get_text(strip=True)
        if not name or len(name) < 3:
            return None

        full_text = p_tag.get_text(separator="\n", strip=True)
        lines = [l.strip() for l in full_text.split("\n") if l.strip()]

        # Extract phone
        phone = ""
        phone_match = re.search(r'(?:Phone:\s*)?(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})', full_text)
        if phone_match:
            phone = phone_match.group(1)

        # Extract email
        email = ""
        email_link = p_tag.find("a", href=re.compile(r"^mailto:"))
        if email_link:
            email = email_link.get_text(strip=True)

        # Extract website
        website_url = ""
        for link in p_tag.find_all("a", href=True):
            href = link["href"]
            if href.startswith("http") and "mailto:" not in href:
                website_url = href
                break

        # Extract address (lines that aren't phone/email/name/website)
        address_lines = []
        for line in lines:
            line_lower = line.lower()
            if line == name:
                continue
            if "phone:" in line_lower or "fax:" in line_lower:
                continue
            if "@" in line or "www." in line_lower:
                continue
            if re.match(r'^\(?\d{3}\)?[-.\s]?\d{3}', line):
                continue
            address_lines.append(line)

        address = ", ".join(address_lines[:3]) if address_lines else ""

        return RawService(
            name=name,
            category=self.CATEGORY,
            source_url=self.url,
            location=region,
            phone=phone,
            email=email,
            website_url=website_url,
            address=address,
            description=f"{name} is a member of the Alberta Council of Disability Services (ACDS), providing disability support services in {region}.",
            tags=["disability", "acds-member", region.lower()],
        )


# Backward-compatible alias
ACDSScraper = ACDSSource
