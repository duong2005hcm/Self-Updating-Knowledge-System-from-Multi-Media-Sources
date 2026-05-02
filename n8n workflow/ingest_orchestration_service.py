from __future__ import annotations

import logging
import os
import time
import uuid
from pathlib import Path
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
from backend.app.services.ingest_job_service import IngestJobService
from backend.app.services.ingest_response_service import build_ingest_response
from backend.app.services.metadata_mapper import build_chunk_metadata, build_ingest_context

logger = logging.getLogger(__name__)


class IngestOrchestrationService:
    def __init__(
        self,
        *,
        document_service: Optional[DocumentService] = None,
        ingest_job_service: Optional[IngestJobService] = None,
    ):
        self._document_service = document_service or DocumentService()
        self._ingest_job_service = ingest_job_service or IngestJobService()

    def ingest_pdf(
        self,
        *,
        file_bytes: bytes,
        filename: str,
        ingest_metadata: IngestMetadata,
        actor: str,
        upload_dir: str,
        include_filename: bool,
        include_collection: bool,
        include_processing_time: bool,
        allow_duplicates: bool = False,
        chroma_collection_override: Optional[str] = None,
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

        with open(pdf_path, "wb") as file_stream:
            file_stream.write(file_bytes)

        source_type = ingest_metadata.normalized_source_type("PDF")
        source_locator = original_name
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
                }
                if include_filename:
                    extras["filename"] = original_name
                if include_collection:
                    extras["collection"] = chroma_collection_override or "rag_pdf"
                if chroma_collection_override:
                    extras["target_chroma_collection"] = chroma_collection_override
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

            chunking_result = process_single_pdf(pdf_path)
            if not chunking_result or not os.path.exists(chunking_result.chunks_json_path):
                raise ValueError("Chunk JSON file was not created")

            self._document_service.update_version_artifacts(
                version_id=sync_result.version_id,
                raw_path=pdf_path,
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
                chroma_collection_override=chroma_collection_override,
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
            }
            if include_filename:
                extras["filename"] = original_name
            if include_collection:
                extras["collection"] = chroma_collection_override or "rag_pdf"
            if chroma_collection_override:
                extras["target_chroma_collection"] = chroma_collection_override
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

    def ingest_pending_pdf_chunks(
        self,
        *,
        file_bytes: bytes,
        filename: str,
        chunks_json_path: str,
        extracted_text: str,
        pdf_url: str,
        ingest_metadata: IngestMetadata,
        actor: str,
        chroma_collection_override: Optional[str] = None,
    ) -> dict:
        start_time = time.time()
        job_id: Optional[str] = None
        source_type = ingest_metadata.normalized_source_type("PDF")
        source_locator = canonicalize_url(pdf_url) or pdf_url
        checksum = checksum_bytes(file_bytes)
        document_name = (ingest_metadata.source_type and filename) or filename
        document_name = (document_name or "").strip() or Path(source_locator).name or "pending.pdf"

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
                title=document_name,
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
                self._ingest_job_service.increment_counters(job_id, processed_count=1, skipped_count=1)
                self._document_service.touch_source_last_sync(
                    source_type=source_type,
                    source_locator=source_locator,
                    source_name=document_name,
                    domain=ingest_metadata.normalized_domain(),
                    created_by=actor,
                )
                self._ingest_job_service.finish_job(job_id)
                return build_ingest_response(
                    skipped=1,
                    ingest_job_id=job_id,
                    document_id=sync_result.document_id,
                    version_id=sync_result.version_id,
                    extras={
                        "chunks_inserted": 0,
                        "filename": document_name,
                        "collection": chroma_collection_override or "rag_pdf",
                        "target_chroma_collection": chroma_collection_override,
                        "processing_time": round(time.time() - start_time, 2),
                    },
                )

            self._document_service.update_version_artifacts(
                version_id=sync_result.version_id,
                extracted_text=extracted_text,
            )

            ingest_context = build_ingest_context(
                source_type=source_type,
                source_name=document_name,
                source_locator=source_locator,
                document_title=document_name,
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
                    "source_locator": source_locator,
                    "source_name": document_name,
                    "document_name": document_name,
                    "doc_type": "pdf",
                },
            )
            embed_result = embed_and_store_chunks(
                chunks_json_path=chunks_json_path,
                allow_duplicates=False,
                data_type="pdf",
                extra_metadata=extra_metadata,
                chroma_collection_override=chroma_collection_override,
            )

            created_count = 1 if sync_result.action == "created" else 0
            updated_count = 1 if sync_result.action == "updated" else 0
            self._ingest_job_service.increment_counters(
                job_id,
                processed_count=1,
                created_count=created_count,
                updated_count=updated_count,
            )
            self._document_service.touch_source_last_sync(
                source_type=source_type,
                source_locator=source_locator,
                source_name=document_name,
                domain=ingest_metadata.normalized_domain(),
                created_by=actor,
            )
            self._ingest_job_service.finish_job(job_id)
            return build_ingest_response(
                created=created_count,
                updated=updated_count,
                ingest_job_id=job_id,
                document_id=sync_result.document_id,
                version_id=sync_result.version_id,
                extras={
                    "chunks_inserted": embed_result.get("inserted", 0),
                    "filename": document_name,
                    "collection": chroma_collection_override or "rag_pdf",
                    "target_chroma_collection": chroma_collection_override,
                    "processing_time": round(time.time() - start_time, 2),
                },
            )
        except Exception:
            if job_id:
                try:
                    self._ingest_job_service.fail_job(job_id, "Pending PDF ingest failed")
                except Exception:
                    logger.exception("Failed to mark pending PDF job as failed: %s", job_id)
            raise

    def ingest_pending_web_chunks(
        self,
        *,
        url: str,
        chunks_json_path: str,
        extracted_text: str,
        document_title: str,
        ingest_metadata: IngestMetadata,
        actor: str,
        chroma_collection_override: Optional[str] = None,
        extra_metadata: Optional[dict] = None,
    ) -> dict:
        start_time = time.time()
        job_id: Optional[str] = None
        resolved_source_type = ingest_metadata.normalized_source_type("Web")
        canonical_target_url = canonicalize_url(url) or url
        checksum = checksum_text(extracted_text or "")
        title = (document_title or "").strip() or canonical_target_url
        source_name = (
            str((extra_metadata or {}).get("source_name") or "").strip()
            or str((extra_metadata or {}).get("source_id") or "").strip()
            or canonical_target_url
        )

        if not chunks_json_path or not Path(chunks_json_path).exists():
            raise ValueError("Pending web chunks file was not found")

        try:
            source_id = self._document_service.compute_source_id(
                source_type=resolved_source_type,
                source_locator=canonical_target_url,
            )
            ingest_job = self._ingest_job_service.start_job(source_id=source_id)
            job_id = ingest_job.id

            sync_result = self._document_service.sync_document_version(
                source_type=resolved_source_type,
                source_locator=canonical_target_url,
                document_identifier=canonical_target_url,
                title=title,
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
                self._ingest_job_service.increment_counters(job_id, processed_count=1, skipped_count=1)
                self._document_service.touch_source_last_sync(
                    source_type=resolved_source_type,
                    source_locator=canonical_target_url,
                    source_name=source_name,
                    domain=ingest_metadata.normalized_domain(),
                    created_by=actor,
                )
                self._ingest_job_service.finish_job(job_id)
                return build_ingest_response(
                    skipped=1,
                    ingest_job_id=job_id,
                    document_id=sync_result.document_id,
                    version_id=sync_result.version_id,
                    extras={
                        "chunks_inserted": 0,
                        "url": canonical_target_url,
                        "collection": chroma_collection_override or "rag_web_news",
                        "target_chroma_collection": chroma_collection_override,
                        "processing_time": round(time.time() - start_time, 2),
                    },
                )

            self._document_service.update_version_artifacts(
                version_id=sync_result.version_id,
                extracted_text=extracted_text,
            )

            ingest_context = build_ingest_context(
                source_type=resolved_source_type,
                source_name=source_name,
                source_locator=canonical_target_url,
                document_title=title,
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
            metadata_extra = dict(extra_metadata or {})
            metadata_extra.update(
                {
                    "source_id": sync_result.source_id,
                    "document_id": sync_result.document_id,
                    "version_id": sync_result.version_id,
                    "ingest_job_id": job_id,
                    "source_locator": canonical_target_url,
                    "source_name": source_name,
                    "document_name": title,
                    "url": canonical_target_url,
                    "doc_type": "web",
                }
            )
            embed_result = embed_and_store_chunks(
                chunks_json_path=chunks_json_path,
                allow_duplicates=False,
                data_type="web_news",
                extra_metadata=build_chunk_metadata(ingest_context, extra=metadata_extra),
                chroma_collection_override=chroma_collection_override,
            )

            created_count = 1 if sync_result.action == "created" else 0
            updated_count = 1 if sync_result.action == "updated" else 0
            self._ingest_job_service.increment_counters(
                job_id,
                processed_count=1,
                created_count=created_count,
                updated_count=updated_count,
            )
            self._document_service.touch_source_last_sync(
                source_type=resolved_source_type,
                source_locator=canonical_target_url,
                source_name=source_name,
                domain=ingest_metadata.normalized_domain(),
                created_by=actor,
            )
            self._ingest_job_service.finish_job(job_id)
            return build_ingest_response(
                created=created_count,
                updated=updated_count,
                ingest_job_id=job_id,
                document_id=sync_result.document_id,
                version_id=sync_result.version_id,
                extras={
                    "chunks_inserted": embed_result.get("inserted", 0),
                    "url": canonical_target_url,
                    "collection": chroma_collection_override or "rag_web_news",
                    "target_chroma_collection": chroma_collection_override,
                    "processing_time": round(time.time() - start_time, 2),
                },
            )
        except Exception:
            if job_id:
                try:
                    self._ingest_job_service.fail_job(job_id, "Pending web ingest failed")
                except Exception:
                    logger.exception("Failed to mark pending web job as failed: %s", job_id)
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
        chroma_collection_override: Optional[str] = None,
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
                        "chroma_collection_override": chroma_collection_override,
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
            }
            if include_web_type:
                extras["web_type"] = web_type
            if include_outputs:
                extras["outputs"] = processed_files
            if chroma_collection_override:
                extras["target_chroma_collection"] = chroma_collection_override
                extras["collection"] = chroma_collection_override

            return build_ingest_response(
                status=response_status,
                created=created_count,
                updated=updated_count,
                skipped=skipped_count,
                failed=failed_count,
                ingest_job_id=job_id,
                documents=documents,
                extras=extras,
            )
        except Exception:
            try:
                self._ingest_job_service.fail_job(job_id, "Web ingest pipeline failed")
            except Exception:
                logger.exception("Failed to mark web job as failed: %s", job_id)
            raise
