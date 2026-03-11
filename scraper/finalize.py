"""
Finalize phase functions for the pipeline.

Phase 3 (Finalize) runs after discover + enrich to:
  - Normalize contact info (extract phone, email, address)
  - Enhance searchable tags
  - Generate vector embeddings
  - Deduplicate services
  - Refresh materialized views
"""

import logging
import os
import re
import time
from urllib.parse import quote
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, Optional, Set

from sqlalchemy import and_, or_, func, text

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants used by tag enhancement
# ---------------------------------------------------------------------------

ALBERTA_LOCATIONS = {
    "calgary": ["calgary", "yyc"], "edmonton": ["edmonton", "yeg"],
    "red deer": ["red deer"], "lethbridge": ["lethbridge"],
    "medicine hat": ["medicine hat"], "grande prairie": ["grande prairie"],
    "fort mcmurray": ["fort mcmurray", "wood buffalo"],
    "airdrie": ["airdrie"], "st. albert": ["st. albert", "st albert"],
    "spruce grove": ["spruce grove"], "leduc": ["leduc"],
    "alberta": ["alberta", "province-wide", "provincewide"],
}

SERVICE_TYPES = {
    "residential": ["residential", "inpatient", "live-in", "treatment centre"],
    "outpatient": ["outpatient", "day program"], "counselling": ["counselling", "counseling", "therapy"],
    "peer support": ["peer support", "peer-led", "lived experience"],
    "crisis": ["crisis", "emergency", "urgent", "24/7", "hotline"],
    "shelter": ["shelter", "emergency housing", "safe house"],
    "detox": ["detox", "detoxification", "withdrawal management"],
    "harm reduction": ["harm reduction", "needle exchange", "naloxone"],
    "support group": ["support group", "aa", "na", "12 step"],
    "drop-in": ["drop-in", "walk-in"], "mobile": ["mobile", "outreach"],
    "online": ["online", "virtual", "telehealth"],
}

TARGET_POPULATIONS = {
    "youth": ["youth", "teen", "adolescent"], "adult": ["adult", "18+"],
    "senior": ["senior", "elder", "65+"], "women": ["women", "female", "mothers"],
    "men": ["men", "male"], "lgbtq+": ["lgbtq", "lgbt", "queer", "transgender"],
    "indigenous": ["indigenous", "first nations", "metis", "inuit"],
    "newcomer": ["newcomer", "immigrant", "refugee"],
    "family": ["family", "parent", "children"], "homeless": ["homeless", "unhoused"],
}

TREATMENT_TYPES = {
    "addiction": ["addiction", "substance use", "drug", "alcohol", "opioid"],
    "mental health": ["mental health", "depression", "anxiety", "ptsd"],
    "gambling": ["gambling"], "trauma": ["trauma", "ptsd", "abuse"],
    "grief": ["grief", "bereavement"], "domestic violence": ["domestic violence", "family violence"],
    "dual diagnosis": ["dual diagnosis", "concurrent disorder"],
}

# Embedding configuration
EMBEDDING_MODEL = "text-embedding-3-large"
EMBEDDING_DIMENSIONS = 1536  # Truncate to 1536 dims (same schema, better quality)
EMBEDDING_BATCH_SIZE = 100
RATE_LIMIT_DELAY = 0.1


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def normalize_phone(phone: str) -> str:
    """Normalize phone to consistent format."""
    digits = re.sub(r'[^\d]', '', phone)
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    elif len(digits) == 11 and digits[0] == '1':
        return f"1-{digits[1:4]}-{digits[4:7]}-{digits[7:]}"
    return phone


# ---------------------------------------------------------------------------
# Phase functions
# ---------------------------------------------------------------------------

