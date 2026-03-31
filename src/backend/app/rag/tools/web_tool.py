import os
import requests
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor

load_dotenv()

SERPER_API_KEY = os.getenv("SERPER_API_KEY")

if not SERPER_API_KEY:
    raise ValueError("Missing SERPER_API_KEY in .env")


def search_serper(query, num_results=10):
    try:
        res = requests.post(
            "https://google.serper.dev/search",
            headers={
                "X-API-KEY": SERPER_API_KEY,
                "Content-Type": "application/json"
            },
            json={"q": query},
            timeout=5
        )

        if res.status_code != 200:
            print("Serper status:", res.status_code)
            return []

        data = res.json()

        return [r["link"] for r in data.get("organic", [])[:num_results]]

    except Exception as e:
        print("Serper error:", e)
        return []


def fetch_jina(url):
    try:
        res = requests.get(f"https://r.jina.ai/{url}", timeout=5)

        if res.status_code != 200:
            return ""

        text = res.text

        text = text.replace("\n", " ").strip()

        return text

    except Exception as e:
        print("Jina error:", e)
        return ""


def is_valid_content(text, query=""):
    if not text:
        return False

    text_lower = text.lower()

    # blacklist nhẹ
    blacklist = ["404", "not found", "access denied", "forbidden", "captcha"]
    if any(word in text_lower for word in blacklist):
        return False

    # độ dài tối thiểu
    if len(text) < 100:
        return False

    # số từ tối thiểu
    words = text.split()
    if len(words) < 20:
        return False

    # tránh spam (text lặp)
    if len(set(words)) < 10:
        return False

    # relevance nhẹ (không strict)
    if query:
        query_terms = [t for t in query.lower().split() if len(t) > 3]

        if query_terms:
            match_count = sum(1 for term in query_terms if term in text_lower)

            if match_count == 0:
                return False

    return True


def web_retrieve(query, num_results=12):

    urls = search_serper(query, num_results)

    if not urls:
        return []

    results = []

    with ThreadPoolExecutor(max_workers=5) as executor:
        texts = list(executor.map(fetch_jina, urls))

    for i, text in enumerate(texts):

        if not is_valid_content(text, query):
            continue

        results.append({
            "id": f"web_{i}",
            "text": text[:1500],
            "metadata": {
                "source": "web",
                "url": urls[i]
            },
            "similarity": 0.5,
            "score": 0.5,
            "query_priority": 0,
            "collection": "web_live"
        })

    return results