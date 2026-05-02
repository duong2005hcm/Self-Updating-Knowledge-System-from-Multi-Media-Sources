from __future__ import annotations

import re
from typing import Iterable

from bs4 import BeautifulSoup, NavigableString, Tag


CUT_MARKERS = (
    "Xem thêm:",
    "Tags:",
    "Tin Liên Quan",
    "Tin liên quan",
    "Quan tâm nhất",
    "Mới nhất",
    "Xem thêm bình luận",
    "Ý kiến của bạn",
    "Hãy nhập họ và tên",
    "Đăng nhập để tham gia bình luận",
    "Chia sẻ facebook",
    "Tổng Biên tập:",
    "THÔNG TIN TÒA SOẠN",
    "LIÊN HỆ QUẢNG CÁO",
    "VĂN PHÒNG ĐẠI DIỆN",
)

MENU_LINES = {
    "Hà Nội",
    "Thông tin tài khoản",
    "Danh sách bài đã lưu",
    "Danh sách bài đã xem",
    "Hoạt động bình luận",
    "Đăng xuất",
    "Y tế",
    "Thời sự",
    "Tra cứu bệnh",
    "Sức khỏe TV",
    "Y học 360",
    "Dược",
    "Y học cổ truyền",
    "Giới tính",
    "Dinh dưỡng",
    "Khỏe - Đẹp",
    "Phòng mạch online",
    "Thị trường",
    "Camera bệnh viện",
    "Multimedia",
    "Video",
    "Infographic",
}

ARTICLE_SELECTORS = (
    "article",
    ".detail-content",
    ".detail__content",
    ".article-content",
    ".article__content",
    ".content-detail",
    ".content_detail",
    ".dt-news__content",
    ".detail-body",
    ".entry-content",
    ".singular-content",
    "#main-detail",
)

REMOVE_SELECTORS = (
    "script",
    "style",
    "noscript",
    "iframe",
    "svg",
    "canvas",
    "header",
    "nav",
    "footer",
    "aside",
    "form",
    "button",
    "input",
    "textarea",
    "select",
    ".header",
    ".footer",
    ".menu",
    ".nav",
    ".navbar",
    ".breadcrumb",
    ".breadcrumbs",
    ".sidebar",
    ".comment",
    ".comments",
    ".box-comment",
    ".share",
    ".social",
    ".tag",
    ".tags",
    ".related",
    ".relation",
    ".tin-lien-quan",
    ".ads",
    ".advertisement",
    ".banner",
    ".author",
    ".newsletter",
)


def extract_skds_disease_article(html_or_text: str, url: str = "", fallback_title: str = "") -> dict:
    raw = html_or_text or ""
    if _looks_like_html(raw):
        title, text = _extract_from_html(raw, fallback_title=fallback_title)
    else:
        title = _clean_line(fallback_title)
        text = _clean_plain_text(raw, title=title)

    if title and not _starts_with_title(text, title):
        text = f"{title}\n{text}".strip()

    text = _normalize_output(text)
    return {
        "title": title or fallback_title or "",
        "text": text,
        "url": url or "",
        "text_length": len(text),
    }


def _looks_like_html(value: str) -> bool:
    return bool(re.search(r"<\s*(html|body|article|main|h1|p|div|meta)\b", value or "", re.I))


def _extract_from_html(html: str, *, fallback_title: str) -> tuple[str, str]:
    soup = BeautifulSoup(html or "", "html.parser")
    title = _extract_title(soup, fallback_title=fallback_title)

    for selector in REMOVE_SELECTORS:
        for node in soup.select(selector):
            node.decompose()

    root = _select_article_root(soup)
    nodes = _content_nodes(root)
    lines: list[str] = []
    if title:
        lines.append(title)

    sapo = _find_first_text(soup, (".detail-sapo", ".sapo", ".article-sapo", ".summary"))
    if sapo:
        lines.append(sapo)

    for node in nodes:
        if _is_related_node(node):
            continue
        text = _clean_line(_node_text(node))
        if not text:
            continue
        if title and text == title and lines and lines[0] == title:
            continue
        lines.extend(_split_embedded_lines(text))

    text = "\n".join(lines)
    return title, _clean_plain_text(text, title=title)


def _extract_title(soup: BeautifulSoup, *, fallback_title: str) -> str:
    h1 = soup.find("h1")
    h1_text = _clean_line(h1.get_text(" ", strip=True) if h1 else "")
    if h1_text:
        return h1_text

    for selector, attr in (
        ('meta[property="og:title"]', "content"),
        ('meta[name="twitter:title"]', "content"),
    ):
        node = soup.select_one(selector)
        value = _clean_line(node.get(attr, "") if node else "")
        if value:
            return _strip_site_suffix(value)

    title = soup.find("title")
    title_text = _clean_line(title.get_text(" ", strip=True) if title else "")
    return _strip_site_suffix(title_text) or _clean_line(fallback_title)


def _strip_site_suffix(value: str) -> str:
    text = _clean_line(value)
    for sep in (" - Sức khỏe đời sống", " | Sức khỏe đời sống", " - SKĐS", " | SKĐS"):
        if sep.lower() in text.lower():
            return text[: text.lower().find(sep.lower())].strip()
    return text


