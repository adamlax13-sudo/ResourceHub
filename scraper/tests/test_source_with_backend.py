"""Cross-source integration tests using MockBackend.

Tests all 5 rewritten source plugins (ACDS, Veterans Affairs, Homeless Hub,
AHS FindHealth, AB 211 Direct) to verify they work correctly with the
CrawlBackend interface.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
import pytest
from unittest.mock import MagicMock, patch

from tests.conftest import MockBackend
from sources.plugin import RawService

logger = logging.getLogger("test")


# =============================================================================
# ACDS Source
# =============================================================================

ACDS_MEMBERS_HTML = """
<html><body>
<h2>Calgary</h2>
<p><strong>DDRC - Disability Services</strong><br>
123 Main St NW<br>
Calgary, AB T2N 1Z6<br>
Phone: (403) 555-0101<br>
<a href="http://www.ddrc.ca">www.ddrc.ca</a><br>
<a href="mailto:info@ddrc.ca">info@ddrc.ca</a></p>

<p><strong>Foothills AIM Society</strong><br>
456 Another Ave SE<br>
Calgary, AB T2G 0A1<br>
Phone: (403) 555-0201<br>
<a href="http://www.foothillsaim.ca">www.foothillsaim.ca</a></p>

<h2>Edmonton</h2>
<p><strong>Skills Society</strong><br>
789 Jasper Ave<br>
Edmonton, AB T5J 1N9<br>
Phone: (780) 555-0301<br>
<a href="http://www.skillssociety.ca">www.skillssociety.ca</a></p>
</body></html>
"""


class TestACDSWithBackend:
    def test_discover_returns_raw_services(self):
        backend = MockBackend({
            "https://acds.ca/memberships/current-members.html": ACDS_MEMBERS_HTML,
        })
        from sources.acds import ACDSSource
        source = ACDSSource()
        source.backend = backend

        results = source.discover(session=None, log=logger)

        assert len(results) == 3
        assert all(isinstance(r, RawService) for r in results)
        assert backend.fetch_log == ["https://acds.ca/memberships/current-members.html"]

    def test_fields_populated(self):
        backend = MockBackend({
            "https://acds.ca/memberships/current-members.html": ACDS_MEMBERS_HTML,
        })
        from sources.acds import ACDSSource
        source = ACDSSource()
        source.backend = backend

        results = source.discover(session=None, log=logger)
        ddrc = results[0]

        assert "DDRC" in ddrc.name
        assert ddrc.category == "Disability Support Services"
        assert ddrc.location == "Calgary"
        assert ddrc.phone != ""
        assert "ddrc.ca" in ddrc.website_url
        assert "ddrc.ca" in ddrc.email

    def test_region_assignment(self):
        backend = MockBackend({
            "https://acds.ca/memberships/current-members.html": ACDS_MEMBERS_HTML,
        })
        from sources.acds import ACDSSource
        source = ACDSSource()
        source.backend = backend

        results = source.discover(session=None, log=logger)
        assert results[0].location == "Calgary"
        assert results[1].location == "Calgary"
        assert results[2].location == "Edmonton"


# =============================================================================
# Veterans Affairs Source
# =============================================================================

VAC_CONTACT_HTML = """
<html><body>
<details class="brdr-0">
  <summary class="brdr-0">Alberta</summary>
  <div class="row">
    <div class="col-xs-12 col-sm-6">
      <h3 class="h4 mrgn-tp-md">Calgary Area Office</h3>
      <p>470-220 4th Avenue South East<br/>Calgary, AB T2G 4X3</p>
      <p><span class="bold">Hours:</span> <em>Monday to Friday, 8:30 to 4:30</em><br/>
         <span class="bold">Telephone:</span> <a href="tel:1-866-522-2122">1-866-522-2122</a></p>
    </div>
    <div class="col-xs-12 col-sm-6">
      <h3 class="h4 mrgn-tp-md">Edmonton Area Office</h3>
      <p>9700 Jasper Avenue NW, Suite 260<br/>Edmonton, AB T5J 4C3</p>
      <p><span class="bold">Hours:</span> <em>Monday to Friday, 8:30 to 4:30</em><br/>
         <span class="bold">Telephone:</span> <a href="tel:1-866-522-2122">1-866-522-2122</a></p>
    </div>
  </div>
