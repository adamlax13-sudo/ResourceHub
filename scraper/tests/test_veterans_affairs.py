"""Tests for Veterans Affairs Canada scraper."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch
from bs4 import BeautifulSoup
from sources.veterans_affairs import VeteransAffairsScraper


SAMPLE_HTML = """
<html><body>
<h2 id="ab">Alberta</h2>
<div class="col-md-6">
  <h3>Calgary Area Office</h3>
  <p>Harry Chicken Chicken Chicken Building<br>
  220 4th Avenue SE, Suite 410<br>
  Calgary, Alberta T2G 4X3</p>
  <p>Monday to Friday, 8:30 to 4:30, local time</p>
  <p><a href="tel:1-866-522-2122">1-866-522-2122</a></p>
</div>
<div class="col-md-6">
  <h3>Edmonton Area Office</h3>
  <p>Canada Place<br>
  9700 Jasper Avenue NW, Suite 260<br>
  Edmonton, Alberta T5J 4C3</p>
  <p>Monday to Friday, 8:30 to 4:30, local time</p>
  <p><a href="tel:1-866-522-2122">1-866-522-2122</a></p>
</div>
<h2 id="bc">British Columbia</h2>
<div class="col-md-6">
  <h3>Vancouver Office</h3>
  <p>Some address</p>
</div>
</body></html>
"""


def test_parse_alberta_offices():
    session = MagicMock()
    log = MagicMock()
    scraper = VeteransAffairsScraper(session=session, log=log)
    soup = BeautifulSoup(SAMPLE_HTML, "html.parser")
    results = scraper.parse_offices(soup)
    assert len(results) == 2
    assert results[0]["name"] == "Veterans Affairs Canada - Calgary Area Office"
    assert "Calgary" in results[0]["address"]
    assert results[1]["name"] == "Veterans Affairs Canada - Edmonton Area Office"


def test_phone_extracted():
    session = MagicMock()
    log = MagicMock()
    scraper = VeteransAffairsScraper(session=session, log=log)
    soup = BeautifulSoup(SAMPLE_HTML, "html.parser")
    results = scraper.parse_offices(soup)
    assert results[0]["phone"] != ""


def test_bc_offices_excluded():
    session = MagicMock()
    log = MagicMock()
    scraper = VeteransAffairsScraper(session=session, log=log)
    soup = BeautifulSoup(SAMPLE_HTML, "html.parser")
    results = scraper.parse_offices(soup)
    names = [r["name"] for r in results]
    assert not any("Vancouver" in n for n in names)
