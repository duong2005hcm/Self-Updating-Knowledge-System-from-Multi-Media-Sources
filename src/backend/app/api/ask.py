from fastapi import APIRouter
from pydantic import BaseModel

from backend.app.rag.retrieval.retrieval import MultiQueryRetriever

from backend.app.rag.agent.query_router import route_mode
from backend.app.rag.agent.response_generator import (
    generate_casual_answer,
    generate_professional_answer,
    generate_web_answer
)

# MEMORY
from backend.app.rag.memory.chat_memory import get_history, add_message

router = APIRouter(tags=["RAG"])

retriever = MultiQueryRetriever(
    collection_names=["rag_pdf", "rag_web"],
    top_k_per_query=3,
    max_total_results=5,
    enable_parallel=True
)


class AskRequest(BaseModel):
    question: str
    session_id: str


class AskResponse(BaseModel):
    question: str
    mode: str
    answer: str
    contexts: list


@router.post("/ask", response_model=AskResponse)
def ask_rag(req: AskRequest):

    question = req.question
    session_id = req.session_id

    # LOAD MEMORY
    history = get_history(session_id)

    # ROUTER AGENT
    try:
        route = route_mode(question)
    except:
        route = {"mode": "professional", "confidence": 0.5}

    mode = route.get("mode", "professional")
    confidence = route.get("confidence", 0.5)

    if confidence < 0.6:
        mode = "professional"

    print(f"[ROUTER] mode={mode} | session={session_id}")

    contexts = []
    answer = ""


    if mode == "casual":
        answer = generate_casual_answer(question, history)


    elif mode == "professional":
        contexts = retriever.retrieve(question, mode="professional")
        contexts = contexts[:5]

        answer = generate_professional_answer(
            question,
            contexts,
            history
        )


    elif mode == "web":
        contexts = retriever.retrieve(question, mode="web")

        contexts = [
            c for c in contexts
            if "web" in c.get("collection", "")
        ][:5]

        answer = generate_web_answer(
            question,
            contexts,
            history
        )


    else:
        contexts = retriever.retrieve(question, mode="professional")

        answer = generate_professional_answer(
            question,
            contexts,
            history
        )


    add_message(session_id, "user", question)
    add_message(session_id, "assistant", answer)


    return {
        "question": question,
        "mode": mode,
        "answer": answer,
        "contexts": [
            {
                "text": c["text"],
                "metadata": c.get("metadata", {}),
                "score": c.get("score", 0),
                "collection": c.get("collection", "")
            }
            for c in contexts
        ]
    }