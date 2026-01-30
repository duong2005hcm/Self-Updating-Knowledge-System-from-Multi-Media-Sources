import requests
from bs4 import BeautifulSoup
from langchain_text_splitters import RecursiveCharacterTextSplitter
import os, json, hashlib
from urllib.parse import urlparse

from html_clean import extract_text_html
from section_splitter import split_by_heading

def fetch_web_content(url: str) -> str:
    """Lấy nội dung text từ trang web"""
    headers = {
        "User-Agent":"Mozilla/5.0"
    }
    
    resp = requests.get(url , headers = headers , timeout=15)
    resp.raise_for_status()
    return resp.text

def chunk_session(sections: list[str],
    chunk_size: int,
    chunk_overlap: int
) -> list[str]:
    """Chia nhỏ các phần văn bản thành các đoạn nhỏ hơn"""
    splitters = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,)
    
    chunks = []
    for section in sections:
        chunks.extend(splitters.split_text(section))
    
    return chunks

def save_web_chunks(
    url: str,
    chunks: list[str],
    doc_type: str,
    output_dir: str
):
    os.makedirs(output_dir, exist_ok=True)

    domain = urlparse(url).netloc.replace(".", "_")
    doc_id = hashlib.md5(url.encode()).hexdigest()[:8]
    filename = f"{domain}_{doc_id}.chunks.json"

    data = []
    for i, chunk in enumerate(chunks):
        data.append({
            "doc_id": doc_id,
            "source_type": "web",
            "url": url,
            "domain": domain,
            "chunk_index": i,
            "text": chunk
        })

    with open(os.path.join(output_dir, filename), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return filename

def process_web_url(url: str, chunk_size: int, chunk_overlap: int):
    html = fetch_web_content(url)
    text = extract_text_html(html)
    sections = split_by_heading(text)
    chunks = chunk_session(sections, chunk_size, chunk_overlap)

    output_file = save_web_chunks(
        url=url,
        chunks=chunks,
        doc_type="web",
        output_dir="data/processed/web"
    )

    print(f" Hoàn tất web ingest: {output_file}")