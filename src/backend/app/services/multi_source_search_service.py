from __future__ import annotations

import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Optional

from backend.app.models.article import Article
from backend.app.repositories.article_repository import get_article_repository
from backend.app.repositories.document_repository import DocumentRepository
from backend.app.schemas.search import (
    SearchHubItem,
    SearchHubResponse,
    SearchHubSection,
    SearchMode,
)
from backend.app.services.article_service import ArticleService
from backend.app.services.search_service import SearchService
from backend.app.services.serper_search_service import SerperSearchService
from backend.app.utils.text_normalization import (
    analyze_candidate_relevance,
    build_query_bundle,
    is_relevant_to_query,
)

logger = logging.getLogger(__name__)

SECTION_LABELS = {
    "documents": "Tài liệu bệnh học / PDF",
    "news": "Tin tức y tế liên quan",
    "community": "Bài viết cộng đồng / Blog",
    "external_links": "Link tham khảo bên ngoài",
}

NEWS_SOURCE_TYPES = {"news", "official_news", "health_news", "medical_news", "external_news"}
COMMUNITY_SOURCE_TYPES = {"community", "user_blog", "community_blog"}
COMMUNITY_CONTENT_TYPES = {"community", "blog", "user_blog"}
MULTI_SOURCE_MIN_LEXICAL_SCORE = 0.15
MULTI_SOURCE_STRONG_SEMANTIC_SCORE = float(os.getenv("SEARCH_STRONG_SEMANTIC_SCORE", "0.55") or "0.55")


