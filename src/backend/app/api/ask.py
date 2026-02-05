from fastapi import APIRouter
from pydantic import BaseModel

from rag.retrieval.retrieval import MultiQueryRetriever
from rag.llm.prompt import build_rag_prompt
from rag.llm.openai_client import generate_answer

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
    contexts = retriever.retrieve(req.question)

    prompt = build_rag_prompt(contexts, req.question)
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
