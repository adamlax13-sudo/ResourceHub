"""Tests for confidence scoring module."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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
