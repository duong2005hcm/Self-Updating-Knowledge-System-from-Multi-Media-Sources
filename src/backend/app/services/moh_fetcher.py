from __future__ import annotations

import hashlib
import logging
import os
import re
import ssl
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Optional
from urllib.parse import parse_qs, urlencode, urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter

from backend.app.config.runtime_network import should_trust_external_news_proxy
from backend.app.schemas.article import ArticleCreateRequest
from backend.app.services.article_service import ArticleCreateResult, ArticleService

MOH_HOME_URL = os.getenv("MOH_HOME_URL", "https://moh.gov.vn/index.jsp?pageId=5801&cid=8358")
MOH_LISTING_API_URL = os.getenv(
    "MOH_LISTING_API_URL",
    "https://moh.gov.vn/bridge?url=/portal/api/lay_bai_viet_theo_danh_muc",
)
MOH_DETAIL_API_URL = os.getenv(
    "MOH_DETAIL_API_URL",
    "https://moh.gov.vn/bridge?url=/portal/api/layChiTietBaiViet",
)
MOH_DETAIL_PAGE_ID = os.getenv("MOH_DETAIL_PAGE_ID", "5803")
MOH_FEATURED_CATEGORY_ID = os.getenv("MOH_FEATURED_CATEGORY_ID", "8358")
MOH_PAGE_TYPE = os.getenv("MOH_PAGE_TYPE", "BO_YTE")
MOH_LANGUAGE = os.getenv("MOH_LANGUAGE", "TIENG_VIET")
MOH_ORIGIN_URL = os.getenv("MOH_ORIGIN_URL", "https://moh.gov.vn")
MOH_IMAGE_BASE_URL = os.getenv("MOH_IMAGE_BASE_URL", "https://moh.gov.vn/resource")
MOH_SOURCE_NAME = "B\u1ed9 Y t\u1ebf"

logger = logging.getLogger(__name__)
VIETNAM_TZ = timezone(timedelta(hours=7))


@dataclass(frozen=True)
class MohListingItem:
    title: str
    source_url: str
    published_at: Optional[datetime] = None
    thumbnail_url: Optional[str] = None
    summary: str = ""
    external_id: Optional[str] = None
    category_id: str = MOH_FEATURED_CATEGORY_ID


@dataclass(frozen=True)
class MohFetchItem:
    action: str
    article_id: str
    title: str
    source_url: str
    external_id: Optional[str]
    dedup_matched_by: Optional[str]


@dataclass(frozen=True)
class MohFetchResult:
    topic: str
    requested: int
    created: int
    skipped_duplicate: int
    items: list[MohFetchItem]


