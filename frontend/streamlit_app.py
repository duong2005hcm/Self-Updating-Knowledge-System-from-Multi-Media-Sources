import streamlit as st
import requests
import json
from typing import Dict, Any

# Cấu hình API endpoint
API_URL = "http://localhost:8000"

def call_rag_api(question: str, user_id: str = "streamlit_user") -> Dict[str, Any]:
    """
    Gọi API backend để xử lý câu hỏi
    
    Args:
        question: Câu hỏi của người dùng
        user_id: ID người dùng (optional)
    
    Returns:
        Dictionary chứa kết quả từ API
    """
    try:
        response = requests.post(
            f"{API_URL}/ask",
            json={
                "question": question,
                "user_id": user_id
            },
            timeout=30  # Timeout 30 giây
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            return {
                "answer": f"Lỗi API: {response.status_code}",
                "sources": [],
                "success": False,
                "error_message": f"HTTP {response.status_code}"
            }
            
    except requests.exceptions.ConnectionError:
        return {
            "answer": "Không thể kết nối đến server. Hãy chắc chắn backend đang chạy.",
            "sources": [],
            "success": False,
            "error_message": "Connection error"
        }
    except requests.exceptions.Timeout:
        return {
            "answer": "Quá thời gian chờ phản hồi từ server.",
            "sources": [],
            "success": False,
            "error_message": "Request timeout"
        }
    except Exception as e:
        return {
            "answer": f"Lỗi: {str(e)}",
            "sources": [],
            "success": False,
            "error_message": str(e)
        }

def check_backend_health() -> bool:
    """Kiểm tra kết nối đến backend"""
    try:
        response = requests.get(f"{API_URL}/health", timeout=5)
        return response.status_code == 200 and response.json().get("status") == "ready"
    except:
        return False

def main():
    """Ứng dụng Streamlit chính"""
    
    # Cấu hình trang
    st.set_page_config(
        page_title="Hệ Thống RAG AI",
        page_icon="🤖",
        layout="wide"
    )
    
    # CSS tùy chỉnh
    st.markdown("""
    <style>
    .stTextInput > div > div > input {
        font-size: 18px;
    }
    .answer-box {
        padding: 20px;
        background-color: #f0f8ff;
        border-radius: 10px;
        border-left: 5px solid #4CAF50;
        margin: 10px 0;
    }
    .source-box {
        padding: 15px;
        background-color: #f9f9f9;
        border-radius: 8px;
        border-left: 4px solid #2196F3;
        margin: 5px 0;
    }
    .error-box {
        padding: 20px;
        background-color: #ffebee;
        border-radius: 10px;
        border-left: 5px solid #f44336;
        margin: 10px 0;
    }
    </style>
    """, unsafe_allow_html=True)
    
    # Header
    st.title("🤖 Hệ Thống RAG AI Thông Minh")
    st.markdown("Hỏi đáp dựa trên tài liệu có sẵn")
    
    # Sidebar - Thông tin hệ thống
    with st.sidebar:
        st.header("Thông Tin Hệ Thống")
        
        # Kiểm tra backend
        if check_backend_health():
            st.success("✅ Backend đang hoạt động")
        else:
            st.error("❌ Không thể kết nối đến backend")
            st.info("Hãy chạy backend trước: `python backend.py`")
        
        st.markdown("---")
        st.markdown("### Hướng dẫn sử dụng")
        st.markdown("""
        1. Nhập câu hỏi vào ô bên dưới
        2. Nhấn nút **Gửi Câu Hỏi**
        3. Xem câu trả lời và nguồn tham khảo
        """)
        
        st.markdown("---")
        st.markdown("### Chức năng hệ thống")
        st.markdown("""
        - 📚 Truy xuất thông tin từ tài liệu
        - 🤖 Trả lời bằng AI thông minh
        - 🔍 Hiển thị nguồn tham khảo
        - 🌐 Hỗ trợ đa ngôn ngữ
        """)
    
    # Main content
    col1, col2 = st.columns([3, 1])
    
    with col1:
        # Input câu hỏi
        question = st.text_input(
            "Nhập câu hỏi của bạn:",
            placeholder="Ví dụ: AI là gì? Ưu điểm của machine learning?",
            key="question_input"
        )
        
        # Nút gửi
        col_btn1, col_btn2, col_btn3 = st.columns([2, 2, 1])
        with col_btn1:
            submit_button = st.button("🚀 Gửi Câu Hỏi", use_container_width=True)
        with col_btn2:
            if st.button("🔄 Câu Hỏi Mẫu", use_container_width=True):
                st.session_state.sample_question = "AI trong giáo dục có những ứng dụng gì?"
        with col_btn3:
            clear_button = st.button("🗑️ Xóa", use_container_width=True)
        
        # Xử lý clear
        if clear_button:
            if 'chat_history' in st.session_state:
                del st.session_state.chat_history
            st.rerun()
    
    with col2:
        # Câu hỏi mẫu
        st.markdown("### 💡 Câu hỏi mẫu")
        sample_questions = [
            "AI là gì?",
            "Ứng dụng của AI trong y tế",
            "Machine learning khác gì deep learning?",
            "Các loại AI phổ biến",
            "Tương lai của AI"
        ]
        
        for i, sample in enumerate(sample_questions):
            if st.button(f"{i+1}. {sample}", key=f"sample_{i}"):
                st.session_state.sample_question = sample
                st.rerun()
    
    # Lấy câu hỏi mẫu nếu có
    if 'sample_question' in st.session_state:
        question = st.session_state.sample_question
        del st.session_state.sample_question
    
    # Xử lý khi nhấn nút gửi
    if submit_button and question:
        # Hiển thị loading
        with st.spinner("🤖 AI đang xử lý câu hỏi..."):
            # Gọi API
            result = call_rag_api(question)
        
        # Hiển thị kết quả
        st.markdown("---")
        
        if result.get("success"):
            # Hiển thị câu trả lời
            st.markdown(f'<div class="answer-box"><h3>📝 Câu Trả Lời</h3><p>{result["answer"]}</p></div>', 
                       unsafe_allow_html=True)
            
            # Hiển thị nguồn tham khảo
            if result.get("sources"):
                st.markdown("### 📚 Nguồn Tham Khảo")
                
                for i, source in enumerate(result["sources"]):
                    with st.expander(f"📖 {source['title']}", expanded=(i == 0)):
                        if source['page']:
                            st.caption(f"📄 Trang: {source['page']}")
                        st.write(source['content_preview'])
            else:
                st.info("Không có nguồn tham khảo được tìm thấy.")
        
        else:
            # Hiển thị lỗi
            st.markdown(f'<div class="error-box"><h3>❌ Lỗi</h3><p>{result["answer"]}</p></div>', 
                       unsafe_allow_html=True)
    
    # Chat history (nếu muốn lưu lịch sử)
    if 'chat_history' not in st.session_state:
        st.session_state.chat_history = []
    
    # Hiển thị lịch sử chat
    if st.session_state.chat_history:
        st.markdown("---")
        st.markdown("### 📜 Lịch Sử Hỏi Đáp")
        
        for chat in reversed(st.session_state.chat_history[-5:]):  # Chỉ hiển thị 5 câu gần nhất
            with st.expander(f"❓ {chat['question'][:50]}...", expanded=False):
                st.markdown(f"**🤖 Trả lời:** {chat['answer'][:200]}...")
                if chat.get('sources'):
                    st.caption(f"📚 {len(chat['sources'])} nguồn tham khảo")
    
    # Footer
    st.markdown("---")
    st.markdown("""
    <div style='text-align: center; color: gray;'>
    <p>Hệ thống RAG AI - Tự động thu thập và cập nhật tri thức</p>
    <p>Backend: FastAPI | Frontend: Streamlit</p>
    </div>
    """, unsafe_allow_html=True)

if __name__ == "__main__":
    main()