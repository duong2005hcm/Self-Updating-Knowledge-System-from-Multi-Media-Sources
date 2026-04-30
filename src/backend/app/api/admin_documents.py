from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from backend.app.api.dependencies.admin_auth import verify_admin_token
from backend.app.models.document import Document
from backend.app.schemas.document import (
    DocumentResponse,
    DocumentSummaryUpdateRequest,
    DocumentSummaryUpdateResponse,
)
from backend.app.services.document_service import DocumentNotFoundError, DocumentService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/documents",
    tags=["Admin Documents"],
)


def get_document_service() -> DocumentService:
    return DocumentService()


def _admin_identity(admin: dict[str, Any]) -> str:
    return str(admin.get("uid") or admin.get("sub") or admin.get("email") or "admin")


def _to_response(document: Document) -> DocumentResponse:
    if hasattr(document, "model_dump"):
        return DocumentResponse(**document.model_dump())
    return DocumentResponse(**document.dict())


@router.patch("/{document_id}/summary", response_model=DocumentSummaryUpdateResponse)
def update_document_summary(
    document_id: str,
    payload: DocumentSummaryUpdateRequest,
    admin: dict[str, Any] = Depends(verify_admin_token),
    service: DocumentService = Depends(get_document_service),
) -> DocumentSummaryUpdateResponse:
    normalized_status = (payload.summary_status or "draft").strip().lower()
    if normalized_status not in {"draft", "approved"}:
        raise HTTPException(status_code=400, detail="summary_status must be draft or approved")

    normalized_summary = (payload.summary or "").strip()
    if normalized_status == "approved" and not normalized_summary:
        raise HTTPException(status_code=400, detail="summary is required before approval")
    if len(normalized_summary) > 3000:
        raise HTTPException(status_code=400, detail="summary must be <= 3000 characters")
    if len(payload.key_points or []) > 10:
        raise HTTPException(status_code=400, detail="key_points must contain <= 10 items")
    if len(payload.suggested_tags or []) > 10:
        raise HTTPException(status_code=400, detail="suggested_tags must contain <= 10 items")

    try:
        item = service.update_document_summary(
            document_id=document_id,
            version_id=payload.version_id,
            summary=normalized_summary,
            key_points=payload.key_points,
            medical_warning=payload.medical_warning,
            suggested_tags=payload.suggested_tags,
            suggested_topic=payload.suggested_topic,
            summary_status=normalized_status,
            updated_by=_admin_identity(admin),
        )
        return DocumentSummaryUpdateResponse(
            document_id=document_id,
            version_id=payload.version_id,
            summary_status=normalized_status,
            item=_to_response(item),
        )
    except DocumentNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Update document summary failed document_id='%s': %s", document_id, str(exc))
        raise HTTPException(status_code=500, detail=f"Failed to update summary: {str(exc)}")
