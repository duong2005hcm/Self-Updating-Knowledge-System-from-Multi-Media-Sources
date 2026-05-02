from __future__ import annotations

import os
import uuid
import json
from datetime import datetime, timezone
from typing import Any, Optional

from backend.app.rag.memory.firebase_init import db

PENDING_INGESTS_COLLECTION = "pending_ingests"
PENDING_SORT_FIELDS = {"updated_at", "created_at", "reviewed_at", "title", "source_id"}
MAX_EXTRACTED_TEXT_PREVIEW_CHARS = 20_000
MAX_CHUNKS_PREVIEW_COUNT = 5
MAX_CHUNK_PREVIEW_TEXT_CHARS = 2_000
MAX_FIRESTORE_DOCUMENT_BYTES = 900_000
FIRESTORE_TIMEOUT_SECONDS = max(float(os.getenv("FIRESTORE_TIMEOUT_SECONDS", "10")), 1.0)
FIRESTORE_CALL_KWARGS = {
    "timeout": FIRESTORE_TIMEOUT_SECONDS,
    "retry": None,
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _coerce_sort_scalar(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.timestamp()
    if hasattr(value, "timestamp"):
        try:
            return value.timestamp()
        except Exception:
            pass
    return str(value)


def _sort_value(item: dict[str, Any], sort_by: str) -> Any:
    if sort_by in {"updated_at", "created_at", "reviewed_at"}:
        return _coerce_sort_scalar(
            item.get(sort_by)
            or item.get("updated_at")
            or item.get("created_at")
            or item.get("reviewed_at")
        )
    value = item.get(sort_by)
    if value is None:
        return ""
    return str(value).lower()


def _truncate_text(value: Any, max_chars: int) -> str:
    return str(value or "")[:max_chars]


def _preview_chunks(chunks: Any) -> list[dict[str, Any]]:
    if not isinstance(chunks, list):
        return []
    preview: list[dict[str, Any]] = []
    for chunk in chunks[:MAX_CHUNKS_PREVIEW_COUNT]:
        if isinstance(chunk, dict):
            item = dict(chunk)
        else:
            item = {"text": str(chunk or "")}
        item["text"] = _truncate_text(item.get("text"), MAX_CHUNK_PREVIEW_TEXT_CHARS)
        preview.append(item)
    return preview


def _approx_payload_bytes(payload: dict[str, Any]) -> int:
    try:
        return len(json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8"))
    except Exception:
        return MAX_FIRESTORE_DOCUMENT_BYTES + 1


class PendingIngestRepository:
    def __init__(self, firestore_client=None):
        self._db = firestore_client or db

    def _collection(self):
        return self._db.collection(PENDING_INGESTS_COLLECTION)

    def _snapshot_to_dict(self, snapshot) -> dict[str, Any]:
        data = snapshot.to_dict() or {}
        data.setdefault("id", snapshot.id)
        return data

    def _prepare_firestore_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        prepared = dict(payload or {})
        full_text = prepared.pop("extracted_text", "") or ""
        full_chunks = prepared.pop("chunks", []) or []

        prepared["text_length"] = int(prepared.get("text_length") or len(full_text))
        prepared["chunk_count"] = int(prepared.get("chunk_count") or len(full_chunks))
        prepared["extracted_text_preview"] = _truncate_text(
            prepared.get("extracted_text_preview") or full_text,
            MAX_EXTRACTED_TEXT_PREVIEW_CHARS,
        )
        prepared["chunks_preview"] = _preview_chunks(prepared.get("chunks_preview") or full_chunks)

        if _approx_payload_bytes(prepared) <= MAX_FIRESTORE_DOCUMENT_BYTES:
            return prepared

        prepared["extracted_text_preview"] = _truncate_text(prepared.get("extracted_text_preview"), 5_000)
        prepared["chunks_preview"] = _preview_chunks(prepared.get("chunks_preview"))[:2]
        if _approx_payload_bytes(prepared) <= MAX_FIRESTORE_DOCUMENT_BYTES:
            return prepared

        prepared["extracted_text_preview"] = _truncate_text(prepared.get("extracted_text_preview"), 1_000)
        prepared["chunks_preview"] = []
        prepared["original_payload"] = {}
        return prepared

    def create_pending_ingest(self, data: dict[str, Any]) -> dict[str, Any]:
        now = _now_iso()
        payload = self._prepare_firestore_payload(dict(data or {}))
        pending_id = str(payload.get("id") or uuid.uuid4())
        payload["id"] = pending_id
        payload["created_at"] = payload.get("created_at") or now
        payload["updated_at"] = now
        payload.setdefault("status", "pending")
        payload.setdefault("corpus", "disease_core")
        payload.setdefault("content_subtype", "disease_reference")
        payload.setdefault("source_kind", "html_page")
        payload.setdefault("source_id", "unknown")
        payload.setdefault("extracted_text_preview", "")
        payload.setdefault("chunks_preview", [])
        payload["text_length"] = int(payload.get("text_length") or 0)
        payload["chunk_count"] = int(payload.get("chunk_count") or 0)
        payload.setdefault("original_payload", {})
        if _approx_payload_bytes(payload) > MAX_FIRESTORE_DOCUMENT_BYTES:
            payload["extracted_text_preview"] = ""
            payload["chunks_preview"] = []
            payload["original_payload"] = {}

        self._collection().document(pending_id).set(payload, **FIRESTORE_CALL_KWARGS)
        return payload

    def find_existing_preview(
        self,
        *,
        source_id: str,
        source_kind: str,
        locator_value: str,
        corpus: str,
        content_subtype: Optional[str] = None,
        statuses: Optional[list[str]] = None,
    ) -> Optional[dict[str, Any]]:
        normalized_source_id = str(source_id or "").strip()
        normalized_source_kind = str(source_kind or "").strip() or "html_page"
        normalized_locator = str(locator_value or "").strip()
        normalized_corpus = str(corpus or "").strip() or "disease_core"
        normalized_content_subtype = str(content_subtype or "").strip()
        wanted_statuses = set(statuses or ["pending", "approved"])
        locator_field = "pdf_url" if normalized_source_kind == "pdf_url" else "url"

        if not normalized_source_id or not normalized_locator:
            return None

        # Keep the Firestore query intentionally narrow to avoid requiring new
        # composite indexes for preview dedup checks.
        snapshots = list(
            self._collection()
            .where("source_id", "==", normalized_source_id)
            .stream(**FIRESTORE_CALL_KWARGS)
        )
        matches: list[dict[str, Any]] = []
        for snapshot in snapshots:
            item = self._snapshot_to_dict(snapshot)
            if item.get("status") not in wanted_statuses:
                continue
            if str(item.get(locator_field) or "").strip() != normalized_locator:
                continue
            if str(item.get("corpus") or "").strip() != normalized_corpus:
                continue
            if normalized_content_subtype and str(item.get("content_subtype") or "").strip() != normalized_content_subtype:
                continue
            matches.append(item)

        if not matches:
            return None

        status_priority = {"pending": 0, "approved": 1}
        matches.sort(key=lambda item: status_priority.get(str(item.get("status") or ""), 99))
        return matches[0]

    def list_pending_ingests(
        self,
        status: Optional[str] = None,
        source_id: Optional[str] = None,
        corpus: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        sort_by: str = "updated_at",
        sort_order: str = "desc",
    ) -> tuple[list[dict[str, Any]], int]:
        normalized_sort_by = sort_by if sort_by in PENDING_SORT_FIELDS else "updated_at"
        descending = (sort_order or "desc").lower() != "asc"
        query = self._collection()
        if status:
            query = query.where("status", "==", status)
        if source_id:
            query = query.where("source_id", "==", source_id)
        if corpus:
            query = query.where("corpus", "==", corpus)

        # Admin review lists favor correctness over Firestore index coupling:
        # query simple filters, then sort in memory so older docs missing
        # updated_at/reviewed_at still appear and composite indexes are not required.
        snapshots = list(query.stream(**FIRESTORE_CALL_KWARGS))
        items = [self._snapshot_to_dict(snapshot) for snapshot in snapshots]
        items.sort(key=lambda item: _sort_value(item, normalized_sort_by), reverse=descending)
        total = len(items)
        capped_limit = max(1, min(int(limit or 20), 100))
        safe_offset = max(0, int(offset or 0))
        return items[safe_offset : safe_offset + capped_limit], total

    def get_pending_ingest(self, pending_id: str) -> Optional[dict[str, Any]]:
        snapshot = self._collection().document(pending_id).get(**FIRESTORE_CALL_KWARGS)
        if not snapshot.exists:
            return None
        return self._snapshot_to_dict(snapshot)

    def update_pending_ingest(self, pending_id: str, updates: dict[str, Any]) -> dict[str, Any]:
        current = self.get_pending_ingest(pending_id)
        if current is None:
            raise KeyError(pending_id)

        payload = dict(updates or {})
        payload["updated_at"] = _now_iso()
        self._collection().document(pending_id).update(payload, **FIRESTORE_CALL_KWARGS)
        current.update(payload)
        return current

    def mark_approved(self, pending_id: str, updates: dict[str, Any]) -> dict[str, Any]:
        payload = dict(updates or {})
        payload["status"] = "approved"
        return self.update_pending_ingest(pending_id, payload)

    def mark_rejected(
        self,
        pending_id: str,
        reason: str,
        reviewed_by: Optional[str],
    ) -> dict[str, Any]:
        now = _now_iso()
        return self.update_pending_ingest(
            pending_id,
            {
                "status": "rejected",
                "reject_reason": reason,
                "reviewed_at": now,
                "reviewed_by": reviewed_by,
            },
        )