def phase_normalize_contacts(session, log, dry_run: bool = False):
    """Normalize contact information (extract phone, email, address)."""
    from models import Service

    logger.info("=== Finalize: Normalize Contacts ===")

    phone_regex = re.compile(r'(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}', re.I)
    email_regex = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', re.I)
    # Requires http(s):// or www. prefix to avoid false positives on names like "Dr. Smith"
    # Tradeoff: bare domains (e.g. "albertahealthservices.ca") are not extracted
    url_regex = re.compile(r'(?:https?://|www\.)[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z]{2,})+(?:/[^\s,]*)?', re.I)

    all_services = session.query(Service).filter(
        or_(
            Service.phone.is_(None),
            Service.email.is_(None),
            Service.address.is_(None),
        )
    ).all()
    updated_count = 0

    for service in all_services:
        contact = service.contact or ""
        changes = False

        # Extract phone
        if not service.phone:
            phones = phone_regex.findall(contact)
            if phones:
                service.phone = normalize_phone(phones[0])
                changes = True

        # Extract email
        if not service.email:
            emails = email_regex.findall(contact)
            if emails:
                service.email = emails[0]
                changes = True

        # Extract website
        if not service.website_url:
            urls = [u for u in url_regex.findall(contact) if '@' not in u]
            if urls:
                url = urls[0]
                if not url.startswith('http'):
                    url = 'https://' + url
                service.website_url = url
                changes = True

        # Extract address from description field
        if not service.address and service.description:
            match = re.search(r'Address:\s*([^|]+)', service.description, re.I)
            if match:
                service.address = match.group(1).strip()
                changes = True

        if changes and not dry_run:
            service.last_updated = datetime.now()
            updated_count += 1

    if not dry_run:
        session.commit()
    if hasattr(log, 'services_updated'):
        log.services_updated += updated_count
    logger.info(f"Normalized {updated_count} services")


def phase_geocode_services(session, log, dry_run: bool = False):
    """Geocode services that have an address but no coordinates via Mapbox API."""
    import requests
    from models import Service

    logger.info("=== Finalize: Geocode Services ===")

    token = os.environ.get("MAPBOX_SECRET_TOKEN")
    if not token:
        logger.warning("MAPBOX_SECRET_TOKEN not set — skipping geocoding")
        return

    MAPBOX_BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places"
    ALBERTA_BBOX = "-120.0,49.0,-110.0,60.0"
    RELEVANCE_THRESHOLD = 0.6

    # Skip crisis lines and virtual/province-wide services without a street address
    VIRTUAL_PATTERNS = [
        "alberta%", "province%", "serving alberta%", "%alberta-wide%",
        "virtual%", "online%", "%phone%", "%toll%",
    ]
    virtual_filter = and_(
        or_(Service.address.is_(None), func.trim(Service.address) == ""),
        or_(*[Service.location.ilike(p) for p in VIRTUAL_PATTERNS]),
    )
    services = session.query(Service).filter(
        Service.latitude.is_(None),
        Service.is_active.is_(True),
        Service.category != "Crisis Lines",
        ~virtual_filter,
        or_(
            Service.address.isnot(None),
            Service.location.isnot(None),
        ),
    ).all()

    if not services:
        logger.info("No services need geocoding")
        return

    logger.info(f"Found {len(services)} services to geocode")
    geocoded = 0
    skipped = 0

    for svc in services:
        # Use address if available; for location-only, append Alberta context
        if svc.address:
            query_text = svc.address.strip()
        elif svc.location:
            query_text = f"{svc.location.strip()}, Alberta, Canada"
        else:
            query_text = ""
        if not query_text:
            continue

        try:
            url = f"{MAPBOX_BASE}/{quote(query_text)}.json"
            resp = requests.get(url, params={
                "access_token": token,
                "country": "ca",
                "bbox": ALBERTA_BBOX,
                "limit": "1",
            }, timeout=5)
            resp.raise_for_status()
            data = resp.json()

            features = data.get("features", [])
            if not features or features[0].get("relevance", 0) < RELEVANCE_THRESHOLD:
                logger.debug(f"Low relevance for {svc.service_id}: {query_text}")
                skipped += 1
                continue

            feature = features[0]
            lng, lat = feature["center"]

            if not dry_run:
                svc.latitude = lat
                svc.longitude = lng
                svc.geocode_source = "mapbox"
                svc.geocoded_at = datetime.now()
                geocoded += 1

            # Rate limit: ~10 req/sec
            time.sleep(0.1)

        except Exception as e:
            logger.warning(f"Geocode failed for {svc.service_id}: {e}")
            continue

    if not dry_run:
        session.commit()
    logger.info(f"Geocoded {geocoded} services, skipped {skipped} (low relevance)")


