from fastapi import APIRouter, UploadFile, File, HTTPException, Header
from pydantic import BaseModel
import os, uuid, time

from backend.app.rag.chunking.pdf.pdf_chunker import process_single_pdf
from backend.app.rag.ingestion.embedding_store import embed_and_store_chunks

from backend.app.rag.chunking.web.web_classifiers import classify_web
from backend.app.rag.chunking.web.filter_news import crawl_article_links_optimized
from backend.app.rag.chunking.web.fetch_web import fetch_html
from backend.app.rag.chunking.web.web_chunker import WebChunker

router = APIRouter(prefix="/admin", tags=["Admin Ingest"])

ADMIN_TOKEN = "super_secret_admin"

UPLOAD_DIR = "data/uploads/pdf"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def check_admin(auth):
    if auth != f"Bearer {ADMIN_TOKEN}":
        raise HTTPException(403, "Admin only")


@router.post("/ingest/pdf")
async def ingest_pdf(
    file: UploadFile = File(...),
    authorization: str = Header(None)
):
    check_admin(authorization)

    file_bytes = await file.read()

    file_id = str(uuid.uuid4())
    path = os.path.join(UPLOAD_DIR, f"{file_id}.pdf")

    with open(path, "wb") as f:
        f.write(file_bytes)

    chunks_json_path = process_single_pdf(path)

    result = embed_and_store_chunks(chunks_json_path)

    return {
        "status": "ok",
        "chunks_inserted": result.get("inserted", 0)
    }


class WebIngestRequest(BaseModel):
    url: str
    limit: int = 5


@router.post("/ingest/web")
def ingest_web(req: WebIngestRequest, authorization: str = Header(None)):
    check_admin(authorization)

    url = req.url
    web_type = classify_web(url)
    chunker = WebChunker(output_dir="data/processed/web")

    processed_files = []

    if web_type == "news":
        links = crawl_article_links_optimized(url, limit=req.limit)

        for link in links:
            html = fetch_html(link)
            chunk_file = chunker.process(link, html)

            if chunk_file:
                embed_and_store_chunks(chunk_file)
                processed_files.append(chunk_file)

    else:
        html = fetch_html(url)
        chunk_file = chunker.process(url, html)

        if chunk_file:
            embed_and_store_chunks(chunk_file)
            processed_files.append(chunk_file)

    return {
        "status": "ok",
        "files_processed": len(processed_files)
    }