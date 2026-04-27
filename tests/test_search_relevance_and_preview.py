from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from backend.app.models.document import Document
from backend.app.models.document_version import DocumentVersion
from backend.app.repositories.chunk_repository import ChunkRecord, SemanticChunkMatch
from backend.app.schemas.search import SearchMode
from backend.app.services.document_service import DocumentService
from backend.app.services.search_service import SearchService


def _document(document_id: str, title: str, topic: str = "general") -> Document:
    now = datetime.now(timezone.utc)
    return Document(
        id=document_id,
        source_id="src_1",
        title=title,
        source_type="PDF",
        status="active",
        domain="general",
        topic=topic,
        priority="normal",
        visibility="public",
        created_by="admin",
        created_at=now,
        updated_at=now,
    )


def _chunk(chunk_id: str, document_id: str, content: str, chunk_index: int) -> ChunkRecord:
    return ChunkRecord(
        id=chunk_id,
        collection="rag_pdf",
        version_id="ver_1",
        chunk_index=chunk_index,
        content=content,
        metadata={
            "document_id": document_id,
            "chunk_index": chunk_index,
            "source_name": "test.pdf",
        },
    )


class FakeDocumentRepository:
    def __init__(self, documents: list[Document]):
        self.documents = {document.id: document for document in documents}

    def list_documents_for_search(self, **_kwargs):
        return list(self.documents.values())

    def get_document_by_id(self, document_id: str):
        return self.documents.get(document_id)


class FakeSourceRepository:
    def get_sources_by_ids(self, _source_ids):
        return {}


class FakeChunkRepository:
    def __init__(self, chunks: list[ChunkRecord], matches: list[SemanticChunkMatch] | None = None):
        self.chunks = chunks
        self.matches = matches or []

    def list_chunks_by_document(self, *, document_id: str, limit: int = 50):
        return [chunk for chunk in self.chunks if chunk.metadata.get("document_id") == document_id][:limit]

    def semantic_search_chunks(self, *, query: str, limit: int = 20):
        return self.matches[:limit]


class FakeVersionRepository:
    def __init__(
        self,
        version: DocumentVersion | None = None,
        versions: dict[str, DocumentVersion] | None = None,
    ):
        self.version = version
        self.versions = versions or {}

    def get_latest_by_document(self, _document_id: str):
        if _document_id in self.versions:
            return self.versions[_document_id]
        return self.version

    def list_versions_by_document(self, _document_id: str):
        version = self.get_latest_by_document(_document_id)
        return [version] if version else []


class FakeOpenAIClient:
    def __init__(self, content: str):
        self.content = content
        self.requests = []
        self.chat = SimpleNamespace(
            completions=SimpleNamespace(create=self._create)
        )

    def _create(self, **kwargs):
        self.requests.append(kwargs)
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(content=self.content)
                )
            ]
        )


def test_short_keyword_query_does_not_match_substrings_inside_words():
    docs = [
        _document("doc_noise", "Bai-2-HT-1-SIU-fidelity-gate.pdf"),
        _document("doc_ai", "AI policy overview", topic="ai"),
    ]
    service = SearchService(
        document_repository=FakeDocumentRepository(docs),
        chunk_repository=FakeChunkRepository([]),
        source_repository=FakeSourceRepository(),
        version_repository=FakeVersionRepository(),
    )

    items, total = service.search_documents(search_mode=SearchMode.keyword, q="AI", limit=10)

    assert total == 1
    assert [item.id for item in items] == ["doc_ai"]
    assert items[0].match_fields