def phase_enhance_tags(session, log, dry_run: bool = False):
    """Enhance service tags with searchable keywords."""
    from models import Service

    logger.info("=== Finalize: Enhance Tags ===")

    def extract_keywords(text_str: str, keyword_map: Dict) -> Set[str]:
        if not text_str:
            return set()
        text_lower = text_str.lower()
        found = set()
        for tag, keywords in keyword_map.items():
            for kw in keywords:
                # Use word boundary matching to prevent false positives
                # (e.g., "men" matching "mental", "women", "treatment")
                if re.search(r'\b' + re.escape(kw) + r'\b', text_lower):
                    found.add(tag)
                    break
        return found

    all_services = session.query(Service).filter(Service.is_active == True).all()
    updated_count = 0

    for service in all_services:
        combined_text = " ".join(filter(None, [service.name, service.description, service.category, service.eligibility]))
        tags = set()

        # Location tags
        for city, variants in ALBERTA_LOCATIONS.items():
            for v in variants:
                if v in (service.location or "").lower() or v in combined_text.lower():
                    tags.add(city)
                    break

        # Service type, population, treatment tags
        tags.update(extract_keywords(combined_text, SERVICE_TYPES))
        tags.update(extract_keywords(combined_text, TARGET_POPULATIONS))
        tags.update(extract_keywords(combined_text, TREATMENT_TYPES))

        # Note: category is NOT added as a tag — it's already in embedding text
        # twice ("Category: X" and "This is a X service.") and adding it as a tag
        # was redundant, inflating tag arrays with no search signal benefit.

        # Existing tags
        if isinstance(service.tags, list):
            for t in service.tags:
                if isinstance(t, str):
                    tags.add(t.lower().strip())

        new_tags = sorted([t for t in tags if t and len(t) > 1])
        old_tags = service.tags if isinstance(service.tags, list) else []

        if set(new_tags) != set(old_tags):
            if not dry_run:
                service.tags = new_tags
                service.last_updated = datetime.now()
            updated_count += 1

    if not dry_run:
        session.commit()
    if hasattr(log, 'services_updated'):
        log.services_updated += updated_count
    logger.info(f"Enhanced tags for {updated_count} services")


def phase_generate_embeddings(session, client: Optional[Any], log, regenerate_all: bool = False):
    """Generate vector embeddings for semantic search."""
    logger.info("=== Finalize: Generate Embeddings ===")
    if not client:
        logger.warning("OpenAI client unavailable - skipping embeddings")
        return

    # Check if embedding column exists
    try:
        session.execute(text("SELECT embedding FROM services LIMIT 1"))
    except Exception as e:
        logger.warning(f"Embedding column not found - run migrations first. Error: {e}")
        return

    # Get services needing embeddings (batched to avoid unbounded memory usage)
    EMBED_FETCH_BATCH = 500
    if regenerate_all:
        services = session.execute(text(
            "SELECT service_id, name, category, description, eligibility, location, tags "
            "FROM services WHERE is_active = true ORDER BY service_id"
        )).fetchall()
    else:
        services = []
        offset = 0
        while True:
            batch = session.execute(text(
                "SELECT service_id, name, category, description, eligibility, location, tags "
                "FROM services WHERE is_active = true AND embedding IS NULL "
                "ORDER BY service_id LIMIT :limit OFFSET :offset"
            ), {"limit": EMBED_FETCH_BATCH, "offset": offset}).fetchall()
            if not batch:
                break
            services.extend(batch)
            offset += EMBED_FETCH_BATCH

    if not services:
        logger.info("No services need embeddings")
        return

    logger.info(f"Generating embeddings for {len(services)} services")
    columns = ["service_id", "name", "category", "description", "eligibility", "location", "tags"]
    batch = []

    for row in services:
        svc = dict(zip(columns, row))
        # Build embedding text — category is repeated to strengthen category signal
        # in embedding space and reduce cross-category confusion (e.g., dental vs mental health)
        parts = []
        if svc.get("name"):
            parts.append(f"Service: {svc['name']}")
        if svc.get("category"):
            parts.append(f"Category: {svc['category']}")
            parts.append(f"This is a {svc['category']} service.")
        if svc.get("description"):
            parts.append(f"Description: {svc['description']}")
        if svc.get("eligibility"):
            parts.append(f"Eligibility: {svc['eligibility']}")
        if svc.get("location"):
            parts.append(f"Location: {svc['location']}")
        if svc.get("tags") and isinstance(svc["tags"], list):
            parts.append(f"Tags: {', '.join(svc['tags'])}")

        embed_text = "\n".join(parts)[:30000]

        try:
            response = client.embeddings.create(model=EMBEDDING_MODEL, input=embed_text, dimensions=EMBEDDING_DIMENSIONS)
            embedding = response.data[0].embedding
            batch.append((svc["service_id"], embedding))

            if len(batch) >= EMBEDDING_BATCH_SIZE:
                for sid, emb in batch:
                    session.execute(text(
                        "UPDATE services SET embedding = CAST(:emb AS vector), embedding_updated_at = NOW() "
                        "WHERE service_id = :sid"
                    ), {"emb": f"[{','.join(map(str, emb))}]", "sid": sid})
                session.commit()
                logger.info(f"Saved {len(batch)} embeddings")
                batch = []

            time.sleep(RATE_LIMIT_DELAY)
        except Exception as e:
            logger.error(f"Embedding failed for {svc['service_id']}: {e}")

    # Save remaining
    if batch:
        for sid, emb in batch:
            session.execute(text(
                "UPDATE services SET embedding = CAST(:emb AS vector), embedding_updated_at = NOW() "
                "WHERE service_id = :sid"
            ), {"emb": f"[{','.join(map(str, emb))}]", "sid": sid})
        session.commit()
        logger.info(f"Saved final {len(batch)} embeddings")

    if hasattr(log, 'services_updated'):
        log.services_updated += len(services)


