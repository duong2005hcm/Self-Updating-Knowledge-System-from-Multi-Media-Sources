import logging
import os
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Dict, Optional

from firebase_admin import firestore

from backend.app.rag.memory.firebase_init import db

logger = logging.getLogger(__name__)

# Firestore schema:
# - prompt_configs/{scope}
#   - active_version: str
#   - prompt_type: "core" | "business"
#   - updated_at: datetime
#   - updated_by: str
# - prompt_configs/{scope}/versions/{version}
#   - scope, version, content, status, created_at, updated_at, updated_by, note
# - prompt_audits/{event_id}
#   - scope, action, version, prompt_type, created_at, created_by, note
PROMPT_CONFIGS_COLLECTION = "prompt_configs"
PROMPT_AUDITS_COLLECTION = "prompt_audits"

PROMPT_SCOPE_ROUTE = "route_mode"
PROMPT_SCOPE_PLANNER = "planner"
PROMPT_SCOPE_CASUAL = "casual_answer"
PROMPT_SCOPE_PROFESSIONAL = "professional_answer"
PROMPT_SCOPE_OPENAI_DEFAULT = "openai_default"

CORE_SCOPES = {
    PROMPT_SCOPE_ROUTE,
    PROMPT_SCOPE_PLANNER,
    PROMPT_SCOPE_OPENAI_DEFAULT,
}
BUSINESS_SCOPES = {
    PROMPT_SCOPE_CASUAL,
    PROMPT_SCOPE_PROFESSIONAL,
}
ALL_PROMPT_SCOPES = tuple(sorted(CORE_SCOPES | BUSINESS_SCOPES))

DEFAULT_PROMPTS: Dict[str, str] = {
    PROMPT_SCOPE_ROUTE: """
You classify user query intent for a RAG assistant.

Return JSON only:
{"mode":"casual|simple|complex"}

Rules:
- casual: greetings, small talk, social chat.
- simple: direct factual request or one-step lookup.
- complex: requires multi-step retrieval, synthesis, or planning.
- If uncertain, prefer "simple".
""".strip(),
    PROMPT_SCOPE_PLANNER: """
You are an AI planning agent.

Available actions:
- retrieve
- answer_final

Rules:
- If observation is empty or weak, choose retrieve.
- Do not hallucinate.
- Only choose answer_final when confident.

Return JSON:
{"action":"retrieve|answer_final","action_input":"..."}
""".strip(),
    PROMPT_SCOPE_CASUAL: """
You are a friendly and helpful assistant.
Talk naturally like ChatGPT.
Use conversation history.
""".strip(),
    PROMPT_SCOPE_PROFESSIONAL: """
You are a knowledgeable assistant.

Use the provided context to answer.

Context:
{context_text}

Rules:
- Answer based on context.
- If not found, say you do not know.
- Cite sources like [0], [1].
""".strip(),
    PROMPT_SCOPE_OPENAI_DEFAULT: "You are a helpful AI assistant.",
}

_cache_lock = Lock()
_prompt_cache: Dict[str, tuple[float, str]] = {}


def _cache_ttl_seconds() -> int:
    raw = os.getenv("PROMPT_CACHE_TTL_SECONDS", "45").strip()
    try:
        ttl = int(raw)
    except ValueError:
        ttl = 45
    # Keep cache short to allow quick admin updates.
    return max(30, min(60, ttl))


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def is_core_scope(scope: str) -> bool:
    return scope in CORE_SCOPES


def is_business_scope(scope: str) -> bool:
    return scope in BUSINESS_SCOPES


def _normalize_prompt(value: Any, fallback: str) -> str:
    if not isinstance(value, str):
        return fallback
    clean = value.strip()
    return clean or fallback


def _get_cached(scope: str) -> Optional[str]:
    now_ts = _utc_now().timestamp()
    ttl = _cache_ttl_seconds()

    with _cache_lock:
        row = _prompt_cache.get(scope)
        if not row:
            return None
        ts, prompt = row
        if now_ts - ts > ttl:
            _prompt_cache.pop(scope, None)
            return None
        return prompt


def _set_cached(scope: str, prompt: str) -> None:
    with _cache_lock:
        _prompt_cache[scope] = (_utc_now().timestamp(), prompt)


def _version_ref(scope: str, version: str):
    return (
        db.collection(PROMPT_CONFIGS_COLLECTION)
        .document(scope)
        .collection("versions")
        .document(version)
    )


