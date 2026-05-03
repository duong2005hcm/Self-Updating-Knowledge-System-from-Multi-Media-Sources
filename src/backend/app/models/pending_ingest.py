from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PendingIngest(BaseModel):
    pending_id: str
    source_id: str = ""
    source_name: Optional[str] = ""
    corpus: Optional[str] = ""
    content_subtype: Optional[str] = ""
    source_kind: str = "html_page"
    url: Optional[str] = ""
    pdf_url: Optional[str] = ""
    title: Optional[str] = ""
    description: Optional[str] = ""
    published_at: Optional[str] = ""
    updated_at: Optional[str] = ""
    topic: Optional[str] = ""
    region: Optional[str] = ""
    domain: Optional[str] = ""
    doi: Optional[str] = ""
    pmid: Optional[str] = ""
    disease_name: Optional[str] = None
    canonical_key: Optional[str] = None
    raw_source: Optional[str] = None
    phase: Optional[str] = None
    candidate_index: Optional[int] = None
    extract_mode: Optional[str] = None

    article_title: Optional[str] = None
    parent_topic_title: Optional[str] = None
    disease_topic_url: Optional[str] = None
    category: Optional[str] = None
    chroma_collection_override: Optional[str] = None

    status: str = "pending"
    checksum: str = ""
    extracted_text_preview: str = ""
    chunks_preview: list[dict[str, Any]] = Field(default_factory=list)
    chunk_count: int = 0
    extracted_text_path: Optional[str] = None
    chunks_path: Optional[str] = None
    raw_path: Optional[str] = None
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    review_note: Optional[str] = None
    approved_document_id: Optional[str] = None
    approved_version_id: Optional[str] = None
    ingest_job_id: Optional[str] = None

    @classmethod
    def create(
        cls,
        *,
        source_id: str,
        source_kind: str,
        checksum: str,
        pending_id: Optional[str] = None,
        **values: Any,
    ) -> "PendingIngest":
        return cls(
            pending_id=pending_id or f"pend_{uuid.uuid4().hex}",
            source_id=(source_id or "").strip() or "unknown",
            source_kind=(source_kind or "").strip() or "html_page",
            checksum=checksum,
            **values,
        )