class MohFetcher:
    """Fetch the latest small batch from the MOH featured-news block only."""

    def __init__(
        self,
        article_service: ArticleService,
        *,
        http_get: Optional[Callable[..., Any]] = None,
        http_post: Optional[Callable[..., Any]] = None,
        home_url: str = MOH_HOME_URL,
        listing_api_url: str = MOH_LISTING_API_URL,
        detail_api_url: str = MOH_DETAIL_API_URL,
        timeout_seconds: int = 20,
    ):
        self._articles = article_service
        self._http_get = http_get or _build_default_http_get()
        self._http_post = http_post or _build_default_http_post()
        self._home_url = home_url
        self._listing_api_url = listing_api_url
        self._detail_api_url = detail_api_url
        self._timeout_seconds = timeout_seconds

    def fetch_latest(
        self,
        *,
        topic: str = "health",
        page_size: int = 2,
        tags: Optional[list[str]] = None,
    ) -> MohFetchResult:
        normalized_topic = (topic or "").strip() or "health"
        capped_page_size = max(1, min(int(page_size or 2), 2))
        listing_items = self._fetch_featured_listing_items(capped_page_size)

        items: list[MohFetchItem] = []
        created = 0
        skipped_duplicate = 0
        for listing_item in listing_items:
            detail_payload = self._fetch_detail_payload(listing_item)
            article_payload = map_moh_api_detail_to_article_request(
                detail_payload,
                listing_item=listing_item,
                topic=normalized_topic,
                tags=tags or [],
            )
            logger.info(
                "moh_normalized_item source_name=%s external_id=%s source_url=%s title=%s published_at=%s",
                article_payload.source_name,
                article_payload.external_id or "",
                article_payload.source_url,
                article_payload.title,
                article_payload.published_at.isoformat() if article_payload.published_at else "",
            )
            create_result = self._articles.create_article(article_payload)
            logger.info(
                "moh_dedup_result action=%s matched_by=%s external_id=%s source_url=%s title=%s",
                create_result.action,
                create_result.dedup_matched_by or "",
                article_payload.external_id or "",
                article_payload.source_url,
                article_payload.title,
            )
            if create_result.action == "created":
                created += 1
            elif create_result.action == "skipped_duplicate":
                skipped_duplicate += 1

            items.append(_to_fetch_item(create_result))

        return MohFetchResult(
            topic=normalized_topic,
            requested=capped_page_size,
            created=created,
            skipped_duplicate=skipped_duplicate,
            items=items,
        )

    def _fetch_featured_listing_items(self, limit: int) -> list[MohListingItem]:
        # The configured page is a JS shell. We fetch it for traceability, then
        # query the same bridge API used by the official page module.
        self._fetch_html(self._home_url, stage="listing_page")
        payload = {
            "CHUYEN_TRANG": MOH_PAGE_TYPE,
            "NGON_NGU": MOH_LANGUAGE,
            "MA_DANH_MUC": MOH_FEATURED_CATEGORY_ID,
            "TYPE": 1,
            "PAGE_SIZE": max(1, min(int(limit or 2), 2)),
            "ISEXTEND": 1,
        }
        raw_payload = self._post_json(self._listing_api_url, payload=payload, stage="listing_api")
        items = parse_moh_featured_api_items(raw_payload, base_url=self._home_url, limit=limit)
        logger.info(
            "moh_listing_parse_result url=%s category_id=%s parsed_count=%s first_title=%s first_thumbnail=%s",
            self._listing_api_url,
            MOH_FEATURED_CATEGORY_ID,
            len(items),
            items[0].title if items else "",
            items[0].thumbnail_url if items else "",
        )
        return items

    def _fetch_detail_payload(self, listing_item: MohListingItem) -> dict[str, Any]:
        if not listing_item.external_id:
            raise ValueError(f"MOH listing item is missing article id: {listing_item.source_url}")
        payload = {
            "maBaiViet": listing_item.external_id,
            "maDanhMuc": listing_item.category_id or MOH_FEATURED_CATEGORY_ID,
        }
        raw_payload = self._post_json(self._detail_api_url, payload=payload, stage="detail_api")
        logger.info(
            "moh_detail_api_parse_result article_id=%s title=%s image=%s",
            listing_item.external_id,
            _clean_text(_get_nested(raw_payload, "d", "tieuDe") or _get_nested(raw_payload, "d", "TIEU_DE")),
            _find_detail_image_url(raw_payload, base_url=listing_item.source_url) or listing_item.thumbnail_url or "",
        )
        return raw_payload

    def _fetch_html(self, url: str, *, stage: str) -> str:
        logger.info("moh_%s_request url=%s", stage, url)
        response = self._http_get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; RAG-AI-MOH-Fetcher/1.0)"},
            timeout=self._timeout_seconds,
        )
        logger.info(
            "moh_%s_response status=%s size=%s url=%s",
            stage,
            getattr(response, "status_code", ""),
            len(getattr(response, "content", b"") or b""),
            getattr(response, "url", url),
        )
        response.raise_for_status()
        return response.text

    def _post_json(self, url: str, *, payload: dict[str, Any], stage: str) -> Any:
        logger.info("moh_%s_request url=%s payload=%s", stage, url, payload)
        response = self._http_post(
            url,
            json=payload,
            headers={
                "Accept": "application/json, text/plain, */*",
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (compatible; RAG-AI-MOH-Fetcher/1.0)",
            },
            timeout=self._timeout_seconds,
        )
        logger.info(
            "moh_%s_response status=%s size=%s url=%s",
            stage,
            getattr(response, "status_code", ""),
            len(getattr(response, "content", b"") or b""),
            getattr(response, "url", url),
        )
        response.raise_for_status()
        try:
            return response.json()
        except ValueError as exc:
            raise ValueError(f"MOH {stage} response is not JSON") from exc


