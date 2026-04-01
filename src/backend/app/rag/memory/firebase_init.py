import firebase_admin
from firebase_admin import credentials, firestore

# 🔥 tránh init nhiều lần
if not firebase_admin._apps:
    cred = credentials.Certificate("rag-knowledge-system-firebase-adminsdk-fbsvc-bb575ec243.json")
    firebase_admin.initialize_app(cred)

db = firestore.client()