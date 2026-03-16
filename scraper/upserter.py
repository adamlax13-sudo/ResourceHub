"""
Standalone service upsert module.

Extracted from BaseDirectoryScraper to be usable by the pipeline
without requiring the full scraper class hierarchy.
"""
import hashlib
import json
import logging
import re
from datetime import datetime
from typing import Optional

from sources.plugin import RawService

logger = logging.getLogger(__name__)


def compute_page_hash(content: str) -> str:
    """SHA-256 hash of page content for change detection."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


# O(n*m) character-level LCS — acceptable for current dataset (~500 services).
# If scaling past 5K, consider pg_trgm index for fuzzy matching.
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


def _get_active_services_cache(session, force_refresh=False):
    """Cache active services to avoid repeated full-table scans."""
    if force_refresh or not hasattr(_get_active_services_cache, "_cache"):
        from models import Service
        rows = session.query(Service.name, Service.service_id).filter(Service.is_active == True).all()
        _get_active_services_cache._cache = [(r.name, r.service_id) for r in rows]
        logger.info(f"Cached {len(_get_active_services_cache._cache)} active services for fuzzy matching")
    return _get_active_services_cache._cache


def invalidate_service_cache():
    """Clear the cached services list (call after bulk commits)."""
    if hasattr(_get_active_services_cache, "_cache"):
        del _get_active_services_cache._cache


def _raw_service_to_dict(raw: RawService) -> dict:
    """Serialize a RawService dataclass to a plain dict for JSON storage."""
    return {
        "name": raw.name,
        "category": raw.category,
        "source_url": raw.source_url,
        "location": raw.location,
        "phone": raw.phone,
        "email": raw.email,
        "address": raw.address,
        "website_url": raw.website_url,
        "hours": raw.hours,
        "description": raw.description,
        "eligibility": raw.eligibility,
        "tags": raw.tags,
        "contact": raw.contact,
        "extra": raw.extra,
    }


def _service_to_dict(service) -> dict:
    """Serialize an ORM Service object's current values to a plain dict."""
    fields = [
        "id", "service_id", "name", "category", "description", "location",
        "contact", "eligibility", "phone", "email", "address",
        "hours_of_operation", "website_url", "tags", "confidence_score",
        "source_urls", "is_active", "gender_restriction", "is_24_7",
        "process_steps", "required_docs", "wait_times",
    ]
    result = {}
    for f in fields:
        val = getattr(service, f, None)
        # Ensure datetimes and other non-serializable types are strings
        if hasattr(val, "isoformat"):
            val = val.isoformat()
        result[f] = val
    return result


def _insert_change_request(
    session,
    service_id_int: Optional[int],
    change_type: str,
    raw: RawService,
    source_name: str,
    previous_values: Optional[dict],
    batch_id: Optional[str],
    status: str = "pending",
):
    """Insert a row into service_change_requests using raw SQL."""
    from sqlalchemy import text

    proposed = _raw_service_to_dict(raw)
    sql = text("""
        INSERT INTO service_change_requests
            (service_id, change_type, proposed_changes, previous_values,
             source, source_plugin, source_url, status, batch_id)
        VALUES
            (:service_id, :change_type, :proposed_changes::jsonb, :previous_values::jsonb,
             :source, :source_plugin, :source_url, :status, :batch_id)
    """)
    session.execute(sql, {
        "service_id": service_id_int,
        "change_type": change_type,
        "proposed_changes": json.dumps(proposed),
        "previous_values": json.dumps(previous_values) if previous_values is not None else None,
        "source": source_name,
        "source_plugin": source_name,
        "source_url": raw.source_url,
        "status": status,
        "batch_id": batch_id,
    })


def upsert_service(
    session,
    log,
    raw: RawService,
    source_name: str,
    page_content: Optional[str] = None,
    dry_run: bool = False,
    review_mode: bool = True,
    batch_id: Optional[str] = None,
) -> str:
    """Upsert a single service. Returns 'created', 'enriched', or 'skipped'.

    Args:
        session:      SQLAlchemy session (or mock).
        log:          ScraperLog-like object with counters.
        raw:          RawService dataclass from a source plugin.
        source_name:  Identifier for the scraper/source.
        page_content: Raw HTML/text of the source page (for hash-based skip).
        dry_run:      If True, don't write to the DB.
        review_mode:  If True (default), write to service_change_requests
                      instead of directly to services. Admin must approve.
                      If False, write directly to services (legacy behavior)
                      and also create an 'approved' audit record.
        batch_id:     Batch identifier for grouping change requests.

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

    # --- fuzzy match against cached active services ---
    if not existing:
        all_active = _get_active_services_cache(session)
        normalized = name.lower().strip()
        for cached_name, cached_id in all_active:
            svc_name = (cached_name or "").lower().strip()
            if fuzzy_match(normalized, svc_name) > 0.85:
                existing = session.query(Service).filter_by(service_id=cached_id).first()
                break

    # --- hash-based skip (page unchanged) ---
    if existing and page_content is not None:
        new_hash = compute_page_hash(page_content)
        if getattr(existing, "source_page_hash", None) == new_hash:
            return "skipped"
        # Update hash for next run (only when writing directly)
        if not dry_run and not review_mode:
            existing.source_page_hash = new_hash

    # --- determine outcome: enrich or create ---
    if existing:
        # Check whether there is anything to enrich
        changed = _enrich_existing(existing, raw, source_name, log, dry_run=True)
        if not changed:
            return "skipped"

        outcome = "enriched"
        if review_mode:
            if not dry_run:
                previous = _service_to_dict(existing)
                _insert_change_request(
                    session,
                    service_id_int=existing.id,
                    change_type="update",
                    raw=raw,
                    source_name=source_name,
                    previous_values=previous,
                    batch_id=batch_id,
                    status="pending",
                )
        else:
            # Direct write — apply changes and create audit record
            _enrich_existing(existing, raw, source_name, log, dry_run=dry_run)
            if not dry_run:
                _insert_change_request(
                    session,
                    service_id_int=existing.id,
                    change_type="update",
                    raw=raw,
                    source_name=source_name,
                    previous_values=_service_to_dict(existing),
                    batch_id=batch_id,
                    status="approved",
                )
    else:
        outcome = "created"
        if review_mode:
            if not dry_run:
                _insert_change_request(
                    session,
                    service_id_int=None,
                    change_type="create",
                    raw=raw,
                    source_name=source_name,
                    previous_values=None,
                    batch_id=batch_id,
                    status="pending",
                )
        else:
            # Direct write — create service and audit record
            _create_new(session, log, raw, source_name, dry_run)
            if not dry_run:
                _insert_change_request(
                    session,
                    service_id_int=None,
                    change_type="create",
                    raw=raw,
                    source_name=source_name,
                    previous_values=None,
                    batch_id=batch_id,
                    status="approved",
                )

    return outcome