class _LegacyTlsAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        context = ssl.create_default_context()
        # Some official MOH pages reject stricter OpenSSL defaults.
        context.set_ciphers("DEFAULT:@SECLEVEL=1")
        context.check_hostname = False
        kwargs["ssl_context"] = context
        return super().init_poolmanager(*args, **kwargs)


def _build_default_http_get() -> Callable[..., Any]:
    session = requests.Session()
    session.trust_env = should_trust_external_news_proxy()
    session.mount("https://", _LegacyTlsAdapter())
    verify_tls = os.getenv("MOH_FETCH_VERIFY_TLS", "false").strip().lower() not in {
        "0",
        "false",
        "no",
    }

    def _get(url: str, **kwargs):
        kwargs.setdefault("verify", verify_tls)
        return session.get(url, **kwargs)

    return _get


def _build_default_http_post() -> Callable[..., Any]:
    session = requests.Session()
    session.trust_env = should_trust_external_news_proxy()
    session.mount("https://", _LegacyTlsAdapter())
    verify_tls = os.getenv("MOH_FETCH_VERIFY_TLS", "false").strip().lower() not in {
        "0",
        "false",
        "no",
    }

    def _post(url: str, **kwargs):
        kwargs.setdefault("verify", verify_tls)
        return session.post(url, **kwargs)

    return _post


def parse_moh_featured_api_items(
    payload: Any,
    *,
    base_url: str = MOH_HOME_URL,
    limit: int = 2,
) -> list[MohListingItem]:
    category = _extract_featured_category_payload(payload)
    category_name = _clean_text(category.get("TEN_MUC") or category.get("tenMuc"))
    raw_items = category.get("ITEMS") or category.get("items") or []
    if not isinstance(raw_items, list):
        raw_items = []

    logger.info(
        "moh_listing_api_probe category=%s raw_item_count=%s",
        category_name,
        len(raw_items),
    )

    items: list[MohListingItem] = []
    seen_ids: set[str] = set()
    for raw_item in raw_items:
        if not isinstance(raw_item, dict):
            continue
        external_id = _clean_text(raw_item.get("MA") or raw_item.get("ma"))
        title = _clean_text(raw_item.get("TIEU_DE") or raw_item.get("tieuDe"))
        if not external_id or not title or external_id in seen_ids:
            continue

        category_id = _pick_category_id(raw_item.get("MA_DANH_MUC") or raw_item.get("maDanhMuc"))
        source_url = _build_moh_detail_url(external_id, category_id=category_id, base_url=base_url)
        thumbnail_url = _normalize_moh_image_url(
            raw_item.get("DUONG_DAN_ANH") or raw_item.get("duongDanAnh"),
            base_url=base_url,
        )
        items.append(
            MohListingItem(
                title=title,
                source_url=source_url,
                published_at=_parse_datetime(raw_item.get("THOI_GIAN_XUAT_BAN") or raw_item.get("thoiGianXuatBan")),
                thumbnail_url=thumbnail_url,
                summary=_clean_text(raw_item.get("MO_TA") or raw_item.get("moTa")),
                external_id=external_id,
                category_id=category_id,
            )
        )
        seen_ids.add(external_id)
        if len(items) >= max(1, min(int(limit or 2), 2)):
            break

    if not items:
        raise ValueError("Could not parse any MOH featured-news item from bridge API")
    return items


def map_moh_api_detail_to_article_request(
    payload: Any,
    *,
    listing_item: MohListingItem,
    topic: str,
    tags: list[str],
) -> ArticleCreateRequest:
    detail = payload.get("d") if isinstance(payload, dict) else None
    if not isinstance(detail, dict):
        raise ValueError(f"MOH detail response has no detail payload for {listing_item.source_url}")

    title = _clean_text(detail.get("tieuDe") or detail.get("TIEU_DE")) or listing_item.title
    summary = _clean_text(detail.get("moTa") or detail.get("MO_TA")) or listing_item.summary
    content_html = detail.get("noiDung") or detail.get("NOI_DUNG") or ""
    content = _html_to_text(content_html)
    if not content:
        raise ValueError(f"Could not parse article content from MOH detail API: {listing_item.source_url}")

    published_at = (
        _parse_datetime(
            detail.get("thoiGianBatDauDang")
            or detail.get("THOI_GIAN_BAT_DAU_DANG")
            or detail.get("thoiGianXuatBan")
            or detail.get("THOI_GIAN_XUAT_BAN")
        )
        or listing_item.published_at
    )
    image_url = listing_item.thumbnail_url or _find_detail_image_url(payload, base_url=listing_item.source_url)

    mapped_tags = _dedupe_tags(
        [
            topic,
            "B\u1ed9 Y t\u1ebf",
            "Tin n\u1ed5i b\u1eadt",
            "Tin t\u1ee9c - s\u1ef1 ki\u1ec7n",
            *tags,
        ]
    )

    return ArticleCreateRequest(
        title=title,
        summary=(summary or content[:800])[:800],
        content=content,
        content_type="news",
        source_type="external_news",
        source_name=MOH_SOURCE_NAME,
        source_url=_canonical_moh_source_url(listing_item.source_url),
        image_url=image_url,
        external_id=f"moh:{listing_item.external_id}" if listing_item.external_id else _build_external_id(listing_item.source_url),
        published_at=published_at,
        topic=(topic or "").strip() or "health",
        tags=mapped_tags,
        status="active",
        visibility="public",
    )


