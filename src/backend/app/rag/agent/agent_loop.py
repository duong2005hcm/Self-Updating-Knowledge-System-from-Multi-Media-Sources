import logging
from typing import Any, AsyncGenerator

from backend.app.rag.agent.planner import plan_step
from backend.app.rag.agent.response_generator import generate_professional_answer
from backend.app.services.ask_context_service import AskContextService

MAX_STEPS = 2
logger = logging.getLogger(__name__)


def build_observation(results: list[dict[str, Any]]) -> str:
    if not results:
        return "No relevant information found."

    obs = []
    for result in results[:2]:
        text = str(result.get("text", ""))[:200]
        score = round(float(result.get("score", 0)), 2)
        obs.append(f"(score={score}) {text}")

    return "\n".join(obs)


def agent_loop(
    question: str,
    history: list[dict[str, Any]],
    planner_system_prompt: str | None = None,
    professional_prompt: str | None = None,
    context_service: AskContextService | None = None,
) -> AsyncGenerator[str, None]:
    all_contexts: list[dict[str, Any]] = []
    observation: str | None = None
    retriever = context_service or AskContextService()

    for step in range(MAX_STEPS):
        plan = plan_step(
            question,
            observation,
            system_prompt=planner_system_prompt,
        )

        action = plan.get("action")
        action_input = str(plan.get("action_input", "") or "").strip()

        logger.info("[STEP %s] %s", step, action)

        if action == "answer_final":
            break

        if not action_input:
            action_input = question

        results = retriever.retrieve_contexts(action_input, limit=6)

        if not results:
            results = retriever.retrieve_contexts(
                f"{action_input} detailed explanation".strip(),
                limit=6,
            )

        if results:
            all_contexts.extend(results)
            observation = build_observation(results)

            if float(results[0].get("score", 0)) > 0.9:
                break
        else:
            observation = "No relevant information found."

    return generate_professional_answer(
        question=question,
        contexts=all_contexts[:6],
        history=history,
        system_prompt_template=professional_prompt,
    )
