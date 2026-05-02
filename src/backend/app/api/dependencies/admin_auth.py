from typing import Any, Dict, Optional

from fastapi import Header, HTTPException

from backend.app.api.dependencies.authz import Role, principal_from_claims, verify_firebase_token


def verify_admin_token(
    authorization: Optional[str] = Header(default=None)
) -> Dict[str, Any]:
    decoded_token = verify_firebase_token(authorization)
    if principal_from_claims(decoded_token).role != Role.admin:
        raise HTTPException(status_code=403, detail="Admin claim required")

    return decoded_token
