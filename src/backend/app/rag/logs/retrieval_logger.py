import json
import os
from datetime import datetime

LOG_FILE = "logs/retrieval_log.jsonl"

os.makedirs("logs", exist_ok=True)


def log_retrieval(question, results):

    entry = {
        "timestamp": datetime.now().isoformat(),
        "question": question,
        "results": [
            {
                "id": r["id"],
                "source": r.get("collection", ""),
                "score": r.get("score", 0),
                "metadata": r.get("metadata", {})
            }
            for r in results
        ]
    }

    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")