from typing import List
from backend.app.config.openai_factory import get_openai_client

client = get_openai_client()

def generate_multi_queries(question: str, max_queries: int = 3) -> List[str]:
    """
    LLM-based query expansion
    """

    prompt = f"""
    Generate {max_queries} different search queries for the question.
    Each query should capture a different aspect.

    Question: {question}
    """

    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    )

    text = res.choices[0].message.content

    queries = []
    for line in text.split("\n"):
        line = line.strip("- ").strip()
        if line:
            queries.append(line)

    return [question] + queries[:max_queries]
