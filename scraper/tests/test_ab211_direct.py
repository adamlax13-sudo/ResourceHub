"""Tests for 211 Alberta direct scraper."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch, AsyncMock
from sources.ab211_direct import AB211DirectScraper


def test_parse_listing_html():
    """Test parsing a typical 211 listing result."""
    session = MagicMock()
    log = MagicMock()
    scraper = AB211DirectScraper(session=session, log=log)

    sample_listing = {
        "name": "Calgary Counselling Centre",
        "description": "Professional counselling services for individuals and families.",
        "address": "1000 8 Ave SW, Suite 200, Calgary AB T2P 3M7",
        "phone": "403-691-5991",
        "category": "Mental Health Counselling",
        "website": "https://www.calgarycounselling.com",
    }
    result = scraper.normalize_listing(sample_listing)
    assert result["name"] == "Calgary Counselling Centre"
    assert result["category"] == "Mental Health Counselling"
    assert "calgarycounselling.com" in result["website_url"]


def test_dedup_against_existing():
    """Test that existing services are detected."""
    session = MagicMock()
    log = MagicMock()
    scraper = AB211DirectScraper(session=session, log=log)

    mock_service = MagicMock()
    mock_service.name = "Calgary Counselling Centre"
    scraper._existing_lookup = {"calgary counselling centre": mock_service}

    assert scraper.is_already_known("Calgary Counselling Centre") is True
    assert scraper.is_already_known("Brand New Service") is False


def test_topic_categories_defined():
    """Verify topic categories are defined for browsing."""
    session = MagicMock()
    log = MagicMock()
    scraper = AB211DirectScraper(session=session, log=log)
    assert len(scraper.TOPIC_IDS) > 0
