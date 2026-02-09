
from typing import List, Dict


class ResultReranker:
    """
    Lightweight reranker for RAG retrieval results.
    Designed to be fast, interpretable, and extensible.
    """

    def __init__(
        self,
        weight_similarity: float = 0.6,
        weight_query_priority: float = 0.25,
        weight_metadata: float = 0.15,
    ):
        self.w_sim = weight_similarity
        self.w_qp = weight_query_priority
        self.w_meta = weight_metadata

    def rerank(self, results: List[Dict]) -> List[Dict]:
        """
        Rerank results based on:
        - vector similarity
        - query priority
        - metadata signals
        """
        best_by_id = {}

        for r in results:
            score = self._score(r)

            rid = r["id"]
            if rid not in best_by_id or score > best_by_id[rid]["score"]:
                r["score"] = score
                best_by_id[rid] = r

        return sorted(
            best_by_id.values(),
            key=lambda x: x["score"],
            reverse=True,
        )

    # ---------- INTERNAL SCORING ----------

    def _score(self, r: Dict) -> float:
        sim_score = r.get("similarity", 0.0)
        qp_score = self._query_priority_score(r.get("query_priority", 0))
        meta_score = self._metadata_score(r.get("metadata", {}))

        return (
            self.w_sim * sim_score
            + self.w_qp * qp_score
            + self.w_meta * meta_score
        )

    def _query_priority_score(self, priority: int) -> float:
        """
        Lower priority value = more important query
        """
        return 1.0 / (1 + priority)

    def _metadata_score(self, meta: Dict) -> float:
        """
        Score based on metadata signals.
        Customize freely per project.
        """
        score = 0.0

        if meta.get("data_type") == "news":
            score += 0.2

        if meta.get("source") in {"vnexpress.net", "tuoitre.vn"}:
            score += 0.2

        if meta.get("doc_type") == "official":
            score += 0.3

        # Feedback từ user (nếu có)
        score += meta.get("feedback_score", 0.0)

        return min(score, 1.0)
