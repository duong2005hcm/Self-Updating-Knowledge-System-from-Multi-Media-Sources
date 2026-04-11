export const NAV_ITEMS = [
  { label: "Vấn đề", href: "#van-de" },
  { label: "Giải pháp", href: "#giai-phap" },
  { label: "Tính năng", href: "#tinh-nang" },
  { label: "FAQ", href: "#faq" },
];

export const HERO_TAGS = [
  "RAG & trích dẫn nguồn",
  "Đa phương tiện",
  "Quản trị tri thức",
];

export const PROBLEMS = [
  {
    title: "Dữ liệu phân tán",
    desc: "Tài liệu nằm rải rác trên web, ổ đĩa, PDF, video và công cụ nội bộ.",
  },
  {
    title: "Tri thức nhanh lỗi thời",
    desc: "Nội dung thay đổi liên tục nhưng không có cơ chế cập nhật đồng bộ.",
  },
  {
    title: "Khó tra cứu chính xác",
    desc: "Nhân sự tốn thời gian lọc thông tin và vẫn dễ trả lời sai ngữ cảnh.",
  },
  {
    title: "Mất thời gian đối chiếu",
    desc: "Mỗi câu hỏi phải mở nhiều nguồn tài liệu để kiểm chứng thủ công.",
  },
  {
    title: "Thiếu truy vết nguồn",
    desc: "Không có hệ thống hỏi đáp có dẫn nguồn khiến độ tin cậy thấp.",
  },
];

export const SOLUTION_POINTS = [
  "Tự động thu thập tri thức từ Web, RSS, PDF, video và nguồn nội bộ",
  "Chuẩn hóa dữ liệu, loại nhiễu và cập nhật định kỳ theo lịch",
  "Tìm kiếm ngữ nghĩa bằng mô hình RAG theo ngữ cảnh doanh nghiệp",
  "Trả lời tự nhiên, dễ hiểu và bám sát nghiệp vụ",
  "Mỗi câu trả lời luôn kèm trích dẫn nguồn rõ ràng",
  "Học từ feedback để cải thiện chất lượng theo thời gian",
];

export const FEATURES = [
  {
    title: "Thu thập dữ liệu đa nguồn",
    desc: "Kết nối nhanh với nhiều nguồn thông tin khác nhau trong một pipeline.",
    icon: "DatabaseZap",
  },
  {
    title: "Đồng bộ Web / RSS / PDF / Video",
    desc: "Tự động ingest theo lịch, hạn chế bỏ sót thay đổi quan trọng.",
    icon: "Globe2",
  },
  {
    title: "RAG có trích dẫn nguồn",
    desc: "Câu trả lời kèm nguồn đối chiếu để tăng mức độ tin cậy.",
    icon: "Quote",
  },
  {
    title: "ChromaDB lưu trữ tri thức",
    desc: "Lưu vector hiệu quả, phục vụ truy xuất ngữ nghĩa tốc độ cao.",
    icon: "Layers3",
  },
  {
    title: "Feedback learning",
    desc: "Ghi nhận phản hồi người dùng và cải thiện câu trả lời liên tục.",
    icon: "BrainCircuit",
  },
  {
    title: "Giao diện chatbot hiện đại",
    desc: "Trải nghiệm hội thoại mượt, thân thiện và phù hợp triển khai thật.",
    icon: "MessageSquareMore",
  },
];

export const WORKFLOW_STEPS = [
  {
    title: "Bước 1: Kết nối nguồn dữ liệu",
    desc: "Liên kết web, RSS, PDF, video và các nguồn tri thức nội bộ.",
  },
  {
    title: "Bước 2: Tiền xử lý dữ liệu",
    desc: "Làm sạch, chuẩn hóa, tóm tắt và tách chunk đúng ngữ nghĩa.",
  },
  {
    title: "Bước 3: Tạo embedding",
    desc: "Sinh vector và lưu tri thức vào ChromaDB để truy xuất nhanh.",
  },
  {
    title: "Bước 4: Hỏi đáp có dẫn nguồn",
    desc: "Người dùng hỏi, hệ thống RAG trả lời tự nhiên kèm nguồn trích dẫn.",
  },
];

