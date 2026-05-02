from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.api.dependencies.admin_auth import verify_admin_token
from backend.app.api.dependencies.authz import (
    Principal,
    Role,
    get_current_principal,
    require_authenticated_principal,
)
from backend.app.models.article import Article
from backend.app.repositories.article_repository import ArticleRepository, get_article_repository
from backend.app.schemas.article import (
    ArticleCreateRequest,
    ArticleCreateResponse,
    ArticleListResponse,
    ArticleResponse,
    ExternalNewsIngestItemResponse,
    ExternalNewsIngestRequest,
    ExternalNewsIngestResponse,
    ExternalNewsIngestSourceResponse,
    EuropePmcFetchItemResponse,
    EuropePmcFetchRequest,
    EuropePmcFetchResponse,
    MohFetchItemResponse,
    MohFetchRequest,
    MohFetchResponse,
)
from backend.app.services.article_service import ArticleService, PUBLIC_ARTICLE_STATUSES
from backend.app.services.europe_pmc_fetcher import EuropePmcFetcher
from backend.app.services.external_news_ingest_service import ExternalNewsIngestService
from backend.app.services.moh_fetcher import MohFetcher

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/articles",
    tags=["Articles"],
)


def get_article_service(
    repository: ArticleRepository = Depends(get_article_repository),
) -> ArticleService:
    return ArticleService(repository)


def get_europe_pmc_fetcher(
    service: ArticleService = Depends(get_article_service),
) -> EuropePmcFetcher:
    return EuropePmcFetcher(service)


def get_moh_fetcher(
    service: ArticleService = Depends(get_article_service),
) -> MohFetcher:
    return MohFetcher(service)


def get_external_news_ingest_service(
    service: ArticleService = Depends(get_article_service),
) -> ExternalNewsIngestService:
    return ExternalNewsIngestService(service)


def _to_response(article: Article) -> ArticleResponse:
    if hasattr(article, "model_dump"):
        return ArticleResponse(**article.model_dump())
    return ArticleResponse(**article.dict())


def _copy_article_request(payload: ArticleCreateRequest, updates: dict) -> ArticleCreateRequest:
    if hasattr(payload, "model_copy"):
        return payload.model_copy(update=updates)
    return payload.copy(update=updates)


def _is_public_article(article: Article) -> bool:
    return article.visibility == "public" and article.status in PUBLIC_ARTICLE_STATUSES


@router.post("", response_model=ArticleCreateResponse)
def create_article(
    payload: ArticleCreateRequest,
    principal: Principal = Depends(require_authenticated_principal),
    service: ArticleService = Depends(get_article_service),
) -> ArticleCreateResponse:
    try:
        updates = {
            "author_id": payload.author_id or principal.uid or principal.email,
            "author_name": payload.author_name or principal.email or principal.uid,
        }
        if principal.role != Role.admin:
            updates.update(
                {
                    "status": "pending",
                    "visibility": "public",
                    "source_type": payload.source_type or "community",
                    "source_name": payload.source_name or "Cộng đồng",
                }
            )
        result = service.create_article(_copy_article_request(payload, updates))
        return ArticleCreateResponse(
            action=result.action,
            dedup_matched_by=result.dedup_matched_by,
            item=_to_response(result.article),
        )
    except Exception as e:
        logger.exception("Create article failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to create article: {str(e)}")


@router.get("", response_model=ArticleListResponse)
def list_articles(
    limit: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = Query(default=None),
    visibility: Optional[str] = Query(default=None),
    topic: Optional[str] = Query(default=None),
    source_name: Optional[str] = Query(default=None),
    content_type: Optional[str] = Query(default=None),
    principal: Principal = Depends(get_current_principal),
    service: ArticleService = Depends(get_article_service),
) -> ArticleListResponse:
    try:
        if principal.role != Role.admin:
            items = service.list_public_articles(
                limit=min(limit, 50),
                topic=topic,
                source_name=source_name,
                content_type=content_type,
            )
        else:
            items = service.list_articles(
                limit=limit,
                status=status,
                visibility=visibility,
                topic=topic,
                source_name=source_name,
                content_type=content_type,
            )
        logger.info(
            "articles_list_result role=%s limit=%s topic=%s source_name=%s content_type=%s total=%s",
            principal.role.value if hasattr(principal.role, "value") else str(principal.role),
            limit,
            topic or "",
            source_name or "",
            content_type or "",
            len(items),
        )
        return ArticleListResponse(
            items=[_to_response(item) for item in items],
            total=len(items),
        )
    except Exception as e:
        logger.exception("List articles failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to list articles: {str(e)}")


