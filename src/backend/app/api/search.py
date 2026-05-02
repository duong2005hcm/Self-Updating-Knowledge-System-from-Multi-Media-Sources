from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.api.dependencies.authz import Principal, Role, get_current_principal
from backend.app.schemas.search import SearchMode, SearchRequest, SearchResponse, SearchSortBy, SearchSortOrder
from backend.app.services.search_service import SearchBackendUnavailableError, SearchService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/search",
    tags=["Search"],
)


def get_search_service() -> SearchService:
    return SearchService()


def _execute_search(
    *,
    service: SearchService,
    payload: SearchRequest,
    principal: Principal,
) -> SearchResponse:
    payload = _apply_search_policy(payload, principal)
    items, matched_total = service.search_documents(
        search_mode=payload.search_mode,
        q=payload.q,
        min_score=payload.min_score,
        debug=payload.debug,
        domain=payload.domain,
        source_id=payload.source_id,
        source_type=payload.source_type,
        status=payload.status,
        priority=payload.priority,
        visibility=payload.visibility,
        created_by=payload.created_by,
        updated_after=payload.updated_after,
        updated_before=payload.updated_before,
        sort_by=payload.sort_by,
        sort_order=payload.sort_order,
        offset=payload.offset,
        limit=payload.limit,
    )
    return SearchResponse(
        items=items,
        total=len(items),
        matched_total=matched_total,
        offset=payload.offset,
        limit=payload.limit,
        message="Không tìm thấy tài liệu phù hợp." if payload.q and not items else None,
    )


def _copy_search_request(payload: SearchRequest, updates: dict) -> SearchRequest:
    if hasattr(payload, "model_copy"):
        return payload.model_copy(update=updates)
    return payload.copy(update=updates)


def _apply_search_policy(payload: SearchRequest, principal: Principal) -> SearchRequest:
    if principal.role == Role.admin:
        return payload

    limit_cap = 10 if principal.role == Role.guest else 50
    updates = {
        "status": "active",
        "visibility": "public",
        "created_by": None,
        "limit": min(payload.limit, limit_cap),
    }
    return _copy_search_request(payload, updates)


@router.get("", response_model=SearchResponse, response_model_exclude_none=True)
def search_documents(
    search_mode: SearchMode = Query(default=SearchMode.keyword),
    q: Optional[str] = Query(default=None),
    min_score: Optional[float] = Query(default=None, ge=0, le=1),
    debug: bool = Query(default=False),
    domain: Optional[str] = Query(default=None),
    source_id: Optional[str] = Query(default=None),
    source_type: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    visibility: Optional[str] = Query(default=None),
    created_by: Optional[str] = Query(default=None),
    updated_after: Optional[datetime] = Query(default=None),
    updated_before: Optional[datetime] = Query(default=None),
    sort_by: Optional[SearchSortBy] = Query(default=None),
    sort_order: Optional[SearchSortOrder] = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    service: SearchService = Depends(get_search_service),
    principal: Principal = Depends(get_current_principal),
) -> SearchResponse:
    try:
        payload = SearchRequest(
            search_mode=search_mode,
            q=q,
            min_score=min_score,
            debug=debug,
            domain=domain,
            source_id=source_id,
            source_type=source_type,
            status=status,
            priority=priority,
            visibility=visibility,
            created_by=created_by,
            updated_after=updated_after,
            updated_before=updated_before,
            sort_by=sort_by,
            sort_order=sort_order,
            offset=offset,
            limit=limit,
        )
        return _execute_search(
            service=service,
            payload=payload,
            principal=principal,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except SearchBackendUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Search documents failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to search documents: {str(e)}")


@router.post("", response_model=SearchResponse, response_model_exclude_none=True)
def search_documents_post(
    payload: SearchRequest,
    service: SearchService = Depends(get_search_service),
    principal: Principal = Depends(get_current_principal),
) -> SearchResponse:
    try:
        return _execute_search(
            service=service,
            payload=payload,
            principal=principal,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except SearchBackendUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Search documents failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to search documents: {str(e)}")
