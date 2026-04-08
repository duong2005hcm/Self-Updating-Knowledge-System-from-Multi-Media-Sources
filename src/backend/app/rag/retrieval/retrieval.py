from typing import List, Dict
from concurrent.futures import ThreadPoolExecutor, as_completed

from backend.app.chroma_manager import get_chroma_manager

from backend.app.rag.retrieval.multi_query import generate_multi_queries
from backend.app.rag.retrieval.reranker import ResultReranker
from backend.app.rag.retrieval.hybrid_llm import keyword_score

from backend.app.rag.tools.web_tool import web_retrieve
from backend.app.rag.tools.youtube_tool import youtube_retrieve

from backend.app.rag.logs.retrieval_logger import log_retrieval


class MultiQueryRetriever:

    def __init__(
        self,
        collection_names: List[str] = None,
        top_k_per_query: int = 3,
        max_total_results: int = 10,
        enable_parallel: bool = True,
        max_workers: int = 4,
    ):
        manager = get_chroma_manager()
        self.embedder = manager.embedder
        self.client = manager.client

        if collection_names is None:
            collection_names = ["rag_pdf"]

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
            pdf_results = self._retrieve_parallel(queries, selected)
        else:
            pdf_results = self._retrieve_sequential(queries, selected)

        pdf_ranked = self._deduplicate_and_score(pdf_results)

        if pdf_ranked and pdf_ranked[0]["score"] > 0.75:
            print("🔥 HIGH CONFIDENCE PDF → SKIP WEB + YT")

            reranker = ResultReranker()
            ranked = reranker.rerank(question, pdf_ranked, top_k=self.max_total_results)

            log_retrieval(question, ranked)

            return ranked[: self.max_total_results]

        web_results, yt_results = [], []

        if self.enable_parallel and self.executor:
            futures = {
                self.executor.submit(web_retrieve, question, 3): "web",
                self.executor.submit(youtube_retrieve, question): "yt",
            }

            for future in as_completed(futures):
                source = futures[future]
                try:
                    result = future.result(timeout=10)

                    if source == "web":
                        web_results = result or []
                    elif source == "yt":
                        yt_results = result or []

                except Exception as e:
                    print(f"{source} retrieval failed:", e)

        else:
            try:
                web_results = web_retrieve(question, num_results=3)
            except Exception as e:
                print("web error:", e)

            try:
                yt_results = youtube_retrieve(question)
            except Exception as e:
                print("yt error:", e)

        print("PDF:", len(pdf_results))
        print("WEB:", len(web_results))
        print("YT:", len(yt_results))

        results = pdf_results + web_results + yt_results

        ranked = self._deduplicate_and_score(results)

        if mode == "web":
            ranked = [
                r for r in ranked
                if "web" in r.get("collection", "")
            ]

        reranker = ResultReranker()
        ranked = reranker.rerank(
            question,
            ranked,
            top_k=self.max_total_results
        )

        final_results = ranked

        log_retrieval(question, final_results)

        return final_results[: self.max_total_results]

    def _select_collections(self, mode: str):
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
                include=["documents", "metadatas", "distances"],
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

                metadata = meta or {}

                if "file_name" not in metadata:
                    metadata["file_name"] = "unknown.pdf"

                if "url" not in metadata:
                    metadata["url"] = f"file://{metadata.get('file_name', '')}"

                all_results.append(
                    {
                        "id": cid,
                        "text": doc,
                        "metadata": metadata,
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

            if "pdf" in r.get("collection", ""):
                r["score"] += 0.2
            elif "web" in r.get("collection", ""):
                r["score"] += 0.1
            elif "youtube" in r.get("collection", ""):
                r["score"] += 0.05

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
