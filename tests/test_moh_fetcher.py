from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backend.app.models.article import Article
from backend.app.services.article_service import ArticleCreateResult
from backend.app.services.moh_fetcher import (
    MOH_HOME_URL,
    MOH_LISTING_API_URL,
    MOH_SOURCE_NAME,
    MohFetcher,
    MohListingItem,
    map_moh_api_detail_to_article_request,
    parse_moh_featured_api_items,
)


LISTING_PAYLOAD = [
    {
        "MA": "8358",
        "TEN_MUC": "Tin noi bat (Tin tuc - su kien)",
        "ITEMS": [
            {
                "MA": "167411",
                "TIEU_DE": "Bo Y te article 1",
                "MO_TA": "Listing summary 1",
                "MA_DANH_MUC": "8351;8358",
                "THOI_GIAN_XUAT_BAN": "29/04/2026 08:30 AM",
                "DUONG_DAN_ANH": "/CustomsCMS/BO_YTE/2026/4/29/thumb-1.png",
            },
            {
                "MA": "167409",
                "TIEU_DE": "Bo Y te article 2",
                "MO_TA": "Listing summary 2",
                "MA_DANH_MUC": "8358",
                "THOI_GIAN_XUAT_BAN": "29/04/2026 07:15 AM",
                "DUONG_DAN_ANH": "/CustomsCMS/BO_YTE/2026/4/29/thumb-2.jpg",
            },
            {
                "MA": "167408",
                "TIEU_DE": "Should not exceed limit",
                "DUONG_DAN_ANH": "/CustomsCMS/BO_YTE/2026/4/29/thumb-3.jpg",
            },
        ],
    }
]


DETAIL_PAYLOAD = {
    "d": {
        "ma": "167411",
        "tieuDe": "Detail title from MOH",
        "moTa": "Detail summary from MOH",
        "thoiGianBatDauDang": "29/04/2026 08:30 AM",
        "noiDung": """
            <p>Main MOH article content long enough for article ingestion.</p>
            <p>Second paragraph with public health information.</p>
            <img src="/resource/CustomsCMS/ckeditor/images/detail.png" />
        """,
    }
}


class FakeResponse:
    def __init__(self, text="", json_data=None, url="https://moh.gov.vn/test"):
        self.text = text
        self._json_data = json_data
        self.status_code = 200
        self.url = url
        self.content = text.encode("utf-8") if text else b"{}"

    def json(self):
        return self._json_data

    def raise_for_status(self):
        return None


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
            image_url=payload.image_url,
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
                dedup_matched_by="source_name+source_url",
            )
        return ArticleCreateResult(action="created", article=article)


def test_parse_moh_featured_api_items_uses_featured_category_and_limit():
    items = parse_moh_featured_api_items(
        LISTING_PAYLOAD,
        base_url=MOH_HOME_URL,
        limit=2,
    )

    assert len(items) == 2
    assert items[0].title == "Bo Y te article 1"
    assert items[0].external_id == "167411"
    assert items[0].category_id == "8358"
    assert items[0].source_url == "https://moh.gov.vn/index.jsp?pageId=5803&aid=167411&cid=8358"
    assert items[0].thumbnail_url == "https://moh.gov.vn/resource/CustomsCMS/BO_YTE/2026/4/29/thumb-1.png"
    assert items[0].published_at.year == 2026
    assert items[1].source_url == "https://moh.gov.vn/index.jsp?pageId=5803&aid=167409&cid=8358"


def test_map_moh_api_detail_to_article_request_normalizes_article_schema():
    listing_item = MohListingItem(
        title="Listing title",
        source_url="https://moh.gov.vn/index.jsp?pageId=5803&aid=167411&cid=8358",
        thumbnail_url="https://moh.gov.vn/resource/CustomsCMS/BO_YTE/2026/4/29/thumb-1.png",
        summary="Listing summary",
        external_id="167411",
        category_id="8358",
    )

    payload = map_moh_api_detail_to_article_request(
        DETAIL_PAYLOAD,
        listing_item=listing_item,
        topic="health",
        tags=["official"],
    )

    assert payload.source_name == MOH_SOURCE_NAME
    assert payload.content_type == "news"
    assert payload.source_type == "external_news"
    assert payload.status == "active"
    assert payload.visibility == "public"
    assert payload.external_id == "moh:167411"
    assert payload.source_url == "https://moh.gov.vn/index.jsp?pageId=5803&aid=167411&cid=8358"
    assert payload.image_url == "https://moh.gov.vn/resource/CustomsCMS/BO_YTE/2026/4/29/thumb-1.png"
    assert payload.title == "Detail title from MOH"
    assert payload.summary == "Detail summary from MOH"
    assert "Main MOH article content" in payload.content
    assert payload.topic == "health"
    assert "official" in payload.tags


def test_moh_fetcher_uses_exact_featured_page_bridge_api_and_article_service_dedup():
    get_calls = []
    post_calls = []

    def fake_get(url, *, headers, timeout):
        get_calls.append({"url": url, "headers": headers, "timeout": timeout})
        return FakeResponse("<html><div id='main'></div></html>", url=url)

    def fake_post(url, *, json, headers, timeout):
        post_calls.append({"url": url, "json": json, "headers": headers, "timeout": timeout})
        if url == MOH_LISTING_API_URL:
            return FakeResponse(json_data=LISTING_PAYLOAD, url=url)
        return FakeResponse(json_data=DETAIL_PAYLOAD, url=url)

    service = FakeArticleService()
    fetcher = MohFetcher(service, http_get=fake_get, http_post=fake_post, timeout_seconds=5)

    result = fetcher.fetch_latest(topic="health", page_size=10, tags=["official"])

    assert result.requested == 2
    assert result.created == 1
    assert result.skipped_duplicate == 1
    assert len(service.received) == 2
    assert get_calls[0]["url"] == MOH_HOME_URL
    assert post_calls[0]["url"] == MOH_LISTING_API_URL
    assert post_calls[0]["json"]["MA_DANH_MUC"] == "8358"
    assert post_calls[0]["json"]["PAGE_SIZE"] == 2
    assert post_calls[1]["json"] == {"maBaiViet": "167411", "maDanhMuc": "8358"}
    assert post_calls[2]["json"] == {"maBaiViet": "167409", "maDanhMuc": "8358"}
    assert service.received[0].image_url == "https://moh.gov.vn/resource/CustomsCMS/BO_YTE/2026/4/29/thumb-1.png"
    assert result.items[0].action == "created"
    assert result.items[1].action == "skipped_duplicate"
    assert result.items[1].dedup_matched_by == "source_name+source_url"
