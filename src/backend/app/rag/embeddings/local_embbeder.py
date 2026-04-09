from functools import lru_cache
from typing import List

from backend.app.config.openai_factory import get_openai_client


class OptimizedLocalEmbedder:
    """
    Embedder using OpenAI text-embedding-3-small.
    """

    def __init__(self, model_name: str = "text-embedding-3-small"):
        self.model_name = model_name
        self.client = get_openai_client()
        self.dimension = 1536

    @staticmethod
    def _clean_text(text: str) -> str:
        if text is None:
            return ""
        return str(text).strip()

    def _clean_texts(self, texts: List[str]) -> List[str]:
        cleaned_texts: List[str] = []
        for text in texts:
            cleaned = self._clean_text(text)
            if cleaned:
                cleaned_texts.append(cleaned)
        return cleaned_texts

    @lru_cache(maxsize=200)
    def _embed_query_cached(self, text: str) -> tuple:
        """
        Cache query embedding to reduce API calls.
        """
        question = self._clean_text(text)
        if not question:
            question = (text or "").strip()
        if not question:
            raise ValueError("Query is empty after filtering")

        response = self.client.embeddings.create(
            model=self.model_name,
            input=[question],
        )

        embedding = response.data[0].embedding
        return tuple(embedding)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """
        Embed multiple documents in one API call.
        """
        cleaned_texts = self._clean_texts(texts)

        if not cleaned_texts:
            return []

        response = self.client.embeddings.create(
            model=self.model_name,
            input=cleaned_texts,
        )

        return [d.embedding for d in response.data]

    def embed_query(self, text: str, use_cache: bool = True) -> List[float]:
        """
        Embed one query.
        """
        question = self._clean_text(text)
        if not question:
            question = (text or "").strip()
        if not question:
            raise ValueError("Query is empty after filtering")

        if use_cache:
            return list(self._embed_query_cached(question))

        response = self.client.embeddings.create(
            model=self.model_name,
            input=[question],
        )

        return response.data[0].embedding

    def get_info(self) -> dict:
        """
        Embedder metadata.
        """
        return {
            "provider": "openai",
            "model": self.model_name,
            "dimension": self.dimension,
        }
