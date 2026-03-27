from typing import Dict, List
from datetime import datetime, timezone

from backend.app.rag.memory.storage_json import load_memory, save_memory

_memory_store: Dict[str, Dict] = load_memory()

MAX_HISTORY = 6
SUMMARY_TRIGGER = 10


def get_history(session_id: str) -> List[Dict]:

    session = _memory_store.get(session_id, {})
    history = session.get("history", [])
    summary = session.get("summary", "")

    messages = []

    if summary:
        messages.append({
            "role": "system",
            "content": f"Conversation summary:\n{summary}"
        })

    messages.extend(history)

    return messages


def add_message(session_id: str, role: str, content: str):

    if session_id not in _memory_store:
        _memory_store[session_id] = {
            "history": [],
            "summary": ""
        }

    session = _memory_store[session_id]

    session["history"].append({
        "role": role,
        "content": content,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    if len(session["history"]) > SUMMARY_TRIGGER:
        _summarize(session_id)

    if len(session["history"]) > MAX_HISTORY:
        session["history"] = session["history"][-MAX_HISTORY:]

    save_memory(_memory_store)


def _summarize(session_id: str):

    from backend.app.rag.llm.openai_client import generate_answer

    session = _memory_store[session_id]
    history = session["history"]

    text = "\n".join([
        f"{m['role']}: {m['content']}"
        for m in history
    ])

    prompt = f"""
    Summarize the conversation.
    Keep important facts.

    {text}
    """

    try:
        summary = generate_answer(prompt)
        session["summary"] = summary
        session["history"] = []
    except:
        pass