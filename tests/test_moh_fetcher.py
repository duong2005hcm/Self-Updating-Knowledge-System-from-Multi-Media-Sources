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
    MOH_SOURCE_NAME,
    MohFetcher,
    MohListingItem,
    map_moh_detail_to_article_request,
    parse_moh_featured_items,
)


LISTING_HTML = """
<html>
  <body>
    <div id="featured">
      <h2>Tin nổi bật</h2>
      <ul>
        <li class="news-item">
          <img src="/thumb-1.jpg" />
          <a href="/tin-noi-bat/bai-viet-1.html">Bài viết Bộ Y tế số 1</a>
          <span class="date">25/04/2026 08:30</span>
        </li>
        <li class="news-item">
          <a href="https://moh.gov.vn/tin-noi-bat/bai-viet-2.html">Bài viết Bộ Y tế số 2</a>
          <span class="date">24/04/2026</span>
        </li>
        <li class="news-item">
          <a href="/tin-noi-bat/bai-viet-3.html">Không được lấy quá limit</a>
        </li>
      </ul>
    </div>
  </body>
</html>
"""


DETAIL_HTML = """
<html>
  <head>
    <meta property="og:title" content="Tiêu đề detail Bộ Y tế" />
    <meta name="description" content="Tóm tắt bài viết Bộ Y tế" />
    <meta property="article:published_time" content="2026-04-25T08:30:00+07:00" />
    <meta property="og:image" content="/detail-thumb.jpg" />
  </head>
  <body>
    <article>
      <h1>Tiêu đề detail Bộ Y tế</h1>
      <p>Nội dung chính của bài viết Bộ Y tế đủ dài để parser xem là nội dung hợp lệ.</p>
      <p>Đoạn thứ hai bổ sung thêm thông tin y tế, chỉ dùng cho article Firestore.</p>
    </article>
  </body>
</html>
"""


class FakeResponse:
    def __init__(self, text):
        self.text = text

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


def test_parse_moh_featured_items_uses_featured_block_and_limit():
    items = parse_moh_featured_items(
        LISTING_HTML,
        base_url="https://moh.gov.vn/",
        limit=2,
    )

    assert len(items) == 2
    assert items[0].title == "Bài viết Bộ Y tế số 1"
    assert items[0].source_url == "https://moh.gov.vn/tin-noi-bat/bai-viet-1.html"
    assert items[0].thumbnail_url == "https://moh.gov.vn/thumb-1.jpg"
    assert items[0].published_at.year == 2026
    assert items[1].source_url == "https://moh.gov.vn/tin-noi-bat/bai-viet-2.html"


def test_map_moh_detail_to_article_request_normalizes_article_schema():
    listing_item = MohListingItem(
        title="Listing title",
        source_url="https://moh.gov.vn/tin-noi-bat/bai-viet-1.html",
    )

    payload = map_moh_detail_to_article_request(
        DETAIL_HTML,
        listing_item=listing_item,
        topic="health",
        tags=["official"],
    )

    assert payload.source_name == MOH_SOURCE_NAME
    assert payload.content_type == "news"
    assert payload.source_type == "external_news"
    assert payload.status == "active"
    assert payload.visibility == "public"
    assert payload.external_id.startswith("moh:")
    assert payload.title == "Tiêu đề detail Bộ Y tế"
    assert payload.summary == "Tóm tắt bài viết Bộ Y tế"
    assert "Nội dung chính" in payload.content
    assert payload.topic == "health"
    assert payload.tags == ["health", "Bộ Y tế", "Tin nổi bật", "Tin tức - sự kiện", "official"]


def test_moh_fetcher_fetches_details_and_uses_article_service_dedup():
    calls = []

    def fake_get(url, *, headers, timeout):
        calls.append({"url": url, "headers": headers, "timeout": timeout})
        if url == "https://moh.gov.vn/":
            return FakeResponse(LISTING_HTML)
        return FakeResponse(DETAIL_HTML)

    service = FakeArticleService()
    fetcher = MohFetcher(service, http_get=fake_get, timeout_seconds=5)

    result = fetcher.fetch_latest(topic="health", page_size=10, tags=["official"])

    assert result.requested == 2
    assert result.created == 1
    assert result.skipped_duplicate == 1
    assert len(service.received) == 2
    assert calls[0]["url"] == "https://moh.gov.vn/"
    assert calls[1]["url"] == "https://moh.gov.vn/tin-noi-bat/bai-viet-1.html"
    assert calls[2]["url"] == "https://moh.gov.vn/tin-noi-bat/bai-viet-2.html"
    assert result.items[0].action == "created"
    assert result.items[1].action == "skipped_duplicate"
    assert result.items[1].dedup_matched_by == "source_name+source_url"
