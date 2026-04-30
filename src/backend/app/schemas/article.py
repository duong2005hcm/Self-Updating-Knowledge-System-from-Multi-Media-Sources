from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ArticleCreateRequest(BaseModel):
    title: str = Field(..., min_length=1)
    summary: str = ""
    content: str = Field(..., min_length=1)
    content_type: str = "news"
    source_type: str = "external_news"
    source_name: str = Field(..., min_length=1)
    source_url: str = Field(..., min_length=1)
    image_url: Optional[str] = None
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    external_id: Optional[str] = None
    content_hash: Optional[str] = None
    published_at: Optional[datetime] = None
    topic: str = "general"
    tags: list[str] = Field(default_factory=list)
    status: str = "active"
    visibility: str = "public"


class ArticleResponse(BaseModel):
    id: str
    title: str
    summary: str
    content: str
    content_type: str
    source_type: str
    source_name: str
    source_url: str
    image_url: Optional[str] = None
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    external_id: Optional[str] = None
    content_hash: Optional[str] = None
    published_at: Optional[datetime] = None
    topic: str
    tags: list[str]
    status: str
    visibility: str
    created_at: datetime
    updated_at: datetime


class ArticleCreateResponse(BaseModel):
    status: str = "ok"
    action: str
    dedup_matched_by: Optional[str] = None
    item: ArticleResponse


class ArticleListResponse(BaseModel):
    status: str = "ok"
    items: list[ArticleResponse]
    total: int


class ArticleModerationRequest(BaseModel):
    status: Optional[str] = None
    visibility: Optional[str] = None


class EuropePmcFetchRequest(BaseModel):
    query: str = Field(default="medicine", min_length=1)
    topic: str = "medicine"
    page_size: int = Field(default=2, ge=1, le=2)
    tags: list[str] = Field(default_factory=list)


class EuropePmcFetchItemResponse(BaseModel):
    action: str
    dedup_matched_by: Optional[str] = None
    external_id: Optional[str] = None
    source_url: str
    title: str
    article_id: str


class EuropePmcFetchResponse(BaseModel):
    status: str = "ok"
    source_name: str = "Europe PMC"
    query: str
    topic: str
    requested: int
    created: int
    skipped_duplicate: int
    items: list[EuropePmcFetchItemResponse]


class MohFetchRequest(BaseModel):
    topic: str = "health"
    page_size: int = Field(default=2, ge=1, le=2)
    tags: list[str] = Field(default_factory=list)


class MohFetchItemResponse(BaseModel):
    action: str
    dedup_matched_by: Optional[str] = None
    external_id: Optional[str] = None
    source_url: str
    title: str
    article_id: str


class MohFetchResponse(BaseModel):
    status: str = "ok"
    source_name: str = "Bộ Y tế"
    topic: str
    requested: int
    created: int
    skipped_duplicate: int
    items: list[MohFetchItemResponse]


class ExternalNewsIngestRequest(BaseModel):
    source_name: str = Field(default="all", description="all | pubmed | europe_pmc | moh")
    limit_per_source: int = Field(default=2, ge=1, le=2)
    query: str = Field(default="medicine", min_length=1)
    topic: str = "health"
    tags: list[str] = Field(default_factory=list)


class ExternalNewsIngestItemResponse(BaseModel):
    source_name: str
    action: str
    dedup_matched_by: Optional[str] = None
    external_id: Optional[str] = None
    source_url: str
    title: str
    article_id: str


class ExternalNewsIngestSourceResponse(BaseModel):
    source_key: str
    source_name: str
    requested: int
    created_count: int
    skipped_count: int
    failed_count: int
    error: Optional[str] = None


class ExternalNewsIngestResponse(BaseModel):
    status: str = "ok"
    source_name: str
    limit_per_source: int
    created_count: int
    skipped_count: int
    failed_count: int
    items: list[ExternalNewsIngestItemResponse]
    sources: list[ExternalNewsIngestSourceResponse]
