from backends.interface import (
    CrawlBackend,
    CrawlPage,
    CrawlSiteResult,
    CrawlConfig,
    PageType,
)

__all__ = [
    "CrawlBackend",
    "CrawlPage",
    "CrawlSiteResult",
    "CrawlConfig",
    "PageType",
    "get_crawl4ai_backend",
]


# Lazy import to avoid requiring crawl4ai at import time
def get_crawl4ai_backend(*args, **kwargs):
    from backends.crawl4ai_backend import Crawl4AIBackend
    return Crawl4AIBackend(*args, **kwargs)
