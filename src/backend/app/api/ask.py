import asyncio
import json
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.app.api.dependencies.authz import Principal, Role, require_authenticated_principal
from backend.app.services.ask_service import AskConversationAccessError, AskService

router = APIRouter(tags=["RAG"])
logger = logging.getLogger(__name__)


class AskRequest(BaseModel):
    question: str
    user_id: str
    conversation_id: str
    stream: bool = False
    document_id: Optional[str] = None
    context_query: Optional[str] = None
    debug: bool = False


class AskResponse(BaseModel):
    question: str
    mode: str
    answer: str
    contexts: list
    retrieval_debug: Optional[dict[str, Any]] = None


def get_ask_service() -> AskService:
    return AskService()


def _to_sse(event: str, data: Any) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


def _resolve_ask_user_id(req: AskRequest, principal: Principal) -> str:
    requested_user_id = (req.user_id or "").strip()
    if principal.role == Role.admin:
        return requested_user_id or principal.uid or principal.email or "admin"

    allowed_ids = {value for value in {principal.uid, principal.email} if value}
    if requested_user_id not in allowed_ids:
        raise HTTPException(status_code=403, detail="Request user_id does not match authenticated user")

    return requested_user_id


@router.post("/ask")
async def ask_rag(
    req: AskRequest,
    request: Request,
    principal: Principal = Depends(require_authenticated_principal),
):
    ask_service = get_ask_service()
    effective_user_id = _resolve_ask_user_id(req, principal)

    try:
        prepared = await asyncio.to_thread(
            ask_service.prepare_answer,
            question=req.question,
            user_id=effective_user_id,
            conversation_id=req.conversation_id,
            document_id=req.document_id,
            context_query=req.context_query,
            debug=req.debug and principal.role == Role.admin,
        )
    except AskConversationAccessError as exc:
        logger.exception(
            "Conversation validation failed: user_id=%s conversation_id=%s",
            effective_user_id,
            req.conversation_id,
        )
        raise HTTPException(status_code=403, detail=str(exc))
    except Exception as e:
        logger.exception(
            "Ask preparation failed: user_id=%s conversation_id=%s",
            effective_user_id,
            req.conversation_id,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process question: {str(e)}",
        )

    try:
        logger.info(
            "[USER=%s] convo=%s | mode=%s",
            prepared.user_id,
            prepared.conversation_id,
            prepared.mode,
        )
        accept_header = (request.headers.get("accept") or "").lower()
        should_stream = req.stream or "text/event-stream" in accept_header

        if not should_stream:
            completed = await ask_service.complete_answer(prepared)

            return {
                "question": completed.question,
                "mode": completed.mode,
                "answer": completed.answer,
                "contexts": completed.contexts,
                "retrieval_debug": completed.retrieval_debug if req.debug and principal.role == Role.admin else None,
            }

        async def event_generator():
            async for stream_event in ask_service.stream_answer_events(prepared):
                yield _to_sse(stream_event.event, stream_event.data)

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
            effective_user_id,
            req.conversation_id,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process question: {str(e)}"
        )
