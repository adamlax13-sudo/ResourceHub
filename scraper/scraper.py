#!/usr/bin/env python3
"""
Unified Alberta Service Scraper & Data Pipeline.

A single entry point for all data management tasks:
  - Scraping and enriching service data from 211 Alberta, InformAlberta, and websites
  - Deep crawling service websites for detailed intake/eligibility information
  - Normalizing contact information (phone, email, address extraction)
  - Enhancing searchable tags
  - Generating vector embeddings for semantic search
  - Cleaning up redundant/duplicate services
  - Refreshing materialized views for optimized search

Usage:
    python scraper.py                           # Full pipeline (all phases)
    python scraper.py --phase reference         # Only reference data sync
    python scraper.py --phase 211               # Only 211 discovery
    python scraper.py --phase enrich            # Only 211 enrichment
    python scraper.py --phase websites          # Only website scraping (legacy shallow)
    python scraper.py --phase deepcrawl         # Deep crawl service websites
    python scraper.py --phase extract           # Extract intake/eligibility from crawled pages
    python scraper.py --phase informalberta     # Only InformAlberta enrichment
    python scraper.py --phase normalize         # Only normalize contacts
    python scraper.py --phase tags              # Only enhance tags
    python scraper.py --phase embeddings        # Only generate embeddings
    python scraper.py --phase dedupe            # Only remove duplicates
    python scraper.py --phase recover           # Only recover inactive services
    python scraper.py --phase refresh           # Only refresh materialized views
    python scraper.py --dry-run                 # Preview changes without saving

Environment:
    DATABASE_URL                      PostgreSQL connection string
    AI_INTEGRATIONS_OPENAI_API_KEY    OpenAI API key for AI features
"""

import argparse
import json
import logging
import os
import re
import time
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Set
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

load_dotenv()

from models import Base, Service, ServiceHistory, ScraperLog, WebsiteCrawl, CrawledPage, ServiceIntakeDetails, ServiceFieldSource

# Deep crawler and extractors - optional, may not exist
try:
    from deep_crawler import DeepCrawler, PageType
    from extractors import IntakeExtractor, EligibilityExtractor
    HAS_DEEP_CRAWLER = True
except ImportError:
    HAS_DEEP_CRAWLER = False

# Optional OpenAI integration (for web search and embeddings)
try:
    from openai import OpenAI as OpenAIClient
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

# Optional Claude integration (for extraction)
try:
    from claude_client import ClaudeClient, init_claude
    HAS_CLAUDE = True
except ImportError:
    HAS_CLAUDE = False

# =============================================================================
# Configuration
# =============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/recovery_hub")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

# 211 Alberta search categories
SEARCH_CATEGORIES = [
    "mental health counselling services", "addiction treatment programs",
    "crisis intervention services", "youth mental health services",
    "Indigenous mental health and wellness services", "women's shelters and domestic violence services",
    "emergency shelters and housing support", "food banks and meal programs",
    "substance abuse recovery and treatment centres", "LGBTQ+ support services",
    "family counselling services", "grief and bereavement support",
    "employment and job training programs", "newcomer and immigrant support services",
    "disability support services", "seniors mental health services",
    "harm reduction services", "eating disorder support", "gambling addiction support",
    "trauma and PTSD support services", "peer support programs",
    "outreach and mobile crisis teams", "detox centres",
    "transitional housing programs", "legal aid for mental health and social issues",
]

MAJOR_REGIONS = ["Calgary", "Edmonton", "Alberta province-wide"]
SECONDARY_REGIONS = ["Lethbridge", "Red Deer", "Medicine Hat", "Grande Prairie", "Fort McMurray"]
EXPANDED_SEARCH_KEYWORDS = ["shelter", "crisis", "food", "addiction", "mental health counselling"]

# Alberta cities for tag enhancement
ALBERTA_LOCATIONS = {
    "calgary": ["calgary", "yyc"], "edmonton": ["edmonton", "yeg"],
    "red deer": ["red deer"], "lethbridge": ["lethbridge"],
    "medicine hat": ["medicine hat"], "grande prairie": ["grande prairie"],
    "fort mcmurray": ["fort mcmurray", "wood buffalo"],
    "airdrie": ["airdrie"], "st. albert": ["st. albert", "st albert"],
    "spruce grove": ["spruce grove"], "leduc": ["leduc"],
    "alberta": ["alberta", "province-wide", "provincewide"],
}

# Keyword mappings for tag enhancement
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
    "indigenous": ["indigenous", "first nations", "métis", "inuit"],
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
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_BATCH_SIZE = 100
RATE_LIMIT_DELAY = 0.1

# =============================================================================
# Utility Functions
# =============================================================================

def should_enrich_field(service: Service, field_name: str) -> bool:
    """
    Check if a field needs enrichment (is empty/null).
    Returns True if the field is missing or empty and should be enriched.
    This prevents overwriting existing data with AI-generated content.
    """
    value = getattr(service, field_name, None)
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, list) and len(value) == 0:
        return True
    return False


def get_fields_needing_enrichment(service: Service) -> List[str]:
    """
    Get list of fields that need enrichment for a service.
    Returns empty list if all fields are complete.
    """
    enrichable_fields = [
        "description", "contact", "eligibility", "hours_of_operation",
        "website_url", "process_steps", "required_docs", "tags"
    ]
    return [f for f in enrichable_fields if should_enrich_field(service, f)]


def is_service_complete(service: Service) -> bool:
    """
    Check if a service has all critical fields populated.
    If complete, no enrichment is needed.
    """
    critical_fields = ["description", "eligibility", "process_steps"]
    return all(not should_enrich_field(service, f) for f in critical_fields)


