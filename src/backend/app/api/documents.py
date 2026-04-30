from __future__ import annotations

import logging
import ipaddress
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.api.dependencies.authz import (
    Principal,
    Role,
    enforce_document_access,
    get_current_principal,
    is_public_document,
    require_admin_principal,
)
from backend.app.models.document import Document
from backend.app.models.document_version import DocumentVersion
from backend.app.repositories.chunk_repository import ChunkRecord
from backend.app.schemas.document import (
    DocumentChunkListResponse,
    DocumentChunkResponse,
    DocumentDetailResponse,
    DocumentFileResponse,
    DocumentListResponse,
    DocumentPreviewResponse,
    DocumentPreviewSnippetResponse,
    DocumentResponse,
    DocumentVersionListResponse,
    DocumentVersionResponse,
)
from backend.app.services.document_service import DocumentNotFoundError, DocumentPreviewSnippet, DocumentService
from backend.app.services.file_storage_service import (
    SIGNED_URL_EXPIRES_SECONDS,
    FileStorageError,
    FileStorageNotConfiguredError,
    FileStorageService,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)
# Authorization boundary:
# - list/versions remain admin-only operational views.
# - detail/chunks/file are user-facing; guest access is limited to active
#   public documents and sanitized previews unless the caller is admin.


def _is_blocked_remote_host(hostname: str) -> bool:
    normalized = (hostname or "").strip().lower().strip("[]")
    if not normalized:
        return True
    if normalized in {"localhost", "0.0.0.0"} or normalized.endswith(".local"):
        return True

    try:
        ip = ipaddress.ip_address(normalized)
    except ValueError:
        return False

    return any(
        [
            ip.is_loopback,
            ip.is_private,
            ip.is_link_local,
            ip.is_reserved,
            ip.is_multicast,
        ]
    )


def _normalize_remote_pdf_url(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return ""

    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    if _is_blocked_remote_host(parsed.hostname or ""):
        return ""
    return raw


def _document_remote_pdf_urls(
    *,
    document: Document,
    version: DocumentVersion | None,
    raw_path: str,
    service: DocumentService,
) -> list[str]:
    candidates = [
        (
            getattr(version, "file_url", None)
            if version and not getattr(version, "raw_storage_path", None)
            else None
        ),
        getattr(version, "source_url", None) if version else None,
        raw_path,
        service.get_source_url(document.source_id),
    ]

    urls: list[str] = []
    for candidate in candidates:
        url = _normalize_remote_pdf_url(candidate or "")
        if url and url not in urls:
            urls.append(url)
    return urls


def get_document_service() -> DocumentService:
    return DocumentService()


def get_file_storage_service() -> FileStorageService:
    return FileStorageService()


USER_SAFE_CHUNK_METADATA_KEYS = {
    "source_id",
    "document_id",
    "version_id",
    "source_type",
    "domain",
    "topic",
    "priority",
    "visibility",
    "status",
    "version_no",
    "source_name",
    "source_locator",
    "document_name",
    "doc_type",
    "chunk_index",
    "page_start",
    "page_end",
    "page_numbers",
}


def _to_response(document: Document, *, principal: Optional[Principal] = None) -> DocumentResponse:
    if hasattr(document, "model_dump"):
        data = document.model_dump()
    else:
        data = document.dict()

    if principal and principal.role != Role.admin:
        data["checksum"] = None
        data["created_by"] = None
        data["reviewed_by"] = None
        data["reviewed_at"] = None
        if data.get("summary_status") != "approved":
            data["ai_summary"] = None
            data["ai_key_points"] = []
            data["ai_medical_warning"] = None
            data["ai_suggested_tags"] = []
            data["ai_suggested_topic"] = None

    return DocumentResponse(**data)


def _chunk_metadata_for_role(metadata: dict, *, principal: Principal) -> dict:
    if principal.role == Role.admin:
        return metadata
    return {key: metadata.get(key) for key in USER_SAFE_CHUNK_METADATA_KEYS if key in metadata}


def _to_chunk_response(
    chunk: ChunkRecord,
    *,
    include_content: bool,
    preview_chars: int,
    principal: Principal,
) -> DocumentChunkResponse:
    preview = (chunk.content or "")[:preview_chars]
    return DocumentChunkResponse(
        id=chunk.id,
        collection=chunk.collection,
        version_id=chunk.version_id,
        chunk_index=chunk.chunk_index,
        content_preview=preview,
        content=chunk.content if include_content else None,
        metadata=_chunk_metadata_for_role(chunk.metadata, principal=principal),
    )


def _to_preview_snippet_response(
    snippet: DocumentPreviewSnippet,
    *,
    principal: Principal,
) -> DocumentPreviewSnippetResponse:
    return DocumentPreviewSnippetResponse(
        id=snippet.id,
        chunk_id=snippet.chunk_id,
        chunk_index=snippet.chunk_index,
        text=snippet.text,
        score=snippet.score,
        source=snippet.source,
        metadata=_chunk_metadata_for_role(snippet.metadata, principal=principal),
    )


def _to_version_response(version: DocumentVersion) -> DocumentVersionResponse:
    if hasattr(version, "model_dump"):
        data = version.model_dump()
    else:
        data = version.dict()

    # raw_path is an internal temp/local path. Do not expose local filesystem
    # paths to frontend clients; use raw_storage_path/file_url for diagnostics.
    data["raw_path"] = None
    return DocumentVersionResponse(**data)


@router.get("", response_model=DocumentListResponse)
def list_documents(
    limit: int = Query(default=50, ge=1, le=200),
    source_id: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    domain: Optional[str] = Query(default=None),
    service: DocumentService = Depends(get_document_service),
    _admin: Principal = Depends(require_admin_principal),
) -> DocumentListResponse:
    try:
        items = service.list_documents(
            limit=limit,
            source_id=source_id,
            status=status,
            domain=domain,
        )
        return DocumentListResponse(
            items=[_to_response(item, principal=_admin) for item in items],
            total=len(items),
        )
    except Exception as e:
        logger.exception("List documents failed: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to list documents: {str(e)}")


@router.get("/{document_id}", response_model=DocumentDetailResponse)
def get_document(
    document_id: str,
    service: DocumentService = Depends(get_document_service),
    principal: Principal = Depends(get_current_principal),
) -> DocumentDetailResponse:
    try:
        item = service.get_document(document_id)
        enforce_document_access(principal=principal, status=item.status, visibility=item.visibility)
        return DocumentDetailResponse(item=_to_response(item, principal=principal))
    except DocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Get document failed for document_id='%s': %s", document_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get document: {str(e)}")


