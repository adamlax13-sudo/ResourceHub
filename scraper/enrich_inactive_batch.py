#!/usr/bin/env python3
"""Batch enrich inactive services using Crawl4AI + Claude extraction.

Crawls service websites, extracts structured data with Claude, and reports
findings. Does NOT write to DB unless --apply is passed.

Usage:
  python enrich_inactive_batch.py                # Crawl + extract, report only
  python enrich_inactive_batch.py --apply        # Actually update DB
"""
import json
import logging
import os
import re
import sys
import time
from datetime import datetime

from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backends.crawl4ai_backend import Crawl4AIBackend
from backends.interface import CrawlConfig
from claude_client import init_claude
from sqlalchemy import text
from scraper import SessionLocal

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# The 25 curated inactive services to enrich
TARGET_SERVICE_IDS = [
    "calgary-seniors-resource-society-calgary-ab",
    "the-altview-foundation-for-gender-variant-and-sexual-minorities-edmonton-ab",
    "the-immigrant-education-society-ties-calgary-ab",
    "lethbridge-youth-foundation-lethbridge-ab",
    "unison-society-calgary-ab",
    "independent-living-resource-centre-of-calgary-calgary-ab",
    "big-brothers-big-sisters-society-of-calgary-and-area-formerly-aunts-and-uncles-at-large-calgary-ab",
    "robin-hood-association-for-the-handicapped-sherwood-park-ab",
    "the-canlearn-society-for-persons-with-learning-difficulties-calgary-ab",
    "sage-seniors-association-edmonton-ab",
    "urban-society-for-aboriginal-youth-calgary-ab",
    "influence-mentoring-society-calgary-ab",
    "gordon-russell-s-crystal-kids-youth-centre-edmonton-ab",
    "burden-bearers-counselling-society-sundre-ab",
    "barrhead-association-for-community-living-barrhead-ab",
    "mental-health-copilots-ltd-stony-plain-ab",
    "freedom-s-path-recovery-society-calgary-ab",
    "the-tri-terminator-foundation-calgary-ab",
    "horn-of-africa-educational-and-economic-development-society-haeeds-edmonton-ab",
    "hope-for-tomorrow-s-shade-association-canada-ht-saca-edmonton-ab",
    "big-brothers-and-big-sisters-of-lethbridge-and-district-lethbridge-ab",
    "the-lethbridge-senior-citizens-organization-lethbridge-ab",
    "tourette-ocd-alberta-network-association-calgary-ab",
    "shepherd-s-care-foundation-edmonton-ab",
    "caps-central-alberta-pride-society-central-alberta",
]


def load_services(session):
    """Load service records from DB."""
    placeholders = ", ".join(f":id{i}" for i in range(len(TARGET_SERVICE_IDS)))
    params = {f"id{i}": sid for i, sid in enumerate(TARGET_SERVICE_IDS)}
    result = session.execute(
        text(f"""
            SELECT service_id, name, category, location, website_url,
                   confidence_score, phone, email, hours_of_operation,
                   eligibility, description, process_steps, address
            FROM services
            WHERE service_id IN ({placeholders})
        """),
        params,
    ).fetchall()
    services = []
    for r in result:
        services.append({
            "service_id": r[0], "name": r[1], "category": r[2],
            "location": r[3], "website_url": r[4], "confidence_score": r[5],
            "phone": r[6], "email": r[7], "hours_of_operation": r[8],
            "eligibility": r[9], "description": r[10],
            "process_steps": r[11], "address": r[12],
        })
    return services


def crawl_and_extract(backend, claude_client, service):
    """Crawl a service website and extract structured data."""
    url = service["website_url"]
    name = service["name"]
    category = service.get("category", "")

    log.info(f"  Crawling {url} ...")
    try:
        crawl_result = backend.crawl_site(url, CrawlConfig(
            js_rendering=True,
            max_depth=2,
            max_pages=8,
            timeout_seconds=25,
        ))
    except Exception as e:
        log.error(f"  Crawl failed: {e}")
        return None

    if crawl_result.total_pages == 0:
        log.warning(f"  No pages crawled for {url}")
        return None

    # Get markdown content from valuable pages
    combined_markdown = crawl_result.get_all_markdown(max_pages=5, max_chars=15000)
    if not combined_markdown or len(combined_markdown) < 100:
        log.warning(f"  Insufficient content from {url} ({len(combined_markdown or '')} chars)")
        return None

    source_urls = [p.url for p in crawl_result.get_valuable_pages()[:5]]
    if not source_urls:
        source_urls = list(crawl_result.pages.keys())[:3]

    log.info(f"  Crawled {crawl_result.total_pages} pages, {len(combined_markdown)} chars markdown")

    # Extract with Claude
    log.info(f"  Extracting structured data with Claude...")
    try:
        extraction = claude_client.extract_full_service(
            page_content=combined_markdown,
            service_name=name,
            category=category,
            source_url=source_urls[0] if source_urls else url,
        )
    except Exception as e:
        log.error(f"  Claude extraction failed: {e}")
        return None

    if not extraction:
        log.warning(f"  Claude returned no extraction for {name}")
        return None

    extraction["source_urls"] = source_urls
    extraction["pages_crawled"] = crawl_result.total_pages
    return extraction