def init_openai() -> Optional[OpenAIClient]:
    """Initialize OpenAI client if available."""
    if not HAS_OPENAI:
        logger.warning("openai package not installed - AI features disabled")
        return None
    api_key = os.getenv("AI_INTEGRATIONS_OPENAI_API_KEY")
    if not api_key:
        logger.warning("AI_INTEGRATIONS_OPENAI_API_KEY not set - AI features disabled")
        return None
    try:
        base_url = os.getenv("AI_INTEGRATIONS_OPENAI_BASE_URL")
        return OpenAIClient(api_key=api_key, base_url=base_url) if base_url else OpenAIClient(api_key=api_key)
    except Exception as e:
        logger.error(f"Failed to initialize OpenAI client: {e}")
        return None


def generate_service_id(name: str, location: str = "") -> str:
    """Generate unique service ID from name and location."""
    text = f"{name.lower()}-{location.lower()}".strip()
    text = re.sub(r"[^a-z0-9-]", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")[:255]


def safe_string(value, max_len: int = 0) -> str:
    """Convert value to string, handling dicts/lists."""
    if value is None:
        return ""
    if isinstance(value, dict):
        return ", ".join(f"{k}: {v}" for k, v in value.items())
    if isinstance(value, list):
        return json.dumps(value)
    s = str(value)
    return s[:max_len] if max_len else s


def extract_urls(text: str) -> List[str]:
    """Extract URLs from text."""
    if not text:
        return []
    url_pattern = r"https?://[^\s,]+"
    domain_pattern = r"[a-zA-Z0-9][-a-zA-Z0-9]*\.(?:ca|com|org|net|edu|gov)(?:/[^\s,]*)?"
    urls = re.findall(url_pattern, text)
    for domain in re.findall(domain_pattern, text):
        if not domain.startswith("http"):
            urls.append(f"https://{domain}")
    return list(set(urls))


def normalize_phone(phone: str) -> str:
    """Normalize phone to consistent format."""
    digits = re.sub(r'[^\d]', '', phone)
    if len(digits) == 10:
        return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
    elif len(digits) == 11 and digits[0] == '1':
        return f"1-{digits[1:4]}-{digits[4:7]}-{digits[7:]}"
    return phone


# =============================================================================
# Web Scraping Functions
# =============================================================================


def scrape_website(url: str) -> Dict:
    """Scrape website and return page text."""
    headers = {"User-Agent": "Mozilla/5.0 (compatible; ServiceBot/1.0; +http://recoveryoncampusalberta.ca)"}
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


def find_website_with_ai(client: OpenAIClient, name: str, location: str, category: str) -> Optional[str]:
    """Use OpenAI to find service website."""
    try:
        response = client.responses.create(
            model="gpt-4o-mini",
            tools=[{"type": "web_search"}],
            input=f'Find the official website URL for "{name}" in {location or "Alberta, Canada"}. '
                  f'This is a {category or "social service"} organization. Return ONLY the URL or "NOT_FOUND".',
        )
        result = response.output_text.strip()
        if "NOT_FOUND" in result:
            return None
        found = re.findall(r"https?://[^\s\)\]\"'<>,]+", result)
        return found[0].rstrip(".") if found else None
    except Exception as e:
        logger.error(f"AI web search failed for {name}: {e}")
        return None


def enrich_with_ai(client, page_text: str, name: str, category: str, claude_client=None) -> Optional[Dict]:
    """Extract structured data from webpage using AI.

    Uses Claude if available, falls back to OpenAI.
    """
    # Prefer Claude for extraction
    if claude_client and HAS_CLAUDE:
        try:
            result = claude_client.extract_service_details(page_text, name, category)
            if result:
                # Remove source fields from output (kept for debugging)
                return {k: v for k, v in result.items() if not k.endswith("_source") and v is not None}
        except Exception as e:
            logger.error(f"Claude enrichment failed for {name}: {e}")
            # Fall through to OpenAI fallback

    # Fallback to OpenAI
    if client and HAS_OPENAI:
        try:
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": (
                        "Extract service information from webpage. Return JSON with fields: "
                        "description, hours_of_operation, service_format, languages_supported, "
                        "booking_url, contact, eligibility, tags. Use null for unknown fields."
                    )},
                    {"role": "user", "content": f"Service: {name}\nCategory: {category}\n\nContent:\n{page_text}"},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            result = json.loads(completion.choices[0].message.content)
            return {k: v for k, v in result.items() if v is not None} or None
        except Exception as e:
            logger.error(f"OpenAI enrichment failed for {name}: {e}")
            return None

    return None


# =============================================================================
# 211 Alberta Functions
# =============================================================================


def get_existing_services_lookup(session) -> Dict:
    """Build lookup of existing services for deduplication."""
    services = session.query(Service).filter_by(is_active=True).all()
    lookup = {}
    for s in services:
        normalized = s.name.lower().strip()
        lookup[normalized] = s
        short = re.sub(r"\s*\(.*?\)\s*", "", normalized).strip()
        if short != normalized:
            lookup[short] = s
    return lookup


def service_exists(name: str, existing: Dict) -> bool:
    """Check if service exists."""
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


def discover_services_for_category(client, category: str, region: str, claude_client=None) -> List[Dict]:
    """Search 211 Alberta for services."""
    try:
        # Keep using OpenAI for web search (Claude doesn't have web_search tool)
        response = client.responses.create(
            model="gpt-4o-mini",
            tools=[{"type": "web_search"}],
            input=f"Search ab.211.ca for {category} in {region}, Alberta. List services with name, "
                  f"description, phone, website, address, hours, eligibility. Say 'NO_RESULTS' if none found.",
        )
        result = response.output_text.strip()
        if "NO_RESULTS" in result:
            return []
        return parse_discovery_results(client, result, category, region, claude_client)
    except Exception as e:
        logger.error(f"211 discovery failed: {e}")
        return []


