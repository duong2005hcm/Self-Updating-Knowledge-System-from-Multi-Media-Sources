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


class SearchResponse(BaseModel):
    status: str = "ok"
    items: list[SearchDocumentItem]
    total: int
    matched_total: int
    offset: int
    limit: int
