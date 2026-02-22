# Scraper Claude Sonnet Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace GPT-4o-mini with Claude Sonnet 4.5 for improved extraction accuracy and reduced hallucinations.

**Architecture:** Add Anthropic SDK alongside existing OpenAI SDK. Keep OpenAI for web search (responses.create with web_search tool) and embeddings. Use Claude Sonnet for all structured extraction tasks via tool_use.

**Tech Stack:** Python 3.9+, anthropic SDK, existing sqlalchemy/requests/beautifulsoup

---

## Task 1: Add Anthropic Dependency

**Files:**
- Modify: `scraper/requirements.txt`
- Modify: `scraper/.env.example`

**Step 1: Add anthropic to requirements.txt**

Edit `scraper/requirements.txt` to add:

```
# Anthropic API (Claude)
anthropic>=0.40.0
```

**Step 2: Update .env.example with new env var**

Edit `scraper/.env.example` to add:

```
# Anthropic API key for Claude
ANTHROPIC_API_KEY=sk-ant-...
```

**Step 3: Install dependencies locally**

Run: `cd scraper && pip install anthropic`
Expected: Successfully installed anthropic-0.x.x

**Step 4: Commit**

```bash
git add scraper/requirements.txt scraper/.env.example
git commit -m "feat(scraper): add anthropic SDK dependency"
```

---

## Task 2: Create Claude Client Module

**Files:**
- Create: `scraper/claude_client.py`

**Step 1: Create the claude_client.py file**

