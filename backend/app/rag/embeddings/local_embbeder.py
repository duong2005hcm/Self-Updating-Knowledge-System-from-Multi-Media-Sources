import torch
from sentence_transformers import SentenceTransformer
from typing import List
import numpy as np
from functools import lru_cache


class OptimizedLocalEmbedder:
    def __init__(self, model_name="paraphrase-multilingual-MiniLM-L12-v2"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model_name = model_name

        self.model = SentenceTransformer(model_name, device=self.device)

        self.batch_size = 8 if self.device == "cuda" else 32

    @lru_cache(maxsize=200)
    def _embed_query_cached(self, text: str) -> tuple:
        """Cache theo (model_name + text)"""
        emb = self.model.encode(
            text,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False
        )
        return tuple(emb.tolist())  # tuple để cache an toàn

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        try:
            embeddings = self.model.encode(
                texts,
                batch_size=self.batch_size,
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=len(texts) > 50
            )
            return embeddings.tolist()

        except torch.cuda.OutOfMemoryError:
            self.batch_size = max(2, self.batch_size // 2)
            torch.cuda.empty_cache()
            embeddings = self.model.encode(
                texts,
                batch_size=self.batch_size,
                convert_to_numpy=True,
                normalize_embeddings=True
            )
            return embeddings.tolist()

    def embed_query(self, text: str, use_cache: bool = True) -> List[float]:
        if use_cache:
            return list(self._embed_query_cached(text))
        emb = self.model.encode(
            text,
            convert_to_numpy=True,
            normalize_embeddings=True
        )
        return emb.tolist()

    def get_info(self) -> dict:
        return {
            "device": self.device,
            "batch_size": self.batch_size,
            "dimension": self.model.get_sentence_embedding_dimension(),
            "model": self.model_name
        }
