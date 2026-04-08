import logging
from datetime import datetime, timezone
from io import BytesIO
from typing import List

from fastapi import APIRouter, UploadFile, File, HTTPException
from firebase_admin import firestore
from pypdf import PdfReader

from backend.app.rag.memory.firebase_init import db


router = APIRouter(prefix="/user", tags=["User Upload"])
logger = logging.getLogger(__name__)

TEMP_UPLOAD_COLLECTION = "temp_uploads"
TEMP_UPLOADS_LIMIT = 5


def extract_text_from_pdf(content: bytes) -> str:
    """
    Extract text content from PDF bytes using pypdf.
    """
    pdf_stream = BytesIO(content)
    reader = PdfReader(pdf_stream)

    texts: List[str] = []

    for page in reader.pages:
        page_text = page.extract_text() or ""
        if page_text.strip():
            texts.append(page_text.strip())

    full_text = "\n".join(texts).strip()

    if not full_text:
        raise ValueError("PDF contains no extractable text")

    return full_text


def _get_temp_upload_doc(conversation_id: str):
    return db.collection(TEMP_UPLOAD_COLLECTION).document(conversation_id)


def save_temp_upload_text(conversation_id: str, file_name: str, text: str) -> None:
    now = datetime.now(timezone.utc)
    doc_ref = _get_temp_upload_doc(conversation_id)

    if doc_ref.get().exists:
        doc_ref.set({"updated_at": now}, merge=True)
    else:
        doc_ref.set(
            {
                "conversation_id": conversation_id,
                "created_at": now,
                "updated_at": now,
            },
            merge=True,
        )

    doc_ref.collection("files").add(
        {
            "file_name": file_name or "unknown.pdf",
            "content": text,
            "created_at": now,
        }
    )


def get_temp_upload_texts(conversation_id: str, limit: int = TEMP_UPLOADS_LIMIT) -> List[str]:
    if not conversation_id:
        return []

    files_ref = (
        _get_temp_upload_doc(conversation_id)
        .collection("files")
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
    )

    docs = [doc.to_dict() for doc in files_ref.stream()]
    docs.reverse()

    return [
        doc.get("content", "").strip()
        for doc in docs
        if doc.get("content", "").strip()
    ]


@router.post("/upload/pdf")
async def upload_user_pdf(
    file: UploadFile = File(...),
    conversation_id: str = ""
):
    if not conversation_id.strip():
        raise HTTPException(status_code=400, detail="conversation_id is required")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    content = await file.read()

    if not content:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    try:
        text = extract_text_from_pdf(content)[:5000]
    except Exception as e:
        logger.exception("Failed to extract text from PDF '%s': %s", file.filename, str(e))
        raise HTTPException(status_code=400, detail="Failed to extract text from PDF")

    try:
        save_temp_upload_text(conversation_id=conversation_id, file_name=file.filename, text=text)
    except Exception as e:
        logger.exception(
            "Failed to save temporary upload to Firestore: conversation_id=%s file_name=%s error=%s",
            conversation_id,
            file.filename,
            str(e),
        )
        raise HTTPException(status_code=500, detail="Failed to store temporary upload")

    return {
        "status": "ok",
        "message": "Stored temporarily in Firestore",
    }
