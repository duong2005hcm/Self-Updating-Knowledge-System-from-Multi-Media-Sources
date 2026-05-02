from __future__ import annotations

import os
from typing import Any, Optional

from backend.app.models.document_version import DocumentVersion
from backend.app.rag.memory.firebase_init import db

DOCUMENT_VERSIONS_COLLECTION = "document_versions"
FIRESTORE_TIMEOUT_SECONDS = max(float(os.getenv("FIRESTORE_TIMEOUT_SECONDS", "10")), 1.0)
FIRESTORE_CALL_KWARGS = {
    "timeout": FIRESTORE_TIMEOUT_SECONDS,
    "retry": None,
}


def _model_dump(model: DocumentVersion) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


class DocumentVersionRepository:
    def __init__(self, firestore_client=None):
        self._db = firestore_client or db

    def _snapshot_to_model(self, snapshot) -> DocumentVersion:
        data = snapshot.to_dict() or {}
        if "id" not in data:
            data["id"] = snapshot.id
        return DocumentVersion(**data)

    def create_version(self, version: DocumentVersion) -> DocumentVersion:
        self._db.collection(DOCUMENT_VERSIONS_COLLECTION).document(version.id).set(
            _model_dump(version),
            **FIRESTORE_CALL_KWARGS,
        )
        return version

    def update_version(self, version_id: str, updates: dict[str, Any]) -> Optional[DocumentVersion]:
        ref = self._db.collection(DOCUMENT_VERSIONS_COLLECTION).document(version_id)
        snapshot = ref.get(**FIRESTORE_CALL_KWARGS)
        if not snapshot.exists:
            return None

        payload = dict(updates)
        ref.update(payload, **FIRESTORE_CALL_KWARGS)

        merged = snapshot.to_dict() or {}
        merged.update(payload)
        if "id" not in merged:
            merged["id"] = version_id
        return DocumentVersion(**merged)

    def list_versions_by_document(self, document_id: str) -> list[DocumentVersion]:
        query = self._db.collection(DOCUMENT_VERSIONS_COLLECTION).where("document_id", "==", document_id)
        versions = [
            self._snapshot_to_model(snapshot)
            for snapshot in query.stream(**FIRESTORE_CALL_KWARGS)
        ]
        return sorted(
            versions,
            key=lambda version: version.created_at,
            reverse=True,
        )

    def get_latest_by_document(self, document_id: str) -> Optional[DocumentVersion]:
        query = self._db.collection(DOCUMENT_VERSIONS_COLLECTION).where("document_id", "==", document_id)
        latest: Optional[DocumentVersion] = None
        for snapshot in query.stream(**FIRESTORE_CALL_KWARGS):
            candidate = self._snapshot_to_model(snapshot)
            if latest is None or int(candidate.version_no) > int(latest.version_no):
                latest = candidate
        return latest
