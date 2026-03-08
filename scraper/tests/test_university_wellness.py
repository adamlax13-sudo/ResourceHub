"""Tests for the university wellness source plugin."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sources.university_wellness import UniversityWellnessSource
from sources.university_registry import INSTITUTIONS


# Known valid categories in ResourceHub
VALID_CATEGORIES = {
    "Campus & Student Services",
    "Mental Health & Counselling",
    "Disability & Autism Support",
    "Food Banks & Meals",
    "LGBTQ2S+ Services",
    "Crisis Lines",
    "Crisis Services",
    "Healthcare Access",
    "Recovery & Peer Support",
    "Harm Reduction",
    "Indigenous Services",
    "Employment Services",
}

# All 26 publicly funded Alberta post-secondary institutions
EXPECTED_INSTITUTIONS = {
    "ualberta", "ucalgary", "ulethbridge", "athabasca",
    "mountroyal", "macewan",
    "nait", "sait",
    "rdpolytech", "bowvalley", "norquest", "lethbridgecollege",
    "medicinehat", "lakeland", "olds", "northwestern",
    "keyano", "portage", "northernlakes",
    "auarts", "banffcentre",
    "concordia", "kings", "ambrose", "stmarys", "burman",
}


def test_discover_returns_services():
    source = UniversityWellnessSource()
    results = source.discover(session=None, log=None, dry_run=True)
    assert len(results) > 0, "Should produce at least one service"
    for r in results:
        assert r.name, "Every service must have a name"
        assert r.category, "Every service must have a category"
        assert r.website_url, "Every service must have a website_url"


def test_all_institutions_covered():
    keys = {inst["key"] for inst in INSTITUTIONS}
    missing = EXPECTED_INSTITUTIONS - keys
    assert not missing, f"Missing institutions in registry: {missing}"


def test_naming_convention():
    """All service names must follow 'Institution — Descriptor' pattern."""
    source = UniversityWellnessSource()
    results = source.discover(session=None, log=None, dry_run=True)
    for r in results:
        assert "\u2014" in r.name, (
            f"Name missing em-dash: '{r.name}'. "
            f"Expected format: 'Institution \u2014 Service'"
        )


def test_categories_valid():
    source = UniversityWellnessSource()
    results = source.discover(session=None, log=None, dry_run=True)
    for r in results:
        assert r.category in VALID_CATEGORIES, (
            f"Invalid category '{r.category}' for '{r.name}'. "
            f"Valid: {sorted(VALID_CATEGORIES)}"
        )


def test_website_urls_populated():
    source = UniversityWellnessSource()
    results = source.discover(session=None, log=None, dry_run=True)
    for r in results:
        assert r.website_url, f"Missing website_url for '{r.name}'"
        assert r.website_url.startswith("http"), (
            f"Invalid URL for '{r.name}': {r.website_url}"
        )


def test_no_duplicate_names():
    source = UniversityWellnessSource()
    results = source.discover(session=None, log=None, dry_run=True)
    names = [r.name for r in results]
    duplicates = [n for n in names if names.count(n) > 1]
    assert not duplicates, f"Duplicate service names: {set(duplicates)}"


def test_eligibility_populated():
    source = UniversityWellnessSource()
    results = source.discover(session=None, log=None, dry_run=True)
    for r in results:
        assert r.eligibility, f"Missing eligibility for '{r.name}'"


def test_tags_include_campus():
    """All services should have student-services and campus tags."""
    source = UniversityWellnessSource()
    results = source.discover(session=None, log=None, dry_run=True)
    for r in results:
        assert "student-services" in r.tags, (
            f"Missing 'student-services' tag for '{r.name}'"
        )
        assert "campus" in r.tags, (
            f"Missing 'campus' tag for '{r.name}'"
        )


def test_source_url_populated():
    source = UniversityWellnessSource()
    results = source.discover(session=None, log=None, dry_run=True)
    for r in results:
        assert r.source_url, f"Missing source_url for '{r.name}'"


def test_service_count_reasonable():
    """Should produce 60-120 services across 26 institutions."""
    source = UniversityWellnessSource()
    results = source.discover(session=None, log=None, dry_run=True)
    assert len(results) >= 40, (
        f"Too few services: {len(results)}. Expected at least 40."
    )
    assert len(results) <= 150, (
        f"Too many services: {len(results)}. Expected at most 150."
    )
