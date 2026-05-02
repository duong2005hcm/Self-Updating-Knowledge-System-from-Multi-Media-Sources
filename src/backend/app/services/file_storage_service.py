from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from datetime import timedelta
from urllib.parse import quote, urlparse

import requests
from firebase_admin import storage

from backend.app.rag.memory.firebase_init import db as _firestore_db  # noqa: F401 - ensures Firebase app is initialized.

logger = logging.getLogger(__name__)

PDF_MIME_TYPE = "application/pdf"
SIGNED_URL_EXPIRES_SECONDS = max(
    int(os.getenv("PDF_SIGNED_URL_EXPIRES_SECONDS", "1800")),
    60,
)


class FileStorageNotConfiguredError(RuntimeError):
    """Raised when object storage is not configured for raw document files."""


class FileStorageError(RuntimeError):
    """Raised when uploading or resolving a stored file fails."""


@dataclass(frozen=True)
class StoredPdf:
    raw_filename: str
    raw_storage_path: str
    file_url: str
    mime_type: str = PDF_MIME_TYPE


def _bucket_name() -> str:
    provider = _storage_provider()
    if provider == "supabase":
        return (
            os.getenv("SUPABASE_STORAGE_BUCKET")
            or os.getenv("SUPABASE_BUCKET")
            or "documents"
        ).strip()

    return (
        os.getenv("FIREBASE_STORAGE_BUCKET")
        or os.getenv("GOOGLE_CLOUD_STORAGE_BUCKET")
        or os.getenv("GCS_BUCKET_NAME")
        or os.getenv("VITE_FIREBASE_STORAGE_BUCKET")
        or ""
    ).strip()


def _storage_provider() -> str:
    configured = (os.getenv("PDF_STORAGE_PROVIDER") or "").strip().lower()
    if configured:
        return configured
    if os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_SERVICE_ROLE_KEY"):
        return "supabase"
    return "firebase"


def _normalize_supabase_url(value: str) -> str:
    raw = (value or "").strip().rstrip("/")
    if not raw:
        return ""
    parsed = urlparse(raw)
    if not parsed.scheme or not parsed.netloc:
        return ""
    return f"{parsed.scheme}://{parsed.netloc}"


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    return raw in {"1", "true", "yes", "on"}


def _safe_filename(filename: str) -> str:
    basename = os.path.basename((filename or "").strip()) or "document.pdf"
    basename = re.sub(r"[^A-Za-z0-9._-]+", "_", basename).strip("._")
    if not basename:
        basename = "document.pdf"
    if not basename.lower().endswith(".pdf"):
        basename = f"{basename}.pdf"
    return basename


def _safe_storage_part(value: str, fallback: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "_", (value or "").strip()).strip("._")
    return normalized or fallback


