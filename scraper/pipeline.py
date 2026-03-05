"""
3-Phase Pipeline Orchestrator

Phase 1: Discover — scrape source directories (no AI)
Phase 2: Enrich — AI-powered extraction of process steps, eligibility, etc.
Phase 3: Finalize — embeddings, normalization, dedup, view refresh
"""
from dataclasses import dataclass
from datetime import datetime

from sources.plugin import Source
from enrichment import EnrichmentEngine, should_enrich, batch_services_by_category
from upserter import upsert_service, invalidate_service_cache
from finalize import (
    phase_normalize_contacts,
    phase_enhance_tags,
    phase_generate_embeddings,
    phase_dedupe_services,
    phase_refresh_views,
)


@dataclass
class PipelineStats:
    sources_scraped: int = 0
    services_found: int = 0
    new_services: int = 0
    updated_services: int = 0
    skipped_unchanged: int = 0
    enriched_found: int = 0
    enriched_verified: int = 0
    enriched_inferred: int = 0
    embeddings_generated: int = 0
    deduped: int = 0
    api_cost: float = 0.0
    duration_seconds: float = 0.0

    def summary(self) -> str:
        return f"""=== Scraper Run Summary ===
Sources scraped:    {self.sources_scraped}
Services found:     {self.services_found}
New services:       {self.new_services}
Updated services:   {self.updated_services}
Skipped (unchanged): {self.skipped_unchanged}

Enrichment:
  Found w/ source:  {self.enriched_found}
  Verified:         {self.enriched_verified}
  Inferred:         {self.enriched_inferred}
  API cost:         ${self.api_cost:.2f}

Embeddings:         {self.embeddings_generated}
Deduped:            {self.deduped}
Total cost:         ${self.api_cost:.2f}
Duration:           {self.duration_seconds / 60:.0f} minutes"""


