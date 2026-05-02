from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backend.app.api.admin_articles import (
    get_admin_article_service,
    get_admin_external_news_ingest_service,
    router,
)
from backend.app.api.dependencies.admin_auth import verify_admin_token
from backend.app.models.article import Article
from backend.app.services.external_news_ingest_service import (
    ExternalNewsIngestItem,
    ExternalNewsIngestResult,
    ExternalNewsSourceResult,
)


class FakeExternalNewsIngestService:
    def __init__(self):
        self.calls = []

    def ingest(self, **kwargs):
        self.calls.append(kwargs)
        return ExternalNewsIngestResult(
            source_name=kwargs["source_name"],
            limit_per_source=kwargs["limit_per_source"],
            created_count=1,
            skipped_count=1,
            failed_count=0,
            items=[
                ExternalNewsIngestItem(
                    source_name="Europe PMC",
                    action="created",
                    article_id="art_1",
                    title="Article 1",
                    source_url="https://example.com/1",
                    external_id="europe:1",
                    dedup_matched_by=None,
                ),
                ExternalNewsIngestItem(
                    source_name="Europe PMC",
                    action="skipped_duplicate",
                    article_id="art_2",
                    title="Article 2",
                    source_url="https://example.com/2",
                    external_id="europe:2",
                    dedup_matched_by="source_name+external_id",
                ),
            ],
            sources=[
                ExternalNewsSourceResult(
                    source_key="europe_pmc",
                    source_name="Europe PMC",
                    requested=2,
                    created_count=1,
                    skipped_count=1,
                    failed_count=0,
                    error=None,
                )
            ],
        )


class FakeAdminArticleService:
    def __init__(self):
        self.article = Article.create(
            article_id="art_1",
            title="Community article",
            summary="Pending summary",
            content="Pending content",
            source_name="Cộng đồng",
            source_url="https://example.com/community-article",
            source_type="community",
            author_id="user_1",
            author_name="user@example.com",
            topic="Phòng bệnh",
            tags=["phòng bệnh"],
            status="pending",
            visibility="public",
        )
        self.list_calls = []
        self.update_calls = []
        self.delete_calls = []

    def list_articles(self, **kwargs):
        self.list_calls.append(kwargs)
        return [self.article]

    def update_article(self, article_id, **kwargs):
        self.update_calls.append({"article_id": article_id, **kwargs})
        if article_id != self.article.id:
            return None
        data = self.article.model_dump() if hasattr(self.article, "model_dump") else self.article.dict()
        data.update({key: value for key, value in kwargs.items() if value is not None})
        self.article = Article(**data)
        return self.article

    def delete_article(self, article_id):
        self.delete_calls.append(article_id)
        if article_id != self.article.id:
            return None
        deleted = self.article
        self.article = None
        return deleted


def _build_client(
    fake_service: FakeExternalNewsIngestService,
    fake_article_service: FakeAdminArticleService | None = None,
) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[verify_admin_token] = lambda: {"uid": "admin"}
    app.dependency_overrides[get_admin_external_news_ingest_service] = lambda: fake_service
    if fake_article_service is not None:
        app.dependency_overrides[get_admin_article_service] = lambda: fake_article_service
    return TestClient(app)


def test_admin_articles_ingest_route_calls_orchestrator():
    fake_service = FakeExternalNewsIngestService()
    client = _build_client(fake_service)

    response = client.post(
        "/api/admin/articles/ingest",
        json={
            "source_name": "europe_pmc",
            "limit_per_source": 2,
            "query": "public health",
            "topic": "health",
            "tags": ["manual"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["created_count"] == 1
    assert body["skipped_count"] == 1
    assert body["items"][0]["action"] == "created"
    assert body["items"][1]["dedup_matched_by"] == "source_name+external_id"
    assert fake_service.calls == [
        {
            "source_name": "europe_pmc",
            "limit_per_source": 2,
            "query": "public health",
            "topic": "health",
            "tags": ["manual"],
        }
    ]


def test_admin_articles_list_route_supports_pending_filter():
    fake_article_service = FakeAdminArticleService()
    client = _build_client(FakeExternalNewsIngestService(), fake_article_service)

    response = client.get("/api/admin/articles?status=pending")

    assert response.status_code == 200
    body = response.json()
    assert body["items"][0]["status"] == "pending"
    assert fake_article_service.list_calls[0]["status"] == "pending"


def test_admin_articles_approve_route_publishes_article():
    fake_article_service = FakeAdminArticleService()
    client = _build_client(FakeExternalNewsIngestService(), fake_article_service)

    response = client.patch(
        "/api/admin/articles/art_1/approve",
        json={"status": "published"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["action"] == "approved"
    assert body["item"]["status"] == "published"
    assert body["item"]["visibility"] == "public"
    assert fake_article_service.update_calls == [
        {"article_id": "art_1", "status": "published", "visibility": "public"}
    ]


def test_admin_articles_delete_route_hard_deletes_article():
    fake_article_service = FakeAdminArticleService()
    client = _build_client(FakeExternalNewsIngestService(), fake_article_service)

    response = client.delete("/api/admin/articles/art_1")

    assert response.status_code == 200
    body = response.json()
    assert body["action"] == "deleted"
    assert body["item"]["id"] == "art_1"
    assert fake_article_service.delete_calls == ["art_1"]
