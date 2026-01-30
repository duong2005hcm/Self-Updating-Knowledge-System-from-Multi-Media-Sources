from web_chunker import (
    fetch_web_content as fetch_html,
    extract_text_html,
    split_by_heading,
    chunk_session as chunk_sections,
)

TEST_URL = "https://sv.vaa.edu.vn/dashboard.html"

def test_web_chunking():
    html = fetch_html(TEST_URL)
    print(" HTML fetched")

    text = extract_text_html(html)
    print(f" Extracted text length: {len(text)}")

    sections = split_by_heading(text)
    print(f" Sections found: {len(sections)}")

    chunks = chunk_sections(
        sections,
        chunk_size=350,
        chunk_overlap=50
    )

    print(f" Total chunks: {len(chunks)}\n")

    for i, chunk in enumerate(chunks[:5]):
        print(f"--- Chunk {i} ---")
        print(chunk[:300])
        print("")

if __name__ == "__main__":
    test_web_chunking()
