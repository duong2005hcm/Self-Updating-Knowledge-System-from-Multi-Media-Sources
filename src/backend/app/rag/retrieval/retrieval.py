# rag/retrieval/retriever.py

from typing import List, Dict
from concurrent.futures import ThreadPoolExecutor, as_completed
import uuid

from rag.retrieval.reranker import ResultReranker
from rag.embeddings.local_embbeder import OptimizedLocalEmbedder
from rag.retrieval.multi_query import generate_multi_queries
from client.database import initialize_chroma_client


class MultiQueryRetriever:
    """Retriever that uses multiple query variations to improve document retrieval."""

    def __init__(
        self,
        collection_name: str = "rag_knowledge",
        top_k_per_query: int = 3,
        max_total_results: int = 10,
        enable_parallel: bool = True,
        max_workers: int = 4,
    ):
        self.embedder = OptimizedLocalEmbedder()
        self.collection = (
            initialize_chroma_client()
            .get_or_create_collection(collection_name)
        )

        self.top_k_per_query = top_k_per_query
        self.max_total_results = max_total_results
        self.enable_parallel = enable_parallel

        self.executor = (
            ThreadPoolExecutor(max_workers=max_workers)
            if enable_parallel else None
        )

    # ---------- PUBLIC API ----------

    def retrieve(self, question: str) -> List[Dict]:
        """
        Main retrieval entrypoint
        """
        queries = generate_multi_queries(question)

        if self.enable_parallel:
            results = self._retrieve_parallel(queries)
        else:
            results = self._retrieve_sequential(queries)

        ranked = self._deduplicate_and_rerank(results)
        
        reranker = ResultReranker()
        ranked = reranker.rerank(results)
        
        return ranked[: self.max_total_results]

    # ---------- RETRIEVAL MODES ----------

    def _retrieve_sequential(self, queries: List[str]) -> List[Dict]:
        all_results = []
        for priority, q in enumerate(queries):
            all_results.extend(self._retrieve_single(q, priority))
        return all_results

    def _retrieve_parallel(self, queries: List[str]) -> List[Dict]:
        futures = [
            self.executor.submit(self._retrieve_single, q, priority)
            for priority, q in enumerate(queries)
        ]

        all_results = []
        for future in as_completed(futures):
            all_results.extend(future.result())

        return all_results

    # ---------- CORE SEARCH ----------

    def _retrieve_single(self, query: str, priority: int) -> List[Dict]:
        """
        Run a single vector search for one query variant
        """
        query_embedding = self.embedder.embed_query(query)

        res = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=self.top_k_per_query,
            include=["documents", "metadatas", "distances"],
        )

        results = []
        for doc, meta, dist in zip(
            res["documents"][0],
            res["metadatas"][0],
            res["distances"][0],
        ):
            # Chroma cosine distance ∈ [0, 2] → similarity ∈ [1, -1]
            similarity = 1.0 - dist

            results.append(
                {
                    "id": meta.get("chunk_id") or str(uuid.uuid4()),
                    "text": doc,
                    "metadata": meta,
                    "similarity": similarity,
                    "query_priority": priority,
                }
            )

        return results

    # ---------- RERANKING ----------

    def _deduplicate_and_rerank(self, results: List[Dict]) -> List[Dict]:
        """
        Deduplicate by chunk_id and rerank by:
        - vector similarity
        - query priority (original query > derived queries)
        """
        best_by_id: Dict[str, Dict] = {}

        for r in results:
            score = (
                r["similarity"] * 0.7
                + (1.0 / (1 + r["query_priority"])) * 0.3
            )

            rid = r["id"]
            if rid not in best_by_id or score > best_by_id[rid]["score"]:
                r["score"] = score
                best_by_id[rid] = r

        return sorted(
            best_by_id.values(),
            key=lambda x: x["score"],
            reverse=True,
        )


# ---------- BACKWARD-COMPAT WRAPPER ----------

def multi_query_retrieve(
    question: str,
    top_k: int = 5,
    collection_name: str = "rag_knowledge",
) -> List[Dict]:
    retriever = MultiQueryRetriever(
        collection_name=collection_name,
        top_k_per_query=max(1, top_k // 2),
        max_total_results=top_k,
        enable_parallel=True,
    )
    return retriever.retrieve(question)


# # ---------- MANUAL TEST ----------

# if __name__ == "__main__":
#     retriever = MultiQueryRetriever(
#         collection_name="rag_knowledge",
#         top_k_per_query=3,
#         max_total_results=8,
#         enable_parallel=True,
#     )

#     results = retriever.retrieve("Máy tính là gì?")

#     print(f"Found {len(results)} results")
#     for i, r in enumerate(results[:3], 1):
#         print(f"\n{i}. score={r['score']:.3f}")
#         print(f"   text={r['text'][:120]}...")
#         print(f"   priority={r['query_priority']}")
