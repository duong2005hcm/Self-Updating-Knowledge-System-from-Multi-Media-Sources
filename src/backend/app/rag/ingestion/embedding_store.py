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
    "source_name",
    "source_kind",
    "source_url",
    "url",
    "pdf_url",
    "title",
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
    "section",
    "raw_source",
    "extract_mode",
    "phase",
    "candidate_index",
    "file_hash",
    "source_file",
    "ingested_at",
}

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
    return {
        str(key): _normalize_chroma_metadata_value(value)
        for key, value in (metadata or {}).items()
    }

def compact_chroma_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    normalized = normalize_chroma_metadata(metadata)

    compact = {
        key: value
        for key, value in normalized.items()
        if key in ALLOWED_METADATA_KEYS
    }

    # Chroma Cloud đang giới hạn 32 keys; giữ dư địa an toàn
    if len(compact) > 30:
        compact = dict(list(compact.items())[:30])

    return compact

def normalize_text(text: str) -> str:
    return " ".join(text.strip().split())


def compute_file_hash_from_chunks(chunks: list) -> str:
    combined_text = "".join([c["text"] for c in chunks])
    return hashlib.sha256(combined_text.encode("utf-8")).hexdigest()


def embed_and_store_chunks(
    chunks_json_path: str,
    allow_duplicates: bool = False,
    data_type: Optional[str] = None,
    extra_metadata: Optional[dict[str, Any]] = None,
):

    with open(chunks_json_path, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    if not chunks:
        return {"status": "empty", "inserted": 0}


    file_hash = compute_file_hash_from_chunks(chunks)


    grouped_by_type: dict[str, list[dict[str, Any]]] = {}

    for c in chunks:
        chunk_type = data_type or c.get("data_type", "unknown")

        if chunk_type not in grouped_by_type:
            grouped_by_type[chunk_type] = []

        grouped_by_type[chunk_type].append(c)

    manager = get_chroma_manager()
    embedder = manager.embedder
    client = manager.client

    total_inserted = 0


    for chunk_type, items in grouped_by_type.items():

        collection_name = f"rag_{chunk_type}"
        collection = client.get_or_create_collection(collection_name)

        if not allow_duplicates:
            existing_file = collection.get(where={"file_hash": file_hash})

            if existing_file.get("ids"):
                logger.info("File already ingested in %s, skipping", collection_name)
                continue

        for i in range(0, len(items), BATCH_SIZE):

            batch = items[i:i+BATCH_SIZE]

            texts, metadatas, ids = [], [], []

            for c in batch:
                normalized_text = normalize_text(c["text"])
                if not normalized_text:
                    continue

                metadata = {k: v for k, v in c.items() if k != "text"}
                metadata["data_type"] = chunk_type
                if extra_metadata:
                    metadata.update(extra_metadata)

                metadata.update({
                    "file_hash": file_hash,
                    "source_file": os.path.basename(chunks_json_path),
                    "ingested_at": datetime.now(timezone.utc).isoformat()
                })

                texts.append(normalized_text)
                metadatas.append(compact_chroma_metadata(metadata))

                deterministic_id = str(
                    uuid.uuid5(
                        uuid.NAMESPACE_DNS,
                        f"{chunk_type}:{c.get('source','')}:{normalized_text}"
                    )
                )

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
                    (t, e, m, i)
                    for t, e, m, i in zip(texts, embeddings, metadatas, ids)
                    if i not in existing_ids
                ]

                if not filtered:
                    continue

                texts = [x[0] for x in filtered]
                embeddings = [x[1] for x in filtered]
                metadatas = [x[2] for x in filtered]
                ids = [x[3] for x in filtered]

            collection.add(
                documents=texts,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=ids
            )

            total_inserted += len(texts)

            logger.info("Stored %s into %s", len(texts), collection_name)

    return {
        "status": "ok",
        "inserted": total_inserted
    }