def count_fields(ext):
    """Count how many useful fields an extraction has."""
    count = 0
    if ext.get("phone"): count += 1
    if ext.get("email"): count += 1
    if ext.get("hours_of_operation"): count += 1
    if ext.get("eligibility") and len(str(ext["eligibility"])) > 10: count += 1
    if ext.get("process_steps") and len(ext["process_steps"]) >= 2: count += 1
    return count


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Actually write to DB")
    parser.add_argument("--limit", type=int, default=25, help="Max services to process")
    args = parser.parse_args()

    session = SessionLocal()
    claude_client = init_claude()
    if not claude_client:
        log.error("Claude client not available — check ANTHROPIC_API_KEY")
        return

    backend = Crawl4AIBackend(default_config=CrawlConfig(
        js_rendering=True,
        timeout_seconds=25,
    ))

    services = load_services(session)
    log.info(f"Loaded {len(services)} inactive services to enrich")

    results = []
    succeeded = 0
    failed = 0
    activatable = 0

    try:
        for i, svc in enumerate(services[:args.limit]):
            log.info(f"\n[{i+1}/{min(len(services), args.limit)}] {svc['name']} ({svc['category']})")

            extraction = crawl_and_extract(backend, claude_client, svc)
            if not extraction:
                failed += 1
                results.append({
                    "service_id": svc["service_id"],
                    "name": svc["name"],
                    "status": "FAILED",
                    "reason": "crawl or extraction failed",
                })
                continue

            succeeded += 1
            new_fields = count_fields(extraction)
            existing_fields = 0
            if svc.get("phone"): existing_fields += 1
            if svc.get("email"): existing_fields += 1
            if svc.get("hours_of_operation"): existing_fields += 1
            if svc.get("eligibility") and len(str(svc["eligibility"])) > 10: existing_fields += 1
            if svc.get("process_steps"): existing_fields += 1

            # Would this service become activatable? (needs 2+ of the 5 key fields)
            combined_fields = max(new_fields, existing_fields)
            can_activate = combined_fields >= 2

            if can_activate:
                activatable += 1

            result_entry = {
                "service_id": svc["service_id"],
                "name": svc["name"],
                "category": svc["category"],
                "website": svc["website_url"],
                "status": "OK",
                "existing_fields": existing_fields,
                "new_fields_found": new_fields,
                "can_activate": can_activate,
                "pages_crawled": extraction.get("pages_crawled", 0),
                "extracted": {},
            }

            # Log what we found
            for field in ("phone", "email", "hours_of_operation", "eligibility",
                          "process_steps", "description", "address"):
                val = extraction.get(field)
                if val:
                    if field == "process_steps":
                        result_entry["extracted"][field] = f"{len(val)} steps"
                    elif field == "description":
                        result_entry["extracted"][field] = f"{len(str(val))} chars"
                    elif field == "eligibility":
                        result_entry["extracted"][field] = str(val)[:100]
                    else:
                        result_entry["extracted"][field] = str(val)[:100]

            results.append(result_entry)
            log.info(f"  Found {new_fields} fields: {list(result_entry['extracted'].keys())}")
            if can_activate:
                log.info(f"  ✓ Can be ACTIVATED")

            # Rate limit between services
            time.sleep(1)

    finally:
        backend.close()

    # Summary report
    print("\n" + "=" * 70)
    print("BATCH ENRICHMENT REPORT")
    print("=" * 70)
    print(f"Total services:    {len(services[:args.limit])}")
    print(f"Successfully crawled: {succeeded}")
    print(f"Failed:            {failed}")
    print(f"Can activate (2+ fields): {activatable}")
    print("=" * 70)

    # Detailed results
    for r in results:
        status = "✓" if r.get("can_activate") else "✗" if r["status"] == "OK" else "!"
        print(f"\n{status} {r['name']}")
        if r["status"] == "FAILED":
            print(f"  FAILED: {r.get('reason', 'unknown')}")
        else:
            print(f"  Category: {r.get('category')}")
            print(f"  Pages crawled: {r.get('pages_crawled', 0)}")
            print(f"  Existing fields: {r.get('existing_fields', 0)}, New fields: {r.get('new_fields_found', 0)}")
            if r.get("extracted"):
                for k, v in r["extracted"].items():
                    print(f"    {k}: {v}")

    # Save results JSON
    output_path = os.path.join(os.path.dirname(__file__), "enrichment_batch_results.json")
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nDetailed results saved to: {output_path}")


if __name__ == "__main__":
    main()
