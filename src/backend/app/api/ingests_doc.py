from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import uuid
import traceback

from backend.app.rag.chunking.pdf.pdf_chunker import process_single_pdf
from backend.app.rag.ingestion.embedding_store import embed_and_store_chunks

router = APIRouter(prefix="/ingest", tags=["Ingest"])

UPLOAD_DIR = "data/uploads/pdf"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/pdf")
async def ingest_pdf(file: UploadFile = File(...)):
    """
    Upload PDF → Chunk → Embed → Store ChromaDB
    """

    # -------- Validate file --------
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported"
        )

    try:
        # -------- Save file --------
        file_id = str(uuid.uuid4())
        pdf_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")

        with open(pdf_path, "wb") as f:
            f.write(await file.read())

        print(f"[INGEST] Saved PDF: {pdf_path}")

        # -------- Chunk PDF --------
        chunks_json_path = process_single_pdf(pdf_path)

        if not chunks_json_path or not os.path.exists(chunks_json_path):
            raise Exception("Chunk JSON file was not created")

        print(f"[INGEST] Chunk file created: {chunks_json_path}")

        # -------- Embed + Store --------
        result = embed_and_store_chunks(
            chunks_json_path=chunks_json_path,
            allow_duplicates=False
        )

        print(f"[INGEST] Embedding result: {result}")

        return {
            "status": "ok",
            "filename": file.filename,
            "collection": "rag_pdf",
            "chunks_inserted": result.get("inserted", 0)
        }

    except Exception as e:
        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=f"Ingest pipeline failed: {str(e)}"
        )