```python
"""
Claude API client for structured extraction.

Uses Anthropic's tool_use for reliable structured output.
Keeps OpenAI for web search and embeddings.
"""

import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

from anthropic import Anthropic
from anthropic.types import Message, ToolUseBlock

logger = logging.getLogger(__name__)

# Claude model to use
CLAUDE_MODEL = "claude-sonnet-4-5-20250929"

# Rate limiting
MIN_REQUEST_INTERVAL = 0.5  # seconds between requests
_last_request_time = 0.0


def _rate_limit():
    """Ensure minimum time between requests."""
    global _last_request_time
    now = time.time()
    elapsed = now - _last_request_time
    if elapsed < MIN_REQUEST_INTERVAL:
        time.sleep(MIN_REQUEST_INTERVAL - elapsed)
    _last_request_time = time.time()


class ClaudeClient:
    """Claude API client for structured extraction."""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize Claude client.

        Args:
            api_key: Anthropic API key. Defaults to ANTHROPIC_API_KEY env var.
        """
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY not set")
        self.client = Anthropic(api_key=self.api_key)
        logger.info("Claude client initialized")

    def extract_with_tool(
        self,
        system_prompt: str,
        user_prompt: str,
        tool_name: str,
        tool_schema: Dict[str, Any],
        tool_description: str,
        max_retries: int = 2,
    ) -> Optional[Dict[str, Any]]:
        """Extract structured data using Claude's tool_use.

        Args:
            system_prompt: System instructions for Claude
            user_prompt: The content to extract from
            tool_name: Name of the extraction tool
            tool_schema: JSON schema for the tool's input
            tool_description: Description of what the tool does
            max_retries: Number of retries on failure

        Returns:
            Extracted data as dict, or None if extraction failed
        """
        _rate_limit()

        tool = {
            "name": tool_name,
            "description": tool_description,
            "input_schema": tool_schema,
        }

        for attempt in range(max_retries + 1):
            try:
                response: Message = self.client.messages.create(
                    model=CLAUDE_MODEL,
                    max_tokens=4096,
                    system=system_prompt,
                    tools=[tool],
                    tool_choice={"type": "tool", "name": tool_name},
                    messages=[{"role": "user", "content": user_prompt}],
                )

                # Extract tool use result
                for block in response.content:
                    if isinstance(block, ToolUseBlock) and block.name == tool_name:
                        return block.input

                logger.warning(f"No tool use found in response for {tool_name}")
                return None

            except Exception as e:
                logger.error(f"Claude extraction failed (attempt {attempt + 1}): {e}")
                if attempt < max_retries:
                    time.sleep(2 ** attempt)  # Exponential backoff
                else:
                    return None

        return None

    def extract_service_details(
        self, page_text: str, service_name: str, category: str
    ) -> Optional[Dict[str, Any]]:
        """Extract service details from webpage content.

        Args:
            page_text: Text content from the webpage
            service_name: Name of the service
            category: Service category

        Returns:
            Dict with extracted fields, or None if extraction failed
        """
        system_prompt = """You are an expert at extracting service information from webpages.

CRITICAL INSTRUCTIONS:
1. Only extract information that is EXPLICITLY stated in the source text
2. Before extracting any field, identify the exact text you're extracting from
3. If information is not found, set the field to null - DO NOT guess or infer
4. If information is ambiguous, set to null
5. Never use information from your training data - only use the provided text

You will extract information about social services in Alberta, Canada."""

        user_prompt = f"""Extract service information from this webpage content.

Service Name: {service_name}
Category: {category}

Webpage Content:
{page_text[:8000]}

Extract all available information. Set fields to null if not found in the text."""

        tool_schema = {
            "type": "object",
            "properties": {
                "description": {
                    "type": ["string", "null"],
                    "description": "Service description from the page. Null if not found.",
                },
                "description_source": {
                    "type": ["string", "null"],
                    "description": "Exact quote from page used for description.",
                },
                "hours_of_operation": {
                    "type": ["string", "null"],
                    "description": "Operating hours. Null if not found.",
                },
                "hours_source": {
                    "type": ["string", "null"],
                    "description": "Exact quote from page for hours.",
                },
                "contact": {
                    "type": ["string", "null"],
                    "description": "Contact info (phone, email). Null if not found.",
                },
                "contact_source": {
                    "type": ["string", "null"],
                    "description": "Exact quote from page for contact.",
                },
                "eligibility": {
                    "type": ["string", "null"],
                    "description": "Who can access this service. Null if not found.",
                },
                "eligibility_source": {
                    "type": ["string", "null"],
                    "description": "Exact quote from page for eligibility.",
                },
                "service_format": {
                    "type": ["string", "null"],
                    "enum": ["in-person", "virtual", "hybrid", None],
                    "description": "How service is delivered. Null if not found.",
                },
                "languages_supported": {
                    "type": ["array", "null"],
                    "items": {"type": "string"},
                    "description": "Languages offered. Null if not found.",
                },
                "booking_url": {
                    "type": ["string", "null"],
                    "description": "URL for booking/intake. Null if not found.",
                },
                "tags": {
                    "type": ["array", "null"],
                    "items": {"type": "string"},
                    "description": "Relevant keywords/tags. Null if not found.",
                },
            },
            "required": [
                "description",
                "hours_of_operation",
                "contact",
                "eligibility",
            ],
        }

        return self.extract_with_tool(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            tool_name="extract_service_details",
            tool_schema=tool_schema,
            tool_description="Extract structured service information from webpage content",
        )

    def parse_discovery_results(
        self, raw_text: str, category: str, region: str
    ) -> List[Dict[str, Any]]:
        """Parse web search results into structured service list.

        Args:
            raw_text: Raw text from web search
            category: Service category searched
            region: Region searched

        Returns:
            List of service dicts
        """
        system_prompt = """You are an expert at parsing search results about social services.

CRITICAL INSTRUCTIONS:
1. Only include services that are EXPLICITLY mentioned in the search results
2. Do not invent or guess service details
3. Skip generic helplines like "211" itself
4. Set fields to null if the information is not in the search results
5. Each service must have at least a name"""

        user_prompt = f"""Parse these search results into a list of services.

Category: {category}
Region: {region}

Search Results:
{raw_text[:6000]}

Extract each distinct service mentioned."""

        tool_schema = {
            "type": "object",
            "properties": {
                "services": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "description": {"type": ["string", "null"]},
                            "contact": {"type": ["string", "null"]},
                            "location": {"type": ["string", "null"]},
                            "website_url": {"type": ["string", "null"]},
                            "hours_of_operation": {"type": ["string", "null"]},
                            "eligibility": {"type": ["string", "null"]},
                            "category": {"type": ["string", "null"]},
                        },
                        "required": ["name"],
                    },
                }
            },
            "required": ["services"],
        }

        result = self.extract_with_tool(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            tool_name="parse_discovery_results",
            tool_schema=tool_schema,
            tool_description="Parse search results into structured service list",
        )

        if result and "services" in result:
            # Add defaults
            for svc in result["services"]:
                svc.setdefault("category", category.title())
                svc.setdefault("location", region)
            return result["services"]
        return []

    def extract_211_data(
        self, search_result: str, service_name: str, fields_needed: List[str]
    ) -> Optional[Dict[str, Any]]:
        """Extract service data from 211 search results.

        Args:
            search_result: Raw text from 211 search
            service_name: Name of service being enriched
            fields_needed: List of fields that need data

        Returns:
            Dict with extracted fields, or None if extraction failed
        """
        system_prompt = """You are an expert at extracting service information from 211 Alberta data.

CRITICAL INSTRUCTIONS:
1. Only extract information that is EXPLICITLY stated in the 211 data
2. If information is not found, set the field to null
3. Do not guess or infer - only use what's explicitly stated
4. For process_steps: extract as an ordered list of steps if found
5. For required_docs: extract as a list of document names if found"""

        user_prompt = f"""Extract service information from this 211 Alberta data.

Service: {service_name}
Fields needed: {', '.join(fields_needed)}

211 Data:
{search_result[:5000]}

Only extract the fields that are needed. Set to null if not found."""

        tool_schema = {
            "type": "object",
            "properties": {
                "description": {"type": ["string", "null"]},
                "contact": {"type": ["string", "null"]},
                "hours_of_operation": {"type": ["string", "null"]},
                "eligibility": {"type": ["string", "null"]},
                "website_url": {"type": ["string", "null"]},
                "tags": {
                    "type": ["array", "null"],
                    "items": {"type": "string"},
                },
                "process_steps": {
                    "type": ["array", "null"],
                    "items": {"type": "string"},
                },
                "required_docs": {
                    "type": ["array", "null"],
                    "items": {"type": "string"},
                },
            },
        }

        result = self.extract_with_tool(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            tool_name="extract_211_data",
            tool_schema=tool_schema,
            tool_description="Extract service data from 211 Alberta search results",
        )

        if result:
            # Filter to only include fields with non-null values that were needed
            valid_fields = {
                "description",
                "contact",
                "hours_of_operation",
                "eligibility",
                "website_url",
                "tags",
                "process_steps",
                "required_docs",
            }
            needed_set = set(fields_needed)
            return {
                k: v
                for k, v in result.items()
                if v is not None and k in valid_fields and k in needed_set
            } or None
        return None

    def extract_informalberta_data(
        self, search_result: str, service_name: str, category: str, fields_needed: List[str]
    ) -> Optional[Dict[str, Any]]:
        """Extract service data from InformAlberta search results.

        Args:
            search_result: Raw text from InformAlberta search
            service_name: Name of service being enriched
            category: Service category
            fields_needed: List of fields that need data

        Returns:
            Dict with extracted fields, or None if extraction failed
        """
        system_prompt = """You are an expert at extracting service information from InformAlberta data.

CRITICAL INSTRUCTIONS:
1. Only extract information that is EXPLICITLY stated in the data
2. If information is not found, set the field to null
3. Validate website URLs - they should be proper URLs starting with http
4. Do not guess or infer - only use what's explicitly stated"""

        user_prompt = f"""Extract service information from this InformAlberta data.

Service: {service_name}
Category: {category}
Fields needed: {', '.join(fields_needed)}

InformAlberta Data:
{search_result[:5000]}

Only extract the fields that are needed. Set to null if not found."""

        tool_schema = {
            "type": "object",
            "properties": {
                "description": {"type": ["string", "null"]},
                "contact": {"type": ["string", "null"]},
                "website_url": {"type": ["string", "null"]},
                "address": {"type": ["string", "null"]},
                "hours_of_operation": {"type": ["string", "null"]},
                "eligibility": {"type": ["string", "null"]},
                "fees": {"type": ["string", "null"]},
                "languages_supported": {
                    "type": ["array", "null"],
                    "items": {"type": "string"},
                },
                "tags": {
                    "type": ["array", "null"],
                    "items": {"type": "string"},
                },
                "process_steps": {
                    "type": ["array", "null"],
                    "items": {"type": "string"},
                },
                "required_docs": {
                    "type": ["array", "null"],
                    "items": {"type": "string"},
                },
                "service_format": {
                    "type": ["string", "null"],
                    "enum": ["in-person", "virtual", "hybrid", None],
                },
            },
        }

        result = self.extract_with_tool(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            tool_name="extract_informalberta_data",
            tool_schema=tool_schema,
            tool_description="Extract service data from InformAlberta search results",
        )

        if result:
            valid_fields = {
                "description",
                "contact",
                "website_url",
                "address",
                "hours_of_operation",
                "eligibility",
                "fees",
                "languages_supported",
                "tags",
                "process_steps",
                "required_docs",
                "service_format",
            }
            needed_set = set(fields_needed)
            filtered = {
                k: v
                for k, v in result.items()
                if v is not None and k in valid_fields and k in needed_set
            }

            # Validate URL
            if filtered.get("website_url"):
                url = filtered["website_url"]
                if not url.startswith("http"):
                    url = f"https://{url}"
                from urllib.parse import urlparse
                try:
                    if urlparse(url).netloc:
                        filtered["website_url"] = url
                    else:
                        del filtered["website_url"]
                except Exception:
                    del filtered["website_url"]

            return filtered or None
        return None


def init_claude() -> Optional[ClaudeClient]:
    """Initialize Claude client if API key is available.

    Returns:
        ClaudeClient instance, or None if not configured
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set - Claude features disabled")
        return None
    try:
        return ClaudeClient(api_key)
    except Exception as e:
        logger.error(f"Failed to initialize Claude client: {e}")
        return None
```

