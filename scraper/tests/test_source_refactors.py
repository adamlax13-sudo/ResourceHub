"""Tests for source plugin interface refactors."""
import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sources.plugin import Source
from sources.ab211_direct import AB211DirectSource
from sources.ahs_findhealth import AHSFindHealthSource
from sources.homeless_hub import HomelessHubSource
from sources.acds import ACDSSource
from sources.veterans_affairs import VeteransAffairsSource


ALL_SOURCES = [
    AB211DirectSource,
    AHSFindHealthSource,
    HomelessHubSource,
    ACDSSource,
    VeteransAffairsSource,
]


@pytest.mark.parametrize("source_cls", ALL_SOURCES)
def test_source_inherits_plugin_interface(source_cls):
    assert issubclass(source_cls, Source)


@pytest.mark.parametrize("source_cls", ALL_SOURCES)
def test_source_has_name_and_url(source_cls):
    src = source_cls()
    assert src.name and src.name != "unknown"
    assert src.url and src.url.startswith("http")


@pytest.mark.parametrize("source_cls", ALL_SOURCES)
def test_source_has_discover_method(source_cls):
    src = source_cls()
    assert callable(src.discover)
