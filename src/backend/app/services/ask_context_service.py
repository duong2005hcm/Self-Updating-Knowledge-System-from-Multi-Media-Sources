from __future__ import annotations

import hashlib
import logging
import os
import re
import unicodedata
from dataclasses import dataclass
from typing import Any, Optional

from backend.app.models.document import Document
from backend.app.repositories.chunk_repository import ChunkRepository, SemanticChunkMatch
from backend.app.repositories.document_repository import DocumentRepository

logger = logging.getLogger(__name__)

DEFAULT_RAG_COLLECTIONS = ["rag_pdf", "rag_web_pdf"]
MEDICAL_QUERY_TERMS = {
    "benh",
    "trieu",
    "chung",
    "thuoc",
    "dieu",
    "tri",
    "suc",
    "khoe",
    "sot",
    "tim",
    "mach",
    "tieu",
    "duong",
    "huyet",
    "ap",
    "ung",
    "thu",
    "cham",
    "noi",
    "noi",
    "tre",
    "ho",
    "suy",
    "than",
}
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


def _env_int(name: str, default: int, *, minimum: int, maximum: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return max(minimum, min(maximum, value))


def _env_float(name: str, default: float, *, minimum: float, maximum: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        return default
    return max(minimum, min(maximum, value))


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


def _env_list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    values = [item.strip() for item in raw.split(",")]
    normalized = [item for item in values if item]
    return normalized or default


RAG_COLLECTIONS = _env_list("RAG_COLLECTIONS", DEFAULT_RAG_COLLECTIONS)
RAG_TOP_K_PER_COLLECTION = _env_int("RAG_TOP_K_PER_COLLECTION", 5, minimum=1, maximum=20)
RAG_MAX_CONTEXTS = _env_int("RAG_MAX_CONTEXTS", 8, minimum=1, maximum=12)
RAG_MIN_RELEVANCE_SCORE = _env_float("RAG_MIN_RELEVANCE_SCORE", 0.35, minimum=0.0, maximum=1.0)
RAG_STRONG_RELEVANCE_SCORE = _env_float("RAG_STRONG_RELEVANCE_SCORE", 0.55, minimum=0.0, maximum=1.0)
RAG_REQUIRE_CONTEXT = _env_bool("RAG_REQUIRE_CONTEXT", True)


@dataclass
class RetrievedContextsResult:
    contexts: list[dict[str, Any]]
    debug: dict[str, Any]


@dataclass
class QueryBundle:
    raw: str
    normalized: str
    stripped: str
    terms: list[str]
    phrases: list[str]


@dataclass
class LexicalSupport:
    overlap_count: int
    overlap_ratio: float
    has_phrase_match: bool
    matched_fields: list[str]


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


def _required_overlap_ratio(bundle: QueryBundle) -> float:
    if len(bundle.terms) <= 1:
        return 1.0
    if len(bundle.terms) == 2:
        return 0.5
    return 0.4


def _trim_text(value: str, max_chars: int = 1200) -> str:
    normalized = _collapse_spaces(value or "")
    if len(normalized) <= max_chars:
        return normalized
    return normalized[: max_chars - 3].rstrip() + "..."


def _context_preview(value: str, max_chars: int = 260) -> str:
    normalized = _collapse_spaces(value or "")
    if len(normalized) <= max_chars:
        return normalized
    return normalized[: max_chars - 3].rstrip() + "..."


def _source_kind(collection_name: str) -> str:
    if collection_name == "rag_web_pdf":
        return "Web/PDF"
    return "PDF"


def _page_label(metadata: dict[str, Any]) -> Optional[str]:
    page_numbers = str(metadata.get("page_numbers") or "").strip()
    if page_numbers:
        return page_numbers
    page_start = metadata.get("page_start")
    page_end = metadata.get("page_end")
    if page_start and page_end and page_start != page_end:
        return f"{page_start}-{page_end}"
    if page_start:
        return str(page_start)
    return None


def _resolve_source_url(metadata: dict[str, Any], document: Optional[Document]) -> str:
    candidates = [
        metadata.get("source_url"),
        metadata.get("url"),
        metadata.get("source_locator"),
        metadata.get("document_name"),
        document.title if document else "",
    ]
    for candidate in candidates:
        normalized = str(candidate or "").strip()
        if normalized.startswith("http://") or normalized.startswith("https://"):
            return normalized
    return ""


def _is_medical_question(bundle: QueryBundle) -> bool:
    if not bundle.terms:
        return False
    return any(term in MEDICAL_QUERY_TERMS for term in bundle.terms)


def _lexical_support(bundle: QueryBundle, *, title: str, topic: str, content: str, source_name: str) -> LexicalSupport:
    texts = {
        "title": _strip_vietnamese_diacritics(title),
        "topic": _strip_vietnamese_diacritics(topic),
        "content": _strip_vietnamese_diacritics(content),
        "source": _strip_vietnamese_diacritics(source_name),
    }
    matched_fields: list[str] = []
    matched_terms: set[str] = set()
    has_phrase_match = False

    for field_name, normalized_text in texts.items():
        if not normalized_text:
            continue
        if any(phrase and phrase in normalized_text for phrase in bundle.phrases):
            has_phrase_match = True
            if field_name not in matched_fields:
                matched_fields.append(field_name)

        for term in bundle.terms:
            if term in normalized_text:
                matched_terms.add(term)
                if field_name not in matched_fields:
                    matched_fields.append(field_name)

    overlap_count = len(matched_terms)
    overlap_ratio = overlap_count / max(len(bundle.terms), 1)
    return LexicalSupport(
        overlap_count=overlap_count,
        overlap_ratio=overlap_ratio,
        has_phrase_match=has_phrase_match,
        matched_fields=matched_fields,
    )


def _build_dedupe_key(context: dict[str, Any]) -> str:
    metadata = context.get("metadata") or {}
    content = _normalize_text(context.get("text") or context.get("content") or "")
    content_hash = hashlib.sha1(content.encode("utf-8")).hexdigest() if content else ""
    return "|".join(
        [
            str(context.get("collection") or metadata.get("collection") or ""),
            str(context.get("document_id") or metadata.get("document_id") or ""),
            str(context.get("chunk_id") or metadata.get("chunk_id") or ""),
            str(context.get("source_url") or metadata.get("source_url") or metadata.get("url") or ""),
            content_hash,
        ]
    )


class AskContextService:
    """Build LLM-ready context from the managed Chroma knowledge collections."""

    def __init__(
        self,
        search_service=None,
        document_repository: Optional[DocumentRepository] = None,
        chunk_repository: Optional[ChunkRepository] = None,
        *,
        default_limit: int = 5,
        collection_names: Optional[list[str]] = None,
        top_k_per_collection: Optional[int] = None,
        max_contexts: Optional[int] = None,
        min_relevance_score: Optional[float] = None,
        require_context: Optional[bool] = None,
    ):
        self._documents = document_repository or DocumentRepository()
        self._chunks = chunk_repository or ChunkRepository()
        self._default_limit = default_limit
        self._collection_names = collection_names or list(RAG_COLLECTIONS)
        self._top_k_per_collection = top_k_per_collection or RAG_TOP_K_PER_COLLECTION
        self._max_contexts = max_contexts or RAG_MAX_CONTEXTS
        self._min_relevance_score = (
            RAG_MIN_RELEVANCE_SCORE if min_relevance_score is None else float(min_relevance_score)
        )
        self._require_context = RAG_REQUIRE_CONTEXT if require_context is None else bool(require_context)

    @property
    def require_context(self) -> bool:
        return self._require_context

    def retrieve_contexts(
        self,
        question: str,
        *,
        limit: Optional[int] = None,
        document_id: Optional[str] = None,
        context_query: Optional[str] = None,
        debug: bool = False,
    ) -> list[dict[str, Any]]:
        return self.retrieve_contexts_with_debug(
            question,
            limit=limit,
            document_id=document_id,
            context_query=context_query,
            debug=debug,
        ).contexts

    def retrieve_contexts_with_debug(
        self,
        question: str,
        *,
        limit: Optional[int] = None,
        document_id: Optional[str] = None,
        context_query: Optional[str] = None,
        debug: bool = False,
    ) -> RetrievedContextsResult:
        normalized_question = (question or "").strip()
        if not normalized_question:
            return RetrievedContextsResult(
                contexts=[],
                debug={
                    "collections": {name: 0 for name in self._collection_names},
                    "after_filter": 0,
                    "top_scores": [],
                } if debug else {},
            )

        capped_limit = max(1, min(int(limit or self._default_limit), self._max_contexts))
        normalized_document_id = (document_id or "").strip()
        if normalized_document_id:
            return self._retrieve_document_contexts(
                question=normalized_question,
                document_id=normalized_document_id,
                context_query=context_query,
                limit=capped_limit,
                debug=debug,
            )

        return self._retrieve_multi_collection_contexts(
            question=normalized_question,
            limit=capped_limit,
            debug=debug,
        )

    def _retrieve_multi_collection_contexts(
        self,
        *,
        question: str,
        limit: int,
        debug: bool,
    ) -> RetrievedContextsResult:
        bundle = _build_query_bundle(question)
        is_medical_question = _is_medical_question(bundle)

        results_by_collection = self._chunks.semantic_search_chunks_by_collection(
            query=question,
            limit_per_collection=self._top_k_per_collection,
            collection_names=self._collection_names,
        )

        logger.info(
            "Ask retrieval question='%s' collections=%s raw_counts=%s",
            question[:120],
            self._collection_names,
            {name: len(items) for name, items in results_by_collection.items()},
        )

        document_ids = [
            str(match.chunk.metadata.get("document_id") or "").strip()
            for matches in results_by_collection.values()
            for match in matches
        ]
        document_map = self._documents.get_documents_by_ids(_unique(document_ids))

        dedupe_seen: set[str] = set()
        candidates: list[dict[str, Any]] = []
        kept_by_collection = {name: 0 for name in self._collection_names}

        for collection_name, matches in results_by_collection.items():
            for match in matches:
                document_id = str(match.chunk.metadata.get("document_id") or "").strip()
                document = document_map.get(document_id)
                if not self._document_is_allowed(document):
                    continue

                metadata = dict(match.chunk.metadata or {})
                title = str(metadata.get("document_name") or (document.title if document else "") or "").strip()
                topic = str(metadata.get("topic") or (document.topic if document else "") or "").strip()
                source_name = str(metadata.get("source_name") or title or document_id).strip()
                lexical = _lexical_support(
                    bundle,
                    title=title,
                    topic=topic,
                    content=match.chunk.content,
                    source_name=source_name,
                )
                if not self._passes_relevance_guard(
                    score=match.score,
                    lexical=lexical,
                    is_medical_question=is_medical_question,
                ):
                    continue

                context = self._match_to_context(
                    match=match,
                    document=document,
                    score=match.score,
                    matched_fields=lexical.matched_fields,
                )
                dedupe_key = _build_dedupe_key(context)
                if dedupe_key in dedupe_seen:
                    continue
                dedupe_seen.add(dedupe_key)

                candidates.append(context)
                kept_by_collection[collection_name] = kept_by_collection.get(collection_name, 0) + 1

        candidates.sort(
            key=lambda item: (
                -float(item.get("score", 0) or 0),
                str(item.get("collection") or ""),
                str(item.get("chunk_id") or ""),
            )
        )
        contexts = candidates[:limit]

        logger.info(
            "Ask retrieval filtered question='%s' kept=%s top_scores=%s",
            question[:120],
            len(contexts),
            [round(float(item.get("score", 0) or 0), 4) for item in contexts[:3]],
        )

        retrieval_debug = {}
        if debug:
            retrieval_debug = {
                "collections": {
                    name: {
                        "raw": len(results_by_collection.get(name, [])),
                        "kept": kept_by_collection.get(name, 0),
                    }
                    for name in self._collection_names
                },
                "after_filter": len(contexts),
                "top_scores": [round(float(item.get("score", 0) or 0), 4) for item in contexts[:5]],
            }

        return RetrievedContextsResult(contexts=contexts, debug=retrieval_debug)

    def _retrieve_document_contexts(
        self,
        *,
        question: str,
        document_id: str,
        context_query: Optional[str],
        limit: int,
        debug: bool,
    ) -> RetrievedContextsResult:
        document = self._documents.get_document_by_id(document_id)
        if document is None:
            logger.warning("Ask document context requested for missing document_id='%s'", document_id)
            return RetrievedContextsResult(contexts=[], debug={})

        try:
            chunks = self._chunks.list_chunks_by_document(
                document_id=document_id,
                limit=80,
                collection_names=self._collection_names,
            )
        except Exception as exc:
            logger.warning("Ask document context chunk load failed document_id='%s': %s", document_id, str(exc))
            return RetrievedContextsResult(contexts=[], debug={})

        if not chunks:
            return RetrievedContextsResult(contexts=[], debug={})

        retrieval_query = _merge_query_terms(question, context_query)
        bundle = _build_query_bundle(retrieval_query)
        scored = []
        kept_by_collection = {name: 0 for name in self._collection_names}

        for chunk in chunks:
            if not chunk.content:
                continue

            lexical = _lexical_support(
                bundle,
                title=document.title,
                topic=document.topic,
                content=chunk.content,
                source_name=str(chunk.metadata.get("source_name") or document.title),
            )
            quality = _chunk_quality_score(chunk.content)
            index_penalty = (chunk.chunk_index or 0) * 0.001
            score = max(lexical.overlap_ratio, 0.15 * quality) - index_penalty
            normalized_score = max(score, 0.01)

            context = self._chunk_to_document_context(
                chunk=chunk,
                document=document,
                score=round(float(normalized_score), 4),
            )
            context["metadata"]["match_fields"] = lexical.matched_fields or ["document_context"]
            context["match_fields"] = lexical.matched_fields or ["document_context"]
            scored.append((context, normalized_score))
            kept_by_collection[chunk.collection] = kept_by_collection.get(chunk.collection, 0) + 1

        if not scored:
            return RetrievedContextsResult(contexts=[], debug={})

        scored.sort(
            key=lambda item: (
                -item[1],
                item[0].get("chunk_index") if item[0].get("chunk_index") is not None else 10**9,
                item[0].get("chunk_id") or "",
            )
        )
        contexts = [context for context, _ in scored[:limit]]
        retrieval_debug = {}
        if debug:
            retrieval_debug = {
                "collections": {
                    name: {
                        "raw": kept_by_collection.get(name, 0),
                        "kept": kept_by_collection.get(name, 0),
                    }
                    for name in self._collection_names
                },
                "after_filter": len(contexts),
                "top_scores": [round(float(score), 4) for _, score in scored[:5]],
            }

        return RetrievedContextsResult(contexts=contexts, debug=retrieval_debug)

    def _passes_relevance_guard(
        self,
        *,
        score: float,
        lexical: LexicalSupport,
        is_medical_question: bool,
    ) -> bool:
        if score >= RAG_STRONG_RELEVANCE_SCORE:
            return True
        if score < self._min_relevance_score:
            return False
        if lexical.has_phrase_match:
            return True
        if lexical.overlap_ratio >= 0.5:
            return True
        if not is_medical_question:
            return lexical.overlap_count > 0
        return lexical.overlap_count > 0 and lexical.overlap_ratio >= 0.5

    def _document_is_allowed(self, document: Optional[Document]) -> bool:
        if document is None:
            return True
        if str(document.status or "").lower() != "active":
            return False
        return str(document.visibility or "").lower() == "public"

    def _match_to_context(
        self,
        *,
        match: SemanticChunkMatch,
        document: Optional[Document],
        score: float,
        matched_fields: list[str],
    ) -> dict[str, Any]:
        metadata = dict(match.chunk.metadata or {})
        collection_name = match.chunk.collection
        title = str(metadata.get("document_name") or (document.title if document else "") or "").strip()
        source_name = str(metadata.get("source_name") or title or metadata.get("document_id") or "").strip()
        source_url = _resolve_source_url(metadata, document)
        page = _page_label(metadata)
        full_text = _trim_context_text(match.chunk.content)
        preview_text = _context_preview(full_text)
        context = {
            "collection": collection_name,
            "document_id": str(metadata.get("document_id") or "").strip(),
            "title": title or f"Document {metadata.get('document_id', '')}",
            "source_url": source_url,
            "page": page,
            "chunk_id": match.chunk.id,
            "chunk_index": match.chunk.chunk_index,
            "content": preview_text,
            "text": full_text,
            "score": round(float(score), 4),
            "source_type": str(metadata.get("source_type") or (document.source_type if document else "") or "").strip(),
            "topic": str(metadata.get("topic") or (document.topic if document else "") or "").strip(),
            "metadata": {
                "collection": collection_name,
                "collection_label": _source_kind(collection_name),
                "url": source_url or source_name,
                "document_id": str(metadata.get("document_id") or "").strip(),
                "source_id": str(metadata.get("source_id") or "").strip(),
                "source_name": source_name,
                "title": title or f"Document {metadata.get('document_id', '')}",
                "source_type": str(metadata.get("source_type") or (document.source_type if document else "") or "").strip(),
                "status": str(metadata.get("status") or (document.status if document else "") or "").strip(),
                "domain": str(metadata.get("domain") or (document.domain if document else "") or "").strip(),
                "topic": str(metadata.get("topic") or (document.topic if document else "") or "").strip(),
                "priority": str(metadata.get("priority") or (document.priority if document else "") or "").strip(),
                "visibility": str(metadata.get("visibility") or (document.visibility if document else "") or "").strip(),
                "score": round(float(score), 4),
                "match_fields": matched_fields,
                "snippet_source": "rag_multi_collection",
                "chunk_id": match.chunk.id,
                "chunk_index": match.chunk.chunk_index,
                "page_start": metadata.get("page_start"),
                "page_end": metadata.get("page_end"),
                "page_numbers": metadata.get("page_numbers"),
                "source_url": source_url,
            },
        }
        return context

    def _chunk_to_document_context(
        self,
        *,
        chunk,
        document: Document,
        score: float,
    ) -> dict[str, Any]:
        metadata = dict(chunk.metadata or {})
        source_name = str(metadata.get("source_name") or metadata.get("document_name") or document.title)
        text = _trim_context_text(chunk.content)
        if document.title and document.title not in text[:200]:
            text = f"{document.title}\n{text}"
        source_url = _resolve_source_url(metadata, document)

        return {
            "collection": chunk.collection,
            "document_id": document.id,
            "title": document.title,
            "source_url": source_url,
            "page": _page_label(metadata),
            "chunk_id": chunk.id,
            "chunk_index": chunk.chunk_index,
            "content": _context_preview(chunk.content),
            "text": text,
            "score": score,
            "source_type": document.source_type,
            "topic": document.topic,
            "metadata": {
                "collection": chunk.collection,
                "collection_label": _source_kind(chunk.collection),
                "url": source_url or source_name or document.id,
                "document_id": document.id,
                "source_id": document.source_id,
                "source_name": source_name,
                "title": document.title,
                "source_type": document.source_type,
                "status": document.status,
                "domain": document.domain,
                "topic": document.topic,
                "priority": document.priority,
                "visibility": document.visibility,
                "score": score,
                "match_fields": ["document_context"],
                "snippet_source": "selected_document_chunk",
                "chunk_id": chunk.id,
                "chunk_index": chunk.chunk_index,
                "page_start": metadata.get("page_start"),
                "page_end": metadata.get("page_end"),
                "page_numbers": metadata.get("page_numbers"),
                "source_url": source_url,
            },
        }


def _merge_query_terms(question: str, context_query: Optional[str]) -> str:
    values = [(question or "").strip(), (context_query or "").strip()]
    normalized: list[str] = []
    lowered = set()
    for value in values:
        if not value:
            continue
        marker = value.lower()
        if marker in lowered:
            continue
        lowered.add(marker)
        normalized.append(value)
    return " ".join(normalized)


def _chunk_quality_score(text: str) -> float:
    normalized = " ".join((text or "").split())
    if not normalized:
        return 0.0
    length_score = min(len(normalized) / 900, 1.0)
    sentence_score = min(len(re.findall(r"[.!?。！？]", normalized)) / 4, 1.0)
    return max(length_score, sentence_score)


def _trim_context_text(text: str, max_chars: int = 1800) -> str:
    normalized = " ".join((text or "").split())
    if len(normalized) <= max_chars:
        return normalized

    snippet = normalized[:max_chars].rsplit(" ", 1)[0].strip()
    return f"{snippet}..."