**Step 2: Verify file was created correctly**

Run: `python -c "from claude_client import ClaudeClient; print('Import OK')"` (from scraper dir)
Expected: Import OK (or error about missing API key, which is fine)

**Step 3: Commit**

```bash
git add scraper/claude_client.py
git commit -m "feat(scraper): add Claude client module with tool_use extraction"
```

---

## Task 3: Update scraper.py - Add Claude Import and Init

**Files:**
- Modify: `scraper/scraper.py:57-70` (imports section)
- Modify: `scraper/scraper.py:192-206` (init_openai function area)

**Step 1: Update imports to include Claude**

Find the imports section (around line 57-68) and add Claude import:

```python
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
```

**Step 2: Add init_claude wrapper alongside init_openai**

After the `init_openai()` function (around line 206), the Claude init is already in claude_client.py, but we need to update the run_scraper function to initialize both clients.

**Step 3: Test import**

Run: `cd scraper && python -c "import scraper; print('OK')"`
Expected: OK (with possible warnings about missing modules, which is fine)

**Step 4: Commit**

```bash
git add scraper/scraper.py
git commit -m "feat(scraper): add Claude client import and initialization"
```

---

## Task 4: Replace enrich_with_ai Function

**Files:**
- Modify: `scraper/scraper.py:292-312` (enrich_with_ai function)

