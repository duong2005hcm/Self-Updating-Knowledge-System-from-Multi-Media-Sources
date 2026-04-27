from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from backend.app.api.dependencies.admin_auth import verify_admin_token
from backend.app.repositories.article_repository import ArticleRepository, get_article_repository
from backend.app.schemas.article import (
    ExternalNewsIngestItemResponse,
    ExternalNewsIngestRequest,
    ExternalNewsIngestResponse,
    ExternalNewsIngestSourceResponse,
)
from backend.app.services.article_service import ArticleService
from backend.app.services.external_news_ingest_service import ExternalNewsIngestService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/articles",
    tags=["Admin Articles"],
)


def get_admin_external_news_ingest_service(
    repository: ArticleRepository = Depends(get_article_repository),
) -> ExternalNewsIngestService:
    article_service = ArticleService(repository)
    return ExternalNewsIngestService(article_service)


@router.post("/ingest", response_model=ExternalNewsIngestResponse)
def ingest_external_news_admin(
    payload: ExternalNewsIngestRequest,
    _admin: dict[str, Any] = Depends(verify_admin_token),
    service: ExternalNewsIngestService = Depends(get_admin_external_news_ingest_service),
) -> ExternalNewsIngestResponse:
    try:
        result = service.ingest(
            source_name=payload.source_name,
            limit_per_source=payload.limit_per_source,
            query=payload.query,
            topic=payload.topic,
            tags=payload.tags,
        )
        return ExternalNewsIngestResponse(
            source_name=result.source_name,
            limit_per_source=result.limit_per_source,
            created_count=result.created_count,
            skipped_count=result.skipped_count,
            failed_count=result.failed_count,
            items=[
                ExternalNewsIngestItemResponse(
                    source_name=item.source_name,
                    action=item.action,
                    dedup_matched_by=item.dedup_matched_by,
                    external_id=item.external_id,
                    source_url=item.source_url,
                    title=item.title,
                    article_id=item.article_id,
                )
                for item in result.items
            ],
            sources=[
                ExternalNewsIngestSourceResponse(
                    source_key=source.source_key,
                    source_name=source.source_name,
                    requested=source.requested,
                    created_count=source.created_count,
                    skipped_count=source.skipped_count,
                    failed_count=source.failed_count,
                    error=source.error,
                )
                for source in result.sources
            ],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Admin external news ingest failed: %s", str(e))
        raise HTTPException(
            status_code=502,
            detail=f"Failed to ingest external news: {str(e)}",
        )
