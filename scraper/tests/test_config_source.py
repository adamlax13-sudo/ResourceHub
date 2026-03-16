"""Tests for config-driven source plugin."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import logging
import tempfile
import yaml
from pathlib import Path
from tests.conftest import MockBackend
from sources.config_source import ConfigDrivenSource, load_config_sources

logger = logging.getLogger("test")


def test_loads_yaml_config():
    config = {"name": "test_source", "url": "https://example.com", "category": "Test"}
    source = ConfigDrivenSource(config)
    assert source.name == "test_source"
    assert source.url == "https://example.com"


def test_extracts_listings_from_html():
    config = {
        "name": "test", "url": "https://example.com", "category": "Test",
        "selectors": {
            "listing": ".service",
            "name": "h3",
            "phone": ".phone",
            "address": ".address",
        },
    }
    html = """
    <div class="service"><h3>Test Service</h3><span class="phone">403-555-0100</span>
    <span class="address">123 Main St, Calgary AB</span></div>
    <div class="service"><h3>Another Service</h3><span class="phone">780-555-0200</span>
    <span class="address">456 Jasper Ave, Edmonton AB</span></div>
    """
    backend = MockBackend({"https://example.com": html})
    source = ConfigDrivenSource(config)
    source.backend = backend
    results = source.discover(session=None, log=logger)
    assert len(results) == 2
    assert results[0].name == "Test Service"
    assert results[0].phone == "403-555-0100"
    assert results[0].location == "Calgary"
    assert results[1].location == "Edmonton"


def test_location_detection():
    config = {
        "name": "test", "url": "https://example.com", "category": "Test",
        "selectors": {"listing": ".svc", "name": "h3", "address": ".addr"},
    }
    html = '<div class="svc"><h3>Svc</h3><span class="addr">789 Centre St, Red Deer AB</span></div>'
    backend = MockBackend({"https://example.com": html})
    source = ConfigDrivenSource(config)
    source.backend = backend
    results = source.discover(session=None, log=logger)
    assert results[0].location == "Red Deer"


def test_missing_fields_are_none():
    config = {
        "name": "test", "url": "https://example.com", "category": "Test",
        "selectors": {"listing": ".svc", "name": "h3"},
    }
    html = '<div class="svc"><h3>Minimal Service</h3></div>'
    backend = MockBackend({"https://example.com": html})
    source = ConfigDrivenSource(config)
    source.backend = backend
    results = source.discover(session=None, log=logger)
    assert len(results) == 1
    assert results[0].phone is None
    assert results[0].email is None
    assert results[0].address is None


def test_load_config_sources_empty_dir():
    """load_config_sources returns empty list when no configs exist."""
    sources = load_config_sources()
    assert isinstance(sources, list)