def phase_dedupe_services(session, log, dry_run: bool = False):
    """Clean up redundant/duplicate services."""
    from models import Service

    logger.info("=== Finalize: Deduplicate Services ===")

    def normalize_name(name: str) -> str:
        name = name.lower().strip()
        name = re.sub(r'\s*-\s*(calgary|edmonton|red deer|lethbridge|medicine hat|grande prairie|fort mcmurray|alberta)\s*$', '', name, flags=re.I)
        name = re.sub(r'^(calgary|edmonton|red deer|lethbridge)\s*-?\s*', '', name, flags=re.I)
        return re.sub(r'\s+', ' ', name)

    services = session.query(Service).filter_by(is_active=True).all()
    by_name = defaultdict(list)
    for svc in services:
        by_name[normalize_name(svc.name)].append(svc)

    deactivated = 0

    for norm_name, group in by_name.items():
        if len(group) < 2:
            continue

        locations = [s.location or '' for s in group]
        has_provincial = any('alberta' in loc.lower() or 'province' in loc.lower() for loc in locations)
        has_local = any(city in loc.lower() for loc in locations for city in ['calgary', 'edmonton', 'red deer', 'lethbridge', 'medicine hat'])

        if has_provincial and has_local:
            for svc in group:
                loc = (svc.location or '').lower()
                if 'alberta' in loc or 'province' in loc:
                    if not dry_run:
                        svc.is_active = False
                    deactivated += 1
                    logger.info(f"Deactivating: {svc.name} ({svc.location})")
                    break

    if not dry_run:
        session.commit()
    if hasattr(log, 'services_deactivated'):
        log.services_deactivated += deactivated
    else:
        log.services_deactivated = deactivated
    logger.info(f"Deactivated {deactivated} redundant services")


def phase_refresh_views(session, log):
    """Refresh materialized views for search."""
    logger.info("=== Finalize: Refresh Views ===")
    try:
        session.execute(text("REFRESH MATERIALIZED VIEW mv_service_search"))
        session.commit()
        logger.info("Materialized view refreshed")
    except Exception as e:
        logger.warning(f"Failed to refresh view (may not exist): {e}")


__all__ = [
    "phase_normalize_contacts",
    "phase_geocode_services",
    "phase_enhance_tags",
    "phase_generate_embeddings",
    "phase_dedupe_services",
    "phase_refresh_views",
]
