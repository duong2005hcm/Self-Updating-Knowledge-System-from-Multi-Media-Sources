from backend.app.rag.retrieval.retrieval import multi_query_retrieve
from backend.app.rag.agent.response_generator import generate_professional_answer


def simple_rag(question, history):

    contexts = multi_query_retrieve(
        question=question,
        top_k=5
    )

    return generate_professional_answer(
        question=question,
        contexts=contexts,
        history=history
    )