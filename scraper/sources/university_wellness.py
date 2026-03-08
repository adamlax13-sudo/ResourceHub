"""Alberta post-secondary student wellness services.

Provides student wellness, counselling, accessibility, and other campus
services for all 26 publicly funded Alberta post-secondary institutions.

Uses a curated registry (university_registry.py) rather than web scraping,
since university pages are too structurally diverse for generic parsers.
The registry provides website_url for each service so the pipeline's
Phase 2 (Claude enrichment) can extract process steps, eligibility, and hours.
"""
import logging
from typing import List

from sources.plugin import Source, RawService
from sources.university_registry import INSTITUTIONS

logger = logging.getLogger(__name__)


class UniversityWellnessSource(Source):
    name = "university_wellness"
    url = "https://resourcehub-wwg6.onrender.com"

    def discover(self, session, log, dry_run=False) -> List[RawService]:
        """Build RawService list from the curated institution registry."""
        results: List[RawService] = []

        for inst in INSTITUTIONS:
            inst_name = inst["name"]
            city = inst["city"]
            address = inst.get("address", f"{city}, AB")
            wellness_url = inst.get("wellness_url", "")

            for svc in inst.get("services", []):
                name = f"{inst_name} \u2014 {svc['suffix']}"
                source_url = wellness_url or svc.get("url", "")
                location = svc.get("location", address)

                tags = [
                    "student-services",
                    "campus",
                    city.lower(),
                    inst["key"],
                ]
                extra_tags = svc.get("tags", [])
                tags.extend(extra_tags)
                # Deduplicate while preserving order
                seen = set()
                unique_tags = []
                for t in tags:
                    if t and t not in seen:
                        seen.add(t)
                        unique_tags.append(t)

                results.append(RawService(
                    name=name,
                    category=svc["category"],
                    source_url=source_url,
                    location=location,
                    phone=svc.get("phone", ""),
                    email=svc.get("email", ""),
                    address=address,
                    website_url=svc["url"],
                    hours=svc.get("hours", ""),
                    description=svc.get("description", ""),
                    eligibility=svc.get("eligibility",
                                        f"Current students at {inst_name}"),
                    tags=unique_tags,
                ))

        logger.info(
            f"[university_wellness] Built {len(results)} services "
            f"from {len(INSTITUTIONS)} institutions"
        )
        return results
