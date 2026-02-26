"""Tests for BaseDirectoryScraper."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch
from sources.base import BaseDirectoryScraper


class ConcreteTestScraper(BaseDirectoryScraper):
    """Concrete implementation for testing."""
    SOURCE_NAME = "test_source"

    def scrape(self):
        return []


def test_base_scraper_instantiation():
    session = MagicMock()
    log = MagicMock()
    scraper = ConcreteTestScraper(session=session, log=log)
    assert scraper.source_name == "test_source"
    assert scraper.session is session


def test_build_service_data():
    session = MagicMock()
    log = MagicMock()
    scraper = ConcreteTestScraper(session=session, log=log)
    data = scraper.build_service_data(
        name="Test Service",
        category="Mental Health",
        location="Calgary",
        phone="403-555-1234",
        email="test@example.ca",
        website_url="https://test.ca",
        address="123 Main St, Calgary, AB",
        hours="Mon-Fri 9-5",
        description="A test service.",
    )
    assert data["name"] == "Test Service"
    assert data["phone"] == "(403) 555-1234"
    assert data["category"] == "Mental Health"
    assert data["location"] == "Calgary"


def test_fuzzy_match():
    session = MagicMock()
    log = MagicMock()
    scraper = ConcreteTestScraper(session=session, log=log)
    assert scraper._fuzzy_match("Calgary Drop-In Centre", "Calgary Drop In Centre") > 0.85
    assert scraper._fuzzy_match("Completely Different Name", "Another Service") < 0.5
