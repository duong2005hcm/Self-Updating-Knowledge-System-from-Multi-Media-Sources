from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from backend.app.services.article_service import ArticleService
from backend.app.services.europe_pmc_fetcher import EUROPE_PMC_SOURCE_NAME, EuropePmcFetcher
from backend.app.services.moh_fetcher import MOH_SOURCE_NAME, MohFetcher
from backend.app.services.pubmed_fetcher import PUBMED_SOURCE_NAME, PubMedFetcher

SOURCE_PUBMED = "pubmed"
SOURCE_EUROPE_PMC = "europe_pmc"
SOURCE_MOH = "moh"
SOURCE_ALL = "all"
DEFAULT_SOURCE_ORDER = [SOURCE_PUBMED, SOURCE_EUROPE_PMC, SOURCE_MOH]


@dataclass(frozen=True)
class ExternalNewsIngestItem:
    source_name: str
    action: str
    article_id: str
    title: str
    source_url: str
    external_id: Optional[str]
    dedup_matched_by: Optional[str]


@dataclass(frozen=True)
class ExternalNewsSourceResult:
    source_key: str
    source_name: str
    requested: int
    created_count: int
    skipped_count: int
    failed_count: int
    error: Optional[str]


@dataclass(frozen=True)
class ExternalNewsIngestResult:
    source_name: str
    limit_per_source: int
    created_count: int
    skipped_count: int
    failed_count: int
    items: list[ExternalNewsIngestItem]
    sources: list[ExternalNewsSourceResult]


class ExternalNewsIngestService:
    """Orchestrate tiny manual external-news ingests across configured sources."""

    def __init__(
        self,
        article_service: ArticleService,
        *,
        pubmed_fetcher: Optional[PubMedFetcher] = None,
        europe_pmc_fetcher: Optional[EuropePmcFetcher] = None,
        moh_fetcher: Optional[MohFetcher] = None,
    ):
        self._pubmed = pubmed_fetcher or PubMedFetcher(article_service)
        self._europe_pmc = europe_pmc_fetcher or EuropePmcFetcher(article_service)
        self._moh = moh_fetcher or MohFetcher(article_service)

    def ingest(
        self,
        *,
        source_name: str = SOURCE_ALL,
        limit_per_source: int = 2,
        query: str = "medicine",
        topic: str = "health",
        tags: Optional[list[str]] = None,
    ) -> ExternalNewsIngestResult:
        normalized_source = normalize_external_news_source(source_name)
        capped_limit = max(1, min(int(limit_per_source or 2), 2))
        normalized_topic = (topic or "").strip() or "health"
        normalized_query = (query or "").strip() or "medicine"
        source_keys = DEFAULT_SOURCE_ORDER if normalized_source == SOURCE_ALL else [normalized_source]

        items: list[ExternalNewsIngestItem] = []
        source_results: list[ExternalNewsSourceResult] = []
        created_count = 0
        skipped_count = 0
        failed_count = 0

        for source_key in source_keys:
            try:
                result = self._run_source(
                    source_key,
                    limit_per_source=capped_limit,
                    query=normalized_query,
                    topic=normalized_topic,
                    tags=tags or [],
                )
            except Exception as exc:
                failed_count += 1
                source_results.append(
                    ExternalNewsSourceResult(
                        source_key=source_key,
                        source_name=_display_source_name(source_key),
                        requested=capped_limit,
                        created_count=0,
                        skipped_count=0,
                        failed_count=1,
                        error=str(exc),
                    )
                )
                continue

            source_created = int(getattr(result, "created", 0))
            source_skipped = int(getattr(result, "skipped_duplicate", 0))
            created_count += source_created
            skipped_count += source_skipped
            source_results.append(
                ExternalNewsSourceResult(
                    source_key=source_key,
                    source_name=_display_source_name(source_key),
                    requested=int(getattr(result, "requested", capped_limit)),
                    created_count=source_created,
                    skipped_count=source_skipped,
                    failed_count=0,
                    error=None,
                )
            )
            items.extend(_map_items(source_key, getattr(result, "items", [])))

        return ExternalNewsIngestResult(
            source_name=normalized_source,
            limit_per_source=capped_limit,
            created_count=created_count,
            skipped_count=skipped_count,
            failed_count=failed_count,
            items=items,
            sources=source_results,
        )

    def _run_source(
        self,
        source_key: str,
        *,
        limit_per_source: int,
        query: str,
        topic: str,
        tags: list[str],
    ) -> Any:
        if source_key == SOURCE_PUBMED:
            return self._pubmed.fetch_latest(
                query=query,
                topic=topic,
                page_size=limit_per_source,
                tags=tags,
            )
        if source_key == SOURCE_EUROPE_PMC:
            return self._europe_pmc.fetch_latest(
                query=query,
                topic=topic,
                page_size=limit_per_source,
                tags=tags,
            )
        if source_key == SOURCE_MOH:
            return self._moh.fetch_latest(
                topic=topic,
                page_size=limit_per_source,
                tags=tags,
            )
        raise ValueError(f"Unsupported external news source: {source_key}")


def normalize_external_news_source(value: str) -> str:
    normalized = (value or SOURCE_ALL).strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "": SOURCE_ALL,
        SOURCE_ALL: SOURCE_ALL,
        "pubmed": SOURCE_PUBMED,
        "pub_med": SOURCE_PUBMED,
        "europepmc": SOURCE_EUROPE_PMC,
        "europe_pmc": SOURCE_EUROPE_PMC,
        "europe": SOURCE_EUROPE_PMC,
        "moh": SOURCE_MOH,
        "bo_y_te": SOURCE_MOH,
        "bộ_y_tế": SOURCE_MOH,
        "bo_te": SOURCE_MOH,
    }
    if normalized not in aliases:
        raise ValueError(f"Unsupported external news source: {value}")
    return aliases[normalized]


def _map_items(source_key: str, raw_items: list[Any]) -> list[ExternalNewsIngestItem]:
    source_name = _display_source_name(source_key)
    return [
        ExternalNewsIngestItem(
            source_name=source_name,
            action=str(getattr(item, "action", "")),
            article_id=str(getattr(item, "article_id", "")),
            title=str(getattr(item, "title", "")),
            source_url=str(getattr(item, "source_url", "")),
            external_id=getattr(item, "external_id", None),
            dedup_matched_by=getattr(item, "dedup_matched_by", None),
        )
        for item in raw_items
    ]


def _display_source_name(source_key: str) -> str:
    if source_key == SOURCE_PUBMED:
        return PUBMED_SOURCE_NAME
    if source_key == SOURCE_EUROPE_PMC:
        return EUROPE_PMC_SOURCE_NAME
    if source_key == SOURCE_MOH:
        return MOH_SOURCE_NAME
    return source_key
