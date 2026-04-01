from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel

from backend.app.api.ask import router as ask_router
from backend.app.api.ingest_admin import router as ingest_admin_router
from backend.app.api.user_upload import router as user_upload_router
from backend.app.api.heat import router as health_router

app = FastAPI(title="RAG Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # khi deploy thì set domain frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(ingest_admin_router, prefix="/api")
app.include_router(user_upload_router, prefix="/api")
app.include_router(ask_router, prefix="/api")

class Chatrequest(BaseModel):
    question: str

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
