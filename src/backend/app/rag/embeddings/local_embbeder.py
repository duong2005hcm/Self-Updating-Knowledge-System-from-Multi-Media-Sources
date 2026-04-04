from typing import List
from functools import lru_cache
from openai import OpenAI


class OptimizedLocalEmbedder:
    """
    Dùng model: text-embedding-3-large
    """

    def __init__(self, model_name: str = "text-embedding-3-small"):
        self.model_name = model_name
        self.client = OpenAI()

        # dimension của model
        self.dimension = 1536

    @lru_cache(maxsize=200)
    def _embed_query_cached(self, text: str) -> tuple:
        """
        Cache query embedding để giảm API call
        """
        response = self.client.embeddings.create(
            model=self.model_name,
            input=[text]
        )

        embedding = response.data[0].embedding
        return tuple(embedding)

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """
        Embed nhiều documents cùng lúc để tối ưu hiệu suất
        """
        if not texts:
            return []

        response = self.client.embeddings.create(
            model=self.model_name,
            input=texts
        )

        return [d.embedding for d in response.data]

    def embed_query(self, text: str, use_cache: bool = True) -> List[float]:
        """
        Embed query
        """
        if use_cache:
            return list(self._embed_query_cached(text))

        response = self.client.embeddings.create(
            model=self.model_name,
            input=[text]
        )

        return response.data[0].embedding

    def get_info(self) -> dict:
        """
        Metadata model
        """
        return {
            "provider": "openai",
            "model": self.model_name,
            "dimension": self.dimension
        }