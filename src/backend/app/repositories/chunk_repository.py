from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Optional

from backend.app.chroma_manager import get_chroma_manager

logger = logging.getLogger(__name__)


@dataclass
class ChunkRecord:
    id: str
    collection: str
    version_id: Optional[str]
    chunk_index: Optional[int]
    content: str
    metadata: dict[str, Any]


@dataclass
class SemanticChunkMatch:
    chunk: ChunkRecord
    score: float
    distance: Optional[float] = None


class ChunkRepositoryUnavailableError(RuntimeError):
    """Raised when the vector backend cannot be initialized."""


class ChunkRepository:
    def __init__(self, chroma_client=None, embedder=None):
        self._client = chroma_client
        self._embedder = embedder

    def _ensure_backend(self, *, require_embedder: bool) -> None:
        needs_client = self._client is None
        needs_embedder = require_embedder and self._embedder is None
        if not needs_client and not needs_embedder:
            return

        try:
            manager = get_chroma_manager()
        except Exception as e:
            raise ChunkRepositoryUnavailableError(
                f"Vector backend unavailable: {str(e)}"
            ) from e

        if self._client is None:
            self._client = manager.client
        if self._embedder is None:
            self._embedder = manager.embedder

    def list_chunks_by_document(
        self,
        *,
        document_id: str,
        limit: int = 50,
        collection_names: Optional[list[str]] = None,
    ) -> list[ChunkRecord]:
        self._ensure_backend(require_embedder=False)
        capped_limit = max(1, min(int(limit or 50), 200))
        chunks: list[ChunkRecord] = []

        for collection_ref in self._iter_collections(collection_names=collection_names):
            if len(chunks) >= capped_limit:
                break

            collection_name = getattr(collection_ref, "name", str(collection_ref))
            collection = (
                collection_ref
                if hasattr(collection_ref, "get")
                else self._client.get_collection(collection_name)
            )
            remaining = capped_limit - len(chunks)

            try:
                result = collection.get(
                    where={"document_id": document_id},
                    include=["documents", "metadatas"],
                    limit=remaining,
                )
            except Exception as e:
                logger.warning(
                    "Failed to load chunks for document_id='%s' from collection='%s': %s",
                    document_id,
                    collection_name,
                    str(e),
                )
                continue

            ids = result.get("ids") or []
            documents = result.get("documents") or []
            metadatas = result.get("metadatas") or []

            for index, chunk_id in enumerate(ids):
                metadata = metadatas[index] if index < len(metadatas) and metadatas[index] else {}
                content = documents[index] if index < len(documents) and documents[index] else ""
                chunks.append(
                    ChunkRecord(
                        id=str(chunk_id),
                        collection=collection_name,
                        version_id=metadata.get("version_id"),
                        chunk_index=_resolve_chunk_index(metadata),
                        content=content,
                        metadata=metadata,
                    )
                )

        return sorted(
            chunks,
            key=lambda item: (
                item.version_id or "",
                item.chunk_index if item.chunk_index is not None else 10**9,
                item.id,
            ),
        )

    def semantic_search_chunks(
        self,
        *,
        query: str,
        limit: int = 20,
        collection_names: Optional[list[str]] = None,
    ) -> list[SemanticChunkMatch]:
        self._ensure_backend(require_embedder=True)
        normalized_query = (query or "").strip()
        if not normalized_query:
            return []

        capped_limit = max(1, min(int(limit or 20), 200))

        try:
            query_embedding = self._embedder.embed_query(normalized_query)
        except Exception as e:
            logger.warning("Failed to embed semantic query '%s': %s", normalized_query, str(e))
            return []

        matches: list[SemanticChunkMatch] = []
        # Over-fetch because legacy collections may contain many top hits without
        # document_id, which cannot contribute to document-first semantic search.
        per_collection_limit = max(20, min(max(capped_limit * 3, 50), 100))

        for collection_ref in self._iter_collections(collection_names=collection_names):
            collection_name = getattr(collection_ref, "name", str(collection_ref))
            collection = (
                collection_ref
                if hasattr(collection_ref, "query")
                else self._client.get_collection(collection_name)
            )

            try:
                result = collection.query(
                    query_embeddings=[query_embedding],
                    n_results=per_collection_limit,
                    include=["documents", "metadatas", "distances"],
                )
            except Exception as e:
                logger.warning(
                    "Failed semantic query for collection='%s': %s",
                    collection_name,
                    str(e),
                )
                continue

            ids = (result.get("ids") or [[]])[0]
            documents = (result.get("documents") or [[]])[0]
            metadatas = (result.get("metadatas") or [[]])[0]
            distances = (result.get("distances") or [[]])[0]

            kept_count = 0
            skipped_missing_document_id = 0

            for index, chunk_id in enumerate(ids):
                metadata = metadatas[index] if index < len(metadatas) and metadatas[index] else {}
                content = documents[index] if index < len(documents) and documents[index] else ""
                distance = distances[index] if index < len(distances) and distances[index] is not None else None
                if distance is None:
                    continue

                document_id = (metadata.get("document_id") or "").strip()
                if not document_id:
                    skipped_missing_document_id += 1
                    continue

                normalized_metadata = dict(metadata)
                normalized_metadata["document_id"] = document_id

                matches.append(
                    SemanticChunkMatch(
                        chunk=ChunkRecord(
                            id=str(chunk_id),
                            collection=collection_name,
                            version_id=normalized_metadata.get("version_id"),
                            chunk_index=_resolve_chunk_index(normalized_metadata),
                            content=content,
                            metadata=normalized_metadata,
                        ),
                        score=_distance_to_score(float(distance)),
                        distance=float(distance),
                    )
                )
                kept_count += 1

            logger.debug(
                "Semantic query collection='%s' raw=%s kept=%s skipped_missing_document_id=%s requested=%s",
                collection_name,
                len(ids),
                kept_count,
                skipped_missing_document_id,
                per_collection_limit,
            )

        matches.sort(
            key=lambda item: (
                -item.score,
                item.chunk.collection,
                item.chunk.chunk_index if item.chunk.chunk_index is not None else 10**9,
                item.chunk.id,
            ),
        )
        return matches[:capped_limit]

    def semantic_search_chunks_by_collection(
        self,
        *,
        query: str,
        limit_per_collection: int = 5,
        collection_names: Optional[list[str]] = None,
    ) -> dict[str, list[SemanticChunkMatch]]:
        self._ensure_backend(require_embedder=True)
        normalized_query = (query or "").strip()
        if not normalized_query:
            return {}

        capped_limit = max(1, min(int(limit_per_collection or 5), 50))

        try:
            query_embedding = self._embedder.embed_query(normalized_query)
        except Exception as e:
            logger.warning("Failed to embed semantic query '%s': %s", normalized_query, str(e))
            return {}

        results_by_collection: dict[str, list[SemanticChunkMatch]] = {}
        for collection_ref in self._iter_collections(collection_names=collection_names):
            collection_name = getattr(collection_ref, "name", str(collection_ref))
            collection = (
                collection_ref
                if hasattr(collection_ref, "query")
                else self._client.get_collection(collection_name)
            )

            try:
                result = collection.query(
                    query_embeddings=[query_embedding],
                    n_results=capped_limit,
                    include=["documents", "metadatas", "distances"],
                )
            except Exception as e:
                logger.warning(
                    "Failed semantic query for collection='%s': %s",
                    collection_name,
                    str(e),
                )
                continue

            ids = (result.get("ids") or [[]])[0]
            documents = (result.get("documents") or [[]])[0]
            metadatas = (result.get("metadatas") or [[]])[0]
            distances = (result.get("distances") or [[]])[0]
            collection_matches: list[SemanticChunkMatch] = []

            for index, chunk_id in enumerate(ids):
                metadata = metadatas[index] if index < len(metadatas) and metadatas[index] else {}
                content = documents[index] if index < len(documents) and documents[index] else ""
                distance = distances[index] if index < len(distances) and distances[index] is not None else None
                if distance is None:
                    continue

                document_id = (metadata.get("document_id") or "").strip()
                if not document_id:
                    continue

                normalized_metadata = dict(metadata)
                normalized_metadata["document_id"] = document_id

                collection_matches.append(
                    SemanticChunkMatch(
                        chunk=ChunkRecord(
                            id=str(chunk_id),
                            collection=collection_name,
                            version_id=normalized_metadata.get("version_id"),
                            chunk_index=_resolve_chunk_index(normalized_metadata),
                            content=content,
                            metadata=normalized_metadata,
                        ),
                        score=_distance_to_score(float(distance)),
                        distance=float(distance),
                    )
                )

            collection_matches.sort(
                key=lambda item: (
                    -item.score,
                    item.chunk.chunk_index if item.chunk.chunk_index is not None else 10**9,
                    item.chunk.id,
                )
            )
            results_by_collection[collection_name] = collection_matches[:capped_limit]

        return results_by_collection

    def _iter_collections(self, *, collection_names: Optional[list[str]] = None):
        if not collection_names:
            return self._client.list_collections()

        resolved = []
        for name in collection_names:
            normalized_name = str(name or "").strip()
            if not normalized_name:
                continue
            try:
                resolved.append(self._client.get_collection(normalized_name))
            except Exception as e:
                logger.warning("Chroma collection unavailable '%s': %s", normalized_name, str(e))
        return resolved


def _coerce_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _resolve_chunk_index(metadata: dict[str, Any]) -> Optional[int]:
    explicit = _coerce_int(metadata.get("chunk_index"))
    if explicit is not None:
        return explicit

    chunk_id = str(metadata.get("id") or "").strip()
    match = re.search(r"chunk_(\d+)$", chunk_id)
    if not match:
        return None

    return _coerce_int(match.group(1))


def _distance_to_score(distance: float) -> float:
    # Chroma returns a distance where lower is better. In practice this can be
    # greater than 1.0, so `1 - distance` incorrectly collapses valid hits to 0.
    sanitized_distance = max(0.0, float(distance))
    return 1.0 / (1.0 + sanitized_distance)
