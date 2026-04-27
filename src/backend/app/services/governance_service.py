from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from backend.app.models.document import Document
from backend.app.repositories.document_repository import DocumentRepository

DOCUMENT_STATUS_APPROVED = "approved"
DOCUMENT_STATUS_REJECTED = "rejected"
DOCUMENT_STATUS_ACTIVE = "active"
DOCUMENT_STATUS_DEACTIVATED = "deactivated"


class GovernanceDocumentNotFoundError(Exception):
    pass


class GovernanceService:
    def __init__(self, document_repository: Optional[DocumentRepository] = None):
        self._documents = document_repository or DocumentRepository()

    def approve_document(self, document_id: str, reviewed_by: str) -> Document:
        return self._set_document_status(document_id, DOCUMENT_STATUS_APPROVED, reviewed_by)

    def reject_document(self, document_id: str, reviewed_by: str) -> Document:
        return self._set_document_status(document_id, DOCUMENT_STATUS_REJECTED, reviewed_by)

    def deactivate_document(self, document_id: str, reviewed_by: str) -> Document:
        return self._set_document_status(document_id, DOCUMENT_STATUS_DEACTIVATED, reviewed_by)

    def reactivate_document(self, document_id: str, reviewed_by: str) -> Document:
        return self._set_document_status(document_id, DOCUMENT_STATUS_ACTIVE, reviewed_by)

    def _set_document_status(self, document_id: str, status: str, reviewed_by: str) -> Document:
        updated_document = self._documents.update_document(
            document_id,
            {
                "status": status,
                "reviewed_by": reviewed_by,
                "reviewed_at": datetime.now(timezone.utc),
            },
        )
        if updated_document is None:
            raise GovernanceDocumentNotFoundError(f"Document not found: {document_id}")

        return updated_document
