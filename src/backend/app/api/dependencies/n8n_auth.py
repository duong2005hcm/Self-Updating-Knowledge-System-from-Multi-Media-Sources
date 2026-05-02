from __future__ import annotations

import os
import secrets
from typing import Optional
from dotenv import load_dotenv
load_dotenv()

from fastapi import Header, HTTPException


def verify_n8n_ingest_secret(
    x_n8n_secret: Optional[str] = Header(default=None, alias="X-N8N-INGEST-SECRET"),
) -> bool:
    expected_secret = (os.getenv("N8N_INGEST_SECRET") or "").strip()
    if not expected_secret:
        raise HTTPException(
            status_code=500,
            detail="N8N_INGEST_SECRET is not configured",
        )

    provided_secret = (x_n8n_secret or "").strip()
    if not provided_secret or not secrets.compare_digest(provided_secret, expected_secret):
        raise HTTPException(status_code=401, detail="Invalid n8n ingest secret")

    return True
