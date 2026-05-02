import logging
import os
import sys
import argparse

import firebase_admin
from firebase_admin import auth, credentials


DEFAULT_UID = "7Laok7dILKgivMZSWmweAwJNY183"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)


def initialize_firebase(credentials_path: str | None = None) -> None:
    if firebase_admin._apps:
        return

    path = credentials_path or os.getenv("FIREBASE_CREDENTIALS_PATH")
    if not path:
        raise ValueError("Missing FIREBASE_CREDENTIALS_PATH environment variable")

    cred = credentials.Certificate(path)
    firebase_admin.initialize_app(cred)
    logger.info("Firebase Admin initialized successfully")


def set_admin_role(uid: str, credentials_path: str | None = None) -> None:
    try:
        initialize_firebase(credentials_path)
        auth.set_custom_user_claims(uid, {"admin": True})
        logger.info("Set custom claims successfully for uid=%s", uid)
    except Exception as e:
        logger.exception("Failed to set admin role for uid=%s: %s", uid, str(e))
        raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Set Firebase custom claim admin=true for a user"
    )
    parser.add_argument(
        "uid_positional",
        nargs="?",
        default=None,
        help="Firebase Auth UID (legacy positional form)",
    )
    parser.add_argument(
        "--uid",
        default=None,
        help="Firebase Auth UID (preferred)",
    )
    parser.add_argument(
        "--credentials",
        default=None,
        help="Path to Firebase service account JSON (optional if FIREBASE_CREDENTIALS_PATH is set)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    try:
        args = parse_args()
        uid = args.uid or args.uid_positional or DEFAULT_UID
        set_admin_role(uid, args.credentials)
        logger.info("Done. User is now marked as admin in custom claims")
    except Exception:
        sys.exit(1)
