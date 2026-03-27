from langchain_text_splitters import RecursiveCharacterTextSplitter

def chunk_text(text, size, overlap):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=size,
        chunk_overlap=overlap,
        separators=["\n\n", "\n", ". "]
    )
    return splitter.split_text(text)
