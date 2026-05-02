from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Optional
from urllib.parse import unquote, urlparse
from unittest.mock import patch

import requests
from bs4 import BeautifulSoup
from fastapi import HTTPException
from pydantic import ConfigDict

import backend.app.services.ingest_orchestration_service as ingest_orchestration_module
from backend.app.repositories.pending_ingest_repository import PendingIngestRepository
from backend.app.schemas.ingest_metadata import IngestMetadata, WebIngestRequest
from backend.app.services.extractors.skds_article_extractor import extract_skds_disease_article
from backend.app.services.ingest_orchestration_service import IngestOrchestrationService

try:
    from pypdf import PdfReader
except Exception:  # pragma: no cover - dependency fallback is handled at runtime.
    PdfReader = None


logger = logging.getLogger(__name__)

MAX_FILE_SIZE_MB = 30
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
PDF_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}
FILENAME_SANITIZER = re.compile(r"[^A-Za-z0-9._-]+")
CONTENT_DISPOSITION_FILENAME = re.compile(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)"?')
VALID_INGEST_ACTIONS = {"created", "updated", "skipped", "failed"}
PENDING_APPROVED_CHROMA_COLLECTION = "rag_web_pdf"
PENDING_STORAGE_ROOT = Path(os.getenv("PENDING_INGEST_STORAGE_DIR", "data/pending_ingests"))
MAX_EXTRACTED_TEXT_PREVIEW_CHARS = 20_000
MAX_CHUNKS_PREVIEW_COUNT = 5
MAX_CHUNK_PREVIEW_TEXT_CHARS = 2_000


class PendingWebIngestRequest(WebIngestRequest):
    model_config = ConfigDict(extra="ignore")


class PendingPdfUrlIngestRequest(IngestMetadata):
    model_config = ConfigDict(extra="ignore")

    pdf_url: str


@dataclass
class PdfPageText:
    page_number: int
    text: str


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


