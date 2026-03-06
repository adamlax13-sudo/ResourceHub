#!/usr/bin/env python3
"""
ResourceHub Scraper v2 — 3-Phase Pipeline.

Phases:
  1. Discover — scrape source directories (no AI)
  2. Enrich  — AI-powered extraction of process steps, eligibility, etc.
  3. Finalize — embeddings, normalization, dedup, view refresh

Usage:
    python scraper.py                            # Full pipeline (all phases)
    python scraper.py --phase discover           # Only discovery
    python scraper.py --phase enrich             # Only enrichment
    python scraper.py --phase finalize           # Only finalize
    python scraper.py --source cra_charities     # Only one source
    python scraper.py --budget 5.00              # Cap enrichment spend
    python scraper.py --dry-run                  # Preview changes

Environment:
    DATABASE_URL                      PostgreSQL connection string
    AI_INTEGRATIONS_OPENAI_API_KEY    OpenAI API key for embeddings
    ANTHROPIC_API_KEY                 Claude API key for enrichment
"""

import argparse
import logging
import os
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()

from models import Base, Service, ServiceHistory, ScraperLog, ServiceIntakeDetails, ServiceFieldSource

# Optional OpenAI integration (for embeddings)
try:
    from openai import OpenAI as OpenAIClient
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

# Optional Claude integration (for enrichment)
try:
    from claude_client import ClaudeClient, init_claude
    HAS_CLAUDE = True
except ImportError:
    HAS_CLAUDE = False

# Confidence scoring
try:
    from scoring import calculate_confidence_score, get_confidence_level
    HAS_SCORING = True
except ImportError:
    HAS_SCORING = False
    def calculate_confidence_score(*args, **kwargs): return 50
    def get_confidence_level(score): return "medium"

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


# =============================================================================
# Utility Functions (kept for use by other modules)
# =============================================================================

def should_enrich_field(service: Service, field_name: str) -> bool:
    """Check if a field needs enrichment (is empty/null)."""
    value = getattr(service, field_name, None)
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, list) and len(value) == 0:
        return True
    return False


def init_openai() -> Optional[Any]:
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


def update_service_confidence(
    service: Service,
    session,
    field_sources: Dict[str, str] = None,
    has_website_data: bool = False,
    has_211_data: bool = False,
) -> int:
    """Calculate and update confidence score for a service."""
    from datetime import timedelta

    is_stale = False
    if service.last_updated:
        six_months_ago = datetime.now() - timedelta(days=180)
        is_stale = service.last_updated < six_months_ago

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

    score = calculate_confidence_score(
        service_data,
        field_sources=field_sources or {},
        has_website_data=has_website_data,
        has_211_data=has_211_data,
        is_stale=is_stale,
    )

    service.confidence_score = score
    if field_sources:
        existing_sources = service.field_sources or {}
        existing_sources.update(field_sources)
        service.field_sources = existing_sources

    service.needs_review = score < 60
    logger.info(f"[Confidence] Service '{service.name}': score={score} ({get_confidence_level(score)})")

    return score


# =============================================================================
# CLI & Entry Point
# =============================================================================

def parse_args():
    """v2 CLI argument parser."""
    parser = argparse.ArgumentParser(description="ResourceHub Scraper v2")
    parser.add_argument("--phase", choices=["discover", "enrich", "finalize"],
                        help="Run a single phase (default: all)")
    parser.add_argument("--source", type=str,
                        help="Run only this source plugin (e.g. 211_alberta, cra_charities)")
    parser.add_argument("--budget", type=float,
                        help="Stop enrichment after this dollar amount")
    parser.add_argument("--full", action="store_true",
                        help="Re-enrich all services, not just new/stale")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview changes without saving")
    parser.add_argument("--enrich-service", type=str,
                        help="Enrich a single service by name (for testing)")
    return parser.parse_args()


def main_v2():
    """v2 pipeline entry point."""
    args = parse_args()

    # Import here to avoid circular imports
    from pipeline import Pipeline
    from sources.ab211_direct import AB211DirectSource
    from sources.ahs_findhealth import AHSFindHealthSource
    from sources.homeless_hub import HomelessHubSource
    from sources.acds import ACDSSource
    from sources.veterans_affairs import VeteransAffairsSource
    from sources.cra_charities import CRACharitiesSource
    from enrichment import EnrichmentEngine

    # Database session setup
    session = SessionLocal()
    Base.metadata.create_all(engine)

    run_id = f"pipeline-v2-{str(uuid.uuid4())[:8]}"
    scraper_log = ScraperLog(run_id=run_id, status="running")
    session.add(scraper_log)
    session.commit()

    # Build pipeline — Pipeline expects a standard Python logger
    log = logging.getLogger("pipeline")
    pipeline = Pipeline(session=session, log=log, budget=args.budget)

    # Register all sources
    pipeline.register_source(AB211DirectSource())
    pipeline.register_source(AHSFindHealthSource())
    pipeline.register_source(HomelessHubSource())
    pipeline.register_source(ACDSSource())
    pipeline.register_source(VeteransAffairsSource())
    pipeline.register_source(CRACharitiesSource())

    # Set up enrichment engine
    claude_client = None
    if HAS_CLAUDE:
        claude_client = init_claude()
    if claude_client:
        pipeline.enrichment_engine = EnrichmentEngine(
            claude_client=claude_client,
            budget_limit=args.budget
        )

    # Handle single-service enrichment
    if args.enrich_service:
        print(f"Single service enrichment for '{args.enrich_service}' not yet implemented")
        session.close()
        return

    # Run pipeline
    try:
        pipeline.run(
            phase=args.phase,
            dry_run=args.dry_run,
            full=args.full,
            source_name=args.source,
        )
        scraper_log.status = "completed"
    except Exception as e:
        scraper_log.status = "failed"
        log.error(f"Pipeline failed: {e}")
        raise
    finally:
        scraper_log.completed_at = datetime.utcnow()
        try:
            session.commit()
        except Exception:
            session.rollback()
        session.close()


if __name__ == "__main__":
    main_v2()
