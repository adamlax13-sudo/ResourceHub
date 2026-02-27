"""Tests for Veterans Affairs Canada scraper."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import MagicMock, patch
from bs4 import BeautifulSoup
from sources.veterans_affairs import VeteransAffairsScraper


SAMPLE_HTML = """
<html><body>
<details class="brdr-0">
  <summary class="brdr-0">Alberta</summary>
  <div class="row">
    <div class="col-xs-12 col-sm-6">
      <h3 class="h4 mrgn-tp-md">Calgary Area Office</h3>
      <p>470-220 4<sup>th</sup> Avenue South East<br/>Calgary, AB T2G 4X3</p>
      <p><span class="bold">Hours:</span> <em>Monday to Friday, 8:30 to 4:30, local time.</em><br/>
         <span class="bold">Telephone:</span> <a href="tel:1-866-522-2122">1-866-522-2122</a><br/>
         <span class="bold">Language Offered:</span> English</p>
    </div>
    <div class="col-xs-12 col-sm-6">
      <h3 class="h4 mrgn-tp-md">Edmonton Area Office</h3>
      <p>Canada Place<br/>9700 Jasper Avenue NW, Suite 260<br/>Edmonton, AB T5J 4C3</p>
      <p><span class="bold">Hours:</span> <em>Monday to Friday, 8:30 to 4:30, local time.</em><br/>
         <span class="bold">Telephone:</span> <a href="tel:1-866-522-2122">1-866-522-2122</a><br/>
         <span class="bold">Language Offered:</span> English</p>
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
