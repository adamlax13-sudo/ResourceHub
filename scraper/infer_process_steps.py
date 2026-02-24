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


def has_generic_steps(process_steps: List) -> bool:
    """Check if process steps contain generic/boilerplate patterns."""
    if not process_steps:
        return False

    for step in process_steps:
        # Handle both dict format {"action": "..."} and string format
        if isinstance(step, dict):
            action = step.get("action", "")
        elif isinstance(step, str):
            action = step
        else:
            continue
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
