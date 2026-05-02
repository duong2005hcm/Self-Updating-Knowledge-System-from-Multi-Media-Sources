from __future__ import annotations

import os
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from backend.app.models.pending_ingest import PendingIngest
from backend.app.rag.memory.firebase_init import db

PENDING_INGESTS_COLLECTION = "pending_ingests"
FIRESTORE_TIMEOUT_SECONDS = max(float(os.getenv("FIRESTORE_TIMEOUT_SECONDS", "10")), 1.0)
FIRESTORE_CALL_KWARGS = {
    "timeout": FIRESTORE_TIMEOUT_SECONDS,
    "retry": None,
}
logger = logging.getLogger(__name__)


def _model_dump(model: PendingIngest) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _is_blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _coerce_list(value: Any) -> list:
    return value if isinstance(value, list) else []


def _coerce_int(value: Any, default: int = 0) -> int:
    if _is_blank(value):
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _normalize_optional_int(value: Any) -> Optional[int]:
    if _is_blank(value):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _normalize_required_datetime(value: Any) -> datetime:
    if _is_blank(value):
        return datetime.now(timezone.utc)
    return value


def _normalize_optional_datetime(value: Any) -> Any:
    if _is_blank(value):
        return None
    return value


def _datetime_sort_value(value: Any) -> float:
    if _is_blank(value):
        return 0.0
    if isinstance(value, datetime):
        candidate = value
        if candidate.tzinfo is None:
            candidate = candidate.replace(tzinfo=timezone.utc)
        return candidate.timestamp()
    if hasattr(value, "timestamp"):
        try:
            return float(value.timestamp())
        except Exception:
            pass
    if isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return 0.0
        try:
            if normalized.endswith("Z"):
                normalized = normalized[:-1] + "+00:00"
            candidate = datetime.fromisoformat(normalized)
            if candidate.tzinfo is None:
                candidate = candidate.replace(tzinfo=timezone.utc)
            return candidate.timestamp()
        except ValueError:
            return 0.0
    return 0.0


def _snapshot_updated_sort_value(snapshot) -> float:
    data = snapshot.to_dict() or {}
    return max(
        _datetime_sort_value(data.get("updated_at")),
        _datetime_sort_value(data.get("created_at")),
    )


