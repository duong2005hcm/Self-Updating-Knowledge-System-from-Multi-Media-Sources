from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Document(BaseModel):
    """Canonical document metadata linked to a source."""
    id: str
    source_id: str
    title: str
    source_type: str
    status: str = "active"
    domain: str = "general"
    topic: str = "general"
    priority: str = "normal"
    visibility: str = "public"
    checksum: Optional[str] = None
    current_version: Optional[int] = 1
    created_by: str
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    effective_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    @classmethod
    def create(
        cls,
        *,
        source_id: str,
        title: str,
        source_type: str,
        created_by: str,
        document_id: Optional[str] = None,
        domain: str = "general",
        topic: str = "general",
        priority: str = "normal",
        visibility: str = "public",
        status: str = "active",
        checksum: Optional[str] = None,
        current_version: int = 1,
    ) -> "Document":
        """Factory helper for ingest flows that create/update documents."""
        return cls(
            id=document_id or f"doc_{uuid.uuid4().hex}",
            source_id=source_id,
            title=title,
            source_type=source_type,
            status=status,
            domain=domain,
            topic=topic,
            priority=priority,
            visibility=visibility,
            checksum=checksum,
            current_version=current_version,
            created_by=created_by,
        )
