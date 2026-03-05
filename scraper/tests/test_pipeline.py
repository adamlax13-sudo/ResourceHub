import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch
from pipeline import Pipeline, PipelineStats


def test_pipeline_stats_summary():
    stats = PipelineStats()
    stats.sources_scraped = 3
    stats.services_found = 100
    stats.new_services = 5
    stats.enriched_found = 10
    stats.enriched_verified = 3
    stats.enriched_inferred = 2
    stats.api_cost = 1.84
    summary = stats.summary()
    assert "100" in summary
    assert "$1.84" in summary


def test_pipeline_discover_phase():
    """Discover phase calls all registered source plugins."""
    pipeline = Pipeline(session=MagicMock(), log=MagicMock())
    mock_source = MagicMock()
    mock_source.name = "test_source"
    mock_source.discover.return_value = []
    pipeline.sources = [mock_source]
    pipeline.run_discover(dry_run=True)
    mock_source.discover.assert_called_once()


def test_pipeline_discover_filters_by_source_name():
    """run_discover with source_name only runs that source."""
    pipeline = Pipeline(session=MagicMock(), log=MagicMock())
    source_a = MagicMock()
    source_a.name = "source_a"
    source_a.discover.return_value = []
    source_b = MagicMock()
    source_b.name = "source_b"
    source_b.discover.return_value = []
    pipeline.sources = [source_a, source_b]
    pipeline.run_discover(source_name="source_a", dry_run=True)
    source_a.discover.assert_called_once()
    source_b.discover.assert_not_called()


def test_pipeline_enrich_phase_respects_budget():
    """Enrich phase stops when budget is exceeded."""
    pipeline = Pipeline(session=MagicMock(), log=MagicMock(), budget=0.01)
    pipeline.enrichment_engine = MagicMock()
    pipeline.enrichment_engine.total_cost = 0.02
    pipeline.enrichment_engine.budget_limit = 0.01
    pipeline.run_enrich(dry_run=True)
    pipeline.enrichment_engine.enrich_batch.assert_not_called()


def test_pipeline_phases_run_in_order():
    """Full pipeline runs discover -> enrich -> finalize in order."""
    call_order = []
    pipeline = Pipeline(session=MagicMock(), log=MagicMock())
    pipeline.run_discover = lambda **kw: call_order.append("discover")
    pipeline.run_enrich = lambda **kw: call_order.append("enrich")
    pipeline.run_finalize = lambda **kw: call_order.append("finalize")
    pipeline.run(dry_run=True)
    assert call_order == ["discover", "enrich", "finalize"]


def test_pipeline_single_phase():
    """Running with phase='discover' only runs discover."""
    call_order = []
    pipeline = Pipeline(session=MagicMock(), log=MagicMock())
    pipeline.run_discover = lambda **kw: call_order.append("discover")
    pipeline.run_enrich = lambda **kw: call_order.append("enrich")
    pipeline.run_finalize = lambda **kw: call_order.append("finalize")
    pipeline.run(phase="discover", dry_run=True)
    assert call_order == ["discover"]


def test_pipeline_stats_track_discovery():
    """Discovery stats are tracked correctly."""
    from sources.plugin import RawService
    pipeline = Pipeline(session=MagicMock(), log=MagicMock())
    mock_source = MagicMock()
    mock_source.name = "test"
    mock_source.discover.return_value = [
        RawService(name="Svc 1", category="addiction", source_url="https://example.com/1"),
        RawService(name="Svc 2", category="housing", source_url="https://example.com/2"),
    ]
    pipeline.sources = [mock_source]

    # Mock upsert_service to return "created"
    with patch("pipeline.upsert_service", return_value="created"):
        pipeline.run_discover(dry_run=True)

    assert pipeline.stats.sources_scraped == 1
    assert pipeline.stats.services_found == 2
    assert pipeline.stats.new_services == 2
