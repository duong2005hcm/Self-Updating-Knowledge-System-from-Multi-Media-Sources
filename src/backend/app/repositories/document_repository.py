from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

from backend.app.models.document import Document
from backend.app.rag.memory.firebase_init import db

DOCUMENTS_COLLECTION = "documents"
FIRESTORE_TIMEOUT_SECONDS = max(float(os.getenv("FIRESTORE_TIMEOUT_SECONDS", "10")), 1.0)
FIRESTORE_CALL_KWARGS = {
    "timeout": FIRESTORE_TIMEOUT_SECONDS,
    "retry": None,
}


def _model_dump(model: Document) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _normalize_datetime(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class DocumentRepository:
    def __init__(self, firestore_client=None):
        self._db = firestore_client or db

    def _snapshot_to_model(self, snapshot) -> Document:
        data = snapshot.to_dict() or {}
        if "id" not in data:
            data["id"] = snapshot.id
        return Document(**data)

    def list_documents(
        self,
        *,
        limit: int = 50,
        source_id: Optional[str] = None,
        status: Optional[str] = None,
        domain: Optional[str] = None,
        source_type: Optional[str] = None,
    ) -> list[Document]:
        capped_limit = max(1, min(int(limit or 50), 200))
        query = self._db.collection(DOCUMENTS_COLLECTION)

        normalized_source_id = (source_id or "").strip()
        normalized_status = (status or "").strip()
        normalized_domain = (domain or "").strip()
        normalized_source_type = (source_type or "").strip()

        if normalized_source_id:
            query = query.where("source_id", "==", normalized_source_id)
        if normalized_status:
            query = query.where("status", "==", normalized_status)
        if normalized_domain:
            query = query.where("domain", "==", normalized_domain)
        if normalized_source_type:
            query = query.where("source_type", "==", normalized_source_type)

        try:
            ordered_query = query.order_by("updated_at", direction="DESCENDING").limit(capped_limit)
            snapshots = list(ordered_query.stream(**FIRESTORE_CALL_KWARGS))
        except Exception:
            snapshots = list(query.stream(**FIRESTORE_CALL_KWARGS))
            snapshots.sort(
                key=lambda item: (item.to_dict() or {}).get("updated_at") or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True,
            )
            snapshots = snapshots[:capped_limit]

        return [self._snapshot_to_model(snapshot) for snapshot in snapshots]

    def list_documents_for_search(
        self,
        *,
        limit: int = 200,
        domain: Optional[str] = None,
        source_id: Optional[str] = None,
        source_type: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        created_by: Optional[str] = None,
        updated_after: Optional[datetime] = None,
        updated_before: Optional[datetime] = None,
    ) -> list[Document]:
        capped_limit = max(1, min(int(limit or 200), 500))
        fetch_limit = capped_limit
        query = self._db.collection(DOCUMENTS_COLLECTION)

        normalized_domain = (domain or "").strip()
        normalized_source_id = (source_id or "").strip()
        normalized_source_type = (source_type or "").strip()
        normalized_status = (status or "").strip()
        normalized_priority = (priority or "").strip()
        normalized_created_by = (created_by or "").strip()
        normalized_updated_after = _normalize_datetime(updated_after)
        normalized_updated_before = _normalize_datetime(updated_before)
        if normalized_updated_after or normalized_updated_before:
            fetch_limit = min(max(capped_limit * 5, capped_limit), 2000)

        if normalized_domain:
            query = query.where("domain", "==", normalized_domain)
        if normalized_source_id:
            query = query.where("source_id", "==", normalized_source_id)
        if normalized_source_type:
            query = query.where("source_type", "==", normalized_source_type)
        if normalized_status:
            query = query.where("status", "==", normalized_status)
        if normalized_priority:
            query = query.where("priority", "==", normalized_priority)
        if normalized_created_by:
            query = query.where("created_by", "==", normalized_created_by)

        try:
            ordered_query = query.order_by("updated_at", direction="DESCENDING").limit(fetch_limit)
            snapshots = list(ordered_query.stream(**FIRESTORE_CALL_KWARGS))
        except Exception:
            snapshots = list(query.stream(**FIRESTORE_CALL_KWARGS))
            snapshots.sort(
                key=lambda item: (item.to_dict() or {}).get("updated_at") or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True,
            )
            snapshots = snapshots[:fetch_limit]

        items = [self._snapshot_to_model(snapshot) for snapshot in snapshots]
        if normalized_updated_after:
            items = [
                item for item in items
                if item.updated_at >= normalized_updated_after
            ]
        if normalized_updated_before:
            items = [
                item for item in items
                if item.updated_at <= normalized_updated_before
            ]

        return items[:capped_limit]

    def list_documents_for_overview(self, *, limit: int = 500) -> list[Document]:
        capped_limit = max(1, min(int(limit or 500), 2000))
        query = self._db.collection(DOCUMENTS_COLLECTION)

        try:
            ordered_query = query.order_by("updated_at", direction="DESCENDING").limit(capped_limit)
            snapshots = list(ordered_query.stream(**FIRESTORE_CALL_KWARGS))
        except Exception:
            snapshots = list(query.limit(capped_limit).stream(**FIRESTORE_CALL_KWARGS))
            snapshots.sort(
                key=lambda item: (item.to_dict() or {}).get("updated_at") or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True,
            )

        return [self._snapshot_to_model(snapshot) for snapshot in snapshots]

    def get_document_by_id(self, document_id: str) -> Optional[Document]:
        doc_ref = self._db.collection(DOCUMENTS_COLLECTION).document(document_id)
        doc_snapshot = doc_ref.get(**FIRESTORE_CALL_KWARGS)
        if not doc_snapshot.exists:
            return None

        return self._snapshot_to_model(doc_snapshot)

    def create_document(self, document: Document) -> Document:
        payload = _model_dump(document)
        payload["created_at"] = payload.get("created_at") or datetime.now(timezone.utc)
        payload["updated_at"] = payload.get("updated_at") or datetime.now(timezone.utc)
        self._db.collection(DOCUMENTS_COLLECTION).document(document.id).set(
            payload,
            **FIRESTORE_CALL_KWARGS,
        )
        return document

    def update_document(self, document_id: str, updates: dict[str, Any]) -> Optional[Document]:
        current = self.get_document_by_id(document_id)
        if current is None:
            return None

        payload = dict(updates)
        payload["updated_at"] = datetime.now(timezone.utc)
        self._db.collection(DOCUMENTS_COLLECTION).document(document_id).update(
            payload,
            **FIRESTORE_CALL_KWARGS,
        )

        merged_data = _model_dump(current)
        merged_data.update(payload)
        return Document(**merged_data)
