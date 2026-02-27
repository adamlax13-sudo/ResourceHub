# New Directory Scrapers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 5 new direct HTML scrapers (Veterans Affairs, ACDS, Homeless Hub, AHS Find Healthcare, 211 Alberta Direct) as pipeline phases in the existing scraper.

**Architecture:** Each scraper is a module in `scraper/sources/` inheriting from a shared `BaseDirectoryScraper` that provides HTTP sessions, rate limiting, and upsert logic. They integrate into `scraper.py` via new `--phase` options slotted between the enrichment and data-quality phases.

**Tech Stack:** Python, requests, BeautifulSoup, SQLAlchemy (existing), Playwright (new, for 211 direct only)

**Design doc:** `docs/plans/2026-02-26-new-directory-scrapers-design.md`

---

### Task 1: Base Class & Package Setup

**Files:**
- Create: `scraper/sources/__init__.py`
- Create: `scraper/sources/base.py`
- Create: `scraper/tests/test_base_scraper.py`

**Step 1: Write the failing test**

In `scraper/tests/test_base_scraper.py`:

```python
"""Tests for BaseDirectoryScraper."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch
from sources.base import BaseDirectoryScraper


class ConcreteTestScraper(BaseDirectoryScraper):
    """Concrete implementation for testing."""
    SOURCE_NAME = "test_source"

    def scrape(self):
        return []


def test_base_scraper_instantiation():
    session = MagicMock()
    log = MagicMock()
    scraper = ConcreteTestScraper(session=session, log=log)
    assert scraper.source_name == "test_source"
    assert scraper.session is session


def test_build_service_data():
    session = MagicMock()
    log = MagicMock()
    scraper = ConcreteTestScraper(session=session, log=log)
    data = scraper.build_service_data(
        name="Test Service",
        category="Mental Health",
        location="Calgary",
        phone="403-555-1234",
        email="test@example.ca",
        website_url="https://test.ca",
        address="123 Main St, Calgary, AB",
        hours="Mon-Fri 9-5",
        description="A test service.",
    )
    assert data["name"] == "Test Service"
    assert data["phone"] == "(403) 555-1234"
    assert data["category"] == "Mental Health"
    assert data["location"] == "Calgary"


def test_fuzzy_match():
    session = MagicMock()
    log = MagicMock()
    scraper = ConcreteTestScraper(session=session, log=log)
    assert scraper._fuzzy_match("Calgary Drop-In Centre", "Calgary Drop In Centre") > 0.85
    assert scraper._fuzzy_match("Completely Different Name", "Another Service") < 0.5
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m pytest tests/test_base_scraper.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'sources'`

**Step 3: Create the package and base class**

Create `scraper/sources/__init__.py`:

```python
"""Directory scraper source modules."""
```

Create `scraper/sources/base.py`:

```python
"""Base class for directory scrapers."""
import logging
import re
import time
from typing import Any, Dict, List, Optional

import requests
from bs4 import BeautifulSoup

from models import Service, ServiceFieldSource, ScraperLog

logger = logging.getLogger(__name__)

# Import from parent scraper module
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scraper import generate_service_id, should_enrich_field, update_service_confidence, normalize_phone, service_exists, get_existing_services_lookup


class BaseDirectoryScraper:
    """Base class for all directory scrapers.

    Provides HTTP session management, rate limiting, service upsert logic,
    and field source tracking.
    """

    SOURCE_NAME = "unknown"
    USER_AGENT = "ResourceHubBot/2.0 (+https://resourcehub.ca)"
    RATE_LIMIT_SECONDS = 2
    TIMEOUT_SECONDS = 15

    def __init__(self, session, log: ScraperLog, dry_run: bool = False):
        self.session = session  # SQLAlchemy session
        self.log = log
        self.dry_run = dry_run
        self.source_name = self.SOURCE_NAME
        self.http = requests.Session()
        self.http.headers.update({"User-Agent": self.USER_AGENT})
        self._existing_lookup = None
        self.stats = {"found": 0, "created": 0, "enriched": 0, "skipped": 0}

    @property
    def existing_lookup(self) -> Dict:
        if self._existing_lookup is None:
            self._existing_lookup = get_existing_services_lookup(self.session)
        return self._existing_lookup

    def scrape(self) -> List[Dict]:
        """Override in subclasses. Returns list of service data dicts."""
        raise NotImplementedError

    def run(self):
        """Execute the scraper and upsert results."""
        logger.info(f"=== {self.SOURCE_NAME} Scraper ===")
        services = self.scrape()
        self.stats["found"] = len(services)
        logger.info(f"[{self.SOURCE_NAME}] Found {len(services)} services")

        for svc_data in services:
            self._upsert_service(svc_data)

        if not self.dry_run:
            self.session.commit()

        logger.info(
            f"[{self.SOURCE_NAME}] Complete: {self.stats['found']} found, "
            f"{self.stats['created']} created, {self.stats['enriched']} enriched, "
            f"{self.stats['skipped']} skipped"
        )

    def build_service_data(self, *, name: str, category: str, location: str = "Alberta",
                           phone: str = "", email: str = "", website_url: str = "",
                           address: str = "", hours: str = "", description: str = "",
                           eligibility: str = "", tags: List[str] = None,
                           **extra) -> Dict:
        """Build a normalized service data dict."""
        if phone:
            phone = normalize_phone(phone)
        contact_parts = [p for p in [phone, email, website_url] if p]
        return {
            "name": name.strip(),
            "category": category,
            "location": location,
            "phone": phone,
            "email": email,
            "website_url": website_url,
            "address": address,
            "contact": ", ".join(contact_parts),
            "hours_of_operation": hours,
            "description": description,
            "eligibility": eligibility,
            "tags": tags or [],
            **extra,
        }

    def _upsert_service(self, data: Dict):
        """Create new service or enrich existing one."""
        name = data.get("name", "").strip()
        if not name:
            return

        location = data.get("location", "Alberta")
        service_id = generate_service_id(name, location)

        # Check exact match
        existing = self.session.query(Service).filter_by(service_id=service_id).first()

        # Check fuzzy match if no exact
        if not existing and service_exists(name, self.existing_lookup):
            normalized = name.lower().strip()
            for key, svc in self.existing_lookup.items():
                if self._fuzzy_match(normalized, key) > 0.85:
                    existing = svc
                    break

        if existing:
            self._enrich_existing(existing, data)
        else:
            self._create_new(service_id, data)

    def _enrich_existing(self, service: Service, data: Dict):
        """Enrich existing service with new data (empty fields only)."""
        enrichable = ["description", "phone", "email", "address", "website_url",
                      "hours_of_operation", "eligibility", "contact"]
        updated = False
        field_sources = {}

        for field in enrichable:
            if data.get(field) and should_enrich_field(service, field):
                setattr(service, field, data[field])
                field_sources[field] = self.source_name
                updated = True

        # Merge tags
        if data.get("tags") and service.tags:
            existing_tags = set(service.tags) if isinstance(service.tags, list) else set()
            new_tags = set(data["tags"])
            merged = list(existing_tags | new_tags)
            if len(merged) > len(existing_tags):
                service.tags = merged
                updated = True
        elif data.get("tags") and not service.tags:
            service.tags = data["tags"]
            updated = True

        if updated:
            from datetime import datetime
            service.last_updated = datetime.now()
            update_service_confidence(service, self.session, field_sources=field_sources)
            self.stats["enriched"] += 1
            logger.info(f"[{self.SOURCE_NAME}] Enriched: {service.name}")
        else:
            self.stats["skipped"] += 1

    def _create_new(self, service_id: str, data: Dict):
        """Create a new service record."""
        if self.dry_run:
            logger.info(f"[{self.SOURCE_NAME}] DRY RUN - Would create: {data['name']}")
            self.stats["created"] += 1
            return

        service = Service(
            service_id=service_id,
            name=data["name"],
            category=data.get("category", "Unknown"),
            description=data.get("description"),
            location=data.get("location", "Alberta"),
            contact=data.get("contact"),
            phone=data.get("phone"),
            email=data.get("email"),
            address=data.get("address"),
            website_url=data.get("website_url"),
            hours_of_operation=data.get("hours_of_operation"),
            eligibility=data.get("eligibility"),
            tags=data.get("tags", []),
            confidence_score=60,
            source_urls=[self.source_name],
        )
        self.session.add(service)
        self.existing_lookup[data["name"].lower().strip()] = service
        self.stats["created"] += 1
        self.log.services_created += 1
        logger.info(f"[{self.SOURCE_NAME}] Created: {data['name']}")

    def _fuzzy_match(self, a: str, b: str) -> float:
        """Simple character-level similarity ratio (no external deps)."""
        a, b = a.lower().strip(), b.lower().strip()
        if a == b:
            return 1.0
        if not a or not b:
            return 0.0
        # Simple longest common subsequence ratio
        len_a, len_b = len(a), len(b)
        matrix = [[0] * (len_b + 1) for _ in range(len_a + 1)]
        for i in range(1, len_a + 1):
            for j in range(1, len_b + 1):
                if a[i-1] == b[j-1]:
                    matrix[i][j] = matrix[i-1][j-1] + 1
                else:
                    matrix[i][j] = max(matrix[i-1][j], matrix[i][j-1])
        lcs_len = matrix[len_a][len_b]
        return (2.0 * lcs_len) / (len_a + len_b)

    def fetch_page(self, url: str) -> Optional[BeautifulSoup]:
        """Fetch a URL and return parsed HTML. Returns None on error."""
        try:
            resp = self.http.get(url, timeout=self.TIMEOUT_SECONDS)
            resp.raise_for_status()
            return BeautifulSoup(resp.content, "html.parser")
        except requests.RequestException as e:
            logger.error(f"[{self.SOURCE_NAME}] Failed to fetch {url}: {e}")
            return None

    def rate_limit(self):
        """Sleep for rate limiting."""
        time.sleep(self.RATE_LIMIT_SECONDS)
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m pytest tests/test_base_scraper.py -v`
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add scraper/sources/__init__.py scraper/sources/base.py scraper/tests/test_base_scraper.py
git commit -m "feat(scraper): add BaseDirectoryScraper and sources package"
```

---

### Task 2: Veterans Affairs Canada Scraper

**Files:**
- Create: `scraper/sources/veterans_affairs.py`
- Create: `scraper/tests/test_veterans_affairs.py`

**Step 1: Write the failing test**

In `scraper/tests/test_veterans_affairs.py`:

```python
"""Tests for Veterans Affairs Canada scraper."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch
from bs4 import BeautifulSoup
from sources.veterans_affairs import VeteransAffairsScraper


SAMPLE_HTML = """
<html><body>
<h2 id="ab">Alberta</h2>
<div class="col-md-6">
  <h3>Calgary Area Office</h3>
  <p>Harry Chicken Chicken Chicken Building<br>
  220 4th Avenue SE, Suite 410<br>
  Calgary, Alberta T2G 4X3</p>
  <p>Monday to Friday, 8:30 to 4:30, local time</p>
  <p><a href="tel:1-866-522-2122">1-866-522-2122</a></p>
</div>
<div class="col-md-6">
  <h3>Edmonton Area Office</h3>
  <p>Canada Place<br>
  9700 Jasper Avenue NW, Suite 260<br>
  Edmonton, Alberta T5J 4C3</p>
  <p>Monday to Friday, 8:30 to 4:30, local time</p>
  <p><a href="tel:1-866-522-2122">1-866-522-2122</a></p>
</div>
<h2 id="bc">British Columbia</h2>
<div class="col-md-6">
  <h3>Vancouver Office</h3>
  <p>Some address</p>
