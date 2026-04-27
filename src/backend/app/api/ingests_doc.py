from __future__ import annotations

import logging
import os
import hashlib
import re
from typing import Any
from urllib.parse import unquote, urlparse

import requests
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import ConfigDict

from backend.app.api.dependencies.admin_auth import verify_admin_token
from backend.app.schemas.ingest_metadata import IngestMetadata, parse_ingest_metadata_form
from backend.app.services.ingest_orchestration_service import IngestOrchestrationService

router = APIRouter(
    prefix="/ingest",
    tags=["Ingest"],
    dependencies=[Depends(verify_admin_token)],
)
logger = logging.getLogger(__name__)

UPLOAD_DIR = "data/uploads/pdf"
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE_MB = 30
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
VALID_INGEST_ACTIONS = {"created", "updated", "skipped", "failed"}
PDF_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}
FILENAME_SANITIZER = re.compile(r"[^A-Za-z0-9._-]+")
CONTENT_DISPOSITION_FILENAME = re.compile(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)"?')


class PdfUrlIngestRequest(IngestMetadata):
    model_config = ConfigDict(extra="ignore")

    pdf_url: str
    source_id: str | None = None
    corpus: str | None = None
    content_subtype: str | None = None
    title: str | None = None
    published_at: str | None = None
    updated_at: str | None = None
    region: str | None = None
    doi: str | None = None
    pmid: str | None = None
    source_kind: str | None = None


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _resolve_action(result: dict[str, Any]) -> str:
    action = _stringify(result.get("action")).lower()
    if action in VALID_INGEST_ACTIONS:
        return action

    for document in result.get("documents") or []:
        if not isinstance(document, dict):
            continue
        document_action = _stringify(document.get("action")).lower()
        if document_action in VALID_INGEST_ACTIONS:
            return document_action

    created = int(result.get("created") or 0)
    updated = int(result.get("updated") or 0)
    skipped = int(result.get("skipped") or 0)
    failed = int(result.get("failed") or 0)

    if updated > 0:
        return "updated"
    if created > 0:
        return "created"
    if skipped > 0:
        return "skipped"
    if failed > 0 or _stringify(result.get("status")).lower() == "failed":
        return "failed"
    return "failed"


def _normalize_message(action: str, result: dict[str, Any], payload: dict[str, Any], fallback_title: str) -> str:
    existing = _stringify(result.get("message"))
    if existing:
        return existing

    title = _stringify(payload.get("title")) or fallback_title or _stringify(payload.get("pdf_url")) or "PDF document"

    if action == "created":
        return f"Ingested new PDF for {title}"
    if action == "updated":
        return f"Updated PDF for {title}"
    if action == "skipped":
        return f"No PDF content change for {title}"
    return f"Failed to ingest PDF for {title}"


def _normalize_ingest_response(
    *,
    result: dict[str, Any],
    payload: dict[str, Any],
    fallback_title: str,
    fallback_url: str,
) -> dict[str, Any]:
    action = _resolve_action(result)
    documents = result.get("documents") or []
    primary_document = next(
        (document for document in documents if isinstance(document, dict)),
        {},
    )

    normalized: dict[str, Any] = {
        "status": "ok" if action in {"created", "updated", "skipped"} else "failed",
        "action": action,
        "source_id": payload.get("source_id") or result.get("source_id"),
        "document_id": result.get("document_id") or primary_document.get("document_id"),
        "version_id": result.get("version_id") or primary_document.get("version_id"),
        "ingest_job_id": result.get("ingest_job_id"),
        "url": payload.get("pdf_url") or payload.get("url") or fallback_url,
        "title": payload.get("title") or result.get("filename") or fallback_title,
        "message": _normalize_message(action, result, payload, fallback_title),
        "result": result,
    }

    for key, value in result.items():
        normalized.setdefault(key, value)

    return normalized


def _is_pdf_content_type(content_type: str) -> bool:
    normalized = _stringify(content_type).lower()
    if not normalized:
        return False
    return any(pdf_type in normalized for pdf_type in PDF_CONTENT_TYPES)


def _sanitize_filename(value: str, fallback: str = "download") -> str:
    normalized = FILENAME_SANITIZER.sub("_", _stringify(value)).strip("._")
    return normalized or fallback


def _extract_disposition_filename(content_disposition: str) -> str:
    match = CONTENT_DISPOSITION_FILENAME.search(content_disposition or "")
    if not match:
        return ""
    return unquote(match.group(1)).strip().strip('"')


def _build_stable_pdf_filename(pdf_url: str, content_disposition: str) -> str:
    parsed = urlparse(pdf_url)
    raw_name = _extract_disposition_filename(content_disposition) or os.path.basename(unquote(parsed.path))
    basename = _sanitize_filename(raw_name, fallback="download")

    if basename.lower().endswith(".pdf"):
        basename = basename[:-4]

    host = _sanitize_filename(parsed.netloc, fallback="pdf")
    url_hash = hashlib.sha1(pdf_url.encode("utf-8")).hexdigest()[:12]
    return f"{host}_{basename or 'download'}_{url_hash}.pdf"


