from __future__ import annotations

import logging
import os
import re
from datetime import datetime, timezone
from typing import Optional

from backend.app.models.document import Document
from backend.app.repositories.chunk_repository import (
    ChunkRecord,
    ChunkRepository,
    ChunkRepositoryUnavailableError,
    SemanticChunkMatch,
)
from backend.app.repositories.document_repository import DocumentRepository
from backend.app.repositories.document_version_repository import DocumentVersionRepository
from backend.app.repositories.source_repository import SourceRepository
from backend.app.schemas.search import SearchDocumentItem, SearchMode, SearchSortBy, SearchSortOrder

logger = logging.getLogger(__name__)

FIELD_WEIGHTS: dict[str, float] = {
    "title": 3.0,
    "topic": 5.0,
    "domain": 2.5,
    "source_type": 1.5,
    "source_id": 1.0,
}
FILENAME_TITLE_WEIGHT_MULTIPLIER = 0.35


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


MIN_KEYWORD_SCORE = _env_float("SEARCH_MIN_KEYWORD_SCORE", 1.0)
SHORT_QUERY_MIN_KEYWORD_SCORE = _env_float("SEARCH_SHORT_QUERY_MIN_KEYWORD_SCORE", 18.0)
MIN_SEMANTIC_SCORE = _env_float("SEARCH_MIN_SEMANTIC_SCORE", 0.42)
SHORT_QUERY_MIN_SEMANTIC_SCORE = _env_float("SEARCH_SHORT_QUERY_MIN_SEMANTIC_SCORE", 0.62)
MIN_HYBRID_SCORE = _env_float("SEARCH_MIN_HYBRID_SCORE", 0.15)
SHORT_QUERY_MIN_HYBRID_SCORE = _env_float("SEARCH_SHORT_QUERY_MIN_HYBRID_SCORE", 0.35)
CONTENT_KEYWORD_WEIGHT = _env_float("SEARCH_CONTENT_KEYWORD_WEIGHT", 2.0)
EXTRACTED_TEXT_SCAN_CHARS = max(int(_env_float("SEARCH_EXTRACTED_TEXT_SCAN_CHARS", 50000)), 5000)