def _extract_featured_category_payload(payload: Any) -> dict[str, Any]:
    categories = payload if isinstance(payload, list) else [payload]
    for category in categories:
        if not isinstance(category, dict):
            continue
        category_id = _clean_text(category.get("MA") or category.get("ma"))
        category_name = _match_text(category.get("TEN_MUC") or category.get("tenMuc"))
        if category_id == MOH_FEATURED_CATEGORY_ID or "tin noi bat" in category_name:
            return category

    for category in categories:
        if isinstance(category, dict) and isinstance(category.get("ITEMS") or category.get("items"), list):
            return category

    raise ValueError("MOH listing API response does not contain a featured-news category")


def _pick_category_id(value: Any) -> str:
    raw = _clean_text(value)
    if not raw:
        return MOH_FEATURED_CATEGORY_ID
    category_ids = [part.strip() for part in re.split(r"[;,]", raw) if part.strip()]
    if MOH_FEATURED_CATEGORY_ID in category_ids:
        return MOH_FEATURED_CATEGORY_ID
    return category_ids[0] if category_ids else MOH_FEATURED_CATEGORY_ID


def _build_moh_detail_url(article_id: str, *, category_id: str, base_url: str) -> str:
    parsed = urlparse(base_url or MOH_HOME_URL)
    origin = f"{parsed.scheme or 'https'}://{parsed.netloc or urlparse(MOH_ORIGIN_URL).netloc}"
    query = urlencode(
        {
            "pageId": MOH_DETAIL_PAGE_ID,
            "aid": article_id,
            "cid": category_id or MOH_FEATURED_CATEGORY_ID,
        }
    )
    return urlunparse((urlparse(origin).scheme, urlparse(origin).netloc, "/index.jsp", "", query, ""))


def _find_detail_image_url(payload: Any, *, base_url: str) -> Optional[str]:
    detail = payload.get("d") if isinstance(payload, dict) else None
    if not isinstance(detail, dict):
        return None

    for key in ["duongDanAnh", "DUONG_DAN_ANH", "image", "imageUrl", "thumbnail"]:
        image_url = _normalize_moh_image_url(detail.get(key), base_url=base_url)
        if image_url:
            return image_url

    content_html = detail.get("noiDung") or detail.get("NOI_DUNG") or ""
    soup = BeautifulSoup(content_html or "", "html.parser")
    for node in soup.select("meta[property='og:image'], img"):
        raw_url = node.get("content") if node.name == "meta" else node.get("src") or node.get("data-src")
        image_url = _normalize_moh_image_url(raw_url, base_url=base_url)
        if image_url:
            return image_url
    return None


def _html_to_text(html: Any) -> str:
    soup = BeautifulSoup(str(html or ""), "html.parser")
    _remove_noise(soup)
    return _clean_text(soup.get_text(" ", strip=True))


def _get_nested(payload: Any, *keys: str) -> Any:
    current = payload
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current


