from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class SearchMode(str, Enum):
    keyword = "keyword"
    semantic = "semantic"
    hybrid = "hybrid"


class SearchSortBy(str, Enum):
    score = "score"
    updated_at = "updated_at"


class SearchSortOrder(str, Enum):
    asc = "asc"
    desc = "desc"


class SearchRequest(BaseModel):
    search_mode: SearchMode = SearchMode.keyword
    q: Optional[str] = None
    min_score: Optional[float] = Field(default=None, ge=0, le=1)
    debug: bool = False
    domain: Optional[str] = None
    source_id: Optional[str] = None
    source_type: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    visibility: Optional[str] = None
    created_by: Optional[str] = None
    updated_after: Optional[datetime] = None
    updated_before: Optional[datetime] = None
    sort_by: Optional[SearchSortBy] = None
    sort_order: Optional[SearchSortOrder] = None
    offset: int = Field(default=0, ge=0)
    limit: int = Field(default=20, ge=1, le=100)


class SearchDocumentItem(BaseModel):
    id: str
    source_id: str
    source_name: str
    title: str
    source_type: str
    status: str
    domain: str
    topic: str
    priority: str
    visibility: str = "public"
    current_version: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    score: float
    match_fields: list[str]
    snippet: str
    snippet_source: str
    semantic_score: Optional[float] = None
    keyword_score: Optional[float] = None
    metadata_score: Optional[float] = None
    reason: Optional[str] = None
    relevance_label: Optional[str] = None


class SearchResponse(BaseModel):
    status: str = "ok"
    items: list[SearchDocumentItem]
    total: int
    matched_total: int
    offset: int
    limit: int
    message: Optional[str] = None


class SearchHubRequest(BaseModel):
    q: str = Field(..., min_length=1)
    search_mode: SearchMode = SearchMode.hybrid
    limit: int = Field(default=10, ge=1, le=10)
    include_external: bool = True
    min_score: Optional[float] = Field(default=None, ge=0, le=1)
    debug: bool = False


class SearchHubItem(BaseModel):
    type: str
    title: str
    score: Optional[float] = None
    url: Optional[str] = None
    document_id: Optional[str] = None
    article_id: Optional[str] = None
    summary: Optional[str] = None
    snippet: Optional[str] = None
    source_type: Optional[str] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    display_link: Optional[str] = None
    topic: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    updated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    image_url: Optional[str] = None
    author_name: Optional[str] = None
    rating_avg: Optional[float] = None


class SearchHubSection(BaseModel):
    label: str
    total: int
    items: list[SearchHubItem] = Field(default_factory=list)


class SearchHubResponse(BaseModel):
    status: str = "ok"
    query: str
    search_mode: SearchMode
    total: int
    sections: dict[str, SearchHubSection]
    message: Optional[str] = None