def _load_prompt_from_firestore(scope: str) -> Optional[str]:
    try:
        config_ref = db.collection(PROMPT_CONFIGS_COLLECTION).document(scope)
        config_doc = config_ref.get()
        if not config_doc.exists:
            return None

        config_data = config_doc.to_dict() or {}
        active_version = str(config_data.get("active_version", "")).strip()
        if not active_version:
            return None

        version_doc = _version_ref(scope, active_version).get()
        if not version_doc.exists:
            logger.warning(
                "Prompt config points to missing version: scope=%s version=%s",
                scope,
                active_version,
            )
            return None

        version_data = version_doc.to_dict() or {}
        status = str(version_data.get("status", "")).strip().lower()
        if status and status != "published":
            logger.warning(
                "Prompt version is not published: scope=%s version=%s status=%s",
                scope,
                active_version,
                status,
            )
            return None

        return _normalize_prompt(version_data.get("content"), "")
    except Exception as e:
        logger.exception("Failed loading prompt from Firestore: scope=%s error=%s", scope, str(e))
        return None


def get_prompt(scope: str) -> str:
    fallback = DEFAULT_PROMPTS.get(scope, "")
    cached = _get_cached(scope)
    if cached is not None:
        return cached

    prompt = _load_prompt_from_firestore(scope)
    final_prompt = _normalize_prompt(prompt, fallback)
    _set_cached(scope, final_prompt)
    return final_prompt


def get_prompt_bundle() -> Dict[str, str]:
    return {scope: get_prompt(scope) for scope in ALL_PROMPT_SCOPES}


def invalidate_prompt_cache(scope: Optional[str] = None) -> None:
    with _cache_lock:
        if scope is None:
            _prompt_cache.clear()
        else:
            _prompt_cache.pop(scope, None)


def create_prompt_version(
    scope: str,
    version: str,
    content: str,
    status: str,
    updated_by: str,
    note: str = "",
    allow_core_update: bool = False,
) -> None:
    if scope not in ALL_PROMPT_SCOPES:
        raise ValueError(f"Unsupported prompt scope: {scope}")
    if is_core_scope(scope) and not allow_core_update:
        raise PermissionError(f"Core prompt scope is immutable: {scope}")

    prompt_type = "core" if is_core_scope(scope) else "business"
    now = _utc_now()
    payload = {
        "scope": scope,
        "version": version,
        "content": content,
        "status": status,
        "created_at": now,
        "updated_at": now,
        "updated_by": updated_by,
        "note": note,
    }
    _version_ref(scope, version).set(payload, merge=False)

    db.collection(PROMPT_CONFIGS_COLLECTION).document(scope).set(
        {
            "prompt_type": prompt_type,
            "updated_at": now,
            "updated_by": updated_by,
        },
        merge=True,
    )

    log_prompt_audit(
        scope=scope,
        action="create_version",
        version=version,
        created_by=updated_by,
        note=note,
    )


def publish_prompt_version(
    scope: str,
    version: str,
    updated_by: str,
    note: str = "",
    allow_core_update: bool = False,
) -> None:
    if scope not in ALL_PROMPT_SCOPES:
        raise ValueError(f"Unsupported prompt scope: {scope}")
    if is_core_scope(scope) and not allow_core_update:
        raise PermissionError(f"Core prompt scope is immutable: {scope}")

    prompt_type = "core" if is_core_scope(scope) else "business"
    now = _utc_now()
    version_ref = _version_ref(scope, version)
    version_doc = version_ref.get()
    if not version_doc.exists:
        raise ValueError(f"Prompt version not found: scope={scope}, version={version}")

    version_ref.set(
        {
            "scope": scope,
            "version": version,
            "status": "published",
            "updated_at": now,
            "updated_by": updated_by,
            "note": note,
        },
        merge=True,
    )

    db.collection(PROMPT_CONFIGS_COLLECTION).document(scope).set(
        {
            "active_version": version,
            "prompt_type": prompt_type,
            "updated_at": now,
            "updated_by": updated_by,
        },
        merge=True,
    )

    log_prompt_audit(
        scope=scope,
        action="publish",
        version=version,
        created_by=updated_by,
        note=note,
    )
    invalidate_prompt_cache(scope)


def log_prompt_audit(
    scope: str,
    action: str,
    version: str,
    created_by: str,
    note: str = "",
) -> None:
    payload = {
        "scope": scope,
        "action": action,
        "version": version,
        "prompt_type": "core" if is_core_scope(scope) else "business",
        "created_at": _utc_now(),
        "created_by": created_by,
        "note": note,
    }
    db.collection(PROMPT_AUDITS_COLLECTION).add(payload)
