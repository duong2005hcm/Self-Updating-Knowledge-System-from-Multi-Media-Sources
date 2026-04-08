import os

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, firestore

load_dotenv()

# Avoid duplicate Firebase app initialization.
if not firebase_admin._apps:
    firebase_credentials_path = os.getenv("FIREBASE_CREDENTIALS_PATH")

    if not firebase_credentials_path:
        raise ValueError("Missing FIREBASE_CREDENTIALS_PATH environment variable")

    resolved_credentials_path = os.path.abspath(
        os.path.expanduser(os.path.expandvars(firebase_credentials_path))
    )

    if not os.path.exists(resolved_credentials_path):
        print(f"Firebase credentials file not found at: {resolved_credentials_path}")
        raise FileNotFoundError(
            f"Firebase credentials file not found: {resolved_credentials_path}"
        )

    cred = credentials.Certificate(resolved_credentials_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()
