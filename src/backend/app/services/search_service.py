from __future__ import annotations

import logging
import os
import re
import unicodedata
from dataclasses import dataclass, field
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


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


SEARCH_DEFAULT_SEMANTIC_MIN_SCORE = _env_float("SEARCH_DEFAULT_SEMANTIC_MIN_SCORE", 0.35)
SEARCH_DEFAULT_HYBRID_MIN_SCORE = _env_float("SEARCH_DEFAULT_HYBRID_MIN_SCORE", 0.35)
SEARCH_STRONG_SEMANTIC_SCORE = _env_float("SEARCH_STRONG_SEMANTIC_SCORE", 0.55)
SEARCH_EXTRACTED_TEXT_SCAN_CHARS = max(int(_env_float("SEARCH_EXTRACTED_TEXT_SCAN_CHARS", 40000)), 8000)

SYNONYM_MAP: dict[str, list[str]] = {
    "cham noi": [
        "cham phat trien ngon ngu",
        "roi loan ngon ngu",
        "tre cham noi",
        "speech delay",
    ],
    "tieu duong": ["dai thao duong", "diabetes"],
    "tim mach": ["huyet ap", "cardiovascular", "benh tim mach"],
    "sot xuat huyet": ["dengue", "sot dengue"],
}


@dataclass
class QueryBundle:
    raw: str
    normalized: str
    stripped: str
    terms: list[str]
    phrases: list[str]


@dataclass
class LexicalAnalysis:
    keyword_score: float
    metadata_score: float
    overlap_count: int
    overlap_ratio: float
    matched_fields: list[str] = field(default_factory=list)
    has_phrase_match: bool = False
    reason: str = ""


@dataclass
class CandidateScore:
    document: Document
    score: float
    semantic_score: float
    keyword_score: float
    metadata_score: float
    matched_fields: list[str]
    snippet: str
    snippet_source: str
    reason: str = ""


def _normalize_datetime(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _normalize_filter(value: Optional[str]) -> Optional[str]:
    normalized = (value or "").strip()
    return normalized or None


def _collapse_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def _normalize_text(value: Optional[str]) -> str:
    return _collapse_spaces(value or "").lower()


def _strip_vietnamese_diacritics(value: str) -> str:
    normalized = _normalize_text(value).replace("đ", "d")
    decomposed = unicodedata.normalize("NFD", normalized)
    without_marks = "".join(
        character for character in decomposed if unicodedata.category(character) != "Mn"
    )
    return _collapse_spaces(re.sub(r"[^a-z0-9\s]", " ", without_marks))


def _tokenize(value: str) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-z0-9]+", _strip_vietnamese_diacritics(value), flags=re.UNICODE)
        if len(token.strip()) >= 2
    ]


def _unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    items: list[str] = []
    for value in values:
        normalized = (value or "").strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        items.append(normalized)
    return items


def _build_query_bundle(query: str) -> QueryBundle:
    normalized = _normalize_text(query)
    stripped = _strip_vietnamese_diacritics(normalized)
    phrases = [stripped] if stripped else []

    for key, values in SYNONYM_MAP.items():
        normalized_key = _strip_vietnamese_diacritics(key)
        normalized_values = [_strip_vietnamese_diacritics(item) for item in values]
        if normalized_key and normalized_key in stripped:
            phrases.extend([normalized_key, *normalized_values])
            continue
        if any(value and value in stripped for value in normalized_values):
            phrases.extend([normalized_key, *normalized_values])

    phrases = _unique(phrases)
    terms = _unique([token for phrase in phrases for token in _tokenize(phrase)])

    return QueryBundle(
        raw=query,
        normalized=normalized,
        stripped=stripped,
        terms=terms,
        phrases=phrases,
    )


def _terms_for_guard(bundle: QueryBundle) -> int:
    return max(len(bundle.terms), 1)


