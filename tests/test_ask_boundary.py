from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from fastapi.responses import StreamingResponse


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import backend.app.api.ask as ask_module
import backend.app.services.ask_service as ask_service_module
from backend.app.api.dependencies.authz import Principal, Role
from backend.app.services.ask_service import (
    AskCompletedAnswer,
    AskPreparedAnswer,
    AskService,
    AskStreamEvent,
)


def _run(coro):
    return asyncio.run(coro)


async def _read_stream(body_iterator) -> str:
    parts: list[str] = []
    async for chunk in body_iterator:
        if isinstance(chunk, bytes):
            chunk = chunk.decode("utf-8")
        parts.append(chunk)
    return "".join(parts)


class FakeRequest:
    def __init__(self, accept: str = ""):
        self.headers = {"accept": accept} if accept else {}


class StubAskService:
    def __init__(
        self,
        *,
        mode: str,
        answer: str = "ok",
        contexts: list[dict] | None = None,
        stream_events: list[AskStreamEvent] | None = None,
    ):
        self.mode = mode
        self.answer = answer
        self.contexts = contexts or []
        self.stream_events = stream_events or []
        self.prepare_calls: list[dict] = []
        self.complete_calls: list[AskPreparedAnswer] = []
        self.stream_calls: list[AskPreparedAnswer] = []

    def prepare_answer(self, *, question: str, user_id: str, conversation_id: str) -> AskPreparedAnswer:
        self.prepare_calls.append(
            {
                "question": question,
                "user_id": user_id,
                "conversation_id": conversation_id,
            }
        )
        return AskPreparedAnswer(
            question=question,
            user_id=user_id,
            conversation_id=conversation_id,
            mode=self.mode,
            contexts=self.contexts,
            fallback_answer=self.answer,
        )

    async def complete_answer(self, prepared: AskPreparedAnswer) -> AskCompletedAnswer:
        self.complete_calls.append(prepared)
        return AskCompletedAnswer(
            question=prepared.question,
            mode=prepared.mode,
            answer=self.answer,
            contexts=prepared.contexts,
        )

    async def stream_answer_events(self, prepared: AskPreparedAnswer):
        self.stream_calls.append(prepared)
        for event in self.stream_events:
            yield event


def _principal(uid: str) -> Principal:
    return Principal(role=Role.user, uid=uid)


def test_ask_route_simple_non_stream_contract(monkeypatch):
    service = StubAskService(
        mode="simple",
        answer="simple answer",
        contexts=[{"text": "ctx"}],
    )
    monkeypatch.setattr(ask_module, "get_ask_service", lambda: service)

    req = ask_module.AskRequest(question="hello", user_id="u1", conversation_id="c1", stream=False)
    response = _run(ask_module.ask_rag(req, FakeRequest(), _principal("u1")))

    assert response == {
        "question": "hello",
        "mode": "simple",
        "answer": "simple answer",
        "contexts": [{"text": "ctx"}],
    }
    assert len(service.prepare_calls) == 1
    assert len(service.complete_calls) == 1


def test_ask_route_planner_non_stream_contract(monkeypatch):
    service = StubAskService(
        mode="planner",
        answer="planned answer",
        contexts=[],
    )
    monkeypatch.setattr(ask_module, "get_ask_service", lambda: service)

    req = ask_module.AskRequest(question="plan this", user_id="u2", conversation_id="c2", stream=False)
    response = _run(ask_module.ask_rag(req, FakeRequest(), _principal("u2")))

    assert response["question"] == "plan this"
    assert response["mode"] == "planner"
    assert response["answer"] == "planned answer"
    assert response["contexts"] == []
    assert len(service.prepare_calls) == 1
    assert len(service.complete_calls) == 1


def test_ask_route_stream_contract_keeps_sse_events(monkeypatch):
    service = StubAskService(
        mode="simple",
        stream_events=[
            AskStreamEvent("meta", {"mode": "simple", "conversation_id": "c3"}),
            AskStreamEvent("token", {"text": "hello"}),
            AskStreamEvent("done", {"mode": "simple"}),
        ],
    )
    monkeypatch.setattr(ask_module, "get_ask_service", lambda: service)

    req = ask_module.AskRequest(question="stream", user_id="u3", conversation_id="c3", stream=True)
    response = _run(ask_module.ask_rag(req, FakeRequest("text/event-stream"), _principal("u3")))

    assert isinstance(response, StreamingResponse)
    payload = _run(_read_stream(response.body_iterator))

    assert "event: meta" in payload
    assert "event: token" in payload
    assert "event: done" in payload
    assert len(service.prepare_calls) == 1
    assert len(service.stream_calls) == 1


