from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from backends.interface import CrawlBackend


@dataclass
class RawService:
    """Minimal service data returned by a source plugin."""
    name: str
    category: str
    source_url: str
    location: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    website_url: Optional[str] = None
    hours: Optional[str] = None
    description: Optional[str] = None
    eligibility: Optional[str] = None
    tags: Optional[list[str]] = None
    contact: Optional[str] = None
    extra: Optional[dict] = field(default_factory=dict)


class Source(ABC):
    """Base class for all source plugins. Subclasses implement discover()."""
    name: str = "unknown"
    url: str = ""
    backend: Optional['CrawlBackend'] = None  # Injected by Pipeline

    @abstractmethod
    def discover(self, session, log, dry_run=False) -> list[RawService]:
        """Scrape the directory. Return basic service data. No AI."""
        ...

    def has_changed(self, service_id: str, last_hash: str) -> bool:
        """Check if source page changed since last scrape. Default: always True."""
        return True