def parse_moh_featured_items(
    html: str,
    *,
    base_url: str = MOH_HOME_URL,
    limit: int = 2,
) -> list[MohListingItem]:
    soup = BeautifulSoup(html or "", "html.parser")
    text_probe = _match_text(soup.get_text(" ", strip=True))
    logger.info(
        "moh_listing_probe contains_tin_noi_bat=%s featured_nodes=%s active_tab_nodes=%s article_links=%s",
        "tin noi bat" in text_probe,
        len(soup.select("#featured, [id*='featured'], [class*='featured']")),
        len(soup.select(".ui-tabs-panel.active, .ui-tabs-panel[aria-hidden='false']")),
        sum(1 for link in soup.find_all("a", href=True) if _is_moh_article_url(_absolute_url(link.get("href"), base_url=base_url))),
    )
    block = _find_featured_block(soup, base_url=base_url)
    if block is None:
        raise ValueError("Could not find MOH featured-news block in listing HTML")

    items: list[MohListingItem] = []
    seen_urls: set[str] = set()
    raw_link_count = 0
    for link in block.find_all("a", href=True):
        raw_link_count += 1
        title = _clean_text(link.get_text(" ", strip=True) or link.get("title") or link.get("aria-label"))
        source_url = _canonical_moh_source_url(_absolute_url(link.get("href"), base_url=base_url))
        if not title or not _is_moh_article_url(source_url):
            continue
        if _match_text(title) == "tin noi bat" or source_url in seen_urls:
            continue

        container = _nearest_article_container(link)
        thumbnail_url = _extract_thumbnail(container or link, base_url=base_url)
        published_at = _extract_datetime(container) if container is not None else None
        items.append(
            MohListingItem(
                title=title,
                source_url=source_url,
                published_at=published_at,
                thumbnail_url=thumbnail_url,
            )
        )
        seen_urls.add(source_url)
        if len(items) >= max(1, min(int(limit or 2), 2)):
            break

    logger.info(
        "moh_listing_links raw_link_count=%s parsed_count=%s first_title=%s",
        raw_link_count,
        len(items),
        items[0].title if items else "",
    )
    if not items:
        raise ValueError("Could not parse any article link from MOH featured-news block")
    return items


def map_moh_detail_to_article_request(
    html: str,
    *,
    listing_item: MohListingItem,
    topic: str,
    tags: list[str],
) -> ArticleCreateRequest:
    soup = BeautifulSoup(html or "", "html.parser")
    detail_title = _extract_title(soup)
    title = listing_item.title if _is_generic_moh_title(detail_title) else detail_title or listing_item.title
    summary = _extract_summary(soup)
    content = _extract_content(soup)
    if not content:
        raise ValueError(f"Could not parse article content from {listing_item.source_url}")

    published_at = _extract_detail_datetime(soup) or listing_item.published_at
    thumbnail_url = _extract_detail_thumbnail(soup, base_url=listing_item.source_url) or listing_item.thumbnail_url

    mapped_tags = _dedupe_tags(
        [
            topic,
            "B\u1ed9 Y t\u1ebf",
            "Tin n\u1ed5i b\u1eadt",
            "Tin t\u1ee9c - s\u1ef1 ki\u1ec7n",
            *tags,
        ]
    )

    return ArticleCreateRequest(
        title=title,
        summary=summary[:800] if summary else content[:800],
        content=content,
        content_type="news",
        source_type="external_news",
        source_name=MOH_SOURCE_NAME,
        source_url=_canonical_moh_source_url(listing_item.source_url),
        image_url=thumbnail_url,
        external_id=_build_external_id(listing_item.source_url),
        published_at=published_at,
        topic=(topic or "").strip() or "health",
        tags=mapped_tags,
        status="active",
        visibility="public",
    )


def _find_featured_block(soup: BeautifulSoup, *, base_url: str):
    selectors = [
        "#featured",
        ".ui-tabs-panel.active",
        ".ui-tabs-panel[aria-hidden='false']",
        "[id*='featured']",
        "[class*='featured']",
    ]
    for selector in selectors:
        for node in soup.select(selector):
            if _node_has_article_link(node, base_url=base_url):
                return node

    for heading in soup.find_all(string=lambda value: bool(value and "tin noi bat" in _match_text(value))):
        parent = heading.parent
        while parent is not None:
            if _node_has_article_link(parent, base_url=base_url):
                return parent
            parent = parent.parent

    containers = soup.select(
        ".portlet-body, .portlet, .portlet-boundary, [class*='asset'], [class*='news'], [class*='featured']"
    )
    for node in containers:
        if "tin noi bat" in _match_text(node.get_text(" ", strip=True)) and _node_has_article_link(node, base_url=base_url):
            return node

    return None


