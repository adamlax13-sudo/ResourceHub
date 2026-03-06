"""Shared utilities for the scraper pipeline."""

import json
import ipaddress
import socket
from urllib.parse import urlparse


def safe_json_loads(value):
    """Safely parse a JSON field that may be a list, string, or None."""
    if isinstance(value, list):
        return value
    if value:
        try:
            return json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return []
    return []


def is_safe_url(url: str) -> bool:
    """Validate URL uses http(s) scheme, has a valid host, and doesn't resolve to a private IP.

    Prevents SSRF by blocking requests to internal/private networks, loopback,
    link-local, and cloud metadata endpoints (e.g. 169.254.169.254).
    """
    if not url:
        return False
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return False
    hostname = parsed.hostname
    if not hostname:
        return False
    try:
        # Use getaddrinfo to support both IPv4 and IPv6
        addr_info = socket.getaddrinfo(hostname, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        for family, _, _, _, sockaddr in addr_info:
            ip = ipaddress.ip_address(sockaddr[0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False
    except (socket.gaierror, ValueError):
        # Cannot verify destination is safe — reject to prevent SSRF
        return False
    return True
