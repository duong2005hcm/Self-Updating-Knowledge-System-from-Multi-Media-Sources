from threading import Lock
from typing import Optional

from backend.app.client.database import initialize_chroma_client
from backend.app.rag.embeddings.local_embbeder import OptimizedLocalEmbedder


class _ChromaManager:
    _instance: Optional["_ChromaManager"] = None
    _lock: Lock = Lock()

    def __init__(self):
        self._client = initialize_chroma_client()
        self._embedder = OptimizedLocalEmbedder()

    @property
    def client(self):
        return self._client

    @property
    def embedder(self):
        return self._embedder

    @classmethod
    def instance(cls) -> "_ChromaManager":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance


def get_chroma_manager() -> _ChromaManager:
    return _ChromaManager.instance()


def get_chroma_client():
    return get_chroma_manager().client


def get_embedder():
    return get_chroma_manager().embedder


def get_chroma_client_dependency():
    """
    FastAPI dependency helper for shared Chroma client.
    """
    return get_chroma_client()


def get_embedder_dependency():
    """
    FastAPI dependency helper for shared embedder.
    """
    return get_embedder()
