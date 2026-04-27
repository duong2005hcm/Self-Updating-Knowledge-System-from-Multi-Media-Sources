from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SourceCreateRequest(BaseModel):
    name: str = Field(..., min_length=1)
    type: str = Field(..., min_length=1)
    url_or_path: str = Field(..., min_length=1)
    domain: str = "general"
    active: bool = True
    schedule: Optional[str] = None
    trust_score: float = Field(default=0.5, ge=0.0, le=1.0)


class SourceUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1)
    type: Optional[str] = Field(default=None, min_length=1)
    url_or_path: Optional[str] = Field(default=None, min_length=1)
    domain: Optional[str] = Field(default=None, min_length=1)
    active: Optional[bool] = None
    schedule: Optional[str] = None
    trust_score: Optional[float] = Field(default=None, ge=0.0, le=1.0)


class SourceResponse(BaseModel):
    id: str
    name: str
    type: str
    url_or_path: str
    domain: str
    active: bool
    schedule: Optional[str] = None
    trust_score: float
    last_sync_at: Optional[datetime] = None
    created_by: str
    created_at: datetime
    updated_at: datetime


class SourceListResponse(BaseModel):
    items: list[SourceResponse]
    total: int


class SourceCreateResponse(BaseModel):
    status: str
    item: SourceResponse


class SourceDeleteResponse(BaseModel):
    status: str
    deleted_id: str
