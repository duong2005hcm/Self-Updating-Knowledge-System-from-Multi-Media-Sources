from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Any, Optional

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
    domain: str = "general"
    topic: str = "general"
    priority: str = "normal"
    status: str = "active"
    source_type: Optional[str] = None
    created_by: Optional[str] = None


@router.post("/web")
def ingest_web(
    req: WebIngestRequest,
    decoded_token: dict[str, Any] = Depends(verify_admin_token),
):
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
    actor = (
        (req.created_by or "").strip()
        or str(decoded_token.get("uid") or "")
        or str(decoded_token.get("email") or "")
        or "admin"
    )
    extra_metadata = {
        "domain": req.domain.strip() or "general",
        "topic": req.topic.strip() or "general",
        "priority": req.priority.strip() or "normal",
        "status": req.status.strip() or "active",
        "source_type": (req.source_type or "Web").strip() or "Web",
        "created_by": actor,
    }

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
                    data_type="web_news",
                    extra_metadata=extra_metadata,
                )
                processed_files.append(chunk_file)

    # ===== DOCS / ECOMMERCE =====
    else:
        html = fetch_html(url)
        chunk_file = chunker.process(url, html)

        if chunk_file:
            embed_and_store_chunks(
                chunks_json_path=chunk_file,
                data_type=f"web_{web_type}",
                extra_metadata=extra_metadata,
            )
            processed_files.append(chunk_file)

    return {
        "status": "ok",
        "web_type": web_type,
        "files_processed": len(processed_files),
        "outputs": processed_files
    }
