from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, AsyncGenerator, Optional

from backend.app.api.user_upload import get_temp_upload_texts
from backend.app.rag.agent.agent_loop import agent_loop
from backend.app.rag.agent.query_router import route_mode
from backend.app.rag.agent.response_generator import generate_casual_answer
from backend.app.rag.agent.response_generator import generate_professional_answer
from backend.app.rag.memory.chat_memory import add_message, get_history, validate_conversation
from backend.app.rag.prompting.prompt_registry import (
    PROMPT_SCOPE_CASUAL,
    PROMPT_SCOPE_PLANNER,
    PROMPT_SCOPE_PROFESSIONAL,
    PROMPT_SCOPE_ROUTE,
    get_prompt_bundle,
)
from backend.app.services.ask_context_service import AskContextService

logger = logging.getLogger(__name__)


@dataclass
class AskSimpleResult:
    question: str
    answer_stream: AsyncGenerator[str, None]
    contexts: list[dict[str, Any]]


@dataclass
class AskPreparedAnswer:
    question: str
    user_id: str
    conversation_id: str
    mode: str
    contexts: list[dict[str, Any]]
    answer_stream: Optional[AsyncGenerator[str, None]] = None
    fallback_answer: Optional[str] = None


@dataclass
class AskCompletedAnswer:
    question: str
    mode: str
    answer: str
    contexts: list[dict[str, Any]]


@dataclass
class AskStreamEvent:
    event: str
    data: dict[str, Any]


class AskConversationAccessError(Exception):
    pass


class AskService:
    """Coordinates ask flows that consume the managed knowledge layer."""

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
            fallback_answer = generate_casual_answer(
                routed_question,
                history,
                prompt_bundle.get(PROMPT_SCOPE_CASUAL),
            )
            return AskPreparedAnswer(
                question=routed_question,
                user_id=user_id,
                conversation_id=conversation_id,
                mode=mode,
                contexts=[],
                fallback_answer=fallback_answer,
            )

        if mode == "simple":
            simple_result = self.build_simple_answer(
                question=question,
                history=history,
                professional_prompt=prompt_bundle.get(PROMPT_SCOPE_PROFESSIONAL),
                user_docs=user_docs,
            )
            return AskPreparedAnswer(
                question=simple_result.question,
                user_id=user_id,
                conversation_id=conversation_id,
                mode=mode,
                contexts=simple_result.contexts,
                answer_stream=simple_result.answer_stream,
            )

        answer_stream = agent_loop(
            routed_question,
            history,
            prompt_bundle.get(PROMPT_SCOPE_PLANNER),
            prompt_bundle.get(PROMPT_SCOPE_PROFESSIONAL),
            context_service=self._context_service,
        )
        return AskPreparedAnswer(
            question=routed_question,
            user_id=user_id,
            conversation_id=conversation_id,
            mode=mode,
            contexts=[],
            answer_stream=answer_stream,
        )

    def build_simple_answer(
        self,
        *,
        question: str,
        history: list[dict[str, Any]],
        professional_prompt: Optional[str] = None,
        user_docs: Optional[list[str]] = None,
    ) -> AskSimpleResult:
        question_for_answer = _compose_question_with_user_docs(
            question=question,
            user_docs=user_docs or [],
        )
        contexts = self._context_service.retrieve_contexts(question)
        answer_stream = generate_professional_answer(
            question=question_for_answer,
            contexts=contexts,
            history=history,
            system_prompt_template=professional_prompt,
        )
        return AskSimpleResult(
            question=question_for_answer,
            answer_stream=answer_stream,
            contexts=contexts,
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
        else:
            final_answer = (prepared.fallback_answer or "").strip()

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
                data={"mode": prepared.mode, "conversation_id": prepared.conversation_id},
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

            final_answer = "".join(answer_parts).strip()
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
