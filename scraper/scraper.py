"""
Unified Alberta Service Scraper.

Combines reference data sync, 211 Alberta discovery, and website enrichment
into a single script. Designed to run monthly on the 1st via Render cron job.

Phases:
  1. Reference Data Sync     — sync hardcoded reference services, scrape websites
  2. 211 Alberta Discovery   — find new services on ab.211.ca via OpenAI web search
  3. 211 Enrichment          — fill sparse fields from 211 Alberta data
  4. Website Enrichment      — scrape/re-scrape service websites for updated info
  5. InformAlberta Enrichment — enrich existing services using informalberta.ca
  6. Inactive Recovery       — enrich inactive services and reactivate if sufficient data

Usage:
  python scraper.py                       # Full run (phases 1-5, excludes recover)
  python scraper.py --phase reference     # Only reference data sync
  python scraper.py --phase 211           # Only 211 discovery + insert
  python scraper.py --phase enrich        # Only 211 enrichment of sparse services
  python scraper.py --phase websites      # Only website scraping/enrichment
  python scraper.py --phase informalberta # Only InformAlberta enrichment
  python scraper.py --phase recover       # Only inactive service recovery
"""
import argparse
import json
import logging
import os
import re
import time
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

load_dotenv()

from models import Base, Service, ServiceHistory, ScraperLog

try:
    from openai import OpenAI as OpenAIClient
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

# ──────────────────────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://user:password@localhost:5432/recovery_hub",
)
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

# 211 Alberta search categories
SEARCH_CATEGORIES = [
    "mental health counselling services",
    "addiction treatment programs",
    "crisis intervention services",
    "youth mental health services",
    "Indigenous mental health and wellness services",
    "women's shelters and domestic violence services",
    "emergency shelters and housing support",
    "food banks and meal programs",
    "substance abuse recovery and treatment centres",
    "LGBTQ+ support services",
    "family counselling services",
    "grief and bereavement support",
    "employment and job training programs",
    "newcomer and immigrant support services",
    "disability support services",
    "seniors mental health services",
    "harm reduction services",
    "eating disorder support",
    "gambling addiction support",
    "trauma and PTSD support services",
    "peer support programs",
    "outreach and mobile crisis teams",
    "detox centres",
    "transitional housing programs",
    "legal aid for mental health and social issues",
]

MAJOR_REGIONS = ["Calgary", "Edmonton", "Alberta province-wide"]
SECONDARY_REGIONS = [
    "Lethbridge", "Red Deer", "Medicine Hat", "Grande Prairie", "Fort McMurray",
]

# Keywords that trigger searching secondary regions for a category
EXPANDED_SEARCH_KEYWORDS = [
    "shelter", "crisis", "food", "addiction", "mental health counselling",
]

# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────


def init_openai() -> Optional[OpenAIClient]:
    """Initialize and return an OpenAI client, or None if unavailable."""
    if not HAS_OPENAI:
        logger.warning("openai package not installed — AI features disabled")
        return None

    api_key = os.getenv("AI_INTEGRATIONS_OPENAI_API_KEY")
    if not api_key:
        logger.warning("AI_INTEGRATIONS_OPENAI_API_KEY not set — AI features disabled")
        return None

    kwargs: dict = {"api_key": api_key}
    base_url = os.getenv("AI_INTEGRATIONS_OPENAI_BASE_URL")
    if base_url:
        kwargs["base_url"] = base_url

    try:
        client = OpenAIClient(**kwargs)
        logger.info("OpenAI client initialized")
        return client
    except Exception as e:
        logger.error(f"Failed to initialize OpenAI client: {e}")
        return None


def generate_service_id(name: str, location: str = "") -> str:
    """Generate a unique service ID from name and location."""
    text = f"{name.lower()}-{location.lower()}".strip()
    text = re.sub(r"[^a-z0-9-]", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")[:255]


def safe_string(value, max_len: int = 0) -> str:
    """Coerce a value to a plain string, handling dicts/lists from AI output."""
    if value is None:
        return ""
    if isinstance(value, dict):
        return ", ".join(f"{k}: {v}" for k, v in value.items())
    if isinstance(value, list):
        return json.dumps(value)
    s = str(value)
    return s[:max_len] if max_len else s


# ──────────────────────────────────────────────────────────────────────────────
# Website Scraping (used by Phase 1 and Phase 4)
# ──────────────────────────────────────────────────────────────────────────────


def extract_urls(text: str) -> List[str]:
    """Extract URLs from a text string."""
    url_pattern = r"https?://[^\s,]+"
    domain_pattern = r"[a-zA-Z0-9][-a-zA-Z0-9]*\.(?:ca|com|org|net|edu|gov)(?:/[^\s,]*)?"
    urls = re.findall(url_pattern, text)
    for domain in re.findall(domain_pattern, text):
        if not domain.startswith("http"):
            urls.append(f"https://{domain}")
    return list(set(urls))


def find_website_with_ai(client: OpenAIClient, name: str, location: str, category: str) -> Optional[str]:
    """Use OpenAI web search to find a service's official website."""
    try:
        response = client.responses.create(
            model="gpt-4o-mini",
            tools=[{"type": "web_search"}],
            input=(
                f'Find the official website URL for "{name}" located in {location or "Alberta, Canada"}. '
                f"This is a {category or 'social service'} organization in Alberta, Canada. "
                f'Return ONLY the main website URL, nothing else. '
                f'If you cannot find it, respond with "NOT_FOUND".'
            ),
        )
        result_text = response.output_text.strip()
        if "NOT_FOUND" in result_text:
            return None
        found = re.findall(r"https?://[^\s\)\]\"'<>,]+", result_text)
        return found[0].rstrip(".") if found else None
    except Exception as e:
        logger.error(f"AI web search failed for {name}: {e}")
        return None


def scrape_website(url: str) -> Dict:
    """Scrape a website and return raw page text + basic extracted data."""
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; ServiceBot/1.0; +http://recoveryoncampusalberta.ca)",
    }
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.content, "html.parser")

        for tag in soup(["script", "style", "nav", "footer", "header"]):
            tag.decompose()

        page_text = re.sub(r"\s+", " ", soup.get_text(separator=" ", strip=True))
        return {"page_text": page_text[:4000], "data_source": url}

    except requests.RequestException as e:
        logger.warning(f"Failed to scrape {url}: {e}")
        return {}


