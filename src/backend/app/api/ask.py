from fastapi import APIRouter
from pydantic import BaseModel

from backend.app.rag.retrieval.retrieval import MultiQueryRetriever
from backend.app.rag.llm.prompt import build_rag_prompt
from backend.app.rag.llm.openai_client import generate_answer

router = APIRouter(tags=["RAG"])

retriever = MultiQueryRetriever(
    collection_name="rag_knowledge",
    top_k_per_query=3,
    max_total_results=5,
    enable_parallel=True
)


class AskRequest(BaseModel):
    question: str


class AskResponse(BaseModel):
    question: str
    answer: str
    contexts: list


@router.post("/ask", response_model=AskResponse)
def ask_rag(req: AskRequest):
    # 1. Retrieve context
    contexts = retriever.retrieve(req.question)

    # 2. Build prompt
    prompt = build_rag_prompt(contexts, req.question)

    # 3. Call LLM
    answer = generate_answer(prompt)

    return {
        "question": req.question,
        "answer": answer,
        "contexts": [
            {
                "text": c["text"],
                "metadata": c["metadata"],
                "score": c["score"]
            }
            for c in contexts
        ]
    }