def parse_discovery_results(client, raw_text: str, category: str, region: str, claude_client=None) -> List[Dict]:
    """Parse AI search results into service dicts.

    Uses Claude if available, falls back to OpenAI.
    """
    # Prefer Claude for parsing
    if claude_client and HAS_CLAUDE:
        try:
            services = claude_client.parse_discovery_results(raw_text, category, region)
            if services:
                return services
        except Exception as e:
            logger.error(f"Claude parsing failed: {e}")
            # Fall through to OpenAI fallback

    # Fallback to OpenAI
    if client and HAS_OPENAI:
        try:
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": (
                        "Parse text into JSON array of services with: name, description, contact, "
                        "location, website_url, hours_of_operation, eligibility, category. "
                        'Return {"services": [...]}. Skip 211 itself and generic helplines.'
                    )},
                    {"role": "user", "content": f"Category: {category}\nRegion: {region}\n\n{raw_text[:6000]}"},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            result = json.loads(completion.choices[0].message.content)
            services = result.get("services", [])
            for svc in services:
                svc.setdefault("category", category.title())
                svc.setdefault("location", region)
            return services
        except Exception as e:
            logger.error(f"OpenAI parsing failed: {e}")
            return []

    return []


def enrich_from_211(client, service: Service, claude_client=None) -> Optional[Dict]:
    """Search 211 Alberta for service details.
    Only enriches fields that are currently empty in the service.

    Uses OpenAI for web search, Claude for extraction.
    """
    try:
        # Check which fields need enrichment
        fields_needed = get_fields_needing_enrichment(service)
        if not fields_needed:
            logger.info(f"[Enrichment] Service '{service.name}' already complete, skipping 211 enrichment")
            return None

        logger.info(f"[Enrichment] Service '{service.name}' needs: {', '.join(fields_needed)}")

        # Use OpenAI for web search (Claude doesn't have web_search)
        if not client or not HAS_OPENAI:
            logger.warning("OpenAI client required for 211 web search")
            return None

        response = client.responses.create(
            model="gpt-4o-mini",
            tools=[{"type": "web_search"}],
            input=f'Search ab.211.ca for "{service.name}" in {service.location or "Alberta"}. '
                  f'Find description, phone, website, hours, eligibility, process steps, required docs. Say "NOT_FOUND" if not found.',
        )
        result = response.output_text.strip()
        if "NOT_FOUND" in result:
            return None

        # Use Claude for extraction if available
        if claude_client and HAS_CLAUDE:
            return claude_client.extract_211_data(result, service.name, fields_needed)

        # Fallback to OpenAI extraction
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": (
                    "Extract 211 data to JSON: description, contact, hours_of_operation, eligibility, "
                    "website_url, tags, process_steps, required_docs. Use null for unknown."
                )},
                {"role": "user", "content": f"Service: {service.name}\n\n211 data:\n{result[:4000]}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        data = json.loads(completion.choices[0].message.content)

        valid_fields = {"description", "contact", "hours_of_operation", "eligibility",
                       "website_url", "tags", "process_steps", "required_docs"}
        needed_set = set(fields_needed)
        return {k: v for k, v in data.items() if v and k in valid_fields and k in needed_set} or None
    except Exception as e:
        logger.error(f"Failed to enrich from 211: {e}")
        return None


def enrich_from_informalberta(client: OpenAIClient, service: Service) -> Optional[Dict]:
    """Search InformAlberta for service details.
    Only enriches fields that are currently empty in the service."""
    try:
        # Check which fields need enrichment (extended list for InformAlberta)
        enrichable_fields = [
            "description", "contact", "eligibility", "hours_of_operation",
            "website_url", "process_steps", "required_docs", "tags",
            "address", "languages_supported", "service_format"
        ]
        fields_needed = [f for f in enrichable_fields if should_enrich_field(service, f)]

        if not fields_needed:
            logger.info(f"[Enrichment] Service '{service.name}' already complete, skipping InformAlberta enrichment")
            return None

        logger.info(f"[Enrichment] Service '{service.name}' needs from InformAlberta: {', '.join(fields_needed)}")

        response = client.responses.create(
            model="gpt-4o-mini",
            tools=[{"type": "web_search"}],
            input=f'Search informalberta.ca for "{service.name}" in {service.location or "Alberta"}. '
                  f'Find description, phone, website, address, hours, eligibility, fees, languages. Say "NOT_FOUND" if not found.',
        )
        result = response.output_text.strip()
        if "NOT_FOUND" in result.upper():
            return None

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": (
                    "Extract InformAlberta data to JSON: description, contact, website_url, address, "
                    "hours_of_operation, eligibility, fees, languages_supported, tags, process_steps, "
                    "required_docs, service_format. Use null for unknown. Validate website_url format."
                )},
                {"role": "user", "content": f"Service: {service.name}\nCategory: {service.category}\n\nData:\n{result[:5000]}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        data = json.loads(completion.choices[0].message.content)
        valid_fields = {"description", "contact", "website_url", "address", "hours_of_operation",
                       "eligibility", "fees", "languages_supported", "tags", "process_steps",
                       "required_docs", "service_format"}
        needed_set = set(fields_needed)

        # Only include fields that are (1) valid, (2) have data, and (3) are needed
        updates = {k: v for k, v in data.items() if v and k in valid_fields and k in needed_set}

        # Validate URL
        if updates.get("website_url"):
            url = updates["website_url"]
            if not url.startswith("http"):
                url = f"https://{url}"
            try:
                if not urlparse(url).netloc:
                    del updates["website_url"]
                else:
                    updates["website_url"] = url
            except Exception:
                del updates["website_url"]

        return updates or None
    except Exception as e:
        logger.error(f"Failed to enrich from InformAlberta: {e}")
        return None


# =============================================================================
# Service Sync Functions
# =============================================================================


def count_missing_fields(service: Service) -> int:
    """Count how many key fields are missing."""
    missing = 0
    if not service.description or not service.description.strip():
        missing += 1
    if not service.contact or not service.contact.strip():
        missing += 1
    if not service.website_url or not service.website_url.strip():
        missing += 1
    if not service.process_steps or (isinstance(service.process_steps, list) and len(service.process_steps) == 0):
        missing += 1
    if not service.required_docs or (isinstance(service.required_docs, list) and len(service.required_docs) == 0):
        missing += 1
    return missing


def safe_lower(val) -> str:
    """Convert value to lowercase string, handling non-string types."""
    if val is None:
        return ""
    if isinstance(val, str):
        return val.lower()
    if isinstance(val, dict):
        return str(val).lower()
    if isinstance(val, list):
        return " ".join(str(x).lower() for x in val)
    return str(val).lower()


def infer_service_metadata(service_data: Dict) -> Dict:
    """Infer service metadata from description, eligibility, and hours."""
    desc = safe_lower(service_data.get("description"))
    elig = safe_lower(service_data.get("eligibility"))
    hours = safe_lower(service_data.get("hours_of_operation"))
    category = safe_lower(service_data.get("category"))
    name = safe_lower(service_data.get("name"))

    metadata = {
        "service_type": service_data.get("service_type"),
        "gender_restriction": service_data.get("gender_restriction"),
        "age_restriction": service_data.get("age_restriction"),
        "is_24_7": "24/7" in hours or "24/7" in desc or "24 hour" in hours,
        "is_walk_in": "walk-in" in desc or "walk in" in desc or "drop-in" in desc,
        "requires_referral": "referral" in elig and "no referral" not in elig and "self-referral" not in elig,
        "demographic_tags": [],
    }

    # Infer service_type from category if not provided
    if not metadata["service_type"]:
        if "crisis" in category or "24/7" in category:
            metadata["service_type"] = "crisis_line"
        elif "shelter" in category or "homeless" in category:
            metadata["service_type"] = "emergency_shelter"
        elif "mental health" in category:
            metadata["service_type"] = "mental_health"
        elif "addiction" in category or "recovery" in category or "detox" in category:
            metadata["service_type"] = "addiction_recovery"
        elif "counselling" in category:
            metadata["service_type"] = "counselling"
        elif "treatment" in category or "residential" in category:
            metadata["service_type"] = "residential_treatment"
        elif "food" in category:
            metadata["service_type"] = "food_resources"
        elif "indigenous" in category:
            metadata["service_type"] = "indigenous_services"
        elif "youth" in category:
            metadata["service_type"] = "youth_services"
        elif "lgbtq" in category or "2s" in category:
            metadata["service_type"] = "lgbtq_services"
        elif "domestic" in category or "violence" in category:
            metadata["service_type"] = "domestic_violence"

    # Infer gender_restriction if not provided
    if not metadata["gender_restriction"]:
        if "women only" in desc or "women only" in elig or "women experiencing" in elig or "women fleeing" in elig:
            metadata["gender_restriction"] = "women_only"
        elif "mens shelter" in desc or "men experiencing" in elig or "men only" in desc:
            metadata["gender_restriction"] = "men_only"

    # Infer demographic tags
    if "women" in elig or "women" in name:
        metadata["demographic_tags"].append("women")
    if "youth" in elig or "15-24" in elig or "18-24" in elig or "youth" in name:
        metadata["demographic_tags"].append("youth")
    if "indigenous" in elig or "first nation" in elig or "indigenous" in name:
        metadata["demographic_tags"].append("indigenous")
    if "senior" in elig or "60+" in elig or "55+" in elig:
        metadata["demographic_tags"].append("seniors")
    if "lgbtq" in elig or "2slgbtq" in elig or "lgbtq" in desc:
        metadata["demographic_tags"].append("lgbtq")
    if "family" in elig or "children" in elig or "family" in name:
        metadata["demographic_tags"].append("families")
    if "men" in elig and "women" not in elig:
        metadata["demographic_tags"].append("men")

    # Infer age_restriction
    if "youth" in elig or "15-24" in elig or "18-24" in elig:
        metadata["age_restriction"] = "youth_12_24"
    elif "senior" in elig or "60+" in elig or "55+" in elig:
        metadata["age_restriction"] = "senior_55+"

    return metadata


def sync_service_data(service_data: Dict, session, log: ScraperLog) -> str:
    """Sync service dict to database. Returns 'created', 'updated', or 'unchanged'."""
    service_id = generate_service_id(service_data["name"], service_data.get("location", ""))
    existing = session.query(Service).filter_by(service_id=service_id).first()

    # Infer metadata from service data
    metadata = infer_service_metadata(service_data)

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
            # New category improvement fields
            service_type=metadata["service_type"],
            gender_restriction=metadata["gender_restriction"],
            age_restriction=metadata["age_restriction"],
            is_24_7=metadata["is_24_7"],
            is_walk_in=metadata["is_walk_in"],
            requires_referral=metadata["requires_referral"],
            demographic_tags=metadata["demographic_tags"],
        )
        session.add(new_svc)
        session.add(ServiceHistory(
            service_id=service_id, name=new_svc.name, category=new_svc.category,
            description=new_svc.description, location=new_svc.location, contact=new_svc.contact,
            change_type="created", changed_fields=["all"], data_source=new_svc.data_source,
        ))
        log.services_created += 1
        logger.info(f"Created: {service_data['name']}")
        return "created"

    # Update existing
    existing.last_checked = datetime.now()
    updated = False
    for field, key in [("website_url", "website_url"), ("booking_url", "booking_url"),
                       ("service_format", "service_format"), ("tags", "tags"),
                       ("languages_supported", "languages_supported")]:
        if service_data.get(key) and not getattr(existing, field, None):
            setattr(existing, field, service_data[key])
            updated = True

    if updated:
        existing.last_updated = datetime.now()
        log.services_updated += 1
        return "updated"
    return "unchanged"


