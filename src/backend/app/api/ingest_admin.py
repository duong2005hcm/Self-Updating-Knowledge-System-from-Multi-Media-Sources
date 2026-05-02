import logging
import os
from typing import Any

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException

from backend.app.api.dependencies.admin_auth import verify_admin_token
from backend.app.schemas.ingest_metadata import (
    IngestMetadata,
    WebIngestRequest,
    parse_ingest_metadata_form,
)
from backend.app.services.ingest_orchestration_service import IngestOrchestrationService

router = APIRouter(
    prefix="/admin",
    tags=["Admin Ingest"],
    dependencies=[Depends(verify_admin_token)],
)
logger = logging.getLogger(__name__)

UPLOAD_DIR = "data/uploads/pdf"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/ingest/pdf")
async def ingest_pdf(
    file: UploadFile = File(...),
    pdf_url: str | None = Form(default=None),
    ingest_metadata: IngestMetadata = Depends(parse_ingest_metadata_form),
    decoded_token: dict[str, Any] = Depends(verify_admin_token),
):
    file_bytes = await file.read()
    actor = ingest_metadata.resolve_actor(decoded_token)
    orchestrator = IngestOrchestrationService()

    try:
        return orchestrator.ingest_pdf(
            file_bytes=file_bytes,
            filename=file.filename or "",
            source_url=(pdf_url or "").strip() or None,
            ingest_metadata=ingest_metadata,
            actor=actor,
            upload_dir=UPLOAD_DIR,
            include_filename=False,
            include_collection=False,
            include_processing_time=False,
        )
    except Exception as e:
        logger.exception("Admin ingest PDF failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Admin ingest PDF failed: {str(e)}")


@router.post("/ingest/web")
def ingest_web(
    req: WebIngestRequest,
    decoded_token: dict[str, Any] = Depends(verify_admin_token),
):
    actor = req.resolve_actor(decoded_token)
    orchestrator = IngestOrchestrationService()

    try:
        return orchestrator.ingest_web(
            url=req.url,
            limit=req.limit,
            ingest_metadata=req,
            actor=actor,
            data_type_resolver=None,
            include_web_type=False,
            include_outputs=False,
        )
    except Exception as e:
        logger.exception("Admin ingest web failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Admin ingest web failed: {str(e)}")
