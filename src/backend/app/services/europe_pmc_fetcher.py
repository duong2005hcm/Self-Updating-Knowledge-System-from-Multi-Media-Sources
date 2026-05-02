from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Optional

import requests

from backend.app.config.runtime_network import should_trust_external_news_proxy
from backend.app.schemas.article import ArticleCreateRequest
from backend.app.services.article_service import ArticleCreateResult, ArticleService

EUROPE_PMC_SEARCH_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
EUROPE_PMC_SOURCE_NAME = "Europe PMC"

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EuropePmcFetchItem:
    action: str
    article_id: str
    title: str
    source_url: str
    external_id: Optional[str]
    dedup_matched_by: Optional[str]


@dataclass(frozen=True)
class EuropePmcFetchResult:
    query: str
    topic: str
    requested: int
    created: int
    skipped_duplicate: int
    items: list[EuropePmcFetchItem]


class EuropePmcFetcher:
    """Fetch a small latest-result batch from Europe PMC into articles."""

    def __init__(
        self,
        article_service: ArticleService,
        *,
        http_get: Optional[Callable[..., Any]] = None,
        timeout_seconds: int = 20,
    ):
        self._articles = article_service
        self._http_get = http_get or _build_default_http_get()
        self._timeout_seconds = timeout_seconds

    def fetch_latest(
        self,
        *,
        query: str,
        topic: str,
        page_size: int = 2,
        tags: Optional[list[str]] = None,
    ) -> EuropePmcFetchResult:
        normalized_query = (query or "").strip() or "medicine"
        normalized_topic = (topic or "").strip() or normalized_query
        capped_page_size = max(1, min(int(page_size or 2), 2))

        payload = self._fetch_payload(query=normalized_query, page_size=capped_page_size)
        raw_results = ((payload.get("resultList") or {}).get("result") or [])[:capped_page_size]
        logger.info(
            "europe_pmc_parse_result query=%s requested=%s raw_count=%s first_title=%s",
            normalized_query,
            capped_page_size,
            len(raw_results),
            _clean_text(raw_results[0].get("title")) if raw_results else "",
        )

        items: list[EuropePmcFetchItem] = []
        created = 0
        skipped_duplicate = 0
        for raw in raw_results:
            article_payload = _map_result_to_article_request(
                raw,
                topic=normalized_topic,
                query=normalized_query,
                tags=tags or [],
            )
            create_result = self._articles.create_article(article_payload)
            logger.info(
                "europe_pmc_dedup_result action=%s matched_by=%s external_id=%s source_url=%s title=%s",
                create_result.action,
                create_result.dedup_matched_by or "",
                article_payload.external_id or "",
                article_payload.source_url,
                article_payload.title,
            )
            if create_result.action == "created":
                created += 1
            elif create_result.action == "skipped_duplicate":
                skipped_duplicate += 1

            items.append(_to_fetch_item(create_result))

        return EuropePmcFetchResult(
            query=normalized_query,
            topic=normalized_topic,
            requested=capped_page_size,
            created=created,
            skipped_duplicate=skipped_duplicate,
            items=items,
        )

    def _fetch_payload(self, *, query: str, page_size: int) -> dict[str, Any]:
        search_query = _build_search_query(query)
        params = {
            "query": search_query,
            "format": "json",
            "resultType": "core",
            "pageSize": page_size,
        }
        logger.info(
            "europe_pmc_request url=%s params=%s",
            EUROPE_PMC_SEARCH_URL,
            params,
        )
        response = self._http_get(
            EUROPE_PMC_SEARCH_URL,
            params=params,
            timeout=self._timeout_seconds,
        )
        logger.info(
            "europe_pmc_response status=%s size=%s url=%s",
            getattr(response, "status_code", ""),
            len(getattr(response, "content", b"") or b""),
            getattr(response, "url", EUROPE_PMC_SEARCH_URL),
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError("Europe PMC response is not a JSON object")
        return payload


def _build_search_query(query: str) -> str:
    normalized = (query or "").strip() or "medicine"
    if "SORT_DATE:" in normalized.upper():
        return normalized
    return f"({normalized}) SORT_DATE:y"


def _map_result_to_article_request(
    raw: dict[str, Any],
    *,
    topic: str,
    query: str,
    tags: list[str],
) -> ArticleCreateRequest:
    source = str(raw.get("source") or "MED").strip()
    item_id = str(raw.get("id") or raw.get("pmid") or raw.get("pmcid") or raw.get("doi") or "").strip()
    external_id = f"{source}:{item_id}" if item_id else None
    title = _clean_text(raw.get("title")) or "Untitled Europe PMC article"
    abstract = _clean_text(raw.get("abstractText"))
    content = abstract or title
    source_url = _build_article_url(source=source, item_id=item_id, fallback=raw.get("doi"))
    published_at = _parse_europe_pmc_date(
        raw.get("firstPublicationDate")
        or raw.get("electronicPublicationDate")
        or raw.get("printPublicationDate")
        or raw.get("pubYear")
    )

    mapped_tags = _dedupe_tags(
        [
            topic,
            query,
            source,
            _clean_text(raw.get("journalTitle")),
            *tags,
        ]
    )

    return ArticleCreateRequest(
        title=title,
        summary=abstract[:800] if abstract else "",
        content=content,
        content_type="news",
        source_type="external_news",
        source_name=EUROPE_PMC_SOURCE_NAME,
        source_url=source_url,
        external_id=external_id,
        published_at=published_at,
        topic=topic,
        tags=mapped_tags,
        status="active",
        visibility="public",
    )


def _build_default_http_get() -> Callable[..., Any]:
    session = requests.Session()
    session.trust_env = should_trust_external_news_proxy()
    return session.get


def _to_fetch_item(result: ArticleCreateResult) -> EuropePmcFetchItem:
    return EuropePmcFetchItem(
        action=result.action,
        article_id=result.article.id,
        title=result.article.title,
        source_url=result.article.source_url,
        external_id=result.article.external_id,
        dedup_matched_by=result.dedup_matched_by,
    )


def _build_article_url(*, source: str, item_id: str, fallback: Any) -> str:
    if source and item_id:
        return f"https://europepmc.org/article/{source}/{item_id}"
    doi = _clean_text(fallback)
    if doi:
        return f"https://europepmc.org/search?query=DOI:{doi}"
    return "https://europepmc.org/"


def _parse_europe_pmc_date(value: Any) -> Optional[datetime]:
    raw = str(value or "").strip()
    if not raw:
        return None

    candidates = [raw]
    if len(raw) == 4:
        candidates.append(f"{raw}-01-01")
    if len(raw) == 7:
        candidates.append(f"{raw}-01")

    for candidate in candidates:
        try:
            parsed = datetime.fromisoformat(candidate)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except ValueError:
            continue
    return None


def _clean_text(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def _dedupe_tags(values: list[str]) -> list[str]:
    seen: set[str] = set()
    tags: list[str] = []
    for value in values:
        normalized = _clean_text(value)
        key = normalized.lower()
        if not normalized or key in seen:
            continue
        seen.add(key)
        tags.append(normalized)
    return tags