</details>
<details class="brdr-0">
  <summary class="brdr-0">British Columbia</summary>
  <div class="row">
    <div class="col-xs-12 col-sm-6">
      <h3 class="h4 mrgn-tp-md">Vancouver Office</h3>
      <p>Some address in Vancouver, BC</p>
    </div>
  </div>
</details>
</body></html>
"""


class TestVeteransAffairsWithBackend:
    def test_discover_returns_alberta_offices(self):
        backend = MockBackend({
            "https://www.veterans.gc.ca/en/contact-us": VAC_CONTACT_HTML,
        })
        from sources.veterans_affairs import VeteransAffairsSource
        source = VeteransAffairsSource()
        source.backend = backend

        results = source.discover(session=None, log=logger)

        assert len(results) == 2
        assert all(isinstance(r, RawService) for r in results)

    def test_excludes_non_alberta(self):
        backend = MockBackend({
            "https://www.veterans.gc.ca/en/contact-us": VAC_CONTACT_HTML,
        })
        from sources.veterans_affairs import VeteransAffairsSource
        source = VeteransAffairsSource()
        source.backend = backend

        results = source.discover(session=None, log=logger)
        names = [r.name for r in results]
        assert not any("Vancouver" in n for n in names)

    def test_fields_populated(self):
        backend = MockBackend({
            "https://www.veterans.gc.ca/en/contact-us": VAC_CONTACT_HTML,
        })
        from sources.veterans_affairs import VeteransAffairsSource
        source = VeteransAffairsSource()
        source.backend = backend

        results = source.discover(session=None, log=logger)
        calgary = results[0]

        assert "Calgary" in calgary.name
        assert calgary.category == "Veterans Services"
        assert calgary.location == "Calgary"
        assert calgary.phone != ""
        assert calgary.eligibility != ""


# =============================================================================
# Homeless Hub Source
# =============================================================================

HOMELESS_HUB_PROFILE_HTML = """
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
  <p><a href="https://example.com/plan.pdf">2024 Plan</a></p>
</div>
</body></html>
"""

# Minimal homepage for Algolia credential extraction (no valid credentials = skip Algolia)
HOMELESS_HUB_HOME_HTML = """
<html><body>
<h1>Homeless Hub</h1>
<p>Canadian Observatory on Homelessness</p>
</body></html>
"""


class TestHomelessHubWithBackend:
    def test_discover_community_profiles(self):
        """HomelessHub discovers organizations from community profile pages."""
        pages = {}
        # Provide profile pages for all cities
        from sources.homeless_hub import COMMUNITY_PROFILE_URL, ALBERTA_CITIES, BASE_URL
        for city_slug in ALBERTA_CITIES:
            url = COMMUNITY_PROFILE_URL.format(city=city_slug)
            if city_slug == "calgary":
                pages[url] = HOMELESS_HUB_PROFILE_HTML
            else:
                # Minimal page with one org link
                pages[url] = f"""<html><body>
                <a href="https://org-{city_slug}.ca">Org in {city_slug.title()}</a>
                </body></html>"""
        # Homepage for Algolia (no credentials found = graceful skip)
        pages[BASE_URL] = HOMELESS_HUB_HOME_HTML

        backend = MockBackend(pages)
        from sources.homeless_hub import HomelessHubSource
        source = HomelessHubSource()
        source.backend = backend

        results = source.discover(session=None, log=logger)

        # Should find at least the 2 Calgary orgs
        assert len(results) >= 2
        assert all(isinstance(r, RawService) for r in results)
        names = [r.name for r in results]
        assert any("Calgary Homeless Foundation" in n for n in names)

    def test_community_profile_fields(self):
        pages = {}
        from sources.homeless_hub import COMMUNITY_PROFILE_URL, ALBERTA_CITIES, BASE_URL
        for city_slug in ALBERTA_CITIES:
            url = COMMUNITY_PROFILE_URL.format(city=city_slug)
            pages[url] = """<html><body></body></html>"""
        # Override Calgary with real content
        pages[COMMUNITY_PROFILE_URL.format(city="calgary")] = HOMELESS_HUB_PROFILE_HTML
        pages[BASE_URL] = HOMELESS_HUB_HOME_HTML

        backend = MockBackend(pages)
        from sources.homeless_hub import HomelessHubSource
        source = HomelessHubSource()
        source.backend = backend

        results = source.discover(session=None, log=logger)
        calgary_orgs = [r for r in results if r.location == "Calgary"]

        assert len(calgary_orgs) >= 1
        org = calgary_orgs[0]
        assert org.category == "Housing & Homelessness"
        assert org.website_url.startswith("http")
        assert "homelessness" in org.tags


# =============================================================================
# AHS FindHealth Source
# =============================================================================

AHS_SEARCH_HTML = """
<html><body>
<form>
  <input type="hidden" name="__VIEWSTATE" value="FAKE_VIEWSTATE"/>
  <input type="hidden" name="__VIEWSTATEGENERATOR" value="FAKE_GEN"/>
  <input type="hidden" name="__EVENTVALIDATION" value="FAKE_VALIDATION"/>
  <select name="ctl00$MainPlaceHolder$FacilityTypeDropDownList">
    <option value="">-- Select --</option>
    <option value="hospitals">Hospitals</option>
  </select>
