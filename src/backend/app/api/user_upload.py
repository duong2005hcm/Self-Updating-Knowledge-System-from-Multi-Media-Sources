from fastapi import APIRouter, UploadFile, File
from typing import Dict, List

router = APIRouter(prefix="/user", tags=["User Upload"])

# 🔥 temp storage
USER_TEMP_DATA: Dict[str, List[str]] = {}


@router.post("/upload/pdf")
async def upload_user_pdf(
    file: UploadFile = File(...),
    conversation_id: str = ""
):
    content = await file.read()

    text = content.decode(errors="ignore")[:5000]

    USER_TEMP_DATA.setdefault(conversation_id, []).append(text)

    return {
        "status": "ok",
        "message": "Stored temporarily (not in ChromaDB)"
    }