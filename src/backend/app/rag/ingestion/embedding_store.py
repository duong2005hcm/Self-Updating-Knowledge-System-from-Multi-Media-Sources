import json
import uuid
import hashlib
from datetime import datetime
from backend.app.rag.embeddings.local_embbeder import OptimizedLocalEmbedder
from backend.app.client.database import initialize_chroma_client


def normalize_text(text: str) -> str:
    """Chuẩn hóa text để tránh duplicate do format"""
    return " ".join(text.strip().split())


def compute_file_hash_from_chunks(chunks: list) -> str:
    """
    Tạo hash toàn file dựa trên nội dung text của tất cả chunk
    """
    combined_text = "".join([c["text"] for c in chunks])
    return hashlib.sha256(combined_text.encode("utf-8")).hexdigest()


def embed_and_store_chunks(
    chunks_json_path: str,
    allow_duplicates: bool = False
):
    # 1. Load chunks
    with open(chunks_json_path, "r", encoding="utf-8") as f:
        chunks = json.load(f)

    if not chunks:
        return {"status": "empty", "inserted": 0}

    # Compute file-level hash
    file_hash = compute_file_hash_from_chunks(chunks)

    # 2. Group theo data_type
    grouped_by_type = {}

    for c in chunks:
        data_type = c.get("data_type", "unknown")

        if data_type not in grouped_by_type:
            grouped_by_type[data_type] = []

        grouped_by_type[data_type].append(c)

    embedder = OptimizedLocalEmbedder()
    client = initialize_chroma_client()

    total_inserted = 0

    # 3. Xử lý từng data_type
    for data_type, items in grouped_by_type.items():

        collection_name = f"rag_{data_type}"
        collection = client.get_or_create_collection(collection_name)

        # FILE-LEVEL DUPLICATE CHECK
        if not allow_duplicates:
            existing_file = collection.get(
                where={"file_hash": file_hash}
            )

            if existing_file.get("ids"):
                print(f"⏭ File already ingested in {collection_name}, skipping...")
                continue

        texts, metadatas, ids = [], [], []

        for c in items:
            normalized_text = normalize_text(c["text"])

            metadata = {k: v for k, v in c.items() if k != "text"}

            metadata.update({
                "file_hash": file_hash,
                "source_file": chunks_json_path.split("/")[-1],
                "ingested_at": datetime.utcnow().isoformat()
            })

            texts.append(normalized_text)
            metadatas.append(metadata)

            deterministic_id = str(
                uuid.uuid5(
                    uuid.NAMESPACE_DNS,
                    f"{data_type}:{c.get('source','')}:{normalized_text}"
                )
            )

            ids.append(deterministic_id)

        if not texts:
            continue

        # 4. Embed
        embeddings = embedder.embed_documents(texts)

        # 5. Chunk-level duplicate filtering
        if not allow_duplicates:
            try:
                existing = collection.get(ids=ids)
                existing_ids = set(existing.get("ids", []))
            except Exception:
                existing_ids = set()

            filtered = [
                (t, e, m, i)
                for t, e, m, i in zip(texts, embeddings, metadatas, ids)
                if i not in existing_ids
            ]

            if not filtered:
                continue

            texts = [x[0] for x in filtered]
            embeddings = [x[1] for x in filtered]
            metadatas = [x[2] for x in filtered]
            ids = [x[3] for x in filtered]

        # 6. Store
        collection.add(
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )

        total_inserted += len(texts)

        print(f" Stored {len(texts)} into {collection_name}")

    return {
        "status": "ok",
        "inserted": total_inserted
    }