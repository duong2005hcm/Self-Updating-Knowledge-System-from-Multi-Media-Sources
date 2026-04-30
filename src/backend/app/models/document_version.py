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
    raw_filename: Optional[str] = None
    raw_storage_path: Optional[str] = None
    file_url: Optional[str] = None
    mime_type: Optional[str] = None
    source_url: Optional[str] = None
    extracted_text: Optional[str] = None
    checksum: Optional[str] = None
    ingest_job_id: Optional[str] = None
    status: str = "success"
    created_at: datetime = Field(default_factory=_utc_now)
    ai_summary: Optional[str] = None
    ai_key_points: list[str] = Field(default_factory=list)
    ai_medical_warning: Optional[str] = None
    ai_suggested_tags: list[str] = Field(default_factory=list)
    ai_suggested_topic: Optional[str] = None
    summary_status: Optional[str] = None
    summary_updated_at: Optional[datetime] = None
    summary_updated_by: Optional[str] = None

    @classmethod
    def create(
        cls,
        *,
        document_id: str,
        version_no: int = 1,
        ingest_job_id: Optional[str] = None,
        version_id: Optional[str] = None,
        raw_path: Optional[str] = None,
        raw_filename: Optional[str] = None,
        raw_storage_path: Optional[str] = None,
        file_url: Optional[str] = None,
        mime_type: Optional[str] = None,
        source_url: Optional[str] = None,
        checksum: Optional[str] = None,
        status: str = "success",
        extracted_text: Optional[str] = None,
        ai_summary: Optional[str] = None,
        ai_key_points: Optional[list[str]] = None,
        ai_medical_warning: Optional[str] = None,
        ai_suggested_tags: Optional[list[str]] = None,
        ai_suggested_topic: Optional[str] = None,
        summary_status: Optional[str] = None,
    ) -> "DocumentVersion":
        """Factory helper to build a new version record."""
        return cls(
            id=version_id or f"ver_{uuid.uuid4().hex}",
            document_id=document_id,
            version_no=version_no,
            raw_path=raw_path,
            raw_filename=raw_filename,
            raw_storage_path=raw_storage_path,
            file_url=file_url,
            mime_type=mime_type,
            source_url=source_url,
            extracted_text=extracted_text,
            checksum=checksum,
            ingest_job_id=ingest_job_id,
            status=status,
            ai_summary=ai_summary,
            ai_key_points=ai_key_points or [],
            ai_medical_warning=ai_medical_warning,
            ai_suggested_tags=ai_suggested_tags or [],
            ai_suggested_topic=ai_suggested_topic,
            summary_status=summary_status,
        )
