from __future__ import annotations

import logging
from typing import Any
from unittest.mock import patch

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ConfigDict

from backend.app.api.dependencies.admin_auth import verify_admin_token
from backend.app.schemas.ingest_metadata import WebIngestRequest as BaseWebIngestRequest
import backend.app.services.ingest_orchestration_service as ingest_orchestration_module
from backend.app.services.ingest_orchestration_service import IngestOrchestrationService

router = APIRouter(
    prefix="/ingest",
    tags=["Ingest"],
    dependencies=[Depends(verify_admin_token)],
)
logger = logging.getLogger(__name__)
VALID_INGEST_ACTIONS = {"created", "updated", "skipped", "failed"}


class N8nWebIngestRequest(BaseWebIngestRequest):
    model_config = ConfigDict(extra="ignore")

    source_id: str | None = None
    source_name: str | None = None
    corpus: str | None = None
    content_subtype: str | None = None
    title: str | None = None
    description: str | None = None
    published_at: str | None = None
    updated_at: str | None = None
    region: str | None = None
    doi: str | None = None
    pmid: str | None = None
    source_kind: str | None = None
    disease_name: str | None = None
    canonical_key: str | None = None
    raw_source: str | None = None
    phase: str | None = None
    candidate_index: int | None = None


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _resolve_action(result: dict[str, Any]) -> str:
    action = _stringify(result.get("action")).lower()
    if action in VALID_INGEST_ACTIONS:
        return action

    for document in result.get("documents") or []:
        if not isinstance(document, dict):
            continue
        document_action = _stringify(document.get("action")).lower()
        if document_action in VALID_INGEST_ACTIONS:
            return document_action

    created = int(result.get("created") or 0)
    updated = int(result.get("updated") or 0)
    skipped = int(result.get("skipped") or 0)
    failed = int(result.get("failed") or 0)

    if updated > 0:
        return "updated"
    if created > 0:
        return "created"
    if skipped > 0:
        return "skipped"
    if failed > 0 or _stringify(result.get("status")).lower() == "failed":
        return "failed"
    return "failed"


def _normalize_message(action: str, result: dict[str, Any], payload: dict[str, Any]) -> str:
    existing = _stringify(result.get("message"))
    if existing:
        return existing

    title = _stringify(payload.get("title"))
    url = _stringify(payload.get("url"))
    target = title or url or "web document"

    if action == "created":
        return f"Ingested new content for {target}"
    if action == "updated":
        return f"Updated content for {target}"
    if action == "skipped":
        return f"No content change for {target}"
    return f"Failed to ingest {target}"


def _normalize_ingest_response(
    *,
    result: dict[str, Any],
    payload: dict[str, Any],
) -> dict[str, Any]:
    action = _resolve_action(result)
    documents = result.get("documents") or []
    primary_document = next(
        (document for document in documents if isinstance(document, dict)),
        {},
    )

    normalized: dict[str, Any] = {
        "status": "ok" if action in {"created", "updated", "skipped"} else "failed",
        "action": action,
        "source_id": payload.get("source_id") or result.get("source_id"),
        "document_id": result.get("document_id") or primary_document.get("document_id"),
        "version_id": result.get("version_id") or primary_document.get("version_id"),
        "ingest_job_id": result.get("ingest_job_id"),
        "url": payload.get("url") or primary_document.get("identifier"),
        "title": payload.get("title") or result.get("title") or payload.get("url"),
        "message": _normalize_message(action, result, payload),
        "result": result,
    }

    for key, value in result.items():
        normalized.setdefault(key, value)

    return normalized


def _clean_metadata_value(value: Any) -> str | int | float | bool | None:
    if value is None:
        return None
    if isinstance(value, (int, float, bool)):
        return value
    text = str(value).strip()
    return text or None


