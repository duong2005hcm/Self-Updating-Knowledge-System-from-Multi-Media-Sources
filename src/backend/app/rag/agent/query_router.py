import json
import logging

from dotenv import load_dotenv

from backend.app.config.openai_factory import get_openai_client
from backend.app.rag.prompting.prompt_registry import (
    PROMPT_SCOPE_ROUTE,
    get_prompt,
)

load_dotenv()

client = get_openai_client()
logger = logging.getLogger(__name__)


def route_mode(question: str, system_prompt: str | None = None) -> dict:
    router_system_prompt = (system_prompt or get_prompt(PROMPT_SCOPE_ROUTE)).strip()
    user_prompt = f"Question: {question}\nReturn JSON only."

    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": router_system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0,
        response_format={"type": "json_object"},
    )

    try:
        return json.loads(res.choices[0].message.content)
    except Exception as e:
        logger.exception("Route parse failed, fallback to simple mode: %s", str(e))
        return {"mode": "simple"}
