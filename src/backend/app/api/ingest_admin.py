from fastapi import APIRouter, UploadFile, File, Depends, Form
from pydantic import BaseModel
from typing import Any, Optional
import os, uuid, time

from backend.app.rag.chunking.pdf.pdf_chunker import process_single_pdf
from backend.app.rag.ingestion.embedding_store import embed_and_store_chunks

from backend.app.rag.chunking.web.web_classifiers import classify_web
from backend.app.rag.chunking.web.filter_news import crawl_article_links_optimized
from backend.app.rag.chunking.web.fetch_web import fetch_html
from backend.app.rag.chunking.web.web_chunker import WebChunker
from backend.app.api.dependencies.admin_auth import verify_admin_token

router = APIRouter(
    prefix="/admin",
    tags=["Admin Ingest"],
    dependencies=[Depends(verify_admin_token)],
)

UPLOAD_DIR = "data/uploads/pdf"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/ingest/pdf")
async def ingest_pdf(
    file: UploadFile = File(...),
    domain: str = Form(default="general"),
    topic: str = Form(default="general"),
    priority: str = Form(default="normal"),
    status: str = Form(default="active"),
    source_type: str = Form(default="PDF"),
    created_by: Optional[str] = Form(default=None),
    decoded_token: dict[str, Any] = Depends(verify_admin_token),
):
    file_bytes = await file.read()

    file_id = str(uuid.uuid4())
    path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")

    with open(path, "wb") as f:
        f.write(file_bytes)

    chunks_json_path = process_single_pdf(path)

    actor = (
        (created_by or "").strip()
        or str(decoded_token.get("uid") or "")
        or str(decoded_token.get("email") or "")
        or "admin"
    )
    result = embed_and_store_chunks(
        chunks_json_path,
        extra_metadata={
            "domain": domain.strip() or "general",
            "topic": topic.strip() or "general",
            "priority": priority.strip() or "normal",
            "status": status.strip() or "active",
            "source_type": source_type.strip() or "PDF",
            "created_by": actor,
        },
    )

    return {
        "status": "ok",
        "chunks_inserted": result.get("inserted", 0)
    }


class WebIngestRequest(BaseModel):
    url: str
    limit: int = 5
    domain: str = "general"
    topic: str = "general"
    priority: str = "normal"
    status: str = "active"
    source_type: Optional[str] = None
    created_by: Optional[str] = None


@router.post("/ingest/web")
def ingest_web(
    req: WebIngestRequest,
    decoded_token: dict[str, Any] = Depends(verify_admin_token),
):

    url = req.url
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

    if web_type == "news":
        links = crawl_article_links_optimized(url, limit=req.limit)

        for link in links:
            html = fetch_html(link)
            chunk_file = chunker.process(link, html)

            if chunk_file:
                embed_and_store_chunks(
                    chunk_file,
                    extra_metadata=extra_metadata,
                )
                processed_files.append(chunk_file)

    else:
        html = fetch_html(url)
        chunk_file = chunker.process(url, html)

        if chunk_file:
            embed_and_store_chunks(
                chunk_file,
                extra_metadata=extra_metadata,
            )
            processed_files.append(chunk_file)

    return {
        "status": "ok",
        "files_processed": len(processed_files)
    }