class MultiSourceSearchService:
    def __init__(
        self,
        *,
        search_service: Optional[SearchService] = None,
        article_service: Optional[ArticleService] = None,
        document_repository: Optional[DocumentRepository] = None,
        serper_service: Optional[SerperSearchService] = None,
    ):
        self._search = search_service or SearchService()
        self._articles = article_service or ArticleService(repository=get_article_repository())
        self._documents = document_repository or DocumentRepository()
        self._serper = serper_service or SerperSearchService()

    def search(
        self,
        *,
        query: str,
        search_mode: SearchMode,
        limit: int = 10,
        min_score: float = 0.35,
        include_external: bool = True,
        debug: bool = False,
    ) -> SearchHubResponse:
        normalized_query = (query or "").strip()
        capped_limit = max(1, min(int(limit or 10), 10))
        if not normalized_query:
            empty_sections = self._empty_sections()
            return SearchHubResponse(
                query=normalized_query,
                search_mode=search_mode,
                total=0,
                sections=empty_sections,
                message="Chưa có truy vấn tìm kiếm.",
            )

        bundle = build_query_bundle(normalized_query)
        sections = self._empty_sections()

        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = {
                executor.submit(
                    self._search_documents_section,
                    query=normalized_query,
                    search_mode=search_mode,
                    limit=capped_limit,
                    min_score=min_score,
                    debug=debug,
                ): "documents",
                executor.submit(
                    self._search_article_sections,
                    bundle=bundle,
                    limit=capped_limit,
                    min_score=min_score,
                ): "articles",
            }
            if include_external:
                futures[
                    executor.submit(
                        self._search_external_links_section,
                        query=normalized_query,
                        bundle=bundle,
                        limit=min(capped_limit, 5),
                        min_score=min_score,
                    )
                ] = "external_links"

            for future in as_completed(futures):
                task_name = futures[future]
                try:
                    result = future.result()
                except Exception as exc:
                    logger.warning("Multi-source search task failed task=%s query='%s': %s", task_name, normalized_query[:120], str(exc))
                    continue

                if task_name == "documents":
                    sections["documents"] = result
                elif task_name == "articles":
                    sections["news"], sections["community"] = result
                elif task_name == "external_links":
                    sections["external_links"] = result

        total = sum(section.total for section in sections.values())
        message = None
        if total == 0:
            message = "Chưa tìm thấy nguồn phù hợp cho truy vấn này."

        return SearchHubResponse(
            query=normalized_query,
            search_mode=search_mode,
            total=total,
            sections=sections,
            message=message,
        )

    def _search_documents_section(
        self,
        *,
        query: str,
        search_mode: SearchMode,
        limit: int,
        min_score: float,
        debug: bool,
    ) -> SearchHubSection:
        items, _ = self._search.search_documents(
            search_mode=search_mode,
            q=query,
            status="active",
            visibility="public",
            limit=limit,
            min_score=min_score,
            debug=debug,
        )
        documents = self._documents.get_documents_by_ids([item.id for item in items])
        mapped = [
            SearchHubItem(
                type="document",
                document_id=item.id,
                title=item.title,
                summary=(documents.get(item.id).ai_summary if documents.get(item.id) else "") or item.snippet,
                snippet=item.snippet,
                source_type=item.source_type,
                topic=item.topic,
                tags=(documents.get(item.id).ai_suggested_tags if documents.get(item.id) else []) or [],
                score=item.score,
                updated_at=item.updated_at,
                url=f"/documents/{item.id}",
            )
            for item in items
        ]
        return SearchHubSection(
            label=SECTION_LABELS["documents"],
            total=len(mapped),
            items=mapped,
        )

    def _search_article_sections(
        self,
        *,
        bundle,
        limit: int,
        min_score: float,
    ) -> tuple[SearchHubSection, SearchHubSection]:
        public_articles = self._articles.list_public_articles(limit=max(limit * 12, 80))
        news_items: list[SearchHubItem] = []
        community_items: list[SearchHubItem] = []

        for article in public_articles:
            analysis = analyze_candidate_relevance(
                bundle,
                title=article.title,
                summary=article.summary,
                content=article.content[:8000],
                topic=article.topic,
                tags=article.tags,
                source_name=article.source_name,
                source_url=article.source_url,
            )
            if not is_relevant_to_query(
                bundle,
                analysis,
                min_score=min_score,
                strong_semantic_score=MULTI_SOURCE_STRONG_SEMANTIC_SCORE,
                min_lexical_score=MULTI_SOURCE_MIN_LEXICAL_SCORE,
            ):
                continue

            if self._is_community_article(article):
                community_items.append(
                    SearchHubItem(
                        type="community",
                        article_id=article.id,
                        title=article.title,
                        summary=article.summary,
                        image_url=article.image_url,
                        author_name=article.author_name or article.source_name,
                        published_at=article.published_at,
                        tags=article.tags,
                        topic=article.topic,
                        score=round(analysis.score, 4),
                        url=f"/blog/{article.id}",
                    )
                )
            elif self._is_news_article(article):
                news_items.append(
                    SearchHubItem(
                        type="news",
                        article_id=article.id,
                        title=article.title,
                        summary=article.summary,
                        image_url=article.image_url,
                        source_name=article.source_name,
                        source_url=article.source_url,
                        published_at=article.published_at,
                        tags=article.tags,
                        topic=article.topic,
                        score=round(analysis.score, 4),
                        url=f"/blog/{article.id}",
                    )
                )

        news_items.sort(key=self._article_sort_key, reverse=True)
        community_items.sort(key=self._article_sort_key, reverse=True)

        return (
            SearchHubSection(
                label=SECTION_LABELS["news"],
                total=len(news_items),
                items=news_items[:limit],
            ),
            SearchHubSection(
                label=SECTION_LABELS["community"],
                total=len(community_items),
                items=community_items[:limit],
            ),
        )

    def _search_external_links_section(
        self,
        *,
        query: str,
        bundle,
        limit: int,
        min_score: float,
    ) -> SearchHubSection:
        items = [
            SearchHubItem(**item)
            for item in self._serper.search(
                query=query,
                bundle=bundle,
                limit=limit,
                min_score=min_score,
            )
        ]
        return SearchHubSection(
            label=SECTION_LABELS["external_links"],
            total=len(items),
            items=items,
        )

    def _empty_sections(self) -> dict[str, SearchHubSection]:
        return {
            key: SearchHubSection(label=label, total=0, items=[])
            for key, label in SECTION_LABELS.items()
        }

    def _is_community_article(self, article: Article) -> bool:
        source_type = (article.source_type or "").strip().lower()
        content_type = (article.content_type or "").strip().lower()
        return (
            source_type in COMMUNITY_SOURCE_TYPES
            or content_type in COMMUNITY_CONTENT_TYPES
            or bool(article.author_id)
        )

    def _is_news_article(self, article: Article) -> bool:
        if self._is_community_article(article):
            return False
        source_type = (article.source_type or "").strip().lower()
        content_type = (article.content_type or "").strip().lower()
        return source_type in NEWS_SOURCE_TYPES or content_type in {"news", "article"}

    def _article_sort_key(self, item: SearchHubItem) -> tuple[float, float]:
        published = item.published_at or item.updated_at
        timestamp = published.timestamp() if published else 0.0
        return (float(item.score or 0), timestamp)
