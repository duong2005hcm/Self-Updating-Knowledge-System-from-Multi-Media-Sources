from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from backend.app.models.article import Article
from backend.app.repositories.article_repository import ArticleRepository
from backend.app.services.checksum_service import checksum_text


@dataclass(frozen=True)
class ArticleDedupCandidate:
    source_name: str
    external_id: Optional[str]
    source_url: str
    title: str
    published_at: Optional[datetime]
    content: str
    content_hash: str


@dataclass(frozen=True)
class ArticleDedupResult:
    duplicate: Optional[Article]
    matched_by: Optional[str]
    content_hash: str

    @property
    def is_duplicate(self) -> bool:
        return self.duplicate is not None


class ArticleDedupService:
    """Dedup logic shared by all future external article fetchers."""

    def __init__(self, repository: ArticleRepository):
        self._repository = repository

    def check_duplicate(self, candidate: ArticleDedupCandidate) -> ArticleDedupResult:
        source_name = (candidate.source_name or "").strip()
        external_id = (candidate.external_id or "").strip() or None

        if source_name and external_id:
            article = self._repository.get_article_by_source_and_external_id(
                source_name=source_name,
                external_id=external_id,
            )
            if article is not None:
                return ArticleDedupResult(article, "source_name+external_id", candidate.content_hash)

        source_url = (candidate.source_url or "").strip()
        if source_name and source_url:
            article = self._repository.get_article_by_source_and_url(
                source_name=source_name,
                source_url=source_url,
            )
            if article is not None:
                return ArticleDedupResult(article, "source_name+source_url", candidate.content_hash)

        title = (candidate.title or "").strip()
        if title and candidate.published_at is not None:
            article = self._repository.get_article_by_title_and_published_at(
                title=title,
                published_at=candidate.published_at,
            )
            if article is not None:
                return ArticleDedupResult(article, "title+published_at", candidate.content_hash)

        article = self._repository.get_article_by_content_hash(candidate.content_hash)
        if article is not None:
            return ArticleDedupResult(article, "content_hash", candidate.content_hash)

        return ArticleDedupResult(None, None, candidate.content_hash)


def build_article_content_hash(content: str) -> str:
    return checksum_text(content or "")
