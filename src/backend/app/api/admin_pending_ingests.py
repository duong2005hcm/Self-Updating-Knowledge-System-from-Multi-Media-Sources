from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.api.dependencies.admin_auth import verify_admin_token
from backend.app.models.pending_ingest import PendingIngest
from backend.app.schemas.pending_ingest import (
    PendingApproveRequest,
    PendingApproveResponse,
    PendingIngestDetailResponse,
    PendingIngestItem,
    PendingIngestListResponse,
    PendingRejectRequest,
    PendingRejectResponse,
)
from backend.app.services.pending_ingest_service import (
    PendingIngestInvalidError,
    PendingIngestNotFoundError,
    PendingIngestService,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/pending-ingests",
    tags=["Admin Pending Ingests"],
)


def get_pending_ingest_service() -> PendingIngestService:
    return PendingIngestService()


def _admin_identity(admin: dict[str, Any]) -> str:
    return str(admin.get("uid") or admin.get("sub") or admin.get("email") or "admin")


def _to_item(item: PendingIngest) -> PendingIngestItem:
    payload = item.model_dump() if hasattr(item, "model_dump") else item.dict()
    return PendingIngestItem(**payload)


@router.get("", response_model=PendingIngestListResponse)
def list_pending_ingests(
    status: Optional[str] = Query(default=None),
    source_id: Optional[str] = Query(default=None),
    corpus: Optional[str] = Query(default=None),
    content_subtype: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    _: dict[str, Any] = Depends(verify_admin_token),
    service: PendingIngestService = Depends(get_pending_ingest_service),
) -> PendingIngestListResponse:
    try:
        items = service.list_pending(
            status=status,
            source_id=source_id,
            corpus=corpus,
            content_subtype=content_subtype,
            limit=limit,
        )
        return PendingIngestListResponse(
            items=[_to_item(item) for item in items],
            count=len(items),
        )
    except Exception as exc:
        logger.exception("List pending ingests failed: %s", str(exc))
        raise HTTPException(status_code=500, detail=f"Failed to list pending ingests: {str(exc)}") from exc


@router.get("/{pending_id}", response_model=PendingIngestDetailResponse)
def get_pending_ingest(
    pending_id: str,
    _: dict[str, Any] = Depends(verify_admin_token),
    service: PendingIngestService = Depends(get_pending_ingest_service),
) -> PendingIngestDetailResponse:
    try:
        item, extracted_text, chunks = service.get_pending_detail(pending_id)
        return PendingIngestDetailResponse(
            item=_to_item(item),
            extracted_text=extracted_text,
            chunks=chunks,
        )
    except PendingIngestNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Get pending ingest failed for %s: %s", pending_id, str(exc))
        raise HTTPException(status_code=500, detail=f"Failed to get pending ingest: {str(exc)}") from exc


@router.post("/{pending_id}/approve", response_model=PendingApproveResponse)
def approve_pending_ingest(
    pending_id: str,
    request: PendingApproveRequest | None = None,
    admin: dict[str, Any] = Depends(verify_admin_token),
    service: PendingIngestService = Depends(get_pending_ingest_service),
) -> PendingApproveResponse:
    try:
        result = service.approve_pending(
            pending_id=pending_id,
            reviewed_by=_admin_identity(admin),
            note=request.note if request else None,
        )
        return PendingApproveResponse(**result)
    except PendingIngestNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PendingIngestInvalidError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Approve pending ingest failed for %s: %s", pending_id, str(exc))
        raise HTTPException(status_code=500, detail=f"Failed to approve pending ingest: {str(exc)}") from exc


@router.post("/{pending_id}/reject", response_model=PendingRejectResponse)
def reject_pending_ingest(
    pending_id: str,
    request: PendingRejectRequest | None = None,
    admin: dict[str, Any] = Depends(verify_admin_token),
    service: PendingIngestService = Depends(get_pending_ingest_service),
) -> PendingRejectResponse:
    try:
        item = service.reject_pending(
            pending_id=pending_id,
            reviewed_by=_admin_identity(admin),
            reason=request.reason if request else None,
        )
        return PendingRejectResponse(
            pending_id=item.pending_id,
            message="Pending ingest was rejected.",
        )
    except PendingIngestNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Reject pending ingest failed for %s: %s", pending_id, str(exc))
        raise HTTPException(status_code=500, detail=f"Failed to reject pending ingest: {str(exc)}") from exc
