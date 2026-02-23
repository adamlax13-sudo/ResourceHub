# Alberta Social Services Scraper Overhaul - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the scraper to be the best social service resource navigation tool with accurate, comprehensive data on ALL Alberta social services.

**Architecture:** Streamlined 6-phase pipeline replacing current 11 phases. Keep OpenAI for web search (211/InformAlberta are CAPTCHA-protected), use Claude for all extraction. Add confidence scoring, smart refresh, and expanded service categories.

**Tech Stack:** Python 3.11+, Anthropic SDK (Claude), OpenAI SDK (web search only), BeautifulSoup, SQLAlchemy, PostgreSQL

---

## Task 1: Expand Search Categories

**Files:**
- Modify: `scraper/scraper.py:96-114`

**Step 1: Update SEARCH_CATEGORIES to cover all social services**

Replace lines 96-109 with expanded categories:

```python
# 211 Alberta search categories - comprehensive social services
SEARCH_CATEGORIES = [
    # Mental Health & Addiction
    "mental health counselling services",
    "addiction treatment programs",
    "substance abuse recovery centres",
    "detox and withdrawal management",
    "gambling addiction support",
    "eating disorder treatment",
    "trauma and PTSD support",
    "grief and bereavement counselling",
    "dual diagnosis services",

    # Crisis Services
    "crisis intervention hotlines",
    "suicide prevention services",
    "mobile crisis response teams",
    "emergency psychiatric services",

    # Housing & Shelter
    "emergency shelters",
    "transitional housing programs",
    "affordable housing assistance",
    "homelessness prevention services",
    "rent assistance programs",
    "housing for people with disabilities",

    # Domestic Violence & Safety
    "women's shelters",
    "domestic violence support",
    "family violence services",
    "sexual assault support centres",

    # Food & Basic Needs
    "food banks",
    "meal programs",
    "clothing assistance",
    "utility bill assistance",

    # Employment & Financial
    "employment training programs",
    "job search assistance",
    "income support programs",
    "financial counselling",
    "debt management services",

    # Health Care Access
    "low-income health services",
    "prescription assistance programs",
    "dental care for low-income",
    "vision care assistance",

    # Family & Children
    "family counselling services",
    "parenting support programs",
    "childcare subsidies",
    "child protection services",
    "youth programs",

    # Seniors Services
    "seniors mental health",
    "elder abuse support",
    "seniors housing",
    "home care services",

    # Disability Services
    "disability support services",
    "developmental disability programs",
    "brain injury support",
    "wheelchair and mobility assistance",

    # Population-Specific
    "Indigenous wellness services",
    "LGBTQ+ support services",
    "newcomer and immigrant services",
    "refugee support programs",
    "veteran services",

    # Legal & Advocacy
    "legal aid services",
    "tenant rights assistance",
    "immigration legal help",
    "disability advocacy",

    # Peer Support & Recovery
    "peer support programs",
    "12-step programs",
    "recovery support groups",
    "harm reduction services",
]
```

**Step 2: Verify the changes compile**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -c "from scraper import SEARCH_CATEGORIES; print(f'Categories: {len(SEARCH_CATEGORIES)}')"`
Expected: `Categories: 68` (or similar count)

**Step 3: Commit**

```bash
git add scraper/scraper.py
git commit -m "feat(scraper): expand search categories to all social services

Expanded from ~25 mental health focused categories to ~68 covering:
- Housing & shelter
- Food & basic needs
- Employment & financial
- Health care access
- Family & children
- Seniors services
- Disability services
- Legal & advocacy
- And more population-specific services"
```

---

## Task 2: Create Confidence Scoring Module

**Files:**
- Create: `scraper/scoring/__init__.py`
- Create: `scraper/scoring/confidence.py`
- Test: `scraper/tests/test_confidence.py`

**Step 1: Create the scoring package**

Create `scraper/scoring/__init__.py`:

```python
"""Confidence scoring for service data quality."""
from .confidence import calculate_confidence_score, get_confidence_level

__all__ = ["calculate_confidence_score", "get_confidence_level"]
```

**Step 2: Write the confidence scoring module**

Create `scraper/scoring/confidence.py`:

```python
"""
Confidence scoring for service data quality.

Calculates a 0-100 score based on data completeness and source quality.
"""
from typing import Dict, Any, Optional

# Score components
BASE_SCORE = 40

# Positive adjustments
SCORE_DESCRIPTION_WITH_SOURCE = 10
SCORE_CONTACT_COMPLETE = 10  # phone + email
SCORE_HOURS_WITH_SOURCE = 5
SCORE_ELIGIBILITY_WITH_SOURCE = 10
SCORE_PROCESS_STEPS_WITH_SOURCE = 10
SCORE_REQUIRED_DOCS_WITH_SOURCE = 5
SCORE_FROM_211 = 5
SCORE_FROM_OFFICIAL_WEBSITE = 5

# Negative adjustments
PENALTY_MISSING_DESCRIPTION = -15
PENALTY_MISSING_ELIGIBILITY = -10
PENALTY_MISSING_CONTACT = -10
PENALTY_CONFLICTING_INFO = -10
PENALTY_WEBSITE_UNREACHABLE = -5
PENALTY_STALE_DATA = -5  # >6 months old


