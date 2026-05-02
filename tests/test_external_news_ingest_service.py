from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backend.app.services.external_news_ingest_service import ExternalNewsIngestService


@dataclass(frozen=True)
class FakeItem:
    action: str
    article_id: str
    title: str
    source_url: str
    external_id: Optional[str]
    dedup_matched_by: Optional[str] = None


@dataclass(frozen=True)
class FakeFetchResult:
    requested: int
    created: int
    skipped_duplicate: int
    items: list[FakeItem]


class FakeFetcher:
    def __init__(self, name: str, *, fail: bool = False):
        self.name = name
        self.fail = fail
        self.calls = []

    def fetch_latest(self, **kwargs):
        self.calls.append(kwargs)
        if self.fail:
            raise RuntimeError(f"{self.name} failed")
        return FakeFetchResult(
            requested=kwargs.get("page_size", 2),
            created=1,
            skipped_duplicate=1,
            items=[
                FakeItem(
                    action="created",
                    article_id=f"art_{self.name}_1",
                    title=f"{self.name} title 1",
                    source_url=f"https://example.com/{self.name}/1",
                    external_id=f"{self.name}:1",
                ),
                FakeItem(
                    action="skipped_duplicate",
                    article_id=f"art_{self.name}_2",
                    title=f"{self.name} title 2",
                    source_url=f"https://example.com/{self.name}/2",
                    external_id=f"{self.name}:2",
                    dedup_matched_by="source_name+external_id",
                ),
            ],
        )


def test_external_news_ingest_runs_all_sources_and_caps_limit():
    pubmed = FakeFetcher("pubmed")
    europe = FakeFetcher("europe")
    moh = FakeFetcher("moh")
    service = ExternalNewsIngestService(
        article_service=None,
        pubmed_fetcher=pubmed,
        europe_pmc_fetcher=europe,
        moh_fetcher=moh,
    )

    result = service.ingest(
        source_name="all",
        limit_per_source=10,
        query="public health",
        topic="health",
        tags=["manual"],
    )

    assert result.limit_per_source == 2
    assert result.created_count == 3
    assert result.skipped_count == 3
    assert result.failed_count == 0
    assert len(result.items) == 6
    assert [source.source_key for source in result.sources] == ["pubmed", "europe_pmc", "moh"]
    assert pubmed.calls[0]["query"] == "public health"
    assert pubmed.calls[0]["page_size"] == 2
    assert europe.calls[0]["query"] == "public health"
    assert moh.calls[0]["page_size"] == 2
    assert "query" not in moh.calls[0]


def test_external_news_ingest_can_filter_single_source():
    pubmed = FakeFetcher("pubmed")
    europe = FakeFetcher("europe")
    moh = FakeFetcher("moh")
    service = ExternalNewsIngestService(
        article_service=None,
        pubmed_fetcher=pubmed,
        europe_pmc_fetcher=europe,
        moh_fetcher=moh,
    )

    result = service.ingest(source_name="Europe PMC", limit_per_source=1)

    assert result.source_name == "europe_pmc"
    assert len(result.sources) == 1
    assert result.sources[0].source_key == "europe_pmc"
    assert not pubmed.calls
    assert europe.calls[0]["page_size"] == 1
    assert not moh.calls


def test_external_news_ingest_reports_source_failure_without_aborting_others():
    pubmed = FakeFetcher("pubmed")
    europe = FakeFetcher("europe", fail=True)
    moh = FakeFetcher("moh")
    service = ExternalNewsIngestService(
        article_service=None,
        pubmed_fetcher=pubmed,
        europe_pmc_fetcher=europe,
        moh_fetcher=moh,
    )

    result = service.ingest(source_name="all", limit_per_source=2)

    assert result.created_count == 2
    assert result.skipped_count == 2
    assert result.failed_count == 1
    failed = [source for source in result.sources if source.failed_count == 1]
    assert len(failed) == 1
    assert failed[0].source_key == "europe_pmc"
    assert "failed" in failed[0].error