def _node_has_article_link(node, *, base_url: str) -> bool:
    for link in node.find_all("a", href=True):
        source_url = _absolute_url(link.get("href"), base_url=base_url)
        if _is_moh_article_url(source_url):
            return True
    return False


def _nearest_article_container(link):
    current = link
    for _ in range(5):
        current = current.parent
        if current is None:
            return None
        if current.name in {"li", "article"}:
            return current
        class_text = " ".join(current.get("class", [])).lower()
        if any(token in class_text for token in ["item", "news", "article", "featured", "asset"]):
            return current
    return link.parent


def _extract_title(soup: BeautifulSoup) -> str:
    for selector in ["h1", ".article-title", ".detail-title", ".title", "meta[property='og:title']"]:
        node = soup.select_one(selector)
        if node is None:
            continue
        if node.name == "meta":
            value = _clean_text(node.get("content"))
        else:
            value = _clean_text(node.get_text(" ", strip=True))
        if value:
            return value
    return ""


def _extract_summary(soup: BeautifulSoup) -> str:
    for selector in [
        "meta[name='description']",
        "meta[property='og:description']",
        ".sapo",
        ".summary",
        ".lead",
        ".description",
        ".article-summary",
    ]:
        node = soup.select_one(selector)
        if node is None:
            continue
        if node.name == "meta":
            value = _clean_text(node.get("content"))
        else:
            value = _clean_text(node.get_text(" ", strip=True))
        if value and not _is_generic_moh_title(value):
            return value
    return ""


def _extract_content(soup: BeautifulSoup) -> str:
    for selector in [
        "article",
        ".journal-content-article",
        ".detail-content",
        ".article-content",
        ".news-content",
        ".content-news",
        ".entry-content",
        ".detail-news",
        "#content",
    ]:
        node = soup.select_one(selector)
        if node is None:
            continue
        _remove_noise(node)
        text = _clean_text(node.get_text(" ", strip=True))
        if len(text) >= 80:
            return text

    paragraphs = [_clean_text(p.get_text(" ", strip=True)) for p in soup.find_all("p")]
    paragraphs = [paragraph for paragraph in paragraphs if len(paragraph) >= 20]
    text = _clean_text(" ".join(paragraphs))
    return text if len(text) >= 80 else ""


def _remove_noise(node) -> None:
    for selector in ["script", "style", "noscript", "iframe", ".social", ".share", ".related"]:
        for child in node.select(selector):
            child.decompose()


def _extract_datetime(node) -> Optional[datetime]:
    if node is None:
        return None
    time_node = node.find("time")
    if time_node is not None:
        parsed = _parse_datetime(time_node.get("datetime") or time_node.get_text(" ", strip=True))
        if parsed is not None:
            return parsed
    return _parse_datetime(node.get_text(" ", strip=True))


def _extract_detail_datetime(soup: BeautifulSoup) -> Optional[datetime]:
    for selector in [
        "meta[property='article:published_time']",
        "meta[name='pubdate']",
        "time",
        ".date",
        ".datetime",
        ".publish-date",
    ]:
        node = soup.select_one(selector)
        if node is None:
            continue
        value = node.get("content") if node.name == "meta" else node.get("datetime") or node.get_text(" ", strip=True)
        parsed = _parse_datetime(value)
        if parsed is not None:
            return parsed
    return None


def _extract_thumbnail(node, *, base_url: str) -> Optional[str]:
    if node is None:
        return None
    image = node.find("img")
    if image is None:
        return None
    return _normalize_moh_image_url(image.get("src") or image.get("data-src"), base_url=base_url)


def _extract_detail_thumbnail(soup: BeautifulSoup, *, base_url: str) -> Optional[str]:
    node = soup.select_one("meta[property='og:image']")
    if node is not None:
        image_url = _normalize_moh_image_url(node.get("content"), base_url=base_url)
        if image_url:
            return image_url
    return _extract_thumbnail(soup, base_url=base_url)


