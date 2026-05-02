from __future__ import annotations

from collections import Counter
from typing import Any, Optional

from backend.app.models.document import Document
from backend.app.repositories.document_repository import DocumentRepository
from backend.app.repositories.source_repository import SourceRepository


def _model_dump(model: Document) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _document_summary(document: Document) -> dict[str, Any]:
    data = _model_dump(document)
    return {
        "id": data.get("id"),
        "source_id": data.get("source_id"),
        "title": data.get("title"),
        "source_type": data.get("source_type"),
        "status": data.get("status"),
        "domain": data.get("domain"),
        "topic": data.get("topic"),
        "priority": data.get("priority"),
        "current_version": data.get("current_version"),
        "updated_at": data.get("updated_at"),
        "created_at": data.get("created_at"),
        "reviewed_by": data.get("reviewed_by"),
        "reviewed_at": data.get("reviewed_at"),
    }


class KnowledgeOverviewService:
    def __init__(
        self,
        document_repository: Optional[DocumentRepository] = None,
        source_repository: Optional[SourceRepository] = None,
    ):
        self._documents = document_repository or DocumentRepository()
        self._sources = source_repository or SourceRepository()

    def _load_documents(
        self,
        *,
        max_scan: int,
        status: Optional[str] = None,
        domain: Optional[str] = None,
    ) -> tuple[list[Document], int, bool]:
        scan_limit = max(1, min(int(max_scan or 500), 2000))
        documents = self._documents.list_documents_for_overview(limit=scan_limit)
        scan_truncated = len(documents) >= scan_limit

        normalized_status = (status or "").strip().lower()
        normalized_domain = (domain or "").strip().lower()

        if normalized_status:
            documents = [
                document
                for document in documents
                if (document.status or "").strip().lower() == normalized_status
            ]

        if normalized_domain:
            documents = [
                document
                for document in documents
                if (document.domain or "").strip().lower() == normalized_domain
            ]

        return documents, scan_limit, scan_truncated

    def get_document_overview(
        self,
        *,
        max_scan: int = 500,
        recent_limit: int = 5,
    ) -> dict[str, Any]:
        documents, scan_limit, scan_truncated = self._load_documents(max_scan=max_scan)
        recent_items_limit = max(1, min(int(recent_limit or 5), 20))
        status_counts = Counter((document.status or "unknown").strip() or "unknown" for document in documents)
        domain_counts = Counter((document.domain or "unknown").strip() or "unknown" for document in documents)
        source_type_counts = Counter((document.source_type or "unknown").strip() or "unknown" for document in documents)

        return {
            "total_documents": len(documents),
            "documents_by_status": dict(sorted(status_counts.items())),
            "documents_by_domain": dict(sorted(domain_counts.items())),
            "documents_by_source_type": dict(sorted(source_type_counts.items())),
            "recent_documents": [
                _document_summary(document)
                for document in documents[:recent_items_limit]
            ],
            "scan_limit": scan_limit,
            "scan_truncated": scan_truncated,
        }

    def get_documents_grouped_by_source(
        self,
        *,
        max_scan: int = 500,
        status: Optional[str] = None,
        domain: Optional[str] = None,
    ) -> dict[str, Any]:
        documents, scan_limit, scan_truncated = self._load_documents(
            max_scan=max_scan,
            status=status,
            domain=domain,
        )

        grouped: dict[str, dict[str, Any]] = {}
        for document in documents:
            source_id = (document.source_id or "").strip() or "unknown_source"
            row = grouped.get(source_id)
            if row is None:
                row = {
                    "source_id": source_id,
                    "document_count": 0,
                    "documents_by_status": {},
                    "latest_document_updated_at": None,
                }
                grouped[source_id] = row

            row["document_count"] += 1

            normalized_status = (document.status or "unknown").strip() or "unknown"
            status_counts = row["documents_by_status"]
            status_counts[normalized_status] = int(status_counts.get(normalized_status, 0)) + 1

            current_latest = row.get("latest_document_updated_at")
            candidate_latest = document.updated_at
            if candidate_latest and (current_latest is None or candidate_latest > current_latest):
                row["latest_document_updated_at"] = candidate_latest

        source_map = self._sources.get_sources_by_ids(list(grouped.keys()))
        items: list[dict[str, Any]] = []
        for source_id, row in grouped.items():
            source = source_map.get(source_id)
            row["source_name"] = source.name if source is not None else source_id
            row["source_type"] = source.type if source is not None else None
            row["source_domain"] = source.domain if source is not None else None
            row["source_active"] = source.active if source is not None else None
            items.append(row)

        items.sort(
            key=lambda item: (
                -int(item.get("document_count", 0)),
                str(item.get("source_id", "")),
            )
        )

        return {
            "groups": items,
            "groups_count": len(items),
            "scan_limit": scan_limit,
            "scan_truncated": scan_truncated,
        }

    def get_documents_grouped_by_domain(
        self,
        *,
        max_scan: int = 500,
        status: Optional[str] = None,
        domain: Optional[str] = None,
    ) -> dict[str, Any]:
        documents, scan_limit, scan_truncated = self._load_documents(
            max_scan=max_scan,
            status=status,
            domain=domain,
        )

        grouped: dict[str, dict[str, Any]] = {}
        for document in documents:
            group_domain = (document.domain or "").strip() or "unknown"
            row = grouped.get(group_domain)
            if row is None:
                row = {
                    "domain": group_domain,
                    "document_count": 0,
                    "documents_by_status": {},
                    "latest_document_updated_at": None,
                }
                grouped[group_domain] = row

            row["document_count"] += 1

            normalized_status = (document.status or "unknown").strip() or "unknown"
            status_counts = row["documents_by_status"]
            status_counts[normalized_status] = int(status_counts.get(normalized_status, 0)) + 1

            current_latest = row.get("latest_document_updated_at")
            candidate_latest = document.updated_at
            if candidate_latest and (current_latest is None or candidate_latest > current_latest):
                row["latest_document_updated_at"] = candidate_latest

        items = list(grouped.values())
        items.sort(
            key=lambda item: (
                -int(item.get("document_count", 0)),
                str(item.get("domain", "")),
            )
        )

        return {
            "groups": items,
            "groups_count": len(items),
            "scan_limit": scan_limit,
            "scan_truncated": scan_truncated,
        }

    def list_documents_by_status_view(
        self,
        *,
        status: str,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        capped_limit = max(1, min(int(limit or 50), 200))
        documents = self._documents.list_documents(limit=capped_limit, status=status)
        return [_document_summary(document) for document in documents]