@router.get("/{document_id}/versions", response_model=DocumentVersionListResponse)
def list_document_versions(
    document_id: str,
    service: DocumentService = Depends(get_document_service),
    _admin: Principal = Depends(require_admin_principal),
) -> DocumentVersionListResponse:
    try:
        items = service.list_document_versions(document_id)
        return DocumentVersionListResponse(
            items=[_to_version_response(item) for item in items],
            total=len(items),
        )
    except DocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("List versions failed for document_id='%s': %s", document_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to list document versions: {str(e)}")


@router.get("/{document_id}/chunks", response_model=DocumentChunkListResponse)
def list_document_chunks(
    document_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    include_content: bool = Query(default=False),
    preview_chars: int = Query(default=500, ge=50, le=4000),
    service: DocumentService = Depends(get_document_service),
    principal: Principal = Depends(get_current_principal),
) -> DocumentChunkListResponse:
    try:
        document = service.get_document(document_id)
        enforce_document_access(principal=principal, status=document.status, visibility=document.visibility)
        effective_include_content = include_content if principal.role == Role.admin else False
        if principal.role == Role.guest:
            effective_preview_chars = min(preview_chars, 500)
            effective_limit = min(limit, 5)
        else:
            effective_preview_chars = preview_chars if principal.role == Role.admin else min(preview_chars, 1000)
            effective_limit = limit
        items = service.list_document_chunks(document_id=document_id, limit=effective_limit)
        return DocumentChunkListResponse(
            items=[
                _to_chunk_response(
                    item,
                    include_content=effective_include_content,
                    preview_chars=effective_preview_chars,
                    principal=principal,
                )
                for item in items
            ],
            total=len(items),
        )
    except DocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("List chunks failed for document_id='%s': %s", document_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to list document chunks: {str(e)}")


@router.get("/{document_id}/preview", response_model=DocumentPreviewResponse)
def get_document_preview(
    document_id: str,
    q: Optional[str] = Query(default=None),
    limit: int = Query(default=3, ge=1, le=10),
    preview_chars: int = Query(default=700, ge=120, le=2000),
    service: DocumentService = Depends(get_document_service),
    principal: Principal = Depends(get_current_principal),
) -> DocumentPreviewResponse:
    try:
        document = service.get_document(document_id)
        enforce_document_access(principal=principal, status=document.status, visibility=document.visibility)
        effective_limit = min(limit, 3) if principal.role == Role.guest else limit
        effective_preview_chars = min(preview_chars, 700) if principal.role == Role.guest else preview_chars
        mode, items = service.build_document_preview(
            document_id=document_id,
            query=q,
            limit=effective_limit,
            preview_chars=effective_preview_chars,
        )
        return DocumentPreviewResponse(
            document_id=document_id,
            mode=mode,
            query=(q or None),
            items=[
                _to_preview_snippet_response(item, principal=principal)
                for item in items
            ],
            total=len(items),
        )
    except DocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Get preview failed for document_id='%s': %s", document_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get document preview: {str(e)}")


@router.get("/{document_id}/file", response_model=DocumentFileResponse)
def get_document_file(
    document_id: str,
    disposition: str = Query(default="inline"),
    service: DocumentService = Depends(get_document_service),
    file_storage: FileStorageService = Depends(get_file_storage_service),
    principal: Principal = Depends(get_current_principal),
) -> DocumentFileResponse:
    try:
        document = service.get_document(document_id)
        enforce_document_access(principal=principal, status=document.status, visibility=document.visibility)

        # Guest file access is intentionally narrower than user detail access:
        # only active public documents can expose raw files without auth.
        if principal.role == Role.guest and not is_public_document(
            status=document.status,
            visibility=document.visibility,
        ):
            raise HTTPException(status_code=403, detail="Public PDF required")

        versions = service.list_document_versions(document_id)
        version = max(versions, key=lambda item: item.version_no, default=None)
        raw_path = (version.raw_path if version else None) or ""
        filename = (
            getattr(version, "raw_filename", None)
            or document.title
            or f"{document_id}.pdf"
        )
        if not filename.lower().endswith(".pdf"):
            filename = f"{filename}.pdf"

        normalized_disposition = "attachment" if disposition == "attachment" else "inline"
        storage_path = (getattr(version, "raw_storage_path", None) if version else None) or ""
        storage_error: Exception | None = None

        if storage_path:
            try:
                signed_url = file_storage.get_file_url(
                    storage_path=storage_path,
                    filename=filename,
                    disposition=normalized_disposition,
                )
                return DocumentFileResponse(
                    document_id=document_id,
                    filename=filename,
                    mime_type=(getattr(version, "mime_type", None) if version else None) or "application/pdf",
                    file_url=signed_url,
                    storage_path=storage_path,
                    source="firebase_storage_signed_url",
                    expires_in_seconds=SIGNED_URL_EXPIRES_SECONDS,
                )
            except (FileStorageError, FileStorageNotConfiguredError) as exc:
                storage_error = exc
                logger.warning(
                    "Stored document file URL failed for document_id='%s', storage_path='%s': %s",
                    document_id,
                    storage_path,
                    str(exc),
                )

        if is_public_document(status=document.status, visibility=document.visibility):
            remote_urls = _document_remote_pdf_urls(
                document=document,
                version=version,
                raw_path=raw_path,
                service=service,
            )
            if remote_urls:
                return DocumentFileResponse(
                    document_id=document_id,
                    filename=filename,
                    mime_type=(getattr(version, "mime_type", None) if version else None) or "application/pdf",
                    file_url=remote_urls[0],
                    storage_path=storage_path or None,
                    source="external_pdf_url",
                    expires_in_seconds=None,
                )

        if storage_error is not None:
            raise HTTPException(
                status_code=502,
                detail=(
                    "Document PDF exists in metadata but a browser-accessible storage URL "
                    f"could not be created: {str(storage_error)}"
                ),
            )

        raise HTTPException(
            status_code=404,
            detail=(
                "Document PDF is not available from browser-accessible storage. "
                "Re-ingest the PDF with Firebase Storage/GCS configured."
            ),
        )
    except DocumentNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Get file failed for document_id='%s': %s", document_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get document file: {str(e)}")
