import os
import requests
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor
from backend.app.rag.chunking.web.chunker import chunk_text

load_dotenv()

SERPER_API_KEY = os.getenv("SERPER_API_KEY")

def search_serper(query, num_results=3):
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
        results = []

        # 1. Answer Box (Rất quan trọng, Google đã tìm sẵn câu trả lời)
        if "answerBox" in data:
            ans = data["answerBox"]
            snippet = ans.get("snippet") or ans.get("answer")
            if snippet:
                results.append({
                    "url": ans.get("link", ""),
                    "snippet": f"[Google Answer Box]: {snippet}"
                })

        # 2. Organic Results (Có Snippet tóm tắt)
        for r in data.get("organic", [])[:num_results]:
            results.append({
                "url": r.get("link", ""),
                "snippet": r.get("snippet", "")
            })

        return results
    except Exception as e:
        print("Serper error:", e)
        return []


def fetch_jina(url):
    if not url: 
        return ""
    try:
        res = requests.get(f"https://r.jina.ai/{url}", timeout=20)

        if res.status_code != 200:
            return ""

        # Không replace \n thành khoảng trắng, hãy giữ nguyên cấu trúc markdown
        return res.text.strip()
    except Exception as e:
        print("Jina error:", e)
        return ""


def is_valid_content(text, query=""):
    if not text:
        return False

    text_lower = text.lower()

    # blacklist nhẹ (Tránh rác từ server chặn bot)
    blacklist = ["404", "not found", "access denied", "forbidden", "captcha", "please enable javascript", "are you human"]
    if any(word in text_lower for word in blacklist):
        return False

    # số từ tối thiểu
    words = text.split()
    if len(words) < 20:
        return False

    # tránh spam (text lặp)
    if len(set(words)) < 10:
        return False

    # relevance nhẹ 
    if query:
        query_terms = [t for t in query.lower().split() if len(t) > 3]

        if query_terms:
            match_count = sum(1 for term in query_terms if term in text_lower)
            # Nới lỏng một chút để không vô tình đánh drop text
            if match_count == 0 and len(query_terms) > 1:
                return False

    return True


def web_retrieve(query, num_results=3):

    search_data = search_serper(query, num_results)

    if not search_data:
        return []

    # Lấy ra các URL để ném vào Jina
    urls = [d["url"] for d in search_data if d["url"]]

    # Crawl website bằng Jina song song
    with ThreadPoolExecutor(max_workers=5) as executor:
        texts = list(executor.map(fetch_jina, urls))

    results = []

    for i, data in enumerate(search_data):
        url = data["url"]
        snippet = data["snippet"]
        jina_text = texts[i] if i < len(texts) else ""

        # 1. Đưa Snippet của Google vào làm Context (Mức độ ưu tiên cao -> score 0.6)
        if snippet:
            results.append({
                "id": f"web_snippet_{i}",
                "text": snippet,
                "metadata": {
                    "source": "web_search_snippet",
                    "url": url
                },
                "similarity": 0.6,
                "score": 0.6,
                "query_priority": 0,
                "collection": "web_live"
            })

        # 2. Xử lý text tóm từ Jina
        if not jina_text or not is_valid_content(jina_text, query):
            continue

        # Chặt text ra thành từng đoạn (800 kí tự), tránh việc xén cái rụp [:1500] 
        # như code cũ khiến rớt mất phần thân bài (toàn giữ lại menu, header web)
        chunks = chunk_text(jina_text, size=800, overlap=100)

        valid_chunks = [c for c in chunks if is_valid_content(c)]

        # Lấy tối đa 2 chunks để không làm chật Context Window của LLM
        for j, chunk in enumerate(valid_chunks[:2]):
            results.append({
                "id": f"web_jina_{i}_{j}",
                "text": chunk,
                "metadata": {
                    "source": "web_jina_scraper",
                    "url": url
                },
                "similarity": 0.5,
                "score": 0.5,
                "query_priority": 0,
                "collection": "web_live"
            })

    return results