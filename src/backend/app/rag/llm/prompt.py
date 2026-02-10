
def build_rag_prompt(context_chunks, question: str) -> str:
    """
    Build prompt for RAG
    """

    context_text = "\n\n".join(
        [
            f"[Context {i+1}]\n{chunk['text']}"
            for i, chunk in enumerate(context_chunks)
        ]
    )

    prompt = f"""
    BẠN LÀ MỘT TRỢ LÝ RAG (Retrieval-Augmented Generation).

    NHIỆM VỤ:
    - Chỉ trả lời câu hỏi dựa DUY NHẤT vào phần CONTEXT bên dưới.
    - KHÔNG sử dụng kiến thức bên ngoài CONTEXT.
    - KHÔNG suy đoán, KHÔNG bịa thông tin.

    QUY TẮC BẮT BUỘC:
    1. Nếu câu trả lời CÓ trong CONTEXT → trả lời chính xác, đủ nội dung, bằng tiếng Việt.
    2. Nếu câu trả lời KHÔNG CÓ trong CONTEXT → trả lời đúng câu sau:
    "Không tìm thấy thông tin trong tài liệu."
    3. Có thể diễn giải, cụ thể cho dễ hiểu nhưng KHÔNG được thêm thông tin mới.
    4. Viết đúng chính tả, đúng ngữ pháp tiếng Việt.
Context:
{context_text}

Question:
{question}

Answer:
"""

    return prompt.strip()