def _build_n8n_chunk_metadata(payload: dict[str, Any]) -> dict[str, Any]:
    source_url = _stringify(payload.get("url"))
    title = _stringify(payload.get("title")) or _stringify(payload.get("disease_name")) or source_url
    data_type = (
        _stringify(payload.get("content_subtype"))
        or _stringify(payload.get("corpus"))
        or _stringify(payload.get("source_kind"))
    )
    last_crawled_at = _stringify(payload.get("updated_at")) or _stringify(payload.get("published_at"))

    metadata: dict[str, Any] = {
        "source": source_url,
        "source_name": _stringify(payload.get("source_name")) or source_url,
        "source_title": title,
        "document_name": title,
        "data_type": data_type,
        "n8n_source_id": payload.get("source_id"),
        "corpus": payload.get("corpus"),
        "content_subtype": payload.get("content_subtype"),
        "source_kind": payload.get("source_kind"),
        "published_at": payload.get("published_at"),
        "updated_at": payload.get("updated_at"),
        "last_crawled_at": last_crawled_at,
        "region": payload.get("region"),
        "doi": payload.get("doi"),
        "pmid": payload.get("pmid"),
        "disease_name": payload.get("disease_name"),
        "canonical_key": payload.get("canonical_key"),
        "raw_source": payload.get("raw_source"),
        "n8n_phase": payload.get("phase"),
        "n8n_candidate_index": payload.get("candidate_index"),
    }
    return {
        key: cleaned
        for key, value in metadata.items()
        if (cleaned := _clean_metadata_value(value)) is not None
    }


def _metadata_mapper_with_n8n(payload: dict[str, Any]):
    original_mapper = ingest_orchestration_module.build_chunk_metadata
    n8n_metadata = _build_n8n_chunk_metadata(payload)

    def build_chunk_metadata_with_n8n(
        context,
        *,
        include_legacy_fields: bool = True,
        extra: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        merged_extra = {**n8n_metadata, **(extra or {})}
        return original_mapper(
            context,
            include_legacy_fields=include_legacy_fields,
            extra=merged_extra,
        )

    return build_chunk_metadata_with_n8n


def _should_force_single_target(req: N8nWebIngestRequest, payload: dict[str, Any]) -> bool:
    if int(req.limit or 0) == 1:
        return True

    marker_fields = {
        "source_id",
        "corpus",
        "content_subtype",
        "title",
        "published_at",
        "updated_at",
        "topic",
        "region",
        "domain",
        "doi",
        "pmid",
        "source_kind",
        "disease_name",
        "canonical_key",
        "raw_source",
        "phase",
        "candidate_index",
    }
    return any(_stringify(payload.get(field)) for field in marker_fields)


def _single_target_crawl(url: str, limit: int = 1) -> list[str]:
    del limit
    return [url]


@router.post("/web")
async def ingest_web(
    req: N8nWebIngestRequest,
    decoded_token: dict[str, Any] = Depends(verify_admin_token),
):
    actor = req.resolve_actor(decoded_token)
    orchestrator = IngestOrchestrationService()
    payload = req.model_dump()

    try:
        ingest_kwargs = {
            "url": req.url,
            "limit": req.limit,
            "ingest_metadata": req,
            "actor": actor,
            "data_type_resolver": (
                lambda web_type: "web_news" if web_type == "news" else f"web_{web_type}"
            ),
            "include_web_type": True,
            "include_outputs": True,
        }

        with patch.object(
            ingest_orchestration_module,
            "build_chunk_metadata",
            new=_metadata_mapper_with_n8n(payload),
        ):
            if _should_force_single_target(req, payload):
                with patch.object(
                    ingest_orchestration_module,
                    "crawl_article_links_optimized",
                    side_effect=_single_target_crawl,
                ):
                    result = orchestrator.ingest_web(**ingest_kwargs)
            else:
                result = orchestrator.ingest_web(**ingest_kwargs)

        return _normalize_ingest_response(result=result, payload=payload)
    except Exception as e:
        logger.exception("Ingest web pipeline failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Ingest web pipeline failed: {str(e)}")