def enrich_with_ai(client: OpenAIClient, page_text: str, name: str, category: str) -> Optional[Dict]:
    """Use OpenAI to extract structured service data from webpage text."""
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a data extraction assistant. Given webpage content from an Alberta "
                        "service organization, extract structured information. Return a JSON object with "
                        "ONLY the fields where you found clear, reliable information on the page. "
                        "Use null for any field where the information is not clearly available.\n\n"
                        "Fields to extract:\n"
                        '- "description": A clear 2-3 sentence description of what this service provides\n'
                        '- "hours_of_operation": Current hours (e.g., "Mon-Fri 9am-5pm", "24/7")\n'
                        '- "service_format": One of "in-person", "virtual", "hybrid", or null\n'
                        '- "languages_supported": Array of languages offered\n'
                        '- "booking_url": Direct URL for booking/referral/intake if different from main page\n'
                        '- "contact": Contact info (phone/email) if clearly listed\n'
                        '- "eligibility": Who can access this service\n'
                        '- "tags": Array of 5-10 relevant search keywords\n\n'
                        "Rules:\n"
                        "- Only include data you are confident about from the webpage\n"
                        "- Do NOT guess or fabricate information\n"
                        "- For tags, generate keywords based on service type, target population, treatments"
                    ),
                },
                {
                    "role": "user",
                    "content": f"Service: {name}\nCategory: {category}\n\nWebpage content:\n{page_text}",
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        result = json.loads(completion.choices[0].message.content)
        enriched = {k: v for k, v in result.items() if v is not None}
        return enriched if enriched else None
    except Exception as e:
        logger.error(f"AI enrichment failed for {name}: {e}")
        return None


# ──────────────────────────────────────────────────────────────────────────────
# 211 Alberta Discovery (Phase 2)
# ──────────────────────────────────────────────────────────────────────────────


def get_existing_services_lookup(session) -> Dict:
    """Build a lookup dict of existing active services for deduplication."""
    services = session.query(Service).filter_by(is_active=True).all()
    lookup: Dict = {}
    for s in services:
        normalized = s.name.lower().strip()
        lookup[normalized] = s
        short = re.sub(r"\s*\(.*?\)\s*", "", normalized).strip()
        if short != normalized:
            lookup[short] = s
    return lookup


def service_exists(name: str, existing: Dict) -> bool:
    """Check if a service already exists in the lookup."""
    normalized = name.lower().strip()
    if normalized in existing:
        return True
    short = re.sub(r"\s*\(.*?\)\s*", "", normalized).strip()
    if short in existing:
        return True
    for existing_name in existing:
        if len(normalized) > 5 and len(existing_name) > 5:
            if normalized in existing_name or existing_name in normalized:
                return True
    return False


def discover_services_for_category(
    client: OpenAIClient, category: str, region: str,
) -> List[Dict]:
    """Use OpenAI web search to find services on ab.211.ca."""
    try:
        response = client.responses.create(
            model="gpt-4o-mini",
            tools=[{"type": "web_search"}],
            input=(
                f"Search the 211 Alberta website (ab.211.ca) for {category} "
                f"in {region}, Alberta, Canada. "
                f"List ALL services and organizations you can find. "
                f"For each service, provide:\n"
                f"1. Organization/service name\n"
                f"2. Brief description of what they offer\n"
                f"3. Phone number (if available)\n"
                f"4. Website URL (if available)\n"
                f"5. Address or location\n"
                f"6. Hours of operation (if available)\n"
                f"7. Eligibility criteria (if mentioned)\n\n"
                f"Focus on services specifically listed on ab.211.ca. "
                f'If you find no results for this specific category in this region, say "NO_RESULTS".'
            ),
        )
        result_text = response.output_text.strip()
        if "NO_RESULTS" in result_text:
            logger.info(f"No 211 results for '{category}' in {region}")
            return []
        return parse_discovery_results(client, result_text, category, region)
    except Exception as e:
        logger.error(f"211 discovery failed for '{category}' in {region}: {e}")
        return []


def parse_discovery_results(
    client: OpenAIClient, raw_text: str, category: str, region: str,
) -> List[Dict]:
    """Parse raw AI web search results into structured service dicts."""
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a data extraction assistant. Parse the following text about "
                        "Alberta social services into a JSON array of service objects. "
                        "Each object should have these fields:\n"
                        '- "name": Organization or service name (required)\n'
                        '- "description": What the service provides (1-3 sentences)\n'
                        '- "contact": Phone, email, and/or website combined in one string\n'
                        '- "location": Physical address or area served\n'
                        '- "website_url": Website URL if mentioned\n'
                        '- "hours_of_operation": Hours if mentioned\n'
                        '- "eligibility": Who can access the service\n'
                        '- "category": The service category\n\n'
                        "Rules:\n"
                        "- Only include services that are clearly real organizations\n"
                        "- Do NOT include 211 itself as a service\n"
                        "- Do NOT include generic helpline numbers (988, 911) unless they are specific Alberta services\n"
                        "- Combine duplicate entries for the same organization\n"
                        "- If a field is not mentioned, use null\n"
                        '- Return a JSON object with a "services" array'
                    ),
                },
                {
                    "role": "user",
                    "content": f"Category: {category}\nRegion: {region}\n\nRaw text to parse:\n{raw_text[:6000]}",
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        result = json.loads(completion.choices[0].message.content)
        services = result.get("services", [])
        for svc in services:
            if not svc.get("category"):
                svc["category"] = category.title()
            if not svc.get("location"):
                svc["location"] = region
        return services
    except Exception as e:
        logger.error(f"Failed to parse discovery results: {e}")
        return []


def enrich_existing_service_from_211(
    client: OpenAIClient, service: Service,
) -> Optional[Dict]:
    """Search 211 Alberta for additional info about an existing service."""
    try:
        response = client.responses.create(
            model="gpt-4o-mini",
            tools=[{"type": "web_search"}],
            input=(
                f'Search ab.211.ca for information about "{service.name}" '
                f'in {service.location or "Alberta"}. '
                f"Find: description, phone number, website, address, "
                f"hours of operation, eligibility criteria, required documents, "
                f"and the step-by-step process to access this service. "
                f'If this service is not on 211 Alberta, say "NOT_FOUND".'
            ),
        )
        result_text = response.output_text.strip()
        if "NOT_FOUND" in result_text:
            return None

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract updated service information from 211 Alberta data. "
                        "Return a JSON object with ONLY fields that have clear, "
                        "reliable information. Use null for unknown fields.\n\n"
                        "Fields:\n"
                        '- "description": Updated description (2-3 sentences)\n'
                        '- "contact": Phone and/or email\n'
                        '- "hours_of_operation": Operating hours\n'
                        '- "eligibility": Who can access this service\n'
                        '- "website_url": Website URL\n'
                        '- "tags": Array of 5-10 search keywords\n'
                        '- "process_steps": Array of 3-6 steps to access this service (e.g., ["Call intake line", "Complete assessment", "Attend appointment"])\n'
                        '- "required_docs": Array of documents needed (e.g., ["Photo ID", "Health card", "Proof of address"])\n\n'
                        "Only include data clearly from 211 Alberta. Do not fabricate."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Service: {service.name}\n"
                        f"Current description: {service.description or 'None'}\n"
                        f"Current location: {service.location or 'None'}\n\n"
                        f"211 Alberta data:\n{result_text[:4000]}"
                    ),
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        result = json.loads(completion.choices[0].message.content)
        updates = {k: v for k, v in result.items() if v and k in (
            "description", "contact", "hours_of_operation", "eligibility",
            "website_url", "tags", "process_steps", "required_docs",
        )}
        return updates if updates else None
    except Exception as e:
        logger.error(f"Failed to enrich {service.name} from 211: {e}")
        return None


