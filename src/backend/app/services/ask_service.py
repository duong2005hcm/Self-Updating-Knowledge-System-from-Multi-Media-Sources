from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, AsyncGenerator, Optional

from backend.app.api.user_upload import get_temp_upload_texts
from backend.app.rag.agent.query_router import route_mode
from backend.app.rag.agent.response_generator import (
    build_casual_fallback_answer,
    build_no_context_answer,
    ensure_medical_disclaimer,
    generate_professional_answer,
)
from backend.app.rag.memory.chat_memory import add_message, get_history, validate_conversation
from backend.app.rag.prompting.prompt_registry import (
    PROMPT_SCOPE_PROFESSIONAL,
    PROMPT_SCOPE_ROUTE,
    get_prompt_bundle,
)
from backend.app.services.ask_context_service import AskContextService, RetrievedContextsResult

logger = logging.getLogger(__name__)


@dataclass
class AskSimpleResult:
    question: str
    contexts: list[dict[str, Any]]
    retrieval_debug: dict[str, Any]
    answer_stream: Optional[AsyncGenerator[str, None]] = None
    fallback_answer: Optional[str] = None


@dataclass
class AskPreparedAnswer:
    question: str
    user_id: str
    conversation_id: str
    mode: str
    contexts: list[dict[str, Any]]
    retrieval_debug: dict[str, Any]
    answer_stream: Optional[AsyncGenerator[str, None]] = None
    fallback_answer: Optional[str] = None


@dataclass
class AskCompletedAnswer:
    question: str
    mode: str
    answer: str
    contexts: list[dict[str, Any]]
    retrieval_debug: dict[str, Any]


@dataclass
class AskStreamEvent:
    event: str
    data: dict[str, Any]


class AskConversationAccessError(Exception):
    pass


