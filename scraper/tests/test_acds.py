"""Tests for ACDS member directory scraper."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bs4 import BeautifulSoup
from sources.acds import ACDSSource


SAMPLE_HTML = """
<html><body>
<h2>Calgary</h2>
<p><strong>DDRC \u2013 Disability & Rehabilitation Centre</strong><br>
123 Main St NW<br>
Calgary, AB T2N 1Z6<br>
Phone: (403) 555-0101<br>
Fax: (403) 555-0102<br>
<a href="http://www.ddrc.ca">www.ddrc.ca</a><br>
<a href="mailto:info@ddrc.ca">info@ddrc.ca</a></p>
<hr>
<p><strong>Foothills AIM Society</strong><br>
456 Another Ave SE<br>
Calgary, AB T2G 0A1<br>
Phone: (403) 555-0201<br>
<a href="http://www.foothillsaim.ca">www.foothillsaim.ca</a></p>
<hr>
<h2>Edmonton</h2>
<p><strong>Skills Society</strong><br>
789 Jasper Ave<br>
Edmonton, AB T5J 1N9<br>
Phone: (780) 555-0301<br>
<a href="http://www.skillssociety.ca">www.skillssociety.ca</a></p>
</body></html>
"""


def test_parse_members():
    scraper = ACDSSource()
    soup = BeautifulSoup(SAMPLE_HTML, "html.parser")
    results = scraper.parse_members(soup)
    assert len(results) == 3


def test_region_assignment():
    scraper = ACDSSource()
    soup = BeautifulSoup(SAMPLE_HTML, "html.parser")
    results = scraper.parse_members(soup)
    assert results[0].location == "Calgary"
    assert results[2].location == "Edmonton"


def test_fields_extracted():
    scraper = ACDSSource()
    soup = BeautifulSoup(SAMPLE_HTML, "html.parser")
    results = scraper.parse_members(soup)
    ddrc = results[0]
    assert "DDRC" in ddrc.name
    assert ddrc.phone != ""
    assert "ddrc.ca" in ddrc.website_url
    assert "ddrc.ca" in ddrc.email