class PendingIngestService:
    def __init__(
        self,
        *,
        repository: Optional[PendingIngestRepository] = None,
        orchestrator: Optional[IngestOrchestrationService] = None,
    ):
        self._repository = repository or PendingIngestRepository()
        self._orchestrator = orchestrator or IngestOrchestrationService()

    def create_web_preview(self, payload: dict[str, Any], actor: str | dict[str, Any] | None) -> dict[str, Any]:
        normalized = self._normalize_payload(payload, default_source_kind="html_page")
        url = _stringify(normalized.get("url"))
        if not url:
            raise HTTPException(status_code=400, detail="url is required")
        normalized["url"] = url

        existing = self._find_existing_preview(normalized)
        if existing:
            return existing

        try:
            response = requests.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; ChatTraCuuBenhBot/1.0)"},
                timeout=(15, 45),
                allow_redirects=True,
            )
            response.raise_for_status()
            original_text_length = len(response.text or "")
            extracted = self._extract_web_text(response.text, normalized)
            extracted_text = extracted.get("text") or ""
            if extracted.get("title"):
                normalized["title"] = extracted.get("title")
                normalized.setdefault("article_title", extracted.get("title"))
            logger.info(
                "pending web extract_mode=%s raw_html_length=%s clean_text_length=%s first_300=%r",
                _stringify(normalized.get("extract_mode")) or "default",
                original_text_length,
                len(extracted_text),
                extracted_text[:300],
            )
            chunks = self._chunk_text(extracted_text, metadata=self._chunk_metadata(normalized))
            return self._create_preview_item(
                normalized,
                actor,
                extracted_text=extracted_text,
                chunks=chunks,
                status="pending",
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to create web pending preview for %s: %s", url, str(exc))
            return self._create_preview_item(
                normalized,
                actor,
                extracted_text="",
                chunks=[],
                status="failed",
                preview_error=f"Failed to fetch or extract URL: {exc}",
            )

    def create_pdf_url_preview(self, payload: dict[str, Any], actor: str | dict[str, Any] | None) -> dict[str, Any]:
        normalized = self._normalize_payload(payload, default_source_kind="pdf_url")
        pdf_url = _stringify(normalized.get("pdf_url"))
        if not pdf_url:
            raise HTTPException(status_code=400, detail="pdf_url is required")
        normalized["pdf_url"] = pdf_url

        existing = self._find_existing_preview(normalized)
        if existing:
            return existing

        try:
            file_bytes, filename, _content_type = self._download_pdf(pdf_url)
            pages = self._extract_pdf_pages(file_bytes)
            extracted_text = self._join_pdf_pages(pages)
            chunks = self._chunk_pdf_pages(pages, metadata=self._chunk_metadata(normalized))
            return self._create_preview_item(
                normalized,
                actor,
                extracted_text=extracted_text,
                chunks=chunks,
                status="pending",
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Failed to create PDF pending preview for %s: %s", pdf_url, str(exc))
            return self._create_preview_item(
                normalized,
                actor,
                extracted_text="",
                chunks=[],
                status="failed",
                preview_error=f"Failed to extract PDF text: {exc}",
            )

    def list_pending(
        self,
        status: Optional[str] = None,
        source_id: Optional[str] = None,
        corpus: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
        sort_by: str = "updated_at",
        sort_order: str = "desc",
    ) -> tuple[list[dict[str, Any]], int]:
        return self._repository.list_pending_ingests(
            status,
            source_id,
            corpus,
            limit,
            offset,
            sort_by,
            sort_order,
        )

    def get_pending(self, pending_id: str) -> dict[str, Any]:
        item = self._repository.get_pending_ingest(pending_id)
        if item is None:
            raise HTTPException(status_code=404, detail="Pending ingest not found")
        return self._hydrate_pending_content(item)

    def approve_pending(self, pending_id: str, actor: str | dict[str, Any] | None) -> dict[str, Any]:
        item = self.get_pending(pending_id)
        if item.get("status") not in {"pending", "failed"}:
            raise HTTPException(status_code=400, detail=f"Pending ingest is already {item.get('status')}")

        actor_name = self._actor_to_string(actor)
        source_kind = _stringify(item.get("source_kind"))

        if source_kind == "html_page":
            result = self._approve_web(item, actor_name)
        elif source_kind == "pdf_url":
            result = self._approve_pdf_url(item, actor_name)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported pending source_kind: {source_kind}")

        result = dict(result or {})
        result["target_chroma_collection"] = PENDING_APPROVED_CHROMA_COLLECTION
        primary_doc = self._extract_primary_doc(result)
        updates = {
            "reviewed_at": self._now_iso(),
            "reviewed_by": actor_name,
            "approved_document_id": result.get("document_id") or primary_doc.get("document_id"),
            "approved_version_id": result.get("version_id") or primary_doc.get("version_id"),
            "approved_ingest_job_id": result.get("ingest_job_id"),
            "approved_chroma_collection": PENDING_APPROVED_CHROMA_COLLECTION,
            "approve_result": result,
        }
        approved = self._repository.mark_approved(pending_id, updates)
        return {
            "status": "ok",
            "action": self._resolve_action(result),
            "pending_id": pending_id,
            "approved_document_id": approved.get("approved_document_id"),
            "approved_version_id": approved.get("approved_version_id"),
            "approved_ingest_job_id": approved.get("approved_ingest_job_id"),
            "approved_chroma_collection": approved.get("approved_chroma_collection"),
            "approve_result": result,
            "message": "Pending ingest approved and committed to RAG",
        }

    def reject_pending(
        self,
        pending_id: str,
        reason: str,
        actor: str | dict[str, Any] | None,
    ) -> dict[str, Any]:
        self.get_pending(pending_id)
        actor_name = self._actor_to_string(actor)
        updated = self._repository.mark_rejected(pending_id, reason, actor_name)
        return {
            "status": "ok",
            "action": "rejected",
            "pending_id": pending_id,
            "reject_reason": updated.get("reject_reason"),
            "message": "Pending ingest rejected",
        }

    def _approve_web(self, item: dict[str, Any], actor: str) -> dict[str, Any]:
        url = _stringify(item.get("url"))
        if not url:
            raise HTTPException(status_code=400, detail="Pending ingest does not have url")

        payload = self._payload_for_ingest(item)
        if _stringify(payload.get("extract_mode")) == "skds_disease_article":
            hydrated = self._hydrate_pending_content(item)
            return self._orchestrator.ingest_pending_web_chunks(
                url=url,
                chunks_json_path=_stringify(hydrated.get("chunks_path")),
                extracted_text=hydrated.get("extracted_text") or "",
                document_title=(
                    _stringify(payload.get("article_title"))
                    or _stringify(item.get("article_title"))
                    or _stringify(item.get("title"))
                    or url
                ),
                ingest_metadata=PendingWebIngestRequest(
                    url=url,
                    limit=1,
                    domain=payload.get("domain") or "health",
                    topic=payload.get("topic") or "disease",
                    priority=payload.get("priority") or "normal",
                    status="active",
                    visibility=payload.get("visibility") or "public",
                    source_type=payload.get("source_type") or "Web",
                    created_by=actor,
                ),
                actor=actor,
                chroma_collection_override=PENDING_APPROVED_CHROMA_COLLECTION,
                extra_metadata=self._chunk_metadata(payload),
            )

        req = PendingWebIngestRequest(
            url=url,
            limit=1,
            domain=payload.get("domain") or "health",
            topic=payload.get("topic") or "disease",
            priority=payload.get("priority") or "normal",
            status="active",
            visibility=payload.get("visibility") or "public",
            source_type=payload.get("source_type") or "Web",
            created_by=actor,
        )
        ingest_kwargs = {
            "url": url,
            "limit": 1,
            "ingest_metadata": req,
            "actor": actor,
            "data_type_resolver": (
                lambda web_type: "web_news" if web_type == "news" else f"web_{web_type}"
            ),
            "include_web_type": True,
            "include_outputs": True,
            "chroma_collection_override": PENDING_APPROVED_CHROMA_COLLECTION,
        }

        with patch.object(
            ingest_orchestration_module,
            "crawl_article_links_optimized",
            side_effect=lambda target_url, limit=1: [target_url],
        ):
            return self._orchestrator.ingest_web(**ingest_kwargs)

    def _approve_pdf_url(self, item: dict[str, Any], actor: str) -> dict[str, Any]:
        pdf_url = _stringify(item.get("pdf_url"))
        if not pdf_url:
            raise HTTPException(status_code=400, detail="Pending ingest does not have pdf_url")

        file_bytes, filename, _content_type = self._download_pdf(pdf_url)
        payload = self._payload_for_ingest(item)
        req = PendingPdfUrlIngestRequest(
            pdf_url=pdf_url,
            domain=payload.get("domain") or "health",
            topic=payload.get("topic") or "disease",
            priority=payload.get("priority") or "normal",
            status="active",
            visibility=payload.get("visibility") or "public",
            source_type=payload.get("source_type") or "PDF",
            created_by=actor,
        )
        chunks_path = _stringify(item.get("chunks_path"))
        if chunks_path and Path(chunks_path).exists():
            hydrated = self._hydrate_pending_content(item)
            document_name = (
                _stringify(item.get("title"))
                or _stringify(payload.get("title"))
                or filename
            )
            return self._orchestrator.ingest_pending_pdf_chunks(
                file_bytes=file_bytes,
                filename=document_name,
                chunks_json_path=chunks_path,
                extracted_text=hydrated.get("extracted_text") or "",
                pdf_url=pdf_url,
                ingest_metadata=req,
                actor=actor,
                chroma_collection_override=PENDING_APPROVED_CHROMA_COLLECTION,
            )

        return self._orchestrator.ingest_pdf(
            file_bytes=file_bytes,
            filename=filename,
            ingest_metadata=req,
            actor=actor,
            upload_dir="data/uploads/pdf",
            include_filename=True,
            include_collection=True,
            include_processing_time=True,
            allow_duplicates=False,
            chroma_collection_override=PENDING_APPROVED_CHROMA_COLLECTION,
        )

    def _create_preview_item(
        self,
        normalized: dict[str, Any],
        actor: str | dict[str, Any] | None,
        *,
        extracted_text: str,
        chunks: list[dict[str, Any]],
        status: str,
        preview_error: Optional[str] = None,
    ) -> dict[str, Any]:
        pending_id = str(normalized.get("id") or uuid.uuid4())
        extracted_text_path, chunks_path = self._write_pending_content_files(
            pending_id,
            extracted_text or "",
            chunks or [],
        )
        item = dict(normalized)
        item.update(
            {
                "id": pending_id,
                "status": status,
                "preview_error": preview_error,
                "extracted_text_preview": self._preview_text(extracted_text or ""),
                "text_length": len(extracted_text or ""),
                "chunks_preview": self._preview_chunks(chunks or []),
                "chunk_count": len(chunks),
                "extracted_text_path": extracted_text_path,
                "chunks_path": chunks_path,
                "storage_mode": "local_file",
                "created_by": self._actor_to_string(actor),
                "original_payload": dict(normalized.get("original_payload") or normalized),
            }
        )
        return self._repository.create_pending_ingest(item)

    def _write_pending_content_files(
        self,
        pending_id: str,
        extracted_text: str,
        chunks: list[dict[str, Any]],
    ) -> tuple[str, str]:
        pending_dir = PENDING_STORAGE_ROOT / pending_id
        pending_dir.mkdir(parents=True, exist_ok=True)
        text_path = pending_dir / "extracted_text.txt"
        chunks_path = pending_dir / "chunks.json"
        text_path.write_text(extracted_text or "", encoding="utf-8")
        chunks_path.write_text(
            json.dumps(chunks or [], ensure_ascii=False, default=str),
            encoding="utf-8",
        )
        return str(text_path), str(chunks_path)

    def _preview_text(self, extracted_text: str) -> str:
        return (extracted_text or "")[:MAX_EXTRACTED_TEXT_PREVIEW_CHARS]

    def _preview_chunks(self, chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
        preview: list[dict[str, Any]] = []
        for chunk in (chunks or [])[:MAX_CHUNKS_PREVIEW_COUNT]:
            item = dict(chunk or {})
            item["text"] = (item.get("text") or "")[:MAX_CHUNK_PREVIEW_TEXT_CHARS]
            preview.append(item)
        return preview

    def _hydrate_pending_content(self, item: dict[str, Any]) -> dict[str, Any]:
        hydrated = dict(item or {})
        extracted_text = hydrated.get("extracted_text")
        if extracted_text is None:
            extracted_text = self._read_text_file(hydrated.get("extracted_text_path"))
        if extracted_text is None:
            extracted_text = hydrated.get("extracted_text_preview") or ""

        chunks = hydrated.get("chunks")
        if chunks is None:
            chunks = self._read_chunks_file(hydrated.get("chunks_path"))
        if chunks is None:
            chunks = hydrated.get("chunks_preview") or []

        hydrated["extracted_text"] = extracted_text or ""
        hydrated["chunks"] = chunks or []
        return hydrated

    def _read_text_file(self, path_value: Any) -> Optional[str]:
        path = self._safe_local_path(path_value)
        if path is None or not path.exists() or not path.is_file():
            return None
        return path.read_text(encoding="utf-8")

    def _read_chunks_file(self, path_value: Any) -> Optional[list[dict[str, Any]]]:
        path = self._safe_local_path(path_value)
        if path is None or not path.exists() or not path.is_file():
            return None
        data = json.loads(path.read_text(encoding="utf-8") or "[]")
        return data if isinstance(data, list) else []

    def _safe_local_path(self, path_value: Any) -> Optional[Path]:
        raw = _stringify(path_value)
        if not raw:
            return None
        path = Path(raw)
        try:
            resolved_path = path.resolve()
            resolved_root = PENDING_STORAGE_ROOT.resolve()
            if resolved_root not in resolved_path.parents and resolved_path != resolved_root:
                return None
        except Exception:
            return None
        return path

    def _find_existing_preview(self, normalized: dict[str, Any]) -> Optional[dict[str, Any]]:
        source_kind = _stringify(normalized.get("source_kind")) or "html_page"
        locator_field = "pdf_url" if source_kind == "pdf_url" else "url"
        existing = self._repository.find_existing_preview(
            source_id=_stringify(normalized.get("source_id")),
            source_kind=source_kind,
            locator_value=_stringify(normalized.get(locator_field)),
            corpus=_stringify(normalized.get("corpus")) or "disease_core",
            content_subtype=_stringify(normalized.get("content_subtype")),
            statuses=["pending", "approved"],
        )
        if not existing:
            return None

        status = _stringify(existing.get("status")).lower()
        if status == "pending":
            action = "pending_exists"
            message = "Pending ingest already exists"
        elif status == "approved":
            action = "already_approved"
            message = "Pending ingest already approved"
        else:
            return None

        item = dict(existing)
        item["_preview_action"] = action
        item["_preview_status"] = "ok"
        item["_preview_message"] = message
        return item

    def _normalize_payload(self, payload: dict[str, Any], *, default_source_kind: str) -> dict[str, Any]:
        raw = dict(payload or {})
        source_id = _stringify(raw.get("source_id")) or self._fallback_source_id(raw)
        corpus = _stringify(raw.get("corpus")) or "disease_core"
        source_kind = _stringify(raw.get("source_kind")) or default_source_kind
        content_subtype = _stringify(raw.get("content_subtype")) or (
            "disease_pdf" if source_kind.startswith("pdf") else "disease_reference"
        )
        normalized = {
            "source_id": source_id,
            "source_name": raw.get("source_name"),
            "source_type": raw.get("source_type"),
            "source_kind": source_kind,
            "corpus": corpus,
            "content_subtype": content_subtype,
            "url": raw.get("url"),
            "pdf_url": raw.get("pdf_url"),
            "title": raw.get("title"),
            "article_title": raw.get("article_title"),
            "disease_name": raw.get("disease_name"),
            "canonical_key": raw.get("canonical_key"),
            "disease_topic_url": raw.get("disease_topic_url"),
            "description": raw.get("description"),
            "published_at": raw.get("published_at"),
            "updated_at": raw.get("updated_at"),
            "topic": raw.get("topic"),
            "region": raw.get("region"),
            "domain": raw.get("domain"),
            "doi": raw.get("doi"),
            "pmid": raw.get("pmid"),
            "raw_source": raw.get("raw_source"),
            "extract_mode": raw.get("extract_mode"),
            "phase": raw.get("phase"),
            "candidate_index": raw.get("candidate_index"),
            "original_payload": raw,
        }
        return normalized

    def _payload_for_ingest(self, item: dict[str, Any]) -> dict[str, Any]:
        payload = dict(item.get("original_payload") or {})
        for key in (
            "source_id",
            "source_name",
            "source_type",
            "source_kind",
            "corpus",
            "content_subtype",
            "url",
            "pdf_url",
            "title",
            "article_title",
            "disease_name",
            "canonical_key",
            "disease_topic_url",
            "topic",
            "region",
            "domain",
            "doi",
            "pmid",
            "phase",
            "candidate_index",
            "raw_source",
            "extract_mode",
            "published_at",
            "updated_at",
            "description",
        ):
            payload.setdefault(key, item.get(key))
        return payload

    def _fallback_source_id(self, payload: dict[str, Any]) -> str:
        locator = _stringify(payload.get("url")) or _stringify(payload.get("pdf_url")) or "pending"
        digest = hashlib.sha1(locator.encode("utf-8")).hexdigest()[:12]
        return f"pending_{digest}"

    def _chunk_metadata(self, payload: dict[str, Any]) -> dict[str, Any]:
        return {
            "source_id": payload.get("source_id"),
            "source_name": payload.get("source_name"),
            "source_type": payload.get("source_type"),
            "source_kind": payload.get("source_kind"),
            "url": payload.get("url"),
            "pdf_url": payload.get("pdf_url"),
            "title": payload.get("title"),
            "article_title": payload.get("article_title"),
            "disease_name": payload.get("disease_name"),
            "canonical_key": payload.get("canonical_key"),
            "disease_topic_url": payload.get("disease_topic_url"),
            "content_subtype": payload.get("content_subtype"),
            "corpus": payload.get("corpus"),
            "raw_source": payload.get("raw_source"),
            "extract_mode": payload.get("extract_mode"),
            "published_at": payload.get("published_at"),
            "updated_at": payload.get("updated_at"),
            "phase": payload.get("phase"),
            "candidate_index": payload.get("candidate_index"),
        }

    def _extract_web_text(self, html_or_text: str, payload: dict[str, Any]) -> dict[str, Any]:
        if _stringify(payload.get("extract_mode")) == "skds_disease_article":
            fallback_title = (
                _stringify(payload.get("article_title"))
                or _stringify(payload.get("title"))
                or _stringify(payload.get("disease_name"))
            )
            return extract_skds_disease_article(
                html_or_text,
                url=_stringify(payload.get("url")),
                fallback_title=fallback_title,
            )
        text = self._extract_text_from_html(html_or_text)
        return {
            "title": _stringify(payload.get("title")),
            "text": text,
            "url": _stringify(payload.get("url")),
            "text_length": len(text),
        }

    def _extract_text_from_html(self, html: str) -> str:
        soup = BeautifulSoup(html or "", "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "aside", "noscript", "header"]):
            tag.decompose()

        title = soup.find("title")
        main = soup.find("main") or soup.find("article") or soup.body or soup
        parts = []
        if title:
            parts.append(title.get_text(" ", strip=True))
        parts.append(main.get_text("\n", strip=True))
        text = "\n".join(part for part in parts if part)
        return re.sub(r"\n{3,}", "\n\n", text).strip()

    def _chunk_text(
        self,
        text: str,
        *,
        chunk_size: int = 1600,
        overlap: int = 200,
        metadata: Optional[dict[str, Any]] = None,
    ) -> list[dict[str, Any]]:
        clean_text = (text or "").strip()
        if not clean_text:
            return []
        if chunk_size <= overlap:
            raise ValueError("chunk_size must be greater than overlap")

        chunks: list[dict[str, Any]] = []
        start = 0
        text_length = len(clean_text)
        while start < text_length:
            end = min(start + chunk_size, text_length)
            if end < text_length:
                split_window = clean_text[start:end]
                split_at = max(split_window.rfind("\n\n"), split_window.rfind(". "), split_window.rfind("\n"))
                if split_at >= max(200, chunk_size // 2):
                    end = start + split_at + 1
            chunk_text = clean_text[start:end].strip()
            if chunk_text and (len(chunk_text) >= 50 or text_length < 50):
                chunks.append(
                    {
                        "chunk_index": len(chunks),
                        "text": chunk_text,
                        "length": len(chunk_text),
                        "metadata": dict(metadata or {}),
                    }
                )
            if end >= text_length:
                break
            start = max(end - overlap, start + 1)
        return chunks

    def _download_pdf(self, pdf_url: str) -> tuple[bytes, str, str]:
        response = None
        try:
            response = requests.get(
                pdf_url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; ChatTraCuuBenhBot/1.0)"},
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
            filename = self._build_stable_pdf_filename(pdf_url, content_disposition)
            looks_like_pdf = (
                self._is_pdf_content_type(content_type)
                or filename.lower().endswith(".pdf")
                or pdf_url.lower().split("?", 1)[0].endswith(".pdf")
            )
            if not looks_like_pdf:
                raise HTTPException(status_code=400, detail="Remote URL does not look like a PDF")

            content_length = response.headers.get("Content-Length")
            if content_length and int(content_length) > MAX_FILE_SIZE_BYTES:
                size_mb = int(content_length) / (1024 * 1024)
                raise HTTPException(
                    status_code=400,
                    detail=f"File too large ({size_mb:.2f}MB). Max is {MAX_FILE_SIZE_MB}MB",
                )

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
            if not file_bytes.startswith(b"%PDF") and not self._is_pdf_content_type(content_type):
                raise HTTPException(status_code=400, detail="Remote URL does not look like a PDF")
            return file_bytes, filename, content_type
        finally:
            if response is not None:
                response.close()

    def _extract_pdf_pages(self, file_bytes: bytes) -> list[PdfPageText]:
        if PdfReader is None:
            raise RuntimeError("pypdf is not installed; PDF preview extraction is unavailable")
        reader = PdfReader(BytesIO(file_bytes))
        pages: list[PdfPageText] = []
        for index, page in enumerate(reader.pages):
            page_text = (page.extract_text() or "").strip()
            if page_text:
                pages.append(PdfPageText(page_number=index + 1, text=page_text))
        if not pages:
            raise RuntimeError("PDF has no extractable text")
        return pages

    def _join_pdf_pages(self, pages: list[PdfPageText]) -> str:
        return "\n\n".join(page.text for page in pages if page.text.strip()).strip()

    def _chunk_pdf_pages(
        self,
        pages: list[PdfPageText],
        *,
        chunk_size: int = 1600,
        overlap: int = 200,
        metadata: Optional[dict[str, Any]] = None,
    ) -> list[dict[str, Any]]:
        full_text = ""
        page_map: list[dict[str, int]] = []
        for page in pages:
            clean_text = (page.text or "").strip()
            if not clean_text:
                continue
            if full_text:
                full_text += "\n\n"
            start = len(full_text)
            full_text += clean_text
            page_map.append({"page_number": page.page_number, "start": start, "end": len(full_text)})

        base_chunks = self._chunk_text(full_text, chunk_size=chunk_size, overlap=overlap, metadata=metadata)
        chunks: list[dict[str, Any]] = []
        search_start = 0
        for base_chunk in base_chunks:
            text = base_chunk.get("text") or ""
            chunk_start = full_text.find(text, search_start)
            if chunk_start < 0:
                chunk_start = search_start
            chunk_end = chunk_start + len(text)
            search_start = max(chunk_end - overlap, chunk_start + 1)
            page_numbers = [
                page["page_number"]
                for page in page_map
                if not (chunk_end <= page["start"] or chunk_start >= page["end"])
            ]
            if not page_numbers and page_map:
                page_numbers = [page_map[0]["page_number"]]
            page_start = min(page_numbers) if page_numbers else None
            page_end = max(page_numbers) if page_numbers else None
            page_numbers_text = ",".join(str(page_number) for page_number in page_numbers)
            chunk_index = int(base_chunk.get("chunk_index") or len(chunks))
            chunk_metadata = dict(base_chunk.get("metadata") or {})
            chunk_metadata.update(
                {
                    "chunk_index": chunk_index,
                    "page_start": page_start,
                    "page_end": page_end,
                    "page_numbers": page_numbers_text,
                    "doc_type": "pdf",
                }
            )
            chunks.append(
                {
                    "chunk_index": chunk_index,
                    "text": text,
                    "length": len(text),
                    "page_start": page_start,
                    "page_end": page_end,
                    "page_numbers": page_numbers_text,
                    "doc_type": "pdf",
                    "data_type": "pdf",
                    "metadata": chunk_metadata,
                }
            )
        return chunks

    def _extract_text_from_pdf(self, file_bytes: bytes, filename: str) -> str:
        if PdfReader is None:
            raise RuntimeError("pypdf is not installed; PDF preview extraction is unavailable")
        del filename
        reader = PdfReader(BytesIO(file_bytes))
        pages = []
        for page in reader.pages:
            page_text = page.extract_text() or ""
            if page_text.strip():
                pages.append(page_text.strip())
        text = "\n\n".join(pages).strip()
        if not text:
            raise RuntimeError("PDF has no extractable text")
        return text

    def _is_pdf_content_type(self, content_type: str) -> bool:
        normalized = _stringify(content_type).lower()
        return bool(normalized and any(pdf_type in normalized for pdf_type in PDF_CONTENT_TYPES))

    def _sanitize_filename(self, value: str, fallback: str = "download") -> str:
        normalized = FILENAME_SANITIZER.sub("_", _stringify(value)).strip("._")
        return normalized or fallback

    def _extract_disposition_filename(self, content_disposition: str) -> str:
        match = CONTENT_DISPOSITION_FILENAME.search(content_disposition or "")
        if not match:
            return ""
        return unquote(match.group(1)).strip().strip('"')

    def _build_stable_pdf_filename(self, pdf_url: str, content_disposition: str) -> str:
        parsed = urlparse(pdf_url)
        raw_name = self._extract_disposition_filename(content_disposition) or os.path.basename(unquote(parsed.path))
        basename = self._sanitize_filename(raw_name, fallback="download")
        if basename.lower().endswith(".pdf"):
            basename = basename[:-4]
        host = self._sanitize_filename(parsed.netloc, fallback="pdf")
        url_hash = hashlib.sha1(pdf_url.encode("utf-8")).hexdigest()[:12]
        return f"{host}_{basename or 'download'}_{url_hash}.pdf"

    def _resolve_action(self, result: dict[str, Any]) -> str:
        action = _stringify(result.get("action")).lower()
        if action in VALID_INGEST_ACTIONS:
            return action
        for document in result.get("documents") or []:
            if isinstance(document, dict):
                document_action = _stringify(document.get("action")).lower()
                if document_action in VALID_INGEST_ACTIONS:
                    return document_action
        if int(result.get("updated") or 0) > 0:
            return "updated"
        if int(result.get("created") or 0) > 0:
            return "created"
        if int(result.get("skipped") or 0) > 0:
            return "skipped"
        return "failed"

    def _extract_primary_doc(self, result: dict[str, Any]) -> dict[str, Any]:
        for document in result.get("documents") or []:
            if isinstance(document, dict):
                return document
        return {}

    def _actor_to_string(self, actor: str | dict[str, Any] | None) -> Optional[str]:
        if actor is None:
            return None
        if isinstance(actor, str):
            return actor
        return (
            _stringify(actor.get("uid"))
            or _stringify(actor.get("user_id"))
            or _stringify(actor.get("email"))
            or _stringify(actor.get("service"))
            or None
        )

    def _now_iso(self) -> str:
        return datetime.now(timezone.utc).isoformat()