</form>
</body></html>
"""

AHS_RESULTS_HTML = """
<html><body>
<form>
  <input type="hidden" name="__VIEWSTATE" value="FAKE_VIEWSTATE2"/>
  <input type="hidden" name="__VIEWSTATEGENERATOR" value="FAKE_GEN2"/>
  <input type="hidden" name="__EVENTVALIDATION" value="FAKE_VALIDATION2"/>
</form>
<div class="search-results">
  <div class="facility-result">
    <h3><a href="/findhealth/facility.aspx?id=1234">Foothills Medical Centre</a></h3>
    <span class="address">1403 29 St NW, Calgary, AB T2N 2T9</span>
    <span class="phone">403-944-1110</span>
    <span class="type">Hospital</span>
  </div>
  <div class="facility-result">
    <h3><a href="/findhealth/facility.aspx?id=5678">Royal Alexandra Hospital</a></h3>
    <span class="address">10240 Kingsway NW, Edmonton, AB T5H 3V9</span>
    <span class="phone">780-735-4111</span>
    <span class="type">Hospital</span>
  </div>
</div>
</body></html>
"""


class TestAHSFindHealthWithBackend:
    def test_discover_fetches_initial_page_via_backend(self):
        """AHS uses backend for initial page load, then requests for POST."""
        from sources.ahs_findhealth import FACILITY_SEARCH_URL, SERVICE_SEARCH_URL

        backend = MockBackend({
            FACILITY_SEARCH_URL: AHS_SEARCH_HTML,
            SERVICE_SEARCH_URL: AHS_SEARCH_HTML,
        })
        from sources.ahs_findhealth import AHSFindHealthSource
        source = AHSFindHealthSource()
        source.backend = backend

        # The source uses backend.fetch_page for initial load, then
        # requests.Session.post for form submission. We mock the POST.
        with patch("requests.Session.post") as mock_post:
            mock_response = MagicMock()
            mock_response.content = AHS_RESULTS_HTML.encode()
            mock_response.status_code = 200
            mock_response.raise_for_status = MagicMock()
            mock_post.return_value = mock_response

            results = source.discover(session=None, log=logger)

        # Backend should have been called for initial page loads
        assert FACILITY_SEARCH_URL in backend.fetch_log
        assert all(isinstance(r, RawService) for r in results)

    def test_parse_results_from_html(self):
        """parse_results extracts facility entries from search results."""
        from bs4 import BeautifulSoup
        from sources.ahs_findhealth import AHSFindHealthSource

        source = AHSFindHealthSource()
        soup = BeautifulSoup(AHS_RESULTS_HTML, "html.parser")
        results = source.parse_results(soup)

        assert len(results) == 2
        assert results[0]["name"] == "Foothills Medical Centre"
        assert "Calgary" in results[0]["address"]

    def test_viewstate_extraction(self):
        """Extracts ASP.NET ViewState tokens from search page."""
        from bs4 import BeautifulSoup
        from sources.ahs_findhealth import AHSFindHealthSource

        source = AHSFindHealthSource()
        soup = BeautifulSoup(AHS_SEARCH_HTML, "html.parser")
        tokens = source.extract_viewstate(soup)

        assert tokens["__VIEWSTATE"] == "FAKE_VIEWSTATE"
        assert tokens["__VIEWSTATEGENERATOR"] == "FAKE_GEN"


# =============================================================================
# AB 211 Direct Source
# =============================================================================

AB211_TOPICS_HTML = """
<html><body>
<div id="topics">
  <a href="/topic/mental-health" onclick="getSubTopics('mental_health')">Mental Health</a>
  <a href="/topic/housing" onclick="getSubTopics('housing')">Housing</a>
