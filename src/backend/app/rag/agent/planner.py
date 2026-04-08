import json
from backend.app.config.openai_factory import get_openai_client

client = get_openai_client()

SYSTEM_PROMPT = """
You are an AI agent.

Actions:
- retrieve
- answer_final

Rules:
- If observation is empty → MUST retrieve
- DO NOT hallucinate
- Only answer when confident

Return JSON:
{"action": "...", "action_input": "..."}
"""


def plan_step(question, observation=None):

    prompt = f"""
Question: {question}

Observation:
{observation}

If observation is not useful → retrieve again.
"""

    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        temperature=0,
        response_format={"type": "json_object"}
    )

    try:
        return json.loads(res.choices[0].message.content)
    except:
        return {"action": "answer_final", "action_input": question}
