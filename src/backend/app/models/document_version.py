from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class DocumentVersion(BaseModel):
    """Version snapshot of a document after an ingest operation."""
    id: str
    document_id: str
    version_no: int = 1
    raw_path: Optional[str] = None
    extracted_text: Optional[str] = None
    checksum: Optional[str] = None
    ingest_job_id: Optional[str] = None
    status: str = "success"
    created_at: datetime = Field(default_factory=_utc_now)

    @classmethod
    def create(
        cls,
        *,
        document_id: str,
        version_no: int = 1,
        ingest_job_id: Optional[str] = None,
        version_id: Optional[str] = None,
        raw_path: Optional[str] = None,
        checksum: Optional[str] = None,
        status: str = "success",
        extracted_text: Optional[str] = None,
    ) -> "DocumentVersion":
        """Factory helper to build a new version record."""
        return cls(
            id=version_id or f"ver_{uuid.uuid4().hex}",
            document_id=document_id,
            version_no=version_no,
            raw_path=raw_path,
            extracted_text=extracted_text,
            checksum=checksum,
            ingest_job_id=ingest_job_id,
            status=status,
        )
