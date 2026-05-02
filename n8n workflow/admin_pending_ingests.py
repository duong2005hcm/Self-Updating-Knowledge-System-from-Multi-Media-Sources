from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query

from backend.app.api.dependencies.admin_auth import verify_admin_token
from backend.app.schemas.pending_ingest import (
    PendingIngestApproveResponse,
    PendingIngestListResponse,
    PendingIngestRejectRequest,
    PendingIngestRejectResponse,
    PendingIngestResponse,
)
from backend.app.services.pending_ingest_service import PendingIngestService

router = APIRouter(prefix="/admin/pending-ingests", tags=["Pending Ingests"])
PENDING_SORT_FIELDS = {"updated_at", "created_at", "reviewed_at", "title", "source_id"}


def get_pending_ingest_service() -> PendingIngestService:
    return PendingIngestService()


@router.get("", response_model=PendingIngestListResponse)
def list_pending_ingests(
    status: Optional[str] = Query(default=None),
    source_id: Optional[str] = Query(default=None),
    corpus: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    sort_by: str = Query(default="updated_at"),
    sort_order: str = Query(default="desc"),
    _admin: dict[str, Any] = Depends(verify_admin_token),
    service: PendingIngestService = Depends(get_pending_ingest_service),
):
    normalized_sort_by = sort_by if sort_by in PENDING_SORT_FIELDS else "updated_at"
    normalized_sort_order = "asc" if sort_order.lower() == "asc" else "desc"
    items, total = service.list_pending(
        status,
        source_id,
        corpus,
        limit,
        offset,
        normalized_sort_by,
        normalized_sort_order,
    )
    slim_items = [
        {
            "id": item.get("id"),
            "source_id": item.get("source_id") or "",
            "source_name": item.get("source_name"),
            "source_kind": item.get("source_kind") or "html_page",
            "corpus": item.get("corpus") or "disease_core",
            "content_subtype": item.get("content_subtype") or "disease_reference",
            "url": item.get("url"),
            "pdf_url": item.get("pdf_url"),
            "title": item.get("title"),
            "disease_name": item.get("disease_name"),
            "canonical_key": item.get("canonical_key"),
            "status": item.get("status") or "pending",
            "text_length": int(item.get("text_length") or 0),
            "chunk_count": int(item.get("chunk_count") or 0),
            "created_at": item.get("created_at") or "",
            "updated_at": item.get("updated_at") or "",
            "reviewed_at": item.get("reviewed_at"),
            "reviewed_by": item.get("reviewed_by"),
            "approved_document_id": item.get("approved_document_id"),
            "approved_version_id": item.get("approved_version_id"),
            "approved_ingest_job_id": item.get("approved_ingest_job_id"),
            "approved_chroma_collection": item.get("approved_chroma_collection"),
        }
        for item in items
    ]
    return {"items": slim_items, "total": total}


@router.get("/{pending_id}", response_model=PendingIngestResponse)
def get_pending_ingest(
    pending_id: str,
    _admin: dict[str, Any] = Depends(verify_admin_token),
    service: PendingIngestService = Depends(get_pending_ingest_service),
):
    return service.get_pending(pending_id)


@router.post("/{pending_id}/approve", response_model=PendingIngestApproveResponse)
def approve_pending_ingest(
    pending_id: str,
    admin: dict[str, Any] = Depends(verify_admin_token),
    service: PendingIngestService = Depends(get_pending_ingest_service),
):
    return service.approve_pending(pending_id, admin)


@router.post("/{pending_id}/reject", response_model=PendingIngestRejectResponse)
def reject_pending_ingest(
    pending_id: str,
    request: PendingIngestRejectRequest,
    admin: dict[str, Any] = Depends(verify_admin_token),
    service: PendingIngestService = Depends(get_pending_ingest_service),
):
    return service.reject_pending(pending_id, request.reason, admin)
