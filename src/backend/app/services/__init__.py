from importlib import import_module

__all__ = [
    "canonicalize_url",
    "checksum_bytes",
    "checksum_text",
    "checksum_url",
    "normalize_text_for_checksum",
    "DocumentService",
    "DocumentSyncResult",
    "DocumentNotFoundError",
    "IngestJobService",
    "IngestJobNotFoundError",
    "IngestOrchestrationService",
    "build_ingest_response",
    "resolve_ingest_action",
    "IngestMetadataContext",
    "create_ingest_job_id",
    "build_ingest_context",
    "build_chunk_metadata",
    "SourceService",
    "SourceConflictError",
    "SourceInvalidUpdateError",
    "SourceNotFoundError",
]


def __getattr__(name: str):
    if name in {
        "canonicalize_url",
        "checksum_bytes",
        "checksum_text",
        "checksum_url",
        "normalize_text_for_checksum",
    }:
        checksum_service = import_module("backend.app.services.checksum_service")
        return getattr(checksum_service, name)

    if name in {"DocumentNotFoundError", "DocumentService", "DocumentSyncResult"}:
        document_service = import_module("backend.app.services.document_service")
        return getattr(document_service, name)

    if name in {"IngestJobNotFoundError", "IngestJobService"}:
        ingest_job_service = import_module("backend.app.services.ingest_job_service")
        return getattr(ingest_job_service, name)

    if name == "IngestOrchestrationService":
        from backend.app.services.ingest_orchestration_service import IngestOrchestrationService

        return IngestOrchestrationService

    if name in {"build_ingest_response", "resolve_ingest_action"}:
        ingest_response_service = import_module("backend.app.services.ingest_response_service")
        return getattr(ingest_response_service, name)

    if name in {
        "IngestMetadataContext",
        "build_chunk_metadata",
        "build_ingest_context",
        "create_ingest_job_id",
    }:
        metadata_mapper = import_module("backend.app.services.metadata_mapper")
        return getattr(metadata_mapper, name)

    if name in {
        "SourceConflictError",
        "SourceInvalidUpdateError",
        "SourceNotFoundError",
        "SourceService",
    }:
        source_service = import_module("backend.app.services.source_service")
        return getattr(source_service, name)

    raise AttributeError(f"module 'backend.app.services' has no attribute {name!r}")
