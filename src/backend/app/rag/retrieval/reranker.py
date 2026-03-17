from typing import List, Dict
from openai import OpenAI
import re

client = OpenAI()


class ResultReranker:

    def __init__(
        self,
        weight_similarity: float = 0.6,
        weight_query_priority: float = 0.25,
        weight_metadata: float = 0.15,
    ):
        self.w_sim = weight_similarity
        self.w_qp = weight_query_priority
        self.w_meta = weight_metadata


    def rerank(self, question: str, results: List[Dict], top_k=5) -> List[Dict]:

        if not results:
            return []

        best_by_id = {}

        for r in results:
            score = self._score(r)

            rid = r["id"]
            if rid not in best_by_id or score > best_by_id[rid].get("score", 0):
                r["score"] = score
                best_by_id[rid] = r

        ranked = sorted(
            best_by_id.values(),
            key=lambda x: x["score"],
            reverse=True,
        )

        # LẤY TOP N ĐỂ LLM RERANK
        top_candidates = ranked[:10]

        # LLM RERANK - chọn top K từ top candidates
        try:
            reranked = self._llm_rerank(question, top_candidates, top_k)

            if not reranked:
                return ranked[:top_k]

            return reranked

        except Exception as e:
            print("LLM rerank failed:", str(e))
            return ranked[:top_k]


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
        return 1.0 / (1 + priority)

    def _metadata_score(self, meta: Dict) -> float:
        score = 0.0

        if meta.get("data_type") == "news":
            score += 0.2

        if meta.get("source") in {"vnexpress.net", "tuoitre.vn"}:
            score += 0.2

        if meta.get("doc_type") == "official":
            score += 0.3

        score += meta.get("feedback_score", 0.0)

        return min(score, 1.0)


    def _llm_rerank(self, question: str, results: List[Dict], top_k=5):

        if not results:
            return []

        context_text = "\n\n".join([
            f"[{i}] {r['text'][:300]}"
            for i, r in enumerate(results)
        ])

        prompt = f"""
        You are a ranking system.

        Select the {top_k} most relevant contexts for answering the question.

        Return ONLY numbers (no explanation).
        Example: 0 2 3

        Question:
        {question}

        Contexts:
        {context_text}
        """

        res = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )

        content = res.choices[0].message.content

        indices = list(map(int, re.findall(r"\d+", content)))

        if not indices:
            return results[:top_k]

        selected = [
            results[i]
            for i in indices
            if 0 <= i < len(results)
        ]

        return selected[:top_k]