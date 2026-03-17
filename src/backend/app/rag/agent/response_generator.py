from openai import OpenAI

client = OpenAI()


def generate_casual_answer(question: str):

    return client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You are a friendly and helpful assistant. Talk naturally."
            },
            {"role": "user", "content": question}
        ]
    ).choices[0].message.content


def generate_professional_answer(question: str, contexts):

    context_text = "\n\n".join([
        f"[{i}] {c['text']}"
        for i, c in enumerate(contexts)
    ])

    prompt = f"""
    You are a knowledgeable assistant.

    Answer based on the context.

    Context:
    {context_text}

    Question:
    {question}

    If not found, say you don't know.
    Cite sources like [0], [1].
    """

    return client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    ).choices[0].message.content


def generate_web_answer(question: str, contexts):

    context_text = "\n\n".join([
        f"[{i}] {c['text']}"
        for i, c in enumerate(contexts)
    ])

    prompt = f"""
    You are an up-to-date assistant.

    Use the context to answer with recent information.

    Context:
    {context_text}

    Question:
    {question}
    """

    return client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}]
    ).choices[0].message.content