# =============================================================================
# Phase Runners
# =============================================================================


def phase_reference_sync(session, client: Optional[OpenAIClient], log: ScraperLog):
    """Phase 1: Sync reference data."""
    logger.info("=== Phase 1: Reference Data Sync ===")
    from reference_data import load_alberta_services

    for svc_data in load_alberta_services():
        try:
            log.services_checked += 1
            service_id = generate_service_id(svc_data["name"], svc_data.get("location", ""))
            existing = session.query(Service).filter_by(service_id=service_id).first()

            urls = extract_urls(svc_data.get("contact", ""))
            if not urls and existing and existing.website_url:
                urls = [existing.website_url]
            if not urls and client:
                found = find_website_with_ai(client, svc_data["name"], svc_data.get("location", "Alberta"), svc_data.get("category", ""))
                if found:
                    urls = [found]

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
    logger.info("=== Phase 2: 211 Alberta Discovery ===")
    existing = get_existing_services_lookup(session)
    all_discovered = []

    for category in SEARCH_CATEGORIES:
        regions = MAJOR_REGIONS.copy()
        if any(kw in category.lower() for kw in EXPANDED_SEARCH_KEYWORDS):
            regions.extend(SECONDARY_REGIONS)

        for region in regions:
            logger.info(f"Searching: '{category}' in {region}")
            for svc in discover_services_for_category(client, category, region):
                name = svc.get("name", "").strip()
                if name and not service_exists(name, existing):
                    all_discovered.append(svc)
                    existing[name.lower().strip()] = True
            time.sleep(3)

    # Deduplicate and insert
    seen = set()
    for svc in all_discovered:
        key = svc["name"].lower().strip()
        if key in seen:
            continue
        seen.add(key)

        try:
            sid = generate_service_id(svc["name"], svc.get("location", ""))
            if session.query(Service).filter_by(service_id=sid).first():
                continue
            session.add(Service(
                service_id=sid, name=svc["name"], category=svc.get("category", "Unknown"),
                description=svc.get("description"), location=svc.get("location"),
                contact=svc.get("contact"), eligibility=svc.get("eligibility"),
                hours_of_operation=svc.get("hours_of_operation"), website_url=svc.get("website_url"),
                data_source="211 Alberta (ab.211.ca)",
            ))
            session.commit()
            log.services_created += 1
            logger.info(f"NEW: {svc['name']}")
        except Exception as e:
            logger.error(f"Failed to add {svc.get('name')}: {e}")
            session.rollback()


