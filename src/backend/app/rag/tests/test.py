from pathlib import Path
from backend.app.rag.ingestion.embedding_store import embed_and_store_chunks


def test_chromadb_ingest():
    print("🚀 TEST CHROMADB INGEST")

    processed_dir = Path("data/processed")
    chunk_files = list(processed_dir.glob("*_chunks.json"))
    assert chunk_files, "❌ Không tìm thấy chunk file"

    chunk_file = chunk_files[-1]
    print("📄 Ingesting:", chunk_file.name)

    result = embed_and_store_chunks(
        chunks_json_path=str(chunk_file),
        collection_name="rag_test",
        data_type="pdf",
        allow_duplicates=False
    )

    print("📦 RESULT:", result)

    assert result["status"] in ("ok", "skipped")
    assert result["collection"] == "rag_test"

    print("✅ CHROMADB INGEST OK")


if __name__ == "__main__":
    test_chromadb_ingest()
