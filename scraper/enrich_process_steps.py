#!/usr/bin/env python3
"""Three-tier service data enrichment.

Systematically enriches services missing key fields (process_steps,
required_docs, eligibility, contact info, hours) using a waterfall strategy:
  Tier 1: Deep crawl the service's website, extract all fields with Claude
  Tier 2: Web search (Claude API) for service info, extract with Claude
  Tier 3: AI inference for process steps from similar services

Usage:
  python enrich_process_steps.py --dry-run --limit 5
  python enrich_process_steps.py --tier 2 --limit 10
  python enrich_process_steps.py --tier 1 2 3 --limit 50
"""

import argparse
import json
import logging
import random
import re
import time
from datetime import datetime
from typing import Dict, List, Optional
from urllib.parse import parse_qs, unquote, urlparse

from dotenv import load_dotenv

load_dotenv()

from bs4 import BeautifulSoup
import requests
from sqlalchemy import text

from scraper import SessionLocal, Service, should_enrich_field
from scoring.confidence import calculate_confidence_score
from claude_client import init_claude


from utils import safe_json_loads as _safe_json_loads, is_safe_url as _is_safe_url

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

WEB_REQUEST_DELAY = 2.0
CLAUDE_REQUEST_DELAY = 0.5


# ---------------------------------------------------------------------------
# DuckDuckGo HTML search
# ---------------------------------------------------------------------------