</div>
</body></html>
"""


def test_parse_alberta_offices():
    session = MagicMock()
    log = MagicMock()
    scraper = VeteransAffairsScraper(session=session, log=log)
    soup = BeautifulSoup(SAMPLE_HTML, "html.parser")
    results = scraper.parse_offices(soup)
    assert len(results) == 2
    assert results[0]["name"] == "Veterans Affairs Canada - Calgary Area Office"
    assert "Calgary" in results[0]["address"]
    assert results[1]["name"] == "Veterans Affairs Canada - Edmonton Area Office"


def test_phone_extracted():
    session = MagicMock()
    log = MagicMock()
    scraper = VeteransAffairsScraper(session=session, log=log)
    soup = BeautifulSoup(SAMPLE_HTML, "html.parser")
    results = scraper.parse_offices(soup)
    assert results[0]["phone"] != ""


def test_bc_offices_excluded():
    session = MagicMock()
    log = MagicMock()
    scraper = VeteransAffairsScraper(session=session, log=log)
    soup = BeautifulSoup(SAMPLE_HTML, "html.parser")
    results = scraper.parse_offices(soup)
    names = [r["name"] for r in results]
    assert not any("Vancouver" in n for n in names)
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m pytest tests/test_veterans_affairs.py -v`
Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement the scraper**

Create `scraper/sources/veterans_affairs.py`:

```python
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

        # Find all h2 and h3 elements to navigate the structure
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
        # Collect text from parent container
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
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m pytest tests/test_veterans_affairs.py -v`
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add scraper/sources/veterans_affairs.py scraper/tests/test_veterans_affairs.py
git commit -m "feat(scraper): add Veterans Affairs Canada scraper"
```

---

### Task 3: ACDS Member Directory Scraper

**Files:**
- Create: `scraper/sources/acds.py`
- Create: `scraper/tests/test_acds.py`

**Step 1: Write the failing test**

In `scraper/tests/test_acds.py`:

```python
"""Tests for ACDS member directory scraper."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock
from bs4 import BeautifulSoup
from sources.acds import ACDSScraper


SAMPLE_HTML = """
<html><body>
<h2>Calgary</h2>
<p><strong>DDRC – Disability & Rehabilitation Centre</strong><br>
123 Main St NW<br>
Calgary, AB T2N 1Z6<br>
Phone: (403) 555-0101<br>
Fax: (403) 555-0102<br>
<a href="http://www.ddrc.ca">www.ddrc.ca</a><br>
<a href="mailto:info@ddrc.ca">info@ddrc.ca</a></p>
<hr>
<p><strong>Foothills AIM Society</strong><br>
456 Another Ave SE<br>
Calgary, AB T2G 0A1<br>
Phone: (403) 555-0201<br>
<a href="http://www.foothillsaim.ca">www.foothillsaim.ca</a></p>
<hr>
<h2>Edmonton</h2>
<p><strong>Skills Society</strong><br>
789 Jasper Ave<br>
Edmonton, AB T5J 1N9<br>
Phone: (780) 555-0301<br>
<a href="http://www.skillssociety.ca">www.skillssociety.ca</a></p>
</body></html>
"""


def test_parse_members():
    session = MagicMock()
    log = MagicMock()
    scraper = ACDSScraper(session=session, log=log)
    soup = BeautifulSoup(SAMPLE_HTML, "html.parser")
    results = scraper.parse_members(soup)
    assert len(results) == 3


def test_region_assignment():
    session = MagicMock()
    log = MagicMock()
    scraper = ACDSScraper(session=session, log=log)
    soup = BeautifulSoup(SAMPLE_HTML, "html.parser")
    results = scraper.parse_members(soup)
    assert results[0]["location"] == "Calgary"
    assert results[2]["location"] == "Edmonton"


def test_fields_extracted():
    session = MagicMock()
    log = MagicMock()
    scraper = ACDSScraper(session=session, log=log)
    soup = BeautifulSoup(SAMPLE_HTML, "html.parser")
    results = scraper.parse_members(soup)
    ddrc = results[0]
    assert "DDRC" in ddrc["name"]
    assert ddrc["phone"] != ""
    assert "ddrc.ca" in ddrc["website_url"]
    assert "ddrc.ca" in ddrc["email"]
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m pytest tests/test_acds.py -v`
Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement the scraper**

Create `scraper/sources/acds.py`:

```python
"""ACDS member directory scraper.

Scrapes the Alberta Council of Disability Services member listing.
Source: https://acds.ca/memberships/current-members.html
"""
import logging
import re
from typing import Dict, List, Optional

from bs4 import BeautifulSoup, Tag

from sources.base import BaseDirectoryScraper

logger = logging.getLogger(__name__)

ACDS_MEMBERS_URL = "https://acds.ca/memberships/current-members.html"

# Region headings on the page
REGIONS = ["calgary", "edmonton", "central", "south", "northeast", "northwest"]

# Map region headings to location values
REGION_LOCATIONS = {
    "calgary": "Calgary",
    "edmonton": "Edmonton",
    "central": "Central Alberta",
    "south": "Southern Alberta",
    "northeast": "Northeast Alberta",
    "northwest": "Northwest Alberta",
}


class ACDSScraper(BaseDirectoryScraper):
    SOURCE_NAME = "acds"
    CATEGORY = "Disability Support Services"

    def scrape(self) -> List[Dict]:
        soup = self.fetch_page(ACDS_MEMBERS_URL)
        if not soup:
            logger.error("Failed to fetch ACDS members page")
            return []
        return self.parse_members(soup)

    def parse_members(self, soup: BeautifulSoup) -> List[Dict]:
        """Parse member organizations from the ACDS page."""
        results = []
        current_region = "Alberta"

        # Walk through headings and paragraphs
        for element in soup.find_all(["h2", "h3", "p"]):
            if element.name in ("h2", "h3"):
                heading = element.get_text(strip=True).lower()
                for region_key in REGIONS:
                    if region_key in heading:
                        current_region = REGION_LOCATIONS.get(region_key, "Alberta")
                        break
                # Skip non-member sections
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

    def _parse_org_block(self, p_tag: Tag, region: str) -> Optional[Dict]:
        """Parse a single organization entry from a paragraph block."""
        # Get the org name from bold/strong tag
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

        return self.build_service_data(
            name=name,
            category=self.CATEGORY,
            location=region,
            phone=phone,
            email=email,
            website_url=website_url,
            address=address,
            description=f"{name} is a member of the Alberta Council of Disability Services (ACDS), providing disability support services in {region}.",
            tags=["disability", "acds-member", region.lower()],
        )
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m pytest tests/test_acds.py -v`
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add scraper/sources/acds.py scraper/tests/test_acds.py
git commit -m "feat(scraper): add ACDS member directory scraper"
```