def calculate_confidence_score(
    service_data: Dict[str, Any],
    field_sources: Optional[Dict[str, str]] = None,
    has_website_data: bool = False,
    has_211_data: bool = False,
    has_conflicts: bool = False,
    website_reachable: bool = True,
    is_stale: bool = False,
) -> int:
    """
    Calculate confidence score for a service.

    Args:
        service_data: Dict with service fields (description, contact, etc.)
        field_sources: Dict mapping field names to source URLs/types
        has_website_data: Whether data was extracted from official website
        has_211_data: Whether data came from 211 Alberta
        has_conflicts: Whether conflicting info was found across sources
        website_reachable: Whether the service website is accessible
        is_stale: Whether data hasn't been updated in >6 months

    Returns:
        Confidence score from 0-100
    """
    score = BASE_SCORE
    field_sources = field_sources or {}

    # Check description
    description = service_data.get("description", "")
    if description and len(str(description).strip()) > 20:
        if "description" in field_sources:
            score += SCORE_DESCRIPTION_WITH_SOURCE
    else:
        score += PENALTY_MISSING_DESCRIPTION

    # Check contact info
    phone = service_data.get("phone", "") or service_data.get("contact", "")
    email = service_data.get("email", "")
    if phone and email:
        score += SCORE_CONTACT_COMPLETE
    elif not phone and not email:
        score += PENALTY_MISSING_CONTACT

    # Check hours
    hours = service_data.get("hours_of_operation", "")
    if hours and len(str(hours).strip()) > 5:
        if "hours_of_operation" in field_sources:
            score += SCORE_HOURS_WITH_SOURCE

    # Check eligibility
    eligibility = service_data.get("eligibility", "")
    if eligibility and len(str(eligibility).strip()) > 10:
        if "eligibility" in field_sources:
            score += SCORE_ELIGIBILITY_WITH_SOURCE
    else:
        score += PENALTY_MISSING_ELIGIBILITY

    # Check process steps
    process_steps = service_data.get("process_steps", [])
    if process_steps and len(process_steps) > 0:
        if "process_steps" in field_sources:
            score += SCORE_PROCESS_STEPS_WITH_SOURCE

    # Check required docs
    required_docs = service_data.get("required_docs", [])
    if required_docs and len(required_docs) > 0:
        if "required_docs" in field_sources:
            score += SCORE_REQUIRED_DOCS_WITH_SOURCE

    # Source bonuses
    if has_211_data:
        score += SCORE_FROM_211
    if has_website_data:
        score += SCORE_FROM_OFFICIAL_WEBSITE

    # Penalties
    if has_conflicts:
        score += PENALTY_CONFLICTING_INFO
    if not website_reachable:
        score += PENALTY_WEBSITE_UNREACHABLE
    if is_stale:
        score += PENALTY_STALE_DATA

    # Clamp to 0-100
    return max(0, min(100, score))


def get_confidence_level(score: int) -> str:
    """
    Get human-readable confidence level.

    Args:
        score: Confidence score 0-100

    Returns:
        'high', 'medium', or 'low'
    """
    if score >= 80:
        return "high"
    elif score >= 60:
        return "medium"
    else:
        return "low"
```

**Step 3: Create tests directory and test file**

Create `scraper/tests/__init__.py`:

```python
"""Tests for the scraper package."""
```

Create `scraper/tests/test_confidence.py`:

```python
"""Tests for confidence scoring module."""
import pytest
from scoring.confidence import calculate_confidence_score, get_confidence_level


def test_base_score_with_empty_data():
    """Empty service should get base score minus penalties."""
    score = calculate_confidence_score({})
    # BASE_SCORE (40) + PENALTY_MISSING_DESCRIPTION (-15) + PENALTY_MISSING_ELIGIBILITY (-10) + PENALTY_MISSING_CONTACT (-10)
    assert score == 5


def test_complete_service_high_score():
    """Complete service with sources should score 80+."""
    service = {
        "description": "A comprehensive mental health service providing counselling and support.",
        "phone": "403-555-1234",
        "email": "help@service.ca",
        "hours_of_operation": "Monday-Friday 9am-5pm",
        "eligibility": "Adults 18+ in Calgary area",
        "process_steps": ["Call to schedule", "Attend intake", "Begin services"],
        "required_docs": ["ID", "Health card"],
    }
    field_sources = {
        "description": "https://service.ca",
        "hours_of_operation": "https://service.ca",
        "eligibility": "https://service.ca",
        "process_steps": "https://service.ca",
        "required_docs": "https://service.ca",
    }
    score = calculate_confidence_score(
        service,
        field_sources=field_sources,
        has_website_data=True,
        has_211_data=True,
    )
    assert score >= 80


def test_missing_critical_fields_low_score():
    """Service missing critical fields should score below 60."""
    service = {
        "name": "Some Service",
        "category": "Mental Health",
    }
    score = calculate_confidence_score(service)
    assert score < 60


def test_penalties_applied():
    """Penalties should reduce score."""
    service = {
        "description": "A service description here.",
        "phone": "403-555-1234",
        "email": "help@test.ca",
        "eligibility": "Open to all",
    }

    base = calculate_confidence_score(service)

    with_conflicts = calculate_confidence_score(service, has_conflicts=True)
    assert with_conflicts < base

    with_stale = calculate_confidence_score(service, is_stale=True)
    assert with_stale < base


def test_confidence_levels():
    """Test confidence level thresholds."""
    assert get_confidence_level(100) == "high"
    assert get_confidence_level(80) == "high"
    assert get_confidence_level(79) == "medium"
    assert get_confidence_level(60) == "medium"
    assert get_confidence_level(59) == "low"
    assert get_confidence_level(0) == "low"


def test_score_clamped_to_valid_range():
    """Score should always be 0-100."""
    # Even with all penalties, shouldn't go below 0
    score = calculate_confidence_score(
        {},
        has_conflicts=True,
        website_reachable=False,
        is_stale=True,
    )
    assert 0 <= score <= 100
```

**Step 4: Run the tests**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && pip install pytest && python -m pytest tests/test_confidence.py -v`
Expected: All 6 tests pass

**Step 5: Commit**

