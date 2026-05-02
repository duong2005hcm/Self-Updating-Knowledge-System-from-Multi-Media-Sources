from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

from backend.app.models.source import Source
from backend.app.rag.memory.firebase_init import db

SOURCES_COLLECTION = "sources"
FIRESTORE_TIMEOUT_SECONDS = max(float(os.getenv("FIRESTORE_TIMEOUT_SECONDS", "10")), 1.0)
FIRESTORE_CALL_KWARGS = {
    "timeout": FIRESTORE_TIMEOUT_SECONDS,
    "retry": None,
}


def _model_dump(model: Source) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


class SourceRepository:
    def __init__(self, firestore_client=None):
        self._db = firestore_client or db

    def list_sources(
        self,
        *,
        source_type: Optional[str] = None,
        active: Optional[bool] = None,
        domain: Optional[str] = None,
    ) -> list[Source]:
        query = self._db.collection(SOURCES_COLLECTION)

        if source_type:
            query = query.where("type", "==", source_type.strip())
        if active is not None:
            query = query.where("active", "==", active)
        if domain:
            query = query.where("domain", "==", domain.strip())

        items: list[Source] = []
        for doc in query.stream(**FIRESTORE_CALL_KWARGS):
            data = doc.to_dict() or {}
            if "id" not in data:
                data["id"] = doc.id
            items.append(Source(**data))

        return items

    def create_source(self, source: Source) -> Source:
        ref = self._db.collection(SOURCES_COLLECTION).document(source.id)
        if ref.get(**FIRESTORE_CALL_KWARGS).exists:
            raise ValueError(f"Source already exists: {source.id}")

        payload = _model_dump(source)
        payload["created_at"] = payload.get("created_at") or datetime.now(timezone.utc)
        payload["updated_at"] = datetime.now(timezone.utc)
        ref.set(payload, **FIRESTORE_CALL_KWARGS)
        return source

    def get_source_by_id(self, source_id: str) -> Optional[Source]:
        source_ref = self._db.collection(SOURCES_COLLECTION).document(source_id)
        source_snapshot = source_ref.get(**FIRESTORE_CALL_KWARGS)
        if not source_snapshot.exists:
            return None

        data = source_snapshot.to_dict() or {}
        if "id" not in data:
            data["id"] = source_snapshot.id
        return Source(**data)

    def get_sources_by_ids(self, source_ids: list[str]) -> dict[str, Source]:
        items: dict[str, Source] = {}
        for source_id in source_ids:
            normalized_id = (source_id or "").strip()
            if not normalized_id or normalized_id in items:
                continue

            source = self.get_source_by_id(normalized_id)
            if source is not None:
                items[normalized_id] = source

        return items

    def delete_source(self, source_id: str) -> bool:
        source_ref = self._db.collection(SOURCES_COLLECTION).document(source_id)
        source_snapshot = source_ref.get(**FIRESTORE_CALL_KWARGS)
        if not source_snapshot.exists:
            return False

        source_ref.delete(**FIRESTORE_CALL_KWARGS)
        return True

    def toggle_source_active(self, source_id: str) -> Optional[Source]:
        source_ref = self._db.collection(SOURCES_COLLECTION).document(source_id)
        source_snapshot = source_ref.get(**FIRESTORE_CALL_KWARGS)
        if not source_snapshot.exists:
            return None

        data = source_snapshot.to_dict() or {}
        if "id" not in data:
            data["id"] = source_snapshot.id

        source = Source(**data)
        updated_at = datetime.now(timezone.utc)
        updated_active = not bool(source.active)

        source_ref.update(
            {
                "active": updated_active,
                "updated_at": updated_at,
            },
            **FIRESTORE_CALL_KWARGS,
        )

        payload = _model_dump(source)
        payload["active"] = updated_active
        payload["updated_at"] = updated_at
        return Source(**payload)

    def update_source(self, source_id: str, updates: dict[str, Any]) -> Optional[Source]:
        source_ref = self._db.collection(SOURCES_COLLECTION).document(source_id)
        source_snapshot = source_ref.get(**FIRESTORE_CALL_KWARGS)
        if not source_snapshot.exists:
            return None

        current_data = source_snapshot.to_dict() or {}
        if "id" not in current_data:
            current_data["id"] = source_snapshot.id

        updated_at = datetime.now(timezone.utc)
        update_payload = dict(updates)
        update_payload["updated_at"] = updated_at

        source_ref.update(update_payload, **FIRESTORE_CALL_KWARGS)

        merged_data = dict(current_data)
        merged_data.update(update_payload)
        return Source(**merged_data)

    def touch_source_sync(
        self,
        *,
        source_id: str,
        name: str,
        source_type: str,
        url_or_path: str,
        domain: str,
        created_by: str,
        synced_at: Optional[datetime] = None,
    ) -> Source:
        source_ref = self._db.collection(SOURCES_COLLECTION).document(source_id)
        source_snapshot = source_ref.get(**FIRESTORE_CALL_KWARGS)
        touch_time = synced_at or datetime.now(timezone.utc)

        if source_snapshot.exists:
            current_data = source_snapshot.to_dict() or {}
            if "id" not in current_data:
                current_data["id"] = source_snapshot.id
            source_ref.update(
                {
                    "last_sync_at": touch_time,
                    "updated_at": touch_time,
                },
                **FIRESTORE_CALL_KWARGS,
            )
            current_data["last_sync_at"] = touch_time
            current_data["updated_at"] = touch_time
            return Source(**current_data)

        source = Source.create(
            source_id=source_id,
            name=(name or "").strip() or source_id,
            source_type=(source_type or "").strip() or "unknown",
            url_or_path=(url_or_path or "").strip() or source_id,
            domain=(domain or "").strip() or "general",
            created_by=(created_by or "").strip() or "system",
        )
        payload = _model_dump(source)
        payload["last_sync_at"] = touch_time
        payload["updated_at"] = touch_time
        source_ref.set(payload, **FIRESTORE_CALL_KWARGS)
        payload["id"] = source.id
        return Source(**payload)


def get_source_repository() -> SourceRepository:
    return SourceRepository()