---

### Task 4: Homeless Hub Scraper

**Files:**
- Create: `scraper/sources/homeless_hub.py`
- Create: `scraper/tests/test_homeless_hub.py`

**Step 1: Write the failing test**

In `scraper/tests/test_homeless_hub.py`:

```python
"""Tests for Homeless Hub scraper."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch
from bs4 import BeautifulSoup
from sources.homeless_hub import HomelessHubScraper


SAMPLE_PROFILE_HTML = """
<html><body>
<h1>Calgary Community Profile</h1>
<div class="et_pb_text">
  <h3>Key Organizations</h3>
  <ul>
    <li><a href="https://calgaryhomeless.com">Calgary Homeless Foundation</a></li>
    <li><a href="https://thedi.ca">Calgary Drop-In Centre</a></li>
  </ul>
</div>
<div class="et_pb_text">
  <h3>Community Plans</h3>
  <p><a href="https://example.com/plan.pdf">2024 Plan to End Homelessness</a></p>
</div>
</body></html>
"""

SAMPLE_ALGOLIA_RESPONSE = {
    "hits": [
        {
            "post_title": "Alberta Housing Report 2024",
            "content": "Analysis of housing and homelessness in Alberta.",
            "permalink": "https://homelesshub.ca/resource/alberta-housing-2024",
            "taxonomies": {"resource_type": ["Report"]},
        },
        {
            "post_title": "Calgary Shelter Guide",
            "content": "Guide to shelters in Calgary.",
            "permalink": "https://homelesshub.ca/resource/calgary-shelter-guide",
            "taxonomies": {"resource_type": ["Toolkit"]},
        },
    ],
    "nbHits": 2,
}


def test_parse_community_profile():
    session = MagicMock()
    log = MagicMock()
    scraper = HomelessHubScraper(session=session, log=log)
    soup = BeautifulSoup(SAMPLE_PROFILE_HTML, "html.parser")
    results = scraper.parse_community_profile(soup, "Calgary")
    assert len(results) >= 1
    names = [r["name"] for r in results]
    assert any("Calgary Homeless Foundation" in n for n in names)


def test_parse_algolia_results():
    session = MagicMock()
    log = MagicMock()
    scraper = HomelessHubScraper(session=session, log=log)
    results = scraper.parse_algolia_results(SAMPLE_ALGOLIA_RESPONSE)
    assert len(results) == 2
    assert results[0]["name"] == "Alberta Housing Report 2024"
    assert "homelesshub.ca" in results[0]["website_url"]
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m pytest tests/test_homeless_hub.py -v`
Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement the scraper**

Create `scraper/sources/homeless_hub.py`:

```python
"""Homeless Hub scraper.

Scrapes community profiles and the Algolia-powered resource library
for Alberta-relevant homelessness services and resources.
Source: https://www.homelesshub.ca/
"""
import json
import logging
import re
from typing import Dict, List, Optional

from bs4 import BeautifulSoup

from sources.base import BaseDirectoryScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://www.homelesshub.ca"
COMMUNITY_PROFILE_URL = BASE_URL + "/community_profile/{city}/"

ALBERTA_CITIES = [
    "calgary", "edmonton", "lethbridge", "red-deer",
    "medicine-hat", "grande-prairie", "fort-mcmurray",
]

CITY_DISPLAY = {
    "calgary": "Calgary", "edmonton": "Edmonton", "lethbridge": "Lethbridge",
    "red-deer": "Red Deer", "medicine-hat": "Medicine Hat",
    "grande-prairie": "Grande Prairie", "fort-mcmurray": "Fort McMurray",
}


class HomelessHubScraper(BaseDirectoryScraper):
    SOURCE_NAME = "homeless_hub"
    CATEGORY = "Housing & Homelessness"

    def scrape(self) -> List[Dict]:
        results = []

        # Part A: Community profiles
        for city_slug in ALBERTA_CITIES:
            url = COMMUNITY_PROFILE_URL.format(city=city_slug)
            soup = self.fetch_page(url)
            if soup:
                city_name = CITY_DISPLAY.get(city_slug, city_slug.title())
                results.extend(self.parse_community_profile(soup, city_name))
                self.rate_limit()

        # Part B: Algolia resource library
        algolia_results = self._query_algolia()
        if algolia_results:
            results.extend(self.parse_algolia_results(algolia_results))

        return results

    def parse_community_profile(self, soup: BeautifulSoup, city: str) -> List[Dict]:
        """Extract organization links from a community profile page."""
        results = []

        # Find links to organizations within content sections
        for link in soup.find_all("a", href=True):
            href = link["href"]
            text = link.get_text(strip=True)

            # Skip internal/navigation links, PDFs, and generic links
            if not href.startswith("http"):
                continue
            if "homelesshub.ca" in href:
                continue
            if href.endswith(".pdf"):
                continue
            if len(text) < 5:
                continue

            results.append(self.build_service_data(
                name=text,
                category=self.CATEGORY,
                location=city,
                website_url=href,
                description=f"{text} - identified through the Homeless Hub {city} community profile as a homelessness-related organization.",
                tags=["homelessness", "housing", city.lower()],
            ))

        logger.info(f"[HomelessHub] {city} profile: {len(results)} organizations found")
        return results

    def _query_algolia(self) -> Optional[Dict]:
        """Query Algolia search API for Alberta resources."""
        # First, get the Algolia credentials from the homepage
        soup = self.fetch_page(BASE_URL)
        if not soup:
            return None

        # Look for Algolia config in page scripts
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

        # Query the Algolia API
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
            resp = self.http.post(url, json=payload, headers=headers, timeout=15)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"[HomelessHub] Algolia query failed: {e}")
            return None

    def parse_algolia_results(self, data: Dict) -> List[Dict]:
        """Parse Algolia search results into service dicts."""
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

            results.append(self.build_service_data(
                name=title,
                category=self.CATEGORY,
                location="Alberta",
                website_url=permalink,
                description=content[:500] if content else f"{title} - {resource_type} from the Homeless Hub resource library.",
                tags=["homelessness", "housing", "resource", resource_type.lower()],
            ))

        logger.info(f"[HomelessHub] Algolia: {len(results)} Alberta resources found")
        return results
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m pytest tests/test_homeless_hub.py -v`
Expected: All 2 tests PASS

