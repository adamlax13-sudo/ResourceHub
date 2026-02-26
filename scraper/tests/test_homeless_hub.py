"""Tests for Homeless Hub scraper."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch
from bs4 import BeautifulSoup
from sources.homeless_hub import HomelessHubScraper


SAMPLE_PROFILE_HTML = """
<html><body>
<h1>Calgary Community Profile</h1>
<div class="et_pb_text">
  <h3>Key Organizations</h3>
  <ul>
    <li><a href="https://calgaryhomeless.com">Calgary Homeless Foundation</a></li>
    <li><a href="https://thedi.ca">Calgary Drop-In Centre</a></li>
  </ul>
</div>
<div class="et_pb_text">
  <h3>Community Plans</h3>
  <p><a href="https://example.com/plan.pdf">2024 Plan to End Homelessness</a></p>
</div>
</body></html>
"""

SAMPLE_ALGOLIA_RESPONSE = {
    "hits": [
        {
            "post_title": "Alberta Housing Report 2024",
            "content": "Analysis of housing and homelessness in Alberta.",
            "permalink": "https://homelesshub.ca/resource/alberta-housing-2024",
            "taxonomies": {"resource_type": ["Report"]},
        },
        {
            "post_title": "Calgary Shelter Guide",
            "content": "Guide to shelters in Calgary.",
            "permalink": "https://homelesshub.ca/resource/calgary-shelter-guide",
            "taxonomies": {"resource_type": ["Toolkit"]},
        },
    ],
    "nbHits": 2,
}


def test_parse_community_profile():
    session = MagicMock()
    log = MagicMock()
    scraper = HomelessHubScraper(session=session, log=log)
    soup = BeautifulSoup(SAMPLE_PROFILE_HTML, "html.parser")
    results = scraper.parse_community_profile(soup, "Calgary")
    assert len(results) >= 1
    names = [r["name"] for r in results]
    assert any("Calgary Homeless Foundation" in n for n in names)


def test_parse_algolia_results():
    session = MagicMock()
    log = MagicMock()
    scraper = HomelessHubScraper(session=session, log=log)
    results = scraper.parse_algolia_results(SAMPLE_ALGOLIA_RESPONSE)
    assert len(results) == 2
    assert results[0]["name"] == "Alberta Housing Report 2024"
    assert "homelesshub.ca" in results[0]["website_url"]
