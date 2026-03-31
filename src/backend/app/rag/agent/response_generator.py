from openai import OpenAI

client = OpenAI()


def build_messages(system_prompt: str, question: str, history: list):
    messages = [
        {
            "role": "system",
            "content": system_prompt
        }
    ]

    for msg in history[-5:]:
        if msg["role"] == "system":
            messages.append({
                "role": "user",
                "content": f"[Summary]\n{msg['content']}"
            })
        else:
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })

    messages.append({
        "role": "user",
        "content": question
    })

    return messages


def generate_casual_answer(question: str, history: list):

    messages = build_messages(
        system_prompt="""
        You are a friendly and helpful assistant.
        Talk naturally like ChatGPT.
        Use conversation history.
        """,
        question=question,
        history=history
    )

    return client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages
    ).choices[0].message.content


def generate_professional_answer(question: str, contexts: list, history: list):

    context_text = "\n\n".join([
    f"[{i}] {c['text']} (source: {c['metadata'].get('url', '')})"
    for i, c in enumerate(contexts)
    ])

    messages = build_messages(
        system_prompt=f"""
        You are a knowledgeable assistant.

        Use the provided context to answer.

        Context:
        {context_text}

        Rules:
        - Answer based on context
        - If not found, say you don't know
        - Cite sources like [0], [1]
        """,
        question=question,
        history=history
    )

    return client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages
    ).choices[0].message.content


def generate_web_answer(question: str, contexts: list, history: list):

    context_text = "\n\n".join([
        f"[{i}] {c['text']}"
        for i, c in enumerate(contexts)
    ])

    messages = build_messages(
        system_prompt=f"""
        You are an up-to-date assistant.

        Use the web context to answer.

        Context:
        {context_text}
        """,
        question=question,
        history=history
    )

    return client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages
    ).choices[0].message.content