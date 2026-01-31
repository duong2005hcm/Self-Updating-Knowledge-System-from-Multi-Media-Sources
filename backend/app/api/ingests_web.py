from rag.chunking.web.filter_news import crawl_article_links_optimized
from rag.chunking.web.fetch_web import fetch_html
from rag.chunking.web.web_chunker import WebChunker

def ingest_news_site(home_url, limit=10):
    links = crawl_article_links_optimized(home_url, limit)
    chunker = WebChunker(output_dir="processed/news")

    results = []

    for url in links:
        html = fetch_html(url)
        out = chunker.process(url, html)
        if out:
            results.append(out)

    return results
