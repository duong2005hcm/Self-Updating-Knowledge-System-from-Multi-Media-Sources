from typing import List, Dict
from datetime import datetime, timezone

from firebase_admin import firestore
from backend.app.rag.memory.firebase_init import db

MAX_HISTORY = 6
SUMMARY_TRIGGER = 12


def get_history(conversation_id: str) -> List[Dict]:

    convo_ref = db.collection("conversations").document(conversation_id)
    doc = convo_ref.get()

    if not doc.exists:
        return []

    data = doc.to_dict()
    summary = data.get("summary", "")

    messages_ref = (
        convo_ref.collection("messages")
        .order_by("timestamp", direction=firestore.Query.DESCENDING)
        .limit(MAX_HISTORY)
    )

    messages = [m.to_dict() for m in messages_ref.stream()]
    messages.reverse()

    result = []

    if summary:
        result.append({
            "role": "system",
            "content": f"Conversation summary:\n{summary}"
        })

    result.extend(messages)

    return result


def add_message(conversation_id: str, user_id: str, role: str, content: str):

    convo_ref = db.collection("conversations").document(conversation_id)

    convo_ref.set({
        "user_id": user_id,
        "updated_at": datetime.now(timezone.utc),
        "created_at": datetime.now(timezone.utc)
    }, merge=True)

    convo_ref.collection("messages").add({
        "role": role,
        "content": content,
        "timestamp": datetime.now(timezone.utc)
    })

    messages = list(
        convo_ref.collection("messages")
        .order_by("timestamp")
        .stream()
    )

    if len(messages) > SUMMARY_TRIGGER:
        _summarize(conversation_id)

    elif len(messages) > MAX_HISTORY:
        _trim_messages(conversation_id)

def _trim_messages(conversation_id: str):

    convo_ref = db.collection("conversations").document(conversation_id)

    messages = list(
        convo_ref.collection("messages")
        .order_by("timestamp")
        .stream()
    )

    for msg in messages[:-MAX_HISTORY]:
        msg.reference.delete()


def _summarize(conversation_id: str):

    from backend.app.rag.llm.openai_client import generate_answer

    convo_ref = db.collection("conversations").document(conversation_id)

    messages = list(
        convo_ref.collection("messages")
        .order_by("timestamp")
        .stream()
    )

    if not messages:
        return

    text = "\n".join([
        f"{m.to_dict()['role']}: {m.to_dict()['content']}"
        for m in messages
    ])

    prompt = f"""
Summarize this conversation.
Keep important facts and context.

{text}
"""

    try:
        summary = generate_answer(prompt)

        convo_ref.set({
            "summary": summary
        }, merge=True)

        for msg in messages:
            msg.reference.delete()

    except Exception as e:
        print("Summary error:", e)

def validate_conversation(conversation_id: str, user_id: str):

    convo_ref = db.collection("conversations").document(conversation_id)
    doc = convo_ref.get()

    if not doc.exists:
        return True  # cho phép tạo mới

    data = doc.to_dict()

    if data.get("user_id") != user_id:
        raise Exception("Unauthorized access")

    return True