# ──────────────────────────────────────────────────────────────────────────────
# Change Detection (Phase 1)
# ──────────────────────────────────────────────────────────────────────────────


def detect_changes(old_data: Dict, new_data: Dict) -> Tuple[bool, List[str]]:
    """Detect what fields changed between old and new data."""
    tracked = [
        "name", "description", "location", "contact",
        "eligibility", "process_steps", "wait_times",
        "required_docs", "hours_of_operation",
    ]
    changed = []
    for field in tracked:
        old_val = old_data.get(field)
        new_val = new_data.get(field)
        if isinstance(old_val, list):
            old_val = sorted(old_val) if old_val else []
        if isinstance(new_val, list):
            new_val = sorted(new_val) if new_val else []
        if old_val != new_val:
            changed.append(field)
    return len(changed) > 0, changed


def sync_service_data(service_data: Dict, session, log: ScraperLog) -> str:
    """
    Sync a service dict to the database.
    Returns 'created', 'updated', or 'unchanged'.
    """
    service_id = generate_service_id(
        service_data["name"], service_data.get("location", ""),
    )
    existing = session.query(Service).filter_by(service_id=service_id).first()

    if not existing:
        new_svc = Service(
            service_id=service_id,
            name=service_data["name"],
            category=service_data.get("category", "Unknown"),
            description=service_data.get("description"),
            location=service_data.get("location"),
            contact=service_data.get("contact"),
            eligibility=service_data.get("eligibility"),
            process_steps=service_data.get("process", []),
            wait_times=service_data.get("waitTimes"),
            required_docs=service_data.get("requiredDocs", []),
            hours_of_operation=service_data.get("hours_of_operation"),
            website_url=service_data.get("website_url"),
            booking_url=service_data.get("booking_url"),
            service_format=service_data.get("service_format"),
            languages_supported=service_data.get("languages_supported"),
            tags=service_data.get("tags"),
            data_source=service_data.get("data_source", "manual"),
        )
        session.add(new_svc)
        history = ServiceHistory(
            service_id=service_id,
            name=new_svc.name,
            category=new_svc.category,
            description=new_svc.description,
            location=new_svc.location,
            contact=new_svc.contact,
            eligibility=new_svc.eligibility,
            hours_of_operation=new_svc.hours_of_operation,
            website_url=new_svc.website_url,
            change_type="created",
            changed_fields=["all"],
            data_source=new_svc.data_source,
        )
        session.add(history)
        log.services_created += 1
        logger.info(f"Created new service: {service_data['name']}")
        return "created"

    # ── Existing service: check for updates ──
    old_data = {
        "name": existing.name,
        "description": existing.description,
        "location": existing.location,
        "contact": existing.contact,
        "eligibility": existing.eligibility,
        "process_steps": existing.process_steps,
        "wait_times": existing.wait_times,
        "required_docs": existing.required_docs,
        "hours_of_operation": existing.hours_of_operation,
    }
    new_data = {
        "name": service_data["name"],
        "description": service_data.get("description"),
        "location": service_data.get("location"),
        "contact": service_data.get("contact"),
        "eligibility": service_data.get("eligibility"),
        "process_steps": service_data.get("process", []),
        "wait_times": service_data.get("waitTimes"),
        "required_docs": service_data.get("requiredDocs", []),
        "hours_of_operation": service_data.get("hours_of_operation"),
    }

    has_changes, changed_fields = detect_changes(old_data, new_data)
    existing.last_checked = datetime.now()

    # Fill supplemental fields if empty
    supplemental = False
    for field, key in [
        ("website_url", "website_url"), ("booking_url", "booking_url"),
        ("service_format", "service_format"), ("tags", "tags"),
        ("languages_supported", "languages_supported"),
        ("data_source", "data_source"),
    ]:
        if service_data.get(key) and not getattr(existing, field, None):
            setattr(existing, field, service_data[key])
            supplemental = True

    if supplemental:
        existing.last_updated = datetime.now()

    if has_changes:
        for f in ["name", "description", "location", "contact", "eligibility", "hours_of_operation"]:
            if new_data.get(f) is not None:
                setattr(existing, f, new_data[f])
        existing.process_steps = new_data["process_steps"]
        existing.wait_times = new_data["wait_times"]
        existing.required_docs = new_data["required_docs"]
        existing.last_updated = datetime.now()
        if service_data.get("website_url"):
            existing.website_url = service_data["website_url"]
        if service_data.get("data_source"):
            existing.data_source = service_data["data_source"]

        history = ServiceHistory(
            service_id=service_id,
            name=existing.name,
            category=existing.category,
            description=existing.description,
            location=existing.location,
            contact=existing.contact,
            eligibility=existing.eligibility,
            hours_of_operation=existing.hours_of_operation,
            website_url=existing.website_url,
            change_type="updated",
            changed_fields=changed_fields,
            data_source=existing.data_source,
        )
        session.add(history)
        log.services_updated += 1
        logger.info(f"Updated service: {service_data['name']} (changed: {', '.join(changed_fields)})")
        return "updated"

    if supplemental:
        log.services_updated += 1
        return "updated"

    return "unchanged"