def _required_overlap_ratio(bundle: QueryBundle) -> float:
    if len(bundle.terms) <= 1:
        return 1.0
    if len(bundle.terms) == 2:
        return 0.6
    return 0.5


def _field_match_score(bundle: QueryBundle, value: str, *, phrase_boost: float) -> tuple[float, set[str], bool]:
    normalized = _strip_vietnamese_diacritics(value)
    if not normalized:
        return 0.0, set(), False

    token_set = set(_tokenize(normalized))
    matched_terms = {
        term
        for term in bundle.terms
        if term in token_set or (len(term) >= 5 and term in normalized)
    }
    phrase_match = any(phrase and phrase in normalized for phrase in bundle.phrases)
    if not bundle.terms:
        base_score = 0.0
    else:
        base_score = len(matched_terms) / len(bundle.terms)

    score = base_score
    if phrase_match:
        score = max(score, phrase_boost)
    elif base_score == 1.0 and len(bundle.terms) > 1:
        score = min(1.0, base_score + 0.12)

    return min(score, 1.0), matched_terms, phrase_match


def _trim_snippet(value: str, max_chars: int = 240) -> str:
    text = _collapse_spaces(value)
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 3].rstrip() + "..."


def _find_phrase_start(text: str, phrases: list[str]) -> int:
    normalized = _strip_vietnamese_diacritics(text)
    for phrase in phrases:
        if not phrase:
            continue
        start = normalized.find(phrase)
        if start >= 0:
            return start
    return -1


def _snippet_from_text(text: str, bundle: QueryBundle, max_chars: int = 260) -> str:
    content = (text or "").strip()
    if not content:
        return ""

    start = _find_phrase_start(content, bundle.phrases)
    if start < 0:
        return _trim_snippet(content, max_chars=max_chars)

    radius = max(100, int(max_chars / 2))
    slice_start = max(0, start - radius)
    slice_end = min(len(content), start + max(len(bundle.raw), 1) + radius)
    snippet = content[slice_start:slice_end].strip()
    if slice_start > 0:
        snippet = "..." + snippet
    if slice_end < len(content):
        snippet = snippet + "..."
    return _trim_snippet(snippet, max_chars=max_chars)


def _approved_summary(document: Document) -> str:
    if str(document.summary_status or "").lower() != "approved":
        return ""
    return (document.ai_summary or "").strip()


def _document_tags(document: Document) -> str:
    return " ".join(tag for tag in (document.ai_suggested_tags or []) if tag)


def _build_metadata_snippet(document: Document) -> str:
    parts = [document.title, document.topic, _approved_summary(document)]
    values = [part for part in parts if part]
    return _trim_snippet(" | ".join(values) or document.id)


def _clamp_score(value: float) -> float:
    return max(0.0, min(float(value), 1.0))


