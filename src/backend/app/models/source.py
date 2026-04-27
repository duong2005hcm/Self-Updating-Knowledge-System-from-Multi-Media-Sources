from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Source(BaseModel):
    """Data source registry entity used by ingest and governance flows."""

    id: str
    name: str
    type: str
    url_or_path: str
    domain: str
    active: bool = True
    schedule: Optional[str] = None
    trust_score: float = Field(default=0.5, ge=0.0, le=1.0)
    last_sync_at: Optional[datetime] = None
    created_by: str
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)

    @classmethod
    def create(
        cls,
        *,
        name: str,
        source_type: str,
        url_or_path: str,
        domain: str,
        created_by: str,
        source_id: Optional[str] = None,
        active: bool = True,
        schedule: Optional[str] = None,
        trust_score: float = 0.5,
    ) -> "Source":
        """Factory helper for creating a new source with default timestamps."""
        return cls(
            id=source_id or f"src_{uuid.uuid4().hex}",
            name=name,
            type=source_type,
            url_or_path=url_or_path,
            domain=domain,
            active=active,
            schedule=schedule,
            trust_score=trust_score,
            created_by=created_by,
        )
