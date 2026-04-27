import logging
import os
import re
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.api.dependencies.admin_auth import verify_admin_token
from backend.app.chroma_manager import get_chroma_client_dependency
from backend.app.services.knowledge_overview_service import KnowledgeOverviewService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/knowledge",
    tags=["Admin Knowledge"],
    dependencies=[Depends(verify_admin_token)],
)

GROUPABLE_FIELDS = {
    "document_name",
    "source",
    "doc_type",
    "data_type",
    "source_type",
    "status",
    "domain",
    "priority",
    "created_by",
}
DEFAULT_ACTIONS = ["view_detail", "reingest", "pause_source", "resume_source"]

_raw_get_limit_cap = os.getenv("CHROMA_GET_LIMIT_CAP", "300").strip()
try:
    CHROMA_GET_LIMIT_CAP = max(1, int(_raw_get_limit_cap))
except ValueError:
    CHROMA_GET_LIMIT_CAP = 300


def get_knowledge_overview_service() -> KnowledgeOverviewService:
    return KnowledgeOverviewService()


def _parse_page_numbers(raw: Any) -> list[int]:
    if raw is None:
        return []

    if isinstance(raw, list):
        values: list[int] = []
        for item in raw:
            try:
                values.append(int(item))
            except (TypeError, ValueError):
                continue
        return values

    if isinstance(raw, str):
        parts = [part.strip() for part in raw.split(",")]
        values: list[int] = []
        for part in parts:
            if not part:
                continue
            try:
                values.append(int(part))
            except ValueError:
                continue
        return values

    return []


def _safe_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value)


def _normalize_for_filter(value: Any) -> str:
    return _safe_text(value).strip().lower()


def _pick_first_text(md: dict[str, Any], keys: list[str], default: str = "") -> str:
    for key in keys:
        value = md.get(key)
        if value is None:
            continue
        if isinstance(value, list):
            if not value:
                continue
            return _safe_text(value[0]).strip()

        text = _safe_text(value).strip()
        if text:
            return text
    return default


def _infer_source_type(md: dict[str, Any]) -> str:
    explicit_source_type = _safe_text(md.get("source_type")).strip()
    if explicit_source_type:
        return explicit_source_type

    data_type = _safe_text(md.get("data_type")).lower()
    source = _safe_text(md.get("source")).lower()
    doc_type = _safe_text(md.get("doc_type")).lower()

    if "rss" in data_type or "rss" in source:
        return "RSS"
    if "video" in data_type or "youtube" in data_type or "youtube" in source:
        return "Video"
    if "pdf" in data_type or source.endswith(".pdf") or "pdf" in doc_type:
        return "PDF"
    if "api" in data_type or "/api/" in source:
        return "API"
    if source.startswith("http://") or source.startswith("https://") or "web" in data_type:
        return "Web"

    return "Web"


def _source_actions(source_type: str) -> list[str]:
    if source_type == "PDF":
        return ["view_detail", "reingest", "disable_source", "delete_source"]
    return DEFAULT_ACTIONS


def _trim_text(value: str, max_chars: int) -> tuple[str, bool]:
    if max_chars <= 0:
        return "", bool(value)

    if len(value) <= max_chars:
        return value, False

    return value[: max(0, max_chars - 3)] + "...", True


