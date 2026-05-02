from __future__ import annotations

import logging
import os
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

_PROXY_ENV_NAMES = (
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
)
_LOCAL_PROXY_HOSTS = {"127.0.0.1", "localhost", "::1"}
_DEAD_PROXY_PORTS = {9}


def _env_truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def _env_falsey(value: str | None) -> bool:
    return (value or "").strip().lower() in {"0", "false", "no", "off"}


def is_dead_local_proxy(value: str | None) -> bool:
    """Detect the local port-9 proxy commonly used as a network deny sentinel."""

    if not value:
        return False
    try:
        parsed = urlparse(value)
    except ValueError:
        return False
    return parsed.hostname in _LOCAL_PROXY_HOSTS and parsed.port in _DEAD_PROXY_PORTS


def sanitize_dead_proxy_env() -> list[str]:
    """Remove only known-dead proxy env vars so Firestore/API clients can connect.

    This does not disable real corporate/server proxies. Set
    RAG_SANITIZE_DEAD_PROXY=false to opt out.
    """

    if _env_falsey(os.getenv("RAG_SANITIZE_DEAD_PROXY")):
        return []

    removed: list[str] = []
    for name in _PROXY_ENV_NAMES:
        if is_dead_local_proxy(os.getenv(name)):
            removed.append(name)
            os.environ.pop(name, None)

    if removed:
        logger.warning("runtime_dead_proxy_env_sanitized vars=%s", ",".join(removed))
    return removed


def should_trust_external_news_proxy() -> bool:
    """External news fetchers ignore env proxies unless explicitly enabled."""

    return _env_truthy(os.getenv("EXTERNAL_NEWS_TRUST_ENV_PROXY"))
