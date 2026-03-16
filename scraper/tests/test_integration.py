# scraper/tests/test_integration.py
import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch
from pipeline import Pipeline
from sources.plugin import Source, RawService


class FakeSource(Source):
    name = "fake"
    url = "https://fake.com"

    def discover(self, session, log, dry_run=False):
        return [
            RawService(name="Fake Service 1", category="addiction", source_url="https://fake.com/1"),
            RawService(name="Fake Service 2", category="housing", source_url="https://fake.com/2"),
        ]


def test_full_pipeline_dry_run():
    """Full pipeline runs all 3 phases without errors in dry-run mode."""
    session = MagicMock()
    log = MagicMock()
    session.query.return_value.filter.return_value.all.return_value = []

    pipeline = Pipeline(session=session, log=log)
    pipeline.register_source(FakeSource())

    # Mock finalize functions to avoid DB/API calls
    with patch("pipeline.phase_normalize_contacts"), \
         patch("pipeline.phase_enhance_tags"), \
         patch("pipeline.phase_generate_embeddings"), \
         patch("pipeline.phase_dedupe_services"), \
         patch("pipeline.phase_refresh_views"):
        pipeline.run(dry_run=True)

    assert pipeline.stats.sources_scraped == 1
    assert pipeline.stats.services_found == 2


def test_single_source_run():
    """Running with --source only executes that source."""
    session = MagicMock()
    log = MagicMock()
    session.query.return_value.filter.return_value.all.return_value = []

    source_a = FakeSource()
    source_a.name = "source_a"
    source_b = MagicMock()
    source_b.name = "source_b"
    source_b.discover = MagicMock(return_value=[])

    pipeline = Pipeline(session=session, log=log)
    pipeline.register_source(source_a)
    pipeline.register_source(source_b)

    with patch("pipeline.phase_normalize_contacts"), \
         patch("pipeline.phase_enhance_tags"), \
         patch("pipeline.phase_generate_embeddings"), \
         patch("pipeline.phase_dedupe_services"), \
         patch("pipeline.phase_refresh_views"):
        pipeline.run(source_name="source_a", dry_run=True)

    assert pipeline.stats.sources_scraped == 1
    source_b.discover.assert_not_called()


def test_discover_creates_new_services():
    """Discovery phase creates new services via upserter."""
    session = MagicMock()
    log = MagicMock()
    session.query.return_value.filter.return_value.all.return_value = []

    pipeline = Pipeline(session=session, log=log)
    pipeline.register_source(FakeSource())

    with patch("pipeline.upsert_service", return_value="created") as mock_upsert:
        pipeline.run_discover(dry_run=True)

    assert mock_upsert.call_count == 2
    assert pipeline.stats.new_services == 2


def test_discover_tracks_enriched_and_skipped():
    """Discovery stats distinguish created/enriched/skipped."""
    session = MagicMock()
    log = MagicMock()

    pipeline = Pipeline(session=session, log=log)

    # Source returns 3 services
    source = MagicMock()
    source.name = "test"
    source.discover.return_value = [
        RawService(name="New", category="addiction", source_url="https://example.com/1"),
        RawService(name="Existing", category="housing", source_url="https://example.com/2"),
        RawService(name="Unchanged", category="crisis", source_url="https://example.com/3"),
    ]
    pipeline.register_source(source)

    # Upsert returns different results for each
    with patch("pipeline.upsert_service", side_effect=["created", "enriched", "skipped"]):
        pipeline.run_discover(dry_run=True)

    assert pipeline.stats.new_services == 1
    assert pipeline.stats.updated_services == 1
    assert pipeline.stats.skipped_unchanged == 1


def test_pipeline_summary_output():
    """Pipeline logs a summary at the end of run."""
    session = MagicMock()
    log = MagicMock()

    pipeline = Pipeline(session=session, log=log)
    pipeline.run_discover = lambda **kw: None
    pipeline.run_enrich = lambda **kw: None
    pipeline.run_finalize = lambda **kw: None

    pipeline.run(dry_run=True)

    # Verify log.info was called with the summary somewhere in its calls
    log.info.assert_called()
    all_log_calls = [call[0][0] for call in log.info.call_args_list if call[0]]
    assert any("Scraper Run Summary" in msg for msg in all_log_calls)


def test_all_real_sources_instantiate():
    """All 6 real source plugins can be instantiated and registered."""
    from sources.ab211_direct import AB211DirectSource
    from sources.ahs_findhealth import AHSFindHealthSource
    from sources.homeless_hub import HomelessHubSource
    from sources.acds import ACDSSource
    from sources.veterans_affairs import VeteransAffairsSource
    from sources.cra_charities import CRACharitiesSource

    pipeline = Pipeline(session=MagicMock(), log=MagicMock())
    sources = [
        AB211DirectSource(),
        AHSFindHealthSource(),
        HomelessHubSource(),
        ACDSSource(),
        VeteransAffairsSource(),
        CRACharitiesSource(),
    ]
    for src in sources:
        pipeline.register_source(src)

    assert len(pipeline.sources) == 6
    names = [s.name for s in pipeline.sources]
    assert "cra_charities" in names
    assert "211_direct" in names