class AskService:
    """Coordinates ask flows that consume the managed health knowledge layer."""

    def __init__(
        self,
        context_service: Optional[AskContextService] = None,
    ):
        self._context_service = context_service or AskContextService()

    def prepare_answer(
        self,
        *,
        question: str,
        user_id: str,
        conversation_id: str,
        document_id: Optional[str] = None,
        context_query: Optional[str] = None,
        debug: bool = False,
    ) -> AskPreparedAnswer:
        try:
            validate_conversation(conversation_id, user_id)
        except Exception as exc:
            raise AskConversationAccessError(str(exc)) from exc

        history = get_history(conversation_id)
        prompt_bundle = get_prompt_bundle()
        user_docs = get_temp_upload_texts(conversation_id)
        routed_question = _compose_question_with_user_docs(
            question=question,
            user_docs=user_docs,
        )

        try:
            route = route_mode(
                routed_question,
                prompt_bundle.get(PROMPT_SCOPE_ROUTE),
            )
        except Exception as exc:
            logger.exception(
                "Route mode failed (%s), fallback to simple mode: user_id=%s conversation_id=%s",
                str(exc),
                user_id,
                conversation_id,
            )
            route = {"mode": "simple"}

        mode = route.get("mode", "simple")
        if mode == "casual":
            fallback_answer = build_casual_fallback_answer()
            return AskPreparedAnswer(
                question=(question or "").strip(),
                user_id=user_id,
                conversation_id=conversation_id,
                mode=mode,
                contexts=[],
                retrieval_debug={},
                fallback_answer=fallback_answer,
            )

        simple_result = self.build_simple_answer(
            question=question,
            history=history,
            professional_prompt=prompt_bundle.get(PROMPT_SCOPE_PROFESSIONAL),
            user_docs=user_docs,
            document_id=document_id,
            context_query=context_query,
            debug=debug,
        )
        return AskPreparedAnswer(
            question=simple_result.question,
            user_id=user_id,
            conversation_id=conversation_id,
            mode="simple",
            contexts=simple_result.contexts,
            retrieval_debug=simple_result.retrieval_debug,
            answer_stream=simple_result.answer_stream,
            fallback_answer=simple_result.fallback_answer,
        )

    def build_simple_answer(
        self,
        *,
        question: str,
        history: list[dict[str, Any]],
        professional_prompt: Optional[str] = None,
        user_docs: Optional[list[str]] = None,
        document_id: Optional[str] = None,
        context_query: Optional[str] = None,
        debug: bool = False,
    ) -> AskSimpleResult:
        question_for_answer = _compose_question_with_user_docs(
            question=question,
            user_docs=user_docs or [],
        )
        question_for_answer = _compose_question_with_document_scope(
            question=question_for_answer,
            document_id=document_id,
            context_query=context_query,
        )
        retrieval = self._context_service.retrieve_contexts_with_debug(
            question,
            document_id=document_id,
            context_query=context_query,
            debug=debug,
        )
        if not retrieval.contexts and self._context_service.require_context:
            return AskSimpleResult(
                question=question_for_answer,
                contexts=[],
                retrieval_debug=retrieval.debug,
                fallback_answer=build_no_context_answer(),
            )

        answer_stream = generate_professional_answer(
            question=question_for_answer,
            contexts=retrieval.contexts,
            history=history,
            system_prompt_template=professional_prompt,
        )
        return AskSimpleResult(
            question=question_for_answer,
            contexts=retrieval.contexts,
            retrieval_debug=retrieval.debug,
            answer_stream=answer_stream,
        )

    def record_message(self, *, conversation_id: str, user_id: str, role: str, content: str) -> None:
        add_message(conversation_id, user_id, role, content)

    async def collect_answer(self, answer_stream: AsyncGenerator[str, None]) -> str:
        answer_parts = []
        async for chunk in answer_stream:
            if chunk:
                answer_parts.append(chunk)
        return "".join(answer_parts).strip()

    async def complete_answer(self, prepared: AskPreparedAnswer) -> AskCompletedAnswer:
        await asyncio.to_thread(
            self.record_message,
            conversation_id=prepared.conversation_id,
            user_id=prepared.user_id,
            role="user",
            content=prepared.question,
        )

        if prepared.answer_stream is not None:
            final_answer = await self.collect_answer(prepared.answer_stream)
            final_answer = ensure_medical_disclaimer(final_answer)
        else:
            final_answer = ensure_medical_disclaimer(prepared.fallback_answer or "")

        await asyncio.to_thread(
            self.record_message,
            conversation_id=prepared.conversation_id,
            user_id=prepared.user_id,
            role="assistant",
            content=final_answer,
        )

        return AskCompletedAnswer(
            question=prepared.question,
            mode=prepared.mode,
            answer=final_answer,
            contexts=prepared.contexts,
            retrieval_debug=prepared.retrieval_debug,
        )

    async def stream_answer_events(self, prepared: AskPreparedAnswer) -> AsyncGenerator[AskStreamEvent, None]:
        answer_parts: list[str] = []

        try:
            await asyncio.to_thread(
                self.record_message,
                conversation_id=prepared.conversation_id,
                user_id=prepared.user_id,
                role="user",
                content=prepared.question,
            )
            yield AskStreamEvent(
                event="meta",
                data={
                    "mode": prepared.mode,
                    "conversation_id": prepared.conversation_id,
                    "retrieval_debug": prepared.retrieval_debug,
                },
            )

            if prepared.answer_stream is not None:
                async for chunk in prepared.answer_stream:
                    if not chunk:
                        continue
                    answer_parts.append(chunk)
                    yield AskStreamEvent(event="token", data={"text": chunk})
            elif prepared.fallback_answer:
                answer_parts.append(prepared.fallback_answer)
                yield AskStreamEvent(event="token", data={"text": prepared.fallback_answer})

            streamed_answer = "".join(answer_parts).strip()
            final_answer = ensure_medical_disclaimer(streamed_answer)
            if final_answer != streamed_answer:
                extra = final_answer[len(streamed_answer):].strip()
                if extra:
                    yield AskStreamEvent(event="token", data={"text": f"\n\n{extra}"})

            await asyncio.to_thread(
                self.record_message,
                conversation_id=prepared.conversation_id,
                user_id=prepared.user_id,
                role="assistant",
                content=final_answer,
            )
            yield AskStreamEvent(event="done", data={"mode": prepared.mode})
        except Exception as exc:
            logger.exception(
                "Ask stream failed: user_id=%s conversation_id=%s error=%s",
                prepared.user_id,
                prepared.conversation_id,
                str(exc),
            )
            yield AskStreamEvent(event="error", data={"message": str(exc)})


def _compose_question_with_user_docs(*, question: str, user_docs: list[str]) -> str:
    normalized_question = (question or "").strip()
    user_context = "\n\n".join(doc for doc in user_docs if doc)
    if not user_context:
        return normalized_question

    return f"""
User question:
{normalized_question}

User uploaded documents:
{user_context[:3000]}
        """.strip()


def _compose_question_with_document_scope(
    *,
    question: str,
    document_id: Optional[str],
    context_query: Optional[str] = None,
) -> str:
    normalized_question = (question or "").strip()
    normalized_document_id = (document_id or "").strip()
    if not normalized_document_id:
        return normalized_question

    normalized_context_query = (context_query or "").strip()
    scope_lines = [
        "Selected knowledge document context is available.",
        f"selected_document_id: {normalized_document_id}",
        "If the user says 'this document' or similar, interpret it as the selected document.",
        "Answer using only the retrieved contexts for the selected document when they are available.",
    ]
    if normalized_context_query:
        scope_lines.append(f"original_search_query: {normalized_context_query}")

    return "\n".join(scope_lines + ["", "User question:", normalized_question]).strip()
