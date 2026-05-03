import json
import uuid
import hashlib
import logging
import os
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional

from backend.app.chroma_manager import get_chroma_manager

logger = logging.getLogger(__name__)

BATCH_SIZE = 32

ALLOWED_METADATA_KEYS = {
    "source_id",
    "document_id",
    "version_id",
    "ingest_job_id",
    "pending_id",
    "n8n_source_id",

    "source_name",
    "source_kind",
    "source_type",
    "source_locator",
    "source_url",
    "url",
    "pdf_url",

    "title",
    "document_name",
    "article_title",
    "parent_topic_title",
    "disease_topic_url",
    "disease_name",
    "canonical_key",

    "corpus",
    "content_subtype",
    "topic",
    "domain",
    "region",
    "category",

    "published_at",
    "updated_at",
    "data_type",
    "chunk_index",
    "page",
    "page_start",
    "page_end",
    "page_numbers",
    "section",

    "raw_source",
    "extract_mode",
    "phase",
    "candidate_index",

    "doc_type",
    "version_no",
    "checksum",
    "file_hash",
    "source_file",
    "ingested_at",
}


PRIORITY_METADATA_KEYS = [
    "document_id",
    "version_id",
    "ingest_job_id",
    "pending_id",
    "source_id",
    "n8n_source_id",

    "source_name",
    "source_kind",
    "source_type",
    "url",
    "pdf_url",

    "title",
    "document_name",
    "article_title",
    "disease_name",
    "disease_topic_url",

    "corpus",
    "content_subtype",
    "topic",
    "domain",
    "region",
    "category",

    "data_type",
    "chunk_index",
    "page",
    "page_start",
    "page_end",
    "page_numbers",

    "raw_source",
    "extract_mode",
    "file_hash",
    "source_file",
    "ingested_at",
]


def _normalize_chroma_metadata_value(value: Any):
    if value is None:
        return None

    if isinstance(value, (str, int, float, bool)):
        return value

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, Decimal):
        return float(value)

    if isinstance(value, (list, tuple, set)):
        return ", ".join(str(v) for v in value if v is not None)

    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False, default=str)

    return str(value)


def normalize_chroma_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}

    for key, value in (metadata or {}).items():
        normalized_key = str(key)
        normalized_value = _normalize_chroma_metadata_value(value)

        if normalized_value is None:
            continue

        if isinstance(normalized_value, str) and not normalized_value.strip():
            continue

        normalized[normalized_key] = normalized_value

    return normalized


def compact_chroma_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    normalized = normalize_chroma_metadata(metadata)

    allowed = {
        key: value
        for key, value in normalized.items()
        if key in ALLOWED_METADATA_KEYS
    }

    compact: dict[str, Any] = {}

    for key in PRIORITY_METADATA_KEYS:
        if key in allowed and len(compact) < 30:
            compact[key] = allowed[key]

    for key, value in allowed.items():
        if key in compact:
            continue
        if len(compact) >= 30:
            break
        compact[key] = value

    return compact


def normalize_text(text: str) -> str:
    return " ".join((text or "").strip().split())


def compute_file_hash_from_chunks(chunks: list) -> str:
    combined_text = "".join(str(c.get("text") or "") for c in chunks)
    return hashlib.sha256(combined_text.encode("utf-8")).hexdigest()


def _resolve_collection_name(
    *,
    chunk_type: str,
    chroma_collection_override: Optional[str] = None,
) -> str:
    override = (chroma_collection_override or "").strip()
    if override:
        return override

    normalized_type = (chunk_type or "unknown").strip() or "unknown"
    return f"rag_{normalized_type}"


def embed_and_store_chunks(
    chunks_json_path: str,
    allow_duplicates: bool = False,
    data_type: Optional[str] = None,
    extra_metadata: Optional[dict[str, Any]] = None,
    chroma_collection_override: Optional[str] = None,
):
    with open(chunks_json_path, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    if not chunks:
        return {
            "status": "empty",
            "inserted": 0,
            "collections": [],
        }

    file_hash = compute_file_hash_from_chunks(chunks)

    grouped_by_type: dict[str, list[dict[str, Any]]] = {}

    for chunk in chunks:
        chunk_type = data_type or chunk.get("data_type") or "unknown"
        chunk_type = str(chunk_type or "unknown").strip() or "unknown"

        grouped_by_type.setdefault(chunk_type, []).append(chunk)

    manager = get_chroma_manager()
    embedder = manager.embedder
    client = manager.client

    total_inserted = 0
    collections_used: list[str] = []

    for chunk_type, items in grouped_by_type.items():
        collection_name = _resolve_collection_name(
            chunk_type=chunk_type,
            chroma_collection_override=chroma_collection_override,
        )

        if collection_name not in collections_used:
            collections_used.append(collection_name)

        collection = client.get_or_create_collection(collection_name)

        if not allow_duplicates:
            try:
                existing_file = collection.get(where={"file_hash": file_hash})
                if existing_file.get("ids"):
                    logger.info("File already ingested in %s, skipping", collection_name)
                    continue
            except Exception:
                logger.exception("Failed to check duplicate file_hash in %s", collection_name)

        for i in range(0, len(items), BATCH_SIZE):
            batch = items[i:i + BATCH_SIZE]

            texts: list[str] = []
            metadatas: list[dict[str, Any]] = []
            ids: list[str] = []

            for chunk in batch:
                normalized_text = normalize_text(str(chunk.get("text") or ""))
                if not normalized_text:
                    continue

                metadata = {k: v for k, v in chunk.items() if k != "text"}
                metadata["data_type"] = chunk_type

                if extra_metadata:
                    metadata.update(extra_metadata)

                metadata.update(
                    {
                        "file_hash": file_hash,
                        "source_file": os.path.basename(chunks_json_path),
                        "ingested_at": datetime.now(timezone.utc).isoformat(),
                    }
                )

                deterministic_id = str(
                    uuid.uuid5(
                        uuid.NAMESPACE_DNS,
                        f"{collection_name}:{chunk_type}:{chunk.get('source', '')}:{normalized_text}",
                    )
                )

                texts.append(normalized_text)
                metadatas.append(compact_chroma_metadata(metadata))
                ids.append(deterministic_id)

            if not texts:
                continue

            embeddings = embedder.embed_documents(texts)

            if not allow_duplicates:
                try:
                    existing = collection.get(ids=ids)
                    existing_ids = set(existing.get("ids", []))
                except Exception:
                    existing_ids = set()

                filtered = [
                    (text, embedding, metadata, chunk_id)
                    for text, embedding, metadata, chunk_id in zip(texts, embeddings, metadatas, ids)
                    if chunk_id not in existing_ids
                ]

                if not filtered:
                    continue

                texts = [item[0] for item in filtered]
                embeddings = [item[1] for item in filtered]
                metadatas = [item[2] for item in filtered]
                ids = [item[3] for item in filtered]

            collection.add(
                documents=texts,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=ids,
            )

            total_inserted += len(texts)
            logger.info("Stored %s chunk(s) into %s", len(texts), collection_name)

    return {
        "status": "ok",
        "inserted": total_inserted,
        "collections": collections_used,
    }