```bash
git add scraper/scoring/ scraper/tests/
git commit -m "feat(scraper): add confidence scoring module

Calculates 0-100 confidence score based on:
- Data completeness (description, contact, eligibility, etc.)
- Source quality (citations from 211 or official website)
- Penalties for missing critical fields, conflicts, stale data

Thresholds: high (80+), medium (60-79), low (<60)"
```

---

## Task 3: Update Claude Client with Improved Extraction Tools

**Files:**
- Modify: `scraper/claude_client.py`

**Step 1: Read existing claude_client.py**

Read the file to understand current structure.

**Step 2: Add new extraction tools with anti-hallucination prompts**

Add these new tool schemas and methods to `claude_client.py`:

```python
# Add after existing TOOL_SCHEMAS around line 50

ANTI_HALLUCINATION_PROMPT = """You are extracting service information from webpage content.

CRITICAL RULES - FOLLOW EXACTLY:
1. ONLY extract information EXPLICITLY stated in the provided text
2. If information is not found, return null - DO NOT guess or infer
3. Before extracting any field, identify the EXACT quote from the source
4. NEVER use information from your training data
5. NEVER infer, assume, or extrapolate beyond what's written
6. If information is ambiguous or unclear, return null
7. Include source quotes for all extracted fields when possible

The text below is the ONLY source you may use. Do not add any information not present in this text."""

# Tool schema for comprehensive service extraction
EXTRACT_FULL_SERVICE_SCHEMA = {
    "type": "object",
    "properties": {
        "description": {
            "type": "string",
            "description": "Service description - null if not explicitly found"
        },
        "description_source": {
            "type": "string",
            "description": "Exact quote from text that description was extracted from"
        },
        "phone": {
            "type": "string",
            "description": "Primary phone number"
        },
        "email": {
            "type": "string",
            "description": "Primary email address"
        },
        "address": {
            "type": "string",
            "description": "Physical address"
        },
        "hours_of_operation": {
            "type": "string",
            "description": "Operating hours"
        },
        "hours_source": {
            "type": "string",
            "description": "Exact quote for hours"
        },
        "eligibility": {
            "type": "string",
            "description": "Who can access this service - null if not found"
        },
        "eligibility_source": {
            "type": "string",
            "description": "Exact quote for eligibility"
        },
        "process_steps": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "step": {"type": "integer"},
                    "action": {"type": "string"},
                    "details": {"type": "string"}
                }
            },
            "description": "Steps to access service - empty array if not found"
        },
        "process_source": {
            "type": "string",
            "description": "Exact quote for process steps"
        },
        "required_docs": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Required documents - empty array if not found"
        },
        "docs_source": {
            "type": "string",
            "description": "Exact quote for required documents"
        },
        "service_format": {
            "type": "string",
            "enum": ["in-person", "virtual", "hybrid"],
            "description": "How service is delivered"
        },
        "languages": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Languages supported"
        },
        "is_24_7": {
            "type": "boolean",
            "description": "Whether service operates 24/7"
        },
        "wait_times": {
            "type": "string",
            "description": "Expected wait times"
        },
        "requires_referral": {
            "type": "boolean",
            "description": "Whether a referral is required"
        },
        "walk_in_available": {
            "type": "boolean",
            "description": "Whether walk-ins are accepted"
        },
        "booking_url": {
            "type": "string",
            "description": "URL for online booking/intake"
        },
        "gender_restriction": {
            "type": "string",
            "enum": ["all", "women_only", "men_only"],
            "description": "Gender restriction if any"
        }
    }
}


# Add this method to the ClaudeClient class

def extract_full_service(
    self,
    page_content: str,
    service_name: str,
    category: str,
    source_url: str = None,
) -> Optional[Dict]:
    """
    Extract comprehensive service data from webpage content.

    Uses anti-hallucination prompts and source citation requirements.

    Args:
        page_content: Text content from the webpage
        service_name: Name of the service being extracted
        category: Service category for context
        source_url: URL the content came from (for citation)

    Returns:
        Dict with extracted fields and source citations, or None if failed
    """
    user_prompt = f"""Service Name: {service_name}
Category: {category}
Source URL: {source_url or "Unknown"}

PAGE CONTENT TO EXTRACT FROM:
---
{page_content[:8000]}
---

Extract all available service information. Remember:
- Only extract what is EXPLICITLY stated above
- Return null for any field not found in the text
- Include exact quotes for source fields
- Do NOT guess or infer information"""

    return self.extract_with_tool(
        system_prompt=ANTI_HALLUCINATION_PROMPT,
        user_prompt=user_prompt,
        tool_name="extract_full_service",
        tool_schema=EXTRACT_FULL_SERVICE_SCHEMA,
        tool_description="Extract comprehensive service information with source citations",
    )
```

**Step 3: Verify the changes compile**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -c "from claude_client import ClaudeClient; print('Import OK')"`
Expected: `Import OK`

**Step 4: Commit**

```bash
git add scraper/claude_client.py
git commit -m "feat(scraper): add comprehensive extraction tool with anti-hallucination

New extract_full_service method:
- Extracts all service fields in one call
- Requires source citations for each field
- Anti-hallucination system prompt prevents inference
- Returns null for fields not explicitly found in source"
```

---

## Task 4: Add Database Fields for Confidence and Sources

**Files:**
- Create: `scraper/migrations/add_confidence_fields.sql`
- Modify: `scraper/models.py`

**Step 1: Create migration SQL**

Create `scraper/migrations/add_confidence_fields.sql`:

```sql
-- Add confidence scoring and source tracking fields to services table
-- Run: psql $DATABASE_URL -f migrations/add_confidence_fields.sql

-- Confidence score (0-100)
ALTER TABLE services ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT 50;

-- Field source tracking (JSON mapping field -> source URL)
ALTER TABLE services ADD COLUMN IF NOT EXISTS field_sources JSONB DEFAULT '{}';

