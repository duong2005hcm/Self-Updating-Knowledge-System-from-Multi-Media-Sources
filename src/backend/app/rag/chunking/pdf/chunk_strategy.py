def select_chunk_config(doc_type: str) -> dict:

    if doc_type == "short_doc":
        return {"chunk_size": 600, "overlap": 100}

    if doc_type == "academic_paper":
        return {"chunk_size": 500, "overlap": 100}

    if doc_type == "law_document":
        return {"chunk_size": 700, "overlap": 100}

    if doc_type == "textbook":
        return {"chunk_size": 1000, "overlap": 200}

    # fallback
    return {"chunk_size": 800, "overlap": 150}
