from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.api.dependencies.admin_auth import verify_admin_token
from backend.app.models.article import Article
from backend.app.repositories.article_repository import ArticleRepository, get_article_repository
from backend.app.schemas.article import (
    ArticleCreateResponse,
    ArticleListResponse,
    ArticleModerationRequest,
    ArticleResponse,
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


def get_admin_article_service(
    repository: ArticleRepository = Depends(get_article_repository),
) -> ArticleService:
    return ArticleService(repository)


def _to_response(article: Article) -> ArticleResponse:
    if hasattr(article, "model_dump"):
        return ArticleResponse(**article.model_dump())
    return ArticleResponse(**article.dict())


def _article_response(action: str, article: Article) -> ArticleCreateResponse:
    return ArticleCreateResponse(
        status="ok",
        action=action,
        item=_to_response(article),
    )


@router.get("", response_model=ArticleListResponse)
def list_admin_articles(
    limit: int = Query(default=50, ge=1, le=200),
    status: str | None = Query(default=None),
    visibility: str | None = Query(default=None),
    topic: str | None = Query(default=None),
    source_type: str | None = Query(default=None),
    _admin: dict[str, Any] = Depends(verify_admin_token),
    service: ArticleService = Depends(get_admin_article_service),
) -> ArticleListResponse:
    try:
        items = service.list_articles(
            limit=limit,
            status=status,
            visibility=visibility,
            topic=topic,
            source_type=source_type,
        )
        return ArticleListResponse(
            items=[_to_response(item) for item in items],
            total=len(items),
        )
    except Exception as e:
        logger.exception("Admin list articles failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to list admin articles: {str(e)}")


@router.patch("/{article_id}/approve", response_model=ArticleCreateResponse)
def approve_article(
    article_id: str,
    payload: ArticleModerationRequest | None = None,
    _admin: dict[str, Any] = Depends(verify_admin_token),
    service: ArticleService = Depends(get_admin_article_service),
) -> ArticleCreateResponse:
    next_status = payload.status if payload and payload.status else "published"
    article = service.update_article(article_id, status=next_status, visibility="public")
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")
    return _article_response("approved", article)


@router.patch("/{article_id}/publish", response_model=ArticleCreateResponse)
def publish_article(
    article_id: str,
    payload: ArticleModerationRequest | None = None,
    _admin: dict[str, Any] = Depends(verify_admin_token),
    service: ArticleService = Depends(get_admin_article_service),
) -> ArticleCreateResponse:
    next_status = payload.status if payload and payload.status else "published"
    article = service.update_article(article_id, status=next_status, visibility="public")
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")
    return _article_response("published", article)


@router.patch("/{article_id}/reject", response_model=ArticleCreateResponse)
def reject_article(
    article_id: str,
    _admin: dict[str, Any] = Depends(verify_admin_token),
    service: ArticleService = Depends(get_admin_article_service),
) -> ArticleCreateResponse:
    article = service.update_article(article_id, status="rejected")
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")
    return _article_response("rejected", article)


@router.patch("/{article_id}/hide", response_model=ArticleCreateResponse)
def hide_article(
    article_id: str,
    _admin: dict[str, Any] = Depends(verify_admin_token),
    service: ArticleService = Depends(get_admin_article_service),
) -> ArticleCreateResponse:
    article = service.update_article(article_id, status="hidden", visibility="private")
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")
    return _article_response("hidden", article)


@router.delete("/{article_id}", response_model=ArticleCreateResponse)
def delete_article(
    article_id: str,
    _admin: dict[str, Any] = Depends(verify_admin_token),
    service: ArticleService = Depends(get_admin_article_service),
) -> ArticleCreateResponse:
    try:
        article = service.delete_article(article_id)
        if article is None:
            raise HTTPException(status_code=404, detail="Article not found")
        return _article_response("deleted", article)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Admin delete article failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to delete article: {str(e)}")


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
