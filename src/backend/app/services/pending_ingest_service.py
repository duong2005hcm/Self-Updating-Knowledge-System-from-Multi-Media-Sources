from __future__ import annotations

import json
import logging
import os
import re
import shutil
import uuid
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import unquote, urlparse

import requests

from backend.app.models.pending_ingest import PendingIngest
from backend.app.rag.chunking.pdf.pdf_chunker import process_single_pdf
from backend.app.rag.chunking.web.chunker import chunk_text
from backend.app.rag.chunking.web.fetch_web import fetch_html
from backend.app.rag.chunking.web.html_clean import clean_docs, clean_ecommerce, clean_news
from backend.app.rag.chunking.web.web_classifiers import classify_web
from backend.app.rag.ingestion.embedding_store import embed_and_store_chunks
from backend.app.repositories.pending_ingest_repository import PendingIngestRepository
from backend.app.schemas.pending_ingest import N8nPendingPreviewRequest
from backend.app.services.checksum_service import canonicalize_url, checksum_text
from backend.app.services.document_service import DocumentService
from backend.app.services.ingest_job_service import IngestJobService
from backend.app.services.metadata_mapper import build_chunk_metadata, build_ingest_context

logger = logging.getLogger(__name__)

PENDING_STORAGE_DIR = os.getenv("PENDING_INGEST_STORAGE_DIR", "data/pending_ingests")
MAX_FILE_SIZE_MB = int(os.getenv("PENDING_INGEST_MAX_FILE_SIZE_MB", "30"))
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
PDF_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}
FILENAME_SANITIZER = re.compile(r"[^A-Za-z0-9._-]+")
CONTENT_DISPOSITION_FILENAME = re.compile(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)"?')


class PendingIngestNotFoundError(Exception):
    pass


class PendingIngestInvalidError(Exception):
    pass


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _trim(value: str, max_chars: int) -> str:
    text = " ".join((value or "").split())
    if len(text) <= max_chars:
        return text
    return text[: max(0, max_chars - 3)].rstrip() + "..."


def _model_dump(model: Any) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    if hasattr(model, "dict"):
        return model.dict()
    return dict(model or {})


def _stable_pending_id(payload: dict[str, Any], locator: str) -> str:
    key = "|".join(
        [
            _stringify(payload.get("source_id")) or "unknown",
            canonicalize_url(locator) or locator,
            _stringify(payload.get("corpus")),
            _stringify(payload.get("content_subtype")),
        ]
    )
    return f"pend_{uuid.uuid5(uuid.NAMESPACE_URL, key).hex}"


def _safe_filename(value: str, fallback: str = "download") -> str:
    normalized = FILENAME_SANITIZER.sub("_", _stringify(value)).strip("._")
    return normalized or fallback


def _extract_disposition_filename(content_disposition: str) -> str:
    match = CONTENT_DISPOSITION_FILENAME.search(content_disposition or "")
    if not match:
        return ""
    return unquote(match.group(1)).strip().strip('"')


def _looks_like_pdf(content_type: str, filename: str, url: str) -> bool:
    normalized_type = _stringify(content_type).lower()
    return (
        any(pdf_type in normalized_type for pdf_type in PDF_CONTENT_TYPES)
        or filename.lower().endswith(".pdf")
        or url.lower().split("?", 1)[0].endswith(".pdf")
    )


