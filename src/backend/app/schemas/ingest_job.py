from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class IngestJobResponse(BaseModel):
    id: str
    source_id: str
    status: str
    started_at: datetime
    finished_at: Optional[datetime] = None
    processed_count: int = 0
    created_count: int = 0
    updated_count: int = 0
    skipped_count: int = 0
    failed_count: int = 0
    logs: list[str] = Field(default_factory=list)


class IngestJobListResponse(BaseModel):
    status: str = "ok"
    items: list[IngestJobResponse]
    total: int


class IngestJobDetailResponse(BaseModel):
    status: str = "ok"
    item: IngestJobResponse