-- Source URLs (array of URLs data was extracted from)
ALTER TABLE services ADD COLUMN IF NOT EXISTS source_urls JSONB DEFAULT '[]';

-- Flag for services that need manual review
ALTER TABLE services ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;

-- Content hash for change detection
ALTER TABLE services ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

-- ETag for HTTP caching
ALTER TABLE services ADD COLUMN IF NOT EXISTS etag VARCHAR(255);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_services_confidence ON services(confidence_score);
CREATE INDEX IF NOT EXISTS idx_services_needs_review ON services(needs_review) WHERE needs_review = TRUE;

-- Update existing services with default confidence score based on completeness
UPDATE services SET confidence_score =
    CASE
        WHEN description IS NOT NULL AND LENGTH(description) > 50
             AND eligibility IS NOT NULL AND LENGTH(eligibility) > 20
             AND (phone IS NOT NULL OR email IS NOT NULL)
             AND process_steps IS NOT NULL AND jsonb_array_length(COALESCE(process_steps, '[]'::jsonb)) > 0
        THEN 80
        WHEN description IS NOT NULL AND LENGTH(description) > 20
             AND (phone IS NOT NULL OR email IS NOT NULL OR contact IS NOT NULL)
        THEN 60
        ELSE 40
    END
WHERE confidence_score IS NULL OR confidence_score = 50;

COMMENT ON COLUMN services.confidence_score IS 'Data quality score 0-100. High (80+), Medium (60-79), Low (<60)';
COMMENT ON COLUMN services.field_sources IS 'JSON mapping field names to source URLs for auditing';
COMMENT ON COLUMN services.needs_review IS 'Flag for services requiring manual review due to low confidence';
```

**Step 2: Update models.py with new fields**

Add these fields to the Service class in `scraper/models.py`:

```python
    # Add after existing confidence_score field (if exists) or after is_active
    confidence_score = Column(Integer, default=50)
    field_sources = Column(JSON, default=dict)
    source_urls = Column(JSON, default=list)
    needs_review = Column(Boolean, default=False)
    content_hash = Column(String(64))
    etag = Column(String(255))
```

**Step 3: Run the migration**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && psql $DATABASE_URL -f migrations/add_confidence_fields.sql`
Expected: ALTER TABLE, CREATE INDEX statements succeed

**Step 4: Commit**

```bash
git add scraper/migrations/add_confidence_fields.sql scraper/models.py
git commit -m "feat(scraper): add confidence scoring and source tracking fields

New database fields:
- confidence_score: 0-100 quality score
- field_sources: JSON mapping fields to source URLs
- source_urls: Array of all source URLs
- needs_review: Flag for low-confidence services
- content_hash: For change detection
- etag: For HTTP caching

Migration auto-calculates initial scores based on completeness."
```

---

## Task 5: Integrate Confidence Scoring into Scraper

**Files:**
- Modify: `scraper/scraper.py`

**Step 1: Add imports for confidence scoring**

Add near the top imports (around line 57):

```python
# Confidence scoring
try:
    from scoring import calculate_confidence_score, get_confidence_level
    HAS_SCORING = True
except ImportError:
    HAS_SCORING = False
    def calculate_confidence_score(*args, **kwargs): return 50
    def get_confidence_level(score): return "medium"
```

**Step 2: Create a function to update service confidence**

Add this function after the utility functions section (around line 200):

```python
def update_service_confidence(
    service: Service,
    session,
    field_sources: Dict[str, str] = None,
    has_website_data: bool = False,
    has_211_data: bool = False,
) -> int:
    """
    Calculate and update confidence score for a service.

    Args:
        service: Service model instance
        session: Database session
        field_sources: Dict mapping field names to source URLs
        has_website_data: Whether data came from official website
        has_211_data: Whether data came from 211 Alberta

    Returns:
        The calculated confidence score
    """
    from datetime import datetime, timedelta

    # Check if data is stale (>6 months since last update)
    is_stale = False
    if service.last_updated:
        six_months_ago = datetime.now() - timedelta(days=180)
        is_stale = service.last_updated < six_months_ago

    # Build service data dict for scoring
    service_data = {
        "description": service.description,
        "phone": service.phone,
        "email": service.email,
        "contact": service.contact,
        "hours_of_operation": service.hours_of_operation,
        "eligibility": service.eligibility,
        "process_steps": service.process_steps,
        "required_docs": service.required_docs,
    }

    # Calculate score
    score = calculate_confidence_score(
        service_data,
        field_sources=field_sources or {},
        has_website_data=has_website_data,
        has_211_data=has_211_data,
        is_stale=is_stale,
    )

    # Update service
    service.confidence_score = score
    if field_sources:
        existing_sources = service.field_sources or {}
        existing_sources.update(field_sources)
        service.field_sources = existing_sources

    # Flag for review if low confidence
    service.needs_review = score < 60

    logger.info(f"[Confidence] Service '{service.name}': score={score} ({get_confidence_level(score)})")

    return score
```

**Step 3: Call confidence scoring after enrichment**

In the `enrich_from_211` function, add confidence tracking after updating fields. Find the section where fields are updated and add:

```python
        # After updating service fields from 211 data, update confidence
        if HAS_SCORING and updates:
            field_sources = {k: "211.ca" for k in updates.keys()}
            update_service_confidence(
                service, session,
                field_sources=field_sources,
                has_211_data=True,
            )
```

Similarly for `enrich_from_informalberta` and website enrichment phases.

**Step 4: Verify compilation**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -c "import scraper; print('OK')"`
Expected: `OK`

**Step 5: Commit**

```bash
git add scraper/scraper.py
git commit -m "feat(scraper): integrate confidence scoring into enrichment pipeline

