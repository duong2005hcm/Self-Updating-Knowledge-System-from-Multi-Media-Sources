from __future__ import annotations

from typing import Any, Optional


def resolve_ingest_action(*, created: int, updated: int, skipped: int, failed: int) -> str:
    flags = [
        ("created", created > 0),
        ("updated", updated > 0),
        ("skipped", skipped > 0),
        ("failed", failed > 0),
    ]
    active = [name for name, is_active in flags if is_active]
    if not active:
        return "none"
    if len(active) == 1:
        return active[0]
    return "mixed"


def build_ingest_response(
    *,
    status: str = "ok",
    created: int = 0,
    updated: int = 0,
    skipped: int = 0,
    failed: int = 0,
    ingest_job_id: Optional[str] = None,
    document_id: Optional[str] = None,
    version_id: Optional[str] = None,
    documents: Optional[list[dict[str, Any]]] = None,
    extras: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "status": status,
        "action": resolve_ingest_action(
            created=created,
            updated=updated,
            skipped=skipped,
            failed=failed,
        ),
        "created": created,
        "updated": updated,
        "skipped": skipped,
        "failed": failed,
        "ingest_job_id": ingest_job_id,
    }
    if document_id:
        payload["document_id"] = document_id
    if version_id:
        payload["version_id"] = version_id
    if documents is not None:
        payload["documents"] = documents
    if extras:
        payload.update(extras)
    return payload

