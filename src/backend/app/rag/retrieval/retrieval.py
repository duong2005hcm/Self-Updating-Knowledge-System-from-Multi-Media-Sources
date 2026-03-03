from typing import List, Dict
from concurrent.futures import ThreadPoolExecutor, as_completed

from backend.app.rag.retrieval.reranker import ResultReranker
from backend.app.rag.embeddings.local_embbeder import OptimizedLocalEmbedder
from backend.app.rag.retrieval.multi_query import generate_multi_queries
from backend.app.client.database import initialize_chroma_client


class MultiQueryRetriever:
    """
    Multi-collection + Multi-query retriever
    """

    def __init__(
        self,
        collection_names: List[str] = None,
        top_k_per_query: int = 3,
        max_total_results: int = 10,
        enable_parallel: bool = True,
        max_workers: int = 4,
    ):
        self.embedder = OptimizedLocalEmbedder()
        self.client = initialize_chroma_client()

        # Nếu không truyền collection → mặc định search cả pdf + web
        if collection_names is None:
            collection_names = ["rag_pdf", "rag_web"]

        self.collections = [
            self.client.get_or_create_collection(name)
            for name in collection_names
        ]

        self.collection_names = collection_names

        self.top_k_per_query = top_k_per_query
        self.max_total_results = max_total_results
        self.enable_parallel = enable_parallel

        self.executor = (
            ThreadPoolExecutor(max_workers=max_workers)
            if enable_parallel else None
        )

    # ---------- PUBLIC API ----------

    def retrieve(self, question: str) -> List[Dict]:
        queries = generate_multi_queries(question)

        if self.enable_parallel:
            results = self._retrieve_parallel(queries)
        else:
            results = self._retrieve_sequential(queries)

        # Deduplicate + score
        ranked = self._deduplicate_and_score(results)

        # Final rerank layer
        reranker = ResultReranker()
        ranked = reranker.rerank(ranked)

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

        query_embedding = self.embedder.embed_query(query)

        all_results = []

        for collection, cname in zip(self.collections, self.collection_names):

            res = collection.query(
                query_embeddings=[query_embedding],
                n_results=self.top_k_per_query,
                include=["documents", "metadatas", "distances", "ids"],
            )

            for doc, meta, dist, cid in zip(
                res["documents"][0],
                res["metadatas"][0],
                res["distances"][0],
                res["ids"][0],
            ):
                similarity = 1.0 - dist

                all_results.append(
                    {
                        "id": cid,
                        "text": doc,
                        "metadata": meta,
                        "similarity": similarity,
                        "query_priority": priority,
                        "collection": cname,
                    }
                )

        return all_results

    # ---------- MERGE + SCORING ----------

    def _deduplicate_and_score(self, results: List[Dict]) -> List[Dict]:
        """
        Deduplicate by ID and compute score using:
        - similarity
        - query priority
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
    collection_names: List[str] = None,
) -> List[Dict]:

    retriever = MultiQueryRetriever(
        collection_names=collection_names,
        top_k_per_query=max(1, top_k // 2),
        max_total_results=top_k,
        enable_parallel=True,
    )

    return retriever.retrieve(question)