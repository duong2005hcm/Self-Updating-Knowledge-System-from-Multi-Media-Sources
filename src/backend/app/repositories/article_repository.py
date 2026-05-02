from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

from backend.app.models.article import Article
from backend.app.rag.memory.firebase_init import db
from backend.app.services.checksum_service import canonicalize_url

ARTICLES_COLLECTION = "articles"
FIRESTORE_TIMEOUT_SECONDS = max(float(os.getenv("FIRESTORE_TIMEOUT_SECONDS", "10")), 1.0)
FIRESTORE_CALL_KWARGS = {
    "timeout": FIRESTORE_TIMEOUT_SECONDS,
    "retry": None,
}


def _model_dump(model: Article) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _normalize_external_id(value: Optional[str]) -> Optional[str]:
    normalized = (value or "").strip()
    return normalized or None


def _normalize_source_url(value: Optional[str]) -> Optional[str]:
    normalized = canonicalize_url(value or "")
    return normalized or None


class ArticleRepository:
    """Firestore repository for article/news content metadata and body."""

    def __init__(self, firestore_client=None):
        self._db = firestore_client or db

    def create_article(self, article: Article) -> Article:
        payload = _model_dump(article)
        payload["source_url"] = _normalize_source_url(article.source_url) or article.source_url
        payload["external_id"] = _normalize_external_id(article.external_id)
        payload["created_at"] = payload.get("created_at") or datetime.now(timezone.utc)
        payload["updated_at"] = payload.get("updated_at") or datetime.now(timezone.utc)

        self._db.collection(ARTICLES_COLLECTION).document(article.id).set(
            payload,
            **FIRESTORE_CALL_KWARGS,
        )
        return Article(**payload)

    def get_article_by_external_key(
        self,
        *,
        source_name: Optional[str] = None,
        external_id: Optional[str] = None,
        source_url: Optional[str] = None,
    ) -> Optional[Article]:
        normalized_external_id = _normalize_external_id(external_id)
        if normalized_external_id:
            item = self.get_article_by_source_and_external_id(
                source_name=source_name,
                external_id=normalized_external_id,
            )
            if item is not None:
                return item

        normalized_source_url = _normalize_source_url(source_url)
        if normalized_source_url:
            return self.get_article_by_source_and_url(
                source_name=source_name,
                source_url=normalized_source_url,
            )

        return None

    def get_article_by_source_and_external_id(
        self,
        *,
        source_name: Optional[str],
        external_id: str,
    ) -> Optional[Article]:
        normalized_external_id = _normalize_external_id(external_id)
        if not normalized_external_id:
            return None
        return self._get_first_by_fields(
            {
                "source_name": (source_name or "").strip(),
                "external_id": normalized_external_id,
            }
        )

    def get_article_by_source_and_url(
        self,
        *,
        source_name: Optional[str],
        source_url: str,
    ) -> Optional[Article]:
        normalized_source_url = _normalize_source_url(source_url)
        if not normalized_source_url:
            return None
        return self._get_first_by_fields(
            {
                "source_name": (source_name or "").strip(),
                "source_url": normalized_source_url,
            }
        )

    def get_article_by_title_and_published_at(
        self,
        *,
        title: str,
        published_at: Optional[datetime],
    ) -> Optional[Article]:
        normalized_title = (title or "").strip()
        if not normalized_title or published_at is None:
            return None
        return self._get_first_by_fields(
            {
                "title": normalized_title,
                "published_at": published_at,
            }
        )

    def get_article_by_content_hash(self, content_hash: Optional[str]) -> Optional[Article]:
        normalized_hash = (content_hash or "").strip()
        if not normalized_hash:
            return None
        return self._get_first_by_field("content_hash", normalized_hash)

    def get_article_by_id(self, article_id: str) -> Optional[Article]:
        normalized_id = (article_id or "").strip()
        if not normalized_id:
            return None

        snapshot = self._db.collection(ARTICLES_COLLECTION).document(normalized_id).get(
            **FIRESTORE_CALL_KWARGS,
        )
        if not snapshot.exists:
            return None
        return self._snapshot_to_model(snapshot)

    def list_articles(
        self,
        *,
        limit: int = 50,
        status: Optional[str] = None,
        visibility: Optional[str] = None,
        topic: Optional[str] = None,
        source_name: Optional[str] = None,
        content_type: Optional[str] = None,
        source_type: Optional[str] = None,
        author_id: Optional[str] = None,
        author_name: Optional[str] = None,
    ) -> list[Article]:
        capped_limit = max(1, min(int(limit or 50), 200))
        query = self._db.collection(ARTICLES_COLLECTION)

        if status:
            query = query.where("status", "==", status.strip())
        if visibility:
            query = query.where("visibility", "==", visibility.strip())
        if topic:
            query = query.where("topic", "==", topic.strip())
        if source_name:
            query = query.where("source_name", "==", source_name.strip())
        if content_type:
            query = query.where("content_type", "==", content_type.strip())
        if source_type:
            query = query.where("source_type", "==", source_type.strip())
        if author_id:
            query = query.where("author_id", "==", author_id.strip())
        if author_name:
            query = query.where("author_name", "==", author_name.strip())

        try:
            # Pending community articles usually do not have published_at yet.
            # Ordering by published_at can make Firestore omit those documents,
            # so use updated_at for retrieval and sort by best available date below.
            ordered_query = query.order_by("updated_at", direction="DESCENDING").limit(capped_limit)
            snapshots = list(ordered_query.stream(**FIRESTORE_CALL_KWARGS))
        except Exception:
            snapshots = list(query.limit(capped_limit).stream(**FIRESTORE_CALL_KWARGS))

        snapshots.sort(
            key=lambda item: (item.to_dict() or {}).get("published_at")
            or (item.to_dict() or {}).get("updated_at")
            or (item.to_dict() or {}).get("created_at")
            or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )

        return [self._snapshot_to_model(snapshot) for snapshot in snapshots[:capped_limit]]

    def update_article_fields(self, article_id: str, fields: dict[str, Any]) -> Optional[Article]:
        normalized_id = (article_id or "").strip()
        if not normalized_id:
            return None

        document_ref = self._db.collection(ARTICLES_COLLECTION).document(normalized_id)
        snapshot = document_ref.get(**FIRESTORE_CALL_KWARGS)
        if not snapshot.exists:
            return None

        payload = dict(fields)
        payload["updated_at"] = datetime.now(timezone.utc)
        document_ref.update(payload, **FIRESTORE_CALL_KWARGS)
        next_snapshot = document_ref.get(**FIRESTORE_CALL_KWARGS)
        return self._snapshot_to_model(next_snapshot)

    def delete_article(self, article_id: str) -> Optional[Article]:
        normalized_id = (article_id or "").strip()
        if not normalized_id:
            return None

        document_ref = self._db.collection(ARTICLES_COLLECTION).document(normalized_id)
        snapshot = document_ref.get(**FIRESTORE_CALL_KWARGS)
        if not snapshot.exists:
            return None

        article = self._snapshot_to_model(snapshot)
        document_ref.delete(**FIRESTORE_CALL_KWARGS)
        return article

    def _get_first_by_field(self, field_name: str, value: str) -> Optional[Article]:
        return self._get_first_by_fields({field_name: value})

    def _get_first_by_fields(self, filters: dict[str, Any]) -> Optional[Article]:
        query = self._db.collection(ARTICLES_COLLECTION)
        for field_name, value in filters.items():
            if value is None:
                return None
            if isinstance(value, str) and not value.strip():
                return None
            query = query.where(field_name, "==", value)

        snapshots = list(
            query.limit(1).stream(**FIRESTORE_CALL_KWARGS)
        )
        if not snapshots:
            return None
        return self._snapshot_to_model(snapshots[0])

    def _snapshot_to_model(self, snapshot) -> Article:
        data = snapshot.to_dict() or {}
        if "id" not in data:
            data["id"] = snapshot.id
        return Article(**data)


def get_article_repository() -> ArticleRepository:
    return ArticleRepository()
