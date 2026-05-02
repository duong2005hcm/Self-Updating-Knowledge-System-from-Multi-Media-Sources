from __future__ import annotations

import logging
import os
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from backend.app.models.document import Document
from backend.app.models.document_version import DocumentVersion
from backend.app.repositories.chunk_repository import ChunkRecord, ChunkRepository
from backend.app.repositories.document_repository import DocumentRepository
from backend.app.repositories.document_version_repository import DocumentVersionRepository
from backend.app.repositories.source_repository import SourceRepository
from backend.app.config.openai_factory import get_openai_client
from backend.app.services.checksum_service import canonicalize_url

logger = logging.getLogger(__name__)


def _env_int(name: str, default: int, minimum: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return max(int(raw), minimum)
    except ValueError:
        return default

EXTRACTED_TEXT_MAX_BYTES = 600_000
DOCUMENT_PREVIEW_SCAN_LIMIT = 100
DOCUMENT_PREVIEW_AI_MODEL = os.getenv("DOCUMENT_PREVIEW_AI_MODEL", "gpt-4o-mini")
DOCUMENT_PREVIEW_AI_MAX_CONTEXT_CHARS = _env_int("DOCUMENT_PREVIEW_AI_MAX_CONTEXT_CHARS", 12000, 2000)
DOCUMENT_PREVIEW_AI_MAX_TOKENS = _env_int("DOCUMENT_PREVIEW_AI_MAX_TOKENS", 260, 80)


def _normalize_text(value: str, fallback: str = "") -> str:
    normalized = (value or "").strip()
    return normalized or fallback


def _normalize_visibility(value: str) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {"public", "protected", "private"}:
        return normalized
    return "public"


def _text_tokens(value: str) -> list[str]:
    return re.findall(r"\w+", (value or "").strip().lower(), flags=re.UNICODE)


def _query_terms(value: str) -> list[str]:
    seen: set[str] = set()
    terms: list[str] = []
    for term in _text_tokens(value):
        if term in seen:
            continue
        seen.add(term)
        terms.append(term)
    return terms


def _is_short_query(query: str, terms: Optional[list[str]] = None) -> bool:
    query_terms = terms if terms is not None else _query_terms(query)
    normalized_query = (query or "").strip()
    return bool(normalized_query) and (
        len(normalized_query) <= 3
        or (len(query_terms) == 1 and len(query_terms[0]) <= 3)
    )


def _term_in_text(term: str, text: str, *, short_query: bool) -> bool:
    if short_query:
        return term in set(_text_tokens(text))
    return term in (text or "").lower()


def _match_score(text: str, query: str) -> float:
    normalized_query = (query or "").strip().lower()
    normalized_text = (text or "").strip().lower()
    if not normalized_query or not normalized_text:
        return 0.0

    terms = _query_terms(normalized_query)
    if not terms:
        return 0.0

    short_query = _is_short_query(normalized_query, terms)
    score = 0.0
    if short_query:
        if normalized_query in set(_text_tokens(normalized_text)):
            score += 10.0
    elif normalized_query in normalized_text:
        score += 10.0

    term_hits = sum(1 for term in terms if _term_in_text(term, normalized_text, short_query=short_query))
    score += float(term_hits)
    if terms and term_hits == len(terms):
        score += 3.0
    return score


def _find_query_start(text: str, query: str) -> int:
    normalized_text = (text or "").lower()
    normalized_query = (query or "").strip().lower()
    terms = _query_terms(normalized_query)
    short_query = _is_short_query(normalized_query, terms)

    for candidate in [normalized_query, *terms]:
        if not candidate:
            continue
        if short_query:
            match = re.search(
                rf"(?<!\w){re.escape(candidate)}(?!\w)",
                normalized_text,
                flags=re.UNICODE,
            )
            if match:
                return match.start()
            continue

        start = normalized_text.find(candidate)
        if start >= 0:
            return start

    return -1


def _trim_preview(value: str, max_chars: int) -> str:
    text = " ".join((value or "").split())
    if len(text) <= max_chars:
        return text
    return text[: max(0, max_chars - 3)].rstrip() + "..."


def _query_snippet(text: str, query: str, preview_chars: int) -> str:
    content = (text or "").strip()
    if not content:
        return ""

    start = _find_query_start(content, query)
    if start < 0:
        return _trim_preview(content, preview_chars)

    radius = max(120, int(preview_chars / 2))
    slice_start = max(0, start - radius)
    slice_end = min(len(content), start + len(query or "") + radius)
    snippet = content[slice_start:slice_end].strip()
    if slice_start > 0:
        snippet = "..." + snippet
    if slice_end < len(content):
        snippet = snippet + "..."
    return _trim_preview(snippet, preview_chars)


def _best_text_preview(text: str, preview_chars: int) -> str:
    normalized = " ".join((text or "").split())
    if not normalized:
        return ""

    sentences = re.split(r"(?<=[.!?。！？])\s+", normalized)
    selected: list[str] = []
    total = 0
    for sentence in sentences:
        sentence = sentence.strip()
        if len(sentence) < 20:
            continue
        next_total = total + len(sentence) + (1 if selected else 0)
        if selected and next_total > preview_chars:
            break
        selected.append(sentence)
        total = next_total
        if total >= preview_chars * 0.7:
            break

    if selected:
        return _trim_preview(" ".join(selected), preview_chars)
    return _trim_preview(normalized, preview_chars)


def _chunk_quality_score(chunk: ChunkRecord) -> float:
    content = " ".join((chunk.content or "").split())
    if not content:
        return 0.0

    length_score = min(len(content) / 900.0, 1.0)
    sentence_score = min(len(re.findall(r"[.!?。！？]", content)) / 4.0, 1.0)
    heading_penalty = 0.2 if len(content) < 80 else 0.0
    return max(0.0, length_score + sentence_score - heading_penalty)



def _stable_id(prefix: str, key: str) -> str:
    stable = uuid.uuid5(uuid.NAMESPACE_URL, key).hex
    return f"{prefix}_{stable}"



def _normalize_source_locator(source_type: str, source_locator: str) -> str:
    normalized_type = _normalize_text(source_type, "unknown").lower()
    raw = _normalize_text(source_locator)
    if normalized_type in {"web", "news", "rss"}:
        canonical = canonicalize_url(raw)
        return canonical or raw
    return raw



def _normalize_document_identifier(source_type: str, document_identifier: str) -> str:
    normalized_type = _normalize_text(source_type, "unknown").lower()
    raw = _normalize_text(document_identifier)
    if normalized_type in {"web", "news", "rss"}:
        canonical = canonicalize_url(raw)
        return canonical or raw
    return raw


@dataclass
class DocumentSyncResult:
    action: str  # created | updated | skipped
    source_id: str
    document_id: str
    version_id: str
    version_no: int
    checksum: str


@dataclass
class DocumentPreviewSnippet:
    id: str
    chunk_id: Optional[str]
    chunk_index: Optional[int]
    text: str
    score: float
    source: str
    metadata: dict[str, Any]


class DocumentNotFoundError(Exception):
    pass


class DocumentService:
    def __init__(
        self,
        document_repository: Optional[DocumentRepository] = None,
        version_repository: Optional[DocumentVersionRepository] = None,
        source_repository: Optional[SourceRepository] = None,
        chunk_repository: Optional[ChunkRepository] = None,
        openai_client=None,
    ):
        self._documents = document_repository or DocumentRepository()
        self._versions = version_repository or DocumentVersionRepository()
        self._sources = source_repository or SourceRepository()
        self._chunks = chunk_repository
        self._openai_client = openai_client

    def list_documents(
        self,
        *,
        limit: int = 50,
        source_id: Optional[str] = None,
        status: Optional[str] = None,
        domain: Optional[str] = None,
    ) -> list[Document]:
        return self._documents.list_documents(
            limit=limit,
            source_id=source_id,
            status=status,
            domain=domain,
        )

    def get_document(self, document_id: str) -> Document:
        document = self._documents.get_document_by_id(document_id)
        if document is None:
            raise DocumentNotFoundError(f"Document not found: {document_id}")
        return document

    def list_document_chunks(self, *, document_id: str, limit: int = 50) -> list[ChunkRecord]:
        self.get_document(document_id)
        chunk_repository = self._chunks or ChunkRepository()
        return chunk_repository.list_chunks_by_document(document_id=document_id, limit=limit)

    def build_document_preview(
        self,
        *,
        document_id: str,
        query: Optional[str] = None,
        limit: int = 3,
        preview_chars: int = 700,
    ) -> tuple[str, list[DocumentPreviewSnippet]]:
        self.get_document(document_id)
        capped_limit = max(1, min(int(limit or 3), 10))
        capped_preview_chars = max(120, min(int(preview_chars or 700), 2000))
        normalized_query = (query or "").strip()

        latest_version = self._versions.get_latest_by_document(document_id)
        extracted_text = (latest_version.extracted_text if latest_version else None) or ""

        chunks: list[ChunkRecord] = []
        if normalized_query:
            try:
                chunks = self.list_document_chunks(
                    document_id=document_id,
                    limit=DOCUMENT_PREVIEW_SCAN_LIMIT,
                )
            except Exception:
                chunks = []

        if normalized_query:
            matched = [
                (chunk, _match_score(chunk.content, normalized_query))
                for chunk in chunks
                if chunk.content
            ]
            matched = [(chunk, score) for chunk, score in matched if score > 0]
            matched.sort(
                key=lambda item: (
                    -item[1],
                    item[0].chunk_index if item[0].chunk_index is not None else 10**9,
                    item[0].id,
                )
            )
            if matched:
                snippets = [
                    DocumentPreviewSnippet(
                        id=f"{chunk.id}:match",
                        chunk_id=chunk.id,
                        chunk_index=chunk.chunk_index,
                        text=_query_snippet(chunk.content, normalized_query, capped_preview_chars),
                        score=score,
                        source="matched_chunk",
                        metadata=chunk.metadata,
                    )
                    for chunk, score in matched[:capped_limit]
                ]
                ai_summary = self._build_ai_summary_snippet(
                    document_id=document_id,
                    query=normalized_query,
                    context="\n\n".join(snippet.text for snippet in snippets),
                    derived_from="matched_chunks",
                    latest_version=latest_version,
                    chunks=[chunk for chunk, _score in matched[:capped_limit]],
                    preview_chars=capped_preview_chars,
                )
                if ai_summary:
                    return "ai_summary", [ai_summary]
                return "matched_snippets", snippets

        summary = _best_text_preview(extracted_text, capped_preview_chars)
        if summary:
            ai_summary = self._build_ai_summary_snippet(
                document_id=document_id,
                query=normalized_query or None,
                context=extracted_text,
                derived_from="extracted_text",
                latest_version=latest_version,
                chunks=[],
                preview_chars=capped_preview_chars,
            )
            if ai_summary:
                return "ai_summary", [ai_summary]
            return "extractive_summary", [
                DocumentPreviewSnippet(
                    id=f"{document_id}:summary",
                    chunk_id=None,
                    chunk_index=None,
                    text=summary,
                    score=1.0,
                    source="extracted_text",
                    metadata={
                        "document_id": document_id,
                        "version_id": latest_version.id if latest_version else None,
                        "version_no": latest_version.version_no if latest_version else None,
                    },
                )
            ]

        if not chunks:
            try:
                chunks = self.list_document_chunks(
                    document_id=document_id,
                    limit=DOCUMENT_PREVIEW_SCAN_LIMIT,
                )
            except Exception:
                chunks = []

        ranked_chunks = [
            (chunk, _chunk_quality_score(chunk))
            for chunk in chunks
            if chunk.content
        ]
        ranked_chunks = [(chunk, score) for chunk, score in ranked_chunks if score > 0]
        ranked_chunks.sort(
            key=lambda item: (
                -item[1],
                item[0].chunk_index if item[0].chunk_index is not None else 10**9,
                item[0].id,
            )
        )

        best_snippets = [
            DocumentPreviewSnippet(
                id=f"{chunk.id}:best",
                chunk_id=chunk.id,
                chunk_index=chunk.chunk_index,
                text=_best_text_preview(chunk.content, capped_preview_chars),
                score=score,
                source="quality_chunk",
                metadata=chunk.metadata,
            )
            for chunk, score in ranked_chunks[:capped_limit]
        ]
        if best_snippets:
            ai_summary = self._build_ai_summary_snippet(
                document_id=document_id,
                query=normalized_query or None,
                context="\n\n".join(snippet.text for snippet in best_snippets),
                derived_from="quality_chunks",
                latest_version=latest_version,
                chunks=[chunk for chunk, _score in ranked_chunks[:capped_limit]],
                preview_chars=capped_preview_chars,
            )
            if ai_summary:
                return "ai_summary", [ai_summary]

        return "best_snippets", best_snippets

    def _build_ai_summary_snippet(
        self,
        *,
        document_id: str,
        query: Optional[str],
        context: str,
        derived_from: str,
        latest_version: Optional[DocumentVersion],
        chunks: list[ChunkRecord],
        preview_chars: int,
    ) -> Optional[DocumentPreviewSnippet]:
        summary = self._generate_ai_preview_summary(
            context=context,
            query=query,
            preview_chars=preview_chars,
        )
        if not summary:
            return None

        metadata: dict[str, Any] = {
            "document_id": document_id,
            "version_id": latest_version.id if latest_version else None,
            "version_no": latest_version.version_no if latest_version else None,
            "derived_from": derived_from,
        }
        if chunks:
            first_chunk = chunks[0]
            metadata.update({
                "source_name": first_chunk.metadata.get("source_name"),
                "document_name": first_chunk.metadata.get("document_name"),
                "page_start": first_chunk.metadata.get("page_start"),
                "page_end": first_chunk.metadata.get("page_end"),
                "page_numbers": first_chunk.metadata.get("page_numbers"),
            })

        return DocumentPreviewSnippet(
            id=f"{document_id}:ai_summary",
            chunk_id=None,
            chunk_index=None,
            text=summary,
            score=1.0,
            source="ai_summary",
            metadata={key: value for key, value in metadata.items() if value is not None},
        )

    def _generate_ai_preview_summary(
        self,
        *,
        context: str,
        query: Optional[str],
        preview_chars: int,
    ) -> str:
        normalized_context = " ".join((context or "").split())
        if not normalized_context:
            return ""

        context_window = normalized_context[:DOCUMENT_PREVIEW_AI_MAX_CONTEXT_CHARS]
        query_instruction = (
            f"User query: {query}\nFocus the summary on why this document is relevant to that query."
            if query
            else "No user query was provided. Summarize the overall document content."
        )
        prompt = (
            "Create a user-facing document preview summary for a knowledge platform.\n"
            "Use only the provided context. Do not invent facts. Do not say you are an AI.\n"
            "If the source text is Vietnamese, answer in Vietnamese. Otherwise use the source language.\n"
            "Return 2-4 short bullets or one compact paragraph that helps a user decide whether to open/read the document.\n\n"
            f"{query_instruction}\n\n"
            f"Document context:\n{context_window}"
        )

        try:
            client = self._openai_client or get_openai_client()
            response = client.chat.completions.create(
                model=DOCUMENT_PREVIEW_AI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You write concise, faithful document preview summaries.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=DOCUMENT_PREVIEW_AI_MAX_TOKENS,
            )
            content = response.choices[0].message.content or ""
            return _trim_preview(content.strip(), preview_chars)
        except Exception as e:
            logger.warning("AI document preview summary failed: %s", str(e))
            return ""

    def list_document_versions(self, document_id: str) -> list[DocumentVersion]:
        self.get_document(document_id)
        return self._versions.list_versions_by_document(document_id)

    def update_version_artifacts(
        self,
        *,
        version_id: str,
        raw_path: Optional[str] = None,
        extracted_text: Optional[str] = None,
    ) -> Optional[DocumentVersion]:
        updates: dict[str, object] = {}
        if raw_path:
            updates["raw_path"] = raw_path

        normalized_extracted_text = (extracted_text or "").strip()
        if normalized_extracted_text:
            if len(normalized_extracted_text.encode("utf-8")) <= EXTRACTED_TEXT_MAX_BYTES:
                updates["extracted_text"] = normalized_extracted_text

        if not updates:
            return None

        return self._versions.update_version(version_id, updates)

    def compute_source_id(self, *, source_type: str, source_locator: str) -> str:
        normalized_source_type = _normalize_text(source_type, "unknown")
        normalized_locator = _normalize_source_locator(normalized_source_type, source_locator)
        locator = _normalize_text(normalized_locator, normalized_source_type)
        return _stable_id("src", f"{normalized_source_type}|{locator}")

    def compute_document_id(
        self,
        *,
        source_id: str,
        document_identifier: str,
        source_type: str,
    ) -> str:
        normalized_identifier = _normalize_document_identifier(source_type, document_identifier)
        identifier = _normalize_text(normalized_identifier, source_id)
        return _stable_id("doc", f"{source_id}|{identifier}")

    def touch_source_last_sync(
        self,
        *,
        source_type: str,
        source_locator: str,
        source_name: str,
        domain: str,
        created_by: str,
        synced_at: Optional[datetime] = None,
    ) -> str:
        normalized_source_type = _normalize_text(source_type, "unknown")
        normalized_locator = _normalize_source_locator(normalized_source_type, source_locator)
        source_id = self.compute_source_id(
            source_type=normalized_source_type,
            source_locator=normalized_locator,
        )
        self._sources.touch_source_sync(
            source_id=source_id,
            name=_normalize_text(source_name, normalized_locator),
            source_type=normalized_source_type,
            url_or_path=normalized_locator,
            domain=_normalize_text(domain, "general"),
            created_by=_normalize_text(created_by, "system"),
            synced_at=synced_at,
        )
        return source_id

    def sync_document_version(
        self,
        *,
        source_type: str,
        source_locator: str,
        document_identifier: str,
        title: str,
        created_by: str,
        domain: str,
        topic: str,
        priority: str,
        visibility: str,
        status: str,
        checksum: str,
        ingest_job_id: str,
    ) -> DocumentSyncResult:
        normalized_source_type = _normalize_text(source_type, "unknown")
        normalized_locator = _normalize_source_locator(normalized_source_type, source_locator)
        normalized_identifier = _normalize_document_identifier(normalized_source_type, document_identifier)

        source_id = self.compute_source_id(
            source_type=normalized_source_type,
            source_locator=normalized_locator,
        )
        document_id = self.compute_document_id(
            source_id=source_id,
            document_identifier=normalized_identifier,
            source_type=normalized_source_type,
        )

        existing_doc = self._documents.get_document_by_id(document_id)
        checksum_value = _normalize_text(checksum)

        if existing_doc is None:
            return self._create_new_document_and_version(
                source_id=source_id,
                document_id=document_id,
                title=title,
                source_type=normalized_source_type,
                created_by=created_by,
                domain=domain,
                topic=topic,
                priority=priority,
                visibility=visibility,
                status=status,
                checksum=checksum_value,
                ingest_job_id=ingest_job_id,
            )

        if _normalize_text(existing_doc.checksum or "") == checksum_value and checksum_value:
            version = self._versions.get_latest_by_document(document_id)
            if version is None:
                version = self._create_version(
                    document_id=document_id,
                    version_no=existing_doc.current_version or 1,
                    checksum=checksum_value,
                    ingest_job_id=ingest_job_id,
                )

            return DocumentSyncResult(
                action="skipped",
                source_id=source_id,
                document_id=document_id,
                version_id=version.id,
                version_no=version.version_no,
                checksum=checksum_value,
            )

        next_version_no = int(existing_doc.current_version or 0) + 1
        updated_doc = self._documents.update_document(
            document_id,
            {
                "title": _normalize_text(title, existing_doc.title),
                "source_type": normalized_source_type,
                "domain": _normalize_text(domain, existing_doc.domain),
                "topic": _normalize_text(topic, existing_doc.topic),
                "priority": _normalize_text(priority, existing_doc.priority),
                "visibility": _normalize_visibility(visibility),
                "status": _normalize_text(status, existing_doc.status),
                "checksum": checksum_value,
                "current_version": next_version_no,
            },
        )
        if updated_doc is None:
            raise ValueError(f"Document not found during update: {document_id}")

        version = self._create_version(
            document_id=document_id,
            version_no=next_version_no,
            checksum=checksum_value,
            ingest_job_id=ingest_job_id,
        )

        return DocumentSyncResult(
            action="updated",
            source_id=source_id,
            document_id=document_id,
            version_id=version.id,
            version_no=version.version_no,
            checksum=checksum_value,
        )

    def _create_new_document_and_version(
        self,
        *,
        source_id: str,
        document_id: str,
        title: str,
        source_type: str,
        created_by: str,
        domain: str,
        topic: str,
        priority: str,
        visibility: str,
        status: str,
        checksum: str,
        ingest_job_id: str,
    ) -> DocumentSyncResult:
        document = Document.create(
            document_id=document_id,
            source_id=source_id,
            title=_normalize_text(title, document_id),
            source_type=_normalize_text(source_type, "unknown"),
            created_by=_normalize_text(created_by, "system"),
            domain=_normalize_text(domain, "general"),
            topic=_normalize_text(topic, "general"),
            priority=_normalize_text(priority, "normal"),
            visibility=_normalize_visibility(visibility),
            status=_normalize_text(status, "active"),
            checksum=checksum,
            current_version=1,
        )
        self._documents.create_document(document)

        version = self._create_version(
            document_id=document.id,
            version_no=1,
            checksum=checksum,
            ingest_job_id=ingest_job_id,
        )

        return DocumentSyncResult(
            action="created",
            source_id=source_id,
            document_id=document.id,
            version_id=version.id,
            version_no=version.version_no,
            checksum=checksum,
        )

    def _create_version(
        self,
        *,
        document_id: str,
        version_no: int,
        checksum: str,
        ingest_job_id: str,
    ) -> DocumentVersion:
        version = DocumentVersion.create(
            document_id=document_id,
            version_no=version_no,
            ingest_job_id=ingest_job_id,
            checksum=checksum,
            status="success",
        )
        return self._versions.create_version(version)
