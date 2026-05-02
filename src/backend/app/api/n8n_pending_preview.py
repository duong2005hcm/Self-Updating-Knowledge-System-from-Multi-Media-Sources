from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from backend.app.api.dependencies.n8n_auth import verify_n8n_ingest_secret
from backend.app.schemas.pending_ingest import N8nPendingPreviewRequest, PendingPreviewResponse
from backend.app.services.pending_ingest_service import (
    PendingIngestInvalidError,
    PendingIngestService,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/internal/n8n/pending/preview",
    tags=["N8N Pending Preview"],
)


def get_pending_ingest_service() -> PendingIngestService:
    return PendingIngestService()


@router.post("/web", response_model=PendingPreviewResponse)
def create_web_pending_preview(
    request: N8nPendingPreviewRequest,
    _: bool = Depends(verify_n8n_ingest_secret),
    service: PendingIngestService = Depends(get_pending_ingest_service),
) -> PendingPreviewResponse:
    try:
        return PendingPreviewResponse(**service.create_web_preview(request))
    except PendingIngestInvalidError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("n8n web pending preview failed: %s", str(exc))
        raise HTTPException(status_code=500, detail=f"Pending web preview failed: {str(exc)}") from exc


@router.post("/pdf-url", response_model=PendingPreviewResponse)
def create_pdf_url_pending_preview(
    request: N8nPendingPreviewRequest,
    _: bool = Depends(verify_n8n_ingest_secret),
    service: PendingIngestService = Depends(get_pending_ingest_service),
) -> PendingPreviewResponse:
    try:
        return PendingPreviewResponse(**service.create_pdf_url_preview(request))
    except PendingIngestInvalidError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("n8n PDF URL pending preview failed: %s", str(exc))
        raise HTTPException(status_code=500, detail=f"Pending PDF preview failed: {str(exc)}") from exc
