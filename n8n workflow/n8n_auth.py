from __future__ import annotations

import os
import secrets
from typing import Any, Optional

from fastapi import Header, HTTPException


def verify_n8n_ingest_secret(
    x_n8n_ingest_secret: Optional[str] = Header(default=None, alias="X-N8N-INGEST-SECRET"),
) -> dict[str, Any]:
    """Machine-to-machine auth for n8n ingest preview, not for Admin UI sessions."""
    configured_secret = os.getenv("N8N_INGEST_SECRET")
    if not configured_secret:
        raise HTTPException(status_code=503, detail="N8N_INGEST_SECRET is not configured")

    provided_secret = x_n8n_ingest_secret or ""
    if not secrets.compare_digest(provided_secret, configured_secret):
        raise HTTPException(status_code=401, detail="Invalid n8n ingest secret")

    return {
        "user_id": "n8n",
        "email": "n8n@system.local",
        "admin": False,
        "service": "n8n",
    }
