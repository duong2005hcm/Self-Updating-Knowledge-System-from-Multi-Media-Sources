from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_chroma import Chroma
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from typing import List, Dict, Any
from client.database import initialize_chroma_client
# 1. Load cấu hình từ .env
load_dotenv()

def create_embeddings_and_llm():
    """Tạo embeddings và language model"""
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    llm = ChatOpenAI(model_name="gpt-4o-mini", temperature=0)
    return embeddings, llm

def create_vector_database(client, embeddings):
    """Tạo vector database từ Chroma client"""
    vector_db = Chroma(
        client=client,
        collection_name="knowledge_base",
        embedding_function=embeddings
    )
    return vector_db

def create_system_prompt():
    """Tạo system prompt cho AI"""
    system_prompt = (
        "Hệ thống AI thông minh - Đề tài: Tự động thu thập và cập nhật tri thức\n\n"
        "KHẢ NĂNG NGÔN NGỮ:\n"
        "HIỂU mọi ngôn ngữ trong tài liệu (Anh, Việt, Pháp, Nhật, v.v.)\n"
        "TỰ ĐỘNG DỊCH thông tin từ ngôn ngữ gốc sang tiếng Việt\n"
        "LUÔN TRẢ LỜI BẰNG TIẾNG VIỆT (trừ khi được yêu cầu khác)\n"
        "Giữ nguyên ý nghĩa chính xác khi dịch\n\n"
        "PHƯƠNG PHÁP HOẠT ĐỘNG:\n"
        "1. HIỂU Ý NGƯỜI DÙNG THÔNG MINH:\n"
        "   - Tự động nhận diện từ đồng nghĩa, khái niệm liên quan\n"
        "   - Hiểu ngữ cảnh ẩn sau câu hỏi\n"
        "   - Tìm semantic match (khớp ý nghĩa) thay vì exact match (khớp từ chính xác)\n\n"
        
        "2. XỬ LÝ ĐA DẠNG TÀI LIỆU:\n"
        "   - Làm việc với mọi loại tài liệu: văn bản, PDF, bài viết, nghiên cứu, sổ tay, hợp đồng, v.v.\n"
        "   - Tự động tìm thông tin liên quan từ nhiều phần khác nhau\n"
        "   - Kết hợp thông tin từ các đoạn văn bản có liên kết\n\n"
        
        "3. TRẢ LỜI HIỆU QUẢ:\n"
        "   - Trả lời NGẮN GỌN, SÚC TÍCH\n"
        "   - Chỉ đưa ra nội dung chính, không cần tiêu đề hay format cố định\n"
        "   - Độ dài lý tưởng: 2-4 câu cho câu hỏi đơn giản, 3-6 câu cho câu hỏi phức tạp\n"
        "   - Nếu cần giải thích: thêm ví dụ ngắn hoặc so sánh đơn giản\n\n"
        
        "4. QUY TẮC QUAN TRỌNG:\n"
        "   - Nếu thông tin CÓ trong tài liệu: trả lời dựa trên thông tin đó\n"
        "   - Nếu thông tin KHÔNG CÓ trong tài liệu: 'Không tìm thấy thông tin trong tài liệu'\n"
        "   - KHÔNG tự ý bịa thông tin không có trong tài liệu\n"
        "   - LUÔN viết đúng chính tả, ngữ pháp tiếng Việt\n"
        "   - Kiểm tra kỹ trước khi trả lời\n"
        "   - Có thể giải thích, diễn giải nhưng phải dựa trên nội dung tài liệu\n\n"
        
        "5. XỬ LÝ TỪ NGỮ LINH HOẠT:\n"
        "   - Tự động hiểu từ đồng nghĩa, từ viết tắt\n"
        "   - Ví dụ: 'AI' = 'trí tuệ nhân tạo', 'ML' = 'machine learning'\n"
        "   - Ví dụ: 'TV' = 'tivi', 'HĐ' = 'hợp đồng', 'NV' = 'nhân viên'\n"
        "   - Hiểu các cách diễn đạt khác nhau của cùng một khái niệm\n\n"
        "{context}"
    )
    return system_prompt

def create_prompt_template():
    """Tạo prompt template từ system prompt"""
    system_prompt = create_system_prompt()
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
    ])
    return prompt

def format_documents(docs):
    """Định dạng danh sách documents thành chuỗi văn bản"""
    return "\n\n".join([doc.page_content for doc in docs])

def create_qa_chain(vector_db, prompt, llm):
    """Tạo QA chain để xử lý câu hỏi"""
    retriever = vector_db.as_retriever(search_kwargs={"k": 3})
    
    chain = (
        {
            "context": retriever | format_documents,
            "input": RunnablePassthrough()
        }
        | prompt
        | llm
        | StrOutputParser()
    )
    return chain, retriever

def extract_document_title(doc):
    """Trích xuất tiêu đề từ document metadata"""
    chapter_title = doc.metadata.get('chapter_title', '')
    section_title = doc.metadata.get('section_title', '')
    document_title = doc.metadata.get('title', '')
    
    if chapter_title:
        return f"Chương: {chapter_title}"
    elif section_title:
        return f"Mục: {section_title}"
    elif document_title:
        return document_title
    else:
        first_line = doc.page_content.strip().split('\n')[0][:50]
        return f"Trích: {first_line}..."

def display_reference_sources(docs):
    """Hiển thị nguồn tham khảo"""
    print("\n Nguồn tham khảo:")
    for i, doc in enumerate(docs):
        display_title = extract_document_title(doc)
        page = doc.metadata.get('page', '')
        
        if page:
            print(f"  [{i+1}] {display_title} (trang {page})")
        else:
            print(f"  [{i+1}] {display_title}")

def process_user_query(chain, retriever, query):
    """Xử lý câu hỏi của người dùng và trả về kết quả"""
    if not query.strip():
        return None, []
    
    answer = chain.invoke(query)
    docs = retriever.invoke(query)
    
    return answer, docs

def initialize_rag_system():
    """Khởi tạo toàn bộ hệ thống RAG"""
    print(" Đang khởi động hệ thống...")
    
    client = initialize_chroma_client()
    embeddings, llm = create_embeddings_and_llm()
    vector_db = create_vector_database(client, embeddings)
    prompt = create_prompt_template()
    chain, retriever = create_qa_chain(vector_db, prompt, llm)
    
    print("\n" + "="*50)
    print(" HỆ THỐNG ĐÃ SẴN SÀNG! (Gõ 'exit' hoặc 'quit' để dừng)")
    print("="*50)
    
    return chain, retriever

def chat_loop():
    """Vòng lặp chat chính với người dùng"""
    chain, retriever = initialize_rag_system()
    
    while True:
        query = input("\n Bạn hỏi: ")
        
        if query.lower() in ['exit', 'quit', 'thoát']:
            print(" Tạm biệt!")
            break
        
        if not query.strip():
            continue
        
        print(" AI đang suy nghĩ...")
        
        answer, docs = process_user_query(chain, retriever, query)
        
        if answer:
            print(f"\n Trả lời: {answer}")
            if docs:
                display_reference_sources(docs)

def main():
    """Hàm chính để chạy chương trình"""
    try:
        chat_loop()
    except Exception as e:
        print(f" Lỗi: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()