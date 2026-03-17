from typing import List, Dict
from concurrent.futures import ThreadPoolExecutor, as_completed

from backend.app.rag.embeddings.local_embbeder import OptimizedLocalEmbedder
from backend.app.client.database import initialize_chroma_client

from backend.app.rag.retrieval.multi_query import generate_multi_queries
from backend.app.rag.retrieval.reranker import ResultReranker
from backend.app.rag.retrieval.hybrid_llm import keyword_score


class MultiQueryRetriever:

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


    def retrieve(self, question: str, mode: str = "professional") -> List[Dict]:

        queries = generate_multi_queries(question)

        selected = self._select_collections(mode)

        if self.enable_parallel:
            results = self._retrieve_parallel(queries, selected)
        else:
            results = self._retrieve_sequential(queries, selected)

        ranked = self._deduplicate_and_score(results)

        if mode == "web":
            ranked = [
                r for r in ranked
                if "web" in r.get("collection", "")
            ]

        reranker = ResultReranker()
        ranked = reranker.rerank(question, ranked, top_k=5)

        return ranked[: self.max_total_results]


    def _select_collections(self, mode: str):
        if mode == "web":
            return [
                (c, name)
                for c, name in zip(self.collections, self.collection_names)
                if name == "rag_web"
            ]
        else:
            return list(zip(self.collections, self.collection_names))


    def _retrieve_parallel(self, queries, selected):
        futures = [
            self.executor.submit(self._retrieve_single, q, priority, selected)
            for priority, q in enumerate(queries)
        ]

        all_results = []
        for future in as_completed(futures):
            all_results.extend(future.result())

        return all_results


    def _retrieve_sequential(self, queries, selected):
        all_results = []
        for priority, q in enumerate(queries):
            all_results.extend(self._retrieve_single(q, priority, selected))
        return all_results


    def _retrieve_single(self, query: str, priority: int, selected) -> List[Dict]:

        query_embedding = self.embedder.embed_query(query)

        all_results = []

        for collection, cname in selected:

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

                bm25 = keyword_score(query, doc)
                final_score = 0.7 * similarity + 0.3 * bm25

                all_results.append(
                    {
                        "id": cid,
                        "text": doc,
                        "metadata": meta,
                        "similarity": similarity,
                        "bm25": bm25,
                        "score": final_score,
                        "query_priority": priority,
                        "collection": cname,
                    }
                )

        return all_results


    def _deduplicate_and_score(self, results: List[Dict]) -> List[Dict]:

        best_by_id: Dict[str, Dict] = {}

        for r in results:
            rid = r["id"]

            if rid not in best_by_id or r["score"] > best_by_id[rid]["score"]:
                best_by_id[rid] = r

        return sorted(
            best_by_id.values(),
            key=lambda x: x["score"],
            reverse=True,
        )


def multi_query_retrieve(
    question: str,
    top_k: int = 5,
    collection_names: List[str] = None,
    mode: str = "professional",
) -> List[Dict]:

    retriever = MultiQueryRetriever(
        collection_names=collection_names,
        top_k_per_query=max(1, top_k // 2),
        max_total_results=top_k,
        enable_parallel=True,
    )

    return retriever.retrieve(question, mode=mode)