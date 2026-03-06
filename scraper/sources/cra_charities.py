"""
CRA Charities Alberta Source Plugin.

Discovers Alberta-based registered charities providing social services
from the Canada Revenue Agency's open data on the Open Government Portal.

Data source: https://open.canada.ca/data/en/dataset/05b3abd0-e70f-4b3b-a9c5-acc436bd15b6
  - ident CSV: charity identification (BN, name, address, category, designation)
  - programs CSV: charitable program descriptions (keyed by BN)
  - weburl CSV: charity website URLs (keyed by BN)

The CRA database contains ~86,000 charities across Canada, including sports clubs,
arts organizations, hospitals, and private foundations. This plugin filters to only
Alberta charities providing DIRECT social services to people (addiction, housing,
mental health, crisis, food, disability, newcomer, etc.).

Foundations that only fund other organizations are excluded.
"""

import csv
import io
import logging
import os
import re
import time
from typing import Optional

import requests

from sources.plugin import RawService, Source

logger = logging.getLogger(__name__)

# --- Open Data CSV URLs (2023 dataset, updated July 2025) ---

IDENT_CSV_URL = (
    "https://open.canada.ca/data/dataset/05b3abd0-e70f-4b3b-a9c5-acc436bd15b6"
    "/resource/31a52caf-fa79-4ab3-bded-1ccc7b61c17f/download/ident_2023_update.csv"
)
PROGRAMS_CSV_URL = (
    "https://open.canada.ca/data/dataset/05b3abd0-e70f-4b3b-a9c5-acc436bd15b6"
    "/resource/b02f94b3-6555-4315-96ab-2658f61290c5/download/new_ongoing_programs_2023_updated.csv"
)
WEBURL_CSV_URL = (
    "https://open.canada.ca/data/dataset/05b3abd0-e70f-4b3b-a9c5-acc436bd15b6"
    "/resource/204222a0-eefc-4ccc-8c29-b6ecea0f6eb5/download/weburl_2023_0721.csv"
)

# CRA charity detail page template
CRA_DETAIL_URL = "https://apps.cra-arc.gc.ca/ebci/hacc/srch/pub/dsplyRprtngPrd?q.srchNm=&q.stts=0007&selectedCharityBn={bn}&dsrdPg=1"

# --- Relevance filtering constants ---

# CRA uses numeric category codes in the CSV.
# Map codes to human-readable names for filtering.
CATEGORY_CODE_MAP = {
    "1": "Welfare",
    "0001": "Welfare",
    "10": "Education",
    "11": "Education",
    "12": "Arts",
    "0012": "Arts",
    "13": "International",
    "14": "International",
    "15": "International",
    "30": "Religion",
    "0030": "Religion",
    "40": "Religion",
    "50": "Religion",
    "60": "Religion",
    "70": "Religion",
    "80": "Religion",
    "90": "Religion",
    "100": "Community",
    "110": "Health",
    "0110": "Health",
    "120": "Emergency",
    "130": "Health",
    "140": "Disability",
    "150": "Seniors",
    "155": "Human Rights",
    "160": "Cemetery",
    "0160": "Cemetery",
    "170": "Environment",
    "175": "Environment",
    "180": "Animal Welfare",
    "0180": "Animal Welfare",
    "190": "Arts",
    "0190": "Arts",
    "200": "Community",
    "0200": "Community",
    "210": "Other",
    "0210": "Other",
    "215": "Other",
}

# Designation codes: A = Public Foundation, B = Private Foundation, C = Charitable Organization
DESIGNATION_CODE_MAP = {
    "A": "Public Foundation",
    "B": "Private Foundation",
    "C": "Charitable Organization",
}

# CRA categories that are automatically relevant (direct social services)
RELEVANT_CATEGORIES = {
    "Welfare",
    "Health",
    "Community",
    "Emergency",
    "Disability",
    "Seniors",
    "Human Rights",
}

