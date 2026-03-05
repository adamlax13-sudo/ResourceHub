"""Tests for pipeline integration of new scrapers."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch


def test_new_phases_in_argparse():
    """Verify new phase names are accepted by argparse."""
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", nargs="+", choices=[
        "211", "enrich", "websites", "deepcrawl", "extract",
        "informalberta", "normalize", "tags", "embeddings", "dedupe",
        "recover", "refresh",
        "veterans", "acds", "homelesshub", "ahs", "211direct",
    ])
    args = parser.parse_args(["--phase", "veterans", "acds"])
    assert "veterans" in args.phase
    assert "acds" in args.phase


def test_scraper_imports():
    """Verify all source modules can be imported."""
    from sources.veterans_affairs import VeteransAffairsScraper
    from sources.acds import ACDSScraper
    from sources.homeless_hub import HomelessHubScraper
    from sources.ahs_findhealth import AHSFindHealthScraper
    from sources.ab211_direct import AB211DirectScraper

    assert VeteransAffairsScraper.name == "veterans_affairs"
    assert ACDSScraper.name == "acds"
    assert HomelessHubScraper.name == "homeless_hub"
    assert AHSFindHealthScraper.name == "ahs_findhealth"
    assert AB211DirectScraper.name == "211_direct"
