from typing import Any, AsyncGenerator

from backend.app.rag.agent.response_generator import generate_professional_answer
from backend.app.rag.retrieval.retrieval import multi_query_retrieve


def simple_rag(
    question: str,
    history: list[dict[str, Any]],
    professional_prompt: str | None = None,
) -> AsyncGenerator[str, None]:
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
