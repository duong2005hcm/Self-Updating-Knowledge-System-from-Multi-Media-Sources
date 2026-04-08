import os
import requests
import asyncio
import re
import logging
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv
from youtube_transcript_api import YouTubeTranscriptApi, NoTranscriptFound

load_dotenv()
logger = logging.getLogger(__name__)

SERPER_API_KEY = os.getenv("SERPER_API_KEY")


def should_use_youtube(query: str) -> bool:
    keywords = ["how", "cách", "tutorial", "hướng dẫn", "explain", "giải thích"]
    query_lower = query.lower()

    return any(k in query_lower for k in keywords)


def search_youtube(query, num_results=2):
    try:
        res = requests.post(
            "https://google.serper.dev/search",
            headers={
                "X-API-KEY": SERPER_API_KEY,
                "Content-Type": "application/json"
            },
            json={"q": f"{query} site:youtube.com"},
            timeout=5
        )

        data = res.json()

        links = [r["link"] for r in data.get("organic", [])[:num_results]]

        video_ids = []
        for link in links:
            if "watch?v=" in link:
                vid = link.split("v=")[-1].split("&")[0]
                video_ids.append(vid)

        return video_ids

    except Exception as e:
        logger.exception("YT search error for query='%s': %s", query, str(e))
        return []


def fetch_transcript(video_id):
    try:
        try:
            return YouTubeTranscriptApi.get_transcript(video_id, languages=["vi"])
        except NoTranscriptFound:
            return YouTubeTranscriptApi.get_transcript(video_id, languages=["en"])
    except Exception as e:
        logger.exception("Fetch transcript failed for video_id=%s: %s", video_id, str(e))
        return None


def split_sentences(text):
    return re.split(r'(?<=[.!?])\s+', text)


def chunk_text(text, max_len=300):
    sentences = split_sentences(text)

    chunks = []
    current = ""

    for s in sentences:
        if len(current) + len(s) <= max_len:
            current += " " + s
        else:
            chunks.append(current.strip())
            current = s

    if current:
        chunks.append(current.strip())

    return chunks


def build_chunks(transcript, video_id):

    full_text = " ".join([t["text"] for t in transcript])
    full_text = full_text.replace("\n", " ").strip()

    chunks = chunk_text(full_text)

    results = []

    for i, chunk in enumerate(chunks[:2]):

        idx = min(i * 5, len(transcript) - 1)
        timestamp = int(transcript[idx]["start"])

        results.append({
            "id": f"yt_{video_id}_{i}",
            "text": chunk,
            "metadata": {
                "source": "youtube",
                "video_id": video_id,
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "timestamp": timestamp,
                "thumbnail": f"https://img.youtube.com/vi/{video_id}/0.jpg"
            },
            "score": 0.4,
            "collection": "youtube"
        })

    return results


def jina_fallback(video_id):
    try:
        url = f"https://www.youtube.com/watch?v={video_id}"

        res = requests.get(f"https://r.jina.ai/{url}", timeout=5)

        text = res.text[:1200]

        return [{
            "id": f"yt_fallback_{video_id}",
            "text": text,
            "metadata": {
                "source": "youtube",
                "video_id": video_id,
                "url": url
            },
            "score": 0.3,
            "collection": "youtube"
        }]
    except Exception as e:
        logger.exception("Jina fallback failed for video_id=%s: %s", video_id, str(e))
        return []


def _fetch_transcripts_sync(video_ids):
    if not video_ids:
        return []

    worker_count = max(1, min(len(video_ids), 4))

    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        return list(executor.map(fetch_transcript, video_ids))


async def _fetch_transcripts_async(video_ids):
    tasks = [
        asyncio.to_thread(fetch_transcript, vid)
        for vid in video_ids
    ]

    return await asyncio.gather(*tasks)


def youtube_retrieve(query, num_results=2):

    if not should_use_youtube(query):
        return []

    video_ids = search_youtube(query, num_results)

    if not video_ids:
        return []

    transcripts = _fetch_transcripts_sync(video_ids)

    results = []

    for vid, transcript in zip(video_ids, transcripts):

        if transcript:
            results.extend(build_chunks(transcript, vid))
        else:
            results.extend(jina_fallback(vid))

    return results


async def youtube_retrieve_async(query, num_results=2):

    if not should_use_youtube(query):
        return []

    video_ids = await asyncio.to_thread(search_youtube, query, num_results)

    if not video_ids:
        return []

    transcripts = await _fetch_transcripts_async(video_ids)

    results = []

    for vid, transcript in zip(video_ids, transcripts):

        if transcript:
            results.extend(build_chunks(transcript, vid))
        else:
            fallback_chunks = await asyncio.to_thread(jina_fallback, vid)
            results.extend(fallback_chunks)

    return results
