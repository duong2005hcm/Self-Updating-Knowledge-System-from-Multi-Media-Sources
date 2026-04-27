import os
from pathlib import Path

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, firestore

load_dotenv()


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

# Avoid duplicate Firebase app initialization.
if not firebase_admin._apps:
    firebase_credentials_path = os.getenv("FIREBASE_CREDENTIALS_PATH")

    if not firebase_credentials_path:
        raise ValueError("Missing FIREBASE_CREDENTIALS_PATH environment variable")

    resolved_credentials_path = _resolve_credentials_path(firebase_credentials_path)

    if not resolved_credentials_path.exists():
        print(f"Firebase credentials file not found at: {resolved_credentials_path}")
        raise FileNotFoundError(
            f"Firebase credentials file not found: {resolved_credentials_path}"
        )

    cred = credentials.Certificate(str(resolved_credentials_path))
    firebase_admin.initialize_app(cred)

db = firestore.client()
