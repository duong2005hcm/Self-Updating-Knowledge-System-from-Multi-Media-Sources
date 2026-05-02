import logging
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from firebase_admin import firestore
from pydantic import BaseModel, Field

from backend.app.api.dependencies.admin_auth import verify_admin_token
from backend.app.rag.memory.firebase_init import db
from backend.app.rag.prompting.prompt_registry import (
    ALL_PROMPT_SCOPES,
    PROMPT_AUDITS_COLLECTION,
    PROMPT_CONFIGS_COLLECTION,
    create_prompt_version,
    get_prompt,
    invalidate_prompt_cache,
    is_business_scope,
    is_core_scope,
    log_prompt_audit,
    publish_prompt_version,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/admin/prompts",
    tags=["Admin Prompts"],
    dependencies=[Depends(verify_admin_token)],
)


class PromptDraftRequest(BaseModel):
    content: str = Field(..., min_length=1)
    note: str = ""
    version: Optional[str] = None


class PromptPublishRequest(BaseModel):
    version: str = Field(..., min_length=1)
    note: str = ""


class PromptRollbackRequest(BaseModel):
    target_version: str = Field(..., min_length=1)
    note: str = ""


def _to_iso(value: Any) -> Optional[str]:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    return None


def _require_scope(scope: str) -> str:
    clean_scope = scope.strip()
    if clean_scope not in ALL_PROMPT_SCOPES:
        raise HTTPException(status_code=404, detail=f"Unsupported prompt scope: {scope}")
    return clean_scope


def _actor(decoded_token: dict[str, Any]) -> str:
    return (
        str(decoded_token.get("uid") or "")
        or str(decoded_token.get("user_id") or "")
        or str(decoded_token.get("email") or "")
        or "admin"
    )


def _config_doc(scope: str) -> dict[str, Any]:
    snap = db.collection(PROMPT_CONFIGS_COLLECTION).document(scope).get()
    return snap.to_dict() if snap.exists else {}


def _scope_type(scope: str) -> Literal["core", "business"]:
    return "core" if is_core_scope(scope) else "business"


@router.get("/scopes")
def list_prompt_scopes() -> dict[str, Any]:
    items = []
    for scope in ALL_PROMPT_SCOPES:
        cfg = _config_doc(scope)
        items.append(
            {
                "scope": scope,
                "prompt_type": _scope_type(scope),
                "editable_from_dashboard": is_business_scope(scope),
                "active_version": cfg.get("active_version"),
                "updated_at": _to_iso(cfg.get("updated_at")),
                "updated_by": cfg.get("updated_by"),
            }
        )
    return {"scopes": items}


@router.get("/{scope}")
def get_scope_prompt(scope: str) -> dict[str, Any]:
    scope = _require_scope(scope)
    cfg = _config_doc(scope)
    resolved_prompt = get_prompt(scope)
    active_version = str(cfg.get("active_version", "") or "").strip()

    return {
        "scope": scope,
        "prompt_type": _scope_type(scope),
        "editable_from_dashboard": is_business_scope(scope),
        "active_version": active_version or None,
        "updated_at": _to_iso(cfg.get("updated_at")),
        "updated_by": cfg.get("updated_by"),
        "resolved_prompt": resolved_prompt,
        "source": "firestore" if active_version else "fallback_default",
    }


