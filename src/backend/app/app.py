import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel
from dotenv import load_dotenv
load_dotenv()

from backend.app.api.ask import router as ask_router
from backend.app.api.articles import router as articles_router
from backend.app.api.admin_articles import router as admin_articles_router
from backend.app.api.admin_documents import router as admin_documents_router
from backend.app.api.admin_pending_ingests import router as admin_pending_ingests_router
from backend.app.api.admin_governance import router as admin_governance_router
from backend.app.api.admin_prompts import router as admin_prompts_router
from backend.app.api.admin_knowledge import router as admin_knowledge_router
from backend.app.api.documents import router as documents_router
from backend.app.api.ingest_admin import router as ingest_admin_router
from backend.app.api.ingests_doc_n8n import router as n8n_ingests_doc_router
from backend.app.api.ingests_doc import router as ingests_doc_router
from backend.app.api.ingests_web_n8n import router as n8n_ingests_web_router
from backend.app.api.ingests_web import router as ingests_web_router
from backend.app.api.n8n_pending_preview import router as n8n_pending_preview_router
from backend.app.api.pipeline_jobs import router as pipeline_jobs_router
from backend.app.api.search import router as search_router
from backend.app.api.sources import router as sources_router
from backend.app.api.user_upload import router as user_upload_router
from backend.app.api.heat import router as health_router


app = FastAPI(title="RAG Backend API")


def _get_allowed_origins() -> list[str]:
    raw_origins = os.getenv("ALLOWED_ORIGINS", "").strip()
    default_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
    ]

    if not raw_origins:
        return default_origins

    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return origins or default_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(articles_router, prefix="/api")
app.include_router(sources_router, prefix="/api")
app.include_router(search_router, prefix="/api")
app.include_router(pipeline_jobs_router, prefix="/api")
app.include_router(documents_router, prefix="/api")
app.include_router(admin_articles_router, prefix="/api")
app.include_router(admin_documents_router, prefix="/api")
app.include_router(admin_pending_ingests_router, prefix="/api")
app.include_router(admin_governance_router, prefix="/api")
app.include_router(ingest_admin_router, prefix="/api")
app.include_router(ingests_doc_router, prefix="/api")
app.include_router(ingests_web_router, prefix="/api")
# app.include_router(n8n_ingests_doc_router, prefix="/api/admin/n8n")
# app.include_router(n8n_ingests_web_router, prefix="/api/admin/n8n")
app.include_router(n8n_pending_preview_router, prefix="/api")
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
    uvicorn.run(app, host="0.0.0.0", port=8000)
