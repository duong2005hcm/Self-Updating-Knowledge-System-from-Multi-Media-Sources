from __future__ import annotations

from dataclasses import dataclass
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
            external_id=external_id,
            content_hash=content_hash,
            published_at=payload.published_at,
            topic=(payload.topic or "").strip() or "general",
            tags=[tag.strip() for tag in payload.tags if tag and tag.strip()],
            status=_normalize_status(payload.status),
            visibility=_normalize_visibility(payload.visibility),
        )
        created = self._repository.create_article(article)
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
    ) -> list[Article]:
        return self._repository.list_articles(
            limit=limit,
            status=status,
            visibility=visibility,
            topic=topic,
            source_name=source_name,
            content_type=content_type,
        )
