from __future__ import annotations

"""Shared mapping between ingest inputs and lifecycle metadata models.

This module keeps ingest routes thin and ensures chunk metadata is produced
with a consistent Source/Document/Version/IngestJob structure.
"""

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from pydantic import BaseModel

from backend.app.models.document import Document
from backend.app.models.document_version import DocumentVersion
from backend.app.models.ingest_job import IngestJob
from backend.app.models.source import Source


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slug(value: str, fallback: str) -> str:
    text = (value or "").strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or fallback


def _normalize_source_type(value: str) -> str:
    text = (value or "").strip()
    return text or "unknown"


def _normalize_domain(value: str) -> str:
    return (value or "").strip() or "general"


def _normalize_topic(value: str) -> str:
    return (value or "").strip() or "general"


def _normalize_priority(value: str) -> str:
    return (value or "").strip() or "normal"


def _normalize_status(value: str) -> str:
    return (value or "").strip() or "active"


def _normalize_visibility(value: str) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {"public", "protected", "private"}:
        return normalized
    return "public"


def _stable_id(prefix: str, key: str) -> str:
    stable = uuid.uuid5(uuid.NAMESPACE_URL, key).hex
    return f"{prefix}_{stable}"


def create_ingest_job_id() -> str:
    """Create a standalone job id for each ingest execution."""
    return f"job_{uuid.uuid4().hex}"


class IngestMetadataContext(BaseModel):
    """Container returned by build_ingest_context for downstream steps."""
    source: Source
    document: Document
    version: DocumentVersion
    ingest_job: IngestJob


def build_ingest_context(
    *,
    source_type: str,
    source_name: str,
    source_locator: str,
    document_title: str,
    domain: str,
    topic: str,
    priority: str,
    visibility: str,
    status: str,
    created_by: str,
    ingest_job_id: Optional[str] = None,
    checksum: Optional[str] = None,
    schedule: Optional[str] = None,
    trust_score: float = 0.5,
    version_no: int = 1,
) -> IngestMetadataContext:
    """Build normalized lifecycle entities from raw ingest attributes."""
    normalized_source_type = _normalize_source_type(source_type)
    normalized_domain = _normalize_domain(domain)
    normalized_topic = _normalize_topic(topic)
    normalized_priority = _normalize_priority(priority)
    normalized_visibility = _normalize_visibility(visibility)
    normalized_status = _normalize_status(status)
    actor = (created_by or "").strip() or "system"
    locator = (source_locator or "").strip() or source_name
    title = (document_title or "").strip() or source_name

    # Stable ids help map repeated ingest calls to the same source/document.
    source_key = f"{normalized_source_type}|{locator}"
    source_id = _stable_id("src", source_key)

    source = Source.create(
        source_id=source_id,
        name=(source_name or "").strip() or locator,
        source_type=normalized_source_type,
        url_or_path=locator,
        domain=normalized_domain,
        created_by=actor,
        schedule=schedule,
        trust_score=trust_score,
    )

    document_key = f"{source.id}|{title}"
    document_id = _stable_id("doc", document_key)

    document = Document.create(
        document_id=document_id,
        source_id=source.id,
        title=title,
        source_type=normalized_source_type,
        created_by=actor,
        domain=normalized_domain,
        topic=normalized_topic,
        priority=normalized_priority,
        visibility=normalized_visibility,
        status=normalized_status,
        checksum=checksum,
        current_version=version_no,
    )

    ingest_job = IngestJob.create(
        source_id=source.id,
        job_id=ingest_job_id,
        status="running",
    )

    version = DocumentVersion.create(
        document_id=document.id,
        version_no=version_no,
        ingest_job_id=ingest_job.id,
        checksum=checksum,
        status="success",
    )

    return IngestMetadataContext(
        source=source,
        document=document,
        version=version,
        ingest_job=ingest_job,
    )


def build_chunk_metadata(
    context: IngestMetadataContext,
    *,
    include_legacy_fields: bool = True,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Flatten lifecycle models into chunk-level metadata for vector storage."""
    metadata: Dict[str, Any] = {
        "source_id": context.source.id,
        "document_id": context.document.id,
        "version_id": context.version.id,
        "ingest_job_id": context.ingest_job.id,
        "source_type": context.source.type,
        "domain": context.document.domain,
        "topic": context.document.topic,
        "priority": context.document.priority,
        "visibility": context.document.visibility,
        "status": context.document.status,
        "created_by": context.document.created_by,
        "version_no": context.version.version_no,
        "checksum": context.document.checksum or context.version.checksum or "",
        "mapped_at": _utc_now_iso(),
    }

    if include_legacy_fields:
        metadata.update(
            {
                "source_name": context.source.name,
                "source_locator": context.source.url_or_path,
                "document_name": context.document.title,
                "doc_type": _slug(context.source.type, "unknown"),
            }
        )

    if extra:
        metadata.update(extra)

    return metadata
