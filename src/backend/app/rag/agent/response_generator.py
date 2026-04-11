import logging
from typing import Any, AsyncGenerator

from backend.app.config.openai_factory import get_openai_client
from backend.app.rag.prompting.prompt_registry import (
    PROMPT_SCOPE_CASUAL,
    PROMPT_SCOPE_PROFESSIONAL,
    get_prompt,
)

client = get_openai_client()
logger = logging.getLogger(__name__)


def build_messages(system_prompt: str, question: str, history: list[dict[str, Any]]) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]

    for msg in history[-5:]:
        role = msg.get("role", "user")
        content = str(msg.get("content", ""))

        if role == "system":
            messages.append({"role": "user", "content": f"[Summary]\n{content}"})
        else:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": question})
    return messages


def generate_casual_answer(
    question: str,
    history: list[dict[str, Any]],
    system_prompt: str | None = None,
) -> str:
    casual_system_prompt = (system_prompt or get_prompt(PROMPT_SCOPE_CASUAL)).strip()

    messages = build_messages(
        system_prompt=casual_system_prompt,
        question=question,
        history=history,
    )

    return client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
    ).choices[0].message.content


def _build_context_text(contexts: list[dict[str, Any]]) -> str:
    rows = []
    for i, context_item in enumerate(contexts):
        text = str(context_item.get("text", ""))
        metadata = context_item.get("metadata") or {}
        source = str(metadata.get("url", ""))
        rows.append(f"[{i}] {text} (source: {source})")
    return "\n\n".join(rows)


def _render_professional_system_prompt(template: str, context_text: str) -> str:
    if "{context_text}" in template:
        return template.replace("{context_text}", context_text)

    return (
        f"{template.strip()}\n\n"
        f"Context:\n{context_text}\n\n"
        "Rules:\n"
        "- Answer based on context\n"
        "- If not found, say you don't know\n"
        "- Cite sources like [0], [1]"
    )


async def generate_professional_answer(
    question: str,
    contexts: list[dict[str, Any]],
    history: list[dict[str, Any]],
    system_prompt_template: str | None = None,
) -> AsyncGenerator[str, None]:
    context_text = _build_context_text(contexts)
    template = (system_prompt_template or get_prompt(PROMPT_SCOPE_PROFESSIONAL)).strip()
    professional_system_prompt = _render_professional_system_prompt(template, context_text)

    messages = build_messages(
        system_prompt=professional_system_prompt,
        question=question,
        history=history,
    )

    try:
        stream = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            stream=True,
        )

        for chunk in stream:
            delta = ""
            if chunk.choices and chunk.choices[0].delta:
                delta = chunk.choices[0].delta.content or ""

            if delta:
                yield delta
    except Exception as e:
        logger.exception("Streaming professional answer failed: %s", str(e))
        raise


def generate_web_answer(
    question: str,
    contexts: list[dict[str, Any]],
    history: list[dict[str, Any]],
    system_prompt_template: str | None = None,
) -> str:
    context_text = "\n\n".join([f"[{i}] {c['text']}" for i, c in enumerate(contexts)])

    template = (system_prompt_template or get_prompt(PROMPT_SCOPE_PROFESSIONAL)).strip()
    web_system_prompt = _render_professional_system_prompt(template, context_text)

    messages = build_messages(
        system_prompt=web_system_prompt,
        question=question,
        history=history,
    )

    return client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
    ).choices[0].message.content
