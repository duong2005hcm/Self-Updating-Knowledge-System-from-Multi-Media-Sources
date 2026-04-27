"""Legacy simple ask helper kept only for compatibility.

Phase 6 moves `/api/ask` onto `AskService` + `AskContextService`. New ask
flows should not call this module directly because it still depends on the
older retrieval path in `rag.retrieval.retrieval.multi_query_retrieve`.
"""

from typing import Any, AsyncGenerator

from backend.app.rag.agent.response_generator import generate_professional_answer
from backend.app.rag.retrieval.retrieval import multi_query_retrieve


def simple_rag(
    question: str,
    history: list[dict[str, Any]],
    professional_prompt: str | None = None,
) -> AsyncGenerator[str, None]:
    """Legacy wrapper around the pre-Phase-6 retrieval stack."""
    contexts = multi_query_retrieve(
        question=question,
        top_k=5,
    )

    return generate_professional_answer(
        question=question,
        contexts=contexts,
        history=history,
        system_prompt_template=professional_prompt,
    )