# ──────────────────────────────────────────────────────────────────────────────
# Phase Runners
# ──────────────────────────────────────────────────────────────────────────────


def phase_reference_sync(session, client: Optional[OpenAIClient], log: ScraperLog):
    """Phase 1: Sync reference data and scrape websites for updates."""
    logger.info("═══ Phase 1: Reference Data Sync ═══")
    from reference_data import load_alberta_services

    services_data = load_alberta_services()
    log.services_checked += len(services_data)

    for svc_data in services_data:
        try:
            service_id = generate_service_id(svc_data["name"], svc_data.get("location", ""))
            existing = session.query(Service).filter_by(service_id=service_id).first()
            existing_url = existing.website_url if existing else None

            # Try to find a URL to scrape
            urls = extract_urls(svc_data.get("contact", ""))
            if not urls and existing_url:
                urls = [existing_url]
            if not urls and client:
                found = find_website_with_ai(
                    client, svc_data["name"],
                    svc_data.get("location", "Alberta"),
                    svc_data.get("category", ""),
                )
                if found:
                    urls = [found]

            # Scrape and enrich if we have a URL
            if urls and client:
                scraped = scrape_website(urls[0])
                if scraped.get("page_text"):
                    ai_data = enrich_with_ai(client, scraped["page_text"], svc_data["name"], svc_data.get("category", ""))
                    if ai_data:
                        svc_data.update(ai_data)
                svc_data["website_url"] = urls[0]
                svc_data["data_source"] = urls[0]

            sync_service_data(svc_data, session, log)
            session.commit()
            time.sleep(2 if client else 1)

        except Exception as e:
            logger.error(f"Error processing {svc_data.get('name', '?')}: {e}")
            session.rollback()


def phase_211_discovery(session, client: OpenAIClient, log: ScraperLog):
    """Phase 2: Discover new services from 211 Alberta."""
    logger.info("═══ Phase 2: 211 Alberta Discovery ═══")

    existing = get_existing_services_lookup(session)
    logger.info(f"Loaded {len(existing)} existing services for deduplication")

    all_discovered: List[Dict] = []

    for category in SEARCH_CATEGORIES:
        regions = MAJOR_REGIONS.copy()
        if any(kw in category.lower() for kw in EXPANDED_SEARCH_KEYWORDS):
            regions.extend(SECONDARY_REGIONS)

        for region in regions:
            logger.info(f"Searching 211: '{category}' in {region}")
            discovered = discover_services_for_category(client, category, region)

            for svc in discovered:
                name = svc.get("name", "").strip()
                if not name:
                    continue
                if service_exists(name, existing):
                    continue
                all_discovered.append(svc)
                existing[name.lower().strip()] = True

            time.sleep(3)

    # Deduplicate by name
    seen: set = set()
    unique: List[Dict] = []
    for svc in all_discovered:
        key = svc["name"].lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(svc)

    logger.info(f"Found {len(unique)} potentially new services from 211")
    log.services_checked += len(SEARCH_CATEGORIES) * len(MAJOR_REGIONS)

    # Insert new services
    for svc in unique:
        try:
            sid = generate_service_id(svc["name"], svc.get("location", ""))
            if session.query(Service).filter_by(service_id=sid).first():
                continue

            new_svc = Service(
                service_id=sid,
                name=svc["name"],
                category=svc.get("category", "Unknown"),
                description=svc.get("description"),
                location=svc.get("location"),
                contact=svc.get("contact"),
                eligibility=svc.get("eligibility"),
                hours_of_operation=svc.get("hours_of_operation"),
                website_url=svc.get("website_url"),
                tags=svc.get("tags"),
                data_source="211 Alberta (ab.211.ca)",
            )
            session.add(new_svc)
            session.add(ServiceHistory(
                service_id=sid,
                name=svc["name"],
                category=svc.get("category", "Unknown"),
                description=svc.get("description"),
                location=svc.get("location"),
                contact=svc.get("contact"),
                eligibility=svc.get("eligibility"),
                hours_of_operation=svc.get("hours_of_operation"),
                website_url=svc.get("website_url"),
                change_type="created",
                changed_fields=["all"],
                data_source="211 Alberta (ab.211.ca)",
            ))
            session.commit()
            log.services_created += 1
            logger.info(f"NEW from 211: {svc['name']} ({svc.get('location', '?')})")
        except Exception as e:
            logger.error(f"Failed to add {svc.get('name')}: {e}")
            session.rollback()


