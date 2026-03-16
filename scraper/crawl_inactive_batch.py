#!/usr/bin/env python3
"""Crawl inactive service websites and save raw markdown for manual extraction.

Uses Crawl4AI only (no Anthropic API calls). Saves crawled content to JSON
so it can be processed separately.
"""
import json
import logging
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backends.crawl4ai_backend import Crawl4AIBackend
from backends.interface import CrawlConfig

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

TARGETS = [
    {"id": "calgary-seniors-resource-society-calgary-ab", "name": "Calgary Seniors Resource Society", "url": "http://www.calgaryseniors.org", "category": "Senior Services"},
    {"id": "the-altview-foundation-for-gender-variant-and-sexual-minorities-edmonton-ab", "name": "Altview Foundation", "url": "http://www.altview.ca", "category": "LGBTQ2S+ Services"},
    {"id": "the-immigrant-education-society-ties-calgary-ab", "name": "The Immigrant Education Society (TIES)", "url": "http://www.immigrant-education.ca", "category": "Newcomer & Settlement"},
    {"id": "unison-society-calgary-ab", "name": "Unison Society", "url": "http://www.unisonalberta.com", "category": "Senior Services"},
    {"id": "independent-living-resource-centre-of-calgary-calgary-ab", "name": "Independent Living Resource Centre of Calgary", "url": "http://www.ilrcc.ab.ca", "category": "Disability & Autism Support"},
    {"id": "big-brothers-big-sisters-society-of-calgary-and-area-formerly-aunts-and-uncles-at-large-calgary-ab", "name": "Big Brothers Big Sisters Calgary", "url": "http://www.bbbscalgary.ca", "category": "Youth Services"},
    {"id": "robin-hood-association-for-the-handicapped-sherwood-park-ab", "name": "Robin Hood Association", "url": "http://www.robinhoodassoc.com", "category": "Disability & Autism Support"},
    {"id": "the-canlearn-society-for-persons-with-learning-difficulties-calgary-ab", "name": "CanLearn Society", "url": "http://www.canlearnsociety.ca", "category": "Disability & Autism Support"},
    {"id": "sage-seniors-association-edmonton-ab", "name": "Sage Seniors Association", "url": "http://www.mysage.ca", "category": "Senior Services"},
    {"id": "urban-society-for-aboriginal-youth-calgary-ab", "name": "Urban Society for Aboriginal Youth", "url": "http://www.usay.ca", "category": "Indigenous Services"},
    {"id": "influence-mentoring-society-calgary-ab", "name": "Influence Mentoring Society", "url": "http://influencementoring.com", "category": "Indigenous Services"},
    {"id": "gordon-russell-s-crystal-kids-youth-centre-edmonton-ab", "name": "Crystal Kids Youth Centre", "url": "http://www.crystalkids.org", "category": "Youth Services"},
    {"id": "burden-bearers-counselling-society-sundre-ab", "name": "Burden Bearers Counselling Society", "url": "http://www.burdenbearerscounselling.ca", "category": "Mental Health & Counselling"},
    {"id": "mental-health-copilots-ltd-stony-plain-ab", "name": "Mental Health Copilots", "url": "http://www.mentalhealthcopilots.org", "category": "Mental Health & Counselling"},
    {"id": "freedom-s-path-recovery-society-calgary-ab", "name": "Freedom's Path Recovery Society", "url": "http://www.freedomspathrecoverysociety.ca", "category": "Recovery & Peer Support"},
    {"id": "the-tri-terminator-foundation-calgary-ab", "name": "Tri Terminator Foundation", "url": "http://www.terminatorfoundation.com", "category": "Recovery & Peer Support"},
    {"id": "horn-of-africa-educational-and-economic-development-society-haeeds-edmonton-ab", "name": "HAEEDS", "url": "http://www.haeeds.org", "category": "Newcomer & Settlement"},
    {"id": "big-brothers-and-big-sisters-of-lethbridge-and-district-lethbridge-ab", "name": "Big Brothers Big Sisters Lethbridge", "url": "http://www.bbbslethbridge.ca", "category": "Youth Services"},
    {"id": "the-lethbridge-senior-citizens-organization-lethbridge-ab", "name": "Lethbridge Senior Citizens Organization", "url": "http://www.lethseniors.com", "category": "Senior Services"},
    {"id": "tourette-ocd-alberta-network-association-calgary-ab", "name": "Tourette OCD Alberta Network", "url": "http://www.touretteocdalbertanetwork.ca", "category": "Mental Health & Counselling"},
    {"id": "shepherd-s-care-foundation-edmonton-ab", "name": "Shepherd's Care Foundation", "url": "http://www.shepherdscare.org", "category": "Senior Services"},
    {"id": "caps-central-alberta-pride-society-central-alberta", "name": "Central Alberta Pride Society", "url": "https://www.centralalbertapride.ca/", "category": "LGBTQ2S+ Services"},
    {"id": "kids-with-cancer-society-of-northern-alberta-edmonton-ab", "name": "Kids With Cancer Society", "url": "http://www.kidswithcancer.ca", "category": "Healthcare Access"},
    {"id": "edmonton-residential-aide-placement-service-society-edmonton-ab", "name": "Edmonton RAPS", "url": "http://www.rapsedm.org", "category": "Disability & Autism Support"},
    {"id": "barrhead-association-for-community-living-barrhead-ab", "name": "Barrhead Association for Community Living", "url": "http://bacl-lighthouse.com", "category": "Mental Health & Counselling"},
]


def main():
    backend = Crawl4AIBackend(default_config=CrawlConfig(
        js_rendering=True, timeout_seconds=25,
    ))

    results = []
    try:
        for i, t in enumerate(TARGETS):
            log.info(f"\n[{i+1}/{len(TARGETS)}] {t['name']}")
            log.info(f"  URL: {t['url']}")

            try:
                crawl_result = backend.crawl_site(t["url"], CrawlConfig(
                    js_rendering=True, max_depth=2, max_pages=8, timeout_seconds=25,
                ))
            except Exception as e:
                log.error(f"  Crawl error: {e}")
                results.append({"id": t["id"], "name": t["name"], "status": "ERROR", "error": str(e)})
                continue

            if crawl_result.total_pages == 0:
                log.warning(f"  No pages crawled (site may be down)")
                results.append({"id": t["id"], "name": t["name"], "status": "NO_PAGES", "url": t["url"]})
                continue

            markdown = crawl_result.get_all_markdown(max_pages=5, max_chars=20000)
            page_urls = list(crawl_result.pages.keys())

            log.info(f"  OK: {crawl_result.total_pages} pages, {len(markdown)} chars")

            results.append({
                "id": t["id"],
                "name": t["name"],
                "category": t["category"],
                "url": t["url"],
                "status": "OK",
                "pages_crawled": crawl_result.total_pages,
                "page_urls": page_urls,
                "markdown_length": len(markdown),
                "markdown": markdown,
            })

            time.sleep(1)

    finally:
        backend.close()

    # Save results
    output_path = os.path.join(os.path.dirname(__file__), "crawled_inactive_services.json")
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    ok = sum(1 for r in results if r["status"] == "OK")
    no_pages = sum(1 for r in results if r["status"] == "NO_PAGES")
    errors = sum(1 for r in results if r["status"] == "ERROR")
    log.info(f"\n{'='*60}")
    log.info(f"CRAWL COMPLETE: {ok} OK, {no_pages} no pages, {errors} errors")
    log.info(f"Saved to: {output_path}")


if __name__ == "__main__":
    main()
