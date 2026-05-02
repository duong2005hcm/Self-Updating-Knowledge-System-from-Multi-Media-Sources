import json
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from pypdf import PdfReader

from .chunk_strategy import select_chunk_config
from .document_classifier import classify_document

RAW_DATA_DIR = "data/raw"
PROCESSED_DATA_DIR = "data/processed"

logger = logging.getLogger(__name__)


@dataclass
class PdfChunkingResult:
    chunks_json_path: str
    extracted_text: str
    chunk_count: int


def format_document_name(file_name: str) -> str:
    """Convert raw file names into display-friendly titles."""
    base_name = os.path.splitext(os.path.basename(file_name))[0]
    normalized = base_name.replace("_", " ").replace("-", " ")
    return " ".join(word.capitalize() for word in normalized.split())


def profile_pdf(reader: PdfReader) -> Dict[str, float]:
    total_pages = len(reader.pages)
    total_chars = 0

    for page in reader.pages:
        text = page.extract_text()
        if text:
            total_chars += len(text)

    chars_per_page = total_chars / max(total_pages, 1)

    return {
        "pages": total_pages,
        "total_chars": total_chars,
        "chars_per_page": chars_per_page,
    }


def load_pdf_pages_with_offsets(reader: PdfReader) -> Tuple[str, List[Dict[str, int]]]:
    full_text = ""
    page_map: List[Dict[str, int]] = []
    current_offset = 0

    for index, page in enumerate(reader.pages):
        page_text = page.extract_text()

        if not page_text:
            continue

        start_offset = current_offset
        full_text += page_text + "\n"
        current_offset += len(page_text) + 1

        page_map.append(
            {
                "page_number": index + 1,
                "start": start_offset,
                "end": current_offset,
            }
        )

    return full_text.strip(), page_map


def get_pages_for_chunk(
    chunk_start: int,
    chunk_end: int,
    page_map: List[Dict[str, int]],
) -> Tuple[Optional[int], Optional[int], List[int]]:
    pages: List[int] = []

    for page in page_map:
        if not (chunk_end < page["start"] or chunk_start > page["end"]):
            pages.append(page["page_number"])

    if not pages:
        return None, None, []

    return pages[0], pages[-1], pages


def chunk_text_page_aware(
    full_text: str,
    page_map: List[Dict[str, int]],
    chunk_size: int,
    chunk_overlap: int,
) -> List[Dict[str, object]]:
    if chunk_size <= chunk_overlap:
        raise ValueError("chunk_size must be greater than chunk_overlap")

    chunks: List[Dict[str, object]] = []
    start = 0
    text_length = len(full_text)
    chunk_index = 0
    minimum_chunk_chars = max(200, int(chunk_size * 0.55))

    while start < text_length:
        hard_end = min(start + chunk_size, text_length)
        end = _select_chunk_end(
            full_text=full_text,
            start=start,
            hard_end=hard_end,
            minimum_chunk_chars=minimum_chunk_chars,
        )
        chunk_text_part = full_text[start:end].strip()

        if chunk_text_part:
            page_start, page_end, page_numbers = get_pages_for_chunk(start, end, page_map)

            chunks.append(
                {
                    "chunk_index": chunk_index,
                    "chunk_start_char": start,
                    "chunk_end_char": end,
                    "page_start": page_start,
                    "page_end": page_end,
                    "page_numbers": ",".join(map(str, page_numbers)) if page_numbers else "",
                    "text": chunk_text_part,
                }
            )

            chunk_index += 1

        if end == text_length:
            break

        new_start = end - chunk_overlap

        if new_start <= start:
            new_start = start + 1

        start = _align_chunk_start(full_text, new_start, end)

    return chunks


def process_single_pdf(pdf_path: str) -> PdfChunkingResult:
    try:
        os.makedirs(PROCESSED_DATA_DIR, exist_ok=True)
        logger.info("Processing PDF: %s", pdf_path)

        reader = PdfReader(pdf_path)
        profile = profile_pdf(reader)
        full_text, page_map = load_pdf_pages_with_offsets(reader)

        if not full_text.strip():
            raise ValueError("PDF has no extractable text")

        doc_type = classify_document(profile, full_text[:2000])

        config = select_chunk_config(doc_type)
        chunk_size = config["chunk_size"]
        overlap = config["overlap"]
        created_at = datetime.now(timezone.utc).isoformat()

        source_file_name = os.path.basename(pdf_path)
        document_name = format_document_name(source_file_name)

        logger.info("Document type=%s chunk_size=%s", doc_type, chunk_size)

        base_name = os.path.splitext(source_file_name)[0]
        output_path = os.path.join(PROCESSED_DATA_DIR, f"{base_name}_chunks.json")

        with open(output_path, "w", encoding="utf-8") as output_file:
            output_file.write("[\n")

            first = True
            count = 0

            for chunk in chunk_text_page_aware(full_text, page_map, chunk_size, overlap):
                chunk_data = {
                    "id": f"chunk_{chunk['chunk_index']}",
                    "chunk_index": chunk["chunk_index"],
                    "source": source_file_name,
                    "document_name": document_name,
                    "doc_type": doc_type,
                    "data_type": "pdf",
                    "created_at": created_at,
                    "page_start": chunk["page_start"],
                    "page_end": chunk["page_end"],
                    "page_numbers": chunk["page_numbers"],
                    "text": chunk["text"],
                }

                if not first:
                    output_file.write(",\n")
                else:
                    first = False

                output_file.write(json.dumps(chunk_data, ensure_ascii=False))
                count += 1

            output_file.write("\n]")

        logger.info("Saved %s chunks to %s", count, output_path)
        return PdfChunkingResult(
            chunks_json_path=output_path,
            extracted_text=full_text,
            chunk_count=count,
        )
    except Exception as e:
        logger.exception("Failed to process PDF '%s': %s", pdf_path, str(e))
        raise RuntimeError(f"Failed to process PDF: {str(e)}")


def _select_chunk_end(
    *,
    full_text: str,
    start: int,
    hard_end: int,
    minimum_chunk_chars: int,
) -> int:
    if hard_end >= len(full_text):
        return len(full_text)

    min_end = min(len(full_text), start + minimum_chunk_chars)
    if hard_end <= min_end:
        return hard_end

    window = full_text[min_end:hard_end]
    if not window:
        return hard_end

    preferred_patterns = (
        r"\n\s*\n",
        r"[\.\!\?…][\"'\)\]]?\s+",
        r"[\:\;][\"'\)\]]?\s+",
        r"\n",
        r"\s+",
    )

    for pattern in preferred_patterns:
        matches = list(re.finditer(pattern, window))
        if not matches:
            continue
        return min_end + matches[-1].end()

    return hard_end


def _align_chunk_start(full_text: str, candidate_start: int, current_end: int) -> int:
    start = max(0, candidate_start)
    max_forward = min(len(full_text), start + 80)

    while start < max_forward and full_text[start].isspace():
        start += 1

    if start <= 0 or start >= len(full_text):
        return min(start, len(full_text))

    if (
        start < max_forward
        and start < len(full_text)
        and start > 0
        and full_text[start - 1].isalnum()
        and full_text[start].isalnum()
    ):
        while start < max_forward and full_text[start].isalnum():
            start += 1
        while start < max_forward and full_text[start].isspace():
            start += 1

    if start >= current_end:
        return min(candidate_start, current_end - 1)

    return start
