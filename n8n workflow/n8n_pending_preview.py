from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from backend.app.api.dependencies.n8n_auth import verify_n8n_ingest_secret
from backend.app.schemas.pending_ingest import PendingIngestPreviewResponse
from backend.app.services.pending_ingest_service import PendingIngestService

router = APIRouter(prefix="/ingest", tags=["Pending Ingest Preview"])


def get_pending_ingest_service() -> PendingIngestService:
    return PendingIngestService()


def _preview_response(item: dict[str, Any]) -> dict[str, Any]:
    action = item.get("_preview_action")
    if not action:
        action = "pending_created" if item.get("status") == "pending" else "failed"
    status = item.get("_preview_status")
    if not status:
        status = "ok" if action in {"pending_created", "pending_exists", "already_approved"} else item.get("status", "failed")
    message = item.get("_preview_message")
    if not message:
        message = "Pending ingest created for admin review" if action == "pending_created" else item.get("preview_error") or "Pending ingest preview failed"

    return {
        "status": status,
        "action": action,
        "pending_id": item.get("id"),
        "source_id": item.get("source_id") or "",
        "url": item.get("url"),
        "pdf_url": item.get("pdf_url"),
        "title": item.get("title"),
        "text_length": int(item.get("text_length") or 0),
        "chunk_count": int(item.get("chunk_count") or 0),
        "message": message,
    }


@router.post("/web/preview", response_model=PendingIngestPreviewResponse)
def create_web_preview(
    payload: dict[str, Any],
    actor: dict[str, Any] = Depends(verify_n8n_ingest_secret),
    service: PendingIngestService = Depends(get_pending_ingest_service),
):
    item = service.create_web_preview(payload, actor)
    return _preview_response(item)


@router.post("/pdf-url/preview", response_model=PendingIngestPreviewResponse)
def create_pdf_url_preview(
    payload: dict[str, Any],
    actor: dict[str, Any] = Depends(verify_n8n_ingest_secret),
    service: PendingIngestService = Depends(get_pending_ingest_service),
):
    item = service.create_pdf_url_preview(payload, actor)
    return _preview_response(item)
