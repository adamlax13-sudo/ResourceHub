"""Base class for directory scrapers."""
import logging
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


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


class BaseDirectoryScraper:
    """Base class for all directory scrapers.

    Provides HTTP session management, rate limiting, service upsert logic,
    and field source tracking.
    """

    SOURCE_NAME = "unknown"
    USER_AGENT = "ResourceHubBot/2.0 (+https://resourcehub.ca)"
    RATE_LIMIT_SECONDS = 2
    TIMEOUT_SECONDS = 15

    def __init__(self, session, log, dry_run: bool = False):
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
            self._existing_lookup = self._build_existing_lookup()
        return self._existing_lookup

    def _build_existing_lookup(self) -> Dict:
        """Build lookup of existing services for deduplication."""
        # Import here to avoid circular imports
        from models import Service
        services = self.session.query(Service).filter_by(is_active=True).all()
        lookup = {}
        for s in services:
            normalized = s.name.lower().strip()
            lookup[normalized] = s
            short = re.sub(r"\s*\(.*?\)\s*", "", normalized).strip()
            if short != normalized:
                lookup[short] = s
        return lookup

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
        from models import Service
        name = data.get("name", "").strip()
        if not name:
            return

        location = data.get("location", "Alberta")
        service_id = generate_service_id(name, location)

        # Check exact match
        existing = self.session.query(Service).filter_by(service_id=service_id).first()

        # Check fuzzy match if no exact
        if not existing:
            normalized = name.lower().strip()
            for key, svc in self.existing_lookup.items():
                if self._fuzzy_match(normalized, key) > 0.85:
                    existing = svc
                    break

        if existing:
            self._enrich_existing(existing, data)
        else:
            self._create_new(service_id, data)

    def _enrich_existing(self, service, data: Dict):
        """Enrich existing service with new data (empty fields only)."""
        enrichable = ["description", "phone", "email", "address", "website_url",
                      "hours_of_operation", "eligibility", "contact"]
        updated = False

        for field in enrichable:
            if data.get(field) and should_enrich_field(service, field):
                setattr(service, field, data[field])
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
            service.last_updated = datetime.now()
            self.stats["enriched"] += 1
            logger.info(f"[{self.SOURCE_NAME}] Enriched: {service.name}")
        else:
            self.stats["skipped"] += 1

    def _create_new(self, service_id: str, data: Dict):
        """Create a new service record."""
        from models import Service
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