def count_missing_fields(service: Service) -> int:
    """Count how many key fields are missing from a service."""
    missing = 0
    if not service.description or service.description.strip() == "":
        missing += 1
    if not service.contact or service.contact.strip() == "":
        missing += 1
    if not service.website_url or service.website_url.strip() == "":
        missing += 1
    if not service.process_steps or (isinstance(service.process_steps, list) and len(service.process_steps) == 0):
        missing += 1
    if not service.required_docs or (isinstance(service.required_docs, list) and len(service.required_docs) == 0):
        missing += 1
    return missing


def phase_211_enrich(session, client: OpenAIClient, log: ScraperLog):
    """Phase 3: Enrich sparse services with 211 Alberta data.

    Targets services missing 2+ key fields: description, contact, website_url,
    process_steps, required_docs. Runs until all services have sufficient data.
    """
    logger.info("═══ Phase 3: 211 Enrichment ═══")

    # Get ALL active services and filter to those missing 2+ key fields
    all_services = session.query(Service).filter(Service.is_active == True).all()
    sparse = [s for s in all_services if count_missing_fields(s) >= 2]

    logger.info(f"Found {len(sparse)} services missing 2+ key fields (out of {len(all_services)} total)")

    for i, service in enumerate(sparse):
        service_name = service.name
        logger.info(f"[{i+1}/{len(sparse)}] Enriching: {service_name}")
        try:
            updates = enrich_existing_service_from_211(client, service)
            if not updates:
                logger.info(f"  No updates found for {service_name}")
                time.sleep(2)
                continue

            updated = False
            if updates.get("description") and not service.description:
                service.description = updates["description"]
                updated = True
            if updates.get("hours_of_operation") and not service.hours_of_operation:
                service.hours_of_operation = safe_string(updates["hours_of_operation"], 500)
                updated = True
            if updates.get("eligibility") and not service.eligibility:
                service.eligibility = safe_string(updates["eligibility"])
                updated = True
            if updates.get("website_url") and not service.website_url:
                service.website_url = updates["website_url"]
                updated = True
            if updates.get("contact") and not service.contact:
                service.contact = safe_string(updates["contact"])
                updated = True
            if updates.get("tags") and not service.tags:
                service.tags = updates["tags"]
                updated = True
            if updates.get("process_steps") and not service.process_steps:
                service.process_steps = updates["process_steps"]
                updated = True
            if updates.get("required_docs") and not service.required_docs:
                service.required_docs = updates["required_docs"]
                updated = True

            if updated:
                service.last_updated = datetime.now()
                session.commit()
                log.services_updated += 1
                logger.info(f"  ✓ Enriched: {service_name} (missing fields now: {count_missing_fields(service)})")
            else:
                logger.info(f"  No new fields to update for {service_name}")

            time.sleep(3)

        except Exception as e:
            session.rollback()
            logger.error(f"  ✗ Failed to enrich {service_name}: {e}")

    # Log final stats
    remaining = len([s for s in all_services if count_missing_fields(s) >= 2])
    logger.info(f"Enrichment complete. Services still missing 2+ fields: {remaining}")


def phase_website_enrich(session, client: Optional[OpenAIClient], log: ScraperLog):
    """Phase 4: Scrape/re-scrape service websites for updated info."""
    logger.info("═══ Phase 4: Website Enrichment ═══")
    if not client:
        logger.warning("OpenAI client unavailable — skipping website enrichment")
        return

    # Services that have a website but are missing supplemental fields
    services = session.query(Service).filter(
        Service.is_active == True,
        Service.website_url != None,
        Service.website_url != "",
        (Service.tags == None) |
        (Service.service_format == None) |
        (Service.languages_supported == None),
    ).limit(100).all()

    logger.info(f"Re-scraping {len(services)} services with websites")

    for service in services:
        try:
            scraped = scrape_website(service.website_url)
            if not scraped.get("page_text"):
                continue

            ai_data = enrich_with_ai(client, scraped["page_text"], service.name, service.category)
            if not ai_data:
                continue

            updated = False
            if ai_data.get("tags") and not service.tags:
                service.tags = ai_data["tags"]
                updated = True
            if ai_data.get("service_format") and not service.service_format:
                service.service_format = ai_data["service_format"]
                updated = True
            if ai_data.get("languages_supported") and not service.languages_supported:
                service.languages_supported = ai_data["languages_supported"]
                updated = True
            if ai_data.get("booking_url") and not service.booking_url:
                service.booking_url = ai_data["booking_url"]
                updated = True
            if ai_data.get("description") and not service.description:
                service.description = ai_data["description"]
                updated = True
            if ai_data.get("hours_of_operation") and not service.hours_of_operation:
                service.hours_of_operation = safe_string(ai_data["hours_of_operation"], 500)
                updated = True
            if ai_data.get("eligibility") and not service.eligibility:
                service.eligibility = safe_string(ai_data["eligibility"])
                updated = True
            if ai_data.get("contact") and not service.contact:
                service.contact = safe_string(ai_data["contact"])
                updated = True

            if updated:
                service.last_updated = datetime.now()
                session.commit()
                log.services_updated += 1
                logger.info(f"Website enriched: {service.name}")

            time.sleep(2)

        except Exception as e:
            session.rollback()
            logger.error(f"Failed website enrich for {service.name}: {e}")


