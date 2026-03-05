import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from unittest.mock import MagicMock
from sources.plugin import Source, RawService


def test_raw_service_has_required_fields():
    svc = RawService(
        name="Test Service",
        category="addiction",
        location="Calgary, AB",
        phone="403-555-1234",
        source_url="https://example.com/test",
    )
    assert svc.name == "Test Service"
    assert svc.source_url == "https://example.com/test"


def test_raw_service_optional_fields_default_none():
    svc = RawService(name="Test", category="housing", source_url="https://example.com")
    assert svc.email is None
    assert svc.address is None
    assert svc.hours is None
    assert svc.website_url is None
    assert svc.description is None
    assert svc.tags is None


def test_source_requires_name_and_url():
    class MySource(Source):
        name = "test_source"
        url = "https://example.com"
        def discover(self, session, log, dry_run=False):
            return []
        def has_changed(self, service_id, last_hash):
            return True

    src = MySource()
    assert src.name == "test_source"
    assert src.url == "https://example.com"


def test_source_abstract_methods_raise():
    with pytest.raises(TypeError):
        Source()