def _parse_datetime(value: Any) -> Optional[datetime]:
    raw = _clean_text(value)
    if not raw:
        return None

    iso_candidate = raw.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(iso_candidate)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except ValueError:
        pass

    match = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?", raw, re.IGNORECASE)
    if not match:
        return None

    day, month, year, hour, minute, meridiem = match.groups()
    try:
        hour_value = int(hour or 0)
        if meridiem:
            meridiem = meridiem.upper()
            if meridiem == "PM" and hour_value != 12:
                hour_value += 12
            elif meridiem == "AM" and hour_value == 12:
                hour_value = 0
        return datetime(
            int(year),
            int(month),
            int(day),
            hour_value,
            int(minute or 0),
            tzinfo=VIETNAM_TZ,
        ).astimezone(timezone.utc)
    except ValueError:
        return None


def _absolute_url(value: Any, *, base_url: str) -> str:
    raw = _clean_text(value)
    if not raw or raw.startswith("#") or raw.lower().startswith("javascript:"):
        return ""
    return urljoin(base_url, raw)


def _normalize_moh_image_url(value: Any, *, base_url: str) -> Optional[str]:
    raw = _clean_text(value)
    if not raw or raw.startswith("#") or raw.lower().startswith("javascript:"):
        return None
    if raw.lower() in {"null", "none", "undefined"}:
        return None

    if raw.startswith("//"):
        raw = f"https:{raw}"

    parsed = urlparse(raw)
    if parsed.scheme in {"http", "https"}:
        if "/CustomsCMS/" in parsed.path and "/resource/" not in parsed.path:
            return urljoin(MOH_IMAGE_BASE_URL.rstrip("/") + "/", parsed.path.lstrip("/"))
        return raw

    if raw.startswith("/resource/"):
        return urljoin(MOH_ORIGIN_URL.rstrip("/") + "/", raw.lstrip("/"))
    if raw.startswith("/CustomsCMS/") or raw.startswith("CustomsCMS/"):
        return urljoin(MOH_IMAGE_BASE_URL.rstrip("/") + "/", raw.lstrip("/"))
    return urljoin(base_url, raw)


def _canonical_moh_source_url(source_url: str) -> str:
    parsed = urlparse(source_url)
    if "moh.gov.vn" not in parsed.netloc:
        return source_url
    query = parse_qs(parsed.query)
    if "aid" in query or "pageId" in query:
        return parsed._replace(fragment="").geturl()
    # Older Liferay listing links append redirect query parameters; the content path is stable.
    return parsed._replace(query="", fragment="").geturl()


def _is_moh_article_url(url: str) -> bool:
    parsed = urlparse(url)
    if "moh.gov.vn" not in parsed.netloc:
        return False
    if not parsed.path or parsed.path == "/":
        return False
    if re.search(r"\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?)$", parsed.path, re.IGNORECASE):
        return False
    return True


def _build_external_id(source_url: str) -> str:
    parsed = urlparse(source_url)
    match = re.search(r"/content/([^/?#]+)", parsed.path)
    stable = f"{parsed.netloc}/content/{match.group(1)}" if match else f"{parsed.netloc}{parsed.path}"
    digest = hashlib.sha1(stable.encode("utf-8")).hexdigest()[:16]
    return f"moh:{digest}"


def _to_fetch_item(result: ArticleCreateResult) -> MohFetchItem:
    return MohFetchItem(
        action=result.action,
        article_id=result.article.id,
        title=result.article.title,
        source_url=result.article.source_url,
        external_id=result.article.external_id,
        dedup_matched_by=result.dedup_matched_by,
    )


def _clean_text(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def _match_text(value: Any) -> str:
    normalized = unicodedata.normalize("NFD", _clean_text(value))
    ascii_text = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return ascii_text.lower()


def _is_generic_moh_title(value: Any) -> bool:
    matched = _match_text(value)
    return not matched or "xuat ban thong tin" in matched or "cong thong tin" in matched


def _dedupe_tags(values: list[str]) -> list[str]:
    seen: set[str] = set()
    tags: list[str] = []
    for value in values:
        normalized = _clean_text(value)
        key = normalized.lower()
        if not normalized or key in seen:
            continue
        seen.add(key)
        tags.append(normalized)
    return tags


def _dedupe_urls(values: list[str]) -> list[str]:
    seen: set[str] = set()
    urls: list[str] = []
    for value in values:
        normalized = _clean_text(value)
        key = normalized.rstrip("/")
        if not normalized or key in seen:
            continue
        seen.add(key)
        urls.append(normalized)
    return urls
