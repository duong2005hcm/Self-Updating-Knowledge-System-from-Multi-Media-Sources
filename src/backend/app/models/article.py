from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Article(BaseModel):
    """Standalone content item for external news/blog sources.

    Articles are stored in Firestore only. They are not chunked or embedded in
    Chroma until a future phase explicitly promotes them into the knowledge RAG
    layer.
    """

    id: str
    title: str
    summary: str = ""
    content: str
    content_type: str = "news"
    source_type: str = "external_news"
    source_name: str
    source_url: str
    image_url: Optional[str] = None
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    external_id: Optional[str] = None
    content_hash: Optional[str] = None
    published_at: Optional[datetime] = None
    topic: str = "general"
    tags: list[str] = Field(default_factory=list)
    status: str = "active"
    visibility: str = "public"
    created_at: datetime = Field(default_factory=_utc_now)
    updated_at: datetime = Field(default_factory=_utc_now)

    @classmethod
    def create(
        cls,
        *,
        title: str,
        content: str,
        source_name: str,
        source_url: str,
        article_id: Optional[str] = None,
        summary: str = "",
        content_type: str = "news",
        source_type: str = "external_news",
        image_url: Optional[str] = None,
        author_id: Optional[str] = None,
        author_name: Optional[str] = None,
        external_id: Optional[str] = None,
        content_hash: Optional[str] = None,
        published_at: Optional[datetime] = None,
        topic: str = "general",
        tags: Optional[list[str]] = None,
        status: str = "active",
        visibility: str = "public",
    ) -> "Article":
        key = (external_id or source_url or title).strip()
        stable_id = article_id or f"art_{uuid.uuid5(uuid.NAMESPACE_URL, key).hex}"
        return cls(
            id=stable_id,
            title=title,
            summary=summary,
            content=content,
            content_type=content_type,
            source_type=source_type,
            source_name=source_name,
            source_url=source_url,
            image_url=image_url,
            author_id=author_id,
            author_name=author_name,
            external_id=external_id,
            content_hash=content_hash,
            published_at=published_at,
            topic=topic,
            tags=tags or [],
            status=status,
            visibility=visibility,
        )