@router.get("/latest", response_model=ArticleListResponse)
def list_latest_public_articles(
    limit: int = Query(default=6, ge=1, le=20),
    topic: Optional[str] = Query(default=None),
    source_name: Optional[str] = Query(default=None),
    content_type: Optional[str] = Query(default=None),
    service: ArticleService = Depends(get_article_service),
) -> ArticleListResponse:
    try:
        items = service.list_public_articles(
            limit=limit,
            topic=topic,
            source_name=source_name,
            content_type=content_type,
        )
        logger.info(
            "articles_latest_public_result limit=%s topic=%s source_name=%s content_type=%s total=%s",
            limit,
            topic or "",
            source_name or "",
            content_type or "",
            len(items),
        )
        return ArticleListResponse(
            items=[_to_response(item) for item in items],
            total=len(items),
        )
    except Exception as e:
        logger.exception("List latest public articles failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to list latest articles: {str(e)}")


@router.get("/mine", response_model=ArticleListResponse)
def list_my_articles(
    limit: int = Query(default=50, ge=1, le=100),
    status: Optional[str] = Query(default=None),
    principal: Principal = Depends(require_authenticated_principal),
    service: ArticleService = Depends(get_article_service),
) -> ArticleListResponse:
    try:
        author_id = principal.uid or principal.email
        if not author_id:
            raise HTTPException(status_code=401, detail="Authenticated user id is required")

        items = service.list_user_articles(
            author_id=author_id,
            author_name=principal.email,
            limit=limit,
            status=status,
        )
        return ArticleListResponse(
            items=[_to_response(item) for item in items],
            total=len(items),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("List user articles failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to list user articles: {str(e)}")


@router.get("/{article_id}", response_model=ArticleCreateResponse)
def get_public_article(
    article_id: str,
    service: ArticleService = Depends(get_article_service),
) -> ArticleCreateResponse:
    try:
        item = service.get_article(article_id)
        if item is None:
            raise HTTPException(status_code=404, detail="Article not found")
        if not _is_public_article(item):
            raise HTTPException(status_code=404, detail="Article not found")
        return ArticleCreateResponse(
            status="ok",
            action="found",
            item=_to_response(item),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Get public article failed for article_id='%s': %s", article_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get article: {str(e)}")


@router.post("/fetch/europe-pmc", response_model=EuropePmcFetchResponse)
def fetch_europe_pmc_articles(
    payload: EuropePmcFetchRequest,
    _admin: dict[str, Any] = Depends(verify_admin_token),
    fetcher: EuropePmcFetcher = Depends(get_europe_pmc_fetcher),
) -> EuropePmcFetchResponse:
    try:
        result = fetcher.fetch_latest(
            query=payload.query,
            topic=payload.topic,
            page_size=payload.page_size,
            tags=payload.tags,
        )
        return EuropePmcFetchResponse(
            query=result.query,
            topic=result.topic,
            requested=result.requested,
            created=result.created,
            skipped_duplicate=result.skipped_duplicate,
            items=[
                EuropePmcFetchItemResponse(
                    action=item.action,
                    dedup_matched_by=item.dedup_matched_by,
                    external_id=item.external_id,
                    source_url=item.source_url,
                    title=item.title,
                    article_id=item.article_id,
                )
                for item in result.items
            ],
        )
    except Exception as e:
        logger.exception("Fetch Europe PMC articles failed: %s", str(e))
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch Europe PMC articles: {str(e)}",
        )


@router.post("/fetch/moh", response_model=MohFetchResponse)
def fetch_moh_articles(
    payload: MohFetchRequest,
    _admin: dict[str, Any] = Depends(verify_admin_token),
    fetcher: MohFetcher = Depends(get_moh_fetcher),
) -> MohFetchResponse:
    try:
        result = fetcher.fetch_latest(
            topic=payload.topic,
            page_size=payload.page_size,
            tags=payload.tags,
        )
        return MohFetchResponse(
            topic=result.topic,
            requested=result.requested,
            created=result.created,
            skipped_duplicate=result.skipped_duplicate,
            items=[
                MohFetchItemResponse(
                    action=item.action,
                    dedup_matched_by=item.dedup_matched_by,
                    external_id=item.external_id,
                    source_url=item.source_url,
                    title=item.title,
                    article_id=item.article_id,
                )
                for item in result.items
            ],
        )
    except Exception as e:
        logger.exception("Fetch Bộ Y tế articles failed: %s", str(e))
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch Bộ Y tế articles: {str(e)}",
        )

@router.post("/ingest/external-news", response_model=ExternalNewsIngestResponse)
def ingest_external_news(
    payload: ExternalNewsIngestRequest,
    _admin: dict[str, Any] = Depends(verify_admin_token),
    service: ExternalNewsIngestService = Depends(get_external_news_ingest_service),
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
        logger.exception("External news ingest failed: %s", str(e))
        raise HTTPException(
            status_code=502,
            detail=f"Failed to ingest external news: {str(e)}",
        )