class PendingIngestRepository:
    def __init__(self, firestore_client=None):
        self._db = firestore_client or db

    def _collection(self):
        return self._db.collection(PENDING_INGESTS_COLLECTION)

    def _snapshot_to_model(self, snapshot) -> PendingIngest:
        data = snapshot.to_dict() or {}
        data = self._normalize_legacy_data(data, snapshot.id)
        try:
            return PendingIngest(**data)
        except Exception:
            logger.exception("Invalid pending ingest snapshot '%s'; returning safe legacy fallback", snapshot.id)
            fallback = self._normalize_legacy_data({}, snapshot.id)
            fallback.update(
                {
                    "title": str(data.get("title") or snapshot.id),
                    "description": "Legacy pending ingest record could not be fully parsed.",
                    "status": str(data.get("status") or "pending"),
                }
            )
            return PendingIngest(**fallback)

    def _normalize_legacy_data(self, data: dict[str, Any], pending_id: str) -> dict[str, Any]:
        normalized = dict(data or {})
        normalized["pending_id"] = (
            normalized.get("pending_id")
            or normalized.get("id")
            or pending_id
        )

        defaults: dict[str, Any] = {
            "checksum": "",
            "status": "pending",
            "source_id": "",
            "source_name": "",
            "corpus": "",
            "content_subtype": "",
            "source_kind": "html_page",
            "url": "",
            "pdf_url": "",
            "title": "",
            "description": "",
            "published_at": "",
            "updated_at": "",
            "topic": "",
            "region": "",
            "domain": "",
            "doi": "",
            "pmid": "",
            "disease_name": "",
            "canonical_key": "",
            "raw_source": "",
            "phase": "",
            "extract_mode": "",
            "extracted_text_preview": "",
            "chunks_preview": [],
            "chunk_count": 0,
            "extracted_text_path": "",
            "chunks_path": "",
            "raw_path": "",
            "review_note": "",
            "reviewed_by": "",
            "approved_document_id": "",
            "approved_version_id": "",
            "ingest_job_id": "",
        }
        for key, value in defaults.items():
            if key not in normalized or normalized[key] is None:
                normalized[key] = value

        normalized["chunks_preview"] = _coerce_list(normalized.get("chunks_preview"))
        normalized["chunk_count"] = _coerce_int(normalized.get("chunk_count"), 0)
        normalized["candidate_index"] = _normalize_optional_int(normalized.get("candidate_index"))
        normalized["created_at"] = _normalize_required_datetime(normalized.get("created_at"))
        normalized["updated_at"] = _normalize_required_datetime(normalized.get("updated_at"))
        normalized["reviewed_at"] = _normalize_optional_datetime(normalized.get("reviewed_at"))

        return normalized

    def create_or_update_pending(self, item: PendingIngest) -> tuple[str, PendingIngest]:
        ref = self._collection().document(item.pending_id)
        snapshot = ref.get(**FIRESTORE_CALL_KWARGS)
        now = datetime.now(timezone.utc)

        if not snapshot.exists:
            payload = _model_dump(item)
            payload.setdefault("checksum", "")
            payload["created_at"] = payload.get("created_at") or now
            payload["updated_at"] = now
            ref.set(payload, **FIRESTORE_CALL_KWARGS)
            payload["pending_id"] = item.pending_id
            return "pending_created", PendingIngest(**payload)

        current = self._snapshot_to_model(snapshot)
        if current.checksum == item.checksum:
            ref.update({"updated_at": now}, **FIRESTORE_CALL_KWARGS)
            current.updated_at = now
            return "pending_skipped", current

        payload = _model_dump(item)
        payload.setdefault("checksum", "")
        payload["created_at"] = current.created_at
        payload["updated_at"] = now
        payload["status"] = "pending"
        payload["reviewed_at"] = None
        payload["reviewed_by"] = None
        payload["review_note"] = None
        payload["approved_document_id"] = None
        payload["approved_version_id"] = None
        payload["ingest_job_id"] = None
        ref.set(payload, **FIRESTORE_CALL_KWARGS)
        payload["pending_id"] = item.pending_id
        return "pending_updated", PendingIngest(**payload)

    def list_pending(
        self,
        *,
        limit: int = 50,
        status: Optional[str] = None,
        source_id: Optional[str] = None,
        corpus: Optional[str] = None,
        content_subtype: Optional[str] = None,
    ) -> list[PendingIngest]:
        capped_limit = max(1, min(int(limit or 50), 200))
        query = self._collection()

        normalized_status = (status or "").strip()
        normalized_source_id = (source_id or "").strip()
        normalized_corpus = (corpus or "").strip()
        normalized_subtype = (content_subtype or "").strip()

        if normalized_status:
            query = query.where("status", "==", normalized_status)
        if normalized_source_id:
            query = query.where("source_id", "==", normalized_source_id)
        if normalized_corpus:
            query = query.where("corpus", "==", normalized_corpus)
        if normalized_subtype:
            query = query.where("content_subtype", "==", normalized_subtype)

        snapshots = list(query.stream(**FIRESTORE_CALL_KWARGS))
        snapshots.sort(key=_snapshot_updated_sort_value, reverse=True)
        snapshots = snapshots[:capped_limit]

        return [self._snapshot_to_model(snapshot) for snapshot in snapshots]

    def get_pending_by_id(self, pending_id: str) -> Optional[PendingIngest]:
        snapshot = self._collection().document(pending_id).get(**FIRESTORE_CALL_KWARGS)
        if not snapshot.exists:
            return None
        return self._snapshot_to_model(snapshot)

    def approve_pending(
        self,
        pending_id: str,
        *,
        reviewed_by: str,
        note: Optional[str] = None,
        approved_document_id: Optional[str] = None,
        approved_version_id: Optional[str] = None,
        ingest_job_id: Optional[str] = None,
    ) -> Optional[PendingIngest]:
        return self.mark_status(
            pending_id,
            status="approved",
            reviewed_by=reviewed_by,
            review_note=note,
            approved_document_id=approved_document_id,
            approved_version_id=approved_version_id,
            ingest_job_id=ingest_job_id,
        )

    def reject_pending(
        self,
        pending_id: str,
        *,
        reviewed_by: str,
        reason: Optional[str] = None,
    ) -> Optional[PendingIngest]:
        return self.mark_status(
            pending_id,
            status="rejected",
            reviewed_by=reviewed_by,
            review_note=reason,
        )

    def mark_status(
        self,
        pending_id: str,
        *,
        status: str,
        reviewed_by: Optional[str] = None,
        review_note: Optional[str] = None,
        approved_document_id: Optional[str] = None,
        approved_version_id: Optional[str] = None,
        ingest_job_id: Optional[str] = None,
    ) -> Optional[PendingIngest]:
        current = self.get_pending_by_id(pending_id)
        if current is None:
            return None

        now = datetime.now(timezone.utc)
        updates: dict[str, Any] = {
            "status": status,
            "updated_at": now,
        }
        if reviewed_by is not None:
            updates["reviewed_by"] = reviewed_by
            updates["reviewed_at"] = now
        if review_note is not None:
            updates["review_note"] = review_note
        if approved_document_id is not None:
            updates["approved_document_id"] = approved_document_id
        if approved_version_id is not None:
            updates["approved_version_id"] = approved_version_id
        if ingest_job_id is not None:
            updates["ingest_job_id"] = ingest_job_id

        self._collection().document(pending_id).update(updates, **FIRESTORE_CALL_KWARGS)
        payload = _model_dump(current)
        payload.update(updates)
        return PendingIngest(**payload)
