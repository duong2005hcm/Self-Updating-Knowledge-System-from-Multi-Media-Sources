import logging
import os
from typing import Any, Dict, Optional

import firebase_admin
from fastapi import Header, HTTPException
from firebase_admin import auth, credentials

logger = logging.getLogger(__name__)


def _extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    parts = authorization.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")

    return parts[1].strip()


def verify_admin_token(
    authorization: Optional[str] = Header(default=None)
) -> Dict[str, Any]:
    try:
        if not firebase_admin._apps:
            credentials_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
            if not credentials_path:
                raise HTTPException(
                    status_code=500,
                    detail="FIREBASE_CREDENTIALS_PATH is not configured"
                )
            firebase_admin.initialize_app(credentials.Certificate(credentials_path))

        id_token = _extract_bearer_token(authorization)
        decoded_token = auth.verify_id_token(id_token)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to verify Firebase ID token: %s", str(e))
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired Firebase ID token"
        )

    if decoded_token.get("admin") is not True:
        raise HTTPException(status_code=403, detail="Admin claim required")

    return decoded_token