# CRA categories that require keyword matching to be relevant
CONDITIONAL_CATEGORIES = {
    "Religion",     # Many religious orgs run social programs (food banks, shelters)
    "Education",    # Some education orgs provide social services
    "Other",        # Mixed bag, needs keywords
}

# CRA categories that are excluded entirely
EXCLUDED_CATEGORIES = {
    "Animal Welfare",
    "Arts",
    "Environment",
    "Cemetery",
    "International",  # International development, not local Alberta services
}

# Strong keywords — one match is enough to indicate a real social service
STRONG_KEYWORDS = {
    "addiction", "substance abuse", "detox", "harm reduction", "opioid",
    "mental health", "psychiatric", "psycholog",
    "food bank", "food hamper", "meals on wheels",
    "women's shelter", "domestic violence", "sexual assault",
    "homeless", "homelessness", "transitional housing", "supportive living",
    "crisis line", "crisis intervention", "distress centre", "suicide prevention",
    "disability", "disabilities", "developmental disabilit",
    "refugee", "settlement services", "newcomer services",
    "low income housing", "social housing", "rent subsidy",
    "child welfare", "child protection", "foster care",
    "palliative care", "hospice",
}

# Weak keywords — require 2+ matches to qualify (too generic alone)
WEAK_KEYWORDS = {
    "counselling", "counseling", "recovery", "rehabilitation",
    "shelter", "housing", "support group", "peer support",
    "youth", "senior", "elder", "family services",
    "poverty", "low income", "employment", "advocacy",
    "grief", "trauma", "abuse", "crisis",
    "indigenous", "first nations", "metis", "inuit",
    "newcomer", "immigrant", "respite",
    "meals", "clothing", "basic needs",
}

# Keywords that indicate the charity is NOT a social service provider
EXCLUSION_KEYWORDS = {
    "golf", "curling", "hockey", "sports league", "arts council",
    "museum", "gallery", "symphony", "opera", "theatre company",
    "animal rescue", "animal shelter", "animal welfare",
    "veterinary", "kennel", "humane society",
    "private foundation",
}

# Phrases that indicate worship-only orgs (not actual service providers)
WORSHIP_ONLY_INDICATORS = {
    "worship service", "sunday school", "bible study", "bible class",
    "prayer meeting", "prayer group", "gospel service",
    "sunday worship", "midweek service", "church service",
    "vacation bible school", "scripture study",
}

# Programs that prove a church IS a real service provider (override worship filter)
SERVICE_PROGRAM_OVERRIDES = {
    "food bank", "food hamper", "meals program", "soup kitchen",
    "shelter", "transitional housing", "emergency housing",
    "addiction program", "recovery program", "detox",
    "counselling center", "counselling centre", "crisis line",
    "clothing depot", "thrift store for",
    "settlement services", "newcomer program",
    "after school program", "drop-in centre", "drop-in center",
}

# --- Category mapping ---

CATEGORY_KEYWORDS = {
    "addiction": [
        "addiction", "recovery", "detox", "substance", "alcohol",
        "drug", "harm reduction", "opioid", "sobriety", "sober",
    ],
    "mental_health": [
        "mental health", "counselling", "counseling", "therapy",
        "psychiatric", "psycholog", "anxiety", "depression",
        "grief", "trauma", "ptsd",
    ],
    "housing": [
        "housing", "homeless", "transitional living", "transitional housing",
        "supportive living", "rent", "eviction", "women's shelter",
        "emergency shelter", "social housing",
    ],
    "basic_needs": [
        "food bank", "food hamper", "meals", "clothing",
        "basic needs", "poverty", "low income", "financial assistance",
    ],
    "disability": [
        "disability", "disabilities", "accessible", "wheelchair",
        "blind", "deaf", "cognitive", "developmental",
    ],
    "crisis": [
        "crisis", "emergency", "domestic violence", "sexual assault",
        "abuse", "hotline", "distress", "suicide",
    ],
    "youth": [
        "youth", "children", "teen", "adolescent", "young people",
        "at risk youth", "child welfare",
    ],
    "seniors": [
        "senior", "elder", "aging", "geriatric", "retirement",
        "palliative", "respite",
    ],
    "newcomer": [
        "immigrant", "refugee", "newcomer", "settlement",
        "english language", "citizenship", "cultural integration",
    ],
}


