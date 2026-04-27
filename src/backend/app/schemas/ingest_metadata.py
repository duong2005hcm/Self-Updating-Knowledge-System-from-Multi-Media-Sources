from __future__ import annotations

from typing import Any, Optional

from fastapi import Form
from pydantic import BaseModel, Field


class IngestMetadata(BaseModel):
    domain: str = "general"
    topic: str = "general"
    priority: str = "normal"
    status: str = "active"
    visibility: str = "public"
    source_type: Optional[str] = None
    created_by: Optional[str] = None

    def normalized_domain(self) -> str:
        return (self.domain or "").strip() or "general"

    def normalized_topic(self) -> str:
        return (self.topic or "").strip() or "general"

    def normalized_priority(self) -> str:
        return (self.priority or "").strip() or "normal"

    def normalized_status(self) -> str:
        return (self.status or "").strip() or "active"

    def normalized_visibility(self) -> str:
        normalized = (self.visibility or "").strip().lower()
        if normalized in {"public", "protected", "private"}:
            return normalized
        return "public"

    def normalized_source_type(self, fallback: str) -> str:
        return (self.source_type or "").strip() or fallback

    def resolve_actor(self, decoded_token: dict[str, Any], fallback: str = "admin") -> str:
        return (
            (self.created_by or "").strip()
            or str(decoded_token.get("uid") or "")
            or str(decoded_token.get("email") or "")
            or fallback
        )


class WebIngestRequest(IngestMetadata):
    url: str
    limit: int = Field(default=5, ge=1, le=50)


def parse_ingest_metadata_form(
    domain: str = Form(default="general"),
    topic: str = Form(default="general"),
    priority: str = Form(default="normal"),
    status: str = Form(default="active"),
    visibility: str = Form(default="public"),
    source_type: str = Form(default="PDF"),
    created_by: Optional[str] = Form(default=None),
) -> IngestMetadata:
    return IngestMetadata(
        domain=domain,
        topic=topic,
        priority=priority,
        status=status,
        visibility=visibility,
        source_type=source_type,
        created_by=created_by,
    )
