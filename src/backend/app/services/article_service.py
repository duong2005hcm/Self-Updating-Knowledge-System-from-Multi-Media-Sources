from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from backend.app.models.article import Article
from backend.app.repositories.article_repository import ArticleRepository
from backend.app.schemas.article import ArticleCreateRequest
from backend.app.services.article_dedup_service import (
    ArticleDedupCandidate,
    ArticleDedupService,
    build_article_content_hash,
)
from backend.app.services.checksum_service import canonicalize_url

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ArticleCreateResult:
    action: str  # created | skipped_duplicate
    article: Article
    dedup_matched_by: Optional[str] = None


def _normalize_visibility(value: str) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {"public", "protected", "private"}:
        return normalized
    return "public"


def _normalize_status(value: str) -> str:
    return (value or "").strip() or "active"


PUBLIC_ARTICLE_STATUSES = ("published", "approved", "active")


def _article_sort_key(article: Article) -> datetime:
    return (
        article.published_at
        or article.updated_at
        or article.created_at
        or datetime.min.replace(tzinfo=timezone.utc)
    )


def _dedupe_and_sort_articles(items: list[Article]) -> list[Article]:
    deduped: dict[str, Article] = {}
    for item in items:
        deduped[item.id] = item
    return sorted(deduped.values(), key=_article_sort_key, reverse=True)


class ArticleService:
    """Business layer for external news/blog articles.

    This service intentionally stores articles in Firestore only. It does not
    chunk or embed article content into Chroma.
    """

    def __init__(
        self,
        repository: ArticleRepository,
        dedup_service: Optional[ArticleDedupService] = None,
    ):
        self._repository = repository
        self._dedup = dedup_service or ArticleDedupService(repository)

    def create_article(self, payload: ArticleCreateRequest) -> ArticleCreateResult:
        source_url = canonicalize_url(payload.source_url) or payload.source_url.strip()
        external_id = (payload.external_id or "").strip() or None
        content = payload.content.strip()
        content_hash = (payload.content_hash or "").strip() or build_article_content_hash(content)

        dedup_result = self._dedup.check_duplicate(
            ArticleDedupCandidate(
                source_name=payload.source_name.strip(),
                external_id=external_id,
                source_url=source_url,
                title=payload.title.strip(),
                published_at=payload.published_at,
                content=content,
                content_hash=content_hash,
            )
        )
        if dedup_result.is_duplicate:
            logger.info(
                "article_create_skipped_duplicate source_name=%s external_id=%s source_url=%s title=%s matched_by=%s article_id=%s",
                payload.source_name.strip(),
                external_id or "",
                source_url,
                payload.title.strip(),
                dedup_result.matched_by or "",
                dedup_result.duplicate.id,
            )
            return ArticleCreateResult(
                action="skipped_duplicate",
                article=dedup_result.duplicate,
                dedup_matched_by=dedup_result.matched_by,
            )

        # Keep this older repository method as a defensive compatibility check.
        existing = self._repository.get_article_by_external_key(
            source_name=payload.source_name.strip(),
            external_id=external_id,
            source_url=source_url,
        )
        if existing is not None:
            logger.info(
                "article_create_skipped_duplicate source_name=%s external_id=%s source_url=%s title=%s matched_by=%s article_id=%s",
                payload.source_name.strip(),
                external_id or "",
                source_url,
                payload.title.strip(),
                "external_key",
                existing.id,
            )
            return ArticleCreateResult(
                action="skipped_duplicate",
                article=existing,
                dedup_matched_by="external_key",
            )

        article = Article.create(
            title=payload.title.strip(),
            summary=(payload.summary or "").strip(),
            content=content,
            content_type=(payload.content_type or "").strip() or "news",
            source_type=(payload.source_type or "").strip() or "external_news",
            source_name=payload.source_name.strip(),
            source_url=source_url,
            image_url=(payload.image_url or "").strip() or None,
            author_id=(payload.author_id or "").strip() or None,
            author_name=(payload.author_name or "").strip() or None,
            external_id=external_id,
            content_hash=content_hash,
            published_at=payload.published_at,
            topic=(payload.topic or "").strip() or "general",
            tags=[tag.strip() for tag in payload.tags if tag and tag.strip()],
            status=_normalize_status(payload.status),
            visibility=_normalize_visibility(payload.visibility),
        )
        created = self._repository.create_article(article)
        logger.info(
            "article_created article_id=%s source_name=%s external_id=%s source_url=%s title=%s",
            created.id,
            created.source_name,
            created.external_id or "",
            created.source_url,
            created.title,
        )
        return ArticleCreateResult(action="created", article=created)

    def list_articles(
        self,
        *,
        limit: int = 50,
        status: Optional[str] = None,
        visibility: Optional[str] = None,
        topic: Optional[str] = None,
        source_name: Optional[str] = None,
        content_type: Optional[str] = None,
        source_type: Optional[str] = None,
        author_id: Optional[str] = None,
        author_name: Optional[str] = None,
    ) -> list[Article]:
        return self._repository.list_articles(
            limit=limit,
            status=status,
            visibility=visibility,
            topic=topic,
            source_name=source_name,
            content_type=content_type,
            source_type=source_type,
            author_id=author_id,
            author_name=author_name,
        )

    def list_public_articles(
        self,
        *,
        limit: int = 50,
        topic: Optional[str] = None,
        source_name: Optional[str] = None,
        content_type: Optional[str] = None,
    ) -> list[Article]:
        items: list[Article] = []
        for status in PUBLIC_ARTICLE_STATUSES:
            items.extend(
                self.list_articles(
                    limit=limit,
                    status=status,
                    visibility="public",
                    topic=topic,
                    source_name=source_name,
                    content_type=content_type,
                )
            )
        return _dedupe_and_sort_articles(items)[:limit]

    def list_user_articles(
        self,
        *,
        author_id: str,
        author_name: Optional[str] = None,
        limit: int = 50,
        status: Optional[str] = None,
    ) -> list[Article]:
        items = self.list_articles(
            limit=limit,
            status=status,
            author_id=author_id,
        )
        if author_name and author_name != author_id:
            items.extend(
                self.list_articles(
                    limit=limit,
                    status=status,
                    author_name=author_name,
                )
            )
        return _dedupe_and_sort_articles(items)[:limit]

    def get_article(self, article_id: str) -> Optional[Article]:
        return self._repository.get_article_by_id(article_id)

    def update_article(
        self,
        article_id: str,
        *,
        status: Optional[str] = None,
        visibility: Optional[str] = None,
    ) -> Optional[Article]:
        existing = self.get_article(article_id)
        if existing is None:
            return None

        fields = {}
        if status is not None:
            normalized_status = _normalize_status(status)
            fields["status"] = normalized_status
            if normalized_status in PUBLIC_ARTICLE_STATUSES and existing.published_at is None:
                fields["published_at"] = datetime.now(timezone.utc)
        if visibility is not None:
            fields["visibility"] = _normalize_visibility(visibility)

        if not fields:
            return existing
        return self._repository.update_article_fields(article_id, fields)

    def delete_article(self, article_id: str) -> Optional[Article]:
        deleted = self._repository.delete_article(article_id)
        if deleted is not None:
            logger.info(
                "article_deleted article_id=%s source_name=%s external_id=%s source_url=%s title=%s",
                deleted.id,
                deleted.source_name,
                deleted.external_id or "",
                deleted.source_url,
                deleted.title,
            )
        return deleted
