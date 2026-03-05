"""Tests for the AI enrichment engine."""

import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock
from enrichment import (
    EnrichmentEngine,
    EnrichmentResult,
    should_enrich,
    batch_services_by_category,
)


def test_enrichment_result_schema():
    """EnrichmentResult has all required fields."""
    result = EnrichmentResult(
        service_id="svc-123",
        process_steps=[{"step": "Call intake", "action": "Phone", "details": "555-1234", "source_url": "https://example.com"}],
        required_docs=[{"document": "Health card", "context": "At intake", "source_url": "https://example.com"}],
        eligibility={"age_range": "18+", "gender": "all", "source_url": "https://example.com"},
        wait_times={"estimate": "2-4 weeks", "source_url": "https://example.com"},
        cost={"is_free": True, "source_url": "https://example.com"},
        confidence=85,
        enrichment_source="found",
        source_urls=["https://example.com"],
    )
    assert result.confidence == 85
    assert result.enrichment_source == "found"
    assert len(result.process_steps) == 1


def test_should_enrich_new_service():
    svc = MagicMock()
    svc.enrichment_date = None
    svc.process_steps = None
    assert should_enrich(svc) is True


def test_should_enrich_stale_service():
    from datetime import datetime, timedelta
    svc = MagicMock()
    svc.enrichment_date = datetime.now() - timedelta(days=91)
    svc.process_steps = None
    assert should_enrich(svc) is True


def test_should_not_enrich_recent_service():
    from datetime import datetime, timedelta
    svc = MagicMock()
    svc.enrichment_date = datetime.now() - timedelta(days=10)
    svc.process_steps = [{"step": "Call"}]
    svc.enrichment_source = "found"
    assert should_enrich(svc) is False


def test_batch_services_by_category():
    services = [MagicMock(category="addiction", name=f"Svc {i}") for i in range(12)]
    batches = batch_services_by_category(services, batch_size=5)
    assert len(batches) == 3  # 5 + 5 + 2
    assert len(batches[0]) == 5
    assert len(batches[2]) == 2


def test_batch_services_mixed_categories():
    svcs = [MagicMock(category="addiction") for _ in range(3)] + \
           [MagicMock(category="housing") for _ in range(3)]
    batches = batch_services_by_category(svcs, batch_size=5)
    # Each category gets its own batches
    assert len(batches) == 2  # 3 addiction + 3 housing, each < 5


def test_inferred_never_overwrites_found():
    svc = MagicMock()
    svc.enrichment_source = "found"
    svc.process_steps = [{"step": "Call intake"}]
    inferred = EnrichmentResult(
        service_id="svc-123",
        process_steps=[{"step": "Inferred step"}],
        confidence=35,
        enrichment_source="inferred",
    )
    engine = EnrichmentEngine(claude_client=MagicMock())
    assert engine._should_apply(svc, inferred) is False


def test_found_overwrites_inferred():
    svc = MagicMock()
    svc.enrichment_source = "inferred"
    svc.process_steps = [{"step": "Inferred step"}]
    found = EnrichmentResult(
        service_id="svc-123",
        process_steps=[{"step": "Real step from website"}],
        confidence=85,
        enrichment_source="found",
    )
    engine = EnrichmentEngine(claude_client=MagicMock())
    assert engine._should_apply(svc, found) is True


def test_budget_limit_stops_enrichment():
    engine = EnrichmentEngine(claude_client=MagicMock(), budget_limit=1.00)
    engine.total_cost = 1.50  # Over budget
    log = MagicMock()
    results = engine.enrich_batch(MagicMock(), log, [MagicMock()], dry_run=True)
    assert results == []


def test_inferred_confidence_capped_at_49():
    engine = EnrichmentEngine(claude_client=MagicMock())
    engine.claude.infer_from_similar = MagicMock(return_value=EnrichmentResult(
        service_id="svc-123",
        process_steps=[{"step": "Inferred"}],
        confidence=75,  # Will be capped
        enrichment_source="found",  # Will be overridden
    ))
    result = engine.enrich_service_inferred(MagicMock(), MagicMock(), MagicMock(), [])
    assert result.confidence <= 49
    assert result.enrichment_source == "inferred"
