from fastapi import APIRouter, UploadFile, File
import os
import uuid

from backend.app.rag.chunking.pdf.pdf_chunker import process_pdfs as chunk_pdf
from backend.app.rag.ingestion.embedding_store import embed_and_store_chunks

router = APIRouter(prefix="/ingest", tags=["Ingest"])

UPLOAD_DIR = "data/uploads/pdf"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/document")
async def ingest_document(file: UploadFile = File(...)):
    """
    Upload PDF → chunk → embed → store ChromaDB
    """
    if not file.filename.endswith(".pdf"):
        return {"status": "error", "message": "Only PDF files are supported"}

    # 1. Save file
    file_id = str(uuid.uuid4())
    pdf_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")

    with open(pdf_path, "wb") as f:
        f.write(await file.read())

    # 2. Chunk PDF
    chunks_path = chunk_pdf(pdf_path)

    # 3. Embed & store
    result = embed_and_store_chunks(
        chunks_json_path=chunks_path,
        data_type="pdf"
    )

    return {
        "status": "ok",
        "filename": file.filename,
        "chunks_inserted": result["inserted"]
    }
