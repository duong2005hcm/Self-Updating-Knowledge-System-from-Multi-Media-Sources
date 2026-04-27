from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.api.dependencies.admin_auth import verify_admin_token
from backend.app.models.source import Source
from backend.app.repositories.source_repository import SourceRepository, get_source_repository
from backend.app.schemas.source import (
    SourceCreateRequest,
    SourceCreateResponse,
    SourceDeleteResponse,
    SourceListResponse,
    SourceResponse,
    SourceUpdateRequest,
)
from backend.app.services.source_service import (
    SourceConflictError,
    SourceInvalidUpdateError,
    SourceNotFoundError,
    SourceService,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/sources",
    tags=["Sources"],
)


def get_source_service(
    repo: SourceRepository = Depends(get_source_repository),
) -> SourceService:
    return SourceService(repo)


def _to_response(source: Source) -> SourceResponse:
    if hasattr(source, "model_dump"):
        return SourceResponse(**source.model_dump())
    return SourceResponse(**source.dict())


@router.get("", response_model=SourceListResponse)
def list_sources(
    source_type: Optional[str] = Query(default=None, alias="type"),
    active: Optional[bool] = Query(default=None),
    domain: Optional[str] = Query(default=None),
    _admin: dict[str, Any] = Depends(verify_admin_token),
    service: SourceService = Depends(get_source_service),
) -> SourceListResponse:
    del _admin
    try:
        items = service.list_sources(source_type=source_type, active=active, domain=domain)
        return SourceListResponse(items=[_to_response(item) for item in items], total=len(items))
    except Exception as e:
        logger.exception("List sources failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to list sources: {str(e)}")


@router.post("", response_model=SourceCreateResponse)
def create_source(
    payload: SourceCreateRequest,
    admin: dict[str, Any] = Depends(verify_admin_token),
    service: SourceService = Depends(get_source_service),
) -> SourceCreateResponse:
    actor = (
        str(admin.get("uid") or "")
        or str(admin.get("email") or "")
        or "admin"
    )

    try:
        created = service.create_source(payload, actor=actor)
        return {
            "status": "ok",
            "item": _to_response(created),
        }
    except SourceConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        logger.exception("Create source failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to create source: {str(e)}")


@router.get("/{source_id}", response_model=SourceCreateResponse)
def get_source(
    source_id: str,
    _admin: dict[str, Any] = Depends(verify_admin_token),
    service: SourceService = Depends(get_source_service),
) -> SourceCreateResponse:
    del _admin
    try:
        item = service.get_source(source_id=source_id)
        return {
            "status": "ok",
            "item": _to_response(item),
        }
    except SourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Get source failed for source_id='%s': %s", source_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get source: {str(e)}")


@router.patch("/{source_id}/toggle", response_model=SourceCreateResponse)
def toggle_source(
    source_id: str,
    admin: dict[str, Any] = Depends(verify_admin_token),
    service: SourceService = Depends(get_source_service),
) -> SourceCreateResponse:
    del admin
    try:
        item = service.toggle_source(source_id=source_id)
        return {
            "status": "ok",
            "item": _to_response(item),
        }
    except SourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Toggle source failed for source_id='%s': %s", source_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to toggle source: {str(e)}")


# NOTE: this endpoint intentionally uses PUT with partial-update semantics
# for the current Phase 2 scope.
@router.put("/{source_id}", response_model=SourceCreateResponse)
def update_source(
    source_id: str,
    payload: SourceUpdateRequest,
    admin: dict[str, Any] = Depends(verify_admin_token),
    service: SourceService = Depends(get_source_service),
) -> SourceCreateResponse:
    del admin
    try:
        item = service.update_source(source_id=source_id, payload=payload)
        return {
            "status": "ok",
            "item": _to_response(item),
        }
    except SourceInvalidUpdateError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except SourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Update source failed for source_id='%s': %s", source_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to update source: {str(e)}")


@router.delete("/{source_id}", response_model=SourceDeleteResponse)
def delete_source(
    source_id: str,
    admin: dict[str, Any] = Depends(verify_admin_token),
    service: SourceService = Depends(get_source_service),
) -> SourceDeleteResponse:
    del admin
    try:
        deleted_id = service.delete_source(source_id=source_id)
        return {
            "status": "ok",
            "deleted_id": deleted_id,
        }
    except SourceNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Delete source failed for source_id='%s': %s", source_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to delete source: {str(e)}")