# ──────────────────────────────────────────────────────────────────────────────
# InformAlberta Enrichment (Phase 5)
# ──────────────────────────────────────────────────────────────────────────────


def enrich_from_informalberta(
    client: OpenAIClient, service: Service,
) -> Optional[Dict]:
    """Search InformAlberta for additional info about an existing service.

    Uses OpenAI web search to find the service on informalberta.ca and
    extract detailed information like description, contact, hours, eligibility,
    website URL, and required documents.
    """
    try:
        # Search InformAlberta for this service
        response = client.responses.create(
            model="gpt-4o-mini",
            tools=[{"type": "web_search"}],
            input=(
                f'Search informalberta.ca for information about "{service.name}" '
                f'in {service.location or "Alberta"}. '
                f"This is a {service.category or 'social service'} organization. "
                f"Find: detailed description, phone number, website URL, physical address, "
                f"email address, hours of operation, eligibility criteria, required documents, "
                f"fees, languages offered, and accessibility information. "
                f'Look at https://informalberta.ca/showDirectories for directory categories. '
                f'If this service is not found on InformAlberta, say "NOT_FOUND".'
            ),
        )
        result_text = response.output_text.strip()
        if "NOT_FOUND" in result_text.upper():
            return None

        # Parse the found information into structured data
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Extract detailed service information from InformAlberta data. "
                        "Return a JSON object with ONLY fields that have clear, "
                        "reliable information. Use null for unknown fields.\n\n"
                        "Fields to extract:\n"
                        '- "description": Detailed description of what this service provides (2-4 sentences)\n'
                        '- "contact": Phone number and/or email address\n'
                        '- "website_url": Official website URL (must be a valid URL starting with http)\n'
                        '- "address": Physical street address\n'
                        '- "hours_of_operation": Operating hours (e.g., "Mon-Fri 9am-5pm")\n'
                        '- "eligibility": Who can access this service\n'
                        '- "fees": Cost information (e.g., "Free", "$50/session", "Sliding scale")\n'
                        '- "languages_supported": Array of languages offered (e.g., ["English", "French"])\n'
                        '- "accessibility": Accessibility features (e.g., "Wheelchair accessible")\n'
                        '- "tags": Array of 5-10 relevant search keywords\n'
                        '- "process_steps": Array of 3-6 steps to access this service\n'
                        '- "required_docs": Array of documents needed (e.g., ["Photo ID", "Health card"])\n'
                        '- "service_format": One of "in-person", "virtual", "hybrid", or null\n\n'
                        "Important rules:\n"
                        "- Only include data clearly from InformAlberta\n"
                        "- Validate that website_url is a proper URL format\n"
                        "- Do NOT fabricate or guess information\n"
                        "- Be thorough - extract as much reliable data as possible"
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Service: {service.name}\n"
                        f"Category: {service.category or 'Unknown'}\n"
                        f"Current location: {service.location or 'Alberta'}\n"
                        f"Current description: {service.description or 'None'}\n\n"
                        f"InformAlberta data found:\n{result_text[:5000]}"
                    ),
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        result = json.loads(completion.choices[0].message.content)

        # Filter to only valid, non-null fields
        valid_fields = {
            "description", "contact", "website_url", "address", "hours_of_operation",
            "eligibility", "fees", "languages_supported", "accessibility", "tags",
            "process_steps", "required_docs", "service_format",
        }
        updates = {k: v for k, v in result.items() if v and k in valid_fields}

        # Validate website_url format
        if updates.get("website_url"):
            url = updates["website_url"]
            if not url.startswith("http"):
                updates["website_url"] = f"https://{url}"
            # Basic URL validation
            try:
                parsed = urlparse(updates["website_url"])
                if not parsed.netloc:
                    del updates["website_url"]
            except Exception:
                del updates["website_url"]

        return updates if updates else None

    except Exception as e:
        logger.error(f"Failed to enrich {service.name} from InformAlberta: {e}")
        return None


