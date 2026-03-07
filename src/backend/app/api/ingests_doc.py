from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import uuid

from backend.app.rag.chunking.pdf.pdf_chunker import process_single_pdf
from backend.app.rag.ingestion.embedding_store import embed_and_store_chunks


router = APIRouter(prefix="/ingest", tags=["Ingest"])

UPLOAD_DIR = "data/uploads/pdf"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/pdf")
async def ingest_pdf(file: UploadFile = File(...)):
    """
    Upload PDF → Page-aware chunk → Embed → Store ChromaDB (rag_pdf)
    """

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported"
        )

    # Save uploaded file
    file_id = str(uuid.uuid4())
    pdf_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")

    with open(pdf_path, "wb") as f:
        f.write(await file.read())

    # Page-aware chunking
    try:
        chunks_json_path = process_single_pdf(pdf_path)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Chunking failed: {str(e)}"
        )

    # Embed + Store (rag_pdf collection)
    try:
        result = embed_and_store_chunks(
            chunks_json_path=chunks_json_path,
            allow_duplicates=False
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Embedding failed: {str(e)}"
        )

    return {
        "status": "ok",
        "filename": file.filename,
        "collection": "rag_pdf",
        "chunks_inserted": result.get("inserted", 0),
        "chunks_skipped": result.get("skipped", 0)
    }