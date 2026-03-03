import os
import json
from typing import List, Dict, Tuple
from pypdf import PdfReader
from tqdm import tqdm

from .document_profiler import profile_pdf
from .document_classifier import classify_document
from .chunk_strategy import select_chunk_config


RAW_DATA_DIR = "data/raw"
PROCESSED_DATA_DIR = "data/processed"



def load_pdf_pages_with_offsets(pdf_path: str) -> Tuple[str, List[Dict]]:
    """
    Trả về:
        - full_text (string toàn bộ PDF)
        - page_map: mapping offset -> page_number
    """
    reader = PdfReader(pdf_path)

    full_text = ""
    page_map = []
    current_offset = 0

    for i, page in enumerate(reader.pages):
        page_text = page.extract_text()

        if not page_text:
            continue

        start_offset = current_offset
        full_text += page_text + "\n"
        current_offset += len(page_text) + 1
        end_offset = current_offset

        page_map.append({
            "page_number": i + 1,
            "start": start_offset,
            "end": end_offset
        })

    return full_text.strip(), page_map

# MAP CHUNK TO PAGE
def get_pages_for_chunk(chunk_start: int,
                        chunk_end: int,
                        page_map: List[Dict]) -> Tuple[int, int, List[int]]:

    pages = []

    for page in page_map:
        if not (chunk_end < page["start"] or chunk_start > page["end"]):
            pages.append(page["page_number"])

    if not pages:
        return None, None, []

    return pages[0], pages[-1], pages


# PAGE-AWARE CHUNKING
def chunk_text_page_aware(full_text: str,
                        page_map: List[Dict],
                        chunk_size: int,
                        chunk_overlap: int) -> List[Dict]:

    if chunk_size <= chunk_overlap:
        raise ValueError("chunk_size phải lớn hơn chunk_overlap")

    chunks = []
    start = 0
    text_length = len(full_text)
    chunk_index = 0

    while start < text_length:
        end = min(start + chunk_size, text_length)
        chunk_text_part = full_text[start:end].strip()

        if chunk_text_part:
            page_start, page_end, page_numbers = get_pages_for_chunk(
                start, end, page_map
            )

            chunks.append({
                "chunk_index": chunk_index,
                "chunk_start_char": start,
                "chunk_end_char": end,
                "page_start": page_start,
                "page_end": page_end,
                "page_numbers": page_numbers,
                "text": chunk_text_part
            })

            chunk_index += 1

        start = end - chunk_overlap

    return chunks


# PROCESS SINGLE PDF (UPLOAD API)
def process_single_pdf(pdf_path: str) -> str:

    os.makedirs(PROCESSED_DATA_DIR, exist_ok=True)

    print(f"\nĐang xử lý PDF upload: {pdf_path}")

    # Profile
    profile = profile_pdf(pdf_path)

    # Load + Page Map
    full_text, page_map = load_pdf_pages_with_offsets(pdf_path)

    if not full_text.strip():
        raise ValueError("PDF không có text (có thể là scan)")

    sample_text = full_text[:2000]

    # Classify
    doc_type = classify_document(profile, sample_text)

    # Chunk config
    chunk_config = select_chunk_config(doc_type)
    chunk_size = chunk_config["chunk_size"]
    chunk_overlap = chunk_config["overlap"]

    print(f" Loại tài liệu: {doc_type}")
    print(f" Chunk size: {chunk_size}, Overlap: {chunk_overlap}")

    # Page-aware chunking
    raw_chunks = chunk_text_page_aware(
        full_text,
        page_map,
        chunk_size,
        chunk_overlap
    )

    all_chunks = []

    for chunk in raw_chunks:
        all_chunks.append({
            "id": f"chunk_{chunk['chunk_index']}",
            "source": os.path.basename(pdf_path),
            "doc_type": doc_type,
            "data_type": "pdf",
            "chunk_size": chunk_size,
            "chunk_overlap": chunk_overlap,

            "chunk_start_char": chunk["chunk_start_char"],
            "chunk_end_char": chunk["chunk_end_char"],
            "page_start": chunk["page_start"],
            "page_end": chunk["page_end"],
            "page_numbers": chunk["page_numbers"],

            "text": chunk["text"]
        })

    base_name = os.path.splitext(os.path.basename(pdf_path))[0]
    output_file = f"{base_name}_chunks.json"
    output_path = os.path.join(PROCESSED_DATA_DIR, output_file)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_chunks, f, ensure_ascii=False, indent=2)

    print(f" Chunk xong: {len(all_chunks)} chunks")
    print(f" Lưu tại: {output_path}")

    return output_path


# BATCH PROCESS
def process_pdfs():

    os.makedirs(PROCESSED_DATA_DIR, exist_ok=True)

    pdf_files = [
        os.path.join(RAW_DATA_DIR, f)
        for f in os.listdir(RAW_DATA_DIR)
        if f.lower().endswith(".pdf")
    ]

    if not pdf_files:
        raise FileNotFoundError("Không tìm thấy file PDF trong data/raw")

    for pdf_path in pdf_files:
        process_single_pdf(pdf_path)

    print("\n Hoàn tất chunking PDF")
    print(" Sẵn sàng cho embedding local & ChromaDB")


if __name__ == "__main__":
    process_pdfs()