class CRACharitiesSource(Source):
    """Discovers Alberta charities from CRA open data CSV files."""

    name = "cra_charities"
    url = "https://open.canada.ca/data/en/dataset/05b3abd0-e70f-4b3b-a9c5-acc436bd15b6"

    def _is_relevant(self, charity: dict) -> bool:
        """
        Determine if a CRA charity record is relevant to ResourceHub.

        Filters out:
        - Private and Public Foundations (they fund, not serve)
        - Excluded categories (animals, arts, sports, etc.)
        - Charities with no relevance keywords and no relevant category

        Returns True only for charities providing direct social services.
        """
        designation = charity.get("designation", "")
        category = charity.get("category", "")
        programs = charity.get("programs", "").lower()

        # Foundations are excluded — they fund other orgs, not serve people directly
        if "Foundation" in designation:
            return False

        # Check exclusion keywords first
        for kw in EXCLUSION_KEYWORDS:
            if kw in programs:
                return False

        # Excluded categories are always rejected
        if category in EXCLUDED_CATEGORIES:
            return False

        # No programs description = can't determine relevance, reject
        if not programs:
            return False

        # Check for strong keywords (one match = relevant)
        has_strong = any(kw in programs for kw in STRONG_KEYWORDS)
        if has_strong:
            # Even strong keywords can be overridden by worship-only pattern
            # e.g. a church that mentions "youth" once but is purely worship
            if self._is_worship_only(programs):
                # But allow if they have a real service program override
                has_real_program = any(kw in programs for kw in SERVICE_PROGRAM_OVERRIDES)
                if not has_real_program:
                    return False
            return True

        # Check weak keywords — need 2+ matches
        weak_count = sum(1 for kw in WEAK_KEYWORDS if kw in programs)

        # Worship-only orgs with weak keyword matches are rejected
        # (churches that mention "counselling" or "youth" as minor activities)
        if self._is_worship_only(programs):
            # Only override if they have a real service program
            has_real_program = any(kw in programs for kw in SERVICE_PROGRAM_OVERRIDES)
            if not has_real_program:
                return False

        # Welfare category: accept with any keyword match
        if category == "Welfare":
            return weak_count >= 1

        # Other relevant categories: require 2+ weak keyword matches
        if category in RELEVANT_CATEGORIES:
            return weak_count >= 2

        # Religion/conditional: require 2+ weak keywords (worship filter already applied above)
        if category in CONDITIONAL_CATEGORIES:
            return weak_count >= 2

        # Unknown categories: require 2+ weak keywords
        return weak_count >= 2

    def _is_worship_only(self, programs: str) -> bool:
        """Check if the org is primarily a worship/religious congregation."""
        worship_count = sum(1 for kw in WORSHIP_ONLY_INDICATORS if kw in programs)
        return worship_count >= 2

    def _map_to_category(self, charity: dict) -> str:
        """
        Map a CRA charity to a ResourceHub category based on program keywords.

        Checks keywords in priority order and returns the first match.
        Falls back to 'community_support' if no specific category matches.
        """
        programs = charity.get("programs", "").lower()

        for category, keywords in CATEGORY_KEYWORDS.items():
            for kw in keywords:
                if kw in programs:
                    return category

        return "community_support"

    def _to_raw_service(self, charity: dict) -> RawService:
        """Convert a merged charity record to a RawService."""
        bn = charity.get("bn", "")
        legal_name = charity.get("legal_name", "Unknown")
        city = charity.get("city", "")
        province = charity.get("province", "AB")
        postal_code = charity.get("postal_code", "")
        address = charity.get("address", "")
        programs = charity.get("programs", "")
        website_url = charity.get("website_url")
        category_code = charity.get("category", "")

        location = f"{city}, {province}" if city else province

        # Build description from available data
        desc_parts = []
        if programs:
            desc_parts.append(programs)
        if category_code:
            desc_parts.append(f"CRA Category: {category_code}")
        description = ". ".join(desc_parts) if desc_parts else None

        # Validate BN is digits only before URL interpolation
        if bn and re.match(r'^\d{9}', bn):
            source_url = CRA_DETAIL_URL.format(bn=bn[:9])
        else:
            source_url = self.url

        return RawService(
            name=legal_name,
            category=self._map_to_category(charity),
            source_url=source_url,
            location=location,
            address=address or None,
            website_url=website_url,
            description=description,
            tags=self._build_tags(charity),
            extra={
                "bn": bn,
                "designation": charity.get("designation", ""),
                "cra_category": category_code,
                "postal_code": postal_code,
            },
        )

    def _build_tags(self, charity: dict) -> list[str]:
        """Generate tags from program text and category."""
        tags = ["registered-charity"]
        programs = charity.get("programs", "").lower()

        for cat, keywords in CATEGORY_KEYWORDS.items():
            for kw in keywords:
                if kw in programs:
                    tags.append(cat.replace("_", "-"))
                    break

        return list(dict.fromkeys(tags))  # dedupe preserving order

    # Local file fallback paths (e.g. downloaded from Wayback Machine when site is down)
    LOCAL_CSV_FALLBACKS = {
        "ident_2023_update.csv": "/tmp/cra_ident.csv",
        "new_ongoing_programs_2023_updated.csv": "/tmp/cra_programs.csv",
        "weburl_2023_0721.csv": "/tmp/cra_weburl.csv",
    }

    def _download_csv(self, url: str, session, log, required=True) -> list[dict]:
        """Download and parse a CSV from the Open Government Portal.

        Falls back to local files if the remote server is unreachable.
        """
        filename = url.split("/")[-1]

        # Check for local fallback first (faster, works when site is down)
        local_path = self.LOCAL_CSV_FALLBACKS.get(filename)
        if local_path and os.path.exists(local_path):
            log.info(f"Using local CSV: {local_path}")
            with open(local_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                return list(reader)

        log.info(f"Downloading CSV: {filename}")
        for attempt in range(3):
            try:
                time.sleep(2 * (attempt + 1))
                resp = session.get(url, timeout=180)
                resp.raise_for_status()
                text = resp.content.decode("utf-8-sig")
                reader = csv.DictReader(io.StringIO(text))
                return list(reader)
            except (requests.ConnectionError, requests.Timeout) as e:
                log.warning(f"Attempt {attempt + 1}/3 failed for {filename}: {e}")
                if attempt == 2:
                    if required:
                        raise
                    log.warning(f"Skipping optional CSV {filename} after 3 failures")
                    return []
            except requests.HTTPError as e:
                if not required:
                    log.warning(f"Skipping optional CSV {filename}: {e}")
                    return []
                raise

    def discover(self, session, log, dry_run=False) -> list[RawService]:
        """
        Download CRA open data CSVs, filter to Alberta social service charities,
        and return RawService objects.

        Approach:
        1. Download identification CSV (~86K rows) — filter to Alberta + Registered
        2. Download programs CSV — join by BN for program descriptions
        3. Download weburl CSV — join by BN for website URLs
        4. Apply relevance filter
        5. Convert to RawService objects

        In dry_run mode, downloads are still performed (they're public CSVs)
        but the method logs what would be produced and returns the list.
        """
        # CRA source uses HTTP requests (not the SQLAlchemy DB session)
        http = requests.Session()
        http.headers.update({"User-Agent": "ResourceHub-Scraper/1.0"})

        # Step 1: Download and filter identification data to Alberta
        log.info("Downloading CRA identification data...")
        ident_rows = self._download_csv(IDENT_CSV_URL, http, log)
        time.sleep(2)  # Rate limit

        # Filter to Alberta, Registered charities only
        alberta_charities = {}
        for row in ident_rows:
            province = row.get("Province", "").strip()
            # Accept "AB" or "ALBERTA" variants
            if province.upper() not in ("AB", "ALBERTA"):
                continue

            bn = row.get("BN", "").strip()
            if not bn:
                continue

            # Map numeric codes to human-readable names
            cat_code = row.get("Category", "").strip()
            desig_code = row.get("Designation", "").strip()
            category_name = CATEGORY_CODE_MAP.get(cat_code, "Other")
            designation_name = DESIGNATION_CODE_MAP.get(desig_code, desig_code)

            alberta_charities[bn] = {
                "bn": bn,
                "legal_name": row.get("Legal Name", "").strip(),
                "address": row.get("Address Line 1", "").strip(),
                "city": row.get("City", "").strip(),
                "province": "AB",
                "postal_code": row.get("Postal Code", "").strip(),
                "category": category_name,
                "sub_category": row.get("Sub Category", "").strip(),
                "designation": designation_name,
            }

        log.info(f"Found {len(alberta_charities)} Alberta charities in identification data")

        # Step 2: Download programs and merge by BN (optional — enriches but not required)
        log.info("Downloading CRA programs data...")
        programs_rows = self._download_csv(PROGRAMS_CSV_URL, http, log, required=False)

        # Aggregate all program descriptions per BN
        for row in programs_rows:
            bn = row.get("BN", "").strip()
            if bn in alberta_charities:
                desc = row.get("Description", "").strip()
                if desc:
                    existing = alberta_charities[bn].get("programs", "")
                    if existing:
                        alberta_charities[bn]["programs"] = existing + "; " + desc
                    else:
                        alberta_charities[bn]["programs"] = desc

        # Step 3: Download web URLs and merge by BN (optional)
        log.info("Downloading CRA web URL data...")
        weburl_rows = self._download_csv(WEBURL_CSV_URL, http, log, required=False)
        time.sleep(2)  # Rate limit

        for row in weburl_rows:
            # Weburl CSV uses "BN/NE" as the column name, not "BN"
            bn = row.get("BN/NE", row.get("BN", "")).strip()
            if bn in alberta_charities:
                # Weburl CSV uses "Contact URL" as the column name
                url = row.get("Contact URL", row.get("URL", "")).strip()
                if url:
                    # Ensure URL has protocol
                    if url and not url.startswith(("http://", "https://")):
                        url = "http://" + url
                    alberta_charities[bn]["website_url"] = url

        # Step 4: Apply relevance filtering
        relevant = []
        rejected_count = 0
        for charity in alberta_charities.values():
            if self._is_relevant(charity):
                relevant.append(charity)
            else:
                rejected_count += 1

        log.info(
            f"Relevance filter: {len(relevant)} accepted, {rejected_count} rejected "
            f"(out of {len(alberta_charities)} Alberta charities)"
        )

        # Step 4b: Only keep charities with a usable website URL
        # Services without a URL can't be enriched via web search
        with_url = [c for c in relevant if c.get("website_url")]
        no_url_count = len(relevant) - len(with_url)
        log.info(
            f"URL filter: {len(with_url)} with website, {no_url_count} without "
            f"(dropping {no_url_count} services that can't be enriched)"
        )
        relevant = with_url

        # Step 5: Convert to RawService
        services = [self._to_raw_service(c) for c in relevant]

        if dry_run:
            log.info(f"[DRY RUN] Would produce {len(services)} services from CRA data")
            for svc in services[:10]:
                log.info(f"  - {svc.name} ({svc.category}) [{svc.location}]")
            if len(services) > 10:
                log.info(f"  ... and {len(services) - 10} more")

        log.info(f"CRA Charities source: discovered {len(services)} services")
        return services