def _plain_text_from_html(html: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", html or "")
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


class PendingIngestService:
    def __init__(
        self,
        *,
        repository: Optional[PendingIngestRepository] = None,
        document_service: Optional[DocumentService] = None,
        ingest_job_service: Optional[IngestJobService] = None,
    ):
        self._repository = repository or PendingIngestRepository()
        self._document_service = document_service or DocumentService()
        self._ingest_job_service = ingest_job_service or IngestJobService()

    def create_web_preview(self, request: N8nPendingPreviewRequest) -> dict[str, Any]:
        return self._create_preview(request, source_kind="html_page")

    def create_pdf_url_preview(self, request: N8nPendingPreviewRequest) -> dict[str, Any]:
        return self._create_preview(request, source_kind="pdf_url")

    def list_pending(
        self,
        *,
        limit: int = 50,
        status: Optional[str] = None,
        source_id: Optional[str] = None,
        corpus: Optional[str] = None,
        content_subtype: Optional[str] = None,
    ) -> list[PendingIngest]:
        return self._repository.list_pending(
            limit=limit,
            status=status,
            source_id=source_id,
            corpus=corpus,
            content_subtype=content_subtype,
        )

    def get_pending(self, pending_id: str) -> PendingIngest:
        item = self._repository.get_pending_by_id(pending_id)
        if item is None:
            raise PendingIngestNotFoundError(f"Pending ingest not found: {pending_id}")
        return item

    def get_pending_detail(self, pending_id: str) -> tuple[PendingIngest, str, list[dict[str, Any]]]:
        item = self.get_pending(pending_id)
        return item, self._read_text_file(item.extracted_text_path), self._read_chunks_file(item.chunks_path)

    def reject_pending(self, *, pending_id: str, reviewed_by: str, reason: Optional[str] = None) -> PendingIngest:
        item = self._repository.reject_pending(
            pending_id,
            reviewed_by=reviewed_by,
            reason=reason,
        )
        if item is None:
            raise PendingIngestNotFoundError(f"Pending ingest not found: {pending_id}")
        return item

    def approve_pending(
        self,
        *,
        pending_id: str,
        reviewed_by: str,
        note: Optional[str] = None,
    ) -> dict[str, Any]:
        pending = self.get_pending(pending_id)

        if pending.status == "approved" and pending.approved_document_id and pending.approved_version_id:
            return {
                "status": "ok",
                "action": "skipped",
                "pending_id": pending.pending_id,
                "document_id": pending.approved_document_id,
                "version_id": pending.approved_version_id,
                "ingest_job_id": pending.ingest_job_id,
                "chunks_inserted": 0,
                "collections": [],
                "chroma_collection_override": self._collection_override_for_pending(pending),
                "message": "Pending ingest was already approved.",
            }

        chunks = self._read_chunks_file(pending.chunks_path)
        if not chunks:
            raise PendingIngestInvalidError(
                f"Pending ingest has no chunks to approve. "
                f"chunks_path={pending.chunks_path!r}, "
                f"exists={os.path.exists(pending.chunks_path or '')}"
            )

        extracted_text = self._read_text_file(pending.extracted_text_path)
        if not extracted_text:
            extracted_text = "\n\n".join(_stringify(chunk.get("text")) for chunk in chunks).strip()

        effective_checksum = pending.checksum or (checksum_text(extracted_text) if extracted_text else "")

        source_type = self._source_type(pending)
        source_locator = self._source_locator(pending)
        if not source_locator:
            raise PendingIngestInvalidError("Pending ingest has no source URL")

        source_locator = canonicalize_url(source_locator) if source_type.lower() == "web" else source_locator
        document_identifier = source_locator
        title = pending.title or pending.source_name or source_locator
        domain = pending.domain or pending.region or "general"
        topic = pending.topic or pending.content_subtype or "general"
        actor = _stringify(reviewed_by) or "admin"

        computed_source_id = self._document_service.compute_source_id(
            source_type=source_type,
            source_locator=source_locator,
        )
        job = self._ingest_job_service.start_job(source_id=computed_source_id)
        job_id = job.id

        try:
            sync_result = self._document_service.sync_document_version(
                source_type=source_type,
                source_locator=source_locator,
                document_identifier=document_identifier,
                title=title,
                created_by=actor,
                domain=domain,
                topic=topic,
                priority="normal",
                visibility="public",
                status="active",
                checksum=effective_checksum,
                ingest_job_id=job_id,
            )

            self._document_service.update_version_artifacts(
                version_id=sync_result.version_id,
                raw_path=pending.raw_path,
                raw_filename=os.path.basename(pending.raw_path) if pending.raw_path else None,
                mime_type="application/pdf" if source_type.lower() == "pdf" else "text/html",
                source_url=source_locator,
                extracted_text=extracted_text,
            )

            embed_result = self._embed_pending_chunks(
                pending=pending,
                source_type=source_type,
                source_locator=source_locator,
                title=title,
                domain=domain,
                topic=topic,
                actor=actor,
                job_id=job_id,
                checksum=effective_checksum,
                sync_result=sync_result,
            )

            created_count = 1 if sync_result.action == "created" else 0
            updated_count = 1 if sync_result.action == "updated" else 0
            skipped_count = 1 if sync_result.action == "skipped" else 0

            self._ingest_job_service.increment_counters(
                job_id,
                processed_count=1,
                created_count=created_count,
                updated_count=updated_count,
                skipped_count=skipped_count,
            )
            self._document_service.touch_source_last_sync(
                source_type=source_type,
                source_locator=source_locator,
                source_name=pending.source_name or title,
                domain=domain,
                created_by=actor,
            )
            self._ingest_job_service.finish_job(job_id)

            self._repository.approve_pending(
                pending.pending_id,
                reviewed_by=actor,
                note=note,
                approved_document_id=sync_result.document_id,
                approved_version_id=sync_result.version_id,
                ingest_job_id=job_id,
            )

            chunks_inserted = int(embed_result.get("inserted", 0) or 0)
            collections = embed_result.get("collections") or []
            collection_override = self._collection_override_for_pending(pending)

            if sync_result.action == "skipped":
                message = (
                    f"Content unchanged; checked/recovered Chroma embedding. "
                    f"Inserted {chunks_inserted} chunk(s)."
                )
            else:
                message = f"Approved pending ingest and stored {chunks_inserted} chunk(s)."

            logger.info(
                "Approved pending ingest: pending_id=%s source_kind=%s sync_action=%s "
                "chunks_path=%s chunk_count=%s data_type=%s collection_override=%s "
                "collections=%s inserted=%s",
                pending.pending_id,
                pending.source_kind,
                sync_result.action,
                pending.chunks_path,
                pending.chunk_count,
                self._data_type_for_pending(pending),
                collection_override,
                collections,
                chunks_inserted,
            )

            return {
                "status": "ok",
                "action": sync_result.action,
                "pending_id": pending.pending_id,
                "document_id": sync_result.document_id,
                "version_id": sync_result.version_id,
                "ingest_job_id": job_id,
                "chunks_inserted": chunks_inserted,
                "collections": collections,
                "chroma_collection_override": collection_override,
                "message": message,
            }
        except Exception:
            try:
                self._ingest_job_service.fail_job(job_id, "Pending ingest approval failed")
            except Exception:
                logger.exception("Failed to mark pending approval job as failed: %s", job_id)
            raise

    def _create_preview(self, request: N8nPendingPreviewRequest, *, source_kind: str) -> dict[str, Any]:
        payload = _model_dump(request)
        payload["source_kind"] = source_kind

        locator = _stringify(payload.get("pdf_url") if source_kind == "pdf_url" else payload.get("url"))
        if not locator:
            raise PendingIngestInvalidError(
                "pdf_url is required" if source_kind == "pdf_url" else "url is required"
            )

        pending_id = _stable_pending_id(payload, locator)
        pending_dir = os.path.join(PENDING_STORAGE_DIR, pending_id)
        os.makedirs(pending_dir, exist_ok=True)

        logger.info(
            "Creating pending preview: pending_id=%s source_kind=%s source_id=%s locator=%s",
            pending_id,
            source_kind,
            payload.get("source_id"),
            locator,
        )

        if source_kind == "pdf_url":
            extracted_text, chunks, raw_path = self._extract_pdf_url(locator, pending_dir)
        else:
            extracted_text, chunks, raw_path = self._extract_web(locator, payload=payload)

        if not extracted_text.strip():
            raise PendingIngestInvalidError("No extractable text found")
        if not chunks:
            raise PendingIngestInvalidError("No chunks were generated")

        checksum = checksum_text(extracted_text)
        extracted_text_path = os.path.join(pending_dir, "extracted_text.txt")
        chunks_path = os.path.join(pending_dir, "chunks.json")
        self._write_text_file(extracted_text_path, extracted_text)
        self._write_chunks_file(chunks_path, chunks)

        collection_override = (
            _stringify(payload.get("chroma_collection_override"))
            or ("rag_web_pdf" if _stringify(payload.get("corpus")) == "disease_core" else "")
            or None
        )

        item = PendingIngest.create(
            pending_id=pending_id,
            source_id=_stringify(payload.get("source_id")),
            source_name=_stringify(payload.get("source_name")) or None,
            corpus=_stringify(payload.get("corpus")) or None,
            content_subtype=_stringify(payload.get("content_subtype")) or None,
            source_kind=source_kind,
            url=canonicalize_url(_stringify(payload.get("url"))) or _stringify(payload.get("url")) or None,
            pdf_url=_stringify(payload.get("pdf_url")) or None,
            title=_stringify(payload.get("title")) or None,
            description=_stringify(payload.get("description")) or None,
            published_at=_stringify(payload.get("published_at")) or None,
            updated_at=_stringify(payload.get("updated_at")) or None,
            topic=_stringify(payload.get("topic")) or None,
            region=_stringify(payload.get("region")) or None,
            domain=_stringify(payload.get("domain")) or None,
            doi=_stringify(payload.get("doi")) or None,
            pmid=_stringify(payload.get("pmid")) or None,
            disease_name=_stringify(payload.get("disease_name")) or None,
            canonical_key=_stringify(payload.get("canonical_key")) or None,
            raw_source=_stringify(payload.get("raw_source")) or None,
            phase=_stringify(payload.get("phase")) or None,
            candidate_index=self._optional_int(payload.get("candidate_index")),
            extract_mode=_stringify(payload.get("extract_mode")) or None,
            article_title=_stringify(payload.get("article_title")) or None,
            parent_topic_title=_stringify(payload.get("parent_topic_title")) or None,
            disease_topic_url=_stringify(payload.get("disease_topic_url")) or None,
            category=_stringify(payload.get("category")) or None,
            chroma_collection_override=collection_override,
            checksum=checksum,
            extracted_text_preview=_trim(extracted_text, 1200),
            chunks_preview=self._build_chunks_preview(chunks),
            chunk_count=len(chunks),
            extracted_text_path=extracted_text_path,
            chunks_path=chunks_path,
            raw_path=raw_path,
        )

        logger.info(
            "Writing pending ingest to Firestore: pending_id=%s chunks_path=%s extracted_text_path=%s",
            pending_id,
            chunks_path,
            extracted_text_path,
        )

        action, saved = self._repository.create_or_update_pending(item)

        logger.info(
            "Pending ingest saved: action=%s pending_id=%s",
            action,
            saved.pending_id,
        )

        return {
            "status": "ok",
            "action": action,
            "pending_id": saved.pending_id,
            "source_id": saved.source_id,
            "title": saved.title or saved.source_name or saved.url or saved.pdf_url,
            "url": saved.url or saved.pdf_url,
            "message": self._preview_message(action),
        }

    def _extract_web(
        self,
        url: str,
        *,
        payload: Optional[dict[str, Any]] = None,
    ) -> tuple[str, list[dict[str, Any]], Optional[str]]:
        payload = payload or {}
        canonical_url = canonicalize_url(url) or url
        html = fetch_html(url)
        web_type = classify_web(url)
        extract_mode = _stringify(payload.get("extract_mode"))
        fallback_title = _stringify(payload.get("title"))

        extracted_text = ""

        try:
            if extract_mode == "skds_disease_article":
                try:
                    from backend.app.services.extractors.skds_article_extractor import (
                        extract_skds_disease_article,
                    )

                    extracted = extract_skds_disease_article(
                        html_or_text=html,
                        url=canonical_url,
                        fallback_title=fallback_title,
                    )
                    extracted_text = _stringify(extracted.get("text"))
                except Exception:
                    logger.exception("SKDS extractor failed for %s; falling back to generic extractor", url)

            if not extracted_text:
                if web_type == "news":
                    extracted_text = clean_news(html)
                elif web_type == "ecommerce":
                    product = clean_ecommerce(html)
                    extracted_text = "\n".join(
                        part
                        for part in [
                            product.get("title", ""),
                            product.get("description", ""),
                        ]
                        if part
                    )
                else:
                    extracted_text = clean_docs(html)
        except Exception:
            logger.exception("HTML extractor failed for %s; falling back to plain text", url)

        if len((extracted_text or "").strip()) < 200:
            extracted_text = _plain_text_from_html(html)

        chunks = [
            {
                "id": f"chunk_{index}",
                "chunk_index": index,
                "source": canonical_url,
                "source_type": web_type,
                "url": canonical_url,
                "data_type": "web",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "text": chunk,
            }
            for index, chunk in enumerate(chunk_text(extracted_text, size=500, overlap=100))
            if _stringify(chunk)
        ]
        return extracted_text, chunks, None

    def _extract_pdf_url(self, pdf_url: str, pending_dir: str) -> tuple[str, list[dict[str, Any]], Optional[str]]:
        file_bytes, filename = self._download_pdf(pdf_url)
        raw_path = os.path.join(pending_dir, filename)

        with open(raw_path, "wb") as file_stream:
            file_stream.write(file_bytes)

        chunking_result = process_single_pdf(raw_path)
        chunks = self._read_chunks_file_unchecked(chunking_result.chunks_json_path)
        if not chunks:
            raise PendingIngestInvalidError("PDF chunker produced no chunks")

        for index, chunk in enumerate(chunks):
            chunk.setdefault("id", f"chunk_{index}")
            chunk.setdefault("chunk_index", index)
            chunk.setdefault("source", pdf_url)
            chunk.setdefault("url", pdf_url)
            chunk.setdefault("pdf_url", pdf_url)
            chunk["data_type"] = "pdf"

        try:
            generated_path = os.path.abspath(chunking_result.chunks_json_path)
            target_path = os.path.abspath(os.path.join(pending_dir, "chunker_output.json"))
            if generated_path != target_path:
                shutil.copyfile(generated_path, target_path)
        except Exception:
            logger.exception("Failed to preserve PDF chunker output for pending ingest")

        return chunking_result.extracted_text, chunks, raw_path

    def _download_pdf(self, pdf_url: str) -> tuple[bytes, str]:
        response = None
        try:
            response = requests.get(
                pdf_url,
                headers={"User-Agent": "Mozilla/5.0"},
                stream=True,
                timeout=(15, 60),
                allow_redirects=True,
            )
            response.raise_for_status()
        except requests.RequestException as exc:
            raise PendingIngestInvalidError(f"Failed to download PDF: {exc}") from exc

        try:
            content_type = _stringify(response.headers.get("Content-Type"))
            content_disposition = _stringify(response.headers.get("Content-Disposition"))
            raw_name = _extract_disposition_filename(content_disposition) or os.path.basename(
                unquote(urlparse(pdf_url).path)
            )
            basename = _safe_filename(raw_name, fallback="download")
            if not basename.lower().endswith(".pdf"):
                basename = f"{basename}.pdf"

            filename = f"{_safe_filename(urlparse(pdf_url).netloc, 'pdf')}_{basename}"

            if not _looks_like_pdf(content_type, filename, pdf_url):
                raise PendingIngestInvalidError("Remote URL does not look like a PDF")

            content_length = response.headers.get("Content-Length")
            if content_length:
                try:
                    if int(content_length) > MAX_FILE_SIZE_BYTES:
                        raise PendingIngestInvalidError(
                            f"File too large. Max is {MAX_FILE_SIZE_MB}MB"
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
                    raise PendingIngestInvalidError(
                        f"File too large. Max is {MAX_FILE_SIZE_MB}MB"
                    )
                chunks.append(chunk)

            file_bytes = b"".join(chunks)
            if not file_bytes:
                raise PendingIngestInvalidError("Downloaded PDF is empty")

            if not file_bytes.startswith(b"%PDF") and not _looks_like_pdf(content_type, filename, pdf_url):
                raise PendingIngestInvalidError("Downloaded file is not a valid PDF")

            return file_bytes, filename
        finally:
            if response is not None:
                response.close()

    def _embed_pending_chunks(
        self,
        *,
        pending: PendingIngest,
        source_type: str,
        source_locator: str,
        title: str,
        domain: str,
        topic: str,
        actor: str,
        job_id: str,
        checksum: str,
        sync_result,
    ) -> dict[str, Any]:
        ingest_context = build_ingest_context(
            source_type=source_type,
            source_name=pending.source_name or source_locator,
            source_locator=source_locator,
            document_title=title,
            domain=domain,
            topic=topic,
            priority="normal",
            visibility="public",
            status="active",
            created_by=actor,
            ingest_job_id=job_id,
            checksum=checksum,
            version_no=sync_result.version_no,
        )

        extra_metadata = build_chunk_metadata(
            ingest_context,
            extra={
                "source_id": sync_result.source_id,
                "document_id": sync_result.document_id,
                "version_id": sync_result.version_id,
                "ingest_job_id": job_id,
                "pending_id": pending.pending_id,
                "n8n_source_id": pending.source_id,
                "source_name": pending.source_name or pending.source_id,
                "corpus": pending.corpus or "",
                "content_subtype": pending.content_subtype or "",
                "source_kind": pending.source_kind,
                "url": pending.url or "",
                "pdf_url": pending.pdf_url or "",
                "title": pending.title or "",
                "article_title": getattr(pending, "article_title", None) or "",
                "parent_topic_title": getattr(pending, "parent_topic_title", None) or "",
                "disease_topic_url": getattr(pending, "disease_topic_url", None) or "",
                "category": getattr(pending, "category", None) or "",
                "published_at": pending.published_at or "",
                "updated_at": pending.updated_at or "",
                "region": pending.region or "",
                "doi": pending.doi or "",
                "pmid": pending.pmid or "",
                "disease_name": pending.disease_name or "",
                "canonical_key": pending.canonical_key or "",
                "raw_source": pending.raw_source or "",
                "phase": pending.phase or "",
                "candidate_index": pending.candidate_index if pending.candidate_index is not None else "",
                "extract_mode": pending.extract_mode or "",
            },
        )

        data_type = self._data_type_for_pending(pending)
        collection_override = self._collection_override_for_pending(pending)

        return embed_and_store_chunks(
            chunks_json_path=pending.chunks_path or "",
            allow_duplicates=False,
            data_type=data_type,
            extra_metadata=extra_metadata,
            chroma_collection_override=collection_override,
        )

    def _source_locator(self, pending: PendingIngest) -> str:
        return _stringify(pending.pdf_url if pending.source_kind == "pdf_url" else pending.url)

    def _source_type(self, pending: PendingIngest) -> str:
        return "PDF" if pending.source_kind == "pdf_url" else "Web"

    def _data_type_for_pending(self, pending: PendingIngest) -> str:
        return "pdf" if pending.source_kind == "pdf_url" else "web"

    def _collection_override_for_pending(self, pending: PendingIngest) -> Optional[str]:
        explicit = _stringify(getattr(pending, "chroma_collection_override", None))
        if explicit:
            return explicit

        if _stringify(pending.corpus) == "disease_core":
            return "rag_web_pdf"

        return None

    def _build_chunks_preview(self, chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
        preview: list[dict[str, Any]] = []

        for chunk in chunks[:3]:
            preview.append(
                {
                    "chunk_index": chunk.get("chunk_index"),
                    "text": _trim(_stringify(chunk.get("text")), 500),
                    "source": chunk.get("source") or chunk.get("url"),
                    "page_start": chunk.get("page_start"),
                    "page_end": chunk.get("page_end"),
                }
            )

        return preview

    def _optional_int(self, value: Any) -> Optional[int]:
        if value is None or value == "":
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _preview_message(self, action: str) -> str:
        if action == "pending_created":
            return "Pending ingest preview was created."
        if action == "pending_updated":
            return "Pending ingest preview was updated because content changed."
        if action == "pending_skipped":
            return "Pending ingest content is unchanged; existing preview was reused."
        return "Pending ingest preview failed."

    def _read_text_file(self, path: Optional[str]) -> str:
        safe_path = self._safe_pending_path(path)
        if not safe_path or not os.path.exists(safe_path):
            return ""
        with open(safe_path, "r", encoding="utf-8") as file_stream:
            return file_stream.read()

    def _read_chunks_file(self, path: Optional[str]) -> list[dict[str, Any]]:
        safe_path = self._safe_pending_path(path)
        if not safe_path or not os.path.exists(safe_path):
            return []
        return self._read_chunks_file_unchecked(safe_path)

    def _read_chunks_file_unchecked(self, path: Optional[str]) -> list[dict[str, Any]]:
        if not path or not os.path.exists(path):
            return []
        with open(path, "r", encoding="utf-8") as file_stream:
            data = json.load(file_stream)
        return data if isinstance(data, list) else []

    def _safe_pending_path(self, path: Optional[str]) -> Optional[str]:
        raw_path = _stringify(path)
        if not raw_path:
            return None

        root = os.path.abspath(PENDING_STORAGE_DIR)
        candidate = os.path.abspath(raw_path)

        try:
            if os.path.commonpath([root, candidate]) != root:
                return None
        except ValueError:
            return None

        return candidate

    def _write_text_file(self, path: str, value: str) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as file_stream:
            file_stream.write(value or "")

    def _write_chunks_file(self, path: str, chunks: list[dict[str, Any]]) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as file_stream:
            json.dump(chunks, file_stream, ensure_ascii=False, indent=2)