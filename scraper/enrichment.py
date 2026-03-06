"""
AI Enrichment Engine for the scraper pipeline (Phase 2).

Orchestrates Claude-powered enrichment of services with process steps,
eligibility, wait times, costs, and required documents. Supports batching
by category, budget limits, and inference guards.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional


STALE_THRESHOLD_DAYS = 90


@dataclass
class EnrichmentResult:
    """Structured result from AI enrichment of a service."""
    service_id: str
    process_steps: Optional[list[dict]] = None
    required_docs: Optional[list[dict]] = None
    eligibility: Optional[dict] = None
    wait_times: Optional[dict] = None
    cost: Optional[dict] = None
    confidence: int = 0
    enrichment_source: str = "found"  # "found", "verified", "inferred"
    source_urls: list[str] = field(default_factory=list)
    # Contact fields (populated by web search enrichment)
    phone: Optional[str] = None
    email: Optional[str] = None
    hours: Optional[str] = None
    description: Optional[str] = None


def should_enrich(service) -> bool:
    """Determine if a service needs AI enrichment.

    Returns True if:
    - Service has never been enriched
    - Service has no process steps
    - Enrichment data is older than STALE_THRESHOLD_DAYS
    """
    if service.enrichment_date is None:
        return True
    if service.process_steps is None or service.process_steps == []:
        return True
    age = datetime.now() - service.enrichment_date
    if age > timedelta(days=STALE_THRESHOLD_DAYS):
        return True
    return False


def batch_services_by_category(services, batch_size=3) -> list[list]:
    """Group services by category into batches for efficient API calls.

    Services in the same category are batched together so Claude can
    leverage shared context (e.g., common intake processes for addiction
    services). Each batch is capped at batch_size.
    """
    by_category = {}
    for svc in services:
        by_category.setdefault(svc.category, []).append(svc)
    batches = []
    for category, svcs in by_category.items():
        for i in range(0, len(svcs), batch_size):
            batches.append(svcs[i:i + batch_size])
    return batches


class EnrichmentEngine:
    """Orchestrates AI enrichment for services using Claude web search.

    The engine:
    - Batches services by category for efficient API calls
    - Respects budget limits to control costs
    - Distinguishes "found" (from website), "verified", and "inferred" data
    - Never lets inferred data overwrite found/verified data
    - Caps inferred confidence at 49
    """

    def __init__(self, claude_client, budget_limit: float = None):
        self.claude = claude_client
        self.budget_limit = budget_limit
        self.total_cost = 0.0
        self.stats = {"found": 0, "verified": 0, "inferred": 0, "skipped": 0}

    def _should_apply(self, existing_service, result: EnrichmentResult) -> bool:
        """Determine if an enrichment result should be applied to a service.

        Inferred data never overwrites found/verified data. This protects
        high-quality data sourced from actual websites from being replaced
        by lower-confidence inferences.
        """
        if result.enrichment_source == "inferred":
            if existing_service.enrichment_source in ("found", "verified"):
                return False
            if existing_service.process_steps and len(existing_service.process_steps) > 0:
                return False
        return True

    def enrich_batch(self, session, log, services: list, dry_run=False) -> list[EnrichmentResult]:
        """Enrich a batch of services (same category) with one Claude call.

        Args:
            session: Database session
            log: Logger instance
            services: List of services to enrich (should be same category)
            dry_run: If True, skip actual API calls

        Returns:
            List of EnrichmentResult objects
        """
        if self.budget_limit and self.total_cost >= self.budget_limit:
            log.info(f"Budget limit ${self.budget_limit:.2f} reached. Stopping enrichment.")
            return []

        results = self.claude.batch_enrich_services(services)
        # Track actual API costs using Sonnet pricing: $3/MTok input, $15/MTok output
        last_usage = getattr(self.claude, '_last_usage', None)
        if last_usage:
            batch_cost = (last_usage.get('input', 0) * 3.0 / 1_000_000) + \
                         (last_usage.get('output', 0) * 15.0 / 1_000_000)
            self.total_cost += batch_cost
        else:
            # Conservative fallback ($0.10/service) when API usage data unavailable
            self.total_cost += len(services) * 0.10
        return results

    def enrich_service_inferred(self, session, log, service, similar_services: list) -> EnrichmentResult:
        """Last resort: infer process steps from similar services in same category.

        Uses Claude to generate plausible process steps based on what
        similar services in the same category require. Results are always
        marked as "inferred" with confidence capped at 49.

        Args:
            session: Database session
            log: Logger instance
            service: The service to generate inferred data for
            similar_services: List of similar services to base inference on

        Returns:
            EnrichmentResult with enrichment_source="inferred" and confidence <= 49
        """
        result = self.claude.infer_from_similar(service, similar_services)
        result.enrichment_source = "inferred"
        result.confidence = min(result.confidence, 49)  # Cap at 49
        self.stats["inferred"] += 1
        return result
