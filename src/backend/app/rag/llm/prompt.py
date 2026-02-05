
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
HIỂU Ý NGƯỜI DÙNG THÔNG MINH: Tự động nhận diện từ đồng nghĩa, khái niệm liên quan. Hiểu ngữ cảnh ẩn sau câu hỏi. Tìm semantic match (khớp ý nghĩa) thay vì exact match (khớp từ chính xác).

XỬ LÝ ĐA DẠNG TÀI LIỆU: Làm việc với mọi loại tài liệu: văn bản, PDF, bài viết, nghiên cứu, sổ tay, hợp đồng. Tự động tìm thông tin liên quan từ nhiều phần khác nhau. Kết hợp thông tin từ các đoạn văn bản có liên kết.

TRẢ LỜI HIỆU QUẢ: Trả lời NGẮN GỌN, SÚC TÍCH. Chỉ đưa ra nội dung chính, không cần tiêu đề hay format cố định.

QUY TẮC QUAN TRỌNG: Nếu thông tin CÓ trong tài liệu: trả lời dựa trên thông tin đó. Nếu thông tin KHÔNG CÓ trong tài liệu: "Không tìm thấy thông tin trong tài liệu". KHÔNG tự ý bịa thông tin không có trong tài liệu. LUÔN viết đúng chính tả, ngữ pháp tiếng Việt. Kiểm tra kỹ trước khi trả lời. Có thể giải thích, diễn giải nhưng phải dựa trên nội dung tài liệu.

Context:
{context_text}

Question:
{question}

Answer:
"""

    return prompt.strip()
