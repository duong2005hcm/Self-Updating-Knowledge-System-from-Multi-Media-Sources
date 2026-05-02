from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.api.dependencies.admin_auth import verify_admin_token
from backend.app.models.ingest_job import IngestJob
from backend.app.schemas.ingest_job import (
    IngestJobDetailResponse,
    IngestJobListResponse,
    IngestJobResponse,
)
from backend.app.services.ingest_job_service import (
    IngestJobNotFoundError,
    IngestJobService,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/pipeline/jobs",
    tags=["Pipeline Jobs"],
    dependencies=[Depends(verify_admin_token)],
)


def get_ingest_job_service() -> IngestJobService:
    return IngestJobService()


def _to_response(job: IngestJob) -> IngestJobResponse:
    if hasattr(job, "model_dump"):
        return IngestJobResponse(**job.model_dump())
    return IngestJobResponse(**job.dict())


@router.get("", response_model=IngestJobListResponse)
def list_pipeline_jobs(
    limit: int = Query(default=50, ge=1, le=200),
    status: Optional[str] = Query(default=None),
    source_id: Optional[str] = Query(default=None),
    service: IngestJobService = Depends(get_ingest_job_service),
) -> IngestJobListResponse:
    try:
        items = service.list_jobs(
            limit=limit,
            status=status,
            source_id=source_id,
        )
        return IngestJobListResponse(
            items=[_to_response(item) for item in items],
            total=len(items),
        )
    except Exception as e:
        logger.exception("List ingest jobs failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to list ingest jobs: {str(e)}")


@router.get("/{job_id}", response_model=IngestJobDetailResponse)
def get_pipeline_job(
    job_id: str,
    service: IngestJobService = Depends(get_ingest_job_service),
) -> IngestJobDetailResponse:
    try:
        item = service.get_job(job_id)
        return IngestJobDetailResponse(item=_to_response(item))
    except IngestJobNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Get ingest job failed for job_id='%s': %s", job_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get ingest job: {str(e)}")
