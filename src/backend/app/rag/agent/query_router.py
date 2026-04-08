import json
from dotenv import load_dotenv
from backend.app.config.openai_factory import get_openai_client

load_dotenv()

client = get_openai_client()

def route_mode(question: str):

    prompt = f"""
Classify query:

1. casual → greeting
2. simple → factual, 1-step
3. complex → multi-step reasoning

Return JSON:
{{"mode": "..."}}

Question: {question}
"""

    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        response_format={"type": "json_object"}
    )

    try:
        return json.loads(res.choices[0].message.content)
    except:
        return {"mode": "simple"}