</div>
</body></html>
"""

AB211_TOPIC_RESULTS_HTML = """
<html><body>
<div class="result-item">
  <h3>Calgary Counselling Centre</h3>
  <p>Professional counselling services for individuals and families.</p>
  <span class="phone"><a href="tel:403-691-5991">403-691-5991</a></span>
  <span class="address">1000 8 Ave SW, Calgary AB T2P 3M7</span>
  <a href="https://www.calgarycounselling.com">Visit website</a>
</div>
<div class="result-item">
  <h3>Distress Centre Calgary</h3>
  <p class="description">24-hour crisis support.</p>
  <span class="phone"><a href="tel:403-266-4357">403-266-4357</a></span>
  <span class="address">Suite 300, 1010 8 Ave SW, Calgary AB T2R 0B3</span>
  <a href="https://www.distresscentre.com">Visit website</a>
</div>
</body></html>
"""


class TestAB211DirectWithBackend:
    def test_discover_returns_raw_services(self):
        backend = MockBackend({
            "https://ab.211.ca/how-we-help/": AB211_TOPICS_HTML,
            "https://ab.211.ca/topic/mental-health": AB211_TOPIC_RESULTS_HTML,
            "https://ab.211.ca/topic/housing": AB211_TOPIC_RESULTS_HTML,
        })
        from sources.ab211_direct import AB211DirectSource
        source = AB211DirectSource()
        source.backend = backend

        results = source.discover(session=None, log=logger)

        # 2 topics x 2 listings each = 4 results
        assert len(results) == 4
        assert all(isinstance(r, RawService) for r in results)

    def test_listings_have_correct_fields(self):
        backend = MockBackend({
            "https://ab.211.ca/how-we-help/": AB211_TOPICS_HTML,
            "https://ab.211.ca/topic/mental-health": AB211_TOPIC_RESULTS_HTML,
            "https://ab.211.ca/topic/housing": AB211_TOPIC_RESULTS_HTML,
        })
        from sources.ab211_direct import AB211DirectSource
        source = AB211DirectSource()
        source.backend = backend

        results = source.discover(session=None, log=logger)
        first = results[0]

        assert first.name == "Calgary Counselling Centre"
        assert first.phone == "403-691-5991"
        assert first.location == "Calgary"
        assert "211" in first.tags

    def test_topic_extraction(self):
        """_extract_topic_links finds links with getSubTopics onclick."""
        from sources.ab211_direct import AB211DirectSource
        source = AB211DirectSource()

        topics = source._extract_topic_links(AB211_TOPICS_HTML)
        assert len(topics) == 2
        assert topics[0][1] == "Mental Health"
        assert topics[1][1] == "Housing"

    def test_empty_topics_page(self):
        """Handles empty topics page gracefully."""
        backend = MockBackend({
            "https://ab.211.ca/how-we-help/": "<html><body></body></html>",
        })
        from sources.ab211_direct import AB211DirectSource
        source = AB211DirectSource()
        source.backend = backend

        results = source.discover(session=None, log=logger)
        assert results == []


# =============================================================================
# Backend error handling
# =============================================================================

class TestBackendErrorHandling:
    def test_acds_handles_fetch_error(self):
        """ACDS returns empty list when backend returns error."""
        backend = MockBackend({})  # No pages = all fetches return error
        from sources.acds import ACDSSource
        source = ACDSSource()
        source.backend = backend

        results = source.discover(session=None, log=logger)
        assert results == []

    def test_vac_handles_fetch_error(self):
        """VAC returns empty list when backend returns error."""
        backend = MockBackend({})
        from sources.veterans_affairs import VeteransAffairsSource
        source = VeteransAffairsSource()
        source.backend = backend

        results = source.discover(session=None, log=logger)
        assert results == []

    def test_ab211_handles_topics_fetch_error(self):
        """211 returns empty list when topics page fails."""
        backend = MockBackend({})
        from sources.ab211_direct import AB211DirectSource
        source = AB211DirectSource()
        source.backend = backend

        results = source.discover(session=None, log=logger)
        assert results == []
