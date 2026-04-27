from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backend.app.models.article import Article
from backend.app.schemas.article import ArticleCreateRequest
from backend.app.services.article_service import ArticleService


class FakeArticleRepository:
    def __init__(self):
        self.items: list[Article] = []
        self.external_key_calls: list[dict] = []

    def create_article(self, article: Article) -> Article:
        self.items.append(article)
        return article

    def get_article_by_external_key(self, *, source_name=None, external_id=None, source_url=None):
        self.external_key_calls.append(
            {"source_name": source_name, "external_id": external_id, "source_url": source_url}
        )
        return self.get_article_by_source_and_external_id(
            source_name=source_name,
            external_id=external_id,
        ) or self.get_article_by_source_and_url(
            source_name=source_name,
            source_url=source_url,
        )

    def get_article_by_source_and_external_id(self, *, source_name=None, external_id=None):
        for item in self.items:
            if source_name and external_id and item.source_name == source_name and item.external_id == external_id:
                return item
        return None

    def get_article_by_source_and_url(self, *, source_name=None, source_url=None):
        for item in self.items:
            if source_name and source_url and item.source_name == source_name and item.source_url == source_url:
                return item
        return None

    def get_article_by_title_and_published_at(self, *, title=None, published_at=None):
        for item in self.items:
            if title and published_at and item.title == title and item.published_at == published_at:
                return item
        return None

    def get_article_by_content_hash(self, content_hash=None):
        for item in self.items:
            if content_hash and item.content_hash == content_hash:
                return item
        return None

    def list_articles(self, **kwargs):
        return list(self.items)


def _payload(**overrides):
    data = {
        "title": "News item",
        "summary": "Short summary",
        "content": "Full content",
        "content_type": "news",
        "source_type": "external_news",
        "source_name": "Example News",
        "source_url": "https://example.com/article?utm_source=x",
        "external_id": "news-1",
        "topic": "general",
        "tags": ["ai", "news"],
        "status": "active",
        "visibility": "public",
    }
    data.update(overrides)
    return ArticleCreateRequest(**data)


def test_article_service_creates_article_with_canonical_source_url():
    repo = FakeArticleRepository()
    service = ArticleService(repo)

    result = service.create_article(_payload())

    assert result.action == "created"
    assert result.article.external_id == "news-1"
    assert result.article.source_url == "https://example.com/article"
    assert result.article.content_hash
    assert len(repo.items) == 1


def test_article_service_skips_duplicate_by_external_id_first():
    repo = FakeArticleRepository()
    service = ArticleService(repo)

    first = service.create_article(_payload(source_url="https://example.com/a")).article
    result = service.create_article(_payload(source_url="https://example.com/b"))

    assert result.action == "skipped_duplicate"
    assert result.article.id == first.id
    assert result.dedup_matched_by == "source_name+external_id"


def test_article_service_dedups_by_source_url_when_external_id_missing():
    repo = FakeArticleRepository()
    service = ArticleService(repo)

    first = service.create_article(_payload(external_id=None)).article
    result = service.create_article(_payload(external_id=None))

    assert result.action == "skipped_duplicate"
    assert result.article.id == first.id
    assert result.dedup_matched_by == "source_name+source_url"
