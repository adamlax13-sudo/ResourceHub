"""
Smart refresh module for detecting page changes.

Uses HTTP ETags, Last-Modified headers, and content hashing to detect
when pages have changed and need re-scraping.
"""
import hashlib
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Union

import requests

logger = logging.getLogger(__name__)


@dataclass
class RefreshResult:
    """Result of checking if a page has changed."""
    changed: bool
    etag: Optional[str]
    content_hash: Optional[str]
    content: Optional[str]
    error: Optional[str] = None

    @property
    def has_error(self) -> bool:
        """Check if an error occurred during the check."""
        return self.error is not None

    def as_tuple(self) -> Tuple[bool, Optional[str], Optional[str], Optional[str]]:
        """Return as legacy tuple format for backward compatibility."""
        return (self.changed, self.etag, self.content_hash, self.content)

# Default headers for requests
DEFAULT_HEADERS = {
    "User-Agent": "ResourceHubBot/2.0 (Alberta Social Services Aggregator; +https://github.com/albertahub)",
}


def calculate_content_hash(content: str) -> str:
    """
    Calculate SHA-256 hash of content for change detection.

    Args:
        content: Text content to hash

    Returns:
        Hex string of SHA-256 hash
    """
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


def check_page_changed(
    url: str,
    stored_etag: Optional[str] = None,
    stored_hash: Optional[str] = None,
    timeout: int = 10,
    return_result: bool = False,
) -> Union[RefreshResult, Tuple[bool, Optional[str], Optional[str], Optional[str]]]:
    """
    Check if a page has changed since last fetch.

    Uses HTTP HEAD request with If-None-Match for efficient checking.
    Falls back to content hash comparison if ETag not available.

    Args:
        url: URL to check
        stored_etag: Previously stored ETag header
        stored_hash: Previously stored content hash
        timeout: Request timeout in seconds
        return_result: If True, return RefreshResult dataclass; else return tuple

    Returns:
        RefreshResult or Tuple of (changed: bool, new_etag: str, new_hash: str, content: str)
        content is None if page hasn't changed (304 response)
    """
    def make_result(changed, etag, hash_, content, error=None):
        result = RefreshResult(changed=changed, etag=etag, content_hash=hash_, content=content, error=error)
        return result if return_result else result.as_tuple()

    try:
        headers = DEFAULT_HEADERS.copy()

        # Try HEAD request with If-None-Match first
        if stored_etag:
            headers["If-None-Match"] = stored_etag
            response = requests.head(url, headers=headers, timeout=timeout, allow_redirects=True)

            if response.status_code == 304:
                # Not modified
                logger.debug(f"[SmartRefresh] {url}: Not modified (304)")
                return make_result(False, stored_etag, stored_hash, None)

            new_etag = response.headers.get("ETag")
            if new_etag and new_etag != stored_etag:
                # ETag changed, need to fetch content
                logger.info(f"[SmartRefresh] {url}: ETag changed")
                response = requests.get(url, headers=DEFAULT_HEADERS, timeout=timeout)
                content = response.text
                new_hash = calculate_content_hash(content)
                return make_result(True, new_etag, new_hash, content)

        # No ETag or need content hash comparison
        response = requests.get(url, headers=DEFAULT_HEADERS, timeout=timeout)
        content = response.text
        new_etag = response.headers.get("ETag")
        new_hash = calculate_content_hash(content)

        if stored_hash and new_hash == stored_hash:
            logger.debug(f"[SmartRefresh] {url}: Content unchanged (hash match)")
            return make_result(False, new_etag, new_hash, None)

        logger.info(f"[SmartRefresh] {url}: Content changed")
        return make_result(True, new_etag, new_hash, content)

    except requests.RequestException as e:
        error_msg = str(e)
        logger.error(f"[SmartRefresh] Error checking {url}: {error_msg}")
        # Return error result - caller can decide whether to re-scrape
        return make_result(False, stored_etag, stored_hash, None, error=error_msg)


def get_pages_needing_refresh(
    session,
    max_age_days: int = 7,
    limit: int = 100,
) -> List[Dict]:
    """
    Get list of service pages that need refreshing.

    Prioritizes:
    1. Pages never checked
    2. Pages older than max_age_days
    3. Low confidence services

    Args:
        session: Database session
        max_age_days: Refresh pages older than this
        limit: Maximum number of pages to return

    Returns:
        List of dicts with service_id, website_url, etag, content_hash
    """
    from sqlalchemy import text

    cutoff_date = datetime.now() - timedelta(days=max_age_days)

    query = text("""
        SELECT
            service_id,
            website_url,
            etag,
            content_hash,
            confidence_score,
            last_checked
        FROM services
        WHERE is_active = TRUE
          AND website_url IS NOT NULL
          AND website_url != ''
        ORDER BY
            CASE WHEN last_checked IS NULL THEN 0 ELSE 1 END,
            CASE WHEN confidence_score < 60 THEN 0 ELSE 1 END,
            last_checked ASC
        LIMIT :limit
    """)

    result = session.execute(query, {"limit": limit})

    pages = []
    for row in result:
        # Only include if never checked or older than cutoff
        if row.last_checked is None or row.last_checked < cutoff_date:
            pages.append({
                "service_id": row.service_id,
                "website_url": row.website_url,
                "etag": row.etag,
                "content_hash": row.content_hash,
            })

    return pages


def update_page_cache(
    session,
    service_id: str,
    etag: Optional[str],
    content_hash: Optional[str],
):
    """
    Update cached page metadata for a service.

    Args:
        session: Database session
        service_id: Service identifier
        etag: New ETag value
        content_hash: New content hash
    """
    from sqlalchemy import text

    query = text("""
        UPDATE services
        SET
            etag = :etag,
            content_hash = :content_hash,
            last_checked = NOW()
        WHERE service_id = :service_id
    """)

    session.execute(query, {
        "service_id": service_id,
        "etag": etag,
        "content_hash": content_hash,
    })
    session.commit()
