from fastapi import APIRouter
from pydantic import BaseModel
from backend.app.api.user_upload import USER_TEMP_DATA
from backend.app.rag.agent.query_router import route_mode
from backend.app.rag.agent.agent_loop import agent_loop
from backend.app.rag.agent.simple_rag import simple_rag
from backend.app.rag.agent.response_generator import generate_casual_answer

from backend.app.rag.memory.chat_memory import get_history, add_message

router = APIRouter(tags=["RAG"])


class AskRequest(BaseModel):
    question: str
    user_id: str
    conversation_id: str


class AskResponse(BaseModel):
    question: str
    mode: str
    answer: str
    contexts: list


@router.post("/ask", response_model=AskResponse)
def ask_rag(req: AskRequest):

    question = req.question
    user_id = req.user_id
    conversation_id = req.conversation_id

    history = get_history(conversation_id)
    
    user_docs = USER_TEMP_DATA.get(conversation_id, [])
    user_context = "\n\n".join(user_docs)

    if user_context:
        question = f"""
User question:
{question}

User uploaded documents:
{user_context[:3000]}
"""

    try:
        route = route_mode(question)
    except:
        route = {"mode": "simple"}

    mode = route.get("mode", "simple")

    print(f"[USER={user_id}] convo={conversation_id} | mode={mode}")

    answer = ""

    if mode == "casual":
        answer = generate_casual_answer(question, history)

    elif mode == "simple":
        answer = simple_rag(question, history)

    else:
        answer = agent_loop(question, history)

    add_message(conversation_id,user_id , "user", question)
    add_message(conversation_id,user_id , "assistant", answer)

    return {
        "question": question,
        "mode": mode,
        "answer": answer,
        "contexts": []  # optional
    }