def _relevance_label(score: float) -> str:
    if score >= 0.72:
        return "high"
    if score >= 0.52:
        return "medium"
    return "low"


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
        self._document_cache: dict[str, Document] = {}
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
        min_score: Optional[float] = None,
        debug: bool = False,
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

        if not normalized_query:
            items = self._documents.list_documents_for_search(
                limit=window_size,
                domain=normalized_domain,
                source_id=normalized_source_id,
                source_type=normalized_source_type,
                status=normalized_status,
                priority=normalized_priority,
                created_by=normalized_created_by,
                updated_after=normalized_updated_after,
                updated_before=normalized_updated_before,
            )
            filtered = [
                document for document in items
                if self._document_matches_filters(
                    document=document,
                    source_id=normalized_source_id,
                    domain=normalized_domain,
                    source_type=normalized_source_type,
                    status=normalized_status,
                    priority=normalized_priority,
                    visibility=normalized_visibility,
                    created_by=normalized_created_by,
                    updated_after=normalized_updated_after,
                    updated_before=normalized_updated_before,
                )
            ]
            filtered.sort(key=lambda item: item.updated_at.timestamp(), reverse=True)
            matched_total = len(filtered)
            top_documents = filtered[capped_offset:capped_offset + capped_limit]
            source_map = self._load_source_names(document.source_id for document in top_documents)
            results = [
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
                    score=0.0,
                    match_fields=[],
                    snippet=_build_metadata_snippet(document),
                    snippet_source="metadata",
                    relevance_label="low",
                )
                for document in top_documents
            ]
            return results, matched_total

        bundle = _build_query_bundle(normalized_query)
        resolved_min_score = self._resolve_min_score(search_mode, min_score)

        if search_mode == SearchMode.semantic:
            candidates = self._search_semantic_candidates(
                bundle=bundle,
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
                min_score=resolved_min_score,
            )
        elif search_mode == SearchMode.hybrid:
            try:
                candidates = self._search_hybrid_candidates(
                    bundle=bundle,
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
                    min_score=resolved_min_score,
                )
            except SearchBackendUnavailableError:
                candidates = self._search_keyword_candidates(
                    bundle=bundle,
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
                    min_score=0.0,
                )
        else:
            candidates = self._search_keyword_candidates(
                bundle=bundle,
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
                min_score=resolved_min_score,
            )

        self._sort_candidates(
            candidates=candidates,
            sort_by=sort_by,
            sort_order=sort_order,
        )

        matched_total = len(candidates)
        top_candidates = candidates[capped_offset:capped_offset + capped_limit]
        source_map = self._load_source_names(candidate.document.source_id for candidate in top_candidates)
        return self._build_search_items(
            candidates=top_candidates,
            source_map=source_map,
            debug=debug,
        ), matched_total

    def _resolve_min_score(self, search_mode: SearchMode, min_score: Optional[float]) -> float:
        if min_score is not None:
            return _clamp_score(min_score)
        if search_mode == SearchMode.semantic:
            return SEARCH_DEFAULT_SEMANTIC_MIN_SCORE
        if search_mode == SearchMode.hybrid:
            return SEARCH_DEFAULT_HYBRID_MIN_SCORE
        return 0.0

    def _search_keyword_candidates(
        self,
        *,
        bundle: QueryBundle,
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
        min_score: float,
    ) -> list[CandidateScore]:
        candidate_limit = min(max(limit * 8, 60), 500)
        documents = self._documents.list_documents_for_search(
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

        candidates: list[CandidateScore] = []
        for document in documents:
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

            extracted_text = self._get_extracted_text(document.id)
            lexical = self._analyze_document_lexical(
                document=document,
                bundle=bundle,
                content_text=extracted_text[:SEARCH_EXTRACTED_TEXT_SCAN_CHARS],
            )
            final_score = _clamp_score((0.75 * lexical.keyword_score) + (0.25 * lexical.metadata_score))
            if final_score < min_score:
                continue
            if not self._passes_keyword_guard(bundle=bundle, lexical=lexical):
                continue

            candidates.append(
                CandidateScore(
                    document=document,
                    score=final_score,
                    semantic_score=0.0,
                    keyword_score=lexical.keyword_score,
                    metadata_score=lexical.metadata_score,
                    matched_fields=lexical.matched_fields,
                    snippet=self._select_snippet(
                        document=document,
                        bundle=bundle,
                        content_text=extracted_text,
                    ),
                    snippet_source="approved_summary" if _approved_summary(document) else "content",
                    reason=lexical.reason,
                )
            )

        return candidates

    def _search_semantic_candidates(
        self,
        *,
        bundle: QueryBundle,
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
        min_score: float,
    ) -> list[CandidateScore]:
        chunk_limit = min(max(limit * 5, 30), 150)
        chunk_repository = self._get_chunk_repository(required=True)
        try:
            semantic_matches = chunk_repository.semantic_search_chunks(query=bundle.raw, limit=chunk_limit)
        except ChunkRepositoryUnavailableError as exc:
            self._disable_chunk_backend(exc)
            raise SearchBackendUnavailableError(self._chunk_backend_error or str(exc)) from exc

        grouped = self._group_semantic_matches_by_document(semantic_matches)
        document_map = self._load_documents(grouped.keys())
        candidates: list[CandidateScore] = []

        for document_id, matches in grouped.items():
            document = document_map.get(document_id)
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

            semantic_score = self._aggregate_semantic_score(matches)
            best_chunk = matches[0].chunk
            lexical = self._analyze_document_lexical(
                document=document,
                bundle=bundle,
                content_text=best_chunk.content,
            )
            if not self._passes_semantic_guard(
                bundle=bundle,
                semantic_score=semantic_score,
                lexical=lexical,
                min_score=min_score,
            ):
                continue

            matched_fields = _unique(["semantic", *lexical.matched_fields])
            candidates.append(
                CandidateScore(
                    document=document,
                    score=semantic_score,
                    semantic_score=semantic_score,
                    keyword_score=lexical.keyword_score,
                    metadata_score=lexical.metadata_score,
                    matched_fields=matched_fields,
                    snippet=_snippet_from_text(best_chunk.content, bundle),
                    snippet_source="semantic_chunk",
                    reason=lexical.reason or "semantic match",
                )
            )

        return candidates

    def _search_hybrid_candidates(
        self,
        *,
        bundle: QueryBundle,
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
        min_score: float,
    ) -> list[CandidateScore]:
        keyword_candidates = self._search_keyword_candidates(
            bundle=bundle,
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
            min_score=0.0,
        )
        semantic_candidates = self._search_semantic_candidates(
            bundle=bundle,
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
            min_score=0.0,
        )

        merged: dict[str, CandidateScore] = {}

        for candidate in keyword_candidates:
            merged[candidate.document.id] = candidate

        for candidate in semantic_candidates:
            existing = merged.get(candidate.document.id)
            if existing is None:
                merged[candidate.document.id] = candidate
                continue

            merged[candidate.document.id] = CandidateScore(
                document=existing.document,
                score=existing.score,
                semantic_score=max(existing.semantic_score, candidate.semantic_score),
                keyword_score=max(existing.keyword_score, candidate.keyword_score),
                metadata_score=max(existing.metadata_score, candidate.metadata_score),
                matched_fields=_unique([*existing.matched_fields, *candidate.matched_fields]),
                snippet=candidate.snippet or existing.snippet,
                snippet_source=candidate.snippet_source or existing.snippet_source,
                reason=candidate.reason or existing.reason,
            )

        candidates: list[CandidateScore] = []
        for candidate in merged.values():
            final_score = _clamp_score(
                (0.65 * candidate.semantic_score)
                + (0.25 * candidate.keyword_score)
                + (0.10 * candidate.metadata_score)
            )
            lexical = self._analyze_document_lexical(
                document=candidate.document,
                bundle=bundle,
                content_text=self._get_extracted_text(candidate.document.id)[:SEARCH_EXTRACTED_TEXT_SCAN_CHARS],
            )
            if not self._passes_hybrid_guard(
                bundle=bundle,
                final_score=final_score,
                semantic_score=candidate.semantic_score,
                lexical=lexical,
                min_score=min_score,
            ):
                continue

            candidates.append(
                CandidateScore(
                    document=candidate.document,
                    score=final_score,
                    semantic_score=candidate.semantic_score,
                    keyword_score=max(candidate.keyword_score, lexical.keyword_score),
                    metadata_score=max(candidate.metadata_score, lexical.metadata_score),
                    matched_fields=_unique([*candidate.matched_fields, *lexical.matched_fields]),
                    snippet=candidate.snippet or self._select_snippet(
                        document=candidate.document,
                        bundle=bundle,
                        content_text=self._get_extracted_text(candidate.document.id),
                    ),
                    snippet_source=candidate.snippet_source or "content",
                    reason=lexical.reason or candidate.reason or "hybrid match",
                )
            )

        return candidates

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

    def _aggregate_semantic_score(self, matches: list[SemanticChunkMatch]) -> float:
        if not matches:
            return 0.0

        weighted = 0.0
        total_weight = 0.0
        for index, match in enumerate(matches[:3]):
            weight = 1 / (index + 1)
            weighted += _clamp_score(match.score) * weight
            total_weight += weight

        score = weighted / total_weight if total_weight else 0.0
        if len(matches) > 1:
            score = min(1.0, score + min(0.08, 0.03 * (len(matches) - 1)))
        return _clamp_score(score)

    def _analyze_document_lexical(
        self,
        *,
        document: Document,
        bundle: QueryBundle,
        content_text: str,
    ) -> LexicalAnalysis:
        title_score, title_terms, title_phrase = _field_match_score(bundle, document.title, phrase_boost=1.0)
        topic_score, topic_terms, topic_phrase = _field_match_score(bundle, document.topic, phrase_boost=0.95)
        tag_score, tag_terms, tag_phrase = _field_match_score(bundle, _document_tags(document), phrase_boost=0.9)
        summary_text = _approved_summary(document)
        summary_score, summary_terms, summary_phrase = _field_match_score(bundle, summary_text, phrase_boost=0.85)
        content_score, content_terms, content_phrase = _field_match_score(
            bundle,
            content_text[:SEARCH_EXTRACTED_TEXT_SCAN_CHARS],
            phrase_boost=0.8,
        )
        domain_score, domain_terms, _ = _field_match_score(bundle, document.domain, phrase_boost=0.65)
        source_type_score, source_type_terms, _ = _field_match_score(
            bundle,
            document.source_type,
            phrase_boost=0.6,
        )

        metadata_score = _clamp_score(
            (0.50 * title_score)
            + (0.20 * topic_score)
            + (0.20 * tag_score)
            + (0.05 * domain_score)
            + (0.05 * source_type_score)
        )
        keyword_score = _clamp_score(
            max(
                content_score,
                summary_score,
                (0.65 * content_score) + (0.20 * summary_score) + (0.15 * max(title_score, tag_score, topic_score)),
            )
        )

        matched_terms = set().union(
            title_terms,
            topic_terms,
            tag_terms,
            summary_terms,
            content_terms,
            domain_terms,
            source_type_terms,
        )
        overlap_count = len(matched_terms)
        overlap_ratio = overlap_count / _terms_for_guard(bundle)
        matched_fields = []
        if title_score > 0:
            matched_fields.append("title")
        if topic_score > 0:
            matched_fields.append("topic")
        if tag_score > 0:
            matched_fields.append("tag")
        if summary_score > 0:
            matched_fields.append("summary")
        if content_score > 0:
            matched_fields.append("content")

        has_phrase_match = any([title_phrase, topic_phrase, tag_phrase, summary_phrase, content_phrase])
        if title_phrase:
            reason = "matched phrase in title"
        elif topic_phrase or tag_phrase:
            reason = "matched phrase in metadata"
        elif summary_phrase or content_phrase:
            reason = "matched phrase in content"
        elif overlap_count > 0 and "content" in matched_fields:
            reason = "matched query terms in content"
        elif overlap_count > 0:
            reason = "matched query terms in metadata"
        else:
            reason = "low lexical overlap"

        return LexicalAnalysis(
            keyword_score=keyword_score,
            metadata_score=metadata_score,
            overlap_count=overlap_count,
            overlap_ratio=overlap_ratio,
            matched_fields=matched_fields,
            has_phrase_match=has_phrase_match,
            reason=reason,
        )

    def _passes_keyword_guard(self, *, bundle: QueryBundle, lexical: LexicalAnalysis) -> bool:
        if lexical.has_phrase_match:
            return True
        if lexical.metadata_score >= 0.75:
            return True
        if lexical.keyword_score >= 0.82 and lexical.overlap_ratio >= 0.5:
            return True
        return lexical.overlap_ratio >= _required_overlap_ratio(bundle)

    def _passes_semantic_guard(
        self,
        *,
        bundle: QueryBundle,
        semantic_score: float,
        lexical: LexicalAnalysis,
        min_score: float,
    ) -> bool:
        if semantic_score >= SEARCH_STRONG_SEMANTIC_SCORE:
            return True
        if semantic_score < min_score:
            return False
        if lexical.has_phrase_match:
            return True
        return lexical.overlap_ratio >= _required_overlap_ratio(bundle)

    def _passes_hybrid_guard(
        self,
        *,
        bundle: QueryBundle,
        final_score: float,
        semantic_score: float,
        lexical: LexicalAnalysis,
        min_score: float,
    ) -> bool:
        if semantic_score >= SEARCH_STRONG_SEMANTIC_SCORE:
            return True
        if final_score < min_score:
            return False
        if lexical.has_phrase_match:
            return True
        return lexical.overlap_ratio >= _required_overlap_ratio(bundle)

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

    def _load_documents(self, document_ids) -> dict[str, Document]:
        normalized_ids = _unique([str(document_id or "").strip() for document_id in document_ids])
        missing_ids = [document_id for document_id in normalized_ids if document_id not in self._document_cache]
        if missing_ids:
            loaded = self._documents.get_documents_by_ids(missing_ids)
            self._document_cache.update(loaded)
        return {
            document_id: self._document_cache[document_id]
            for document_id in normalized_ids
            if document_id in self._document_cache
        }

    def _load_source_names(self, source_ids) -> dict[str, str]:
        normalized_ids = _unique([str(source_id or "").strip() for source_id in source_ids])
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

    def _select_snippet(self, *, document: Document, bundle: QueryBundle, content_text: str) -> str:
        summary_text = _approved_summary(document)
        if summary_text:
            return _snippet_from_text(summary_text, bundle)
        if content_text:
            return _snippet_from_text(content_text, bundle)
        return _build_metadata_snippet(document)

    def _sort_candidates(
        self,
        *,
        candidates: list[CandidateScore],
        sort_by: Optional[SearchSortBy],
        sort_order: Optional[SearchSortOrder],
    ) -> None:
        if sort_by == SearchSortBy.updated_at:
            reverse = sort_order != SearchSortOrder.asc
            candidates.sort(
                key=lambda item: (
                    item.document.updated_at.timestamp(),
                    item.score,
                    item.document.id,
                ),
                reverse=reverse,
            )
            return

        reverse = sort_order != SearchSortOrder.asc
        candidates.sort(
            key=lambda item: (
                item.score,
                item.semantic_score,
                item.keyword_score,
                item.document.updated_at.timestamp(),
                item.document.id,
            ),
            reverse=reverse,
        )

    def _build_search_items(
        self,
        *,
        candidates: list[CandidateScore],
        source_map: dict[str, str],
        debug: bool,
    ) -> list[SearchDocumentItem]:
        items: list[SearchDocumentItem] = []
        for candidate in candidates:
            document = candidate.document
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
                    score=round(candidate.score, 4),
                    match_fields=candidate.matched_fields,
                    snippet=candidate.snippet,
                    snippet_source=candidate.snippet_source,
                    semantic_score=round(candidate.semantic_score, 4) if debug else None,
                    keyword_score=round(candidate.keyword_score, 4) if debug else None,
                    metadata_score=round(candidate.metadata_score, 4) if debug else None,
                    reason=candidate.reason if debug else None,
                    relevance_label=_relevance_label(candidate.score),
                )
            )
        return items

    def _get_chunk_repository(self, *, required: bool) -> Optional[ChunkRepository]:
        if self._chunk_backend_disabled:
            if required:
                raise SearchBackendUnavailableError(self._chunk_backend_error or "Vector backend unavailable")
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


class SearchBackendUnavailableError(RuntimeError):
    """Raised when a requested search mode depends on an unavailable backend."""
