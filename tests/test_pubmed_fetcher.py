from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backend.app.models.article import Article
from backend.app.services.article_service import ArticleCreateResult
from backend.app.services.pubmed_fetcher import PUBMED_SEARCH_URL, PUBMED_SOURCE_NAME, PubMedFetcher


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload
        self.content = b"{}"
        self.status_code = 200
        self.url = "https://example.test"

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class FakeArticleService:
    def __init__(self):
        self.received = []

    def create_article(self, payload):
        self.received.append(payload)
        return ArticleCreateResult(
            action="created",
            article=Article.create(
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
            ),
        )


def test_pubmed_fetcher_uses_pub_date_sort_and_maps_summaries():
    calls = []

    def fake_get(url, *, params, timeout):
        calls.append({"url": url, "params": params, "timeout": timeout})
        if url == PUBMED_SEARCH_URL:
            return FakeResponse({"esearchresult": {"idlist": ["123"]}})
        return FakeResponse(
            {
                "result": {
                    "uids": ["123"],
                    "123": {
                        "uid": "123",
                        "title": "PubMed article",
                        "fulljournalname": "Journal A",
                        "pubdate": "2026 Apr 20",
                    },
                }
            }
        )

    service = FakeArticleService()
    fetcher = PubMedFetcher(service, http_get=fake_get, timeout_seconds=5)

    result = fetcher.fetch_latest(query="medicine", topic="health", page_size=2)

    assert calls[0]["params"]["sort"] == "pub date"
    assert result.created == 1
    assert service.received[0].source_name == PUBMED_SOURCE_NAME
    assert service.received[0].external_id == "pubmed:123"
    assert service.received[0].title == "PubMed article"
