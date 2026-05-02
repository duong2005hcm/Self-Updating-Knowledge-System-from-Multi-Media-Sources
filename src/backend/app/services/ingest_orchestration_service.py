from __future__ import annotations

import logging
import os
import re
import time
import uuid
from typing import Callable, Optional

from backend.app.rag.chunking.pdf.pdf_chunker import process_single_pdf
from backend.app.rag.chunking.web.fetch_web import fetch_html
from backend.app.rag.chunking.web.filter_news import crawl_article_links_optimized
from backend.app.rag.chunking.web.web_chunker import WebChunker
from backend.app.rag.chunking.web.web_classifiers import classify_web
from backend.app.rag.ingestion.embedding_store import embed_and_store_chunks
from backend.app.schemas.ingest_metadata import IngestMetadata
from backend.app.services.checksum_service import canonicalize_url, checksum_bytes, checksum_text
from backend.app.services.document_service import DocumentService
from backend.app.services.document_summary_service import DocumentSummaryService
from backend.app.services.file_storage_service import FileStorageError, FileStorageService, FileStorageNotConfiguredError
from backend.app.services.ingest_job_service import IngestJobService
from backend.app.services.ingest_response_service import build_ingest_response
from backend.app.services.metadata_mapper import build_chunk_metadata, build_ingest_context

logger = logging.getLogger(__name__)


def _plain_text_from_html(html: str) -> str:
    text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", html or "")
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