def _select_article_root(soup: BeautifulSoup) -> Tag:
    for selector in ARTICLE_SELECTORS:
        candidates = [node for node in soup.select(selector) if isinstance(node, Tag)]
        if candidates:
            return max(candidates, key=lambda node: len(node.get_text(" ", strip=True)))
    articles = [node for node in soup.find_all("article") if isinstance(node, Tag)]
    if articles:
        return max(articles, key=lambda node: len(node.get_text(" ", strip=True)))
    return soup.body or soup


def _content_nodes(root: Tag) -> list[Tag]:
    selectors = [
        ".toc-title",
        "h2",
        "h3",
        "p",
        "li",
    ]
    nodes: list[Tag] = []
    seen: set[int] = set()
    for selector in selectors:
        for node in root.select(selector):
            if id(node) in seen:
                continue
            seen.add(id(node))
            nodes.append(node)
    if nodes:
        nodes.sort(key=lambda node: _node_position_key(root, node))
        return nodes
    return [root]


def _find_first_text(soup: BeautifulSoup, selectors: tuple[str, ...]) -> str:
    for selector in selectors:
        node = soup.select_one(selector)
        text = _clean_line(_node_text(node)) if isinstance(node, Tag) else ""
        if text:
            return text
    return ""


def _node_text(node: Tag | None) -> str:
    if node is None:
        return ""
    block_tags = {"address", "article", "aside", "blockquote", "div", "figure", "form", "h1", "h2", "h3", "h4", "h5", "h6", "li", "ol", "p", "section", "table", "ul"}
    parts: list[str] = []
    for child in node.children:
        if isinstance(child, NavigableString):
            parts.append(str(child))
            continue
        if not isinstance(child, Tag):
            continue
        if child.name in block_tags:
            continue
        parts.append(child.get_text(" ", strip=True))
    text = " ".join(part.strip() for part in parts if part and part.strip())
    return text or node.get_text(" ", strip=True)


def _node_position_key(root: Tag, target: Tag) -> int:
    for index, node in enumerate(root.descendants):
        if node is target:
            return index
    return 10**9


def _is_related_node(node: Tag) -> bool:
    ancestry_classes: list[str] = []
    current: Tag | None = node
    while isinstance(current, Tag):
        ancestry_classes.extend(str(value) for value in (current.get("class") or []))
        current = current.parent if isinstance(current.parent, Tag) else None

    joined = " ".join(ancestry_classes).lower()
    if "toc-list-headings" in joined:
        return False
    related_tokens = (
        "related",
        "relatednews",
        "objectbox",
        "vcsortableinpreviewmode",
        "tin-lien-quan",
    )
    return any(token in joined for token in related_tokens)


def _clean_plain_text(text: str, *, title: str = "") -> str:
    cut_text = _cut_at_markers(text or "")
    raw_lines = []
    for line in cut_text.splitlines():
        raw_lines.extend(_split_embedded_lines(line))
    return _normalize_lines(raw_lines, title=title)


def _cut_at_markers(text: str) -> str:
    positions = []
    for marker in CUT_MARKERS:
        match = re.search(re.escape(marker), text or "", flags=re.I)
        if match:
            positions.append(match.start())
    if not positions:
        return text or ""
    return (text or "")[: min(positions)]


def _split_embedded_lines(text: str) -> list[str]:
    value = _clean_line(text)
    if not value:
        return []
    for marker in CUT_MARKERS:
        value = re.split(re.escape(marker), value, maxsplit=1, flags=re.I)[0].strip()
    if not value:
        return []
    return [part.strip() for part in re.split(r"\s*(?:\r?\n)+\s*", value) if part.strip()]


def _normalize_lines(lines: Iterable[str], *, title: str = "") -> str:
    output: list[str] = []
    short_seen: set[str] = set()
    previous = ""
    normalized_title = _line_key(title)

    for raw in lines:
        line = _clean_line(raw)
        if not line or _is_noise_line(line):
            continue
        key = _line_key(line)
        if normalized_title and key == normalized_title and output:
            continue
        if key == _line_key(previous):
            continue
        if len(line) <= 80:
            if key in short_seen:
                continue
            short_seen.add(key)
        output.append(line)
        previous = line

    return "\n".join(output).strip()


def _normalize_output(text: str) -> str:
    lines = [_clean_line(line) for line in (text or "").splitlines()]
    compact: list[str] = []
    blank = False
    for line in lines:
        if not line:
            if compact and not blank:
                compact.append("")
                blank = True
            continue
        compact.append(line)
        blank = False
    return "\n".join(compact).strip()


def _clean_line(value: str) -> str:
    text = BeautifulSoup(value or "", "html.parser").get_text(" ", strip=True)
    text = re.sub(r"\s+", " ", text)
    return text.strip(" \t\r\n")


def _line_key(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip().lower())


def _is_noise_line(line: str) -> bool:
    if line in MENU_LINES:
        return True
    if any(marker.lower() in line.lower() for marker in CUT_MARKERS):
        return True
    if re.fullmatch(r"(facebook|zalo|email|copy link|print)", line.strip(), flags=re.I):
        return True
    return False


def _starts_with_title(text: str, title: str) -> bool:
    first = next((line for line in (text or "").splitlines() if line.strip()), "")
    return bool(title and _line_key(first) == _line_key(title))
