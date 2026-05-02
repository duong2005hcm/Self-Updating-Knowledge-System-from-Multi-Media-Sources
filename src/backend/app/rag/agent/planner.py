import json
import logging
from typing import Any

from backend.app.config.openai_factory import get_openai_client
from backend.app.rag.prompting.prompt_registry import (
    PROMPT_SCOPE_PLANNER,
    get_prompt,
)

client = get_openai_client()
logger = logging.getLogger(__name__)


def plan_step(
    question: str,
    observation: str | None = None,
    system_prompt: str | None = None,
) -> dict[str, Any]:
    planner_system_prompt = (system_prompt or get_prompt(PROMPT_SCOPE_PLANNER)).strip()

    prompt = (
        f"Question: {question}\n\n"
        f"Observation:\n{observation or ''}\n\n"
        "If observation is not useful, retrieve again."
    )

    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": planner_system_prompt},
            {"role": "user", "content": prompt},
        ],
        temperature=0,
        response_format={"type": "json_object"},
    )

    try:
        return json.loads(res.choices[0].message.content)
    except Exception as e:
        logger.exception("Planner parse failed, fallback to answer_final: %s", str(e))
        return {"action": "answer_final", "action_input": question}
