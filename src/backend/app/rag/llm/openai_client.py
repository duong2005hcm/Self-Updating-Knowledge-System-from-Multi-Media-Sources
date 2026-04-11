from backend.app.config.openai_factory import get_openai_client
from backend.app.rag.prompting.prompt_registry import (
    PROMPT_SCOPE_OPENAI_DEFAULT,
    get_prompt,
)

client = get_openai_client()


def generate_answer(
    prompt: str,
    model: str = "gpt-4o-mini",
    system_prompt: str | None = None,
) -> str:
    resolved_system_prompt = (system_prompt or get_prompt(PROMPT_SCOPE_OPENAI_DEFAULT)).strip()

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": resolved_system_prompt},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=500,
    )

    return response.choices[0].message.content.strip()