**Step 1: Update enrich_with_ai to use Claude**

Replace the `enrich_with_ai` function:

```python
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
```

**Step 2: Commit**

```bash
git add scraper/scraper.py
git commit -m "feat(scraper): update enrich_with_ai to use Claude with OpenAI fallback"
```

---

## Task 5: Replace parse_discovery_results Function

**Files:**
- Modify: `scraper/scraper.py:366-390` (parse_discovery_results function)

**Step 1: Update parse_discovery_results to use Claude**

Replace the function:

```python
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
```

**Step 2: Update discover_services_for_category to pass claude_client**

Find `discover_services_for_category` and update the call to `parse_discovery_results`:

```python
def discover_services_for_category(client: OpenAIClient, category: str, region: str, claude_client=None) -> List[Dict]:
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
```

**Step 3: Commit**

```bash
git add scraper/scraper.py
git commit -m "feat(scraper): update discovery parsing to use Claude"
```

---

## Task 6: Replace enrich_from_211 Function

**Files:**
- Modify: `scraper/scraper.py:393-436` (enrich_from_211 function)

**Step 1: Update enrich_from_211 to use Claude**

```python
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
```

**Step 2: Commit**

```bash
git add scraper/scraper.py
git commit -m "feat(scraper): update enrich_from_211 to use Claude for extraction"
```

---

## Task 7: Replace enrich_from_informalberta Function

**Files:**
- Modify: `scraper/scraper.py:439-505` (enrich_from_informalberta function)

