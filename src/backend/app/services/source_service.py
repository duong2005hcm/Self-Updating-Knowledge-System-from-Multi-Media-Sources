from __future__ import annotations

import logging
from typing import Optional

from backend.app.models.source import Source
from backend.app.repositories.source_repository import SourceRepository
from backend.app.schemas.source import SourceCreateRequest, SourceUpdateRequest

logger = logging.getLogger(__name__)


class SourceConflictError(ValueError):
    """Raised when a source already exists."""


class SourceNotFoundError(LookupError):
    """Raised when a source does not exist."""


class SourceInvalidUpdateError(ValueError):
    """Raised when source update payload has no valid updatable fields."""


def _provided_fields(payload: SourceUpdateRequest) -> set[str]:
    if hasattr(payload, "model_fields_set"):
        return set(payload.model_fields_set)
    return set(getattr(payload, "__fields_set__", set()))


class SourceService:
    def __init__(self, repository: SourceRepository):
        self._repository = repository

    def list_sources(
        self,
        *,
        source_type: Optional[str] = None,
        active: Optional[bool] = None,
        domain: Optional[str] = None,
    ) -> list[Source]:
        return self._repository.list_sources(
            source_type=source_type,
            active=active,
            domain=domain,
        )

    def create_source(self, payload: SourceCreateRequest, *, actor: str) -> Source:
        source = Source.create(
            name=payload.name.strip(),
            source_type=payload.type.strip(),
            url_or_path=payload.url_or_path.strip(),
            domain=payload.domain.strip() or "general",
            active=payload.active,
            schedule=(payload.schedule or "").strip() or None,
            trust_score=payload.trust_score,
            created_by=(actor or "").strip() or "admin",
        )

        try:
            return self._repository.create_source(source)
        except ValueError as exc:
            logger.warning("Create source conflict for name='%s'", payload.name.strip())
            raise SourceConflictError(str(exc)) from exc

    def get_source(self, source_id: str) -> Source:
        source = self._repository.get_source_by_id(source_id=source_id)
        if source is None:
            logger.warning("Source not found: %s", source_id)
            raise SourceNotFoundError(f"Source not found: {source_id}")
        return source

    def toggle_source(self, source_id: str) -> Source:
        source = self._repository.toggle_source_active(source_id=source_id)
        if source is None:
            logger.warning("Toggle failed because source not found: %s", source_id)
            raise SourceNotFoundError(f"Source not found: {source_id}")
        return source

    def update_source(self, source_id: str, payload: SourceUpdateRequest) -> Source:
        # Keep a strict whitelist so system fields cannot be changed from API.
        allowed_fields = {
            "name",
            "type",
            "url_or_path",
            "domain",
            "active",
            "schedule",
            "trust_score",
        }
        requested_fields = _provided_fields(payload)
        candidate_fields = requested_fields.intersection(allowed_fields)

        updates: dict[str, object] = {}
        for field_name in candidate_fields:
            value = getattr(payload, field_name, None)

            if field_name in {"name", "type", "url_or_path", "domain"}:
                if value is None:
                    raise SourceInvalidUpdateError(f"Field '{field_name}' cannot be null")
                normalized = str(value).strip()
                if not normalized:
                    raise SourceInvalidUpdateError(f"Field '{field_name}' cannot be empty")
                updates[field_name] = normalized
                continue

            if field_name == "schedule":
                if value is None:
                    updates["schedule"] = None
                else:
                    updates["schedule"] = str(value).strip() or None
                continue

            updates[field_name] = value

        if not updates:
            # PUT endpoint currently behaves as partial update in this phase.
            raise SourceInvalidUpdateError(
                "No valid fields to update. Allowed fields: "
                "name, type, url_or_path, domain, active, schedule, trust_score."
            )

        source = self._repository.update_source(source_id=source_id, updates=updates)
        if source is None:
            logger.warning("Update failed because source not found: %s", source_id)
            raise SourceNotFoundError(f"Source not found: {source_id}")

        return source

    def delete_source(self, source_id: str) -> str:
        deleted = self._repository.delete_source(source_id=source_id)
        if not deleted:
            logger.warning("Delete failed because source not found: %s", source_id)
            raise SourceNotFoundError(f"Source not found: {source_id}")

        return source_id
