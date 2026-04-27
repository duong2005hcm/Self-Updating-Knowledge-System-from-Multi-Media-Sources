from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backend.app.api.admin_articles import get_admin_external_news_ingest_service, router
from backend.app.api.dependencies.admin_auth import verify_admin_token
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


def _build_client(fake_service: FakeExternalNewsIngestService) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[verify_admin_token] = lambda: {"uid": "admin"}
    app.dependency_overrides[get_admin_external_news_ingest_service] = lambda: fake_service
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