def phase_211_enrich(session, client: OpenAIClient, log: ScraperLog):
    """Phase 3: Enrich sparse services from 211."""
    logger.info("=== Phase 3: 211 Enrichment ===")
    all_services = session.query(Service).filter(Service.is_active == True).all()
    sparse = [s for s in all_services if count_missing_fields(s) >= 2]
    logger.info(f"Found {len(sparse)} services missing 2+ fields")

    for i, service in enumerate(sparse):
        logger.info(f"[{i+1}/{len(sparse)}] Enriching: {service.name}")
        try:
            updates = enrich_from_211(client, service)
            if not updates:
                time.sleep(2)
                continue

            updated = False
            for field in ["description", "hours_of_operation", "eligibility", "website_url", "contact", "tags", "process_steps", "required_docs"]:
                if updates.get(field) and not getattr(service, field, None):
                    value = updates[field]
                    if field in ["hours_of_operation", "eligibility", "contact"]:
                        value = safe_string(value, 500 if field == "hours_of_operation" else 0)
                    setattr(service, field, value)
                    updated = True

            if updated:
                service.last_updated = datetime.now()
                session.commit()
                log.services_updated += 1
            time.sleep(3)
        except Exception as e:
            session.rollback()
            logger.error(f"Failed: {e}")


def phase_website_enrich(session, client: Optional[OpenAIClient], log: ScraperLog):
    """Phase 4: Scrape service websites for additional data."""
    logger.info("=== Phase 4: Website Enrichment ===")
    if not client:
        return

    services = session.query(Service).filter(
        Service.is_active == True, Service.website_url != None, Service.website_url != "",
        (Service.tags == None) | (Service.service_format == None)
    ).limit(100).all()

    for service in services:
        try:
            scraped = scrape_website(service.website_url)
            if not scraped.get("page_text"):
                continue
            ai_data = enrich_with_ai(client, scraped["page_text"], service.name, service.category)
            if not ai_data:
                continue

            updated = False
            for field in ["tags", "service_format", "languages_supported", "booking_url", "description", "hours_of_operation", "eligibility", "contact"]:
                if ai_data.get(field) and not getattr(service, field, None):
                    value = ai_data[field]
                    if field in ["hours_of_operation", "eligibility", "contact"]:
                        value = safe_string(value, 500 if field == "hours_of_operation" else 0)
                    setattr(service, field, value)
                    updated = True

            if updated:
                service.last_updated = datetime.now()
                session.commit()
                log.services_updated += 1
            time.sleep(2)
        except Exception as e:
            session.rollback()
            logger.error(f"Failed: {e}")


