from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import uuid
import traceback
import time

from backend.app.rag.chunking.pdf.pdf_chunker import process_single_pdf
from backend.app.rag.ingestion.embedding_store import embed_and_store_chunks

router = APIRouter(prefix="/ingest", tags=["Ingest"])

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

        print(f"[INGEST] Saved: {pdf_path} ({file_size_mb:.2f}MB)")


        chunk_start = time.time()

        chunks_json_path = process_single_pdf(pdf_path)

        if not chunks_json_path or not os.path.exists(chunks_json_path):
            raise Exception("Chunk JSON file was not created")

        print(f"[INGEST] Chunk done in {time.time() - chunk_start:.2f}s")


        embed_start = time.time()

        result = embed_and_store_chunks(
            chunks_json_path=chunks_json_path,
            allow_duplicates=False
        )

        print(f"[INGEST] Embed done in {time.time() - embed_start:.2f}s")

        total_time = time.time() - start_time

        print(f"[INGEST] TOTAL TIME: {total_time:.2f}s")

        try:
            os.remove(chunks_json_path)
        except:
            pass

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
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=f"Ingest pipeline failed: {str(e)}"
        )