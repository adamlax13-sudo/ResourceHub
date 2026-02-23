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
