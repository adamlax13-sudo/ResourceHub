"""Tests for CRA Charities Alberta source plugin."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from unittest.mock import MagicMock, patch

from sources.cra_charities import CRACharitiesSource
from sources.plugin import RawService


def test_source_name():
    src = CRACharitiesSource()
    assert src.name == "cra_charities"


def test_source_url():
    src = CRACharitiesSource()
    assert "open.canada.ca" in src.url


# --- Relevance filtering ---

def test_relevance_filter_accepts_social_services():
    src = CRACharitiesSource()
    charity = {"designation": "Charitable Organization", "programs": "addiction counselling, housing support"}
    assert src._is_relevant(charity) is True


def test_relevance_filter_accepts_welfare_designation():
    src = CRACharitiesSource()
    charity = {"designation": "Charitable Organization", "category": "Welfare", "programs": ""}
    assert src._is_relevant(charity) is True


def test_relevance_filter_accepts_health_with_keywords():
    src = CRACharitiesSource()
    charity = {"designation": "Charitable Organization", "category": "Health", "programs": "mental health counselling for youth"}
    assert src._is_relevant(charity) is True


def test_relevance_filter_rejects_sports_club():
    src = CRACharitiesSource()
    charity = {"designation": "Charitable Organization", "category": "Recreation", "programs": "golf tournaments, club memberships"}
    assert src._is_relevant(charity) is False


def test_relevance_filter_rejects_foundation_only():
    src = CRACharitiesSource()
    charity = {"designation": "Private Foundation", "programs": "granting funds to other organizations"}
    assert src._is_relevant(charity) is False


def test_relevance_filter_rejects_public_foundation_no_direct_services():
    src = CRACharitiesSource()
    charity = {"designation": "Public Foundation", "programs": "funding research grants"}
    assert src._is_relevant(charity) is False


def test_relevance_filter_rejects_animal_welfare():
    src = CRACharitiesSource()
    charity = {"designation": "Charitable Organization", "category": "Animal Welfare", "programs": "humane society pet shelter"}
    assert src._is_relevant(charity) is False


def test_relevance_filter_rejects_arts():
    src = CRACharitiesSource()
    charity = {"designation": "Charitable Organization", "category": "Arts", "programs": "symphony orchestra concerts"}
    assert src._is_relevant(charity) is False


def test_relevance_filter_accepts_religion_with_social_keywords():
    src = CRACharitiesSource()
    charity = {"designation": "Charitable Organization", "category": "Religion", "programs": "food bank, meals, community support"}
    assert src._is_relevant(charity) is True


def test_relevance_filter_rejects_religion_without_social_keywords():
    src = CRACharitiesSource()
    charity = {"designation": "Charitable Organization", "category": "Religion", "programs": "worship services, congregation activities"}
    assert src._is_relevant(charity) is False


def test_relevance_filter_accepts_indigenous_services():
    src = CRACharitiesSource()
    charity = {"designation": "Charitable Organization", "category": "Community", "programs": "Indigenous housing support and crisis counselling"}
    assert src._is_relevant(charity) is True


def test_relevance_filter_accepts_newcomer_services():
    src = CRACharitiesSource()
    charity = {"designation": "Charitable Organization", "programs": "immigrant settlement services, refugee support"}
    assert src._is_relevant(charity) is True


def test_relevance_handles_missing_programs():
    src = CRACharitiesSource()
    charity = {"designation": "Charitable Organization", "category": "Welfare"}
    assert src._is_relevant(charity) is True


def test_relevance_handles_empty_programs():
    src = CRACharitiesSource()
    charity = {"designation": "Charitable Organization", "category": "Recreation", "programs": ""}
    assert src._is_relevant(charity) is False


# --- Category mapping ---

def test_category_mapping_addiction():
    src = CRACharitiesSource()
    assert src._map_to_category({"programs": "addiction recovery detox"}) == "addiction"


def test_category_mapping_mental_health():
    src = CRACharitiesSource()
    assert src._map_to_category({"programs": "mental health counselling"}) == "mental_health"


def test_category_mapping_housing():
    src = CRACharitiesSource()
    assert src._map_to_category({"programs": "emergency shelter housing"}) == "housing"


def test_category_mapping_basic_needs():
    src = CRACharitiesSource()
    assert src._map_to_category({"programs": "food bank meals"}) == "basic_needs"


def test_category_mapping_disability():
    src = CRACharitiesSource()
    assert src._map_to_category({"programs": "disability support services"}) == "disability"


def test_category_mapping_crisis():
    src = CRACharitiesSource()
    assert src._map_to_category({"programs": "crisis intervention domestic violence"}) == "crisis"


def test_category_mapping_youth():
    src = CRACharitiesSource()
    assert src._map_to_category({"programs": "youth at risk programs"}) == "youth"


def test_category_mapping_seniors():
    src = CRACharitiesSource()
    assert src._map_to_category({"programs": "senior care elder services"}) == "seniors"


def test_category_mapping_newcomer():
    src = CRACharitiesSource()
    assert src._map_to_category({"programs": "immigrant settlement refugee support"}) == "newcomer"


def test_category_mapping_default():
    src = CRACharitiesSource()
    assert src._map_to_category({"programs": "general community help"}) == "community_support"


def test_category_mapping_handles_missing_programs():
    src = CRACharitiesSource()
    assert src._map_to_category({}) == "community_support"


# --- RawService conversion ---

def test_to_raw_service():
    src = CRACharitiesSource()
    charity = {
        "bn": "123456789RR0001",
        "legal_name": "Alberta Recovery Centre",
        "address": "123 Main St",
        "city": "Calgary",
        "province": "AB",
        "postal_code": "T2P 1A1",
        "category": "Welfare",
        "designation": "Charitable Organization",
        "programs": "addiction recovery, detox programs, counselling",
        "website_url": "https://example.com",
    }
    svc = src._to_raw_service(charity)
    assert isinstance(svc, RawService)
    assert svc.name == "Alberta Recovery Centre"
    assert svc.category == "addiction"
    assert "Calgary" in svc.location
    assert svc.address == "123 Main St"
    assert svc.website_url == "https://example.com"
    assert "cra-arc.gc.ca" in svc.source_url
    assert svc.description is not None
    assert "123456789RR0001" in svc.extra.get("bn", "")
