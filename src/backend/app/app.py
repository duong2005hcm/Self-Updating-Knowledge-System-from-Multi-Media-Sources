import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel
from dotenv import load_dotenv

from backend.app.api.ask import router as ask_router
from backend.app.api.admin_prompts import router as admin_prompts_router
from backend.app.api.admin_knowledge import router as admin_knowledge_router
from backend.app.api.ingest_admin import router as ingest_admin_router
from backend.app.api.user_upload import router as user_upload_router
from backend.app.api.heat import router as health_router

load_dotenv()
app = FastAPI(title="RAG Backend API")


def _get_allowed_origins() -> list[str]:
    raw_origins = os.getenv("ALLOWED_ORIGINS", "").strip()

    if not raw_origins:
        return ["http://localhost:5000"]

    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return origins or ["http://localhost:5000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(ingest_admin_router, prefix="/api")
app.include_router(admin_prompts_router, prefix="/api")
app.include_router(admin_knowledge_router, prefix="/api")
app.include_router(user_upload_router, prefix="/api")
app.include_router(ask_router, prefix="/api")

@app.get("/")
async def read_root():
    return {
        "message": "Chào mừng bạn đến với RAG Backend API",
        "status": "Online",
        "docs_url": "/docs"
    }
class Chatrequest(BaseModel):
    question: str

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
