from __future__ import annotations

import logging
import os
from pathlib import Path
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

import firebase_admin
from fastapi import Depends, Header, HTTPException
from firebase_admin import auth, credentials

logger = logging.getLogger(__name__)


def _resolve_credentials_path(raw_path: str) -> Path:
    expanded = Path(os.path.expanduser(os.path.expandvars(raw_path)))
    if expanded.is_absolute():
        return expanded

    repo_root = Path(__file__).resolve().parents[5]
    candidates = [
        Path.cwd() / expanded,
        repo_root / expanded,
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return candidates[0]


class Role(str, Enum):
    guest = "guest"
    user = "user"
    admin = "admin"


class DocumentVisibility(str, Enum):
    public = "public"
    protected = "protected"
    private = "private"


@dataclass(frozen=True)
class Principal:
    role: Role
    uid: Optional[str] = None
    email: Optional[str] = None
    claims: dict[str, Any] = field(default_factory=dict)

    @property
    def is_guest(self) -> bool:
        return self.role == Role.guest

    @property
    def is_admin(self) -> bool:
        return self.role == Role.admin


def _ensure_firebase_app() -> None:
    if firebase_admin._apps:
        return

    credentials_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
    if not credentials_path:
        raise HTTPException(
            status_code=500,
            detail="FIREBASE_CREDENTIALS_PATH is not configured",
        )

    resolved_path = _resolve_credentials_path(credentials_path)
    if not resolved_path.exists():
        raise HTTPException(
            status_code=500,
            detail=f"Firebase credentials file not found: {resolved_path}",
        )

    firebase_admin.initialize_app(credentials.Certificate(str(resolved_path)))


def extract_bearer_token(authorization: Optional[str], *, required: bool = True) -> Optional[str]:
    if not authorization:
        if required:
            raise HTTPException(status_code=401, detail="Missing Authorization header")
        return None

    parts = authorization.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")

    return parts[1].strip()


def verify_firebase_token(authorization: Optional[str]) -> dict[str, Any]:
    try:
        _ensure_firebase_app()
        id_token = extract_bearer_token(authorization, required=True)
        return auth.verify_id_token(id_token)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to verify Firebase ID token: %s", str(e))
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired Firebase ID token",
        )


def principal_from_claims(decoded_token: dict[str, Any]) -> Principal:
    role = Role.admin if decoded_token.get("admin") is True else Role.user
    return Principal(
        role=role,
        uid=str(decoded_token.get("uid") or decoded_token.get("user_id") or "") or None,
        email=str(decoded_token.get("email") or "") or None,
        claims=decoded_token,
    )


def get_current_principal(
    authorization: Optional[str] = Header(default=None),
) -> Principal:
    if not authorization:
        return Principal(role=Role.guest)

    decoded_token = verify_firebase_token(authorization)
    return principal_from_claims(decoded_token)


def require_authenticated_principal(
    principal: Principal = Depends(get_current_principal),
) -> Principal:
    if principal.role == Role.guest:
        raise HTTPException(status_code=401, detail="Authentication required")
    return principal


def require_admin_principal(
    principal: Principal = Depends(get_current_principal),
) -> Principal:
    if principal.role != Role.admin:
        raise HTTPException(status_code=403, detail="Admin claim required")
    return principal


def normalize_document_visibility(value: Optional[str]) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {item.value for item in DocumentVisibility}:
        return normalized
    # Current data has no visibility field yet; active legacy documents are
    # treated as public until an explicit migration/classification exists.
    return DocumentVisibility.public.value


def is_public_document(*, status: str, visibility: Optional[str]) -> bool:
    return (
        (status or "").strip().lower() == "active"
        and normalize_document_visibility(visibility) == DocumentVisibility.public.value
    )


def can_access_document(*, principal: Principal, status: str, visibility: Optional[str] = None) -> bool:
    if principal.role == Role.admin:
        return True
    if (status or "").strip().lower() != "active":
        return False
    normalized_visibility = normalize_document_visibility(visibility)
    if principal.role == Role.user:
        return normalized_visibility in {
            DocumentVisibility.public.value,
            DocumentVisibility.protected.value,
        }
    if principal.role == Role.guest:
        return normalized_visibility == DocumentVisibility.public.value
    return False


def enforce_document_access(*, principal: Principal, status: str, visibility: Optional[str] = None) -> None:
    if not can_access_document(principal=principal, status=status, visibility=visibility):
        if principal.role == Role.guest:
            raise HTTPException(status_code=403, detail="Public document required")
        raise HTTPException(status_code=403, detail="Document is not available to this role")
