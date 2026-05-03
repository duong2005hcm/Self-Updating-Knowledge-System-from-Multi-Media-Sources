from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class N8nPendingPreviewRequest(BaseModel):
    source_id: str
    source_name: Optional[str] = None
    corpus: Optional[str] = None
    content_subtype: Optional[str] = None
    source_kind: Optional[str] = None
    url: Optional[str] = None
    pdf_url: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    published_at: Optional[str] = None
    updated_at: Optional[str] = None
    topic: Optional[str] = None
    region: Optional[str] = None
    domain: Optional[str] = None
    doi: Optional[str] = None
    pmid: Optional[str] = None
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


class PendingPreviewResponse(BaseModel):
    status: Literal["ok", "failed"] = "ok"
    action: Literal["pending_created", "pending_updated", "pending_skipped", "failed"]
    pending_id: Optional[str] = None
    source_id: Optional[str] = None
    title: Optional[str] = None
    url: Optional[str] = None
    message: str = ""


class PendingIngestItem(BaseModel):
    pending_id: str
    source_id: str = ""
    source_name: Optional[str] = ""
    corpus: Optional[str] = ""
    content_subtype: Optional[str] = ""
    source_kind: str = "html_page"
    url: Optional[str] = None
    pdf_url: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    published_at: Optional[str] = None
    updated_at: Optional[str] = None
    topic: Optional[str] = None
    region: Optional[str] = None
    domain: Optional[str] = None
    doi: Optional[str] = None
    pmid: Optional[str] = None
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
    created_at: datetime
    updated_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    review_note: Optional[str] = None
    approved_document_id: Optional[str] = None
    approved_version_id: Optional[str] = None
    ingest_job_id: Optional[str] = None


class PendingIngestListResponse(BaseModel):
    items: list[PendingIngestItem]
    count: int


class PendingIngestDetailResponse(BaseModel):
    item: PendingIngestItem
    extracted_text: str = ""
    chunks: list[dict[str, Any]] = Field(default_factory=list)


class PendingApproveRequest(BaseModel):
    note: Optional[str] = None


class PendingRejectRequest(BaseModel):
    reason: Optional[str] = None


class PendingApproveResponse(BaseModel):
    status: Literal["ok", "failed"] = "ok"
    action: Literal["created", "updated", "skipped", "failed"]
    pending_id: str
    document_id: Optional[str] = None
    version_id: Optional[str] = None
    ingest_job_id: Optional[str] = None
    chunks_inserted: int = 0
    collections: list[str] = Field(default_factory=list)
    chroma_collection_override: Optional[str] = None
    message: str = ""


class PendingRejectResponse(BaseModel):
    status: Literal["ok"] = "ok"
    action: Literal["rejected"] = "rejected"
    pending_id: str
    message: str = ""