class Pipeline:
    def __init__(self, session, log, budget: float = None):
        self.session = session
        self.log = log
        self.budget = budget
        self.stats = PipelineStats()
        self.sources: list[Source] = []
        self.enrichment_engine: EnrichmentEngine = None

    def register_source(self, source: Source):
        self.sources.append(source)

    def run(self, phase: str = None, dry_run=False, full=False, source_name: str = None):
        start = datetime.now()
        if phase is None or phase == "discover":
            self.run_discover(dry_run=dry_run, source_name=source_name)
        if phase is None or phase == "enrich":
            self.run_enrich(dry_run=dry_run, full=full, source_name=source_name)
        if phase is None or phase == "finalize":
            self.run_finalize(dry_run=dry_run)
        self.stats.duration_seconds = (datetime.now() - start).total_seconds()
        self.log.info(self.stats.summary())

    def run_discover(self, dry_run=False, source_name=None):
        for source in self.sources:
            if source_name and source.name != source_name:
                continue
            self.log.info(f"Discovering from {source.name}...")
            try:
                raw_services = source.discover(self.session, self.log, dry_run=dry_run)
            except Exception as e:
                self.log.error(f"Source {source.name} failed: {e}")
                continue
            self.stats.services_found += len(raw_services)
            self.stats.sources_scraped += 1
            for i, raw in enumerate(raw_services):
                result = upsert_service(self.session, self.log, raw, source.name, dry_run=dry_run)
                if result == "created":
                    self.stats.new_services += 1
                elif result == "enriched":
                    self.stats.updated_services += 1
                elif result == "skipped":
                    self.stats.skipped_unchanged += 1

                # Commit every 100 services to avoid connection timeouts
                if not dry_run and (i + 1) % 100 == 0:
                    self.session.commit()
                    invalidate_service_cache()
                    self.log.info(f"  Committed batch {i+1}/{len(raw_services)} from {source.name}")

            # Final commit for remaining services
            if not dry_run:
                self.session.commit()
                invalidate_service_cache()
                self.log.info(f"Committed {len(raw_services)} services from {source.name}")

    def _is_data_rich(self, svc) -> bool:
        """Check if a service has enough data to be useful for users.

        A service needs at least 2 of: phone, email, hours, eligibility,
        process_steps to be considered useful. Description and address alone
        aren't enough.
        """
        field_count = 0
        if svc.phone and svc.phone.strip():
            field_count += 1
        if svc.email and svc.email.strip():
            field_count += 1
        if svc.hours_of_operation and str(svc.hours_of_operation).strip():
            field_count += 1
        if svc.eligibility and str(svc.eligibility).strip():
            field_count += 1
        if svc.process_steps and len(svc.process_steps) > 0:
            field_count += 1
        return field_count >= 2

    def run_enrich(self, dry_run=False, full=False, source_name=None):
        if not self.enrichment_engine:
            self.log.info("No enrichment engine configured (missing Claude API key). Skipping.")
            return
        if self.enrichment_engine.budget_limit and self.enrichment_engine.total_cost >= self.enrichment_engine.budget_limit:
            self.log.info("Budget already exceeded. Skipping enrichment.")
            return

        self.log.info("=== Enrich Phase ===")

        # Query services needing enrichment — filter at DB level to avoid loading everything
        from models import Service
        from sqlalchemy import or_

        base_filter = [
            Service.website_url.isnot(None),
            Service.website_url != "",
        ]

        if not full:
            base_filter.append(or_(
                Service.enrichment_date.is_(None),
                Service.process_steps.is_(None),
            ))

        to_enrich = self.session.query(Service).filter(*base_filter).all()

        # Filter by source if specified (source_name is stored in source_urls JSON array)
        if source_name and to_enrich:
            before = len(to_enrich)
            to_enrich = [s for s in to_enrich if source_name in (s.source_urls or [])]
            self.log.info(f"Source filter '{source_name}': {len(to_enrich)}/{before} services")

        self.log.info(f"Loaded {len(to_enrich)} services needing enrichment")

        if not to_enrich:
            self.log.info("No services need enrichment")
            return

        # Batch by category for efficient API calls
        batches = batch_services_by_category(to_enrich)
        self.log.info(f"Created {len(batches)} batches for enrichment")

        for i, batch in enumerate(batches):
            if self.enrichment_engine.budget_limit and self.enrichment_engine.total_cost >= self.enrichment_engine.budget_limit:
                self.log.info(f"Budget limit ${self.enrichment_engine.budget_limit:.2f} reached after {i} batches. Stopping.")
                break

            cat = batch[0].category if batch else "unknown"
            self.log.info(f"Enriching batch {i+1}/{len(batches)} ({len(batch)} {cat} services)...")

            if dry_run:
                self.log.info(f"  [DRY RUN] Would enrich: {', '.join(s.name for s in batch)}")
                continue

            try:
                results = self.enrichment_engine.enrich_batch(self.session, self.log, batch)
            except Exception as e:
                self.log.error(f"Enrichment batch {i+1} failed: {e}")
                if "usage limits" in str(e) or "401" in str(e):
                    self.log.error("API access denied. Stopping enrichment.")
                    break
                consecutive_errors = getattr(self, '_consecutive_errors', 0) + 1
                self._consecutive_errors = consecutive_errors
                if consecutive_errors >= 3:
                    self.log.error("3 consecutive failures. Stopping enrichment.")
                    break
                continue
            self._consecutive_errors = 0

            # Apply results to services
            for result in results:
                svc = next((s for s in batch if str(s.id) == result.service_id or s.service_id == result.service_id), None)
                if not svc:
                    continue
                if not self.enrichment_engine._should_apply(svc, result):
                    self.enrichment_engine.stats["skipped"] += 1
                    continue

                # Update service fields from enrichment
                if result.process_steps:
                    svc.process_steps = result.process_steps
                if result.required_docs:
                    svc.required_docs = result.required_docs
                if result.eligibility:
                    svc.eligibility = str(result.eligibility)
                if result.wait_times:
                    svc.wait_times = str(result.wait_times)[:255]
                if result.source_urls:
                    svc.source_urls = result.source_urls

                # Also apply contact fields if returned by enrichment
                # Truncate to DB column limits to avoid StringDataRightTruncation
                if hasattr(result, "phone") and result.phone:
                    if not svc.phone or not svc.phone.strip():
                        svc.phone = result.phone[:100]
                if hasattr(result, "email") and result.email:
                    if not svc.email or not svc.email.strip():
                        svc.email = result.email[:255]
                if hasattr(result, "hours") and result.hours:
                    if not svc.hours_of_operation or not str(svc.hours_of_operation).strip():
                        svc.hours_of_operation = result.hours[:500]
                if hasattr(result, "description") and result.description:
                    if not svc.description or not svc.description.strip():
                        svc.description = result.description

                svc.enrichment_source = result.enrichment_source
                svc.enrichment_date = datetime.now()
                svc.confidence_score = result.confidence

                # Re-activate if now data-rich enough
                # (always set is_active based on data richness since bulk deactivation
                # may have set it to false in the DB while ORM still shows True)
                if self._is_data_rich(svc):
                    svc.is_active = True

                self.enrichment_engine.stats[result.enrichment_source] += 1
                try:
                    self.session.commit()
                except Exception as e:
                    self.log.error(f"Commit failed for {svc.name}: {e}")
                    self.session.rollback()

        self.stats.enriched_found = self.enrichment_engine.stats.get("found", 0)
        self.stats.enriched_verified = self.enrichment_engine.stats.get("verified", 0)
        self.stats.enriched_inferred = self.enrichment_engine.stats.get("inferred", 0)
        self.log.info(f"Enrichment complete. Cost: ${self.enrichment_engine.total_cost:.2f}")

    def run_finalize(self, dry_run=False):
        self.log.info("=== Finalize Phase ===")

        phase_normalize_contacts(self.session, self.log, dry_run=dry_run)
        phase_enhance_tags(self.session, self.log, dry_run=dry_run)

        # phase_generate_embeddings needs an OpenAI client; create one if available
        try:
            from scraper import init_openai, HAS_OPENAI
            client = init_openai() if HAS_OPENAI else None
        except Exception:
            client = None
        phase_generate_embeddings(self.session, client, self.log)

        phase_dedupe_services(self.session, self.log, dry_run=dry_run)
        phase_refresh_views(self.session, self.log)
