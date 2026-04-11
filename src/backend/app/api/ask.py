import asyncio
import json
import logging
from typing import Any, AsyncGenerator

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from backend.app.api.user_upload import get_temp_upload_texts
from backend.app.rag.agent.query_router import route_mode
from backend.app.rag.agent.agent_loop import agent_loop
from backend.app.rag.agent.simple_rag import simple_rag
from backend.app.rag.agent.response_generator import generate_casual_answer
from backend.app.rag.prompting.prompt_registry import (
    PROMPT_SCOPE_CASUAL,
    PROMPT_SCOPE_PLANNER,
    PROMPT_SCOPE_PROFESSIONAL,
    PROMPT_SCOPE_ROUTE,
    get_prompt_bundle,
)

from backend.app.rag.memory.chat_memory import (
    get_history,
    add_message,
    validate_conversation,
)

router = APIRouter(tags=["RAG"])
logger = logging.getLogger(__name__)


class AskRequest(BaseModel):
    question: str
    user_id: str
    conversation_id: str
    stream: bool = False


class AskResponse(BaseModel):
    question: str
    mode: str
    answer: str
    contexts: list


def _to_sse(event: str, data: Any) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


async def _collect_stream_answer(answer_stream: AsyncGenerator[str, None]) -> str:
    answer_parts = []
    async for chunk in answer_stream:
        if chunk:
            answer_parts.append(chunk)
    return "".join(answer_parts).strip()


@router.post("/ask")
async def ask_rag(req: AskRequest, request: Request):

    question = req.question
    user_id = req.user_id
    conversation_id = req.conversation_id

    try:
        await asyncio.to_thread(validate_conversation, conversation_id, user_id)
    except Exception as exc:
        logger.exception(
            "Conversation validation failed: user_id=%s conversation_id=%s",
            user_id,
            conversation_id,
        )
        raise HTTPException(status_code=403, detail=str(exc))

    try:
        history = await asyncio.to_thread(get_history, conversation_id)
        prompt_bundle = await asyncio.to_thread(get_prompt_bundle)
        
        user_docs = await asyncio.to_thread(get_temp_upload_texts, conversation_id)
        user_context = "\n\n".join(user_docs)

        if user_context:
            question = f"""
User question:
{question}

User uploaded documents:
{user_context[:3000]}
        """

        try:
            route = await asyncio.to_thread(
                route_mode,
                question,
                prompt_bundle.get(PROMPT_SCOPE_ROUTE),
            )
        except Exception as e:
            logger.exception(
                "Route mode failed (%s), fallback to simple mode: user_id=%s conversation_id=%s",
                str(e),
                user_id,
                conversation_id,
            )
            route = {"mode": "simple"}

        mode = route.get("mode", "simple")

        logger.info("[USER=%s] convo=%s | mode=%s", user_id, conversation_id, mode)
        accept_header = (request.headers.get("accept") or "").lower()
        should_stream = req.stream or "text/event-stream" in accept_header

        answer_stream = None
        fallback_answer = None

        if mode == "casual":
            fallback_answer = await asyncio.to_thread(
                generate_casual_answer,
                question,
                history,
                prompt_bundle.get(PROMPT_SCOPE_CASUAL),
            )
        elif mode == "simple":
            answer_stream = await asyncio.to_thread(
                simple_rag,
                question,
                history,
                prompt_bundle.get(PROMPT_SCOPE_PROFESSIONAL),
            )
        else:
            answer_stream = await asyncio.to_thread(
                agent_loop,
                question,
                history,
                prompt_bundle.get(PROMPT_SCOPE_PLANNER),
                prompt_bundle.get(PROMPT_SCOPE_PROFESSIONAL),
            )

        if not should_stream:
            await asyncio.to_thread(add_message, conversation_id, user_id, "user", question)

            if answer_stream is not None:
                final_answer = await _collect_stream_answer(answer_stream)
            else:
                final_answer = (fallback_answer or "").strip()

            await asyncio.to_thread(add_message, conversation_id, user_id, "assistant", final_answer)

            return {
                "question": question,
                "mode": mode,
                "answer": final_answer,
                "contexts": [],
            }

        async def event_generator() -> AsyncGenerator[str, None]:
            answer_parts = []

            try:
                await asyncio.to_thread(add_message, conversation_id, user_id, "user", question)
                yield _to_sse("meta", {"mode": mode, "conversation_id": conversation_id})

                if answer_stream is not None:
                    async for chunk in answer_stream:
                        if not chunk:
                            continue
                        answer_parts.append(chunk)
                        yield _to_sse("token", {"text": chunk})
                elif fallback_answer:
                    answer_parts.append(fallback_answer)
                    yield _to_sse("token", {"text": fallback_answer})

                final_answer = "".join(answer_parts).strip()
                await asyncio.to_thread(add_message, conversation_id, user_id, "assistant", final_answer)
                yield _to_sse("done", {"mode": mode})
            except Exception as e:
                logger.exception(
                    "SSE stream failed: user_id=%s conversation_id=%s error=%s",
                    user_id,
                    conversation_id,
                    str(e),
                )
                yield _to_sse("error", {"message": str(e)})

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            "Ask endpoint failed: user_id=%s conversation_id=%s",
            user_id,
            conversation_id,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process question: {str(e)}"
        )
