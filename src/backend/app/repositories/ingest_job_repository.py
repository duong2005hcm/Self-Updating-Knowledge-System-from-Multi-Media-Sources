from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

from firebase_admin import firestore as firestore_admin

from backend.app.models.ingest_job import IngestJob
from backend.app.rag.memory.firebase_init import db

INGEST_JOBS_COLLECTION = "ingest_jobs"
FIRESTORE_TIMEOUT_SECONDS = max(float(os.getenv("FIRESTORE_TIMEOUT_SECONDS", "10")), 1.0)
FIRESTORE_CALL_KWARGS = {
    "timeout": FIRESTORE_TIMEOUT_SECONDS,
    "retry": None,
}


def _model_dump(model: IngestJob) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


class IngestJobRepository:
    def __init__(self, firestore_client=None):
        self._db = firestore_client or db

    def _snapshot_to_model(self, snapshot) -> IngestJob:
        data = snapshot.to_dict() or {}
        if "id" not in data:
            data["id"] = snapshot.id
        return IngestJob(**data)

    def create_job(self, job: IngestJob) -> IngestJob:
        self._db.collection(INGEST_JOBS_COLLECTION).document(job.id).set(
            _model_dump(job),
            **FIRESTORE_CALL_KWARGS,
        )
        return job

    def get_job_by_id(self, job_id: str) -> IngestJob | None:
        snapshot = self._db.collection(INGEST_JOBS_COLLECTION).document(job_id).get(
            **FIRESTORE_CALL_KWARGS,
        )
        if not snapshot.exists:
            return None
        return self._snapshot_to_model(snapshot)

    def list_jobs(
        self,
        *,
        limit: int = 50,
        status: Optional[str] = None,
        source_id: Optional[str] = None,
    ) -> list[IngestJob]:
        capped_limit = max(1, min(int(limit or 50), 200))
        collection_ref = self._db.collection(INGEST_JOBS_COLLECTION)
        base_query = collection_ref

        normalized_status = (status or "").strip()
        normalized_source_id = (source_id or "").strip()

        if normalized_status:
            base_query = base_query.where("status", "==", normalized_status)
        if normalized_source_id:
            base_query = base_query.where("source_id", "==", normalized_source_id)

        try:
            ordered_query = base_query.order_by(
                "started_at",
                direction=firestore_admin.Query.DESCENDING,
            ).limit(capped_limit)
            snapshots = list(ordered_query.stream(**FIRESTORE_CALL_KWARGS))
        except Exception:
            snapshots = list(base_query.stream(**FIRESTORE_CALL_KWARGS))
            snapshots.sort(
                key=lambda item: (item.to_dict() or {}).get("started_at") or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True,
            )
            snapshots = snapshots[:capped_limit]

        return [self._snapshot_to_model(snapshot) for snapshot in snapshots]

    def increment_counters(
        self,
        job_id: str,
        *,
        processed_count: int = 0,
        created_count: int = 0,
        updated_count: int = 0,
        skipped_count: int = 0,
        failed_count: int = 0,
    ) -> None:
        increments: dict[str, Any] = {}
        if processed_count:
            increments["processed_count"] = firestore_admin.Increment(processed_count)
        if created_count:
            increments["created_count"] = firestore_admin.Increment(created_count)
        if updated_count:
            increments["updated_count"] = firestore_admin.Increment(updated_count)
        if skipped_count:
            increments["skipped_count"] = firestore_admin.Increment(skipped_count)
        if failed_count:
            increments["failed_count"] = firestore_admin.Increment(failed_count)
        if increments:
            self._db.collection(INGEST_JOBS_COLLECTION).document(job_id).update(
                increments,
                **FIRESTORE_CALL_KWARGS,
            )

    def finish_job(self, job_id: str) -> None:
        self._db.collection(INGEST_JOBS_COLLECTION).document(job_id).update(
            {
                "status": "success",
                "finished_at": datetime.now(timezone.utc),
            },
            **FIRESTORE_CALL_KWARGS,
        )

    def fail_job(self, job_id: str, error: str) -> None:
        self._db.collection(INGEST_JOBS_COLLECTION).document(job_id).update(
            {
                "status": "failed",
                "finished_at": datetime.now(timezone.utc),
                "failed_count": firestore_admin.Increment(1),
                "logs": firestore_admin.ArrayUnion([error]),
            },
            **FIRESTORE_CALL_KWARGS,
        )