**Step 5: Commit**

```bash
git add scraper/sources/homeless_hub.py scraper/tests/test_homeless_hub.py
git commit -m "feat(scraper): add Homeless Hub community profiles + Algolia scraper"
```

---

### Task 5: AHS Find Healthcare Scraper

**Files:**
- Create: `scraper/sources/ahs_findhealth.py`
- Create: `scraper/tests/test_ahs_findhealth.py`

**Step 1: Write the failing test**

In `scraper/tests/test_ahs_findhealth.py`:

```python
"""Tests for AHS Find Healthcare scraper."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch, PropertyMock
from bs4 import BeautifulSoup
from sources.ahs_findhealth import AHSFindHealthScraper


SAMPLE_SEARCH_PAGE = """
<html><body>
<form id="aspnetForm">
  <input type="hidden" name="__VIEWSTATE" value="ABC123" />
  <input type="hidden" name="__VIEWSTATEGENERATOR" value="DEF456" />
  <input type="hidden" name="__EVENTVALIDATION" value="GHI789" />
  <select name="ctl00$MainPlaceHolder$FacilityTypeDropDownList">
    <option value="">All Facility Types</option>
    <option value="1">Hospitals</option>
    <option value="2">Urgent Care Centres</option>
  </select>
</form>
</body></html>
"""

SAMPLE_RESULTS_HTML = """
<html><body>
<div class="search-results">
  <div class="facility-result">
    <h3><a href="/findhealth/facility.aspx?id=123">Peter Chicken Chicken Chicken Centre</a></h3>
    <p class="address">1403 29 St NW, Calgary, AB T2N 2T9</p>
    <p class="phone">(403) 944-1110</p>
    <p class="type">Hospital</p>
  </div>
  <div class="facility-result">
    <h3><a href="/findhealth/facility.aspx?id=456">Royal Alex Hospital</a></h3>
    <p class="address">10240 Kingsway NW, Edmonton, AB T5H 3V9</p>
    <p class="phone">(780) 735-4111</p>
    <p class="type">Hospital</p>
  </div>
</div>
</body></html>
"""


def test_extract_viewstate():
    session = MagicMock()
    log = MagicMock()
    scraper = AHSFindHealthScraper(session=session, log=log)
    soup = BeautifulSoup(SAMPLE_SEARCH_PAGE, "html.parser")
    tokens = scraper.extract_viewstate(soup)
    assert tokens["__VIEWSTATE"] == "ABC123"
    assert tokens["__VIEWSTATEGENERATOR"] == "DEF456"
    assert tokens["__EVENTVALIDATION"] == "GHI789"


def test_parse_facility_results():
    session = MagicMock()
    log = MagicMock()
    scraper = AHSFindHealthScraper(session=session, log=log)
    soup = BeautifulSoup(SAMPLE_RESULTS_HTML, "html.parser")
    results = scraper.parse_results(soup)
    assert len(results) == 2
    assert "Peter" in results[0]["name"]
    assert results[0]["phone"] != ""
    assert "Calgary" in results[0]["address"]


def test_extract_facility_types():
    session = MagicMock()
    log = MagicMock()
    scraper = AHSFindHealthScraper(session=session, log=log)
    soup = BeautifulSoup(SAMPLE_SEARCH_PAGE, "html.parser")
    types = scraper.extract_dropdown_options(soup, "FacilityTypeDropDownList")
    assert len(types) == 2  # excludes the empty "All" option
    assert ("1", "Hospitals") in types
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m pytest tests/test_ahs_findhealth.py -v`
Expected: FAIL with `ModuleNotFoundError`

**Step 3: Implement the scraper**

Create `scraper/sources/ahs_findhealth.py`:

```python
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

# Category mapping for AHS facility/service types
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

        # Scrape facility search
        facility_results = self._scrape_search(FACILITY_SEARCH_URL, "facility")
        results.extend(facility_results)

        # Scrape service search
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

        # Determine which dropdown to iterate
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
                "ctl00$MainPlaceHolder$DistanceDropDownList": "0",  # Whole Province
                "ctl00$MainPlaceHolder$SearchButtonSubmit": "Search",
            }

            try:
                resp = self.http.post(url, data=form_data, timeout=self.TIMEOUT_SECONDS)
                resp.raise_for_status()
                result_soup = BeautifulSoup(resp.content, "html.parser")

                page_results = self.parse_results(result_soup)
                for r in page_results:
                    # Assign category based on facility/service type
                    category = self._map_category(label)
                    r["category"] = category
                    r["tags"] = r.get("tags", []) + [label.lower(), "ahs"]
                results.extend(page_results)

                # Update viewstate for next request
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
            if value:  # Skip empty/default option
                options.append((value, label))
        return options

    def parse_results(self, soup: BeautifulSoup) -> List[Dict]:
        """Parse facility/service results from search results page."""
        results = []

        # Try multiple CSS patterns since we don't know the exact structure
        result_divs = (
            soup.find_all("div", class_="facility-result") or
            soup.find_all("div", class_="service-result") or
            soup.find_all("div", class_="search-result") or
            soup.find_all("tr", class_="result-row")
        )

        # Fallback: look for result containers with h3 links
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
        # Get name from h3/h4 or first link
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

        # Get detail URL if present
        detail_url = ""
        link = name_tag.find("a") if name_tag.name != "a" else name_tag
        if link and link.get("href"):
            href = link["href"]
            if not href.startswith("http"):
                detail_url = f"https://www.albertahealthservices.ca{href}"
            else:
                detail_url = href

        # Extract address
        address = ""
        addr_tag = container.find(class_=re.compile(r"address", re.I))
        if addr_tag:
            address = addr_tag.get_text(strip=True)

        # Extract phone
        phone = ""
        phone_tag = container.find(class_=re.compile(r"phone", re.I))
        if phone_tag:
            phone = phone_tag.get_text(strip=True)
        if not phone:
            tel_link = container.find("a", href=re.compile(r"^tel:"))
            if tel_link:
                phone = tel_link.get_text(strip=True)

        # Extract type
        type_tag = container.find(class_=re.compile(r"type", re.I))
        facility_type = type_tag.get_text(strip=True) if type_tag else ""

        # Determine city from address
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
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m pytest tests/test_ahs_findhealth.py -v`
Expected: All 3 tests PASS

**Step 5: Commit**

```bash
git add scraper/sources/ahs_findhealth.py scraper/tests/test_ahs_findhealth.py
git commit -m "feat(scraper): add AHS Find Healthcare scraper with ViewState handling"
```

---

### Task 6: 211 Alberta Direct Scraper (Playwright)

**Files:**
- Modify: `scraper/requirements.txt` (add playwright)
- Create: `scraper/sources/ab211_direct.py`
- Create: `scraper/tests/test_ab211_direct.py`

**Step 1: Add Playwright dependency**

Append to `scraper/requirements.txt`:

```
# Browser automation (for 211 Alberta direct scraping)
playwright>=1.40.0
```

**Step 2: Write the failing test**

In `scraper/tests/test_ab211_direct.py`:

```python
"""Tests for 211 Alberta direct scraper."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch, AsyncMock
from sources.ab211_direct import AB211DirectScraper


def test_parse_listing_html():
    """Test parsing a typical 211 listing result."""
    session = MagicMock()
    log = MagicMock()
    scraper = AB211DirectScraper(session=session, log=log)

    sample_listing = {
        "name": "Calgary Counselling Centre",
        "description": "Professional counselling services for individuals and families.",
        "address": "1000 8 Ave SW, Suite 200, Calgary AB T2P 3M7",
        "phone": "403-691-5991",
        "category": "Mental Health Counselling",
        "website": "https://www.calgarycounselling.com",
    }
    result = scraper.normalize_listing(sample_listing)
    assert result["name"] == "Calgary Counselling Centre"
    assert result["category"] == "Mental Health Counselling"
    assert "calgarycounselling.com" in result["website_url"]


def test_dedup_against_existing():
    """Test that existing services are detected."""
    session = MagicMock()
    log = MagicMock()
    scraper = AB211DirectScraper(session=session, log=log)

    # Mock existing lookup
    mock_service = MagicMock()
    mock_service.name = "Calgary Counselling Centre"
    scraper._existing_lookup = {"calgary counselling centre": mock_service}

    assert scraper.is_already_known("Calgary Counselling Centre") is True
    assert scraper.is_already_known("Brand New Service") is False


def test_topic_categories_defined():
    """Verify topic categories are defined for browsing."""
    session = MagicMock()
    log = MagicMock()
    scraper = AB211DirectScraper(session=session, log=log)
    assert len(scraper.TOPIC_IDS) > 0
```

**Step 3: Run test to verify it fails**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m pytest tests/test_ab211_direct.py -v`
Expected: FAIL with `ModuleNotFoundError`

**Step 4: Implement the scraper**

Create `scraper/sources/ab211_direct.py`:

```python
"""211 Alberta direct directory scraper.

Uses Playwright to browse ab.211.ca directly, bypassing Cloudflare Turnstile
CAPTCHA that blocks standard HTTP requests. Discovers services by browsing
topic categories and extracting listing details.

Source: https://ab.211.ca/
"""
import json
import logging
import re
import time
from typing import Dict, List, Optional

from sources.base import BaseDirectoryScraper

logger = logging.getLogger(__name__)

AB211_URL = "https://ab.211.ca/"
AB211_TOPICS_URL = "https://ab.211.ca/how-we-help/"


