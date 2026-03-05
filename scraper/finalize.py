"""
Finalize phase functions for the new pipeline.
Re-exports existing functions from scraper.py to avoid duplication.
These will be moved here permanently during Task 12 (cleanup).
"""

from scraper import (
    phase_normalize_contacts,
    phase_enhance_tags,
    phase_generate_embeddings,
    phase_dedupe_services,
    phase_refresh_views,
)

__all__ = [
    "phase_normalize_contacts",
    "phase_enhance_tags",
    "phase_generate_embeddings",
    "phase_dedupe_services",
    "phase_refresh_views",
]
