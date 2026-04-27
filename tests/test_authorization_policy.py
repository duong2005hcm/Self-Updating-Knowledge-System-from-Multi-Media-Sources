from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi import HTTPException


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

import backend.app.api.ask as ask_module
import backend.app.api.documents as documents_module
import backend.app.api.search as search_module
from backend.app.api.dependencies.authz import Principal, Role, enforce_document_access
from backend.app.models.document import Document
from backend.app.repositories.chunk_repository import ChunkRecord
from backend.app.schemas.search import SearchMode, SearchRequest


def test_search_policy_caps_guest_and_forces_active_status():
    payload = SearchRequest(
        search_mode=SearchMode.keyword,
        q="policy",
        status="archived",
        created_by="someone",
        limit=100,
    )

    filtered = search_module._apply_search_policy(payload, Principal(role=Role.guest))

    assert filtered.status == "active"
    assert filtered.visibility == "public"
    assert filtered.created_by is None
    assert filtered.limit == 10


def test_search_policy_leaves_admin_filters_unchanged():
    payload = SearchRequest(
        search_mode=SearchMode.keyword,
        q="policy",
        status="archived",
        created_by="someone",
        limit=100,
    )

    filtered = search_module._apply_search_policy(payload, Principal(role=Role.admin, uid="admin"))

    assert filtered.status == "archived"
    assert filtered.created_by == "someone"
    assert filtered.limit == 100


def test_search_policy_user_keeps_visibility_filter_but_forces_active():
    payload = SearchRequest(
        search_mode=SearchMode.keyword,
        q="policy",
        status="archived",
        visibility="protected",
        limit=100,
    )

    filtered = search_module._apply_search_policy(payload, Principal(role=Role.user, uid="user_1"))

    assert filtered.status == "active"
    assert filtered.visibility == "protected"
    assert filtered.limit == 50


def test_user_document_response_sanitizes_operational_fields():
    document = Document(
        id="doc_1",
        source_id="src_1",
        title="Policy",
        source_type="PDF",
        status="active",
        domain="general",
        topic="policy",
        priority="normal",
        visibility="public",
        checksum="secret_checksum",
        current_version=1,
        created_by="admin_uid",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        reviewed_by="reviewer",
    )

    response = documents_module._to_response(
        document,
        principal=Principal(role=Role.user, uid="user_1"),
    )

    assert response.checksum is None
    assert response.created_by is None
    assert response.reviewed_by is None
    assert response.visibility == "public"


def test_user_chunk_response_hides_full_content_and_sensitive_metadata():
    chunk = ChunkRecord(
        id="chunk_1",
        collection="rag_pdf",
        version_id="ver_1",
        chunk_index=0,
        content="full content",
        metadata={
            "document_id": "doc_1",
            "source_id": "src_1",
            "checksum": "secret_checksum",
            "file_hash": "secret_file_hash",
            "topic": "policy",
        },
    )

    response = documents_module._to_chunk_response(
        chunk,
        include_content=False,
        preview_chars=100,
        principal=Principal(role=Role.user, uid="user_1"),
    )

    assert response.content is None
    assert response.content_preview == "full content"
    assert response.metadata["document_id"] == "doc_1"
    assert "checksum" not in response.metadata
    assert "file_hash" not in response.metadata


def test_guest_can_access_public_document_detail():
    enforce_document_access(
        principal=Principal(role=Role.guest),
        status="active",
        visibility="public",
    )


def test_guest_cannot_access_protected_document_detail():
    with pytest.raises(HTTPException) as exc:
        enforce_document_access(
            principal=Principal(role=Role.guest),
            status="active",
            visibility="protected",
        )

    assert exc.value.status_code == 403


def test_ask_user_id_must_match_authenticated_user():
    req = ask_module.AskRequest(
        question="hello",
        user_id="other_user",
        conversation_id="convo_1",
        stream=False,
    )

    with pytest.raises(HTTPException) as exc:
        ask_module._resolve_ask_user_id(req, Principal(role=Role.user, uid="user_1"))

    assert exc.value.status_code == 403
