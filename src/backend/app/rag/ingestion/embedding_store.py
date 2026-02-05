import json
import uuid
from datetime import datetime
from backend.app.rag.embeddings.local_embbeder import OptimizedLocalEmbedder
from backend.app.client.database import initialize_chroma_client

def embed_and_store_chunks(
    chunks_json_path: str,
    collection_name: str = "rag_knowledge",
    data_type: str = "unknown",
    allow_duplicates: bool = False
):
    # 1. Load chunks
    with open(chunks_json_path, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    texts, metadatas, ids = [], [], []

    for c in chunks:
        metadata = {k: v for k, v in c.items() if k != "text"}
        metadata.update({
            "data_type": data_type,
            "source_file": chunks_json_path.split("/")[-1],
            "ingested_at": datetime.utcnow().isoformat()
        })

        texts.append(c["text"])
        metadatas.append(metadata)

        if not allow_duplicates:
            deterministic_id = str(
                uuid.uuid5(
                    uuid.NAMESPACE_DNS,
                    f"{data_type}:{c['text']}"
                )
            )
            ids.append(deterministic_id)
        else:
            ids.append(str(uuid.uuid4()))

    if not texts:
        return {"status": "empty", "inserted": 0}

    # 2. Embed
    embedder = OptimizedLocalEmbedder()
    embeddings = embedder.embed_documents(texts)

    # 3. Store
    client = initialize_chroma_client()
    collection = client.get_or_create_collection(collection_name)

    # Optional duplicate check
    if not allow_duplicates:
        try:
            existing = collection.get(ids=ids)
            existing_ids = set(existing.get("ids", []))
        except Exception:
            existing_ids = set()

        if existing_ids:
            filtered = [
                (t, e, m, i)
                for t, e, m, i in zip(texts, embeddings, metadatas, ids)
                if i not in existing_ids
            ]

            if not filtered:
                return {
                    "status": "skipped",
                    "reason": "all chunks already exist",
                    "inserted": 0
                }

            texts = [x[0] for x in filtered]
            embeddings = [x[1] for x in filtered]
            metadatas = [x[2] for x in filtered]
            ids = [x[3] for x in filtered]

    collection.add(
        documents=texts,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids
    )

    return {
        "status": "ok",
        "inserted": len(texts),
        "collection": collection_name,
        "data_type": data_type
    }
