from __future__ import annotations

import logging
import os
from concurrent.futures import TimeoutError
from urllib.parse import urlparse

import requests

from backend.app.utils.text_normalization import (
    QueryBundle,
    analyze_candidate_relevance,
    is_relevant_to_query,
)

logger = logging.getLogger(__name__)

SERPER_ENDPOINT = "https://google.serper.dev/search"
DEFAULT_TRUSTED_DOMAINS = (
    "who.int",
    "moh.gov.vn",
    "medlineplus.gov",
    "nhs.uk",
    "cdc.gov",
    "suckhoedoisong.vn",
    "tamanhhospital.vn",
    "vinmec.com",
    "msdmanuals.com",
)


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int, *, minimum: int, maximum: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return max(minimum, min(maximum, value))


def _env_float(name: str, default: float, *, minimum: float, maximum: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        return default
    return max(minimum, min(maximum, value))


class SerperSearchService:
    def __init__(self):
        self._api_key = os.getenv("SERPER_API_KEY", "").strip()
        self._enabled = _env_bool("SERPER_SEARCH_ENABLED", True)
        self._max_results = _env_int("SERPER_MAX_RESULTS", 5, minimum=1, maximum=10)
        self._timeout_seconds = _env_float("SERPER_TIMEOUT_SECONDS", 5.0, minimum=1.0, maximum=10.0)

    @property
    def is_enabled(self) -> bool:
        return self._enabled and bool(self._api_key)

    def search(
        self,
        *,
        query: str,
        bundle: QueryBundle,
        limit: int,
        min_score: float,
    ) -> list[dict]:
        if not self.is_enabled:
            return []

        effective_limit = max(1, min(int(limit or self._max_results), self._max_results))
        payload = {
            "q": f"{query} bệnh sức khỏe nguồn y tế".strip(),
            "gl": "vn",
            "hl": "vi",
            "num": effective_limit,
        }
        headers = {
            "X-API-KEY": self._api_key,
            "Content-Type": "application/json",
        }

        try:
            response = requests.post(
                SERPER_ENDPOINT,
                headers=headers,
                json=payload,
                timeout=self._timeout_seconds,
            )
            response.raise_for_status()
            data = response.json() or {}
        except Exception as exc:
            logger.warning("Serper search failed for query='%s': %s", query[:120], str(exc))
            return []

        organic = data.get("organic") or []
        items: list[dict] = []
        for row in organic:
            link = str(row.get("link") or "").strip()
            title = str(row.get("title") or "").strip()
            snippet = str(row.get("snippet") or "").strip()
            if not link or not title:
                continue

            analysis = analyze_candidate_relevance(
                bundle,
                title=title,
                summary=snippet,
                content=snippet,
                source_name=str(row.get("source") or ""),
                source_url=link,
            )
            if not is_relevant_to_query(
                bundle,
                analysis,
                min_score=min_score,
                min_lexical_score=0.15,
            ):
                continue

            domain = urlparse(link).netloc.lower()
            trust_bonus = 0.1 if any(domain.endswith(allowed) for allowed in DEFAULT_TRUSTED_DOMAINS) else 0.0
            score = min(1.0, analysis.score + trust_bonus)
            items.append(
                {
                    "type": "external",
                    "title": title,
                    "snippet": snippet,
                    "source_name": domain or str(row.get("source") or "web"),
                    "source_url": link,
                    "display_link": str(row.get("displayLink") or domain or link),
                    "score": round(score, 4),
                }
            )

        items.sort(key=lambda item: item["score"], reverse=True)
        return items[:effective_limit]
