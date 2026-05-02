from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from backend.app.api.dependencies.admin_auth import verify_admin_token
from backend.app.models.document import Document
from backend.app.schemas.document import DocumentDetailResponse, DocumentResponse
from backend.app.services.governance_service import (
    GovernanceDocumentNotFoundError,
    GovernanceService,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/governance",
    tags=["Admin Governance"],
)


def get_governance_service() -> GovernanceService:
    return GovernanceService()


def _to_response(document: Document) -> DocumentResponse:
    if hasattr(document, "model_dump"):
        return DocumentResponse(**document.model_dump())
    return DocumentResponse(**document.dict())


def _admin_identity(admin: dict[str, Any]) -> str:
    return (
        str(admin.get("uid") or admin.get("sub") or admin.get("email") or "unknown_admin")
    )


@router.patch("/documents/{document_id}/approve", response_model=DocumentDetailResponse)
def approve_document(
    document_id: str,
    admin: dict[str, Any] = Depends(verify_admin_token),
    service: GovernanceService = Depends(get_governance_service),
) -> DocumentDetailResponse:
    try:
        item = service.approve_document(document_id, reviewed_by=_admin_identity(admin))
        return DocumentDetailResponse(item=_to_response(item))
    except GovernanceDocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Approve document failed for document_id='%s': %s", document_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to approve document: {str(e)}")


@router.patch("/documents/{document_id}/reject", response_model=DocumentDetailResponse)
def reject_document(
    document_id: str,
    admin: dict[str, Any] = Depends(verify_admin_token),
    service: GovernanceService = Depends(get_governance_service),
) -> DocumentDetailResponse:
    try:
        item = service.reject_document(document_id, reviewed_by=_admin_identity(admin))
        return DocumentDetailResponse(item=_to_response(item))
    except GovernanceDocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Reject document failed for document_id='%s': %s", document_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to reject document: {str(e)}")


@router.patch("/documents/{document_id}/deactivate", response_model=DocumentDetailResponse)
def deactivate_document(
    document_id: str,
    admin: dict[str, Any] = Depends(verify_admin_token),
    service: GovernanceService = Depends(get_governance_service),
) -> DocumentDetailResponse:
    try:
        item = service.deactivate_document(document_id, reviewed_by=_admin_identity(admin))
        return DocumentDetailResponse(item=_to_response(item))
    except GovernanceDocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Deactivate document failed for document_id='%s': %s", document_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to deactivate document: {str(e)}")


@router.patch("/documents/{document_id}/reactivate", response_model=DocumentDetailResponse)
def reactivate_document(
    document_id: str,
    admin: dict[str, Any] = Depends(verify_admin_token),
    service: GovernanceService = Depends(get_governance_service),
) -> DocumentDetailResponse:
    try:
        item = service.reactivate_document(document_id, reviewed_by=_admin_identity(admin))
        return DocumentDetailResponse(item=_to_response(item))
    except GovernanceDocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Reactivate document failed for document_id='%s': %s", document_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to reactivate document: {str(e)}")
