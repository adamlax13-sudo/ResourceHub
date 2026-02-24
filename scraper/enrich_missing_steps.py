#!/usr/bin/env python3
"""Target services missing process_steps for deep crawl + Claude extraction."""

import os
import sys
import time
import logging
from datetime import datetime

# Load env before other imports
from dotenv import load_dotenv
load_dotenv()

from scraper import (
    SessionLocal, Service,
    init_openai, calculate_confidence_score, should_enrich_field
)
from sqlalchemy import text

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Import deep crawler and Claude
try:
    from deep_crawler import DeepCrawler
    from claude_client import init_claude
    HAS_MODULES = True
except ImportError as e:
    logger.error(f"Missing modules: {e}")
    HAS_MODULES = False


def main():
    if not HAS_MODULES:
        logger.error("Required modules not available")
        return

    session = SessionLocal()
    client = init_openai()
    claude_client = init_claude()

    if not claude_client:
        logger.error("Claude client not available - check ANTHROPIC_API_KEY")
        return

    # Get services missing process_steps with websites
    result = session.execute(text('''
        SELECT service_id, name, website_url, category
        FROM services
        WHERE is_active = TRUE
          AND website_url IS NOT NULL
          AND website_url != ''
          AND (process_steps IS NULL OR process_steps::text = '[]' OR process_steps::text = 'null')
    ''')).fetchall()

    services_to_process = [
        {"service_id": r[0], "name": r[1], "website_url": r[2], "category": r[3]}
        for r in result
    ]

    logger.info(f"Found {len(services_to_process)} services missing process_steps")

    if not services_to_process:
        logger.info("No services to process!")
        return

    # Initialize crawler
    crawler = DeepCrawler(max_depth=2, max_pages=15, request_delay=2.0, openai_client=client)

    updated_count = 0
    skipped_robots = 0
    skipped_no_content = 0

    for i, svc in enumerate(services_to_process):
        logger.info(f"[{i+1}/{len(services_to_process)}] Processing: {svc['name']}")

        try:
            # Deep crawl
            crawl_result = crawler.crawl_website(svc['website_url'])

            if crawl_result.total_pages_crawled == 0:
                logger.warning(f"  Skipped (robots.txt or crawl error)")
                skipped_robots += 1
                continue

            logger.info(f"  Crawled {crawl_result.total_pages_crawled} pages")

            # Get valuable pages using the helper method
            best_pages = crawl_result.get_all_valuable_pages()

            # If no valuable pages found, use whatever we crawled
            if not best_pages:
                best_pages = list(crawl_result.pages.values())[:5]

            combined_content = ""
            source_urls = []
            for page in best_pages[:5]:
                if page.text_content:
                    content = page.text_content[:3000]
                    combined_content += f"\n\n=== FROM {page.url} ===\n{content}"
                    source_urls.append(page.url)

            if not combined_content:
                logger.warning(f"  No content extracted from pages")
                skipped_no_content += 1
                continue

            # Extract with Claude
            extraction = claude_client.extract_full_service(
                page_content=combined_content,
                service_name=svc['name'],
                category=svc['category'] or "",
                source_url=source_urls[0] if source_urls else None
            )

            if not extraction:
                logger.warning(f"  Claude extraction returned nothing")
                continue

            # Update service
            service = session.query(Service).filter_by(service_id=svc['service_id']).first()
            if not service:
                continue

            updated = False

            # Update process_steps
            if extraction.get("process_steps"):
                service.process_steps = extraction["process_steps"]
                updated = True
                logger.info(f"  Added {len(extraction['process_steps'])} process steps")

            # Update other fields if empty
            for field in ["description", "phone", "email", "address", "hours_of_operation", "eligibility", "required_docs"]:
                if extraction.get(field) and should_enrich_field(service, field):
                    setattr(service, field, extraction[field])
                    updated = True

            if updated:
                service.last_updated = datetime.now()

                # Calculate confidence
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
                    field_sources={},
                    has_website_data=True,
                    has_211_data=False,
                )

                session.commit()
                updated_count += 1
                logger.info(f"  Updated (confidence: {service.confidence_score})")

            time.sleep(1)

        except Exception as e:
            logger.error(f"  Error: {e}")
            session.rollback()

    print("\n" + "=" * 50)
    print("ENRICHMENT COMPLETE")
    print("=" * 50)
    print(f"Services processed:    {len(services_to_process)}")
    print(f"Services updated:      {updated_count}")
    print(f"Skipped (robots.txt):  {skipped_robots}")
    print(f"Skipped (no content):  {skipped_no_content}")
    print("=" * 50)

    session.close()


if __name__ == "__main__":
    main()
