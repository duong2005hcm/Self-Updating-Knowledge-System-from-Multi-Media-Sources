from pypdf import PdfReader

def profile_pdf(pdf_path: str) -> dict:
    reader = PdfReader(pdf_path)

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
        "chars_per_page": chars_per_page
    }