class DuckDuckGoSearcher:
    """Search DuckDuckGo with Lite endpoint (primary) and HTML fallback.

    The Lite endpoint (lite.duckduckgo.com) is a text-only interface that
    triggers far fewer CAPTCHAs than the HTML endpoint. Falls back to the
    HTML endpoint if Lite returns no results.
    """

    DDG_LITE_URL = "https://lite.duckduckgo.com/lite/"
    DDG_HTML_URL = "https://html.duckduckgo.com/html/"

    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ]

    def __init__(self, request_delay: float = 3.0):
        self.request_delay = request_delay
        self.session = requests.Session()
        self._last_request_time = 0.0
        self._captcha_count = 0

    def search(self, query: str, max_results: int = 5) -> List[Dict[str, str]]:
        """Search DuckDuckGo and return [{title, url, snippet}, ...].

        Tries Lite endpoint first, falls back to HTML endpoint.
        Returns empty list if CAPTCHA encountered or request fails.
        """
        # Try Lite endpoint first (much less CAPTCHA-prone)
        results = self._search_lite(query, max_results)
        if results:
            return results

        # Fallback to HTML endpoint
        return self._search_html(query, max_results)

    def _search_lite(self, query: str, max_results: int) -> List[Dict[str, str]]:
        """Search using the Lite (text-only) endpoint."""
        self._wait_for_rate_limit()
        headers = {
            "User-Agent": random.choice(self.USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.5",
        }
        try:
            response = self.session.get(
                self.DDG_LITE_URL,
                params={"q": query},
                headers=headers,
                timeout=15,
            )
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            if self._is_captcha(soup):
                self._captcha_count += 1
                logger.warning(f"DDG Lite CAPTCHA (count: {self._captcha_count})")
                return []

            return self._parse_lite_results(soup, max_results)

        except requests.RequestException as e:
            logger.warning(f"DDG Lite search failed: {e}")
            return []

    def _search_html(self, query: str, max_results: int) -> List[Dict[str, str]]:
        """Search using the HTML endpoint (fallback)."""
        self._wait_for_rate_limit()
        headers = {
            "User-Agent": random.choice(self.USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Referer": "https://html.duckduckgo.com/",
            "Content-Type": "application/x-www-form-urlencoded",
        }
        try:
            response = self.session.post(
                self.DDG_HTML_URL,
                data={"q": query, "b": ""},
                headers=headers,
                timeout=15,
            )
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            if self._is_captcha(soup):
                self._captcha_count += 1
                logger.warning(f"DDG HTML CAPTCHA (count: {self._captcha_count})")
                return []

            return self._parse_html_results(soup, max_results)

        except requests.RequestException as e:
            logger.warning(f"DDG HTML search failed: {e}")
            return []

    def _is_captcha(self, soup: BeautifulSoup) -> bool:
        text = soup.get_text().lower()
        return (
            "select all squares" in text
            or "unfortunately, bots" in text
            or "please try again" in text
        )

    def _parse_lite_results(
        self, soup: BeautifulSoup, max_results: int
    ) -> List[Dict[str, str]]:
        """Parse results from the Lite endpoint.

        Lite format: <a> tags with DDG redirect URLs (//duckduckgo.com/l/?uddg=...)
        followed by snippet text in adjacent <td> elements.
        """
        results = []
        for link in soup.find_all("a"):
            href = link.get("href", "")
            if "uddg=" not in href and not href.startswith("http"):
                continue
            if "duckduckgo.com" in href and "uddg=" not in href:
                continue

            url = self._clean_url(href)
            if not url:
                continue

            title = link.get_text(strip=True)
            if not title:
                continue

            # Get snippet from next sibling or parent's next row
            snippet = ""
            snippet_td = link.find_parent("td")
            if snippet_td:
                next_row = snippet_td.find_parent("tr")
                if next_row:
                    next_sibling = next_row.find_next_sibling("tr")
                    if next_sibling:
                        snippet_cell = next_sibling.find("td", class_="result-snippet")
                        if snippet_cell:
                            snippet = snippet_cell.get_text(strip=True)

            results.append({"title": title, "url": url, "snippet": snippet})
            if len(results) >= max_results:
                break

        return results

    def _parse_html_results(
        self, soup: BeautifulSoup, max_results: int
    ) -> List[Dict[str, str]]:
        """Parse results from the HTML endpoint."""
        results = []
        for element in soup.select("#links .result")[:max_results]:
            try:
                title_elem = element.select_one(".result__a")
                if not title_elem:
                    continue
                title = title_elem.get_text(strip=True)
                url = self._clean_url(title_elem.get("href", ""))
                if not url:
                    continue

                snippet_elem = element.select_one(".result__snippet")
                snippet = snippet_elem.get_text(strip=True) if snippet_elem else ""

                results.append({"title": title, "url": url, "snippet": snippet})
            except Exception:
                continue
        return results

    def _clean_url(self, raw_url: str) -> Optional[str]:
        if not raw_url:
            return None
        if "uddg=" in raw_url:
            parsed = urlparse(raw_url)
            params = parse_qs(parsed.query)
            if "uddg" in params:
                return unquote(params["uddg"][0])
        if raw_url.startswith("//"):
            return "https:" + raw_url
        if raw_url.startswith("http"):
            return raw_url
        return None

    def _wait_for_rate_limit(self):
        now = time.time()
        elapsed = now - self._last_request_time
        if elapsed < self.request_delay:
            time.sleep(self.request_delay - elapsed)
        self._last_request_time = time.time()

    @property
    def captcha_blocked(self) -> bool:
        """True after 5+ CAPTCHAs — stop using Tier 2."""
        return self._captcha_count >= 5


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def fetch_page_content(url: str, timeout: int = 15) -> Optional[str]:
    """Fetch a URL and return cleaned text content (up to 5000 chars)."""
    if not _is_safe_url(url):
        logger.warning(f"Refusing to fetch unsafe URL: {url!r}")
        return None
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")

        # Remove non-content elements
        for tag in soup.find_all(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()

        text = soup.get_text(separator="\n", strip=True)
        # Collapse blank lines
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text[:5000] if text else None

    except Exception as e:
        logger.debug(f"Failed to fetch {url}: {e}")
        return None


def get_candidate_services(
    session, limit: int = 100, include_generic: bool = True
) -> List[Dict]:
    """Get active services needing data enrichment.

    Targets services missing any key field (in priority order):
      1. Missing process_steps entirely
      2. AI-inferred steps (process_steps_inferred = TRUE)
      3. Missing required_docs, eligibility, or contact info
      4. Steps with no source citation
    """
    if include_generic:
        query = text("""
            SELECT service_id, name, category, description, eligibility,
                   location, website_url, confidence_score,
                   required_docs, phone, email, hours_of_operation
            FROM services
            WHERE is_active = TRUE
              AND (
                -- Group 1: missing process_steps
                process_steps IS NULL
                OR process_steps::text = '[]'
                OR process_steps::text = 'null'
                -- Group 2: AI-inferred steps (prefer real data)
                OR process_steps_inferred = TRUE
                -- Group 3: missing key fields
                OR required_docs IS NULL
                OR required_docs::text IN ('[]', 'null')
                OR eligibility IS NULL
                OR length(eligibility) < 10
                -- Group 4: no source citation for process_steps
                OR field_sources IS NULL
                OR field_sources::text NOT LIKE '%process_steps%'
              )
            ORDER BY
              CASE
                WHEN process_steps IS NULL OR process_steps::text IN ('[]', 'null')
                  THEN 0
                WHEN process_steps_inferred = TRUE THEN 1
                WHEN required_docs IS NULL OR required_docs::text IN ('[]', 'null')
                  OR eligibility IS NULL OR length(eligibility) < 10
                  THEN 2
                ELSE 3
              END,
              confidence_score ASC NULLS FIRST
            LIMIT :limit
        """)
    else:
        query = text("""
            SELECT service_id, name, category, description, eligibility,
                   location, website_url, confidence_score,
                   required_docs, phone, email, hours_of_operation
            FROM services
            WHERE is_active = TRUE
              AND (
                process_steps IS NULL
                OR process_steps::text = '[]'
                OR process_steps::text = 'null'
              )
            ORDER BY confidence_score ASC NULLS FIRST
            LIMIT :limit
        """)

    result = session.execute(query, {"limit": limit}).fetchall()

    return [
        {
            "service_id": r[0],
            "name": r[1],
            "category": r[2],
            "description": r[3],
            "eligibility": r[4],
            "location": r[5],
            "website_url": r[6],
            "confidence_score": r[7],
            "required_docs": r[8],
            "phone": r[9],
            "email": r[10],
            "hours_of_operation": r[11],
        }
        for r in result
    ]


def get_similar_services(
    session, category: str, exclude_id: str, limit: int = 3
) -> List[Dict]:
    """Fetch similar services with good process steps as inference examples."""
    result = session.execute(
        text("""
        SELECT name, category, description, process_steps
        FROM services
        WHERE category = :category
          AND service_id != :exclude_id
          AND is_active = TRUE
          AND process_steps IS NOT NULL
          AND process_steps::text != '[]'
          AND process_steps::text != 'null'
          AND (process_steps_inferred IS NULL OR process_steps_inferred = FALSE)
          AND json_array_length(process_steps) >= 4
        ORDER BY RANDOM()
        LIMIT :limit
    """),
        {"category": category, "exclude_id": exclude_id, "limit": limit},
    ).fetchall()

    return [
        {
            "name": r[0],
            "category": r[1],
            "description": r[2],
            "process_steps": _safe_json_loads(r[3]),
        }
        for r in result
    ]


# ---------------------------------------------------------------------------
# Tier implementations
# ---------------------------------------------------------------------------


def tier1_website_crawl(service: Dict, crawler, claude_client, backend=None) -> Optional[Dict]:
    """Tier 1: Deep crawl the service website and extract all fields with Claude."""
    if not service.get("website_url"):
        return None

    if not _is_safe_url(service["website_url"]):
        logger.warning(f"Refusing to crawl unsafe URL: {service['website_url']!r}")
        return None

    if backend:
        from backends.interface import CrawlConfig
        crawl_result = backend.crawl_site(service["website_url"], CrawlConfig(
            js_rendering=True, max_depth=2, max_pages=10,
            request_delay_seconds=2.0,
        ))
        combined_content = crawl_result.get_all_markdown(max_pages=5, max_chars=15000)
        source_urls = [p.url for p in crawl_result.get_valuable_pages()[:5]]
        if not source_urls:
            source_urls = list(crawl_result.pages.keys())[:3]
    else:
        # Legacy DeepCrawler path
        crawl_result = crawler.crawl_website(service["website_url"])
        if crawl_result.total_pages_crawled == 0:
            return None
        best_pages = crawl_result.get_all_valuable_pages()
        if not best_pages:
            best_pages = list(crawl_result.pages.values())[:5]
        combined_content = ""
        source_urls = []
        for page in best_pages[:5]:
            if page.text_content:
                combined_content += f"\n\n=== FROM {page.url} ===\n{page.text_content[:3000]}"
                source_urls.append(page.url)

    if not combined_content:
        return None

    extraction = claude_client.extract_full_service(
        page_content=combined_content,
        service_name=service["name"],
        category=service.get("category", ""),
        source_url=source_urls[0] if source_urls else None,
    )

    if not extraction:
        return None

    return _build_enrichment_from_extraction(extraction, source_urls)


def _build_enrichment_from_extraction(extraction: Dict, source_urls: List[str]) -> Optional[Dict]:
    """Build a unified enrichment result dict from a Claude extraction."""
    if not extraction:
        return None

    has_useful_data = (
        extraction.get("process_steps")
        or extraction.get("required_docs")
        or extraction.get("eligibility")
        or extraction.get("phone")
        or extraction.get("email")
        or extraction.get("hours_of_operation")
    )
    if not has_useful_data:
        return None

    return {
        "process_steps": extraction.get("process_steps"),
        "required_docs": extraction.get("required_docs"),
        "eligibility": extraction.get("eligibility"),
        "phone": extraction.get("phone"),
        "email": extraction.get("email"),
        "hours_of_operation": extraction.get("hours_of_operation"),
        "address": extraction.get("address"),
        "description": extraction.get("description"),
        "source_urls": source_urls,
        "process_source": extraction.get("process_source"),
        "eligibility_source": extraction.get("eligibility_source"),
        "docs_source": extraction.get("docs_source"),
        "hours_source": extraction.get("hours_source"),
    }


def tier2_web_search(service: Dict, searcher, claude_client, backend=None) -> Optional[Dict]:
    """Tier 2: Use Claude's built-in web search to find service data.

    Claude searches the web server-side (no CAPTCHA issues), reads the pages,
    and extracts all available service fields — all in one API call.
    Falls back to DuckDuckGo scraping if Claude web search is unavailable.
    """
    # Try Claude's built-in web search first (reliable, no CAPTCHAs)
    result = claude_client.web_search_extract_steps(
        service_name=service["name"],
        category=service.get("category", ""),
        description=service.get("description", ""),
        location=service.get("location", "Alberta"),
    )

    if result:
        has_useful = (
            result.get("process_steps") or result.get("required_docs")
            or result.get("eligibility") or result.get("phone")
            or result.get("email") or result.get("hours_of_operation")
        )
        if has_useful:
            return {
                "process_steps": result.get("process_steps"),
                "required_docs": result.get("required_docs"),
                "eligibility": result.get("eligibility"),
                "phone": result.get("phone"),
                "email": result.get("email"),
                "hours_of_operation": result.get("hours_of_operation"),
                "address": result.get("address"),
                "description": result.get("description"),
                "source_urls": result.get("source_urls", []),
                "process_source": result.get("process_source"),
                "eligibility_source": result.get("eligibility_source"),
                "docs_source": result.get("docs_source"),
                "hours_source": result.get("hours_source"),
            }

    # Fallback: DuckDuckGo scraping (may hit CAPTCHAs)
    if searcher and not searcher.captcha_blocked:
        name = service["name"]
        query = f'"{name}" eligibility requirements how to apply Alberta'
        search_results = searcher.search(query, max_results=5)

        if not search_results:
            query = f"{name} services eligibility application process Alberta"
            search_results = searcher.search(query, max_results=5)

        if search_results:
            combined_content = ""
            source_urls = []

            if backend:
                from backends.interface import CrawlConfig
                safe_urls = [sr["url"] for sr in search_results[:3] if _is_safe_url(sr["url"])]
                pages = backend.fetch_pages(safe_urls, CrawlConfig(js_rendering=False, timeout_seconds=15))
                for page in pages:
                    if page.markdown and len(page.markdown) > 200:
                        combined_content += f"\n\n=== FROM {page.url} ===\n{page.markdown[:4000]}"
                        source_urls.append(page.url)
            else:
                for sr in search_results[:3]:
                    url = sr["url"]
                    if not _is_safe_url(url):
                        logger.debug(f"Skipping unsafe search result URL: {url!r}")
                        continue
                    content = fetch_page_content(url)
                    if content and len(content) > 200:
                        combined_content += f"\n\n=== FROM {url} ===\n{content[:4000]}"
                        source_urls.append(url)
                        time.sleep(WEB_REQUEST_DELAY)

            if combined_content:
                extraction = claude_client.extract_full_service(
                    page_content=combined_content,
                    service_name=service["name"],
                    category=service.get("category", ""),
                    source_url=source_urls[0] if source_urls else None,
                )
                result = _build_enrichment_from_extraction(extraction, source_urls)
                if result:
                    return result

    return None


def tier3_inference(service: Dict, session, claude_client) -> Optional[Dict]:
    """Tier 3: Infer process steps from similar services using Claude."""
    similar = get_similar_services(
        session, service.get("category", ""), service["service_id"]
    )

    new_steps = claude_client.infer_process_steps(
        service_name=service["name"],
        category=service.get("category", ""),
        description=service.get("description", ""),
        eligibility=service.get("eligibility", ""),
        location=service.get("location", "Alberta"),
        similar_examples=similar,
    )

    if new_steps and len(new_steps) >= 3:
        return {"process_steps": new_steps, "inferred": True}
    return None


# ---------------------------------------------------------------------------
# Database update
# ---------------------------------------------------------------------------


def apply_enrichment(
    session, service_id: str, enrichment: Dict, tier: int, dry_run: bool
) -> bool:
    """Write enrichment results to the database.

    Writes all extracted fields (process_steps, required_docs, eligibility,
    phone, email, hours, address) — only filling empty fields to avoid
    overwriting existing data.
    """
    tier_label = {1: "website_crawl", 2: "web_search", 3: "ai_inference"}[tier]

    if dry_run:
        steps = enrichment.get("process_steps", [])
        docs = enrichment.get("required_docs", [])
        extra = []
        for f in ("eligibility", "phone", "email", "hours_of_operation"):
            if enrichment.get(f):
                extra.append(f)
        extra_str = f", +{','.join(extra)}" if extra else ""
        logger.info(
            f"  [DRY RUN] Would update via Tier {tier} ({tier_label}): "
            f"{len(steps) if steps else 0} steps, "
            f"{len(docs) if docs else 0} docs{extra_str}"
        )
        return True

    service = session.query(Service).filter_by(service_id=service_id).first()
    if not service:
        return False

    updated_fields = []

    # Process steps: overwrite if missing, inferred, or unsourced
    if enrichment.get("process_steps"):
        service.process_steps = enrichment["process_steps"]
        updated_fields.append("process_steps")

    # Required docs: fill if empty or if replacing inferred data
    if enrichment.get("required_docs"):
        if should_enrich_field(service, "required_docs") or service.process_steps_inferred:
            service.required_docs = enrichment["required_docs"]
            updated_fields.append("required_docs")

    # Other fields: only fill if currently empty (never overwrite)
    enrichable_fields = ("eligibility", "phone", "email", "hours_of_operation", "address", "description")
    for field in enrichable_fields:
        if enrichment.get(field) and should_enrich_field(service, field):
            setattr(service, field, enrichment[field])
            updated_fields.append(field)

    if not updated_fields:
        return False

    # Mark inferred only for Tier 3
    service.process_steps_inferred = bool(enrichment.get("inferred"))

    # Update field_sources for confidence scoring
    field_sources = service.field_sources or {}

    if enrichment.get("source_urls"):
        primary_url = enrichment["source_urls"][0]
        now_iso = datetime.now().isoformat()

        # Track source for each updated field
        source_quote_map = {
            "process_steps": enrichment.get("process_source"),
            "required_docs": enrichment.get("docs_source"),
            "eligibility": enrichment.get("eligibility_source"),
            "hours_of_operation": enrichment.get("hours_source"),
        }
        for field in updated_fields:
            field_sources[field] = {
                "source": tier_label,
                "url": primary_url,
                "quote": source_quote_map.get(field),
                "extracted_at": now_iso,
            }

        service.source_urls = list(
            set((service.source_urls or []) + enrichment["source_urls"])
        )

    service.field_sources = field_sources
    service.last_updated = datetime.now()

    # Recalculate confidence — Tiers 1/2 have real sources, Tier 3 does not
    service.confidence_score = calculate_confidence_score(
        service_data={
            "description": service.description,
            "phone": service.phone,
            "email": service.email,
            "eligibility": service.eligibility,
            "process_steps": service.process_steps,
            "required_docs": service.required_docs,
            "hours_of_operation": service.hours_of_operation,
        },
        field_sources=field_sources if tier in (1, 2) else {},
        has_website_data=(tier == 1),
    )

    session.commit()
    return True


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------


def run_enrich_process_steps(
    session,
    claude_client,
    log=None,
    tiers: Optional[List[int]] = None,
    limit: int = 100,
    dry_run: bool = False,
    include_generic: bool = True,
    backend=None,
) -> Dict[str, int]:
    """Main orchestrator — runs three-tier waterfall for each candidate service."""
    enabled_tiers = set(tiers or [1, 2, 3])

    stats = {
        "total_candidates": 0,
        "tier1_enriched": 0,
        "tier2_enriched": 0,
        "tier3_inferred": 0,
        "failed": 0,
        "captcha_blocked": 0,
    }

    candidates = get_candidate_services(
        session, limit=limit, include_generic=include_generic
    )
    stats["total_candidates"] = len(candidates)
    logger.info(f"Found {len(candidates)} services missing process_steps")

    if not candidates:
        return stats

    # Lazy-init tier resources
    crawler = None
    if 1 in enabled_tiers:
        if backend:
            crawler = backend  # CrawlBackend provides crawl_site()
        else:
            try:
                from deep_crawler import DeepCrawler

                crawler = DeepCrawler(max_depth=2, max_pages=10, request_delay=2.0)
            except ImportError:
                logger.warning("DeepCrawler not available — skipping Tier 1")
                enabled_tiers.discard(1)

    searcher = None
    if 2 in enabled_tiers:
        searcher = DuckDuckGoSearcher(request_delay=WEB_REQUEST_DELAY)

    for i, svc in enumerate(candidates):
        logger.info(f"[{i + 1}/{len(candidates)}] {svc['name']}")
        enriched = False

        # --- Tier 1: Website Crawl ---
        if 1 in enabled_tiers and svc.get("website_url") and crawler:
            try:
                result = tier1_website_crawl(svc, crawler, claude_client, backend=backend)
                if result:
                    if apply_enrichment(
                        session, svc["service_id"], result, tier=1, dry_run=dry_run
                    ):
                        stats["tier1_enriched"] += 1
                        enriched = True
                        steps = result.get("process_steps", [])
                        extra = [f for f in ("required_docs", "eligibility", "phone", "email", "hours_of_operation") if result.get(f)]
                        extra_str = f" +{','.join(extra)}" if extra else ""
                        logger.info(
                            f"  Tier 1 OK: {len(steps) if steps else 0} steps from website{extra_str}"
                        )
            except Exception as e:
                logger.error(f"  Tier 1 error: {e}")
                session.rollback()

        # --- Tier 2: Web Search ---
        if not enriched and 2 in enabled_tiers:
            try:
                result = tier2_web_search(svc, searcher, claude_client, backend=backend)
                if result:
                    if apply_enrichment(
                        session, svc["service_id"], result, tier=2, dry_run=dry_run
                    ):
                        stats["tier2_enriched"] += 1
                        enriched = True
                        steps = result.get("process_steps", [])
                        extra = [f for f in ("required_docs", "eligibility", "phone", "email", "hours_of_operation") if result.get(f)]
                        extra_str = f" +{','.join(extra)}" if extra else ""
                        logger.info(
                            f"  Tier 2 OK: {len(steps) if steps else 0} steps from web search{extra_str}"
                        )
            except Exception as e:
                logger.error(f"  Tier 2 error: {e}")
                session.rollback()

            if searcher and searcher.captcha_blocked:
                logger.warning("DuckDuckGo CAPTCHA limit reached — disabling Tier 2")
                stats["captcha_blocked"] = searcher._captcha_count

        # --- Tier 3: AI Inference ---
        if not enriched and 3 in enabled_tiers:
            try:
                result = tier3_inference(svc, session, claude_client)
                if result:
                    if apply_enrichment(
                        session, svc["service_id"], result, tier=3, dry_run=dry_run
                    ):
                        stats["tier3_inferred"] += 1
                        enriched = True
                        steps = result.get("process_steps", [])
                        logger.info(
                            f"  Tier 3 OK: {len(steps) if steps else 0} steps inferred"
                        )
            except Exception as e:
                logger.error(f"  Tier 3 error: {e}")
                session.rollback()

        if not enriched:
            stats["failed"] += 1
            logger.warning(f"  FAILED: no enrichment succeeded")

    # Update pipeline log if running as a phase
    if log:
        log.services_updated += (
            stats["tier1_enriched"] + stats["tier2_enriched"] + stats["tier3_inferred"]
        )

    return stats


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Enrich services with process steps (3-tier strategy)"
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Preview without writing"
    )
    parser.add_argument(
        "--limit", type=int, default=100, help="Max services to process"
    )
    parser.add_argument(
        "--tier",
        nargs="+",
        type=int,
        choices=[1, 2, 3],
        default=[1, 2, 3],
        help="Which tiers to run (default: all)",
    )
    parser.add_argument(
        "--missing-only",
        action="store_true",
        help="Only target services with completely missing steps (skip inferred/unsourced)",
    )
    args = parser.parse_args()

    session = SessionLocal()
    claude_client = init_claude()

    if not claude_client:
        logger.error("Claude client not available — check ANTHROPIC_API_KEY")
        session.close()
        return

    stats = run_enrich_process_steps(
        session=session,
        claude_client=claude_client,
        tiers=args.tier,
        limit=args.limit,
        dry_run=args.dry_run,
        include_generic=not args.missing_only,
    )

    print("\n" + "=" * 60)
    print("PROCESS STEPS ENRICHMENT COMPLETE")
    print("=" * 60)
    print(f"Total candidates:       {stats['total_candidates']}")
    print(f"Tier 1 (website crawl): {stats['tier1_enriched']}")
    print(f"Tier 2 (web search):    {stats['tier2_enriched']}")
    print(f"Tier 3 (AI inference):  {stats['tier3_inferred']}")
    print(f"Failed:                 {stats['failed']}")
    if stats["captcha_blocked"]:
        print(f"CAPTCHA blocks:         {stats['captcha_blocked']}")
    print("=" * 60)

    session.close()


if __name__ == "__main__":
    main()
