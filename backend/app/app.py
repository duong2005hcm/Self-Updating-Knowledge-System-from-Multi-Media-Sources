from fastapi import FastAPI
from api.ask import router as ask_router
from api.ingests_doc import router as doc_router
from api.ingests_web import router as web_router
from api.heat import router as health_router

app = FastAPI(title="RAG Backend API")

app.include_router(health_router)
app.include_router(doc_router)
app.include_router(web_router)
app.include_router(ask_router)
