from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
import os
import uuid
import time
import logging

from backend.app.rag.chunking.pdf.pdf_chunker import process_single_pdf
from backend.app.rag.ingestion.embedding_store import embed_and_store_chunks
from backend.app.api.dependencies.admin_auth import verify_admin_token

router = APIRouter(
    prefix="/ingest",
    tags=["Ingest"],
    dependencies=[Depends(verify_admin_token)],
)
logger = logging.getLogger(__name__)

UPLOAD_DIR = "data/uploads/pdf"
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE_MB = 30


@router.post("/pdf")
async def ingest_pdf(file: UploadFile = File(...)):
    """
    Upload PDF → Chunk → Embed → Store ChromaDB
    """

    start_time = time.time()

    if not file.filename:
        raise HTTPException(400, "No file provided")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    try:
        file_bytes = await file.read()

        file_size_mb = len(file_bytes) / (1024 * 1024)

        if file_size_mb > MAX_FILE_SIZE_MB:
            raise HTTPException(
                400,
                f"File too large ({file_size_mb:.2f}MB). Max is {MAX_FILE_SIZE_MB}MB"
            )


        file_id = str(uuid.uuid4())
        safe_filename = file.filename.replace(" ", "_")

        pdf_path = os.path.join(UPLOAD_DIR, f"{file_id}_{safe_filename}")

        with open(pdf_path, "wb") as f:
            f.write(file_bytes)

        logger.info("[INGEST] Saved: %s (%.2fMB)", pdf_path, file_size_mb)


        chunk_start = time.time()

        chunks_json_path = process_single_pdf(pdf_path)

        if not chunks_json_path or not os.path.exists(chunks_json_path):
            raise Exception("Chunk JSON file was not created")

        logger.info("[INGEST] Chunk done in %.2fs", time.time() - chunk_start)


        embed_start = time.time()

        result = embed_and_store_chunks(
            chunks_json_path=chunks_json_path,
            allow_duplicates=False
        )

        logger.info("[INGEST] Embed done in %.2fs", time.time() - embed_start)

        total_time = time.time() - start_time

        logger.info("[INGEST] TOTAL TIME: %.2fs", total_time)

        try:
            os.remove(chunks_json_path)
        except Exception as e:
            logger.exception(
                "Failed to remove temporary chunk file '%s': %s",
                chunks_json_path,
                str(e),
            )

        return {
            "status": "ok",
            "filename": file.filename,
            "collection": "rag_pdf",
            "chunks_inserted": result.get("inserted", 0),
            "processing_time": round(total_time, 2)
        }

    except HTTPException:
        raise

    except Exception as e:
        logger.exception("Ingest PDF pipeline failed: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Ingest pipeline failed: {str(e)}"
        )
