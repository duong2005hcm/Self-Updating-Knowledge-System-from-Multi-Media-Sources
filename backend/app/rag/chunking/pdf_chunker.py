import os
import json
from typing import List, Dict
from pypdf import PdfReader
from tqdm import tqdm

RAW_DATA_DIR = "data/raw"
PROCESSED_DATA_DIR = "data/processed"

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200


def check_pdf_exists(folder_path: str) -> List[str]:
    """Kiểm tra và trả về danh sách file PDF"""
    if not os.path.exists(folder_path):
        raise FileNotFoundError(f"Thư mục không tồn tại: {folder_path}")

    pdf_files = [
        os.path.join(folder_path, f)
        for f in os.listdir(folder_path)
        if f.lower().endswith(".pdf")
    ]

    if not pdf_files:
        raise FileNotFoundError(
            " Không tìm thấy file PDF trong data/raw.\n"
            " Vui lòng thêm file PDF rồi chạy lại."
        )

    return pdf_files


def load_pdf_text(pdf_path: str) -> str:
    """Đọc toàn bộ text từ PDF"""
    reader = PdfReader(pdf_path)
    text = ""

    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"

    return text.strip()


def chunk_text(
    text: str,
    chunk_size: int,
    chunk_overlap: int
) -> List[str]:
    """Chia text thành các chunk"""
    if chunk_size <= chunk_overlap:
        raise ValueError("chunk_size phải lớn hơn chunk_overlap")

    chunks = []
    start = 0
    text_length = len(text)

    while start < text_length:
        end = start + chunk_size
        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        start = end - chunk_overlap

    return chunks


def process_pdfs():
    """MAIN PIPELINE"""
    os.makedirs(PROCESSED_DATA_DIR, exist_ok=True)

    pdf_files = check_pdf_exists(RAW_DATA_DIR)

    all_chunks: List[Dict] = []
    chunk_id = 0

    for pdf_path in pdf_files:
        print(f"📄 Đang xử lý file: {pdf_path}")
        text = load_pdf_text(pdf_path)

        chunks = chunk_text(text, CHUNK_SIZE, CHUNK_OVERLAP)

        for chunk in tqdm(chunks, desc="Chunking"):
            all_chunks.append({
                "id": f"chunk_{chunk_id}",
                "source": os.path.basename(pdf_path),
                "text": chunk
            })
            chunk_id += 1

    output_path = os.path.join(PROCESSED_DATA_DIR, "pdf_chunks.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_chunks, f, ensure_ascii=False, indent=2)

    print(" Hoàn tất chunking")
    print(f" Tổng số chunk: {len(all_chunks)}")
    print(f" File lưu tại: {output_path}")
    print(" Sẵn sàng cho embedding local & ChromaDB")


if __name__ == "__main__":
    process_pdfs()