def phase_informalberta_enrich(session, client: OpenAIClient, log: ScraperLog):
    """Phase 5: Enrich existing services with InformAlberta data.

    Searches informalberta.ca for each existing service and enriches
    sparse fields with found information. Does NOT add new services.
    Prioritizes services that are missing key data fields.
    """
    logger.info("═══ Phase 5: InformAlberta Enrichment ═══")
    if not client:
        logger.warning("OpenAI client unavailable — skipping InformAlberta enrichment")
        return

    # Get all active services, prioritizing those with sparse data
    all_services = session.query(Service).filter(Service.is_active == True).all()

    # Sort by number of missing fields (most sparse first)
    services_with_missing = [(s, count_missing_fields(s)) for s in all_services]
    services_with_missing.sort(key=lambda x: -x[1])  # Most missing first

    # Process all services but log different priorities
    sparse_services = [s for s, missing in services_with_missing if missing >= 2]
    complete_services = [s for s, missing in services_with_missing if missing < 2]

    logger.info(f"Found {len(sparse_services)} sparse services (missing 2+ fields)")
    logger.info(f"Found {len(complete_services)} relatively complete services")
    logger.info(f"Will enrich all {len(all_services)} active services")

    enriched_count = 0
    not_found_count = 0

    for i, (service, missing_count) in enumerate(services_with_missing):
        service_name = service.name
        priority = "HIGH" if missing_count >= 2 else "LOW"
        logger.info(f"[{i+1}/{len(all_services)}] [{priority}] Enriching: {service_name}")

        try:
            updates = enrich_from_informalberta(client, service)
            if not updates:
                not_found_count += 1
                logger.info(f"  Not found on InformAlberta: {service_name}")
                time.sleep(2)
                continue

            updated = False
            updated_fields = []

            # Update sparse fields only (don't overwrite existing data)
            if updates.get("description") and not service.description:
                service.description = updates["description"]
                updated = True
                updated_fields.append("description")

            if updates.get("hours_of_operation") and not service.hours_of_operation:
                service.hours_of_operation = safe_string(updates["hours_of_operation"], 500)
                updated = True
                updated_fields.append("hours_of_operation")

            if updates.get("eligibility") and not service.eligibility:
                service.eligibility = safe_string(updates["eligibility"])
                updated = True
                updated_fields.append("eligibility")

            if updates.get("website_url") and not service.website_url:
                service.website_url = updates["website_url"]
                updated = True
                updated_fields.append("website_url")

            if updates.get("contact") and not service.contact:
                service.contact = safe_string(updates["contact"])
                updated = True
                updated_fields.append("contact")

            if updates.get("tags") and not service.tags:
                service.tags = updates["tags"]
                updated = True
                updated_fields.append("tags")

            if updates.get("process_steps") and not service.process_steps:
                service.process_steps = updates["process_steps"]
                updated = True
                updated_fields.append("process_steps")

            if updates.get("required_docs") and not service.required_docs:
                service.required_docs = updates["required_docs"]
                updated = True
                updated_fields.append("required_docs")

            if updates.get("languages_supported") and not service.languages_supported:
                service.languages_supported = updates["languages_supported"]
                updated = True
                updated_fields.append("languages_supported")

            if updates.get("service_format") and not service.service_format:
                service.service_format = updates["service_format"]
                updated = True
                updated_fields.append("service_format")

            if updates.get("booking_url") and not service.booking_url:
                service.booking_url = updates.get("booking_url")
                updated = True
                updated_fields.append("booking_url")

            # Store address in notes if available and not already present
            if updates.get("address") and not service.notes:
                service.notes = f"Address: {updates['address']}"
                if updates.get("fees"):
                    service.notes += f" | Fees: {updates['fees']}"
                if updates.get("accessibility"):
                    service.notes += f" | Accessibility: {updates['accessibility']}"
                updated = True
                updated_fields.append("notes")

            if updated:
                service.last_updated = datetime.now()
                session.commit()
                log.services_updated += 1
                enriched_count += 1
                new_missing = count_missing_fields(service)
                logger.info(
                    f"  ✓ Enriched: {service_name} "
                    f"(fields: {', '.join(updated_fields)}) "
                    f"(missing: {missing_count} → {new_missing})"
                )
            else:
                logger.info(f"  No new fields to update for {service_name} (all fields already populated)")

            # Rate limiting - be gentle with web search
            time.sleep(3)

        except Exception as e:
            session.rollback()
            logger.error(f"  ✗ Failed to enrich {service_name}: {e}")

    # Log final stats
    remaining_sparse = len([s for s in all_services if count_missing_fields(s) >= 2])
    logger.info(
        f"InformAlberta enrichment complete. "
        f"Enriched: {enriched_count}, Not found: {not_found_count}, "
        f"Services still missing 2+ fields: {remaining_sparse}"
    )


# ──────────────────────────────────────────────────────────────────────────────
# Inactive Service Recovery (Phase 6)
# ──────────────────────────────────────────────────────────────────────────────


def check_reactivation_criteria(service: Service) -> Tuple[bool, List[str]]:
    """Check if a service has enough data to be reactivated.

    Criteria for reactivation:
    - Must have: name (always present), description, contact
    - Plus at least ONE of: website_url, eligibility, process_steps, hours_of_operation

    Returns (can_reactivate, list_of_missing_required_fields)
    """
    missing = []

    # Required fields
    if not service.description or service.description.strip() == "":
        missing.append("description")
    if not service.contact or service.contact.strip() == "":
        missing.append("contact")

    # Check for at least one supplementary field
    has_supplementary = any([
        service.website_url and service.website_url.strip(),
        service.eligibility and service.eligibility.strip(),
        service.process_steps and len(service.process_steps) > 0,
        service.hours_of_operation and service.hours_of_operation.strip(),
    ])

    if not has_supplementary:
        missing.append("supplementary (website/eligibility/process/hours)")

    can_reactivate = len(missing) == 0
    return can_reactivate, missing


