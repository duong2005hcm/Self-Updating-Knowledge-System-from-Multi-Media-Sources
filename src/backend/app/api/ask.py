from fastapi import APIRouter
from pydantic import BaseModel

from backend.app.rag.retrieval.retrieval import MultiQueryRetriever

from backend.app.rag.agent.query_router import route_mode
from backend.app.rag.agent.response_generator import (
    generate_casual_answer,
    generate_professional_answer,
    generate_web_answer
)

router = APIRouter(tags=["RAG"])

retriever = MultiQueryRetriever(
    collection_names=["rag_pdf", "rag_web"],
    top_k_per_query=3,
    max_total_results=5,
    enable_parallel=True
)


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    question: str
    mode: str
    answer: str
    contexts: list



@router.post("/ask", response_model=AskResponse)
def ask_rag(req: AskRequest):

    question = req.question

    # ROUTER AGENT
    route = route_mode(question)

    mode = route.get("mode", "professional")
    confidence = route.get("confidence", 0.5)

    # fallback
    if confidence < 0.6:
        mode = "professional"

    print(f"[ROUTER] mode={mode} confidence={confidence}")

    contexts = []
    answer = ""

    # CASUAL
    if mode == "casual":
        answer = generate_casual_answer(question)

    # PROFESSIONAL
    elif mode == "professional":
        contexts = retriever.retrieve(question, mode="professional")

        answer = generate_professional_answer(
            question,
            contexts
        )

    # WEB (WEB ONLY)
    elif mode == "web":
        contexts = retriever.retrieve(question, mode="web")

        # filter extra
        contexts = [
            c for c in contexts
            if "web" in c.get("collection", "")
        ]

        answer = generate_web_answer(
            question,
            contexts
        )


    else:
        contexts = retriever.retrieve(question, mode="professional")

        answer = generate_professional_answer(
            question,
            contexts
        )


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