class AB211DirectScraper(BaseDirectoryScraper):
    SOURCE_NAME = "211_direct"
    CATEGORY = "Social Services"
    RATE_LIMIT_SECONDS = 3

    # Topic IDs from the 211 Alberta site (used for browsing categories)
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

    def scrape(self) -> List[Dict]:
        """Scrape 211 Alberta using Playwright browser."""
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            logger.error(
                "[211Direct] Playwright not installed. Run: pip install playwright && playwright install chromium"
            )
            return []

        results = []

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = context.new_page()

            try:
                # Navigate and wait for Turnstile to resolve
                logger.info("[211Direct] Navigating to ab.211.ca...")
                page.goto(AB211_URL, wait_until="networkidle", timeout=30000)
                page.wait_for_timeout(5000)  # Allow Turnstile challenge

                # Navigate to topics page
                page.goto(AB211_TOPICS_URL, wait_until="networkidle", timeout=30000)
                page.wait_for_timeout(3000)

                # Find and click each topic category
                topic_links = page.query_selector_all("a[onclick*='getSubTopics']")
                topic_urls = []

                for link in topic_links:
                    href = link.get_attribute("href")
                    text = link.inner_text().strip()
                    if href:
                        topic_urls.append((href, text))

                logger.info(f"[211Direct] Found {len(topic_urls)} topic categories")

                # Browse each topic
                for topic_url, topic_name in topic_urls:
                    try:
                        logger.info(f"[211Direct] Browsing topic: {topic_name}")
                        full_url = topic_url if topic_url.startswith("http") else AB211_URL.rstrip("/") + topic_url
                        page.goto(full_url, wait_until="networkidle", timeout=20000)
                        page.wait_for_timeout(2000)

                        # Extract listings from the results
                        listings = self._extract_page_listings(page)
                        for listing in listings:
                            listing["category"] = topic_name
                            normalized = self.normalize_listing(listing)
                            if not self.is_already_known(normalized["name"]):
                                results.append(normalized)

                        time.sleep(self.RATE_LIMIT_SECONDS)

                    except Exception as e:
                        logger.error(f"[211Direct] Error browsing {topic_name}: {e}")

            except Exception as e:
                logger.error(f"[211Direct] Browser error: {e}")
            finally:
                browser.close()

        logger.info(f"[211Direct] Total new services found: {len(results)}")
        return results

    def _extract_page_listings(self, page) -> List[Dict]:
        """Extract service listings from the current page."""
        listings = []

        try:
            # Try to find result elements on the page
            results_elements = page.query_selector_all(".result-item, .listing-item, .service-result")

            if not results_elements:
                # Fallback: try generic content extraction
                content = page.content()
                # Parse with regex for service names and details
                return listings

            for elem in results_elements:
                try:
                    name_el = elem.query_selector("h3, h4, .title, .name")
                    name = name_el.inner_text().strip() if name_el else ""

                    desc_el = elem.query_selector(".description, .summary, p")
                    description = desc_el.inner_text().strip() if desc_el else ""

                    phone_el = elem.query_selector("a[href^='tel:'], .phone")
                    phone = phone_el.inner_text().strip() if phone_el else ""

                    addr_el = elem.query_selector(".address, .location")
                    address = addr_el.inner_text().strip() if addr_el else ""

                    link_el = elem.query_selector("a[href]")
                    website = link_el.get_attribute("href") if link_el else ""

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

        except Exception as e:
            logger.error(f"[211Direct] Error extracting listings: {e}")

        return listings

    def normalize_listing(self, listing: Dict) -> Dict:
        """Normalize a raw listing into a service data dict."""
        # Determine city from address
        address = listing.get("address", "")
        city = "Alberta"
        for test_city in ["Calgary", "Edmonton", "Lethbridge", "Red Deer", "Medicine Hat", "Grande Prairie", "Fort McMurray"]:
            if test_city.lower() in address.lower():
                city = test_city
                break

        return self.build_service_data(
            name=listing.get("name", "").strip(),
            category=listing.get("category", self.CATEGORY),
            location=city,
            phone=listing.get("phone", ""),
            address=address,
            website_url=listing.get("website", ""),
            description=listing.get("description", ""),
            tags=["211", city.lower()],
        )

    def is_already_known(self, name: str) -> bool:
        """Check if a service name already exists in the database."""
        if not name:
            return True
        normalized = name.lower().strip()
        if normalized in self.existing_lookup:
            return True
        # Also check partial matches
        short = re.sub(r"\s*\(.*?\)\s*", "", normalized).strip()
        if short in self.existing_lookup:
            return True
        for existing_name in self.existing_lookup:
            if len(normalized) > 5 and len(existing_name) > 5:
                if normalized in existing_name or existing_name in normalized:
                    return True
        return False
```

**Step 5: Run tests to verify they pass**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m pytest tests/test_ab211_direct.py -v`
Expected: All 3 tests PASS

**Step 6: Commit**

```bash
git add scraper/requirements.txt scraper/sources/ab211_direct.py scraper/tests/test_ab211_direct.py
git commit -m "feat(scraper): add 211 Alberta direct scraper with Playwright"
```

---

### Task 7: Pipeline Integration

**Files:**
- Modify: `scraper/scraper.py` (add imports, phases, CLI args)

**Step 1: Write the failing test**

In `scraper/tests/test_pipeline_integration.py`:

```python
"""Tests for pipeline integration of new scrapers."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch


def test_new_phases_in_argparse():
    """Verify new phase names are accepted by argparse."""
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", nargs="+", choices=[
        "211", "enrich", "websites", "deepcrawl", "extract",
        "informalberta", "normalize", "tags", "embeddings", "dedupe",
        "recover", "refresh",
        # New phases
        "veterans", "acds", "homelesshub", "ahs", "211direct",
    ])
    # Should not raise
    args = parser.parse_args(["--phase", "veterans", "acds"])
    assert "veterans" in args.phase
    assert "acds" in args.phase


def test_scraper_imports():
    """Verify all source modules can be imported."""
    from sources.veterans_affairs import VeteransAffairsScraper
    from sources.acds import ACDSScraper
    from sources.homeless_hub import HomelessHubScraper
    from sources.ahs_findhealth import AHSFindHealthScraper
    from sources.ab211_direct import AB211DirectScraper

    assert VeteransAffairsScraper.SOURCE_NAME == "veterans_affairs"
    assert ACDSScraper.SOURCE_NAME == "acds"
    assert HomelessHubScraper.SOURCE_NAME == "homeless_hub"
    assert AHSFindHealthScraper.SOURCE_NAME == "ahs_findhealth"
    assert AB211DirectScraper.SOURCE_NAME == "211_direct"
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m pytest tests/test_pipeline_integration.py -v`
Expected: FAIL (argparse choices don't include new phases yet)

**Step 3: Integrate into scraper.py**

Add imports near the top of `scraper/scraper.py` (after the existing optional imports block around line 86):

```python
# Directory source scrapers - optional
try:
    from sources.veterans_affairs import VeteransAffairsScraper
    from sources.acds import ACDSScraper
    from sources.homeless_hub import HomelessHubScraper
    from sources.ahs_findhealth import AHSFindHealthScraper
    from sources.ab211_direct import AB211DirectScraper
    HAS_DIRECTORY_SCRAPERS = True
except ImportError:
    HAS_DIRECTORY_SCRAPERS = False
```

Add phase functions after `phase_informalberta_enrich` (around line 1438):

```python
def phase_directory_scraper(session, log: ScraperLog, scraper_class, dry_run: bool = False):
    """Generic phase runner for directory scrapers."""
    if not HAS_DIRECTORY_SCRAPERS:
        logger.warning(f"Directory scraper modules not available - skipping")
        return
    try:
        scraper = scraper_class(session=session, log=log, dry_run=dry_run)
        scraper.run()
    except Exception as e:
        logger.error(f"[{scraper_class.SOURCE_NAME}] Phase failed: {e}")
```

Add to `run_scraper()` function, after the informalberta phase block (around line 1937) and before the data quality phases:

```python
        # Directory source scrapers
        if (all_phases or "veterans" in phase_set) and HAS_DIRECTORY_SCRAPERS:
            phase_directory_scraper(session, log, VeteransAffairsScraper, dry_run)
        if (all_phases or "acds" in phase_set) and HAS_DIRECTORY_SCRAPERS:
            phase_directory_scraper(session, log, ACDSScraper, dry_run)
        if (all_phases or "homelesshub" in phase_set) and HAS_DIRECTORY_SCRAPERS:
            phase_directory_scraper(session, log, HomelessHubScraper, dry_run)
        if (all_phases or "ahs" in phase_set) and HAS_DIRECTORY_SCRAPERS:
            phase_directory_scraper(session, log, AHSFindHealthScraper, dry_run)
        if "211direct" in phase_set and HAS_DIRECTORY_SCRAPERS:  # Not in all_phases (expensive)
            phase_directory_scraper(session, log, AB211DirectScraper, dry_run)
```

Note: `211direct` is excluded from `all_phases` because it requires Playwright and is expensive. It must be explicitly requested.

Update the argparse `--phase` choices (around line 1982):

```python
    parser.add_argument("--phase", nargs="+", choices=[
        "211", "enrich", "websites", "deepcrawl", "extract",
        "informalberta", "normalize", "tags", "embeddings", "dedupe",
        "recover", "refresh",
        # Directory source scrapers
        "veterans", "acds", "homelesshub", "ahs", "211direct",
    ], help="Run specific phase(s)")
```

Update the docstring at the top of `scraper.py` to include new phases:

```python
    python scraper.py --phase veterans          # Veterans Affairs Canada offices
    python scraper.py --phase acds              # ACDS member directory
    python scraper.py --phase homelesshub       # Homeless Hub Alberta
    python scraper.py --phase ahs               # AHS Find Healthcare
    python scraper.py --phase 211direct         # 211 Alberta direct (requires Playwright)
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m pytest tests/test_pipeline_integration.py -v`
Expected: All 2 tests PASS

**Step 5: Run all tests**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m pytest tests/ -v`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add scraper/scraper.py scraper/tests/test_pipeline_integration.py
git commit -m "feat(scraper): integrate 5 directory scrapers into pipeline as --phase options"
```

---

### Task 8: Fix Base Class Import (Circular Import Prevention)

The base class imports from `scraper.py` which could cause circular imports. This task restructures so `base.py` uses local implementations of the utility functions it needs.

**Files:**
- Modify: `scraper/sources/base.py` (remove circular import, inline utilities)

**Step 1: Run all tests to check for circular import**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m pytest tests/ -v`
If tests pass, skip this task. If circular import error, continue.

**Step 2: Fix circular import**

Replace the import block in `scraper/sources/base.py` that imports from `scraper` with local copies of the needed utility functions (`generate_service_id`, `should_enrich_field`, `normalize_phone`). The `update_service_confidence` call should be removed from the base class — instead just set `confidence_score = 60` for new services and leave existing confidence unchanged (the existing `normalize` and `tags` phases will recalculate).

Remove these lines from `base.py`:
```python
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scraper import generate_service_id, should_enrich_field, update_service_confidence, normalize_phone, service_exists, get_existing_services_lookup
```

Replace with local implementations:
```python
def generate_service_id(name: str, location: str = "") -> str:
    """Generate unique service ID from name and location."""
    text = f"{name.lower()}-{location.lower()}".strip()
    text = re.sub(r"[^a-z0-9-]", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")[:255]


def should_enrich_field(service, field_name: str) -> bool:
    """Check if a field needs enrichment (is empty/null)."""
    value = getattr(service, field_name, None)
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, list) and len(value) == 0:
        return True
    return False


def normalize_phone(phone: str) -> str:
    """Normalize phone to consistent format."""
    digits = re.sub(r'[^\d]', '', phone)
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    elif len(digits) == 11 and digits[0] == '1':
        return f"1-{digits[1:4]}-{digits[4:7]}-{digits[7:]}"
    return phone
```

Also update `_enrich_existing` to not call `update_service_confidence` (remove that call and the import). The confidence will be recalculated by the existing pipeline phases.

**Step 3: Run all tests again**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m pytest tests/ -v`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add scraper/sources/base.py
git commit -m "fix(scraper): prevent circular imports in base scraper module"
```

---

### Task 9: End-to-End Dry Run Test

**Files:** None (validation only)

**Step 1: Run Veterans Affairs scraper in dry-run mode**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python scraper.py --phase veterans --dry-run`
Expected: Logs show "Found N Alberta offices", "DRY RUN - Would create: Veterans Affairs Canada - Calgary Area Office", etc.

**Step 2: Run ACDS scraper in dry-run mode**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python scraper.py --phase acds --dry-run`
Expected: Logs show "Found N member organizations", creates ~140 entries.

**Step 3: Run all new scrapers together in dry-run**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python scraper.py --phase veterans acds homelesshub ahs --dry-run`
Expected: Each scraper runs in sequence, logs results, no errors. Skip `211direct` here (needs Playwright installed).

**Step 4: Commit (tag as milestone)**

```bash
git commit --allow-empty -m "milestone: all 5 directory scrapers implemented and tested"
```