- Calculate confidence after each enrichment source
- Track field sources for auditing
- Flag low-confidence services (<60) for review
- Log confidence scores during processing"
```

---

## Task 6: Remove Reference Data Phase

**Files:**
- Modify: `scraper/scraper.py`
- Delete: `scraper/reference_data.py` (backup first)

**Step 1: Backup reference_data.py**

Run: `cp /Users/adamyeo/Desktop/ResourceHub/scraper/reference_data.py /Users/adamyeo/Desktop/ResourceHub/scraper/reference_data.py.bak`

**Step 2: Remove reference phase from pipeline**

In `scraper/scraper.py`, find the `run_scraper` function and remove the reference phase call. Also remove the `phase_reference_sync` function if it exists.

Comment out or remove:
```python
# Remove this from run_scraper():
# if not phase or phase == "reference":
#     phase_reference_sync(session, client, claude_client)
```

**Step 3: Update CLI help text**

Update the docstring at the top of scraper.py to remove the reference phase option.

**Step 4: Delete reference_data.py**

Run: `rm /Users/adamyeo/Desktop/ResourceHub/scraper/reference_data.py`

**Step 5: Verify scraper still runs**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python scraper.py --dry-run --phase 211`
Expected: Should run without errors (dry run mode)

**Step 6: Commit**

```bash
git add scraper/scraper.py
git rm scraper/reference_data.py
git commit -m "refactor(scraper): remove reference data phase

The reference_data.py file contained hardcoded seed data that is no longer
needed since the database has ~1000 services from 211 and InformAlberta.

Removed:
- reference_data.py (4500+ lines of hardcoded data)
- phase_reference_sync() function
- --phase reference CLI option

Database is now the source of truth, populated via 211/InformAlberta discovery."
```

---

## Task 7: Create Smart Refresh Module

**Files:**
- Create: `scraper/scheduling/__init__.py`
- Create: `scraper/scheduling/smart_refresh.py`

**Step 1: Create scheduling package**

Create `scraper/scheduling/__init__.py`:

```python
"""Smart refresh scheduling for the scraper."""
from .smart_refresh import (
    check_page_changed,
    get_pages_needing_refresh,
    update_page_cache,
    calculate_content_hash,
)

__all__ = [
    "check_page_changed",
    "get_pages_needing_refresh",
    "update_page_cache",
    "calculate_content_hash",
]
```

**Step 2: Create smart refresh module**

Create `scraper/scheduling/smart_refresh.py`:

```python
"""
Smart refresh module for detecting page changes.

Uses HTTP ETags, Last-Modified headers, and content hashing to detect
when pages have changed and need re-scraping.
"""
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import requests

logger = logging.getLogger(__name__)

# Default headers for requests
DEFAULT_HEADERS = {
    "User-Agent": "ResourceHubBot/2.0 (Alberta Social Services Aggregator; +https://github.com/albertahub)",
}


def calculate_content_hash(content: str) -> str:
    """
    Calculate SHA-256 hash of content for change detection.

    Args:
        content: Text content to hash

    Returns:
        Hex string of SHA-256 hash
    """
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


def check_page_changed(
    url: str,
    stored_etag: Optional[str] = None,
    stored_hash: Optional[str] = None,
    timeout: int = 10,
) -> Tuple[bool, Optional[str], Optional[str], Optional[str]]:
    """
    Check if a page has changed since last fetch.

    Uses HTTP HEAD request with If-None-Match for efficient checking.
    Falls back to content hash comparison if ETag not available.

    Args:
        url: URL to check
        stored_etag: Previously stored ETag header
        stored_hash: Previously stored content hash
        timeout: Request timeout in seconds

    Returns:
        Tuple of (changed: bool, new_etag: str, new_hash: str, content: str)
        content is None if page hasn't changed (304 response)
    """
    try:
        headers = DEFAULT_HEADERS.copy()

        # Try HEAD request with If-None-Match first
        if stored_etag:
            headers["If-None-Match"] = stored_etag
            response = requests.head(url, headers=headers, timeout=timeout, allow_redirects=True)

            if response.status_code == 304:
                # Not modified
                logger.debug(f"[SmartRefresh] {url}: Not modified (304)")
                return (False, stored_etag, stored_hash, None)

            new_etag = response.headers.get("ETag")
            if new_etag and new_etag != stored_etag:
                # ETag changed, need to fetch content
                logger.info(f"[SmartRefresh] {url}: ETag changed")
                response = requests.get(url, headers=DEFAULT_HEADERS, timeout=timeout)
                content = response.text
                new_hash = calculate_content_hash(content)
                return (True, new_etag, new_hash, content)

        # No ETag or need content hash comparison
        response = requests.get(url, headers=DEFAULT_HEADERS, timeout=timeout)
        content = response.text
        new_etag = response.headers.get("ETag")
        new_hash = calculate_content_hash(content)

        if stored_hash and new_hash == stored_hash:
            logger.debug(f"[SmartRefresh] {url}: Content unchanged (hash match)")
            return (False, new_etag, new_hash, None)

        logger.info(f"[SmartRefresh] {url}: Content changed")
        return (True, new_etag, new_hash, content)

    except requests.RequestException as e:
        logger.error(f"[SmartRefresh] Error checking {url}: {e}")
        return (True, None, None, None)  # Assume changed on error


def get_pages_needing_refresh(
    session,
    max_age_days: int = 7,
    limit: int = 100,
) -> List[Dict]:
    """
    Get list of service pages that need refreshing.

    Prioritizes:
    1. Pages never checked
    2. Pages older than max_age_days
    3. Low confidence services

    Args:
        session: Database session
        max_age_days: Refresh pages older than this
        limit: Maximum number of pages to return

    Returns:
        List of dicts with service_id, website_url, etag, content_hash
    """
    from sqlalchemy import text

    cutoff_date = datetime.now() - timedelta(days=max_age_days)

    query = text("""
        SELECT
            service_id,
            website_url,
            etag,
            content_hash,
            confidence_score,
            last_checked
        FROM services
        WHERE is_active = TRUE
          AND website_url IS NOT NULL
          AND website_url != ''
        ORDER BY
            CASE WHEN last_checked IS NULL THEN 0 ELSE 1 END,
            CASE WHEN confidence_score < 60 THEN 0 ELSE 1 END,
            last_checked ASC
        LIMIT :limit
    """)

    result = session.execute(query, {"limit": limit})

    pages = []
    for row in result:
        # Only include if never checked or older than cutoff
        if row.last_checked is None or row.last_checked < cutoff_date:
            pages.append({
                "service_id": row.service_id,
                "website_url": row.website_url,
                "etag": row.etag,
                "content_hash": row.content_hash,
            })

    return pages


def update_page_cache(
    session,
    service_id: str,
    etag: Optional[str],
    content_hash: Optional[str],
):
    """
    Update cached page metadata for a service.

    Args:
        session: Database session
        service_id: Service identifier
        etag: New ETag value
        content_hash: New content hash
    """
    from sqlalchemy import text

    query = text("""
        UPDATE services
        SET
            etag = :etag,
            content_hash = :content_hash,
            last_checked = NOW()
        WHERE service_id = :service_id
    """)

    session.execute(query, {
        "service_id": service_id,
        "etag": etag,
        "content_hash": content_hash,
    })
    session.commit()
```

