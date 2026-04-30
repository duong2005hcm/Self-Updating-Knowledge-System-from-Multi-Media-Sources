from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Optional

import requests

from backend.app.config.runtime_network import should_trust_external_news_proxy
from backend.app.schemas.article import ArticleCreateRequest
from backend.app.services.article_service import ArticleCreateResult, ArticleService

PUBMED_SEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_SUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
PUBMED_SOURCE_NAME = "PubMed"

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PubMedFetchItem:
    action: str
    article_id: str
    title: str
    source_url: str
    external_id: Optional[str]
    dedup_matched_by: Optional[str]


@dataclass(frozen=True)
class PubMedFetchResult:
    query: str
    topic: str
    requested: int
    created: int
    skipped_duplicate: int
    items: list[PubMedFetchItem]


class PubMedFetcher:
    """Fetch a tiny latest PubMed batch into Firestore articles."""

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
    ) -> PubMedFetchResult:
        normalized_query = (query or "").strip() or "medicine"
        normalized_topic = (topic or "").strip() or normalized_query
        capped_page_size = max(1, min(int(page_size or 2), 2))

        pubmed_ids = self._search_ids(query=normalized_query, page_size=capped_page_size)
        summaries = self._fetch_summaries(pubmed_ids) if pubmed_ids else []
        logger.info(
            "pubmed_parse_result query=%s requested=%s raw_count=%s first_title=%s",
            normalized_query,
            capped_page_size,
            len(summaries),
            _clean_text(summaries[0].get("title")) if summaries else "",
        )

        items: list[PubMedFetchItem] = []
        created = 0
        skipped_duplicate = 0
        for raw in summaries[:capped_page_size]:
            article_payload = _map_summary_to_article_request(
                raw,
                topic=normalized_topic,
                query=normalized_query,
                tags=tags or [],
            )
            create_result = self._articles.create_article(article_payload)
            logger.info(
                "pubmed_dedup_result action=%s matched_by=%s external_id=%s source_url=%s title=%s",
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

        return PubMedFetchResult(
            query=normalized_query,
            topic=normalized_topic,
            requested=capped_page_size,
            created=created,
            skipped_duplicate=skipped_duplicate,
            items=items,
        )

    def _search_ids(self, *, query: str, page_size: int) -> list[str]:
        params = {
            "db": "pubmed",
            "term": query,
            "retmode": "json",
            "sort": "pub date",
            "retmax": page_size,
        }
        logger.info("pubmed_esearch_request url=%s params=%s", PUBMED_SEARCH_URL, params)
        response = self._http_get(
            PUBMED_SEARCH_URL,
            params=params,
            timeout=self._timeout_seconds,
        )
        logger.info(
            "pubmed_esearch_response status=%s size=%s url=%s",
            getattr(response, "status_code", ""),
            len(getattr(response, "content", b"") or b""),
            getattr(response, "url", PUBMED_SEARCH_URL),
        )
        response.raise_for_status()
        payload = response.json()
        ids = ((payload.get("esearchresult") or {}).get("idlist") or []) if isinstance(payload, dict) else []
        normalized_ids = [str(item).strip() for item in ids if str(item).strip()]
        logger.info("pubmed_esearch_result query=%s pmid_count=%s ids=%s", query, len(normalized_ids), normalized_ids)
        return normalized_ids

    def _fetch_summaries(self, pubmed_ids: list[str]) -> list[dict[str, Any]]:
        params = {
            "db": "pubmed",
            "id": ",".join(pubmed_ids),
            "retmode": "json",
        }
        logger.info("pubmed_esummary_request url=%s params=%s", PUBMED_SUMMARY_URL, params)
        response = self._http_get(
            PUBMED_SUMMARY_URL,
            params=params,
            timeout=self._timeout_seconds,
        )
        logger.info(
            "pubmed_esummary_response status=%s size=%s url=%s",
            getattr(response, "status_code", ""),
            len(getattr(response, "content", b"") or b""),
            getattr(response, "url", PUBMED_SUMMARY_URL),
        )
        response.raise_for_status()
        payload = response.json()
        result = payload.get("result") if isinstance(payload, dict) else None
        if not isinstance(result, dict):
            return []
        summaries: list[dict[str, Any]] = []
        for pubmed_id in pubmed_ids:
            item = result.get(pubmed_id)
            if isinstance(item, dict):
                summaries.append(item)
        logger.info(
            "pubmed_esummary_result requested=%s summary_count=%s first_title=%s",
            len(pubmed_ids),
            len(summaries),
            _clean_text(summaries[0].get("title")) if summaries else "",
        )
        return summaries


def _map_summary_to_article_request(
    raw: dict[str, Any],
    *,
    topic: str,
    query: str,
    tags: list[str],
) -> ArticleCreateRequest:
    pubmed_id = _clean_text(raw.get("uid"))
    title = _clean_text(raw.get("title")) or "Untitled PubMed article"
    journal = _clean_text(raw.get("fulljournalname") or raw.get("source"))
    pubdate = _clean_text(raw.get("pubdate") or raw.get("epubdate"))
    source_url = f"https://pubmed.ncbi.nlm.nih.gov/{pubmed_id}/" if pubmed_id else "https://pubmed.ncbi.nlm.nih.gov/"
    summary_parts = [part for part in [journal, pubdate] if part]
    summary = " | ".join(summary_parts)
    content = _clean_text(" ".join([title, summary]))

    return ArticleCreateRequest(
        title=title,
        summary=summary,
        content=content or title,
        content_type="news",
        source_type="external_news",
        source_name=PUBMED_SOURCE_NAME,
        source_url=source_url,
        external_id=f"pubmed:{pubmed_id}" if pubmed_id else None,
        published_at=_parse_pubmed_date(pubdate),
        topic=topic,
        tags=_dedupe_tags([topic, query, PUBMED_SOURCE_NAME, journal, *tags]),
        status="active",
        visibility="public",
    )


def _build_default_http_get() -> Callable[..., Any]:
    session = requests.Session()
    session.trust_env = should_trust_external_news_proxy()
    return session.get


def _parse_pubmed_date(value: Any) -> Optional[datetime]:
    raw = _clean_text(value)
    if not raw:
        return None

    candidates = [
        (raw[:11], "%Y %b %d"),
        (raw[:8], "%Y %b"),
        (raw[:4], "%Y"),
    ]
    for candidate, fmt in candidates:
        try:
            parsed = datetime.strptime(candidate, fmt)
            return parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _to_fetch_item(result: ArticleCreateResult) -> PubMedFetchItem:
    return PubMedFetchItem(
        action=result.action,
        article_id=result.article.id,
        title=result.article.title,
        source_url=result.article.source_url,
        external_id=result.article.external_id,
        dedup_matched_by=result.dedup_matched_by,
    )


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
