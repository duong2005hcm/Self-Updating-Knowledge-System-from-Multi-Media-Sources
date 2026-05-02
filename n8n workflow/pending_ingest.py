from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class PendingChunk(BaseModel):
    chunk_index: int
    text: str = ""
    length: int = 0
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    page_numbers: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class PendingIngestBase(BaseModel):
    id: str
    source_id: str
    source_name: Optional[str] = None
    source_type: Optional[str] = None
    source_kind: str = "html_page"
    corpus: str = "disease_core"
    content_subtype: str = "disease_reference"
    url: Optional[str] = None
    pdf_url: Optional[str] = None
    title: Optional[str] = None
    disease_name: Optional[str] = None
    canonical_key: Optional[str] = None
    description: Optional[str] = None
    published_at: Optional[str] = None
    updated_at: Optional[str] = None
    topic: Optional[str] = None
    region: Optional[str] = None
    domain: Optional[str] = None
    doi: Optional[str] = None
    pmid: Optional[str] = None
    raw_source: Optional[str] = None
    phase: Optional[str] = None
    candidate_index: Optional[int] = None
    status: str = "pending"
    preview_error: Optional[str] = None
    reject_reason: Optional[str] = None
    extracted_text_preview: str = ""
    chunks_preview: list[PendingChunk] = Field(default_factory=list)
    extracted_text_path: Optional[str] = None
    chunks_path: Optional[str] = None
    storage_mode: Optional[str] = None
    text_length: int = 0
    chunk_count: int = 0
    created_at: str
    updated_at: str
    created_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    reviewed_by: Optional[str] = None
    approved_document_id: Optional[str] = None
    approved_version_id: Optional[str] = None
    approved_ingest_job_id: Optional[str] = None
    approved_chroma_collection: Optional[str] = None
    approve_result: Optional[dict[str, Any]] = None
    original_payload: dict[str, Any] = Field(default_factory=dict)


class PendingIngestCreate(BaseModel):
    source_id: str
    source_name: Optional[str] = None
    source_type: Optional[str] = None
    source_kind: str = "html_page"
    corpus: str = "disease_core"
    content_subtype: str = "disease_reference"
    url: Optional[str] = None
    pdf_url: Optional[str] = None
    title: Optional[str] = None
    disease_name: Optional[str] = None
    canonical_key: Optional[str] = None
    description: Optional[str] = None
    published_at: Optional[str] = None
    updated_at: Optional[str] = None
    topic: Optional[str] = None
    region: Optional[str] = None
    domain: Optional[str] = None
    doi: Optional[str] = None
    pmid: Optional[str] = None
    raw_source: Optional[str] = None
    phase: Optional[str] = None
    candidate_index: Optional[int] = None
    status: str = "pending"
    preview_error: Optional[str] = None
    extracted_text: str = ""
    extracted_text_preview: str = ""
    text_length: int = 0
    chunks: list[PendingChunk] = Field(default_factory=list)
    chunks_preview: list[PendingChunk] = Field(default_factory=list)
    chunk_count: int = 0
    extracted_text_path: Optional[str] = None
    chunks_path: Optional[str] = None
    storage_mode: Optional[str] = None
    created_by: Optional[str] = None
    original_payload: dict[str, Any] = Field(default_factory=dict)


class PendingIngestResponse(PendingIngestBase):
    extracted_text: str = ""
    chunks: list[PendingChunk] = Field(default_factory=list)


class PendingIngestListItem(BaseModel):
    id: str
    source_id: str
    source_name: Optional[str] = None
    source_kind: str = "html_page"
    corpus: str = "disease_core"
    content_subtype: str = "disease_reference"
    url: Optional[str] = None
    pdf_url: Optional[str] = None
    title: Optional[str] = None
    disease_name: Optional[str] = None
    canonical_key: Optional[str] = None
    status: str = "pending"
    extracted_text_preview: str = ""
    chunks_preview: list[PendingChunk] = Field(default_factory=list)
    extracted_text_path: Optional[str] = None
    chunks_path: Optional[str] = None
    storage_mode: Optional[str] = None
    text_length: int = 0
    chunk_count: int = 0
    created_at: str
    updated_at: str
    reviewed_at: Optional[str] = None
    reviewed_by: Optional[str] = None
    approved_document_id: Optional[str] = None
    approved_version_id: Optional[str] = None
    approved_ingest_job_id: Optional[str] = None
    approved_chroma_collection: Optional[str] = None


class PendingIngestListResponse(BaseModel):
    items: list[PendingIngestListItem]
    total: int


class PendingIngestApproveResponse(BaseModel):
    status: str
    action: str
    pending_id: str
    approved_document_id: Optional[str] = None
    approved_version_id: Optional[str] = None
    approved_ingest_job_id: Optional[str] = None
    approved_chroma_collection: Optional[str] = None
    approve_result: Optional[dict[str, Any]] = None
    message: str


class PendingIngestRejectRequest(BaseModel):
    reason: str = ""


class PendingIngestRejectResponse(BaseModel):
    status: str
    action: str
    pending_id: str
    reject_reason: Optional[str] = None
    message: str


class PendingIngestPreviewResponse(BaseModel):
    status: str
    action: str
    pending_id: str
    source_id: str
    url: Optional[str] = None
    pdf_url: Optional[str] = None
    title: Optional[str] = None
    text_length: int = 0
    chunk_count: int = 0
    message: str


class PendingIngestListQuery(BaseModel):
    status: Optional[str] = None
    source_id: Optional[str] = None
    corpus: Optional[str] = None
    limit: int = 20
    offset: int = 0
