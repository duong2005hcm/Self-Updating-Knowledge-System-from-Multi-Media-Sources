from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Feedback(BaseModel):
    """User feedback entity for answer/document/source quality signals."""

    id: str
    user_id: str
    target_type: Literal["answer", "document", "source"]
    target_id: str
    vote: Literal[-1, 0, 1]
    reason: Optional[str] = None
    created_at: datetime = Field(default_factory=_utc_now)

    @classmethod
    def create(
        cls,
        *,
        user_id: str,
        target_type: Literal["answer", "document", "source"],
        target_id: str,
        vote: Literal[-1, 0, 1],
        reason: Optional[str] = None,
        feedback_id: Optional[str] = None,
    ) -> "Feedback":
        """Factory helper for creating feedback records with generated ids."""
        return cls(
            id=feedback_id or f"fb_{uuid.uuid4().hex}",
            user_id=user_id,
            target_type=target_type,
            target_id=target_id,
            vote=vote,
            reason=reason,
        )
