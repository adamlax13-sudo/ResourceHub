import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from upserter import upsert_service, compute_page_hash, fuzzy_match
from sources.plugin import RawService


def test_compute_page_hash():
    """Same content = same hash, different content = different hash."""
    assert compute_page_hash("hello") == compute_page_hash("hello")
    assert compute_page_hash("hello") != compute_page_hash("world")


def test_fuzzy_match_identical():
    assert fuzzy_match("Calgary Drug Treatment", "Calgary Drug Treatment") == 1.0


def test_fuzzy_match_similar():
    score = fuzzy_match("Calgary Drug Treatment Centre", "Calgary Drug Treatment Center")
    assert score > 0.85


def test_fuzzy_match_different():
    score = fuzzy_match("Calgary Drug Treatment", "Edmonton Housing Society")
    assert score < 0.5


def test_upsert_creates_new_service():
    """New service (no fuzzy match) gets inserted."""
    from unittest.mock import MagicMock
    session = MagicMock()
    log = MagicMock()
    session.query.return_value.filter_by.return_value.first.return_value = None
    session.query.return_value.filter.return_value.all.return_value = []
    raw = RawService(name="New Service", category="addiction", source_url="https://example.com")
    result = upsert_service(session, log, raw, source_name="test", dry_run=True)
    assert result == "created"


def test_upsert_skips_unchanged():
    """Service whose source page hash hasn't changed gets skipped."""
    from unittest.mock import MagicMock
    session = MagicMock()
    log = MagicMock()
    existing = MagicMock()
    existing.name = "Same Service"
    existing.source_page_hash = compute_page_hash("same content")
    session.query.return_value.filter_by.return_value.first.return_value = existing
    raw = RawService(name="Same Service", category="addiction", source_url="https://example.com")
    result = upsert_service(
        session, log, raw, source_name="test",
        page_content="same content", dry_run=True
    )
    assert result == "skipped"


def test_upsert_enriches_existing():
    """Existing service with empty fields gets enriched."""
    from unittest.mock import MagicMock
    session = MagicMock()
    log = MagicMock()
    existing = MagicMock()
    existing.name = "Existing Service"
    existing.description = None
    existing.phone = None
    existing.email = None
    existing.address = None
    existing.website_url = None
    existing.hours_of_operation = None
    existing.eligibility = None
    existing.contact = None
    existing.tags = []
    existing.source_page_hash = None
    existing.is_active = True
    session.query.return_value.filter_by.return_value.first.return_value = existing
    raw = RawService(
        name="Existing Service",
        category="addiction",
        source_url="https://example.com",
        description="A helpful service",
        phone="403-555-1234",
    )
    result = upsert_service(session, log, raw, source_name="test", dry_run=True)
    assert result == "enriched"


def test_upsert_skips_when_nothing_to_enrich():
    """Existing service with all fields populated gets skipped."""
    from unittest.mock import MagicMock
    session = MagicMock()
    log = MagicMock()
    existing = MagicMock()
    existing.name = "Full Service"
    existing.description = "Already described"
    existing.phone = "403-555-0000"
    existing.email = "test@example.com"
    existing.address = "123 Main St"
    existing.website_url = "https://example.com"
    existing.hours_of_operation = "9-5"
    existing.eligibility = "All"
    existing.contact = "403-555-0000"
    existing.tags = ["addiction"]
    existing.source_page_hash = None
    existing.is_active = True
    session.query.return_value.filter_by.return_value.first.return_value = existing
    raw = RawService(
        name="Full Service",
        category="addiction",
        source_url="https://example.com",
        description="New description",
        phone="403-555-9999",
    )
    result = upsert_service(session, log, raw, source_name="test", dry_run=True)
    assert result == "skipped"
