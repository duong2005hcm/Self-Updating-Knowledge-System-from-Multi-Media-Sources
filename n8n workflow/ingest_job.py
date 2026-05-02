from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, Field


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class IngestJob(BaseModel):
    """Operational status and counters for one ingest execution."""
    id: str
    source_id: str
    status: str = "running"
    started_at: datetime = Field(default_factory=_utc_now)
    finished_at: Optional[datetime] = None
    processed_count: int = 0
    created_count: int = 0
    updated_count: int = 0
    skipped_count: int = 0
    failed_count: int = 0
    logs: List[str] = Field(default_factory=list)

    @classmethod
    def create(
        cls,
        *,
        source_id: str,
        job_id: Optional[str] = None,
        status: str = "running",
    ) -> "IngestJob":
        """Factory helper to open a new ingest job in running state."""
        return cls(
            id=job_id or f"job_{uuid.uuid4().hex}",
            source_id=source_id,
            status=status,
        )
