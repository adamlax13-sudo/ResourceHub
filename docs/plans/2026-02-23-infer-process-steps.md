# Process Steps Inference Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate realistic process steps for services missing, having insufficient (<3), or having generic/boilerplate steps using Claude AI inference.

**Architecture:** Two-phase approach - Phase 1 detects services needing inference via keyword matching + Claude verification; Phase 2 generates steps using similar service examples + Claude reasoning. New `process_steps_inferred` column tracks AI-generated steps.

**Tech Stack:** Python, SQLAlchemy, Anthropic Claude API, PostgreSQL

---

## Task 1: Add Database Column

**Files:**
- Modify: `scraper/models.py:37` (add new column after process_steps)

**Step 1: Add the column to the Service model**

In `scraper/models.py`, add after line 37 (`process_steps = Column(JSON)`):

```python
    process_steps = Column(JSON)  # Array of process steps
    process_steps_inferred = Column(Boolean, default=False)  # True if steps were AI-generated
```

**Step 2: Verify model loads without error**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -c "from models import Service; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add scraper/models.py
git commit -m "feat: add process_steps_inferred column to Service model"
```

---

## Task 2: Add Claude Inference Methods

**Files:**
- Modify: `scraper/claude_client.py` (add two new methods at end of class)

**Step 1: Add evaluate_steps_quality method**

Add before the `init_claude()` function (around line 567):

```python
    def evaluate_steps_quality(
        self,
        service_name: str,
        category: str,
        description: str,
        current_steps: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Evaluate if existing process steps are specific enough or too generic.

        Returns:
            Dict with 'is_generic' (bool) and 'reason' (str)
        """
        if not current_steps:
            return {"is_generic": True, "reason": "No steps provided"}

        steps_text = "\n".join([
            f"Step {s.get('step', i+1)}: {s.get('action', 'Unknown')}"
            for i, s in enumerate(current_steps)
        ])

        system_prompt = """You are evaluating process steps for social services.
Determine if the steps are SPECIFIC enough to actually help someone access the service,
or if they are GENERIC placeholders that could apply to any service."""

        user_prompt = f"""Service: {service_name}
Category: {category}
Description: {description[:500] if description else 'Not provided'}

Current Process Steps:
{steps_text}

Are these steps specific to THIS service, or are they generic placeholders?
Consider: Do they mention specific intake processes, assessments, timelines, or requirements unique to this type of service?"""

        tool_schema = {
            "type": "object",
            "properties": {
                "is_generic": {
                    "type": "boolean",
                    "description": "True if steps are generic/boilerplate, False if specific"
                },
                "reason": {
                    "type": "string",
                    "description": "Brief explanation of the assessment"
                }
            },
            "required": ["is_generic", "reason"]
        }

        result = self.extract_with_tool(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            tool_name="evaluate_steps",
            tool_schema=tool_schema,
            tool_description="Evaluate if process steps are specific or generic",
        )

        return result or {"is_generic": False, "reason": "Evaluation failed"}

    def infer_process_steps(
        self,
        service_name: str,
        category: str,
        description: str,
        eligibility: str,
        location: str,
        similar_examples: List[Dict[str, Any]],
    ) -> Optional[List[Dict[str, Any]]]:
        """Generate realistic process steps based on service context and similar examples.

        Args:
            service_name: Name of the service
            category: Service category
            description: Service description
            eligibility: Who can access the service
            location: Service location
            similar_examples: List of similar services with their process_steps

        Returns:
            List of process step dicts with 'step', 'action', 'details' keys
        """
        # Format examples
        examples_text = ""
        for i, ex in enumerate(similar_examples[:3], 1):
            steps = ex.get("process_steps", [])
            if steps:
                steps_formatted = "\n".join([
                    f"  Step {s.get('step', j+1)}: {s.get('action', '')}"
                    for j, s in enumerate(steps)
                ])
                examples_text += f"\nExample {i}: {ex.get('name', 'Unknown')}\n{steps_formatted}\n"

        system_prompt = """You are generating realistic process steps for accessing social services in Alberta, Canada.

IMPORTANT GUIDELINES:
1. Generate 4-6 specific, actionable steps
2. Use patterns from similar services but customize to this specific service
3. Include realistic details about what happens at each stage
4. Steps should guide someone who has never accessed this type of service
5. Be specific: "Call the 24-hour crisis line at the shelter" not "Call for info"
6. Include typical elements: initial contact, assessment/intake, documentation, service delivery
7. Do NOT use generic placeholders like "Visit website" or "Contact organization" """

        user_prompt = f"""Generate process steps for this service:

SERVICE CONTEXT:
Name: {service_name}
Category: {category}
Description: {description[:800] if description else 'Not provided'}
Eligibility: {eligibility[:300] if eligibility else 'Not provided'}
Location: {location or 'Alberta'}

EXAMPLES FROM SIMILAR SERVICES:
{examples_text if examples_text else 'No examples available - use your knowledge of typical processes for this service type.'}

Generate 4-6 specific process steps for accessing this service."""

        tool_schema = {
            "type": "object",
            "properties": {
                "process_steps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "step": {"type": "integer"},
                            "action": {"type": "string"},
                            "details": {"type": ["string", "null"]}
                        },
                        "required": ["step", "action"]
                    },
                    "minItems": 3,
                    "maxItems": 7
                }
            },
            "required": ["process_steps"]
        }

        result = self.extract_with_tool(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            tool_name="generate_process_steps",
            tool_schema=tool_schema,
            tool_description="Generate realistic process steps for accessing a service",
        )

        if result and "process_steps" in result:
            return result["process_steps"]
        return None
```

**Step 2: Add List import if missing**

Check top of file - if `List` not imported from typing, add it:
```python
from typing import Any, Dict, List, Optional
```

**Step 3: Verify claude_client loads**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -c "from claude_client import ClaudeClient; print('OK')"`
Expected: `OK`

**Step 4: Commit**

```bash
git add scraper/claude_client.py
git commit -m "feat: add evaluate_steps_quality and infer_process_steps methods to ClaudeClient"
```

---

## Task 3: Create Inference Script

**Files:**
- Create: `scraper/infer_process_steps.py`

**Step 1: Create the inference script**

```python
#!/usr/bin/env python3
"""Infer process steps for services missing or having generic steps."""

import os
import sys
import time
import json
import logging
import re
from datetime import datetime
from typing import List, Dict, Any, Optional

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text
from scraper import SessionLocal, Service
from claude_client import init_claude

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Generic step patterns to detect boilerplate
GENERIC_PATTERNS = [
    r"call\s+(to\s+)?(inquire|for\s+(more\s+)?info)",
    r"visit\s+(the\s+)?website",
    r"check\s+(the\s+)?website",
    r"contact\s+(the\s+)?organization",
    r"reach\s+out\s+to",
    r"fill\s+out\s+(an?\s+)?application",
    r"complete\s+(the\s+)?form",
    r"call\s+for\s+details",
    r"inquire\s+about",
    r"get\s+in\s+touch",
]
GENERIC_REGEX = re.compile("|".join(GENERIC_PATTERNS), re.IGNORECASE)


def has_generic_steps(process_steps: List[Dict]) -> bool:
    """Check if process steps contain generic/boilerplate patterns."""
    if not process_steps:
        return False

    for step in process_steps:
        action = step.get("action", "")
        if GENERIC_REGEX.search(action):
            return True
    return False


def get_step_count(process_steps) -> int:
    """Safely get the number of process steps."""
    if not process_steps:
        return 0
    if isinstance(process_steps, list):
        return len(process_steps)
    return 0


def get_similar_services(session, category: str, exclude_id: str, limit: int = 3) -> List[Dict]:
    """Fetch similar services with good process steps as examples."""
    result = session.execute(text('''
        SELECT name, category, description, process_steps
        FROM services
        WHERE category = :category
          AND service_id != :exclude_id
          AND is_active = TRUE
          AND process_steps IS NOT NULL
          AND process_steps::text != '[]'
          AND process_steps::text != 'null'
          AND (process_steps_inferred IS NULL OR process_steps_inferred = FALSE)
          AND json_array_length(process_steps) >= 4
        ORDER BY RANDOM()
        LIMIT :limit
    '''), {"category": category, "exclude_id": exclude_id, "limit": limit}).fetchall()

    return [
        {
            "name": r[0],
            "category": r[1],
            "description": r[2],
            "process_steps": r[3] if isinstance(r[3], list) else json.loads(r[3]) if r[3] else []
        }
        for r in result
    ]


def main():
    session = SessionLocal()
    claude = init_claude()

    if not claude:
        logger.error("Claude client not available - check ANTHROPIC_API_KEY")
        return

    # Ensure column exists (idempotent)
    try:
        session.execute(text('''
            ALTER TABLE services ADD COLUMN IF NOT EXISTS process_steps_inferred BOOLEAN DEFAULT FALSE
        '''))
        session.commit()
        logger.info("Ensured process_steps_inferred column exists")
    except Exception as e:
        logger.warning(f"Column check: {e}")
        session.rollback()

    # Query candidate services
    result = session.execute(text('''
        SELECT service_id, name, category, description, eligibility, location, process_steps
        FROM services
        WHERE is_active = TRUE
          AND (
            process_steps IS NULL
            OR process_steps::text = '[]'
            OR process_steps::text = 'null'
            OR json_array_length(process_steps) < 3
          )
    ''')).fetchall()

    candidates = [
        {
            "service_id": r[0],
            "name": r[1],
            "category": r[2],
            "description": r[3],
            "eligibility": r[4],
            "location": r[5],
            "process_steps": r[6] if isinstance(r[6], list) else json.loads(r[6]) if r[6] else []
        }
        for r in result
    ]

    logger.info(f"Found {len(candidates)} candidate services")

    # Stats
    stats = {
        "analyzed": 0,
        "already_adequate": 0,
        "flagged_missing": 0,
        "flagged_insufficient": 0,
        "flagged_generic": 0,
        "inferred": 0,
        "skipped_api_error": 0,
        "skipped_no_examples": 0,
    }

    for i, svc in enumerate(candidates):
        stats["analyzed"] += 1
        logger.info(f"[{i+1}/{len(candidates)}] Analyzing: {svc['name']}")

        step_count = get_step_count(svc["process_steps"])
        needs_inference = False
        reason = ""

        # Phase 1: Detection
        if step_count == 0:
            needs_inference = True
            reason = "missing"
            stats["flagged_missing"] += 1
        elif step_count < 3:
            # Check for generic patterns first
            if has_generic_steps(svc["process_steps"]):
                needs_inference = True
                reason = "generic"
                stats["flagged_generic"] += 1
            else:
                # Claude verification for borderline cases
                try:
                    eval_result = claude.evaluate_steps_quality(
                        service_name=svc["name"],
                        category=svc["category"],
                        description=svc["description"] or "",
                        current_steps=svc["process_steps"],
                    )
                    if eval_result.get("is_generic", False):
                        needs_inference = True
                        reason = "generic (Claude verified)"
                        stats["flagged_generic"] += 1
                    else:
                        needs_inference = True
                        reason = "insufficient"
                        stats["flagged_insufficient"] += 1
                    time.sleep(1)
                except Exception as e:
                    logger.warning(f"  Claude eval failed: {e}")
                    needs_inference = True
                    reason = "insufficient (eval failed)"
                    stats["flagged_insufficient"] += 1

        if not needs_inference:
            stats["already_adequate"] += 1
            continue

        logger.info(f"  Flagged: {reason}")

        # Phase 2: Generation
        try:
            similar = get_similar_services(session, svc["category"], svc["service_id"])

            if not similar:
                logger.warning(f"  No similar services found for category: {svc['category']}")
                # Still try to infer without examples

            new_steps = claude.infer_process_steps(
                service_name=svc["name"],
                category=svc["category"],
                description=svc["description"] or "",
                eligibility=svc["eligibility"] or "",
                location=svc["location"] or "Alberta",
                similar_examples=similar,
            )

            if new_steps and len(new_steps) >= 3:
                # Update the service
                service = session.query(Service).filter_by(service_id=svc["service_id"]).first()
                if service:
                    service.process_steps = new_steps
                    service.process_steps_inferred = True
                    service.last_updated = datetime.now()
                    session.commit()
                    stats["inferred"] += 1
                    logger.info(f"  Inferred {len(new_steps)} steps")
            else:
                logger.warning(f"  Inference returned insufficient steps")
                stats["skipped_api_error"] += 1

            time.sleep(1)

        except Exception as e:
            logger.error(f"  Inference error: {e}")
            session.rollback()
            stats["skipped_api_error"] += 1

    # Print summary
    print("\n" + "=" * 50)
    print("INFERENCE COMPLETE")
    print("=" * 50)
    print(f"Services analyzed:      {stats['analyzed']}")
    print(f"Already adequate:       {stats['already_adequate']}")
    print(f"Flagged (missing):      {stats['flagged_missing']}")
    print(f"Flagged (insufficient): {stats['flagged_insufficient']}")
    print(f"Flagged (generic):      {stats['flagged_generic']}")
    print(f"Successfully inferred:  {stats['inferred']}")
    print(f"Skipped (API error):    {stats['skipped_api_error']}")
    print(f"Skipped (no examples):  {stats['skipped_no_examples']}")
    print("=" * 50)

    session.close()


if __name__ == "__main__":
    main()
```

**Step 2: Make script executable**

Run: `chmod +x /Users/adamyeo/Desktop/ResourceHub/scraper/infer_process_steps.py`

**Step 3: Verify script syntax**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -m py_compile infer_process_steps.py && echo "OK"`
Expected: `OK`

**Step 4: Commit**

```bash
git add scraper/infer_process_steps.py
git commit -m "feat: add infer_process_steps.py script for AI-based step generation"
```

---

## Task 4: Test End-to-End

**Step 1: Run the inference script**

Run: `cd /Users/adamyeo/Desktop/ResourceHub/scraper && python infer_process_steps.py`

Expected: Script runs, shows progress, and prints summary showing services analyzed and inferred.

**Step 2: Verify inferred steps in database**

Run:
```bash
cd /Users/adamyeo/Desktop/ResourceHub/scraper && python -c "
from dotenv import load_dotenv
load_dotenv()
from scraper import SessionLocal
from sqlalchemy import text

session = SessionLocal()
result = session.execute(text('''
    SELECT name, json_array_length(process_steps) as step_count
    FROM services
    WHERE process_steps_inferred = TRUE
    LIMIT 5
''')).fetchall()
print('Services with inferred steps:')
for r in result:
    print(f'  {r[0]}: {r[1]} steps')
session.close()
"
```

Expected: Shows services with inferred steps and step counts.

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete process steps inference system

- Add process_steps_inferred column to track AI-generated steps
- Add ClaudeClient methods for step evaluation and inference
- Create infer_process_steps.py script with two-phase approach
- Phase 1: Detect missing/insufficient/generic steps
- Phase 2: Generate steps using similar service examples"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add database column | `models.py` |
| 2 | Add Claude methods | `claude_client.py` |
| 3 | Create inference script | `infer_process_steps.py` |
| 4 | Test end-to-end | Run and verify |
