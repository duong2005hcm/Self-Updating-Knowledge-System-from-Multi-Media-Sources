from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


PendingStatus = Literal["pending", "approved", "rejected", "failed"]
PendingSourceKind = Literal["html_page", "pdf_url", "pdf_file"]


class PendingChunk(BaseModel):
    chunk_index: int
    text: str = ""
    length: int = 0
    page_start: Optional[int] = None
    page_end: Optional[int] = None
    page_numbers: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class PendingIngest(BaseModel):
    id: str
    source_id: str
    source_name: Optional[str] = None
    source_type: Optional[str] = None
    source_kind: PendingSourceKind | str = "html_page"
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

    status: PendingStatus = "pending"
    preview_error: Optional[str] = None
    reject_reason: Optional[str] = None

    extracted_text: str = ""
    extracted_text_preview: str = ""
    text_length: int = 0
    chunks: list[PendingChunk] = Field(default_factory=list)
    chunks_preview: list[PendingChunk] = Field(default_factory=list)
    chunk_count: int = 0
    extracted_text_path: Optional[str] = None
    chunks_path: Optional[str] = None
    storage_mode: Optional[str] = None

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
