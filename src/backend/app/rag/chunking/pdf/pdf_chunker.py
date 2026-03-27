import os
import json
from typing import List, Dict, Tuple
from pypdf import PdfReader

from .document_profiler import profile_pdf
from .document_classifier import classify_document
from .chunk_strategy import select_chunk_config

RAW_DATA_DIR = "data/raw"
PROCESSED_DATA_DIR = "data/processed"


def load_pdf_pages_with_offsets(pdf_path: str) -> Tuple[str, List[Dict]]:
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

        page_map.append({
            "page_number": i + 1,
            "start": start_offset,
            "end": current_offset
        })

    return full_text.strip(), page_map


def get_pages_for_chunk(chunk_start, chunk_end, page_map):
    pages = []

    for page in page_map:
        if not (chunk_end < page["start"] or chunk_start > page["end"]):
            pages.append(page["page_number"])

    if not pages:
        return None, None, []

    return pages[0], pages[-1], pages


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

                "page_numbers": ",".join(map(str, page_numbers)) if page_numbers else "",

                "text": chunk_text_part
            })

            chunk_index += 1

        if end == text_length:
            break

        new_start = end - chunk_overlap

        if new_start <= start:
            new_start = start + 1

        start = new_start

    return chunks


def process_single_pdf(pdf_path: str) -> str:

    os.makedirs(PROCESSED_DATA_DIR, exist_ok=True)

    print(f"\n Processing: {pdf_path}")

    profile = profile_pdf(pdf_path)
    full_text, page_map = load_pdf_pages_with_offsets(pdf_path)

    if not full_text.strip():
        raise ValueError("PDF không có text")

    doc_type = classify_document(profile, full_text[:2000])

    config = select_chunk_config(doc_type)
    chunk_size = config["chunk_size"]
    overlap = config["overlap"]

    print(f" Type: {doc_type} | chunk={chunk_size}")

    base_name = os.path.splitext(os.path.basename(pdf_path))[0]
    output_path = os.path.join(PROCESSED_DATA_DIR, f"{base_name}_chunks.json")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("[\n")

        first = True
        count = 0

        for chunk in chunk_text_page_aware(full_text, page_map, chunk_size, overlap):

            chunk_data = {
                "id": f"chunk_{chunk['chunk_index']}",
                "source": os.path.basename(pdf_path),
                "doc_type": doc_type,
                "data_type": "pdf",

                "page_start": chunk["page_start"],
                "page_end": chunk["page_end"],
                "page_numbers": chunk["page_numbers"],

                "text": chunk["text"]
            }

            if not first:
                f.write(",\n")
            else:
                first = False

            f.write(json.dumps(chunk_data, ensure_ascii=False))
            count += 1

        f.write("\n]")

    print(f" {count} chunks saved")

    return output_path