# crawler_news.py
import re
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from backend.app.rag.chunking.web.fetch_web import fetch_html


def crawl_article_links_optimized(home_url, limit=10):
    html = fetch_html(home_url)
    soup = BeautifulSoup(html, "html.parser")
    domain = urlparse(home_url).netloc

    links = set()
    article_pattern = re.compile(r".*-\d+\.html$")

    for a in soup.find_all("a", href=True):
        href = a["href"].split("?")[0]
        full_url = urljoin(home_url, href)

        if urlparse(full_url).netloc != domain:
            continue

        if article_pattern.match(full_url):
            links.add(full_url)

        if len(links) >= limit:
            break

    return list(links)
