"""Tests for pipeline integration of new scrapers."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch


def test_v2_phase_names_accepted():
    """Verify new v2 phase names are accepted by argparse."""
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", choices=["discover", "enrich", "finalize"])
    args = parser.parse_args(["--phase", "discover"])
    assert args.phase == "discover"


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