class FileStorageService:
    """Small boundary around object storage providers.

    Local filesystem paths are only used as ingest temp files. Browser-facing
    document access should go through storage URLs generated from this service.
    """

    def __init__(self, bucket_name: str | None = None):
        self._provider = _storage_provider()
        self._bucket_name = (bucket_name or _bucket_name()).strip()
        self._supabase_url = _normalize_supabase_url(os.getenv("SUPABASE_URL", ""))
        self._supabase_key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
        self._supabase_public = _env_bool("SUPABASE_STORAGE_PUBLIC", default=True)

    @property
    def is_configured(self) -> bool:
        if self._provider == "supabase":
            return bool(self._bucket_name and self._supabase_url and self._supabase_key)
        return bool(self._bucket_name)

    @property
    def bucket_name(self) -> str:
        if not self._bucket_name:
            raise FileStorageNotConfiguredError(
                "PDF storage bucket is not configured. Set SUPABASE_STORAGE_BUCKET or FIREBASE_STORAGE_BUCKET."
            )
        return self._bucket_name

    @property
    def provider(self) -> str:
        return self._provider

    @property
    def supabase_url(self) -> str:
        if not self._supabase_url:
            raise FileStorageNotConfiguredError("SUPABASE_URL is not configured")
        return self._supabase_url

    @property
    def supabase_key(self) -> str:
        if not self._supabase_key:
            raise FileStorageNotConfiguredError("SUPABASE_SERVICE_ROLE_KEY is not configured")
        return self._supabase_key

    def _bucket(self):
        return storage.bucket(self.bucket_name)

    def _supabase_headers(self, *, content_type: str | None = None) -> dict[str, str]:
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
        }
        if content_type:
            headers["Content-Type"] = content_type
        return headers

    def build_storage_path(self, *, document_id: str, version_id: str, filename: str) -> str:
        document_part = _safe_storage_part(document_id, "document")
        version_part = _safe_storage_part(version_id, "version")
        filename_part = _safe_filename(filename)
        return f"documents/{document_part}/versions/{version_part}/{filename_part}"

    def object_url(self, storage_path: str) -> str:
        if self.provider == "supabase":
            encoded_path = quote(storage_path, safe="/")
            return f"{self.supabase_url}/storage/v1/object/public/{self.bucket_name}/{encoded_path}"
        return f"https://storage.googleapis.com/{self.bucket_name}/{quote(storage_path)}"

    def upload_pdf(
        self,
        *,
        file_bytes: bytes,
        document_id: str,
        version_id: str,
        filename: str,
    ) -> StoredPdf:
        if not file_bytes:
            raise FileStorageError("Cannot upload empty PDF bytes")

        raw_filename = _safe_filename(filename)
        storage_path = self.build_storage_path(
            document_id=document_id,
            version_id=version_id,
            filename=raw_filename,
        )

        if self.provider == "supabase":
            self._upload_pdf_to_supabase(file_bytes=file_bytes, storage_path=storage_path)
        else:
            self._upload_pdf_to_firebase(
                file_bytes=file_bytes,
                storage_path=storage_path,
                document_id=document_id,
                version_id=version_id,
                raw_filename=raw_filename,
            )

        return StoredPdf(
            raw_filename=raw_filename,
            raw_storage_path=storage_path,
            file_url=self.object_url(storage_path),
            mime_type=PDF_MIME_TYPE,
        )

    def _upload_pdf_to_supabase(self, *, file_bytes: bytes, storage_path: str) -> None:
        encoded_path = quote(storage_path, safe="/")
        url = f"{self.supabase_url}/storage/v1/object/{self.bucket_name}/{encoded_path}"
        headers = self._supabase_headers(content_type=PDF_MIME_TYPE)
        headers["x-upsert"] = "true"
        headers["cache-control"] = "3600"

        try:
            response = requests.post(
                url,
                headers=headers,
                data=file_bytes,
                timeout=(10, 90),
            )
            if response.status_code >= 400:
                raise FileStorageError(
                    f"Supabase upload failed ({response.status_code}): {response.text[:500]}"
                )
        except FileStorageError:
            raise
        except Exception as exc:
            logger.exception("Supabase PDF upload failed for path='%s': %s", storage_path, str(exc))
            raise FileStorageError(f"Could not upload PDF to Supabase Storage: {str(exc)}") from exc

    def _upload_pdf_to_firebase(
        self,
        *,
        file_bytes: bytes,
        storage_path: str,
        document_id: str,
        version_id: str,
        raw_filename: str,
    ) -> None:
        try:
            blob = self._bucket().blob(storage_path)
            blob.metadata = {
                "document_id": document_id,
                "version_id": version_id,
                "raw_filename": raw_filename,
            }
            blob.upload_from_string(file_bytes, content_type=PDF_MIME_TYPE)
            blob.patch()
        except Exception as exc:
            logger.exception("Firebase/GCS PDF upload failed for path='%s': %s", storage_path, str(exc))
            raise FileStorageError(f"Could not upload PDF to Firebase/GCS Storage: {str(exc)}") from exc

    def get_file_url(
        self,
        *,
        storage_path: str,
        filename: str,
        disposition: str = "inline",
        expires_seconds: int = SIGNED_URL_EXPIRES_SECONDS,
    ) -> str:
        normalized_path = (storage_path or "").strip()
        if not normalized_path:
            raise FileStorageError("Storage path is required")

        safe_filename = _safe_filename(filename)
        safe_disposition = "attachment" if disposition == "attachment" else "inline"
        expires = timedelta(seconds=max(int(expires_seconds or SIGNED_URL_EXPIRES_SECONDS), 60))

        if self.provider == "supabase":
            if self._supabase_public:
                return self.object_url(normalized_path)
            return self._create_supabase_signed_url(
                storage_path=normalized_path,
                expires_seconds=int(expires.total_seconds()),
            )

        try:
            blob = self._bucket().blob(normalized_path)
            if not blob.exists():
                raise FileStorageError(f"Stored PDF not found: {normalized_path}")
            return blob.generate_signed_url(
                version="v4",
                expiration=expires,
                method="GET",
                response_type=PDF_MIME_TYPE,
                response_disposition=f'{safe_disposition}; filename="{safe_filename}"',
            )
        except FileStorageError:
            raise
        except Exception as exc:
            logger.exception("PDF signed URL generation failed for path='%s': %s", normalized_path, str(exc))
            raise FileStorageError(f"Could not create PDF signed URL: {str(exc)}") from exc

    def _create_supabase_signed_url(self, *, storage_path: str, expires_seconds: int) -> str:
        encoded_path = quote(storage_path, safe="/")
        url = f"{self.supabase_url}/storage/v1/object/sign/{self.bucket_name}/{encoded_path}"
        try:
            response = requests.post(
                url,
                headers=self._supabase_headers(content_type="application/json"),
                json={"expiresIn": max(expires_seconds, 60)},
                timeout=(10, 30),
            )
            if response.status_code >= 400:
                raise FileStorageError(
                    f"Supabase signed URL failed ({response.status_code}): {response.text[:500]}"
                )
            data = response.json()
            signed_url = data.get("signedURL") or data.get("signedUrl") or data.get("url") or ""
            if not signed_url:
                raise FileStorageError("Supabase response did not include signedURL")
            if signed_url.startswith("/"):
                return f"{self.supabase_url}{signed_url}"
            return signed_url
        except FileStorageError:
            raise
        except Exception as exc:
            logger.exception("Supabase signed URL generation failed for path='%s': %s", storage_path, str(exc))
            raise FileStorageError(f"Could not create Supabase signed URL: {str(exc)}") from exc