@router.get("/{scope}/versions")
def list_scope_versions(
    scope: str,
    limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    scope = _require_scope(scope)

    query = (
        db.collection(PROMPT_CONFIGS_COLLECTION)
        .document(scope)
        .collection("versions")
        .order_by("updated_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
    )

    versions = []
    for doc in query.stream():
        data = doc.to_dict() or {}
        versions.append(
            {
                "version": data.get("version", doc.id),
                "status": data.get("status"),
                "note": data.get("note", ""),
                "created_at": _to_iso(data.get("created_at")),
                "updated_at": _to_iso(data.get("updated_at")),
                "updated_by": data.get("updated_by"),
            }
        )

    return {"scope": scope, "versions": versions}


@router.post("/{scope}/draft")
def create_scope_draft(
    scope: str,
    payload: PromptDraftRequest,
    decoded_token: dict[str, Any] = Depends(verify_admin_token),
) -> dict[str, Any]:
    scope = _require_scope(scope)
    if is_core_scope(scope):
        raise HTTPException(
            status_code=403,
            detail=f"Scope '{scope}' is core and cannot be edited from dashboard",
        )

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Prompt content cannot be empty")

    version = payload.version.strip() if payload.version else datetime.now(timezone.utc).strftime("v%Y%m%d%H%M%S")
    actor = _actor(decoded_token)

    try:
        create_prompt_version(
            scope=scope,
            version=version,
            content=content,
            status="draft",
            updated_by=actor,
            note=payload.note,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.exception("Create prompt draft failed: scope=%s version=%s", scope, version)
        raise HTTPException(status_code=500, detail=f"Failed to create prompt draft: {str(e)}")

    return {"status": "ok", "scope": scope, "version": version, "message": "Draft created"}


@router.post("/{scope}/publish")
def publish_scope_version(
    scope: str,
    payload: PromptPublishRequest,
    decoded_token: dict[str, Any] = Depends(verify_admin_token),
) -> dict[str, Any]:
    scope = _require_scope(scope)
    if is_core_scope(scope):
        raise HTTPException(
            status_code=403,
            detail=f"Scope '{scope}' is core and cannot be published from dashboard",
        )

    actor = _actor(decoded_token)
    version = payload.version.strip()

    try:
        publish_prompt_version(
            scope=scope,
            version=version,
            updated_by=actor,
            note=payload.note,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Publish prompt failed: scope=%s version=%s", scope, version)
        raise HTTPException(status_code=500, detail=f"Failed to publish prompt: {str(e)}")

    return {"status": "ok", "scope": scope, "active_version": version, "message": "Published"}


@router.post("/{scope}/rollback")
def rollback_scope_version(
    scope: str,
    payload: PromptRollbackRequest,
    decoded_token: dict[str, Any] = Depends(verify_admin_token),
) -> dict[str, Any]:
    scope = _require_scope(scope)
    if is_core_scope(scope):
        raise HTTPException(
            status_code=403,
            detail=f"Scope '{scope}' is core and cannot be rolled back from dashboard",
        )

    actor = _actor(decoded_token)
    target_version = payload.target_version.strip()
    note = payload.note.strip() or "rollback"

    try:
        publish_prompt_version(
            scope=scope,
            version=target_version,
            updated_by=actor,
            note=f"rollback: {note}",
        )
        log_prompt_audit(
            scope=scope,
            action="rollback",
            version=target_version,
            created_by=actor,
            note=note,
        )
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Rollback prompt failed: scope=%s version=%s", scope, target_version)
        raise HTTPException(status_code=500, detail=f"Failed to rollback prompt: {str(e)}")

    return {
        "status": "ok",
        "scope": scope,
        "active_version": target_version,
        "message": "Rolled back",
    }


@router.post("/{scope}/cache/invalidate")
def invalidate_scope_cache(
    scope: str,
    decoded_token: dict[str, Any] = Depends(verify_admin_token),
) -> dict[str, Any]:
    del decoded_token
    scope = _require_scope(scope)
    invalidate_prompt_cache(scope)
    log_prompt_audit(
        scope=scope,
        action="invalidate_cache",
        version="-",
        created_by="admin",
        note="manual cache invalidate",
    )
    return {"status": "ok", "scope": scope, "message": "Cache invalidated"}


@router.get("/audits/recent")
def list_recent_audits(limit: int = Query(default=50, ge=1, le=200)) -> dict[str, Any]:
    query = (
        db.collection(PROMPT_AUDITS_COLLECTION)
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
    )

    items = []
    for doc in query.stream():
        data = doc.to_dict() or {}
        items.append(
            {
                "scope": data.get("scope"),
                "action": data.get("action"),
                "version": data.get("version"),
                "prompt_type": data.get("prompt_type"),
                "created_at": _to_iso(data.get("created_at")),
                "created_by": data.get("created_by"),
                "note": data.get("note", ""),
            }
        )

    return {"items": items}