def _normalize_text(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def _normalize_datetime(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _normalize_filter(value: Optional[str]) -> Optional[str]:
    normalized = (value or "").strip()
    return normalized or None


def _query_terms(normalized_query: str) -> list[str]:
    unique_terms: list[str] = []
    seen_terms: set[str] = set()
    for term in normalized_query.split():
        normalized_term = term.strip()
        if not normalized_term or normalized_term in seen_terms:
            continue
        seen_terms.add(normalized_term)
        unique_terms.append(normalized_term)
    return unique_terms


def _text_tokens(value: str) -> list[str]:
    return re.findall(r"\w+", _normalize_text(value), flags=re.UNICODE)


def _is_short_query(normalized_query: str, terms: Optional[list[str]] = None) -> bool:
    query_terms = terms if terms is not None else _query_terms(normalized_query)
    return bool(normalized_query) and (
        len(normalized_query) <= 3
        or (len(query_terms) == 1 and len(query_terms[0]) <= 3)
    )


def _term_in_text(term: str, normalized_text: str, *, short_query: bool) -> bool:
    if not term:
        return False
    if short_query:
        return term in set(_text_tokens(normalized_text))
    return term in normalized_text


def _phrase_in_text(normalized_query: str, normalized_text: str, *, short_query: bool) -> bool:
    if not normalized_query:
        return False
    if short_query:
        return normalized_query in set(_text_tokens(normalized_text))
    return normalized_query in normalized_text


def _find_query_start(text: str, normalized_query: str, terms: list[str]) -> int:
    normalized_text = _normalize_text(text)
    short_query = _is_short_query(normalized_query, terms)
    if not normalized_text:
        return -1

    candidates = [normalized_query, *terms]
    for candidate in candidates:
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
        else:
            start = normalized_text.find(candidate)
            if start >= 0:
                return start

    return -1


def _document_to_text_fields(document: Document) -> dict[str, str]:
    return {
        "title": _normalize_text(document.title),
        "topic": _normalize_text(document.topic),
        "domain": _normalize_text(document.domain),
        "source_type": _normalize_text(document.source_type),
        "source_id": _normalize_text(document.source_id),
    }


def _looks_like_filename(value: str) -> bool:
    normalized = (value or "").strip().lower()
    return bool(re.search(r"\.(pdf|docx?|pptx?|xlsx?|txt|md)$", normalized))


def _field_weight(field_name: str, field_value: str) -> float:
    weight = FIELD_WEIGHTS[field_name]
    if field_name == "title" and _looks_like_filename(field_value):
        return weight * FILENAME_TITLE_WEIGHT_MULTIPLIER
    return weight


def _build_metadata_snippet(document: Document, match_fields: list[str]) -> str:
    if "content" in match_fields:
        return "Content matched in document text"
    if "title" in match_fields and document.title:
        return f"Title: {document.title}"
    if "topic" in match_fields and document.topic:
        return f"Topic: {document.topic}"
    if "domain" in match_fields and document.domain:
        return f"Domain: {document.domain}"

    parts = []
    if document.title:
        parts.append(document.title)
    if document.topic and document.topic.lower() != document.title.lower():
        parts.append(document.topic)
    if document.domain:
        parts.append(document.domain)

    return " | ".join(parts[:3]) or document.id


def _trim_snippet(value: str, max_chars: int = 240) -> str:
    text = (value or "").strip()
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 3].rstrip() + "..."


def _match_score(text: str, normalized_query: str) -> int:
    normalized_text = _normalize_text(text)
    if not normalized_text or not normalized_query:
        return 0

    terms = _query_terms(normalized_query)
    short_query = _is_short_query(normalized_query, terms)
    score = 0
    if _phrase_in_text(normalized_query, normalized_text, short_query=short_query):
        score += 10
    score += sum(1 for term in terms if _term_in_text(term, normalized_text, short_query=short_query))
    return score


def _content_score(text: str, normalized_query: str) -> float:
    if not text or not normalized_query:
        return 0.0

    scan_text = text[:EXTRACTED_TEXT_SCAN_CHARS]
    raw_score = _match_score(scan_text, normalized_query)
    if raw_score <= 0:
        return 0.0
    return min(raw_score * CONTENT_KEYWORD_WEIGHT, 60.0)


def _score_field(field_value: str, normalized_query: str, terms: list[str], weight: float) -> float:
    if not field_value:
        return 0.0

    short_query = _is_short_query(normalized_query, terms)
    score = 0.0
    if field_value == normalized_query:
        score += weight * 4.0
    elif _phrase_in_text(normalized_query, field_value, short_query=short_query):
        score += weight * 2.5

    if not short_query and field_value.startswith(normalized_query):
        score += weight * 1.0

    term_hits = sum(1 for term in terms if _term_in_text(term, field_value, short_query=short_query))
    if not term_hits:
        return score

    coverage_ratio = term_hits / len(terms)
    score += weight * term_hits
    score += weight * coverage_ratio * 1.5
    if coverage_ratio == 1.0 and len(terms) > 1:
        score += weight * 1.5

    return score


def _chunk_snippet(chunk: ChunkRecord, normalized_query: str) -> str:
    text = (chunk.content or "").strip()
    if not text:
        return ""

    if not normalized_query:
        return _trim_snippet(text)

    terms = [term for term in normalized_query.split() if term]
    start = _find_query_start(text, normalized_query, terms)

    if start < 0:
        return _trim_snippet(text)

    preview_radius = 100
    slice_start = max(0, start - preview_radius)
    slice_end = min(len(text), start + len(normalized_query or terms[0]) + preview_radius)
    snippet = text[slice_start:slice_end].strip()
    if slice_start > 0:
        snippet = "..." + snippet
    if slice_end < len(text):
        snippet = snippet + "..."
    return _trim_snippet(snippet)


def _text_snippet(text: str, normalized_query: str) -> str:
    content = (text or "").strip()
    if not content:
        return ""

    terms = [term for term in normalized_query.split() if term]
    start = _find_query_start(content, normalized_query, terms)
    if start < 0:
        return _trim_snippet(content)

    preview_radius = 100
    slice_start = max(0, start - preview_radius)
    slice_end = min(len(content), start + len(normalized_query or terms[0]) + preview_radius)
    snippet = content[slice_start:slice_end].strip()
    if slice_start > 0:
        snippet = "..." + snippet
    if slice_end < len(content):
        snippet = snippet + "..."
    return _trim_snippet(snippet)


def _keyword_min_score(normalized_query: str) -> float:
    return SHORT_QUERY_MIN_KEYWORD_SCORE if _is_short_query(normalized_query) else MIN_KEYWORD_SCORE


def _semantic_min_score(normalized_query: str) -> float:
    return SHORT_QUERY_MIN_SEMANTIC_SCORE if _is_short_query(normalized_query) else MIN_SEMANTIC_SCORE


def _hybrid_min_score(normalized_query: str) -> float:
    return SHORT_QUERY_MIN_HYBRID_SCORE if _is_short_query(normalized_query) else MIN_HYBRID_SCORE


class SearchService:
    def __init__(
        self,
        document_repository: Optional[DocumentRepository] = None,
        chunk_repository: Optional[ChunkRepository] = None,
        source_repository: Optional[SourceRepository] = None,
        version_repository: Optional[DocumentVersionRepository] = None,
    ):
        self._documents = document_repository or DocumentRepository()
        self._chunks = chunk_repository
        self._sources = source_repository or SourceRepository()
        self._versions = version_repository or DocumentVersionRepository()
        self._extracted_text_cache: dict[str, str] = {}
        self._chunk_backend_disabled = False
        self._chunk_backend_error: Optional[str] = None

    def search_documents(
        self,
        *,
        search_mode: SearchMode = SearchMode.keyword,
        q: Optional[str] = None,
        domain: Optional[str] = None,
        source_id: Optional[str] = None,
        source_type: Optional[str] = None,
        status: Optional[str] = None,
        priority: Optional[str] = None,
        visibility: Optional[str] = None,
        created_by: Optional[str] = None,
        updated_after: Optional[datetime] = None,
        updated_before: Optional[datetime] = None,
        sort_by: Optional[SearchSortBy] = None,
        sort_order: Optional[SearchSortOrder] = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[SearchDocumentItem], int]:
        normalized_domain = _normalize_filter(domain)
        normalized_source_id = _normalize_filter(source_id)
        normalized_source_type = _normalize_filter(source_type)
        normalized_status = _normalize_filter(status)
        normalized_priority = _normalize_filter(priority)
        normalized_visibility = _normalize_filter(visibility)
        normalized_created_by = _normalize_filter(created_by)
        normalized_updated_after = _normalize_datetime(updated_after)
        normalized_updated_before = _normalize_datetime(updated_before)
        if normalized_updated_after and normalized_updated_before and normalized_updated_after > normalized_updated_before:
            raise ValueError("updated_after must be less than or equal to updated_before")

        capped_offset = max(0, int(offset or 0))
        capped_limit = max(1, min(int(limit or 20), 100))
        window_size = capped_offset + capped_limit
        normalized_query = _normalize_text(q)

        if search_mode == SearchMode.hybrid and normalized_query:
            scored_documents, snippet_overrides = self._search_hybrid_documents(
                normalized_query=normalized_query,
                source_id=normalized_source_id,
                domain=normalized_domain,
                source_type=normalized_source_type,
                status=normalized_status,
                priority=normalized_priority,
                visibility=normalized_visibility,
                created_by=normalized_created_by,
                updated_after=normalized_updated_after,
                updated_before=normalized_updated_before,
                limit=window_size,
            )
        elif search_mode == SearchMode.semantic and normalized_query:
            scored_documents, snippet_overrides = self._search_semantic_documents(
                normalized_query=normalized_query,
                source_id=normalized_source_id,
                domain=normalized_domain,
                source_type=normalized_source_type,
                status=normalized_status,
                priority=normalized_priority,
                visibility=normalized_visibility,
                created_by=normalized_created_by,
                updated_after=normalized_updated_after,
                updated_before=normalized_updated_before,
                limit=window_size,
            )
        else:
            scored_documents = self._search_keyword_documents(
                normalized_query=normalized_query,
                source_id=normalized_source_id,
                domain=normalized_domain,
                source_type=normalized_source_type,
                status=normalized_status,
                priority=normalized_priority,
                visibility=normalized_visibility,
                created_by=normalized_created_by,
                updated_after=normalized_updated_after,
                updated_before=normalized_updated_before,
                limit=window_size,
            )
            snippet_overrides: dict[str, tuple[str, str]] = {}

        self._sort_documents(
            scored_documents=scored_documents,
            normalized_query=normalized_query,
            sort_by=sort_by,
            sort_order=sort_order,
        )

        matched_total = len(scored_documents)
        top_documents = scored_documents[capped_offset:capped_offset + capped_limit]
        source_map = self._load_source_names(
            document.source_id
            for document, _, _ in top_documents
        )

        return self._build_search_items(
            scored_documents=top_documents,
            normalized_query=normalized_query,
            source_map=source_map,
            snippet_overrides=snippet_overrides,
        ), matched_total

    def _search_hybrid_documents(
        self,
        *,
        normalized_query: str,
        source_id: Optional[str],
        domain: Optional[str],
        source_type: Optional[str],
        status: Optional[str],
        priority: Optional[str],
        visibility: Optional[str],
        created_by: Optional[str],
        updated_after: Optional[datetime],
        updated_before: Optional[datetime],
        limit: int,
    ) -> tuple[list[tuple[Document, float, list[str]]], dict[str, tuple[str, str]]]:
        keyword_documents = self._search_keyword_documents(
            normalized_query=normalized_query,
            source_id=source_id,
            domain=domain,
            source_type=source_type,
            status=status,
            priority=priority,
            visibility=visibility,
            created_by=created_by,
            updated_after=updated_after,
            updated_before=updated_before,
            limit=limit,
        )
        semantic_documents, semantic_snippets = self._search_semantic_documents(
            normalized_query=normalized_query,
            source_id=source_id,
            domain=domain,
            source_type=source_type,
            status=status,
            priority=priority,
            visibility=visibility,
            created_by=created_by,
            updated_after=updated_after,
            updated_before=updated_before,
            limit=limit,
        )

        keyword_max = max((score for _, score, _ in keyword_documents), default=0.0)
        semantic_max = max((score for _, score, _ in semantic_documents), default=0.0)

        merged: dict[str, dict[str, object]] = {}

        for document, score, match_fields in keyword_documents:
            merged[document.id] = {
                "document": document,
                "keyword_score": score,
                "semantic_score": 0.0,
                "match_fields": list(match_fields),
            }

        for document, score, match_fields in semantic_documents:
            entry = merged.get(document.id)
            if entry is None:
                merged[document.id] = {
                    "document": document,
                    "keyword_score": 0.0,
                    "semantic_score": score,
                    "match_fields": list(match_fields),
                }
                continue

            entry["semantic_score"] = score
            combined_fields = list(entry["match_fields"])
            for field in match_fields:
                if field not in combined_fields:
                    combined_fields.append(field)
            entry["match_fields"] = combined_fields

        scored_documents: list[tuple[Document, float, list[str]]] = []
        snippet_overrides: dict[str, tuple[str, str]] = {}

        for document_id, entry in merged.items():
            document = entry["document"]
            keyword_score = float(entry["keyword_score"])
            semantic_score = float(entry["semantic_score"])
            keyword_norm = (keyword_score / keyword_max) if keyword_max > 0 else 0.0
            semantic_norm = (semantic_score / semantic_max) if semantic_max > 0 else 0.0

            hybrid_score = (0.6 * keyword_norm) + (0.4 * semantic_norm)
            if keyword_norm > 0 and semantic_norm > 0:
                hybrid_score += 0.1

            short_query = _is_short_query(normalized_query)
            if short_query and (
                keyword_score < SHORT_QUERY_MIN_KEYWORD_SCORE
                and semantic_score < SHORT_QUERY_MIN_SEMANTIC_SCORE
            ):
                continue

            if hybrid_score < _hybrid_min_score(normalized_query):
                continue

            scored_documents.append((document, hybrid_score, list(entry["match_fields"])))

            if document_id in semantic_snippets:
                snippet_overrides[document_id] = semantic_snippets[document_id]

        return scored_documents, snippet_overrides

    def _sort_documents(
        self,
        *,
        scored_documents: list[tuple[Document, float, list[str]]],
        normalized_query: str,
        sort_by: Optional[SearchSortBy],
        sort_order: Optional[SearchSortOrder],
    ) -> None:
        if sort_by == SearchSortBy.score:
            scored_documents.sort(
                key=lambda item: (
                    item[1] if sort_order == SearchSortOrder.asc else -item[1],
                    -item[0].updated_at.timestamp(),
                    item[0].id,
                )
            )
            return

        if sort_by == SearchSortBy.updated_at:
            scored_documents.sort(
                key=lambda item: (
                    item[0].updated_at.timestamp() if sort_order == SearchSortOrder.asc else -item[0].updated_at.timestamp(),
                    -item[1],
                    item[0].id,
                )
            )
            return

        if normalized_query:
            scored_documents.sort(
                key=lambda item: (
                    -item[1],
                    -item[0].updated_at.timestamp(),
                    item[0].id,
                )
            )
        else:
            scored_documents.sort(
                key=lambda item: (
                    -item[0].updated_at.timestamp(),
                    item[0].id,
                )
            )

    def _search_keyword_documents(
        self,
        *,
        normalized_query: str,
        source_id: Optional[str],
        domain: Optional[str],
        source_type: Optional[str],
        status: Optional[str],
        priority: Optional[str],
        visibility: Optional[str],
        created_by: Optional[str],
        updated_after: Optional[datetime],
        updated_before: Optional[datetime],
        limit: int,
    ) -> list[tuple[Document, float, list[str]]]:
        candidate_limit = min(max(limit * 10, 50), 500)
        candidates = self._documents.list_documents_for_search(
            limit=candidate_limit,
            domain=domain,
            source_id=source_id,
            source_type=source_type,
            status=status,
            priority=priority,
            created_by=created_by,
            updated_after=updated_after,
            updated_before=updated_before,
        )

        scored_documents: list[tuple[Document, float, list[str]]] = []
        for document in candidates:
            if visibility and getattr(document, "visibility", "public") != visibility.strip():
                continue
            score, match_fields = self._score_document(document, normalized_query)
            if normalized_query and score <= 0:
                continue
            if normalized_query and score < _keyword_min_score(normalized_query):
                continue

            scored_documents.append((document, score, match_fields))

        return scored_documents

    def _search_semantic_documents(
        self,
        *,
        normalized_query: str,
        source_id: Optional[str],
        domain: Optional[str],
        source_type: Optional[str],
        status: Optional[str],
        priority: Optional[str],
        visibility: Optional[str],
        created_by: Optional[str],
        updated_after: Optional[datetime],
        updated_before: Optional[datetime],
        limit: int,
    ) -> tuple[list[tuple[Document, float, list[str]]], dict[str, tuple[str, str]]]:
        candidate_limit = min(max(limit * 8, 40), 200)
        chunk_repository = self._get_chunk_repository(required=True)
        try:
            semantic_matches = chunk_repository.semantic_search_chunks(
                query=normalized_query,
                limit=candidate_limit,
            )
        except ChunkRepositoryUnavailableError as e:
            self._disable_chunk_backend(e)
            raise SearchBackendUnavailableError(self._chunk_backend_error or str(e)) from e
        grouped_matches = self._group_semantic_matches_by_document(semantic_matches)

        scored_documents: list[tuple[Document, float, list[str]]] = []
        snippet_overrides: dict[str, tuple[str, str]] = {}

        for document_id, matches in grouped_matches.items():
            document = self._documents.get_document_by_id(document_id)
            if document is None:
                continue
            if not self._document_matches_filters(
                document=document,
                source_id=source_id,
                domain=domain,
                source_type=source_type,
                status=status,
                priority=priority,
                visibility=visibility,
                created_by=created_by,
                updated_after=updated_after,
                updated_before=updated_before,
            ):
                continue

            score = self._aggregate_semantic_document_score(matches)
            best_score = matches[0].score if matches else 0.0
            if score <= 0 or best_score < _semantic_min_score(normalized_query):
                continue

            best_match = matches[0]
            snippet_overrides[document.id] = (
                _chunk_snippet(best_match.chunk, normalized_query),
                "chunk",
            )
            scored_documents.append((document, score, ["semantic"]))

        return scored_documents, snippet_overrides

    def _group_semantic_matches_by_document(
        self,
        matches: list[SemanticChunkMatch],
    ) -> dict[str, list[SemanticChunkMatch]]:
        grouped: dict[str, list[SemanticChunkMatch]] = {}

        for match in matches:
            document_id = (match.chunk.metadata.get("document_id") or "").strip()
            if not document_id:
                continue
            grouped.setdefault(document_id, []).append(match)

        for document_matches in grouped.values():
            document_matches.sort(
                key=lambda item: (
                    -item.score,
                    item.chunk.chunk_index if item.chunk.chunk_index is not None else 10**9,
                    item.chunk.id,
                )
            )

        return grouped

    def _aggregate_semantic_document_score(
        self,
        matches: list[SemanticChunkMatch],
    ) -> float:
        score = 0.0
        for index, match in enumerate(matches[:3]):
            score += match.score / (index + 1)

        if len(matches) > 1:
            score += min(0.2, 0.05 * (len(matches) - 1))

        return score

    def _document_matches_filters(
        self,
        *,
        document: Document,
        source_id: Optional[str],
        domain: Optional[str],
        source_type: Optional[str],
        status: Optional[str],
        priority: Optional[str],
        visibility: Optional[str],
        created_by: Optional[str],
        updated_after: Optional[datetime],
        updated_before: Optional[datetime],
    ) -> bool:
        normalized_updated_after = _normalize_datetime(updated_after)
        normalized_updated_before = _normalize_datetime(updated_before)

        if source_id and document.source_id != source_id.strip():
            return False
        if domain and document.domain != domain.strip():
            return False
        if source_type and document.source_type != source_type.strip():
            return False
        if status and document.status != status.strip():
            return False
        if priority and document.priority != priority.strip():
            return False
        if visibility and getattr(document, "visibility", "public") != visibility.strip():
            return False
        if created_by and document.created_by != created_by.strip():
            return False
        if normalized_updated_after and document.updated_at < normalized_updated_after:
            return False
        if normalized_updated_before and document.updated_at > normalized_updated_before:
            return False
        return True

    def _build_search_items(
        self,
        *,
        scored_documents: list[tuple[Document, float, list[str]]],
        normalized_query: str,
        source_map: dict[str, str],
        snippet_overrides: dict[str, tuple[str, str]],
    ) -> list[SearchDocumentItem]:
        items: list[SearchDocumentItem] = []

        for document, score, match_fields in scored_documents:
            snippet, snippet_source = snippet_overrides.get(document.id, ("", ""))
            if not snippet:
                snippet, snippet_source = self._select_snippet(
                    document=document,
                    normalized_query=normalized_query,
                    match_fields=match_fields,
                )

            items.append(
                SearchDocumentItem(
                    id=document.id,
                    source_id=document.source_id,
                    source_name=source_map.get(document.source_id, document.source_id or "unknown_source"),
                    title=document.title,
                    source_type=document.source_type,
                    status=document.status,
                    domain=document.domain,
                    topic=document.topic,
                    priority=document.priority,
                    visibility=getattr(document, "visibility", "public"),
                    current_version=document.current_version,
                    created_at=document.created_at,
                    updated_at=document.updated_at,
                    score=score,
                    match_fields=match_fields,
                    snippet=snippet,
                    snippet_source=snippet_source,
                )
            )

        return items

    def _load_source_names(self, source_ids) -> dict[str, str]:
        normalized_ids: list[str] = []
        seen_ids: set[str] = set()
        for source_id in source_ids:
            normalized_id = (source_id or "").strip()
            if not normalized_id or normalized_id in seen_ids:
                continue
            seen_ids.add(normalized_id)
            normalized_ids.append(normalized_id)

        if not normalized_ids:
            return {}

        try:
            source_map = self._sources.get_sources_by_ids(normalized_ids)
        except Exception:
            return {}

        return {
            source_id: (source.name or source_id)
            for source_id, source in source_map.items()
        }

    def _score_document(self, document: Document, normalized_query: str) -> tuple[float, list[str]]:
        if not normalized_query:
            return 0.0, []

        terms = _query_terms(normalized_query)
        if not terms:
            return 0.0, []

        fields = _document_to_text_fields(document)
        score = 0.0
        matched_fields: list[str] = []

        for field_name, field_value in fields.items():
            if not field_value:
                continue

            field_score = _score_field(
                field_value=field_value,
                normalized_query=normalized_query,
                terms=terms,
                weight=_field_weight(field_name, field_value),
            )
            if field_score > 0:
                score += field_score
                matched_fields.append(field_name)

        extracted_text = self._get_extracted_text(document.id)
        content_score = _content_score(extracted_text, normalized_query)
        if content_score > 0:
            score += content_score
            matched_fields.append("content")

        return score, matched_fields

    def _get_extracted_text(self, document_id: str) -> str:
        if document_id in self._extracted_text_cache:
            return self._extracted_text_cache[document_id]

        try:
            latest_version = self._versions.get_latest_by_document(document_id)
            extracted_text = (latest_version.extracted_text if latest_version else None) or ""
        except Exception:
            extracted_text = ""

        self._extracted_text_cache[document_id] = extracted_text
        return extracted_text

    def _get_chunk_repository(self, *, required: bool) -> Optional[ChunkRepository]:
        if self._chunk_backend_disabled:
            if required:
                raise SearchBackendUnavailableError(
                    self._chunk_backend_error or "Vector backend unavailable"
                )
            return None

        if self._chunks is None:
            self._chunks = ChunkRepository()

        return self._chunks

    def _disable_chunk_backend(self, error: Exception) -> None:
        if self._chunk_backend_disabled:
            return

        self._chunk_backend_disabled = True
        self._chunk_backend_error = str(error)
        logger.warning("Disabling vector backend for this request scope: %s", str(error))

    def _select_snippet(
        self,
        *,
        document: Document,
        normalized_query: str,
        match_fields: list[str],
    ) -> tuple[str, str]:
        if normalized_query and "content" in match_fields:
            content_snippet = _text_snippet(self._get_extracted_text(document.id), normalized_query)
            if content_snippet:
                return content_snippet, "extracted_text"

        chunk_repository = self._get_chunk_repository(required=False)
        if chunk_repository is None:
            return _trim_snippet(_build_metadata_snippet(document, match_fields)), "metadata"

        try:
            chunks = chunk_repository.list_chunks_by_document(document_id=document.id, limit=5)
        except ChunkRepositoryUnavailableError as e:
            self._disable_chunk_backend(e)
            chunks = []
        except Exception:
            chunks = []

        if chunks:
            scored_chunks = [
                (chunk, _match_score(chunk.content, normalized_query))
                for chunk in chunks
            ]
            scored_chunks.sort(
                key=lambda item: (
                    -item[1],
                    item[0].chunk_index if item[0].chunk_index is not None else 10**9,
                    item[0].id,
                )
            )
            best_chunk, best_score = scored_chunks[0]
            if best_score > 0 or not normalized_query:
                return _chunk_snippet(best_chunk, normalized_query), "chunk"

        return _trim_snippet(_build_metadata_snippet(document, match_fields)), "metadata"


class SearchBackendUnavailableError(RuntimeError):
    """Raised when a requested search mode depends on an unavailable backend."""