**Step 3: Verify module loads**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -c "from scheduling import check_page_changed; print('OK')"`
Expected: `OK`

**Step 4: Commit**

```bash
git add scraper/scheduling/
git commit -m "feat(scraper): add smart refresh module for change detection

Uses HTTP ETags and content hashing to detect page changes:
- check_page_changed(): Efficient HEAD request with If-None-Match
- get_pages_needing_refresh(): Prioritizes stale/low-confidence pages
- calculate_content_hash(): SHA-256 for content comparison

Enables daily refresh runs that only re-scrape changed pages."
```

---

## Task 8: Create New 6-Phase Pipeline

**Files:**
- Modify: `scraper/scraper.py`

**Step 1: Define new phase functions**

Add these new phase functions to scraper.py, replacing/updating the existing ones:

```python
def phase_discovery(session, client, claude_client=None):
    """
    Phase 1: Discover services from 211 Alberta and InformAlberta.

    Uses OpenAI web search to query both sources across all categories and regions.
    Creates new services in database.
    """
    logger.info("=" * 60)
    logger.info("PHASE 1: SERVICE DISCOVERY")
    logger.info("=" * 60)

    stats = {"discovered": 0, "created": 0, "errors": 0}

    for category in SEARCH_CATEGORIES:
        for region in MAJOR_REGIONS:
            try:
                services = discover_services_for_category(client, category, region, claude_client)
                stats["discovered"] += len(services)

                for svc_data in services:
                    try:
                        service_id = generate_service_id(svc_data.get("name", ""), svc_data.get("location", region))

                        # Check if exists
                        existing = session.query(Service).filter_by(service_id=service_id).first()
                        if existing:
                            continue

                        # Create new service
                        service = Service(
                            service_id=service_id,
                            name=svc_data.get("name"),
                            category=svc_data.get("category", category.title()),
                            description=svc_data.get("description"),
                            location=svc_data.get("location", region),
                            contact=svc_data.get("contact"),
                            eligibility=svc_data.get("eligibility"),
                            website_url=svc_data.get("website_url"),
                            hours_of_operation=svc_data.get("hours_of_operation"),
                            source_urls=["211.ca"],
                            confidence_score=40,  # Initial low score
                        )
                        session.add(service)
                        session.commit()
                        stats["created"] += 1
                        logger.info(f"[Discovery] Created: {service.name}")

                    except Exception as e:
                        logger.error(f"[Discovery] Error creating service: {e}")
                        session.rollback()
                        stats["errors"] += 1

                time.sleep(3)  # Rate limit

            except Exception as e:
                logger.error(f"[Discovery] Error in {category}/{region}: {e}")
                stats["errors"] += 1

    logger.info(f"[Discovery] Complete: {stats['discovered']} found, {stats['created']} created, {stats['errors']} errors")
    return stats


def phase_deep_extraction(session, client, claude_client=None):
    """
    Phase 3: Deep extract from service websites.

    Crawls service websites and uses Claude to extract structured data.
    Updates services with extracted information.
    """
    logger.info("=" * 60)
    logger.info("PHASE 3: DEEP WEBSITE EXTRACTION")
    logger.info("=" * 60)

    if not HAS_DEEP_CRAWLER:
        logger.warning("Deep crawler not available, skipping phase")
        return {"skipped": True}

    stats = {"processed": 0, "updated": 0, "errors": 0}

    # Get services with websites that need enrichment
    services = session.query(Service).filter(
        Service.is_active == True,
        Service.website_url.isnot(None),
        Service.website_url != "",
    ).order_by(Service.confidence_score.asc()).limit(100).all()

    crawler = DeepCrawler(max_depth=2, max_pages=20, delay=2.0)

    for service in services:
        try:
            logger.info(f"[DeepExtract] Processing: {service.name}")
            stats["processed"] += 1

            # Crawl website
            crawl_result = crawler.crawl(service.website_url)
            if not crawl_result or not crawl_result.pages:
                continue

            # Combine content from key pages
            combined_content = ""
            for page in crawl_result.pages[:10]:
                combined_content += f"\n\n--- {page.page_type.value} PAGE ---\n{page.text_content[:2000]}"

            # Extract with Claude
            if claude_client and HAS_CLAUDE:
                extracted = claude_client.extract_full_service(
                    combined_content,
                    service.name,
                    service.category,
                    source_url=service.website_url,
                )

                if extracted:
                    # Update service with extracted data
                    field_sources = {}
                    for field, value in extracted.items():
                        if value and not field.endswith("_source"):
                            if should_enrich_field(service, field):
                                setattr(service, field, value)
                                field_sources[field] = service.website_url

                    # Update confidence
                    update_service_confidence(
                        service, session,
                        field_sources=field_sources,
                        has_website_data=True,
                    )

                    session.commit()
                    stats["updated"] += 1
                    logger.info(f"[DeepExtract] Updated: {service.name} (confidence: {service.confidence_score})")

            time.sleep(2)  # Rate limit

        except Exception as e:
            logger.error(f"[DeepExtract] Error for {service.name}: {e}")
            session.rollback()
            stats["errors"] += 1

    logger.info(f"[DeepExtract] Complete: {stats['processed']} processed, {stats['updated']} updated, {stats['errors']} errors")
    return stats


