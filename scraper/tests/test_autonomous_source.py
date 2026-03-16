"""Tests for autonomous source discovery."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
from backends.interface import CrawlPage, CrawlSiteResult, PageType
from tests.conftest import MockBackend
from sources.autonomous_source import AutonomousSource, SeedConfig

logger = logging.getLogger("test")


class ExtendedMockBackend(MockBackend):
    """MockBackend that returns a multi-page CrawlSiteResult for crawl_site."""

    def __init__(self, pages=None, site_pages=None):
        super().__init__(pages)
        self._site_pages = site_pages or {}

    def crawl_site(self, url, config=None):
        if url in self._site_pages:
            pages = self._site_pages[url]
            return CrawlSiteResult(
                base_url=url,
                pages={p.url: p for p in pages},
                total_pages=len(pages),
                duration_seconds=1.0,
            )
        return super().crawl_site(url, config)


def test_creates_org_level_service_from_crawl():
    """When no service pages found, creates org-level entry from all content."""
    backend = ExtendedMockBackend(site_pages={
        "https://org.ca": [
            CrawlPage(url="https://org.ca", status_code=200,
                      markdown="# Welcome", html="<h1>Welcome</h1>", text="Welcome",
                      page_type=PageType.HOME),
        ]
    })
    seed = SeedConfig(url="https://org.ca", organization_name="Test Org",
                      default_location="Calgary")
    source = AutonomousSource([seed])
    source.backend = backend
    results = source.discover(session=None, log=logger)
    assert len(results) == 1
    assert results[0].name == "Test Org"
    assert results[0].location == "Calgary"
    assert results[0].website_url == "https://org.ca"


def test_extracts_contact_from_contact_pages():
    """Phone/email extracted from CONTACT-classified pages."""
    backend = ExtendedMockBackend(site_pages={
        "https://org.ca": [
            CrawlPage(url="https://org.ca", status_code=200,
                      markdown="Home", html="Home", text="Home",
                      page_type=PageType.HOME),
            CrawlPage(url="https://org.ca/contact", status_code=200,
                      markdown="Call us", html="Call us",
                      text="Call us at (403) 555-1234 or email info@org.ca",
                      page_type=PageType.CONTACT),
        ]
    })
    seed = SeedConfig(url="https://org.ca", organization_name="Test Org")
    source = AutonomousSource([seed])
    source.backend = backend
    results = source.discover(session=None, log=logger)
    assert len(results) == 1
    assert results[0].phone == "(403) 555-1234"
    assert results[0].email == "info@org.ca"


def test_creates_entries_from_service_pages():
    """Service/Program pages create individual entries."""
    backend = ExtendedMockBackend(site_pages={
        "https://org.ca": [
            CrawlPage(url="https://org.ca/services", status_code=200,
                      markdown="# Our Services\nWe offer counselling.",
                      html="<h1>Our Services</h1>", text="Our Services",
                      page_type=PageType.SERVICES),
            CrawlPage(url="https://org.ca/programs/youth", status_code=200,
                      markdown="# Youth Program\nFor ages 12-24.",
                      html="<h1>Youth Program</h1>", text="Youth Program",
                      page_type=PageType.PROGRAM),
        ]
    })
    seed = SeedConfig(url="https://org.ca", organization_name="Test Org")
    source = AutonomousSource([seed])
    source.backend = backend
    results = source.discover(session=None, log=logger)
    assert len(results) == 2
    assert "counselling" in results[0].description
    assert "Youth Program" in results[1].description


def test_no_claude_calls_during_discover():
    """Autonomous discovery creates entries without any AI calls."""
    # This test verifies by structure: AutonomousSource.discover() never
    # imports or calls anything from OpenAI/Anthropic clients
    import inspect
    source_code = inspect.getsource(AutonomousSource.discover)
    assert "openai" not in source_code.lower()
    assert "anthropic" not in source_code.lower()
    assert "claude" not in source_code.lower()