def phase_inactive_recovery(session, client: OpenAIClient, log: ScraperLog):
    """Phase 6: Attempt to recover inactive services.

    Searches InformAlberta and 211 Alberta for inactive services,
    enriches them with found data, and reactivates services that
    meet the minimum data requirements.
    """
    logger.info("═══ Phase 6: Inactive Service Recovery ═══")
    if not client:
        logger.warning("OpenAI client unavailable — skipping inactive recovery")
        return

    # Get all inactive services
    inactive_services = session.query(Service).filter(Service.is_active == False).all()

    if not inactive_services:
        logger.info("No inactive services found")
        return

    logger.info(f"Found {len(inactive_services)} inactive services to process")

    recovered_count = 0
    enriched_count = 0
    not_found_count = 0

    for i, service in enumerate(inactive_services):
        service_name = service.name
        logger.info(f"[{i+1}/{len(inactive_services)}] Processing inactive: {service_name}")

        try:
            # First, check current state
            can_reactivate_before, missing_before = check_reactivation_criteria(service)

            if can_reactivate_before:
                # Already has enough data, just reactivate
                service.is_active = True
                service.last_updated = datetime.now()
                session.commit()
                recovered_count += 1
                logger.info(f"  ✓ Reactivated (already had sufficient data): {service_name}")
                continue

            logger.info(f"  Missing: {', '.join(missing_before)}")

            # Try to enrich from InformAlberta
            updates = enrich_from_informalberta(client, service)

            if not updates:
                # Try 211 Alberta as fallback
                updates = enrich_existing_service_from_211(client, service)

            if not updates:
                not_found_count += 1
                logger.info(f"  Not found on InformAlberta or 211: {service_name}")
                time.sleep(2)
                continue

            # Apply updates
            updated = False
            updated_fields = []

            if updates.get("description") and not service.description:
                service.description = updates["description"]
                updated = True
                updated_fields.append("description")

            if updates.get("contact") and not service.contact:
                service.contact = safe_string(updates["contact"])
                updated = True
                updated_fields.append("contact")

            if updates.get("website_url") and not service.website_url:
                service.website_url = updates["website_url"]
                updated = True
                updated_fields.append("website_url")

            if updates.get("eligibility") and not service.eligibility:
                service.eligibility = safe_string(updates["eligibility"])
                updated = True
                updated_fields.append("eligibility")

            if updates.get("hours_of_operation") and not service.hours_of_operation:
                service.hours_of_operation = safe_string(updates["hours_of_operation"], 500)
                updated = True
                updated_fields.append("hours_of_operation")

            if updates.get("process_steps") and not service.process_steps:
                service.process_steps = updates["process_steps"]
                updated = True
                updated_fields.append("process_steps")

            if updates.get("required_docs") and not service.required_docs:
                service.required_docs = updates["required_docs"]
                updated = True
                updated_fields.append("required_docs")

            if updates.get("tags") and not service.tags:
                service.tags = updates["tags"]
                updated = True
                updated_fields.append("tags")

            if updates.get("languages_supported") and not service.languages_supported:
                service.languages_supported = updates["languages_supported"]
                updated = True
                updated_fields.append("languages_supported")

            if updates.get("service_format") and not service.service_format:
                service.service_format = updates["service_format"]
                updated = True
                updated_fields.append("service_format")

            # Store address/fees/accessibility in notes
            if updates.get("address") and not service.notes:
                service.notes = f"Address: {updates['address']}"
                if updates.get("fees"):
                    service.notes += f" | Fees: {updates['fees']}"
                if updates.get("accessibility"):
                    service.notes += f" | Accessibility: {updates['accessibility']}"
                updated = True
                updated_fields.append("notes")

            if updated:
                service.last_updated = datetime.now()
                enriched_count += 1
                log.services_updated += 1
                logger.info(f"  Enriched: {service_name} (fields: {', '.join(updated_fields)})")

            # Check if we can now reactivate
            can_reactivate_after, missing_after = check_reactivation_criteria(service)

            if can_reactivate_after:
                service.is_active = True
                session.commit()
                recovered_count += 1
                logger.info(f"  ✓ REACTIVATED: {service_name}")
            else:
                session.commit()
                logger.info(f"  Still missing for reactivation: {', '.join(missing_after)}")

            # Rate limiting
            time.sleep(3)

        except Exception as e:
            session.rollback()
            logger.error(f"  ✗ Failed to process {service_name}: {e}")

    logger.info(
        f"Inactive recovery complete. "
        f"Processed: {len(inactive_services)}, "
        f"Enriched: {enriched_count}, "
        f"Reactivated: {recovered_count}, "
        f"Not found: {not_found_count}"
    )


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────


def run_scraper(phases: Optional[List[str]] = None):
    """Run the scraper with the specified phases (or all phases if None)."""
    start_time = time.time()
    session = SessionLocal()

    try:
        Base.metadata.create_all(engine)
        client = init_openai()

        run_id = f"unified-{str(uuid.uuid4())[:8]}"
        log = ScraperLog(run_id=run_id, status="running")
        session.add(log)
        session.commit()

        all_phases = phases is None
        phase_set = set(phases or [])

        # Phase 1: Reference Data
        if all_phases or "reference" in phase_set:
            phase_reference_sync(session, client, log)

        # Phase 2: 211 Discovery (requires OpenAI)
        if (all_phases or "211" in phase_set) and client:
            phase_211_discovery(session, client, log)

        # Phase 3: 211 Enrichment (requires OpenAI)
        if (all_phases or "enrich" in phase_set) and client:
            phase_211_enrich(session, client, log)

        # Phase 4: Website Enrichment
        if all_phases or "websites" in phase_set:
            phase_website_enrich(session, client, log)

        # Phase 5: InformAlberta Enrichment (requires OpenAI)
        if (all_phases or "informalberta" in phase_set) and client:
            phase_informalberta_enrich(session, client, log)

        # Phase 6: Inactive Service Recovery (requires OpenAI)
        if ("recover" in phase_set) and client:
            phase_inactive_recovery(session, client, log)

        # Finalize log
        log.status = "completed"
        log.completed_at = datetime.now()
        log.duration_seconds = int(time.time() - start_time)
        session.commit()

        logger.info(
            f"Scraper completed: "
            f"{log.services_checked} checked, "
            f"{log.services_created} created, "
            f"{log.services_updated} updated, "
            f"{log.errors_count} errors, "
            f"duration={log.duration_seconds}s"
        )

    except Exception as e:
        logger.error(f"Scraper run failed: {e}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Alberta Service Scraper")
    parser.add_argument(
        "--phase",
        choices=["reference", "211", "enrich", "websites", "informalberta", "recover"],
        nargs="+",
        help="Run specific phase(s). Omit to run all (except recover).",
    )
    args = parser.parse_args()
    run_scraper(phases=args.phase)
