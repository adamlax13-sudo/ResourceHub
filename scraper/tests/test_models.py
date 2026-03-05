import pytest
from models import Service, ServiceIntakeDetails


def test_service_has_enrichment_fields():
    """New fields for change detection and enrichment tracking."""
    assert hasattr(Service, "enrichment_source")
    assert hasattr(Service, "enrichment_date")
    assert hasattr(Service, "source_page_hash")


def test_intake_details_has_inference_fields():
    """New fields to track inferred vs found data."""
    assert hasattr(ServiceIntakeDetails, "is_inferred")
    assert hasattr(ServiceIntakeDetails, "source_urls")
