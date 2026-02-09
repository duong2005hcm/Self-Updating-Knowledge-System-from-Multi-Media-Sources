# web_chunker.py
import os, json, uuid
from urllib.parse import urlparse

from backend.app.rag.chunking.web.html_clean import clean_docs, clean_news, clean_ecommerce
from backend.app.rag.chunking.web.chunker import chunk_text
from backend.app.rag.chunking.web.web_classifiers import classify_web


class WebChunker:

    def __init__(self, output_dir="processed/web"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def process(self, url: str, html: str):
        web_type = classify_web(url)

        if web_type == "docs":
            return self._process_docs(url, html)

        if web_type == "news":
            return self._process_news(url, html)

        if web_type == "ecommerce":
            return self._process_ecommerce(url, html)

        raise ValueError("Unsupported web type")

    # ===== DOCS =====
    def _process_docs(self, url, html):
        text = clean_docs(html)
        chunks = chunk_text(text, size=350, overlap=50)
        return self._save(url, chunks, "docs")

    # ===== NEWS =====
    def _process_news(self, url, html):
        article = clean_news(html)
        if len(article) < 500:
            return None
        chunks = chunk_text(article, size=500, overlap=100)
        return self._save(url, chunks, "news")

    # ===== ECOMMERCE =====
    def _process_ecommerce(self, url, html):
        product = clean_ecommerce(html)
        text = f"{product['title']}\n{product['description']}"
        chunks = chunk_text(text, size=250, overlap=40)
        return self._save(url, chunks, "ecommerce")

    # ===== SAVE =====
    def _save(self, url, chunks, source_type):
        doc_id = f"{source_type}_{uuid.uuid4().hex[:8]}"
        domain = urlparse(url).netloc.replace(".", "_")

        data = [{
            "doc_id": doc_id,
            "source_type": source_type,
            "url": url,
            "chunk_index": i,
            "text": c
        } for i, c in enumerate(chunks)]

        path = os.path.join(self.output_dir, f"{domain}_{doc_id}.chunks.json")

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return path
