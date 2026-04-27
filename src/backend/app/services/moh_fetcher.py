from __future__ import annotations

import hashlib
import os
import re
import ssl
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Optional
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter

from backend.app.schemas.article import ArticleCreateRequest
from backend.app.services.article_service import ArticleCreateResult, ArticleService

MOH_HOME_URL = "https://moh.gov.vn/"
MOH_SOURCE_NAME = "Bộ Y tế"


@dataclass(frozen=True)
class MohListingItem:
    title: str
    source_url: str
    published_at: Optional[datetime] = None
    thumbnail_url: Optional[str] = None


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
    """Fetch the latest small batch from Bộ Y tế 'Tin nổi bật' only."""

    def __init__(
        self,
        article_service: ArticleService,
        *,
        http_get: Optional[Callable[..., Any]] = None,
        home_url: str = MOH_HOME_URL,
        timeout_seconds: int = 20,
    ):
        self._articles = article_service
        self._http_get = http_get or _build_default_http_get()
        self._home_url = home_url
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

        listing_html = self._fetch_html(self._home_url)
        listing_items = parse_moh_featured_items(
            listing_html,
            base_url=self._home_url,
            limit=capped_page_size,
        )

        items: list[MohFetchItem] = []
        created = 0
        skipped_duplicate = 0
        for listing_item in listing_items:
            detail_html = self._fetch_html(listing_item.source_url)
            article_payload = map_moh_detail_to_article_request(
                detail_html,
                listing_item=listing_item,
                topic=normalized_topic,
                tags=tags or [],
            )
            create_result = self._articles.create_article(article_payload)
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

    def _fetch_html(self, url: str) -> str:
        response = self._http_get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; RAG-AI-MOH-Fetcher/1.0)"},
            timeout=self._timeout_seconds,
        )
        response.raise_for_status()
        return response.text


class _LegacyTlsAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        context = ssl.create_default_context()
        # moh.gov.vn can reject stricter OpenSSL defaults in some environments.
        context.set_ciphers("DEFAULT:@SECLEVEL=1")
        context.check_hostname = False
        kwargs["ssl_context"] = context
        return super().init_poolmanager(*args, **kwargs)


def _build_default_http_get() -> Callable[..., Any]:
    session = requests.Session()
    session.mount("https://", _LegacyTlsAdapter())
    verify_tls = os.getenv("MOH_FETCH_VERIFY_TLS", "true").strip().lower() not in {
        "0",
        "false",
        "no",
    }

    def _get(url: str, **kwargs):
        kwargs.setdefault("verify", verify_tls)
        return session.get(url, **kwargs)

    return _get


def parse_moh_featured_items(
    html: str,
    *,
    base_url: str = MOH_HOME_URL,
    limit: int = 2,
) -> list[MohListingItem]:
    soup = BeautifulSoup(html or "", "html.parser")
    block = _find_featured_block(soup)
    if block is None:
        raise ValueError("Could not find Bộ Y tế 'Tin nổi bật' block in listing HTML")

    items: list[MohListingItem] = []
    seen_urls: set[str] = set()
    for link in block.find_all("a", href=True):
        title = _clean_text(link.get_text(" ", strip=True))
        source_url = _absolute_url(link.get("href"), base_url=base_url)
        if not title or not _is_moh_article_url(source_url):
            continue
        if title.lower() == "tin nổi bật" or source_url in seen_urls:
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

    if not items:
        raise ValueError("Could not parse any article link from Bộ Y tế 'Tin nổi bật' block")
    return items


def map_moh_detail_to_article_request(
    html: str,
    *,
    listing_item: MohListingItem,
    topic: str,
    tags: list[str],
) -> ArticleCreateRequest:
    soup = BeautifulSoup(html or "", "html.parser")
    title = _extract_title(soup) or listing_item.title
    summary = _extract_summary(soup)
    content = _extract_content(soup)
    if not content:
        raise ValueError(f"Could not parse article content from {listing_item.source_url}")

    published_at = _extract_detail_datetime(soup) or listing_item.published_at
    thumbnail_url = _extract_detail_thumbnail(soup, base_url=listing_item.source_url) or listing_item.thumbnail_url

    mapped_tags = _dedupe_tags(
        [
            topic,
            "Bộ Y tế",
            "Tin nổi bật",
            "Tin tức - sự kiện",
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
        source_url=listing_item.source_url,
        external_id=_build_external_id(listing_item.source_url),
        published_at=published_at,
        topic=(topic or "").strip() or "health",
        tags=mapped_tags,
        status="active",
        visibility="public",
    )


def _find_featured_block(soup: BeautifulSoup):
    selectors = [
        "#featured",
        ".ui-tabs-panel.active",
        ".ui-tabs-panel[aria-hidden='false']",
        "[id*='featured']",
        "[class*='featured']",
    ]
    for selector in selectors:
        node = soup.select_one(selector)
        if node is not None:
            return node

    heading = soup.find(string=lambda value: bool(value and "Tin nổi bật" in value))
    if heading is None:
        return None

    parent = heading.parent
    while parent is not None:
        links = [
            link
            for link in parent.find_all("a", href=True)
            if _clean_text(link.get_text(" ", strip=True))
        ]
        if 1 <= len(links) <= 15:
            return parent
        parent = parent.parent

    return None


def _nearest_article_container(link):
    current = link
    for _ in range(4):
        current = current.parent
        if current is None:
            return None
        if current.name in {"li", "article"}:
            return current
        class_text = " ".join(current.get("class", [])).lower()
        if any(token in class_text for token in ["item", "news", "article", "featured"]):
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
        if value:
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
    return _absolute_url(image.get("src") or image.get("data-src"), base_url=base_url)


def _extract_detail_thumbnail(soup: BeautifulSoup, *, base_url: str) -> Optional[str]:
    node = soup.select_one("meta[property='og:image']")
    if node is not None:
        image_url = _absolute_url(node.get("content"), base_url=base_url)
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

    match = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?", raw)
    if not match:
        return None

    day, month, year, hour, minute = match.groups()
    try:
        return datetime(
            int(year),
            int(month),
            int(day),
            int(hour or 0),
            int(minute or 0),
            tzinfo=timezone.utc,
        )
    except ValueError:
        return None


def _absolute_url(value: Any, *, base_url: str) -> str:
    raw = _clean_text(value)
    if not raw or raw.startswith("#") or raw.lower().startswith("javascript:"):
        return ""
    return urljoin(base_url, raw)


def _is_moh_article_url(url: str) -> bool:
    parsed = urlparse(url)
    if "moh.gov.vn" not in parsed.netloc:
        return False
    if not parsed.path or parsed.path == "/":
        return False
    return True


def _build_external_id(source_url: str) -> str:
    parsed = urlparse(source_url)
    stable = f"{parsed.netloc}{parsed.path}"
    if parsed.query:
        stable = f"{stable}?{parsed.query}"
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
