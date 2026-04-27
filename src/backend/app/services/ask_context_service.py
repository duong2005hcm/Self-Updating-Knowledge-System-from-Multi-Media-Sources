from __future__ import annotations

import logging
from typing import Any, Optional

from backend.app.schemas.search import SearchDocumentItem, SearchMode
from backend.app.services.search_service import SearchBackendUnavailableError, SearchService

logger = logging.getLogger(__name__)


class AskContextService:
    """Build LLM-ready context from the knowledge/search layer."""

    def __init__(
        self,
        search_service: Optional[SearchService] = None,
        *,
        default_limit: int = 5,
    ):
        self._search = search_service or SearchService()
        self._default_limit = default_limit

    def retrieve_contexts(self, question: str, *, limit: Optional[int] = None) -> list[dict[str, Any]]:
        normalized_question = (question or "").strip()
        if not normalized_question:
            return []

        capped_limit = max(1, min(int(limit or self._default_limit), 10))

        try:
            items, _ = self._search.search_documents(
                search_mode=SearchMode.hybrid,
                q=normalized_question,
                status="active",
                limit=capped_limit,
            )
        except SearchBackendUnavailableError as exc:
            logger.warning("Hybrid ask context retrieval unavailable, falling back to keyword: %s", str(exc))
            items, _ = self._search.search_documents(
                search_mode=SearchMode.keyword,
                q=normalized_question,
                status="active",
                limit=capped_limit,
            )
        except Exception as exc:
            logger.exception("Ask context retrieval failed: %s", str(exc))
            return []

        return [_search_item_to_context(item) for item in items]


def _search_item_to_context(item: SearchDocumentItem) -> dict[str, Any]:
    snippet = (item.snippet or "").strip()
    title = (item.title or "").strip()
    context_text = snippet or title

    if title and snippet and title not in snippet:
        context_text = f"{title}\n{snippet}"

    return {
        "text": context_text,
        "score": item.score,
        "metadata": {
            "url": item.source_name or item.id,
            "document_id": item.id,
            "source_id": item.source_id,
            "source_name": item.source_name,
            "title": item.title,
            "source_type": item.source_type,
            "status": item.status,
            "domain": item.domain,
            "topic": item.topic,
            "priority": item.priority,
            "score": item.score,
            "match_fields": item.match_fields,
            "snippet_source": item.snippet_source,
        },
    }