def test_ask_route_stream_contract_keeps_error_event(monkeypatch):
    service = StubAskService(
        mode="simple",
        stream_events=[AskStreamEvent("error", {"message": "boom"})],
    )
    monkeypatch.setattr(ask_module, "get_ask_service", lambda: service)

    req = ask_module.AskRequest(question="stream", user_id="u4", conversation_id="c4", stream=True)
    response = _run(ask_module.ask_rag(req, FakeRequest("text/event-stream"), _principal("u4")))
    payload = _run(_read_stream(response.body_iterator))

    assert "event: error" in payload
    assert "boom" in payload


def test_ask_service_simple_path_uses_context_service(monkeypatch):
    captured: dict[str, object] = {}

    class FakeContextService:
        def __init__(self):
            self.questions: list[tuple[str, int | None]] = []

        def retrieve_contexts(self, question: str, *, limit: int | None = None):
            self.questions.append((question, limit))
            return [{"text": "ctx", "score": 0.8, "metadata": {"document_id": "doc-1"}}]

    async def fake_generate_professional_answer(**kwargs):
        captured.update(kwargs)
        yield "hello"
        yield " world"

    monkeypatch.setattr(ask_service_module, "generate_professional_answer", fake_generate_professional_answer)

    fake_context = FakeContextService()
    service = AskService(context_service=fake_context)

    result = service.build_simple_answer(
        question="what is this",
        history=[{"role": "user", "content": "old"}],
        professional_prompt="professional prompt",
        user_docs=["doc text"],
    )

    assert fake_context.questions == [("what is this", None)]
    assert result.contexts == [{"text": "ctx", "score": 0.8, "metadata": {"document_id": "doc-1"}}]
    answer = _run(service.collect_answer(result.answer_stream))
    assert answer == "hello world"
    assert "User uploaded documents" in captured["question"]
    assert captured["contexts"] == result.contexts


def test_ask_service_planner_path_passes_injected_context_service(monkeypatch):
    captured: dict[str, object] = {}

    class FakeContextService:
        pass

    async def fake_answer_stream():
        yield "final"

    def fake_agent_loop(
        question,
        history,
        planner_system_prompt=None,
        professional_prompt=None,
        context_service=None,
    ):
        captured["question"] = question
        captured["history"] = history
        captured["planner_system_prompt"] = planner_system_prompt
        captured["professional_prompt"] = professional_prompt
        captured["context_service"] = context_service
        return fake_answer_stream()

    monkeypatch.setattr(ask_service_module, "validate_conversation", lambda conversation_id, user_id: None)
    monkeypatch.setattr(ask_service_module, "get_history", lambda conversation_id: [{"role": "user", "content": "old"}])
    monkeypatch.setattr(
        ask_service_module,
        "get_prompt_bundle",
        lambda: {
            ask_service_module.PROMPT_SCOPE_ROUTE: "route prompt",
            ask_service_module.PROMPT_SCOPE_PLANNER: "planner prompt",
            ask_service_module.PROMPT_SCOPE_PROFESSIONAL: "professional prompt",
        },
    )
    monkeypatch.setattr(ask_service_module, "get_temp_upload_texts", lambda conversation_id: [])
    monkeypatch.setattr(ask_service_module, "route_mode", lambda question, prompt=None: {"mode": "planner"})
    monkeypatch.setattr(ask_service_module, "agent_loop", fake_agent_loop)

    fake_context = FakeContextService()
    service = AskService(context_service=fake_context)
    prepared = service.prepare_answer(question="make a plan", user_id="u5", conversation_id="c5")

    assert prepared.mode == "planner"
    assert captured["context_service"] is fake_context
    assert captured["planner_system_prompt"] == "planner prompt"
    assert captured["professional_prompt"] == "professional prompt"
    assert _run(service.collect_answer(prepared.answer_stream)) == "final"
