"""
Standalone service upsert module.

Extracted from BaseDirectoryScraper to be usable by the pipeline
without requiring the full scraper class hierarchy.
"""
import hashlib
import logging
import re
from datetime import datetime
from typing import Optional

from sources.plugin import RawService

logger = logging.getLogger(__name__)


def compute_page_hash(content: str) -> str:
    """SHA-256 hash of page content for change detection."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def fuzzy_match(a: str, b: str) -> float:
    """Character-level LCS similarity ratio (no external deps).

    Returns a float between 0.0 and 1.0.
    """
    a, b = a.lower().strip(), b.lower().strip()
    if a == b:
        return 1.0
    if not a or not b:
        return 0.0
    len_a, len_b = len(a), len(b)
    matrix = [[0] * (len_b + 1) for _ in range(len_a + 1)]
    for i in range(1, len_a + 1):
        for j in range(1, len_b + 1):
            if a[i - 1] == b[j - 1]:
                matrix[i][j] = matrix[i - 1][j - 1] + 1
            else:
                matrix[i][j] = max(matrix[i - 1][j], matrix[i][j - 1])
    lcs_len = matrix[len_a][len_b]
    return (2.0 * lcs_len) / (len_a + len_b)


def generate_service_id(name: str, location: str = "") -> str:
    """Generate a unique service ID from name and location."""
    text = f"{name.lower()}-{location.lower()}".strip()
    text = re.sub(r"[^a-z0-9-]", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")[:255]


def _should_enrich_field(service, field_name: str) -> bool:
    """Check if a field is empty/null and should be filled."""
    value = getattr(service, field_name, None)
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, list) and len(value) == 0:
        return True
    return False


def _enrich_existing(service, raw: RawService, source_name: str, log, dry_run: bool) -> bool:
    """Fill empty fields on an existing service. Never overwrites.

    Returns True if any field was updated.
    """
    enrichable_map = {
        "description": raw.description,
        "phone": raw.phone,
        "email": raw.email,
        "address": raw.address,
        "website_url": raw.website_url,
        "hours_of_operation": raw.hours,
        "eligibility": raw.eligibility,
        "contact": raw.contact,
    }

    updated = False
    for field, value in enrichable_map.items():
        if value and _should_enrich_field(service, field):
            if not dry_run:
                setattr(service, field, value)
            updated = True

    # Merge tags
    if raw.tags:
        existing_tags = set(service.tags) if isinstance(getattr(service, "tags", None), list) else set()
        new_tags = set(raw.tags)
        merged = list(existing_tags | new_tags)
        if len(merged) > len(existing_tags):
            if not dry_run:
                service.tags = merged
            updated = True

    if updated and not dry_run:
        service.last_updated = datetime.now()
        if log is not None:
            log.services_updated = getattr(log, "services_updated", 0) + 1

    return updated


def _create_new(session, log, raw: RawService, source_name: str, dry_run: bool):
    """Insert a brand-new service record."""
    from models import Service

    location = raw.location or "Alberta"
    service_id = generate_service_id(raw.name, location)

    if dry_run:
        logger.info(f"[{source_name}] DRY RUN - Would create: {raw.name}")
        return

    # Build contact string from available parts
    contact_parts = [p for p in [raw.phone, raw.email, raw.website_url] if p]

    service = Service(
        service_id=service_id,
        name=raw.name,
        category=raw.category,
        description=raw.description,
        location=location,
        contact=raw.contact or ", ".join(contact_parts),
        phone=raw.phone,
        email=raw.email,
        address=raw.address,
        website_url=raw.website_url,
        hours_of_operation=raw.hours,
        eligibility=raw.eligibility,
        tags=raw.tags or [],
        confidence_score=60,
        source_urls=[source_name],
    )
    session.add(service)
    if log is not None:
        log.services_created = getattr(log, "services_created", 0) + 1
    logger.info(f"[{source_name}] Created: {raw.name}")


def upsert_service(
    session,
    log,
    raw: RawService,
    source_name: str,
    page_content: Optional[str] = None,
    dry_run: bool = False,
) -> str:
    """Upsert a single service. Returns 'created', 'enriched', or 'skipped'.

    Args:
        session:      SQLAlchemy session (or mock).
        log:          ScraperLog-like object with counters.
        raw:          RawService dataclass from a source plugin.
        source_name:  Identifier for the scraper/source.
        page_content: Raw HTML/text of the source page (for hash-based skip).
        dry_run:      If True, don't write to the DB.

    Logic:
        1. If page_content given and existing service has the same hash -> 'skipped'
        2. Query existing services, fuzzy match by name (threshold 0.85)
        3. Match found -> enrich empty fields only -> 'enriched' or 'skipped'
        4. No match  -> create new record -> 'created'
    """
    from models import Service

    name = raw.name.strip() if raw.name else ""
    if not name:
        return "skipped"

    location = raw.location or "Alberta"
    service_id = generate_service_id(name, location)

    # --- exact match by service_id ---
    existing = session.query(Service).filter_by(service_id=service_id).first()

    # --- fuzzy match against all active services ---
    if not existing:
        all_active = session.query(Service).filter(Service.is_active == True).all()
        normalized = name.lower().strip()
        for svc in all_active:
            svc_name = (svc.name or "").lower().strip()
            if fuzzy_match(normalized, svc_name) > 0.85:
                existing = svc
                break

    # --- hash-based skip (page unchanged) ---
    if existing and page_content is not None:
        new_hash = compute_page_hash(page_content)
        if getattr(existing, "source_page_hash", None) == new_hash:
            return "skipped"
        # Update hash for next run
        if not dry_run:
            existing.source_page_hash = new_hash

    # --- enrich or create ---
    if existing:
        changed = _enrich_existing(existing, raw, source_name, log, dry_run)
        return "enriched" if changed else "skipped"
    else:
        _create_new(session, log, raw, source_name, dry_run)
        return "created"