def phase_quality_check(session):
    """
    Phase 5: Data quality and deduplication.

    Normalizes contacts, calculates final confidence scores,
    deduplicates services, and flags low-confidence for review.
    """
    logger.info("=" * 60)
    logger.info("PHASE 5: DATA QUALITY & DEDUPLICATION")
    logger.info("=" * 60)

    stats = {"normalized": 0, "deduped": 0, "flagged": 0}

    # Normalize contacts
    services = session.query(Service).filter(Service.is_active == True).all()
    for service in services:
        try:
            if service.contact and not service.phone:
                phone = extract_phone(service.contact)
                if phone:
                    service.phone = phone
                    stats["normalized"] += 1

            if service.contact and not service.email:
                email = extract_email(service.contact)
                if email:
                    service.email = email
                    stats["normalized"] += 1

            # Flag low confidence
            if service.confidence_score and service.confidence_score < 60:
                service.needs_review = True
                stats["flagged"] += 1

        except Exception as e:
            logger.error(f"[Quality] Error for {service.name}: {e}")

    session.commit()

    # Deduplicate (use existing dedupe logic)
    # ... existing dedupe code ...

    logger.info(f"[Quality] Complete: {stats['normalized']} normalized, {stats['flagged']} flagged for review")
    return stats
```

**Step 2: Update run_scraper function**

Update the main `run_scraper` function to use the new 6-phase pipeline:

```python
def run_scraper(phase: str = None, dry_run: bool = False):
    """
    Run the scraper pipeline.

    New 6-Phase Pipeline:
    1. Discovery - Find services from 211/InformAlberta
    2. Website Discovery - Find official website URLs
    3. Deep Extraction - Crawl and extract from websites
    4. AI Enrichment - Use Claude to structure data
    5. Quality Check - Normalize, dedupe, score confidence
    6. Database Sync - Update database and refresh views
    """
    session = SessionLocal()

    try:
        # Initialize AI clients
        client = init_openai() if HAS_OPENAI else None
        claude_client = init_claude() if HAS_CLAUDE else None

        if claude_client:
            logger.info("Claude client initialized (primary extraction)")
        if client:
            logger.info("OpenAI client initialized (web search)")

        # Run phases
        if not phase or phase == "discovery" or phase == "211":
            phase_discovery(session, client, claude_client)

        if not phase or phase == "enrich":
            phase_211_enrich(session, client, claude_client)

        if not phase or phase == "deepcrawl" or phase == "extract":
            phase_deep_extraction(session, client, claude_client)

        if not phase or phase == "informalberta":
            phase_informalberta_enrich(session, client, claude_client)

        if not phase or phase == "quality" or phase == "normalize" or phase == "dedupe":
            phase_quality_check(session)

        if not phase or phase == "embeddings":
            phase_generate_embeddings(session, client)

        if not phase or phase == "refresh":
            phase_refresh_views(session)

        logger.info("Pipeline complete!")

    except Exception as e:
        logger.error(f"Pipeline error: {e}")
        session.rollback()
        raise
    finally:
        session.close()
```

**Step 3: Verify compilation**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -c "import scraper; print('OK')"`
Expected: `OK`

**Step 4: Commit**

```bash
git add scraper/scraper.py
git commit -m "refactor(scraper): implement new 6-phase pipeline

Simplified pipeline:
1. Discovery - Find services from 211/InformAlberta (was phases 1-2)
2. 211 Enrichment - Enrich from 211 data (was phase 3)
3. Deep Extraction - Crawl websites with Claude (was phases 4-5)
4. InformAlberta - Additional enrichment (was phase 5)
5. Quality Check - Normalize, dedupe, confidence scoring (was phases 6-10)
6. Embeddings & Views - Generate search data (was phases 8,11)

Key improvements:
- Claude extraction with anti-hallucination prompts
- Confidence scoring integrated throughout
- Source tracking for all fields
- Low-confidence services flagged for review"
```

---

## Task 9: Add Daily/Monthly Run Modes

**Files:**
- Modify: `scraper/scraper.py`

**Step 1: Add run mode argument**

Update the argparse section to add run mode:

```python
def main():
    parser = argparse.ArgumentParser(description="Alberta Social Services Scraper")
    parser.add_argument(
        "--mode",
        choices=["full", "daily", "quick"],
        default="full",
        help="Run mode: full (monthly), daily (changes only), quick (test run)"
    )
    parser.add_argument(
        "--phase",
        choices=["discovery", "211", "enrich", "deepcrawl", "extract",
                 "informalberta", "quality", "normalize", "dedupe",
                 "embeddings", "refresh", "tags"],
        help="Run specific phase only"
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview without saving")
    parser.add_argument("--limit", type=int, default=100, help="Limit services to process")

    args = parser.parse_args()

    if args.mode == "daily":
        run_daily_refresh(limit=args.limit, dry_run=args.dry_run)
    elif args.mode == "quick":
        run_quick_test(dry_run=args.dry_run)
    else:
        run_scraper(phase=args.phase, dry_run=args.dry_run)
```

