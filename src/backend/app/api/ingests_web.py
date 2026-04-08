from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.app.rag.chunking.web.web_classifiers import classify_web
from backend.app.rag.chunking.web.filter_news import crawl_article_links_optimized
from backend.app.rag.chunking.web.fetch_web import fetch_html
from backend.app.rag.chunking.web.web_chunker import WebChunker
from backend.app.rag.ingestion.embedding_store import embed_and_store_chunks
from backend.app.api.dependencies.admin_auth import verify_admin_token

router = APIRouter(
    prefix="/ingest",
    tags=["Ingest"],
    dependencies=[Depends(verify_admin_token)],
)


class WebIngestRequest(BaseModel):
    url: str
    limit: int = 5


@router.post("/web")
def ingest_web(req: WebIngestRequest):
    """
    Ingest web URL:
    - docs
    - ecommerce
    - news (crawl articles)
    """

    url = req.url
    limit = req.limit

    web_type = classify_web(url)
    chunker = WebChunker(output_dir="data/processed/web")

    processed_files = []

    # ===== NEWS SITE =====
    if web_type == "news":
        article_links = crawl_article_links_optimized(url, limit=limit)

        for article_url in article_links:
            html = fetch_html(article_url)
            chunk_file = chunker.process(article_url, html)

            if chunk_file:
                embed_and_store_chunks(
                    chunks_json_path=chunk_file,
                    data_type="web_news"
                )
                processed_files.append(chunk_file)

    # ===== DOCS / ECOMMERCE =====
    else:
        html = fetch_html(url)
        chunk_file = chunker.process(url, html)

        if chunk_file:
            embed_and_store_chunks(
                chunks_json_path=chunk_file,
                data_type=f"web_{web_type}"
            )
            processed_files.append(chunk_file)

    return {
        "status": "ok",
        "web_type": web_type,
        "files_processed": len(processed_files),
        "outputs": processed_files
    }