**Step 1: Update enrich_from_informalberta to use Claude**

```python
def enrich_from_informalberta(client, service: Service, claude_client=None) -> Optional[Dict]:
    """Search InformAlberta for service details.
    Only enriches fields that are currently empty in the service.

    Uses OpenAI for web search, Claude for extraction.
    """
    try:
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

        # Use OpenAI for web search
        if not client or not HAS_OPENAI:
            logger.warning("OpenAI client required for InformAlberta web search")
            return None

        response = client.responses.create(
            model="gpt-4o-mini",
            tools=[{"type": "web_search"}],
            input=f'Search informalberta.ca for "{service.name}" in {service.location or "Alberta"}. '
                  f'Find description, phone, website, address, hours, eligibility, fees, languages. Say "NOT_FOUND" if not found.',
        )
        result = response.output_text.strip()
        if "NOT_FOUND" in result.upper():
            return None

        # Use Claude for extraction if available
        if claude_client and HAS_CLAUDE:
            return claude_client.extract_informalberta_data(
                result, service.name, service.category, fields_needed
            )

        # Fallback to OpenAI extraction
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
```

**Step 2: Commit**

```bash
git add scraper/scraper.py
git commit -m "feat(scraper): update enrich_from_informalberta to use Claude"
```

---

## Task 8: Update Phase Functions to Pass Claude Client

**Files:**
- Modify: `scraper/scraper.py` (phase functions and run_scraper)

**Step 1: Update run_scraper to initialize Claude**

Find the `run_scraper` function and update it to initialize Claude:

```python
def run_scraper(phases: Optional[List[str]] = None, dry_run: bool = False):
    """Run the scraper pipeline."""
    start_time = time.time()
    session = SessionLocal()

    try:
        Base.metadata.create_all(engine)
        client = init_openai()

        # Initialize Claude client for extraction
        claude_client = None
        if HAS_CLAUDE:
            claude_client = init_claude()
            if claude_client:
                logger.info("Claude client initialized - using Claude for extraction")
            else:
                logger.info("Claude not configured - using OpenAI for all AI tasks")
        else:
            logger.info("Claude module not available - using OpenAI for all AI tasks")

        # ... rest of function, passing claude_client to phase functions
```

**Step 2: Update phase_reference_sync to accept claude_client**

```python
def phase_reference_sync(session, client: Optional[OpenAIClient], log: ScraperLog, claude_client=None):
    """Phase 1: Sync reference data."""
    # ... existing code, update enrich_with_ai call:
    if urls and client:
        scraped = scrape_website(urls[0])
        if scraped.get("page_text"):
            ai_data = enrich_with_ai(client, scraped["page_text"], svc_data["name"], svc_data.get("category", ""), claude_client)
```

**Step 3: Update phase_211_discovery**

```python
def phase_211_discovery(session, client: OpenAIClient, log: ScraperLog, claude_client=None):
    # ... update discover_services_for_category call:
    for svc in discover_services_for_category(client, category, region, claude_client):
```

**Step 4: Update phase_211_enrich**

```python
def phase_211_enrich(session, client: OpenAIClient, log: ScraperLog, claude_client=None):
    # ... update enrich_from_211 call:
    updates = enrich_from_211(client, service, claude_client)
```

**Step 5: Update phase_website_enrich**

```python
def phase_website_enrich(session, client: Optional[OpenAIClient], log: ScraperLog, claude_client=None):
    # ... update enrich_with_ai call:
    ai_data = enrich_with_ai(client, scraped["page_text"], service.name, service.category, claude_client)
```

**Step 6: Update phase_informalberta_enrich**

```python
def phase_informalberta_enrich(session, client: OpenAIClient, log: ScraperLog, claude_client=None):
    # ... update enrich_from_informalberta call:
    updates = enrich_from_informalberta(client, service, claude_client)
```

**Step 7: Update phase_recover_inactive**

```python
def phase_recover_inactive(session, client: OpenAIClient, log: ScraperLog, claude_client=None):
    # ... update enrichment calls:
    updates = enrich_from_informalberta(client, service, claude_client)
    if not updates:
        updates = enrich_from_211(client, service, claude_client)
```

**Step 8: Update run_scraper to pass claude_client to all phases**

