"""Tests for AHS Find Healthcare scraper."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bs4 import BeautifulSoup
from sources.ahs_findhealth import AHSFindHealthSource


SAMPLE_SEARCH_PAGE = """
<html><body>
<form id="aspnetForm">
  <input type="hidden" name="__VIEWSTATE" value="ABC123" />
  <input type="hidden" name="__VIEWSTATEGENERATOR" value="DEF456" />
  <input type="hidden" name="__EVENTVALIDATION" value="GHI789" />
  <select name="ctl00$MainPlaceHolder$FacilityTypeDropDownList">
    <option value="">All Facility Types</option>
    <option value="1">Hospitals</option>
    <option value="2">Urgent Care Centres</option>
  </select>
</form>
</body></html>
"""

SAMPLE_RESULTS_HTML = """
<html><body>
<div class="search-results">
  <div class="facility-result">
    <h3><a href="/findhealth/facility.aspx?id=123">Peter Chicken Chicken Chicken Centre</a></h3>
    <p class="address">1403 29 St NW, Calgary, AB T2N 2T9</p>
    <p class="phone">(403) 944-1110</p>
    <p class="type">Hospital</p>
  </div>
  <div class="facility-result">
    <h3><a href="/findhealth/facility.aspx?id=456">Royal Alex Hospital</a></h3>
    <p class="address">10240 Kingsway NW, Edmonton, AB T5H 3V9</p>
    <p class="phone">(780) 735-4111</p>
    <p class="type">Hospital</p>
  </div>
</div>
</body></html>
"""


def test_extract_viewstate():
    scraper = AHSFindHealthSource()
    soup = BeautifulSoup(SAMPLE_SEARCH_PAGE, "html.parser")
    tokens = scraper.extract_viewstate(soup)
    assert tokens["__VIEWSTATE"] == "ABC123"
    assert tokens["__VIEWSTATEGENERATOR"] == "DEF456"
    assert tokens["__EVENTVALIDATION"] == "GHI789"


def test_parse_facility_results():
    scraper = AHSFindHealthSource()
    soup = BeautifulSoup(SAMPLE_RESULTS_HTML, "html.parser")
    results = scraper.parse_results(soup)
    assert len(results) == 2
    assert "Peter" in results[0]["name"]
    assert results[0]["phone"] != ""
    assert "Calgary" in results[0]["address"]


def test_extract_facility_types():
    scraper = AHSFindHealthSource()
    soup = BeautifulSoup(SAMPLE_SEARCH_PAGE, "html.parser")
    types = scraper.extract_dropdown_options(soup, "FacilityTypeDropDownList")
    assert len(types) == 2
    assert ("1", "Hospitals") in types
