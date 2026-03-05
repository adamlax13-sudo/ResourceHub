import pytest
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from finalize import (
    phase_normalize_contacts,
    phase_enhance_tags,
    phase_generate_embeddings,
    phase_dedupe_services,
    phase_refresh_views,
)


def test_finalize_functions_importable():
    """All finalize functions are importable from the finalize module."""
    assert callable(phase_normalize_contacts)
    assert callable(phase_enhance_tags)
    assert callable(phase_generate_embeddings)
    assert callable(phase_dedupe_services)
    assert callable(phase_refresh_views)