def _normalize_record(
    chunk_id: Any,
    metadata: Any,
    text: Any,
    include_full_text: bool,
    text_preview_chars: int,
) -> dict[str, Any]:
    md = metadata if isinstance(metadata, dict) else {}
    full_text = _safe_text(text)
    text_preview, preview_truncated = _trim_text(full_text, text_preview_chars)

    if include_full_text:
        response_text = full_text
        is_truncated = False
    else:
        response_text = text_preview
        is_truncated = preview_truncated

    created_at = md.get("created_at") or md.get("ingested_at")
    source_type = _infer_source_type(md)
    source_name = _pick_first_text(
        md,
        ["source_name", "document_name", "source_title", "source"],
        default="(unknown source)",
    )
    topic = _pick_first_text(md, ["topic", "topics", "subject", "category", "categories"], default="general")
    domain = _pick_first_text(
        md,
        ["domain", "field", "topic", "topics", "subject", "category", "categories"],
        default=topic or "general",
    )
    update_frequency = _pick_first_text(
        md,
        ["update_frequency", "crawl_frequency", "frequency"],
        default="manual",
    )
    last_crawled_at = _pick_first_text(
        md,
        ["last_crawled_at", "last_crawl_at", "crawled_at", "updated_at", "ingested_at", "created_at"],
        default="",
    )
    status = _pick_first_text(md, ["status"], default="active")
    source_reliability = _pick_first_text(
        md,
        ["source_reliability", "reliability", "reliability_score"],
        default="medium",
    )
    priority = _pick_first_text(
        md,
        ["priority", "source_priority", "priority_level"],
        default="normal",
    )
    created_by = _pick_first_text(
        md,
        ["created_by", "owner", "author", "ingested_by", "user_id"],
        default="unknown",
    )

    return {
        "id": _safe_text(chunk_id),
        "source_name": source_name,
        "source_type": source_type,
        "source": _safe_text(md.get("source")),
        "document_name": _safe_text(md.get("document_name")),
        "doc_type": _safe_text(md.get("doc_type")),
        "data_type": _safe_text(md.get("data_type")),
        "topic": topic,
        "domain": domain,
        "update_frequency": update_frequency,
        "last_crawled_at": last_crawled_at,
        "status": status,
        "source_reliability": source_reliability,
        "priority": priority,
        "created_by": created_by,
        "created_at": _safe_text(created_at),
        "page_start": md.get("page_start"),
        "page_end": md.get("page_end"),
        "page_numbers": _parse_page_numbers(md.get("page_numbers")),
        "text": response_text,
        "text_preview": text_preview,
        "text_is_truncated": is_truncated,
        "actions": _source_actions(source_type),
    }


def _passes_dashboard_filters(
    row: dict[str, Any],
    source_type: Optional[str] = None,
    status: Optional[str] = None,
    domain: Optional[str] = None,
    priority: Optional[str] = None,
    created_by: Optional[str] = None,
) -> bool:
    if source_type and _normalize_for_filter(row.get("source_type")) != _normalize_for_filter(source_type):
        return False
    if status and _normalize_for_filter(row.get("status")) != _normalize_for_filter(status):
        return False
    if domain and _normalize_for_filter(domain) not in _normalize_for_filter(row.get("domain")):
        return False
    if priority and _normalize_for_filter(row.get("priority")) != _normalize_for_filter(priority):
        return False
    if created_by and _normalize_for_filter(created_by) not in _normalize_for_filter(row.get("created_by")):
        return False
    return True


def _to_dt(value: Any) -> Optional[datetime]:
    if not value:
        return None

    if isinstance(value, datetime):
        dt_value = value
    elif isinstance(value, str):
        iso = value.strip()
        if not iso:
            return None
        if iso.endswith("Z"):
            iso = iso[:-1] + "+00:00"
        try:
            dt_value = datetime.fromisoformat(iso)
        except ValueError:
            return None
    else:
        return None

    if dt_value.tzinfo is None:
        return dt_value.replace(tzinfo=timezone.utc)
    return dt_value.astimezone(timezone.utc)


def _parse_filter_dt(name: str, value: Optional[str]) -> Optional[datetime]:
    if value is None:
        return None

    parsed = _to_dt(value)
    if parsed is None:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid datetime for '{name}': {value}. Use ISO 8601.",
        )
    return parsed


def _passes_time_filter(
    created_at_value: Any,
    created_from: Optional[datetime],
    created_to: Optional[datetime],
) -> bool:
    if created_from is None and created_to is None:
        return True

    record_dt = _to_dt(created_at_value)

    if created_from and (record_dt is None or record_dt < created_from):
        return False
    if created_to and (record_dt is None or record_dt > created_to):
        return False

    return True


