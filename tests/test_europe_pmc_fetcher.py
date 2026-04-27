from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backend.app.models.article import Article
from backend.app.services.article_service import ArticleCreateResult
from backend.app.services.europe_pmc_fetcher import (
    EUROPE_PMC_SEARCH_URL,
    EUROPE_PMC_SOURCE_NAME,
    EuropePmcFetcher,
)


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class FakeArticleService:
    def __init__(self):
        self.received = []

    def create_article(self, payload):
        self.received.append(payload)
        article = Article.create(
            title=payload.title,
            summary=payload.summary,
            content=payload.content,
            source_name=payload.source_name,
            source_url=payload.source_url,
            external_id=payload.external_id,
            published_at=payload.published_at,
            topic=payload.topic,
            tags=payload.tags,
            status=payload.status,
            visibility=payload.visibility,
        )
        if len(self.received) == 2:
            return ArticleCreateResult(
                action="skipped_duplicate",
                article=article,
                dedup_matched_by="source_name+external_id",
            )
        return ArticleCreateResult(action="created", article=article)


def test_europe_pmc_fetcher_maps_latest_results_and_uses_small_page_size():
    calls = []

    def fake_get(url, *, params, timeout):
        calls.append({"url": url, "params": params, "timeout": timeout})
        return FakeResponse(
            {
                "resultList": {
                    "result": [
                        {
                            "source": "MED",
                            "id": "123",
                            "title": "First article",
                            "abstractText": "First abstract",
                            "firstPublicationDate": "2026-04-20",
                            "journalTitle": "Journal A",
                        },
                        {
                            "source": "PMC",
                            "id": "PMC456",
                            "title": "Second article",
                            "abstractText": "Second abstract",
                            "firstPublicationDate": "2026",
                            "journalTitle": "Journal B",
                        },
                        {
                            "source": "MED",
                            "id": "789",
                            "title": "Should not ingest",
                            "abstractText": "Too many",
                        },
                    ]
                }
            }
        )

    service = FakeArticleService()
    fetcher = EuropePmcFetcher(service, http_get=fake_get, timeout_seconds=5)

    result = fetcher.fetch_latest(
        query="aviation medicine",
        topic="health",
        page_size=10,
        tags=["external"],
    )

    assert calls == [
        {
            "url": EUROPE_PMC_SEARCH_URL,
            "params": {
                "query": "aviation medicine",
                "format": "json",
                "resultType": "core",
                "pageSize": 2,
                "sort": "P_PDATE_D",
            },
            "timeout": 5,
        }
    ]
    assert result.requested == 2
    assert result.created == 1
    assert result.skipped_duplicate == 1
    assert len(service.received) == 2

    first_payload = service.received[0]
    assert first_payload.source_name == EUROPE_PMC_SOURCE_NAME
    assert first_payload.external_id == "MED:123"
    assert first_payload.source_url == "https://europepmc.org/article/MED/123"
    assert first_payload.summary == "First abstract"
    assert first_payload.content == "First abstract"
    assert first_payload.published_at.year == 2026
    assert first_payload.topic == "health"
    assert first_payload.tags == ["health", "aviation medicine", "MED", "Journal A", "external"]

    assert result.items[0].action == "created"
    assert result.items[1].action == "skipped_duplicate"
    assert result.items[1].dedup_matched_by == "source_name+external_id"


def test_europe_pmc_fetcher_uses_title_when_abstract_missing():
    def fake_get(url, *, params, timeout):
        return FakeResponse(
            {
                "resultList": {
                    "result": [
                        {
                            "source": "MED",
                            "id": "999",
                            "title": "Title only article",
                        }
                    ]
                }
            }
        )

    service = FakeArticleService()
    fetcher = EuropePmcFetcher(service, http_get=fake_get)

    result = fetcher.fetch_latest(query="  ", topic="", page_size=1)

    assert result.query == "medicine"
    assert result.topic == "medicine"
    assert result.created == 1
    assert service.received[0].summary == ""
    assert service.received[0].content == "Title only article"
