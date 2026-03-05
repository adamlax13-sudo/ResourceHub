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
from upserter import upsert_service
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
            self.run_enrich(dry_run=dry_run, full=full)
        if phase is None or phase == "finalize":
            self.run_finalize(dry_run=dry_run)
        self.stats.duration_seconds = (datetime.now() - start).total_seconds()
        self.log.info(self.stats.summary())

    def run_discover(self, dry_run=False, source_name=None):
        for source in self.sources:
            if source_name and source.name != source_name:
                continue
            self.log.info(f"Discovering from {source.name}...")
            raw_services = source.discover(self.session, self.log, dry_run=dry_run)
            self.stats.services_found += len(raw_services)
            self.stats.sources_scraped += 1
            for raw in raw_services:
                result = upsert_service(self.session, self.log, raw, source.name, dry_run=dry_run)
                if result == "created":
                    self.stats.new_services += 1
                elif result == "enriched":
                    self.stats.updated_services += 1
                elif result == "skipped":
                    self.stats.skipped_unchanged += 1

    def run_enrich(self, dry_run=False, full=False):
        if not self.enrichment_engine:
            return
        if self.enrichment_engine.budget_limit and self.enrichment_engine.total_cost >= self.enrichment_engine.budget_limit:
            self.log.info("Budget already exceeded. Skipping enrichment.")
            return
        # Query services needing enrichment (actual DB query)
        # For now, the orchestration structure is in place

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