def _build_where(
    source: Optional[str],
    document_name: Optional[str],
    doc_type: Optional[str],
    data_type: Optional[str],
) -> Optional[dict[str, Any]]:
    where: dict[str, Any] = {}

    if source:
        where["source"] = source.strip()
    if document_name:
        where["document_name"] = document_name.strip()
    if doc_type:
        where["doc_type"] = doc_type.strip()
    if data_type:
        where["data_type"] = data_type.strip()

    return where or None


def _extract_quota_limit(error_text: str) -> Optional[int]:
    match = re.search(r"limit of\s+(\d+)", error_text, re.IGNORECASE)
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def _safe_collection_get(
    collection: Any,
    include: list[str],
    limit: int,
    offset: int,
    where: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    requested_limit = max(1, int(limit))
    effective_limit = min(requested_limit, CHROMA_GET_LIMIT_CAP)

    try:
        return collection.get(
            include=include,
            limit=effective_limit,
            offset=offset,
            where=where,
        )
    except Exception as e:
        quota_limit = _extract_quota_limit(str(e))
        if quota_limit and quota_limit > 0 and quota_limit < effective_limit:
            logger.warning(
                "Chroma get quota detected. Retrying with lower limit=%s (requested=%s)",
                quota_limit,
                requested_limit,
            )
            return collection.get(
                include=include,
                limit=quota_limit,
                offset=offset,
                where=where,
            )
        raise


@router.get("/overview")
def get_knowledge_overview(
    max_scan: int = Query(default=500, ge=1, le=2000),
    recent_limit: int = Query(default=5, ge=1, le=20),
    service: KnowledgeOverviewService = Depends(get_knowledge_overview_service),
) -> dict[str, Any]:
    try:
        item = service.get_document_overview(
            max_scan=max_scan,
            recent_limit=recent_limit,
        )
        return {"status": "ok", "item": item}
    except Exception as e:
        logger.exception("Failed to build admin knowledge overview: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to build knowledge overview: {str(e)}")


@router.get("/grouped-by-source")
def get_documents_grouped_by_source(
    max_scan: int = Query(default=500, ge=1, le=2000),
    status: Optional[str] = Query(default=None),
    domain: Optional[str] = Query(default=None),
    service: KnowledgeOverviewService = Depends(get_knowledge_overview_service),
) -> dict[str, Any]:
    try:
        item = service.get_documents_grouped_by_source(
            max_scan=max_scan,
            status=status,
            domain=domain,
        )
        return {"status": "ok", "item": item}
    except Exception as e:
        logger.exception("Failed to build admin grouped-by-source overview: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to build grouped-by-source overview: {str(e)}")


@router.get("/grouped-by-domain")
def get_documents_grouped_by_domain(
    max_scan: int = Query(default=500, ge=1, le=2000),
    status: Optional[str] = Query(default=None),
    domain: Optional[str] = Query(default=None),
    service: KnowledgeOverviewService = Depends(get_knowledge_overview_service),
) -> dict[str, Any]:
    try:
        item = service.get_documents_grouped_by_domain(
            max_scan=max_scan,
            status=status,
            domain=domain,
        )
        return {"status": "ok", "item": item}
    except Exception as e:
        logger.exception("Failed to build admin grouped-by-domain overview: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to build grouped-by-domain overview: {str(e)}")


@router.get("/rejected-documents")
def get_rejected_documents(
    limit: int = Query(default=50, ge=1, le=200),
    service: KnowledgeOverviewService = Depends(get_knowledge_overview_service),
) -> dict[str, Any]:
    try:
        items = service.list_documents_by_status_view(status="rejected", limit=limit)
        return {
            "status": "ok",
            "items": items,
            "total": len(items),
        }
    except Exception as e:
        logger.exception("Failed to build rejected-documents view: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to build rejected-documents view: {str(e)}")


@router.get("/collections")
def list_collections(client=Depends(get_chroma_client_dependency)) -> dict[str, Any]:
    try:
        collections = client.list_collections()
    except Exception as e:
        logger.exception("Failed to list Chroma collections: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to list collections: {str(e)}")

    items = []
    for collection in collections:
        count = None
        try:
            count = collection.count()
        except Exception:
            count = None

        items.append({"name": collection.name, "count": count})

    return {"collections": items}


@router.get("/{collection_name}/chunks/{chunk_id}")
def get_chunk_detail(
    collection_name: str,
    chunk_id: str,
    include_raw_metadata: bool = Query(default=False),
    client=Depends(get_chroma_client_dependency),
) -> dict[str, Any]:
    try:
        collection = client.get_collection(collection_name)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Collection not found: {collection_name} ({str(e)})")

    try:
        result = collection.get(ids=[chunk_id], include=["documents", "metadatas"])
    except Exception as e:
        logger.exception(
            "Failed to read chunk detail from collection=%s id=%s: %s",
            collection_name,
            chunk_id,
            str(e),
        )
        raise HTTPException(status_code=500, detail=f"Failed to read chunk detail: {str(e)}")

    ids = result.get("ids") or []
    if not ids:
        raise HTTPException(status_code=404, detail=f"Chunk not found: {chunk_id}")

    metadatas = result.get("metadatas") or []
    documents = result.get("documents") or []
    metadata = metadatas[0] if metadatas else {}
    document = documents[0] if documents else ""

    item = _normalize_record(
        chunk_id=ids[0],
        metadata=metadata,
        text=document,
        include_full_text=True,
        text_preview_chars=300,
    )

    if include_raw_metadata:
        item["raw_metadata"] = metadata

    return {"collection": collection_name, "item": item}


@router.get("/{collection_name}/chunks")
def get_collection_chunks(
    collection_name: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    source: Optional[str] = None,
    document_name: Optional[str] = None,
    doc_type: Optional[str] = None,
    data_type: Optional[str] = None,
    source_type: Optional[str] = None,
    status: Optional[str] = None,
    domain: Optional[str] = None,
    priority: Optional[str] = None,
    created_by: Optional[str] = None,
    created_from: Optional[str] = None,
    created_to: Optional[str] = None,
    include_full_text: bool = Query(default=False),
    text_preview_chars: int = Query(default=300, ge=0, le=4000),
    client=Depends(get_chroma_client_dependency),
) -> dict[str, Any]:
    from_dt = _parse_filter_dt("created_from", created_from)
    to_dt = _parse_filter_dt("created_to", created_to)

    if from_dt and to_dt and from_dt > to_dt:
        raise HTTPException(status_code=400, detail="created_from must be <= created_to")

    try:
        collection = client.get_collection(collection_name)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Collection not found: {collection_name} ({str(e)})")

    where = _build_where(source, document_name, doc_type, data_type)
    include = ["metadatas"]
    if include_full_text or text_preview_chars > 0:
        include.append("documents")

    try:
        result = _safe_collection_get(
            collection=collection,
            include=include,
            limit=limit,
            offset=offset,
            where=where,
        )
    except Exception as e:
        logger.exception("Failed to read chunks from collection=%s: %s", collection_name, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to read chunks: {str(e)}")

    ids = result.get("ids") or []
    documents = result.get("documents") or []
    metadatas = result.get("metadatas") or []

    items = []
    for index, chunk_id in enumerate(ids):
        metadata = metadatas[index] if index < len(metadatas) else {}
        document = documents[index] if index < len(documents) else ""

        normalized = _normalize_record(
            chunk_id=chunk_id,
            metadata=metadata,
            text=document,
            include_full_text=include_full_text,
            text_preview_chars=text_preview_chars,
        )

        if not _passes_time_filter(normalized.get("created_at"), from_dt, to_dt):
            continue
        if not _passes_dashboard_filters(
            normalized,
            source_type=source_type,
            status=status,
            domain=domain,
            priority=priority,
            created_by=created_by,
        ):
            continue

        items.append(normalized)

    total = None
    try:
        total = collection.count()
    except Exception:
        total = None

    return {
        "collection": collection_name,
        "limit": limit,
        "offset": offset,
        "total": total,
        "items_count": len(items),
        "items": items,
    }


@router.get("/{collection_name}/grouped")
def get_collection_grouped(
    collection_name: str,
    by: str = Query(default="document_name"),
    source: Optional[str] = None,
    document_name: Optional[str] = None,
    doc_type: Optional[str] = None,
    data_type: Optional[str] = None,
    source_type: Optional[str] = None,
    status: Optional[str] = None,
    domain: Optional[str] = None,
    priority: Optional[str] = None,
    created_by: Optional[str] = None,
    created_from: Optional[str] = None,
    created_to: Optional[str] = None,
    batch_size: int = Query(default=500, ge=50, le=2000),
    max_scan: int = Query(default=20000, ge=100, le=200000),
    client=Depends(get_chroma_client_dependency),
) -> dict[str, Any]:
    if by not in GROUPABLE_FIELDS:
        raise HTTPException(status_code=400, detail=f"Unsupported group key: {by}")

    from_dt = _parse_filter_dt("created_from", created_from)
    to_dt = _parse_filter_dt("created_to", created_to)
    if from_dt and to_dt and from_dt > to_dt:
        raise HTTPException(status_code=400, detail="created_from must be <= created_to")

    try:
        collection = client.get_collection(collection_name)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Collection not found: {collection_name} ({str(e)})")

    where = _build_where(source, document_name, doc_type, data_type)

    grouped: dict[str, dict[str, Any]] = {}
    scanned = 0
    offset = 0
    scan_truncated = False

    while scanned < max_scan:
        current_limit = min(batch_size, max_scan - scanned)

        try:
            result = _safe_collection_get(
                collection=collection,
                include=["metadatas"],
                limit=current_limit,
                offset=offset,
                where=where,
            )
        except Exception as e:
            logger.exception("Failed to group chunks from collection=%s: %s", collection_name, str(e))
            raise HTTPException(status_code=500, detail=f"Failed to group chunks: {str(e)}")

        ids = result.get("ids") or []
        metadatas = result.get("metadatas") or []

        if not ids:
            break

        for index, chunk_id in enumerate(ids):
            metadata = metadatas[index] if index < len(metadatas) else {}
            normalized = _normalize_record(
                chunk_id=chunk_id,
                metadata=metadata,
                text="",
                include_full_text=False,
                text_preview_chars=0,
            )

            if not _passes_time_filter(normalized.get("created_at"), from_dt, to_dt):
                continue
            if not _passes_dashboard_filters(
                normalized,
                source_type=source_type,
                status=status,
                domain=domain,
                priority=priority,
                created_by=created_by,
            ):
                continue

            group_key = _safe_text(normalized.get(by)) or "(unknown)"
            row = grouped.get(group_key)
            if row is None:
                row = {
                    "group_key": group_key,
                    "total_chunks": 0,
                    "latest_created_at": normalized.get("created_at"),
                    "sample_ids": [],
                }
                grouped[group_key] = row

            row["total_chunks"] += 1
            if len(row["sample_ids"]) < 5:
                row["sample_ids"].append(normalized["id"])

            existing_latest = _to_dt(row.get("latest_created_at"))
            current_dt = _to_dt(normalized.get("created_at"))
            if current_dt and (existing_latest is None or current_dt > existing_latest):
                row["latest_created_at"] = normalized.get("created_at")

        fetched = len(ids)
        scanned += fetched
        offset += fetched

        if fetched < current_limit:
            break

    if scanned >= max_scan:
        scan_truncated = True

    groups = sorted(grouped.values(), key=lambda item: item["total_chunks"], reverse=True)

    return {
        "collection": collection_name,
        "group_by": by,
        "scanned": scanned,
        "scan_truncated": scan_truncated,
        "groups_count": len(groups),
        "groups": groups,
    }


@router.get("/{collection_name}/sources")
def get_sources_overview(
    collection_name: str,
    source_type: Optional[str] = None,
    domain: Optional[str] = None,
    topic: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    created_by: Optional[str] = None,
    created_from: Optional[str] = None,
    created_to: Optional[str] = None,
    batch_size: int = Query(default=500, ge=50, le=2000),
    max_scan: int = Query(default=20000, ge=100, le=200000),
    client=Depends(get_chroma_client_dependency),
) -> dict[str, Any]:
    from_dt = _parse_filter_dt("created_from", created_from)
    to_dt = _parse_filter_dt("created_to", created_to)
    if from_dt and to_dt and from_dt > to_dt:
        raise HTTPException(status_code=400, detail="created_from must be <= created_to")

    resolved_domain_filter = domain if domain is not None else topic

    try:
        collection = client.get_collection(collection_name)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Collection not found: {collection_name} ({str(e)})")

    grouped: dict[str, dict[str, Any]] = {}
    scanned = 0
    offset = 0
    scan_truncated = False

    while scanned < max_scan:
        current_limit = min(batch_size, max_scan - scanned)

        try:
            result = _safe_collection_get(
                collection=collection,
                include=["metadatas"],
                limit=current_limit,
                offset=offset,
                where=None,
            )
        except Exception as e:
            logger.exception("Failed to build sources overview from collection=%s: %s", collection_name, str(e))
            raise HTTPException(status_code=500, detail=f"Failed to build sources overview: {str(e)}")

        ids = result.get("ids") or []
        metadatas = result.get("metadatas") or []
        if not ids:
            break

        for index, chunk_id in enumerate(ids):
            metadata = metadatas[index] if index < len(metadatas) else {}
            normalized = _normalize_record(
                chunk_id=chunk_id,
                metadata=metadata,
                text="",
                include_full_text=False,
                text_preview_chars=0,
            )

            if not _passes_time_filter(normalized.get("created_at"), from_dt, to_dt):
                continue
            if not _passes_dashboard_filters(
                normalized,
                source_type=source_type,
                status=status,
                domain=resolved_domain_filter,
                priority=priority,
                created_by=created_by,
            ):
                continue

            group_key = _safe_text(normalized.get("source_name")) or "(unknown source)"
            row = grouped.get(group_key)
            if row is None:
                row = {
                    "source_name": group_key,
                    "source_type": normalized.get("source_type"),
                    "topic": normalized.get("topic"),
                    "domain": normalized.get("domain"),
                    "update_frequency": normalized.get("update_frequency"),
                    "last_crawled_at": normalized.get("last_crawled_at"),
                    "status": normalized.get("status"),
                    "source_reliability": normalized.get("source_reliability"),
                    "priority": normalized.get("priority"),
                    "created_by": normalized.get("created_by"),
                    "total_chunks": 0,
                    "sample_ids": [],
                    "actions": normalized.get("actions", DEFAULT_ACTIONS),
                }
                grouped[group_key] = row

            row["total_chunks"] += 1
            if len(row["sample_ids"]) < 5:
                row["sample_ids"].append(normalized["id"])

            existing_last = _to_dt(row.get("last_crawled_at"))
            candidate_last = _to_dt(normalized.get("last_crawled_at"))
            if candidate_last and (existing_last is None or candidate_last > existing_last):
                row["last_crawled_at"] = normalized.get("last_crawled_at")

        fetched = len(ids)
        scanned += fetched
        offset += fetched
        if fetched < current_limit:
            break

    if scanned >= max_scan:
        scan_truncated = True

    items = sorted(grouped.values(), key=lambda item: item["total_chunks"], reverse=True)
    return {
        "collection": collection_name,
        "scanned": scanned,
        "scan_truncated": scan_truncated,
        "items_count": len(items),
        "items": items,
    }
