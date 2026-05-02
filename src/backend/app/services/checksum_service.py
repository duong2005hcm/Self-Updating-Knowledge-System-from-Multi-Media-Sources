from __future__ import annotations

import hashlib
import re
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

TRACKING_QUERY_PREFIXES = ("utm_",)
TRACKING_QUERY_KEYS = {"fbclid", "gclid", "mc_cid", "mc_eid"}


def normalize_text_for_checksum(text: str) -> str:
    """Normalize text for stable content checksum comparisons."""
    normalized = re.sub(r"\s+", " ", (text or "").strip())
    return normalized.lower()


def checksum_bytes(content: bytes) -> str:
    """Compute SHA-256 checksum for binary content."""
    return hashlib.sha256(content).hexdigest()


def checksum_text(text: str, *, normalize: bool = True) -> str:
    """Compute SHA-256 checksum for text content."""
    payload = normalize_text_for_checksum(text) if normalize else (text or "")
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def canonicalize_url(url: str) -> str:
    """Convert URL to a canonical string used for matching/checksum."""
    raw = (url or "").strip()
    if not raw:
        return ""

    parts = urlsplit(raw)
    scheme = (parts.scheme or "https").lower()
    netloc = (parts.netloc or "").lower()

    if netloc.endswith(":80") and scheme == "http":
        netloc = netloc[:-3]
    if netloc.endswith(":443") and scheme == "https":
        netloc = netloc[:-4]

    path = parts.path or "/"
    if path != "/":
        path = path.rstrip("/")

    query_items = parse_qsl(parts.query, keep_blank_values=True)
    filtered_query_items = []
    for key, value in query_items:
        lowered = key.lower()
        if lowered in TRACKING_QUERY_KEYS:
            continue
        if any(lowered.startswith(prefix) for prefix in TRACKING_QUERY_PREFIXES):
            continue
        filtered_query_items.append((key, value))
    query = urlencode(sorted(filtered_query_items))

    return urlunsplit((scheme, netloc, path, query, ""))


def checksum_url(url: str) -> str:
    """Checksum based on canonical URL string."""
    return checksum_text(canonicalize_url(url), normalize=False)