```python
# In run_scraper, update all phase calls:
if all_phases or "reference" in phase_set:
    phase_reference_sync(session, client, log, claude_client)
if (all_phases or "211" in phase_set) and client:
    phase_211_discovery(session, client, log, claude_client)
if (all_phases or "enrich" in phase_set) and client:
    phase_211_enrich(session, client, log, claude_client)
if all_phases or "websites" in phase_set:
    phase_website_enrich(session, client, log, claude_client)
# ... etc for all phases that use AI
if (all_phases or "informalberta" in phase_set) and client:
    phase_informalberta_enrich(session, client, log, claude_client)
if "recover" in phase_set and client:
    phase_recover_inactive(session, client, log, claude_client)
```

**Step 9: Commit**

```bash
git add scraper/scraper.py
git commit -m "feat(scraper): wire Claude client through all phase functions"
```

---

## Task 9: Test the Integration

**Files:**
- No files modified

**Step 1: Set up test environment**

```bash
cd scraper
export ANTHROPIC_API_KEY="your-key-here"  # Or add to .env
export AI_INTEGRATIONS_OPENAI_API_KEY="your-openai-key"
```

**Step 2: Run a dry-run test on normalize phase (no AI)**

Run: `python scraper.py --phase normalize --dry-run`
Expected: Completes without errors, shows "Normalized X services"

**Step 3: Run a dry-run test on tags phase (no AI)**

Run: `python scraper.py --phase tags --dry-run`
Expected: Completes without errors, shows "Enhanced tags for X services"

**Step 4: Test Claude client directly**

```bash
python -c "
from claude_client import init_claude
c = init_claude()
if c:
    result = c.extract_service_details('Hours: Mon-Fri 9am-5pm. Call 555-1234 for appointments.', 'Test Service', 'Mental Health')
    print('Claude extraction:', result)
else:
    print('Claude not configured')
"
```

Expected: Shows extracted hours and contact, or "Claude not configured"

**Step 5: Run single service enrichment test**

Run: `python scraper.py --phase websites --dry-run`
Expected: Attempts to enrich services, logs show "Claude client initialized" or fallback to OpenAI

---

## Task 10: Final Commit and Documentation

**Files:**
- Modify: `scraper/README.md`

**Step 1: Update README with Claude configuration**

Add a section to `scraper/README.md`:

```markdown
## AI Configuration

The scraper supports two AI backends:

### Claude (Recommended)
Set `ANTHROPIC_API_KEY` in your `.env` file:
```env
ANTHROPIC_API_KEY=sk-ant-...
```

Claude Sonnet 4.5 provides more accurate extraction with better anti-hallucination behavior.

### OpenAI (Fallback)
Set `AI_INTEGRATIONS_OPENAI_API_KEY` for web search and fallback extraction:
```env
AI_INTEGRATIONS_OPENAI_API_KEY=sk-...
```

**Note:** OpenAI is always required for web search functionality (211 Alberta, InformAlberta discovery). Claude is used for structured extraction when available.
```

**Step 2: Commit README update**

```bash
git add scraper/README.md
git commit -m "docs(scraper): add Claude configuration instructions"
```

**Step 3: Final integration commit**

```bash
git add -A
git commit -m "feat(scraper): complete Claude Sonnet integration for improved extraction

- Add Anthropic SDK dependency
- Create claude_client.py with tool_use extraction
- Update all extraction functions to prefer Claude
- Keep OpenAI for web search and embeddings
- Add fallback to OpenAI if Claude unavailable
- Update documentation with configuration instructions

Closes: scraper-claude-upgrade"
```

---

## Summary

| Task | Description | Est. Time |
|------|-------------|-----------|
| 1 | Add Anthropic dependency | 2 min |
| 2 | Create Claude client module | 10 min |
| 3 | Update imports | 3 min |
| 4 | Replace enrich_with_ai | 5 min |
| 5 | Replace parse_discovery_results | 5 min |
| 6 | Replace enrich_from_211 | 5 min |
| 7 | Replace enrich_from_informalberta | 5 min |
| 8 | Wire Claude through phase functions | 10 min |
| 9 | Test integration | 10 min |
| 10 | Documentation and final commit | 5 min |

**Total estimated time:** ~60 minutes