def phase_deep_crawl(session, client: Optional[OpenAIClient], log: ScraperLog):
    """Phase 4b: Deep crawl service websites for detailed information.

    Crawls 2-3 levels deep to find intake procedures, eligibility criteria,
    and program details that aren't visible on the homepage.
    """
    logger.info("=== Phase 4b: Deep Website Crawling ===")

    crawler = DeepCrawler(
        max_depth=2,
        max_pages=15,
        request_delay=2.0,
        openai_client=client
    )

    # Get services with websites that haven't been deep crawled recently
    services = session.query(Service).filter(
        Service.is_active == True,
        Service.website_url != None,
        Service.website_url != ""
    ).all()

    # Filter to services missing intake details or not recently crawled
    services_to_crawl = []
    for service in services:
        # Check if already crawled recently
        recent_crawl = session.query(WebsiteCrawl).filter(
            WebsiteCrawl.service_id == service.service_id
        ).order_by(WebsiteCrawl.crawl_date.desc()).first()

        if recent_crawl:
            days_since = (datetime.now() - recent_crawl.crawl_date).days
            if days_since < 30:
                continue

        services_to_crawl.append(service)

    logger.info(f"Found {len(services_to_crawl)} services to deep crawl")

    # Limit per run to avoid overload
    for i, service in enumerate(services_to_crawl[:50]):
        logger.info(f"[{i+1}/50] Deep crawling: {service.name}")
        try:
            result = crawler.crawl_website(service.website_url)

            # Store crawl result
            crawl_record = WebsiteCrawl(
                service_id=service.service_id,
                base_url=service.website_url,
                pages_crawled=result.total_pages_crawled,
                crawl_duration_seconds=int(result.crawl_duration_seconds),
                intake_pages_found=len(result.page_types.get('intake', [])),
                eligibility_pages_found=len(result.page_types.get('eligibility', [])),
                services_pages_found=len(result.page_types.get('services', [])),
                errors=result.errors if result.errors else None,
                robots_respected=result.robots_respected
            )
            session.add(crawl_record)
            session.flush()  # Get the crawl_id

            # Store crawled pages
            for url, page in result.pages.items():
                page_record = CrawledPage(
                    crawl_id=crawl_record.id,
                    url=url,
                    page_type=page.page_type.value,
                    classification_confidence=int(page.classification.confidence * 100),
                    text_content=page.text_content[:50000],  # Limit storage
                    html_content=page.html[:100000] if len(page.html) < 100000 else None,
                    crawl_depth=page.depth,
                    crawl_time_ms=int(page.crawl_time * 1000),
                    status_code=page.status_code
                )
                session.add(page_record)

            session.commit()
            log.services_checked += 1

            if result.total_pages_crawled > 0:
                logger.info(f"  Crawled {result.total_pages_crawled} pages "
                           f"(intake: {crawl_record.intake_pages_found}, "
                           f"eligibility: {crawl_record.eligibility_pages_found})")

        except Exception as e:
            logger.error(f"Deep crawl failed for {service.name}: {e}")
            session.rollback()
            log.errors_count += 1


def phase_enhanced_extraction(session, client: Optional[OpenAIClient], log: ScraperLog):
    """Phase 4c: Extract detailed intake/eligibility from crawled pages.

    Uses specialized extractors to pull detailed process steps,
    eligibility criteria, and required documents from crawled pages.
    """
    logger.info("=== Phase 4c: Enhanced Extraction ===")

    if not client:
        logger.warning("OpenAI client required for enhanced extraction")
        return

    intake_extractor = IntakeExtractor(client)
    eligibility_extractor = EligibilityExtractor(client)

    # Get recent crawls that haven't been extracted yet
    crawls = session.query(WebsiteCrawl).filter(
        WebsiteCrawl.pages_crawled > 0
    ).order_by(WebsiteCrawl.crawl_date.desc()).limit(100).all()

    for crawl in crawls:
        service = session.query(Service).filter_by(service_id=crawl.service_id).first()
        if not service:
            continue

        # Check if already extracted
        existing_intake = session.query(ServiceIntakeDetails).filter_by(
            service_id=service.service_id
        ).first()
        if existing_intake and (datetime.now() - existing_intake.extracted_at).days < 30:
            continue

        logger.info(f"Extracting from {service.name}")

        try:
            # Get crawled pages for this service
            pages = session.query(CrawledPage).filter_by(crawl_id=crawl.id).all()

            # Find intake pages
            intake_pages = [p for p in pages if p.page_type == 'intake']
            eligibility_pages = [p for p in pages if p.page_type == 'eligibility']

            # Also check homepage and services pages for intake info
            other_pages = [p for p in pages if p.page_type in ('home', 'services', 'contact')]

            best_intake = None
            best_eligibility = None

            # Extract from intake pages
            for page in (intake_pages + other_pages)[:3]:  # Limit to 3 pages
                if not page.text_content:
                    continue

                intake = intake_extractor.extract(
                    text=page.text_content,
                    html=page.html_content or "",
                    service_name=service.name,
                    source_url=page.url
                )

                if intake.is_complete():
                    if not best_intake or len(intake.steps) > len(best_intake.steps):
                        best_intake = intake
                        best_intake.source_url = page.url

            # Extract from eligibility pages
            for page in (eligibility_pages + other_pages)[:3]:
                if not page.text_content:
                    continue

                eligibility = eligibility_extractor.extract(
                    text=page.text_content,
                    html=page.html_content or "",
                    service_name=service.name,
                    source_url=page.url
                )

                if eligibility.is_complete():
                    if not best_eligibility or (eligibility.summary and not best_eligibility.summary):
                        best_eligibility = eligibility

            # Update service with extracted data
            updated = False

            if best_intake and best_intake.steps:
                # Update process_steps in main service
                new_steps = best_intake.to_process_steps()
                if new_steps and (not service.process_steps or len(new_steps) > len(service.process_steps or [])):
                    service.process_steps = new_steps
                    updated = True

                    # Store detailed intake info
                    intake_record = existing_intake or ServiceIntakeDetails(
                        service_id=service.service_id
                    )
                    intake_record.steps = [
                        {"action": s.action, "details": s.details, "timing": s.timing}
                        for s in best_intake.steps
                    ]
                    intake_record.intake_phone = best_intake.intake_phone
                    intake_record.intake_email = best_intake.intake_email
                    intake_record.intake_hours = best_intake.intake_hours
                    intake_record.total_time_estimate = best_intake.total_time_estimate
                    intake_record.primary_contact_method = best_intake.primary_contact_method
                    intake_record.walk_in_available = best_intake.walk_in_available
                    intake_record.appointment_required = best_intake.appointment_required
                    intake_record.online_application_available = best_intake.online_application_available
                    intake_record.requires_referral = best_intake.requires_referral
                    intake_record.required_documents = best_intake.required_documents
                    intake_record.source_url = best_intake.source_url
                    intake_record.extracted_at = datetime.now()
                    intake_record.extraction_confidence = 70

                    if not existing_intake:
                        session.add(intake_record)

                # Update required_docs if better
                if best_intake.required_documents and (
                    not service.required_docs or
                    len(best_intake.required_documents) > len(service.required_docs or [])
                ):
                    service.required_docs = best_intake.required_documents
                    updated = True

                # Update phone if intake-specific and missing
                if best_intake.intake_phone and not service.phone:
                    service.phone = best_intake.intake_phone
                    updated = True

            if best_eligibility:
                # Update eligibility if better
                eligibility_text = best_eligibility.to_text()
                if eligibility_text and (
                    not service.eligibility or
                    len(eligibility_text) > len(service.eligibility or "")
                ):
                    service.eligibility = eligibility_text
                    updated = True

                # Update gender restriction
                if best_eligibility.gender_requirements and not service.gender_restriction:
                    service.gender_restriction = best_eligibility.gender_requirements
                    updated = True

                # Update languages
                if best_eligibility.languages_available and not service.languages_supported:
                    service.languages_supported = best_eligibility.languages_available
                    updated = True

            if updated:
                service.last_updated = datetime.now()
                session.commit()
                log.services_updated += 1
                logger.info(f"  Updated {service.name} with extracted data")

        except Exception as e:
            logger.error(f"Extraction failed for {service.name}: {e}")
            session.rollback()
            log.errors_count += 1

        time.sleep(1)  # Rate limit


