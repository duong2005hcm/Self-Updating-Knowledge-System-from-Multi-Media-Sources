from openai import OpenAI
import json

client = OpenAI()


def route_mode(question: str) -> dict:

    prompt = f"""
    You are a conversation mode selector.

    Choose ONE mode:

    1. casual:
    - Friendly conversation
    - General knowledge

    2. professional:
    - Needs accurate info from documents
    - Use knowledge base (RAG)

    3. web:
    - Needs recent info / news

    ------------------------

    RULES:
    - Return ONLY JSON
    - No explanation

    Format:
    {{"mode": "casual | professional | web", "confidence": 0.0-1.0}}

    ------------------------

    Guidelines:
    - Mention document → professional
    - General question → casual
    - Recent info → web
    - If unsure → professional

    ------------------------

    Question:
    {question}
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
        return {"mode": "professional", "confidence": 0.5}