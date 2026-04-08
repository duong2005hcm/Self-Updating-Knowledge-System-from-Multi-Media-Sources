import os
from threading import Lock
from typing import Optional

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()


class _OpenAIClientFactory:
    _client: Optional[OpenAI] = None
    _lock: Lock = Lock()

    @classmethod
    def get_client(cls) -> OpenAI:
        if cls._client is None:
            with cls._lock:
                if cls._client is None:
                    api_key = os.getenv("OPENAI_API_KEY")
                    cls._client = OpenAI(api_key=api_key) if api_key else OpenAI()
        return cls._client


def get_openai_client() -> OpenAI:
    """Return shared OpenAI client instance."""
    return _OpenAIClientFactory.get_client()


# FastAPI dependency helpers -------------------------------------------------

def get_openai_client_dependency() -> OpenAI:
    """Expose shared client for FastAPI Depends."""
    return get_openai_client()