**Step 2: Add daily refresh function**

```python
def run_daily_refresh(limit: int = 100, dry_run: bool = False):
    """
    Daily refresh mode - only process changed pages.

    1. Check which service websites have changed (ETag/hash)
    2. Re-extract only changed pages
    3. Update confidence scores
    """
    from scheduling import check_page_changed, get_pages_needing_refresh, update_page_cache

    logger.info("=" * 60)
    logger.info("DAILY REFRESH MODE")
    logger.info("=" * 60)

    session = SessionLocal()
    client = init_openai() if HAS_OPENAI else None
    claude_client = init_claude() if HAS_CLAUDE else None

    try:
        pages = get_pages_needing_refresh(session, max_age_days=7, limit=limit)
        logger.info(f"Found {len(pages)} pages to check")

        stats = {"checked": 0, "changed": 0, "updated": 0}

        for page in pages:
            try:
                changed, new_etag, new_hash, content = check_page_changed(
                    page["website_url"],
                    stored_etag=page["etag"],
                    stored_hash=page["content_hash"],
                )
                stats["checked"] += 1

                if changed and content:
                    stats["changed"] += 1
                    logger.info(f"[Daily] Changed: {page['website_url']}")

                    if not dry_run:
                        # Re-extract with Claude
                        service = session.query(Service).filter_by(
                            service_id=page["service_id"]
                        ).first()

                        if service and claude_client:
                            extracted = claude_client.extract_full_service(
                                content[:8000],
                                service.name,
                                service.category,
                                source_url=page["website_url"],
                            )

                            if extracted:
                                for field, value in extracted.items():
                                    if value and not field.endswith("_source"):
                                        setattr(service, field, value)

                                update_service_confidence(service, session, has_website_data=True)
                                stats["updated"] += 1

                        # Update cache
                        update_page_cache(session, page["service_id"], new_etag, new_hash)

                time.sleep(1)  # Rate limit

            except Exception as e:
                logger.error(f"[Daily] Error checking {page['website_url']}: {e}")

        if not dry_run:
            session.commit()

        logger.info(f"[Daily] Complete: {stats['checked']} checked, {stats['changed']} changed, {stats['updated']} updated")

    finally:
        session.close()
```

**Step 3: Add quick test function**

```python
def run_quick_test(dry_run: bool = True):
    """
    Quick test mode - process 5 services to verify pipeline works.
    """
    logger.info("=" * 60)
    logger.info("QUICK TEST MODE")
    logger.info("=" * 60)

    session = SessionLocal()

    try:
        services = session.query(Service).filter(
            Service.is_active == True,
            Service.website_url.isnot(None),
        ).limit(5).all()

        logger.info(f"Testing with {len(services)} services:")
        for s in services:
            logger.info(f"  - {s.name}: confidence={s.confidence_score}, url={s.website_url}")

        logger.info("Quick test complete - pipeline imports working")

    finally:
        session.close()
```

**Step 4: Update main block**

```python
if __name__ == "__main__":
    main()
```

**Step 5: Verify all modes work**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python scraper.py --mode quick`
Expected: Lists 5 services without errors

**Step 6: Commit**

```bash
git add scraper/scraper.py
git commit -m "feat(scraper): add daily/monthly run modes

New run modes via --mode flag:
- full: Complete monthly pipeline (default)
- daily: Smart refresh - only process changed pages
- quick: Test mode - verify pipeline works

Daily mode uses ETag/content hashing to detect changes,
only re-extracts pages that have actually changed."
```

---

## Task 10: Final Testing and Verification

**Files:**
- All modified files

**Step 1: Run full test suite**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m pytest tests/ -v`
Expected: All tests pass

**Step 2: Run quick mode to verify imports**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python scraper.py --mode quick`
Expected: Outputs list of services without errors

**Step 3: Run discovery phase dry-run**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python scraper.py --phase discovery --dry-run --limit 5`
Expected: Shows discovery working without saving

**Step 4: Check confidence scores in database**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -c "
from sqlalchemy import create_engine, text
import os
engine = create_engine(os.getenv('DATABASE_URL'))
with engine.connect() as conn:
    result = conn.execute(text('SELECT confidence_score, COUNT(*) FROM services WHERE is_active = TRUE GROUP BY confidence_score ORDER BY confidence_score'))
    print('Confidence Score Distribution:')
    for row in result:
        print(f'  Score {row[0]}: {row[1]} services')
"`
Expected: Shows distribution of confidence scores

**Step 5: Final commit**

```bash
git add -A
git commit -m "test(scraper): verify scraper overhaul complete

All components working:
- Expanded 68 search categories
- Confidence scoring module
- Smart refresh scheduling
- Claude extraction with anti-hallucination
- 6-phase pipeline
- Daily/monthly run modes

Ready for production use."
```

---

## Verification Summary

After completing all tasks, verify:

1. **Categories expanded**: `python -c "from scraper import SEARCH_CATEGORIES; print(len(SEARCH_CATEGORIES))"`
   - Should show ~68 categories

2. **Confidence scoring**: `python -m pytest tests/test_confidence.py -v`
   - All 6 tests pass

3. **Smart refresh**: `python -c "from scheduling import check_page_changed; print('OK')"`
   - Imports without error

4. **Claude extraction**: `python -c "from claude_client import ClaudeClient; print('OK')"`
   - Imports without error

5. **Quick test mode**: `python scraper.py --mode quick`
   - Lists services without errors

6. **Daily mode dry-run**: `python scraper.py --mode daily --dry-run --limit 5`
   - Shows pages to check

7. **Database fields**: Check `confidence_score`, `field_sources`, `needs_review` columns exist