def phase_informalberta_enrich(session, client: OpenAIClient, log: ScraperLog):
    """Phase 5: Enrich services from InformAlberta."""
    logger.info("=== Phase 5: InformAlberta Enrichment ===")
    all_services = session.query(Service).filter(Service.is_active == True).all()
    services_sorted = sorted(all_services, key=lambda s: -count_missing_fields(s))

    for i, service in enumerate(services_sorted[:100]):  # Limit to 100 per run
        logger.info(f"[{i+1}/100] Enriching: {service.name}")
        try:
            updates = enrich_from_informalberta(client, service)
            if not updates:
                time.sleep(2)
                continue

            updated = False
            for field in ["description", "hours_of_operation", "eligibility", "website_url", "contact", "tags", "process_steps", "required_docs", "languages_supported", "service_format"]:
                if updates.get(field) and not getattr(service, field, None):
                    value = updates[field]
                    if field in ["hours_of_operation", "eligibility", "contact"]:
                        value = safe_string(value, 500 if field == "hours_of_operation" else 0)
                    setattr(service, field, value)
                    updated = True

            if updated:
                service.last_updated = datetime.now()
                session.commit()
                log.services_updated += 1
            time.sleep(3)
        except Exception as e:
            session.rollback()
            logger.error(f"Failed: {e}")


def phase_normalize_contacts(session, log: ScraperLog, dry_run: bool = False):
    """Phase 6: Normalize contact information (extract phone, email, address)."""
    logger.info("=== Phase 6: Normalize Contacts ===")

    # Patterns
    phone_regex = re.compile(r'(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}', re.I)
    email_regex = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', re.I)
    url_regex = re.compile(r'(?:https?://)?(?:www\.)?[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:/[^\s,]*)?', re.I)

    all_services = session.query(Service).all()
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

        # Extract address from notes
        if not service.address and service.notes:
            match = re.search(r'Address:\s*([^|]+)', service.notes, re.I)
            if match:
                service.address = match.group(1).strip()
                changes = True

        if changes and not dry_run:
            service.last_updated = datetime.now()
            updated_count += 1

    if not dry_run:
        session.commit()
    log.services_updated += updated_count
    logger.info(f"Normalized {updated_count} services")


def phase_enhance_tags(session, log: ScraperLog, dry_run: bool = False):
    """Phase 7: Enhance service tags with searchable keywords."""
    logger.info("=== Phase 7: Enhance Tags ===")

    def extract_keywords(text: str, keyword_map: Dict) -> Set[str]:
        if not text:
            return set()
        text_lower = text.lower()
        found = set()
        for tag, keywords in keyword_map.items():
            for kw in keywords:
                if kw in text_lower:
                    found.add(tag)
                    break
        return found

    all_services = session.query(Service).filter(Service.is_active == True).all()
    updated_count = 0

    for service in all_services:
        combined_text = " ".join(filter(None, [service.name, service.description, service.category, service.eligibility, service.notes]))
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

        # Category as tag
        if service.category:
            tags.add(service.category.lower().strip())

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
    log.services_updated += updated_count
    logger.info(f"Enhanced tags for {updated_count} services")


def phase_generate_embeddings(session, client: Optional[OpenAIClient], log: ScraperLog, regenerate_all: bool = False):
    """Phase 8: Generate vector embeddings for semantic search."""
    logger.info("=== Phase 8: Generate Embeddings ===")
    if not client:
        logger.warning("OpenAI client unavailable - skipping embeddings")
        return

    # Check if embedding column exists
    try:
        session.execute(text("SELECT embedding FROM services LIMIT 1"))
    except Exception as e:
        logger.warning(f"Embedding column not found - run migrations first. Error: {e}")
        return

    # Get services needing embeddings
    if regenerate_all:
        services = session.execute(text(
            "SELECT service_id, name, category, description, eligibility, location, tags, notes "
            "FROM services WHERE is_active = true ORDER BY service_id"
        )).fetchall()
    else:
        services = session.execute(text(
            "SELECT service_id, name, category, description, eligibility, location, tags, notes "
            "FROM services WHERE is_active = true AND embedding IS NULL ORDER BY service_id"
        )).fetchall()

    if not services:
        logger.info("No services need embeddings")
        return

    logger.info(f"Generating embeddings for {len(services)} services")
    columns = ["service_id", "name", "category", "description", "eligibility", "location", "tags", "notes"]
    batch = []

    for row in services:
        svc = dict(zip(columns, row))
        # Build embedding text
        parts = []
        if svc.get("name"):
            parts.append(f"Service: {svc['name']}")
        if svc.get("category"):
            parts.append(f"Category: {svc['category']}")
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
            response = client.embeddings.create(model=EMBEDDING_MODEL, input=embed_text)
            embedding = response.data[0].embedding
            batch.append((svc["service_id"], embedding))

            if len(batch) >= EMBEDDING_BATCH_SIZE:
                # Save batch
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

    log.services_updated += len(services)