class IngestOrchestrationService:
    def __init__(
        self,
        *,
        document_service: Optional[DocumentService] = None,
        ingest_job_service: Optional[IngestJobService] = None,
        file_storage_service: Optional[FileStorageService] = None,
        document_summary_service: Optional[DocumentSummaryService] = None,
    ):
        self._document_service = document_service or DocumentService()
        self._ingest_job_service = ingest_job_service or IngestJobService()
        self._file_storage_service = file_storage_service or FileStorageService()
        self._summary_service = document_summary_service or DocumentSummaryService()

    def _upload_pdf_to_storage(
        self,
        *,
        file_bytes: bytes,
        document_id: str,
        version_id: str,
        filename: str,
        storage_required: bool,
    ):
        try:
            if self._file_storage_service.is_configured:
                return self._file_storage_service.upload_pdf(
                    file_bytes=file_bytes,
                    document_id=document_id,
                    version_id=version_id,
                    filename=filename,
                )
            if storage_required:
                raise FileStorageNotConfiguredError(
                    "PDF storage is required but no storage provider is configured"
                )
            logger.warning(
                "PDF storage is not configured; keeping raw_path as internal dev-only temp path"
            )
            return None
        except (FileStorageError, FileStorageNotConfiguredError):
            if storage_required:
                raise
            logger.exception(
                "PDF storage upload failed; continuing ingest with internal raw_path only"
            )
            return None

    def _existing_document_summary(self, document_id: str) -> Optional[dict]:
        try:
            document = self._document_service.get_document(document_id)
        except Exception:
            return None

        if not document.ai_summary and not document.ai_key_points:
            return None

        return {
            "summary": document.ai_summary or "",
            "key_points": document.ai_key_points or [],
            "medical_warning": document.ai_medical_warning or "",
            "suggested_tags": document.ai_suggested_tags or [],
            "suggested_topic": document.ai_suggested_topic or "",
            "summary_status": document.summary_status or "draft",
        }

    def _generate_and_store_summary(
        self,
        *,
        document_id: str,
        version_id: str,
        title: str,
        source_type: str,
        text: str,
        actor: str,
        status: str = "draft",
    ) -> Optional[dict]:
        ai_summary = self._summary_service.generate_summary(
            title=title,
            source_type=source_type,
            text=text,
        )
        if not ai_summary:
            return None

        self._document_service.update_document_summary(
            document_id=document_id,
            version_id=version_id,
            summary=ai_summary.get("summary", ""),
            key_points=ai_summary.get("key_points", []),
            medical_warning=ai_summary.get("medical_warning", ""),
            suggested_tags=ai_summary.get("suggested_tags", []),
            suggested_topic=ai_summary.get("suggested_topic", ""),
            summary_status=status,
            updated_by=actor,
        )
        return {
            **ai_summary,
            "summary_status": status,
        }

    def ingest_pdf(
        self,
        *,
        file_bytes: bytes,
        filename: str,
        source_url: Optional[str] = None,
        ingest_metadata: IngestMetadata,
        actor: str,
        upload_dir: str,
        include_filename: bool,
        include_collection: bool,
        include_processing_time: bool,
        allow_duplicates: bool = False,
    ) -> dict:
        os.makedirs(upload_dir, exist_ok=True)
        start_time = time.time()
        job_id: Optional[str] = None

        created_count = 0
        updated_count = 0
        skipped_count = 0
        failed_count = 0

        file_id = str(uuid.uuid4())
        fallback_name = f"upload_{file_id}.pdf"
        original_name = (filename or "").strip() or fallback_name
        safe_filename = original_name.replace(" ", "_")
        pdf_path = os.path.join(upload_dir, f"{file_id}_{safe_filename}")
        normalized_source_url = (source_url or "").strip()
        storage_required = os.getenv("PDF_STORAGE_REQUIRED", "").strip().lower() in {"1", "true", "yes"}

        with open(pdf_path, "wb") as file_stream:
            file_stream.write(file_bytes)

        source_type = ingest_metadata.normalized_source_type("PDF")
        source_locator = normalized_source_url or original_name
        checksum = checksum_bytes(file_bytes)

        try:
            source_id = self._document_service.compute_source_id(
                source_type=source_type,
                source_locator=source_locator,
            )
            ingest_job = self._ingest_job_service.start_job(source_id=source_id)
            job_id = ingest_job.id

            sync_result = self._document_service.sync_document_version(
                source_type=source_type,
                source_locator=source_locator,
                document_identifier=source_locator,
                title=original_name,
                created_by=actor,
                domain=ingest_metadata.normalized_domain(),
                topic=ingest_metadata.normalized_topic(),
                priority=ingest_metadata.normalized_priority(),
                visibility=ingest_metadata.normalized_visibility(),
                status=ingest_metadata.normalized_status(),
                checksum=checksum,
                ingest_job_id=job_id,
            )

            if sync_result.action == "skipped":
                stored_pdf = self._upload_pdf_to_storage(
                    file_bytes=file_bytes,
                    document_id=sync_result.document_id,
                    version_id=sync_result.version_id,
                    filename=original_name,
                    storage_required=storage_required,
                )
                self._document_service.update_version_artifacts(
                    version_id=sync_result.version_id,
                    raw_path=pdf_path,
                    raw_filename=stored_pdf.raw_filename if stored_pdf else original_name,
                    raw_storage_path=stored_pdf.raw_storage_path if stored_pdf else None,
                    file_url=stored_pdf.file_url if stored_pdf else None,
                    mime_type=stored_pdf.mime_type if stored_pdf else "application/pdf",
                    source_url=normalized_source_url or None,
                )
                skipped_count = 1
                self._ingest_job_service.increment_counters(
                    job_id,
                    processed_count=1,
                    skipped_count=1,
                )
                self._document_service.touch_source_last_sync(
                    source_type=source_type,
                    source_locator=source_locator,
                    source_name=original_name,
                    domain=ingest_metadata.normalized_domain(),
                    created_by=actor,
                )
                self._ingest_job_service.finish_job(job_id)

                extras = {
                    "chunks_inserted": 0,
                    "title": original_name,
                    "source_url": normalized_source_url,
                    "message": "Document content is unchanged; embedding was skipped.",
                    "ai_summary": self._existing_document_summary(sync_result.document_id),
                }
                if include_filename:
                    extras["filename"] = original_name
                if include_collection:
                    extras["collection"] = "rag_pdf"
                if include_processing_time:
                    extras["processing_time"] = round(time.time() - start_time, 2)

                return build_ingest_response(
                    created=created_count,
                    updated=updated_count,
                    skipped=skipped_count,
                    failed=failed_count,
                    ingest_job_id=job_id,
                    document_id=sync_result.document_id,
                    version_id=sync_result.version_id,
                    extras=extras,
                )

            stored_pdf = self._upload_pdf_to_storage(
                file_bytes=file_bytes,
                document_id=sync_result.document_id,
                version_id=sync_result.version_id,
                filename=original_name,
                storage_required=storage_required,
            )

            chunking_result = process_single_pdf(pdf_path)
            if not chunking_result or not os.path.exists(chunking_result.chunks_json_path):
                raise ValueError("Chunk JSON file was not created")

            self._document_service.update_version_artifacts(
                version_id=sync_result.version_id,
                raw_path=pdf_path,
                raw_filename=stored_pdf.raw_filename if stored_pdf else original_name,
                raw_storage_path=stored_pdf.raw_storage_path if stored_pdf else None,
                file_url=stored_pdf.file_url if stored_pdf else None,
                mime_type=stored_pdf.mime_type if stored_pdf else "application/pdf",
                source_url=normalized_source_url or None,
                extracted_text=chunking_result.extracted_text,
            )

            ingest_context = build_ingest_context(
                source_type=source_type,
                source_name=original_name,
                source_locator=source_locator,
                document_title=original_name,
                domain=ingest_metadata.normalized_domain(),
                topic=ingest_metadata.normalized_topic(),
                priority=ingest_metadata.normalized_priority(),
                visibility=ingest_metadata.normalized_visibility(),
                status=ingest_metadata.normalized_status(),
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
                },
            )
            embed_result = embed_and_store_chunks(
                chunks_json_path=chunking_result.chunks_json_path,
                allow_duplicates=allow_duplicates,
                extra_metadata=extra_metadata,
            )
            ai_summary = self._generate_and_store_summary(
                document_id=sync_result.document_id,
                version_id=sync_result.version_id,
                title=original_name,
                source_type=source_type,
                text=chunking_result.extracted_text,
                actor=actor,
                status="draft",
            )

            if sync_result.action == "created":
                created_count = 1
            else:
                updated_count = 1
            self._ingest_job_service.increment_counters(
                job_id,
                processed_count=1,
                created_count=created_count,
                updated_count=updated_count,
            )
            self._document_service.touch_source_last_sync(
                source_type=source_type,
                source_locator=source_locator,
                source_name=original_name,
                domain=ingest_metadata.normalized_domain(),
                created_by=actor,
            )
            self._ingest_job_service.finish_job(job_id)

            try:
                os.remove(chunking_result.chunks_json_path)
            except Exception:
                logger.exception("Failed to remove chunk file: %s", chunking_result.chunks_json_path)

            extras = {
                "chunks_inserted": embed_result.get("inserted", 0),
                "title": original_name,
                "source_url": normalized_source_url,
                "message": (
                    "Ingested new PDF document."
                    if sync_result.action == "created"
                    else "Updated PDF document version."
                ),
                "ai_summary": ai_summary,
            }
            if include_filename:
                extras["filename"] = original_name
            if include_collection:
                extras["collection"] = "rag_pdf"
            if include_processing_time:
                extras["processing_time"] = round(time.time() - start_time, 2)

            return build_ingest_response(
                created=created_count,
                updated=updated_count,
                skipped=skipped_count,
                failed=failed_count,
                ingest_job_id=job_id,
                document_id=sync_result.document_id,
                version_id=sync_result.version_id,
                extras=extras,
            )
        except Exception:
            if job_id:
                try:
                    self._ingest_job_service.fail_job(job_id, "PDF ingest failed")
                except Exception:
                    logger.exception("Failed to mark PDF job as failed: %s", job_id)
            raise

    def ingest_web(
        self,
        *,
        url: str,
        limit: int,
        ingest_metadata: IngestMetadata,
        actor: str,
        data_type_resolver: Optional[Callable[[str], Optional[str]]] = None,
        include_web_type: bool,
        include_outputs: bool,
    ) -> dict:
        resolved_source_type = ingest_metadata.normalized_source_type("Web")
        canonical_site_url = canonicalize_url(url)
        source_id = self._document_service.compute_source_id(
            source_type=resolved_source_type,
            source_locator=canonical_site_url,
        )
        ingest_job = self._ingest_job_service.start_job(source_id=source_id)
        job_id = ingest_job.id

        created_count = 0
        updated_count = 0
        skipped_count = 0
        failed_count = 0
        processed_files: list[str] = []
        documents: list[dict] = []

        try:
            web_type = classify_web(url)
            chunker = WebChunker(output_dir="data/processed/web")

            targets: list[str]
            if web_type == "news":
                targets = crawl_article_links_optimized(url, limit=limit)
            else:
                targets = [url]

            for target_url in targets:
                canonical_target_url = canonicalize_url(target_url)
                try:
                    html = fetch_html(target_url)
                    content_checksum = checksum_text(html)

                    sync_result = self._document_service.sync_document_version(
                        source_type=resolved_source_type,
                        source_locator=canonical_site_url,
                        document_identifier=canonical_target_url,
                        title=canonical_target_url,
                        created_by=actor,
                        domain=ingest_metadata.normalized_domain(),
                        topic=ingest_metadata.normalized_topic(),
                        priority=ingest_metadata.normalized_priority(),
                        visibility=ingest_metadata.normalized_visibility(),
                        status=ingest_metadata.normalized_status(),
                        checksum=content_checksum,
                        ingest_job_id=job_id,
                    )

                    if sync_result.action == "skipped":
                        skipped_count += 1
                        self._ingest_job_service.increment_counters(
                            job_id,
                            processed_count=1,
                            skipped_count=1,
                        )
                        documents.append(
                            {
                                "document_id": sync_result.document_id,
                                "version_id": sync_result.version_id,
                                "action": "skipped",
                                "title": canonical_target_url,
                                "source_url": canonical_target_url,
                                "ai_summary": self._existing_document_summary(sync_result.document_id),
                            }
                        )
                        continue

                    chunk_file = chunker.process(target_url, html)
                    if not chunk_file:
                        failed_count += 1
                        self._ingest_job_service.increment_counters(
                            job_id,
                            processed_count=1,
                            failed_count=1,
                        )
                        documents.append(
                            {
                                "document_id": sync_result.document_id,
                                "version_id": sync_result.version_id,
                                "action": "failed",
                            }
                        )
                        continue

                    ingest_context = build_ingest_context(
                        source_type=resolved_source_type,
                        source_name=canonical_site_url,
                        source_locator=canonical_site_url,
                        document_title=canonical_target_url,
                        domain=ingest_metadata.normalized_domain(),
                        topic=ingest_metadata.normalized_topic(),
                        priority=ingest_metadata.normalized_priority(),
                        visibility=ingest_metadata.normalized_visibility(),
                        status=ingest_metadata.normalized_status(),
                        created_by=actor,
                        ingest_job_id=job_id,
                        checksum=content_checksum,
                        version_no=sync_result.version_no,
                    )
                    embed_kwargs = {
                        "chunks_json_path": chunk_file,
                        "extra_metadata": build_chunk_metadata(
                            ingest_context,
                            extra={
                                "source_id": sync_result.source_id,
                                "document_id": sync_result.document_id,
                                "version_id": sync_result.version_id,
                                "ingest_job_id": job_id,
                            },
                        ),
                    }
                    if data_type_resolver:
                        resolved_data_type = data_type_resolver(web_type)
                        if resolved_data_type:
                            embed_kwargs["data_type"] = resolved_data_type

                    embed_and_store_chunks(**embed_kwargs)
                    page_text = _plain_text_from_html(html)
                    ai_summary = self._generate_and_store_summary(
                        document_id=sync_result.document_id,
                        version_id=sync_result.version_id,
                        title=canonical_target_url,
                        source_type=resolved_source_type,
                        text=page_text,
                        actor=actor,
                        status="draft",
                    )

                    if sync_result.action == "created":
                        created_count += 1
                    else:
                        updated_count += 1
                    self._ingest_job_service.increment_counters(
                        job_id,
                        processed_count=1,
                        created_count=1 if sync_result.action == "created" else 0,
                        updated_count=1 if sync_result.action == "updated" else 0,
                    )
                    processed_files.append(chunk_file)
                    documents.append(
                        {
                            "document_id": sync_result.document_id,
                            "version_id": sync_result.version_id,
                            "action": sync_result.action,
                            "title": canonical_target_url,
                            "source_url": canonical_target_url,
                            "ai_summary": ai_summary,
                        }
                    )
                except Exception as item_error:
                    failed_count += 1
                    self._ingest_job_service.increment_counters(
                        job_id,
                        processed_count=1,
                        failed_count=1,
                    )
                    documents.append(
                        {
                            "document_id": None,
                            "version_id": None,
                            "action": "failed",
                            "identifier": canonical_target_url,
                        }
                    )
                    logger.exception("Failed ingest target '%s': %s", target_url, str(item_error))

            if created_count or updated_count or skipped_count:
                self._document_service.touch_source_last_sync(
                    source_type=resolved_source_type,
                    source_locator=canonical_site_url,
                    source_name=canonical_site_url,
                    domain=ingest_metadata.normalized_domain(),
                    created_by=actor,
                )

            if failed_count and not (created_count or updated_count or skipped_count):
                self._ingest_job_service.fail_job(job_id, "All web ingest items failed")
                response_status = "failed"
            else:
                self._ingest_job_service.finish_job(job_id)
                response_status = "ok"

            extras = {
                "files_processed": len(processed_files),
                "message": "Web ingest completed.",
            }
            if include_web_type:
                extras["web_type"] = web_type
            if include_outputs:
                extras["outputs"] = processed_files

            primary_document = next(
                (document for document in documents if document.get("document_id")),
                documents[0] if documents else None,
            )

            return build_ingest_response(
                status=response_status,
                created=created_count,
                updated=updated_count,
                skipped=skipped_count,
                failed=failed_count,
                ingest_job_id=job_id,
                documents=documents,
                extras={
                    **extras,
                    **(
                        {
                            "document_id": primary_document.get("document_id"),
                            "version_id": primary_document.get("version_id"),
                            "title": primary_document.get("title"),
                            "source_url": primary_document.get("source_url"),
                            "ai_summary": primary_document.get("ai_summary"),
                        }
                        if primary_document
                        else {}
                    ),
                },
            )
        except Exception:
            try:
                self._ingest_job_service.fail_job(job_id, "Web ingest pipeline failed")
            except Exception:
                logger.exception("Failed to mark web job as failed: %s", job_id)
            raise
