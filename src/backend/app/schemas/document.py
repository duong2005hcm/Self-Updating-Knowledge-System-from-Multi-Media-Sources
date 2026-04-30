from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


class DocumentResponse(BaseModel):
    id: str
    source_id: str
    title: str
    source_type: str
    status: str
    domain: str
    topic: str
    priority: str
    visibility: str = "public"
    checksum: Optional[str] = None
    current_version: Optional[int] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    effective_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    ai_summary: Optional[str] = None
    ai_key_points: list[str] = Field(default_factory=list)
    ai_medical_warning: Optional[str] = None
    ai_suggested_tags: list[str] = Field(default_factory=list)
    ai_suggested_topic: Optional[str] = None
    summary_status: Optional[str] = None
    summary_version_id: Optional[str] = None
    summary_updated_at: Optional[datetime] = None
    summary_updated_by: Optional[str] = None


class DocumentListResponse(BaseModel):
    status: str = "ok"
    items: list[DocumentResponse]
    total: int


class DocumentDetailResponse(BaseModel):
    status: str = "ok"
    item: DocumentResponse


class DocumentVersionResponse(BaseModel):
    id: str
    document_id: str
    version_no: int
    raw_path: Optional[str] = None
    raw_filename: Optional[str] = None
    raw_storage_path: Optional[str] = None
    file_url: Optional[str] = None
    mime_type: Optional[str] = None
    source_url: Optional[str] = None
    extracted_text: Optional[str] = None
    checksum: Optional[str] = None
    ingest_job_id: Optional[str] = None
    status: str
    created_at: datetime
    ai_summary: Optional[str] = None
    ai_key_points: list[str] = Field(default_factory=list)
    ai_medical_warning: Optional[str] = None
    ai_suggested_tags: list[str] = Field(default_factory=list)
    ai_suggested_topic: Optional[str] = None
    summary_status: Optional[str] = None
    summary_updated_at: Optional[datetime] = None
    summary_updated_by: Optional[str] = None


class DocumentVersionListResponse(BaseModel):
    status: str = "ok"
    items: list[DocumentVersionResponse]
    total: int


class DocumentFileResponse(BaseModel):
    status: str = "ok"
    document_id: str
    filename: str
    mime_type: str = "application/pdf"
    file_url: str
    storage_path: Optional[str] = None
    source: str
    expires_in_seconds: Optional[int] = None


class AiSummaryPayload(BaseModel):
    summary: str = ""
    key_points: list[str] = Field(default_factory=list)
    medical_warning: str = ""
    suggested_tags: list[str] = Field(default_factory=list)
    suggested_topic: str = ""


class DocumentSummaryUpdateRequest(AiSummaryPayload):
    version_id: Optional[str] = None
    summary_status: str = "draft"


class DocumentSummaryUpdateResponse(BaseModel):
    status: str = "ok"
    document_id: str
    version_id: Optional[str] = None
    summary_status: str
    item: DocumentResponse


class DocumentChunkResponse(BaseModel):
    id: str
    collection: str
    version_id: Optional[str] = None
    chunk_index: Optional[int] = None
    content_preview: str
    content: Optional[str] = None
    metadata: dict[str, Any]


class DocumentChunkListResponse(BaseModel):
    status: str = "ok"
    items: list[DocumentChunkResponse]
    total: int


class DocumentPreviewSnippetResponse(BaseModel):
    id: str
    chunk_id: Optional[str] = None
    chunk_index: Optional[int] = None
    text: str
    score: float
    source: str
    metadata: dict[str, Any]


class DocumentPreviewResponse(BaseModel):
    status: str = "ok"
    document_id: str
    mode: str
    query: Optional[str] = None
    items: list[DocumentPreviewSnippetResponse]
    total: int