def test_short_hybrid_query_filters_weak_semantic_matches():
    weak_chunk = _chunk("chunk_weak", "doc_weak", "A weak unrelated vector hit.", 0)
    strong_chunk = _chunk("chunk_strong", "doc_strong", "AI is explicitly discussed here.", 0)
    docs = [
        _document("doc_weak", "General policy"),
        _document("doc_strong", "Technology overview"),
    ]
    chunk_repo = FakeChunkRepository(
        [weak_chunk, strong_chunk],
        matches=[
            SemanticChunkMatch(chunk=weak_chunk, score=0.30, distance=2.3),
            SemanticChunkMatch(chunk=strong_chunk, score=0.70, distance=0.4),
        ],
    )
    service = SearchService(
        document_repository=FakeDocumentRepository(docs),
        chunk_repository=chunk_repo,
        source_repository=FakeSourceRepository(),
        version_repository=FakeVersionRepository(),
    )

    items, total = service.search_documents(search_mode=SearchMode.hybrid, q="AI", limit=10)

    assert total == 1
    assert [item.id for item in items] == ["doc_strong"]
    assert "semantic" in items[0].match_fields


def test_keyword_search_prefers_extracted_text_over_pdf_filename_title():
    docs = [
        _document("doc_filename", "AI.pdf"),
        _document("doc_content", "general-guideline.pdf"),
    ]
    versions = {
        "doc_filename": DocumentVersion(id="ver_file", document_id="doc_filename", version_no=1, extracted_text=""),
        "doc_content": DocumentVersion(
            id="ver_content",
            document_id="doc_content",
            version_no=1,
            extracted_text="This document explains AI governance, risk, and usage policy in detail.",
        ),
    }
    service = SearchService(
        document_repository=FakeDocumentRepository(docs),
        chunk_repository=FakeChunkRepository([]),
        source_repository=FakeSourceRepository(),
        version_repository=FakeVersionRepository(versions=versions),
    )

    items, total = service.search_documents(search_mode=SearchMode.keyword, q="AI", limit=10)

    assert total == 1
    assert items[0].id == "doc_content"
    assert "content" in items[0].match_fields
    assert items[0].snippet_source == "extracted_text"


def test_document_preview_uses_query_matched_snippets_not_first_chunks():
    document = _document("doc_1", "Diabetes guideline")
    chunks = [
        _chunk("chunk_0", "doc_1", "Opening cover page without the requested term.", 0),
        _chunk("chunk_1", "doc_1", "This section explains diabetes symptoms and treatment.", 1),
    ]
    service = DocumentService(
        document_repository=FakeDocumentRepository([document]),
        version_repository=FakeVersionRepository(),
        source_repository=FakeSourceRepository(),
        chunk_repository=FakeChunkRepository(chunks),
        openai_client=FakeOpenAIClient("This document is relevant because it explains diabetes symptoms."),
    )

    mode, snippets = service.build_document_preview(document_id="doc_1", query="diabetes", limit=3)

    assert mode == "ai_summary"
    assert snippets[0].source == "ai_summary"
    assert snippets[0].metadata["derived_from"] == "matched_chunks"
    assert "diabetes" in snippets[0].text.lower()


def test_document_preview_without_query_prefers_extracted_text_summary():
    document = _document("doc_1", "Summary source")
    version = DocumentVersion(
        id="ver_1",
        document_id="doc_1",
        version_no=1,
        extracted_text=(
            "This document describes the approved workflow for clinical guidance. "
            "It includes scope, timing, and user-facing access policy."
        ),
    )
    service = DocumentService(
        document_repository=FakeDocumentRepository([document]),
        version_repository=FakeVersionRepository(version),
        source_repository=FakeSourceRepository(),
        chunk_repository=FakeChunkRepository([
            _chunk("chunk_0", "doc_1", "Raw first chunk should not be used when summary exists.", 0)
        ]),
        openai_client=FakeOpenAIClient("The document summarizes the approved workflow for clinical guidance."),
    )

    mode, snippets = service.build_document_preview(document_id="doc_1", limit=3)

    assert mode == "ai_summary"
    assert snippets[0].chunk_id is None
    assert snippets[0].metadata["derived_from"] == "extracted_text"
    assert "approved workflow" in snippets[0].text