export const BENEFITS = [
  "Giảm mạnh thời gian tìm kiếm thông tin cho đội vận hành",
  "Tăng độ chính xác trong truy xuất tri thức nội bộ",
  "Chuẩn hóa kho tri thức và giảm phụ thuộc cá nhân",
  "Hỗ trợ onboarding, CSKH và sales nhất quán hơn",
];

export const IMPACT_METRICS = [
  { value: "60%+", label: "Tiết kiệm thời gian tra cứu" },
  { value: "2.3x", label: "Hiệu suất hỗ trợ nội bộ" },
  { value: "24/7", label: "Dữ liệu cập nhật liên tục" },
  { value: "70%+", label: "Giảm tìm kiếm thủ công" },
];

export const USE_CASES = [
  "Doanh nghiệp có nhiều tài liệu nội bộ cần chuẩn hóa",
  "Đội vận hành, CSKH, Sales cần tra cứu nhanh và chính xác",
  "Trung tâm đào tạo hoặc nhóm nghiên cứu cần kho tri thức tập trung",
  "Tổ chức muốn quản trị tri thức xuyên phòng ban",
  "Dự án AI chatbot nội bộ hoặc chatbot tri thức theo nghiệp vụ",
];

export const TESTIMONIALS = [
  {
    name: "Lê Minh Anh",
    role: "Trưởng phòng Vận hành",
    company: "Nova Distribution",
    content:
      "SIMLESI AI giúp đội vận hành tra cứu tài liệu nhanh hơn rõ rệt. Điểm mình đánh giá cao nhất là câu trả lời luôn có nguồn đối chiếu.",
  },
  {
    name: "Trần Quốc Huy",
    role: "Head of Customer Success",
    company: "VinaEdu Platform",
    content:
      "Sau khi triển khai, quy trình onboarding nhân sự mới mượt hơn vì ai cũng truy cập cùng một kho tri thức chuẩn hóa.",
  },
  {
    name: "Nguyễn Thảo Vy",
    role: "Giám đốc Sản phẩm",
    company: "Aster AI Labs",
    content:
      "Khả năng kết hợp LangChain, ChromaDB và n8n rất thực dụng. Chúng tôi có thể mở rộng luồng tích hợp mà không phải viết lại toàn bộ hệ thống.",
  },
];

export const FAQS = [
  {
    q: "Hệ thống có hỗ trợ dữ liệu nội bộ không?",
    a: "Có. SIMLESI AI có thể ingest từ nguồn nội bộ như tài liệu doanh nghiệp, file PDF và dữ liệu từ các endpoint riêng.",
  },
  {
    q: "Có đọc được PDF và website không?",
    a: "Có. Hệ thống hỗ trợ thu thập định kỳ từ web, RSS, PDF và có thể mở rộng sang video.",
  },
  {
    q: "Câu trả lời có kèm nguồn không?",
    a: "Có. Luồng RAG được thiết kế để trả lời kèm trích dẫn nguồn giúp kiểm chứng nhanh.",
  },
  {
    q: "Có thể tích hợp chatbot lên website không?",
    a: "Có. Bạn có thể nhúng giao diện chatbot web hiện đại vào hệ thống nội bộ hoặc website chính.",
  },
  {
    q: "Có thể mở rộng sang Zalo hoặc Telegram không?",
    a: "Có. SIMLESI AI hỗ trợ mở rộng qua n8n để tích hợp các kênh như Zalo và Telegram.",
  },
  {
    q: "Bao lâu có thể triển khai bản demo?",
    a: "Thông thường có thể lên bản demo trong vài ngày làm việc tùy số lượng nguồn dữ liệu và mức độ tùy biến.",
  },
];

export const FOOTER_LINKS = {
  product: ["Tổng quan", "Tính năng", "Bảng giá", "Bảo mật"],
  solution: ["Doanh nghiệp", "CSKH & Sales", "Đào tạo", "Chatbot nội bộ"],
  resources: ["Tài liệu kỹ thuật", "FAQ", "Lộ trình sản phẩm", "Liên hệ tư vấn"],
};

export const CONTACT = {
  phone: "0773069786",
  email: "contact@simlesiai.com",
  address: "TP. Hồ Chí Minh, Việt Nam",
  facebook: "https://www.facebook.com/nguyen.duong.955596",
  github: "https://github.com/duong2005hcm",
  linkedin: "https://linkedin.com",
};