def _download_pdf(pdf_url: str) -> tuple[bytes, str, str]:
    response = None
    try:
        response = requests.get(
            pdf_url,
            headers={"User-Agent": "Mozilla/5.0"},
            stream=True,
            timeout=(15, 60),
            allow_redirects=True,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=400, detail=f"Failed to download PDF: {exc}") from exc

    try:
        response.raise_for_status()
        content_type = _stringify(response.headers.get("Content-Type")).lower()
        content_disposition = _stringify(response.headers.get("Content-Disposition"))
        filename = _build_stable_pdf_filename(pdf_url, content_disposition)
        looks_like_pdf = (
            _is_pdf_content_type(content_type)
            or filename.lower().endswith(".pdf")
            or pdf_url.lower().split("?", 1)[0].endswith(".pdf")
        )
        if not looks_like_pdf:
            raise HTTPException(status_code=400, detail="Remote URL does not look like a PDF")

        content_length = response.headers.get("Content-Length")
        if content_length:
            try:
                if int(content_length) > MAX_FILE_SIZE_BYTES:
                    size_mb = int(content_length) / (1024 * 1024)
                    raise HTTPException(
                        status_code=400,
                        detail=f"File too large ({size_mb:.2f}MB). Max is {MAX_FILE_SIZE_MB}MB",
                    )
            except ValueError:
                pass

        chunks: list[bytes] = []
        total_size = 0
        for chunk in response.iter_content(chunk_size=1024 * 256):
            if not chunk:
                continue
            total_size += len(chunk)
            if total_size > MAX_FILE_SIZE_BYTES:
                size_mb = total_size / (1024 * 1024)
                raise HTTPException(
                    status_code=400,
                    detail=f"File too large ({size_mb:.2f}MB). Max is {MAX_FILE_SIZE_MB}MB",
                )
            chunks.append(chunk)

        file_bytes = b"".join(chunks)
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Downloaded PDF is empty")

        if not file_bytes.startswith(b"%PDF") and not _is_pdf_content_type(content_type):
            raise HTTPException(status_code=400, detail="Downloaded file is not a valid PDF")

        return file_bytes, filename, content_type
    finally:
        if response is not None:
            response.close()


@router.post("/pdf")
async def ingest_pdf(
    file: UploadFile = File(...),
    ingest_metadata: IngestMetadata = Depends(parse_ingest_metadata_form),
    source_id: str | None = Form(default=None),
    corpus: str | None = Form(default=None),
    content_subtype: str | None = Form(default=None),
    title: str | None = Form(default=None),
    published_at: str | None = Form(default=None),
    updated_at: str | None = Form(default=None),
    region: str | None = Form(default=None),
    doi: str | None = Form(default=None),
    pmid: str | None = Form(default=None),
    source_kind: str | None = Form(default=None),
    pdf_url: str | None = Form(default=None),
    decoded_token: dict[str, Any] = Depends(verify_admin_token),
):
    if not file.filename:
        raise HTTPException(400, "No file provided")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    file_bytes = await file.read()
    file_size_mb = len(file_bytes) / (1024 * 1024)
    if file_size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            400,
            f"File too large ({file_size_mb:.2f}MB). Max is {MAX_FILE_SIZE_MB}MB",
        )

    actor = ingest_metadata.resolve_actor(decoded_token)
    orchestrator = IngestOrchestrationService()
    payload = {
        "source_id": source_id,
        "corpus": corpus,
        "content_subtype": content_subtype,
        "title": title,
        "published_at": published_at,
        "updated_at": updated_at,
        "topic": ingest_metadata.topic,
        "region": region,
        "domain": ingest_metadata.domain,
        "doi": doi,
        "pmid": pmid,
        "source_kind": source_kind,
        "pdf_url": pdf_url,
    }

    try:
        result = orchestrator.ingest_pdf(
            file_bytes=file_bytes,
            filename=file.filename,
            ingest_metadata=ingest_metadata,
            actor=actor,
            upload_dir=UPLOAD_DIR,
            include_filename=True,
            include_collection=True,
            include_processing_time=True,
            allow_duplicates=False,
        )
        return _normalize_ingest_response(
            result=result,
            payload=payload,
            fallback_title=file.filename,
            fallback_url=payload.get("pdf_url") or "",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Ingest PDF pipeline failed: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Ingest pipeline failed: {str(e)}",
        )


@router.post("/pdf-url")
def ingest_pdf_url(
    req: PdfUrlIngestRequest,
    decoded_token: dict[str, Any] = Depends(verify_admin_token),
):
    pdf_url = _stringify(req.pdf_url)
    if not pdf_url:
        raise HTTPException(status_code=400, detail="pdf_url is required")

    file_bytes, filename, _ = _download_pdf(pdf_url)
    actor = req.resolve_actor(decoded_token)
    orchestrator = IngestOrchestrationService()

    try:
        result = orchestrator.ingest_pdf(
            file_bytes=file_bytes,
            filename=filename,
            ingest_metadata=req,
            actor=actor,
            upload_dir=UPLOAD_DIR,
            include_filename=True,
            include_collection=True,
            include_processing_time=True,
            allow_duplicates=False,
        )
        payload = req.model_dump()
        return _normalize_ingest_response(
            result=result,
            payload=payload,
            fallback_title=filename,
            fallback_url=pdf_url,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Ingest PDF URL pipeline failed: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Ingest PDF URL pipeline failed: {str(e)}",
        )