def phase_dedupe_services(session, log: ScraperLog, dry_run: bool = False):
    """Phase 9: Clean up redundant/duplicate services."""
    logger.info("=== Phase 9: Deduplicate Services ===")

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
            # Find provincial entry to deactivate
            for svc in group:
                loc = (svc.location or '').lower()
                if 'alberta' in loc or 'province' in loc:
                    if not dry_run:
                        svc.is_active = False
                        svc.notes = (svc.notes or '') + f' [Deactivated: Redundant with local entries]'
                    deactivated += 1
                    logger.info(f"Deactivating: {svc.name} ({svc.location})")
                    break

    if not dry_run:
        session.commit()
    log.services_deactivated = deactivated
    logger.info(f"Deactivated {deactivated} redundant services")


def phase_recover_inactive(session, client: OpenAIClient, log: ScraperLog):
    """Phase 10: Recover inactive services with sufficient data."""
    logger.info("=== Phase 10: Inactive Recovery ===")
    if not client:
        return

    inactive = session.query(Service).filter_by(is_active=False).all()
    if not inactive:
        logger.info("No inactive services")
        return

    recovered = 0
    for service in inactive:
        # Check if already has sufficient data
        has_required = service.description and service.contact
        has_supplementary = service.website_url or service.eligibility or service.process_steps

        if has_required and has_supplementary:
            service.is_active = True
            service.last_updated = datetime.now()
            recovered += 1
            logger.info(f"Reactivated: {service.name}")
            continue

        # Try to enrich
        updates = enrich_from_informalberta(client, service)
        if not updates:
            updates = enrich_from_211(client, service)

        if updates:
            for field in ["description", "contact", "website_url", "eligibility", "hours_of_operation", "process_steps"]:
                if updates.get(field) and not getattr(service, field, None):
                    setattr(service, field, updates[field])

            # Recheck
            has_required = service.description and service.contact
            has_supplementary = service.website_url or service.eligibility or service.process_steps
            if has_required and has_supplementary:
                service.is_active = True
                recovered += 1
                logger.info(f"Recovered: {service.name}")

        time.sleep(3)

    session.commit()
    log.services_updated += recovered
    logger.info(f"Recovered {recovered} services")


def phase_refresh_views(session, log: ScraperLog):
    """Phase 11: Refresh materialized views for search."""
    logger.info("=== Phase 11: Refresh Views ===")
    try:
        session.execute(text("REFRESH MATERIALIZED VIEW mv_service_search"))
        session.commit()
        logger.info("Materialized view refreshed")
    except Exception as e:
        logger.warning(f"Failed to refresh view (may not exist): {e}")


# =============================================================================
# Main Entry Point
# =============================================================================


def run_scraper(phases: Optional[List[str]] = None, dry_run: bool = False):
    """Run the scraper pipeline."""
    start_time = time.time()
    session = SessionLocal()

    try:
        Base.metadata.create_all(engine)
        client = init_openai()

        run_id = f"pipeline-{str(uuid.uuid4())[:8]}"
        log = ScraperLog(run_id=run_id, status="running")
        session.add(log)
        session.commit()

        all_phases = phases is None
        phase_set = set(phases or [])

        # Core scraping phases (require OpenAI)
        if all_phases or "reference" in phase_set:
            phase_reference_sync(session, client, log)
        if (all_phases or "211" in phase_set) and client:
            phase_211_discovery(session, client, log)
        if (all_phases or "enrich" in phase_set) and client:
            phase_211_enrich(session, client, log)
        if all_phases or "websites" in phase_set:
            phase_website_enrich(session, client, log)

        # Deep crawling phases (new)
        if all_phases or "deepcrawl" in phase_set:
            phase_deep_crawl(session, client, log)
        if all_phases or "extract" in phase_set:
            phase_enhanced_extraction(session, client, log)

        if (all_phases or "informalberta" in phase_set) and client:
            phase_informalberta_enrich(session, client, log)

        # Data quality phases
        if all_phases or "normalize" in phase_set:
            phase_normalize_contacts(session, log, dry_run)
        if all_phases or "tags" in phase_set:
            phase_enhance_tags(session, log, dry_run)
        if all_phases or "embeddings" in phase_set:
            phase_generate_embeddings(session, client, log)
        if all_phases or "dedupe" in phase_set:
            phase_dedupe_services(session, log, dry_run)

        # Recovery phase (explicit only)
        if "recover" in phase_set and client:
            phase_recover_inactive(session, client, log)

        # Always refresh views at end
        if all_phases or "refresh" in phase_set:
            phase_refresh_views(session, log)

        log.status = "completed"
        log.completed_at = datetime.now()
        log.duration_seconds = int(time.time() - start_time)
        session.commit()

        logger.info(f"Pipeline completed: {log.services_checked} checked, {log.services_created} created, "
                   f"{log.services_updated} updated, {log.duration_seconds}s")

    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Alberta Service Scraper & Data Pipeline")
    parser.add_argument("--phase", nargs="+", choices=[
        "reference", "211", "enrich", "websites", "deepcrawl", "extract",
        "informalberta", "normalize", "tags", "embeddings", "dedupe",
        "recover", "refresh"
    ], help="Run specific phase(s)")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without saving")
    args = parser.parse_args()

    run_scraper(phases=args.phase, dry_run=args.dry_run)
