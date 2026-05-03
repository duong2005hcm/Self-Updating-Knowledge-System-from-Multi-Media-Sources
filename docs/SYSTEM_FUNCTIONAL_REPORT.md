# BÁO CÁO CHỨC NĂNG VÀ LOGIC HỆ THỐNG
**Tên đề tài:** Hệ thống tri thức Hỗ trợ tra cứu Sức khỏe

---

## 1. Tổng quan hệ thống
- **Mục tiêu:** Trở thành nền tảng quản trị và tra cứu tri thức y khoa uy tín. Hệ thống tự động thu thập từ các nguồn (PubMed, Bộ Y tế), đi qua quy trình kiểm duyệt nội bộ, lưu trữ dưới dạng Document và Vector, sau đó cung cấp khả năng Tìm kiếm (Search) và Hỏi đáp AI (Ask AI) dựa trên kho tri thức sạch này.
- **Tại sao không chỉ là chatbot?** Hệ thống đặt **Quản trị tri thức (Knowledge Governance)** làm trung tâm. Mọi tài liệu phải qua quy trình kiểm duyệt. AI không được tự do tạo thông tin mà chỉ đóng vai trò "Trợ lý tóm tắt" dựa trên kết quả Search nội bộ. Chat chỉ là một Module phụ (consumer) của nền tảng Tri thức.

## 2. Kiến trúc tổng thể
Hệ thống tuân theo kiến trúc 3 lớp (Client - Server - Data) theo chuẩn API-First, kết hợp Microservice pattern trong logic xử lý Backend:
- **Frontend (Client):** React (Vite) đóng vai trò là SPA (Single Page Application) tương tác với người dùng và quản trị viên.
- **Backend (Server):** FastAPI (Python) quản lý toàn bộ business logic. Được chia thành các tầng Routing (`api/`), Business Logic (`services/`), và Data Access (`repositories/`).
- **Data/Storage Layer:**
  - **Firestore (Firebase):** NoSQL Database lưu Metadata quan hệ (Sources, Documents, Ingests).
  - **ChromaDB:** Vector Database lưu chunk embedding.
  - **Supabase/Firebase Storage:** Lưu file PDF gốc lấy qua pre-signed URL.
- **Tích hợp ngoài:** OpenAI (LLM, Embeddings), n8n (Crawling pipeline).

## 3. Bản đồ thư mục và File chính
- `src/backend/app/app.py`: Điểm neo chạy FastAPI, đăng ký các routers.
- `src/backend/app/api/`: Chứa định nghĩa các Rest APIs (ví dụ: `ask.py`, `search.py`, `documents.py`, `admin_governance.py`).
- `src/backend/app/services/`: **Trái tim logic của hệ thống.** Nơi thực thi mọi quy trình (ví dụ: `ingest_orchestration_service.py`, `ask_service.py`, `search_service.py`).
- `src/backend/app/repositories/`: Tương tác với Firestore.
- `frontend/src/pages/`: Định nghĩa các màn hình (ví dụ: `SearchPage.jsx`, `AskPage.jsx`, `DocumentDetailPage.jsx`).
- `frontend/src/api/`: Các axios API client để giao tiếp với Backend.
- `n8n workflow/`: Chứa các script crawl web và push sang Backend.
- `tests/`: Bộ Unit/Integration Tests.

## 4. Danh sách API Endpoints (Bảng)

| Endpoint | Phương thức | Chức năng | Phân quyền | File xử lý (Backend) |
|---|---|---|---|---|
| `/api/search` | GET/POST | Tra cứu tài liệu ngữ nghĩa/từ khóa | Public | `api/search.py` |
| `/api/search/multi` | GET | Tra cứu tài liệu (Hybrid search) | Public | `api/search.py` |
| `/api/ask` | POST | Trò chuyện với AI (kèm stream) | User/Admin | `api/ask.py` |
| `/api/documents/{id}` | GET | Xem chi tiết thông tin tài liệu | Public | `api/documents.py` |
| `/api/articles` | GET | Lấy danh sách tin tức/blog y tế | Public | `api/articles.py` |
| `/api/sources` | GET/POST | Xem và Quản lý danh sách Nguồn | Admin | `api/sources.py` |
| `/api/admin/governance/...` | PATCH | Duyệt (approve/reject) tài liệu | Admin | `api/admin_governance.py` |
| `/api/admin/pending-ingests` | GET | Xem danh sách chờ kiểm duyệt | Admin | `api/admin_pending_ingests.py` |
| `/api/user/upload` | POST | Tải file cá nhân lên trò chuyện | User | `api/user_upload.py` |

## 5. Auth: Guest / User / Admin
- Hệ thống uỷ quyền cho **Firebase Authentication**.
- Middleware Backend (`src/backend/app/api/dependencies/authz.py`) sẽ verify JWT Token.
  - **Guest:** Không có Token. Bị giới hạn số lượng kết quả (limit_cap).
  - **User:** Có Token Firebase hợp lệ, được lưu file upload, sử dụng lịch sử chat.
  - **Admin:** Token Firebase chứa **Custom Claim `admin: true`**. Có quyền truy cập toàn bộ APIs tại `/api/admin/*`.

## 6. Models / Schemas / Repositories / Services (Bảng)

| Model/Entity | Schema (Pydantic) | Repository (Firestore) | Service (Business Logic) |
|---|---|---|---|
| Document | `Document` | `document_repository.py` | `document_service.py` |
| DocumentVersion | `DocumentVersion` | `document_version_repository.py` | Tích hợp chung document |
| Source | `Source` | `source_repository.py` | `source_service.py` |
| IngestJob | `IngestJob` | `ingest_job_repository.py` | `ingest_job_service.py` |
| PendingIngest | `PendingIngest` | `pending_ingest_repository.py` | `pending_ingest_service.py` |
| Article | `Article` | `article_repository.py` | `article_service.py` |

## 7. Luồng Ingest PDF (Tải tài liệu lên)
1. User hoặc n8n đẩy PDF lên API -> Hệ thống gọi `pending_ingest_service.py` -> Tạo bản ghi ở trạng thái "Chờ duyệt".
2. Admin vào Dashboard, xem bản nháp và bấm "Approve".
3. Lệnh được đẩy tới `ingest_orchestration_service.py`.
4. Gọi `checksum_service.py` để kiểm tra PDF đã tồn tại hay trùng lặp chưa (Dedup).
5. Tải file PDF gốc lên Supabase qua `file_storage_service.py`.
6. Thực hiện Chunking (cắt nhỏ văn bản) và nhúng (Embed) bằng OpenAI.
7. Đẩy Chunk vào ChromaDB. Cập nhật `Document` trong Firestore thành "Active".

## 8. Luồng Search Tài liệu
1. Client gọi `GET /api/search?q=thuốc`.
2. Router gọi `SearchService` hoặc `MultiSourceSearchService`.
3. Backend biến truy vấn thành vector thông qua OpenAI embeddings.
4. Truy vấn Vector (Semantic Search) trong ChromaDB.
5. Lấy danh sách Chunk IDs, sau đó query sang Firestore để lấy thông tin `Document` tương ứng (metadata).
6. Ghép snippet (trích đoạn văn bản) vào Response trả về cho người dùng.

## 9. Luồng Document Detail + Xem PDF
1. User bấm vào kết quả tìm kiếm trên Frontend (`DocumentDetailPage.jsx`).
2. Frontend gọi `GET /api/documents/{id}`.
3. Backend (`document_service.py`) query Firestore để lấy chi tiết version mới nhất.
4. Gọi `file_storage_service.py` để sinh **Presigned URL** (link có thời hạn) từ Supabase.
5. Frontend sử dụng URL đó nhúng vào thẻ `<iframe src={url}>` để hiển thị bản PDF vật lý.

## 10. Luồng Hỏi đáp AI (Ask AI) có trích dẫn
1. Frontend gửi câu hỏi qua `POST /api/ask`.
2. `AskService` tiếp nhận, xác thực User/Conversation ID.
3. Chuyển ngữ cảnh sang `AskContextService`: Gọi ChromaDB để lấy ra các chunks liên quan tới câu hỏi nhất.
4. Bọc câu hỏi và các ngữ cảnh (context) này vào một Prompt chuẩn (`prompt_registry.py`). Lệnh cho AI: "Chỉ được trả lời dựa trên Context sau đây...".
5. Gửi lên OpenAI LLM và stream kết quả về Frontend bằng Server-Sent Events (SSE).

## 11. Articles / News / Blog
- Tin tức không nằm trong hệ thống RAG (không nhúng vector), nó nằm trong Collection riêng (`articles`).
- Trực tiếp render trên `BlogPage.jsx` và `ArticleDetailPage.jsx`. Phục vụ mục đích cập nhật tin y tế hằng ngày cho User.

## 12. Fetch Bộ Y tế / PubMed / Europe PMC
- Nằm trong thư mục `src/backend/app/services/` với các file như `pubmed_fetcher.py`, `moh_fetcher.py`, `europe_pmc_fetcher.py`.
- Các Script này kết nối tới API mở của NCBI/PubMed, cào tin tức HTML từ Bộ Y tế, phân tách và bóc lõi thông tin. Sau đó lưu vào Firestore (Bảng Articles hoặc PendingIngests).

## 13. Frontend Pages / Components / API Clients
- **Pages chính:** `HomePage.jsx` (Landing), `SearchPage.jsx`, `AskPage.jsx`, `BlogPage.jsx`, `DocumentDetailPage.jsx`.
- **Components chính:** `KnowledgeSearchBar.jsx` (Khung tìm kiếm), `ChatInput.jsx`, `Sidebar.jsx`, `KnowledgePreviewSection.jsx`.
- **API Clients (`frontend/src/api/`):** Nơi chứa cấu hình Axios. (Ví dụ: `searchApi.js`, `adminApi.js`, `ragapi.js`).

## 14. Admin Dashboard / Governance
- Là trang quản trị tri thức tối cao (`admin_governance.py`).
- Admin có thể xem toàn bộ các lệnh đang kẹt trong `pending-ingests`.
- Có quyền can thiệp vào vòng đời tài liệu: Phê duyệt (Approve), Từ chối (Reject), Vô hiệu hóa (Deactivate - khi tài liệu có sai sót).
- Theo dõi lịch sử Ingest pipeline thông qua Bảng Ingest Jobs.

## 15. Storage Supabase / Firebase và File URL
- File PDF gốc được lưu tại Supabase (`file_storage_service.py`).
- Backend **không lưu file** trên đĩa server (ngoại trừ file nháp tmp khi xử lý).
- Mọi link truy cập File đều là Temporary URL (có token mã hoá và hết hạn sau 30 phút) để bảo mật tài liệu nội bộ.

## 16. Test / Smoke Scripts
- Đặt tại thư mục `tests/`. Chạy bằng Pytest.
- Có các file quan trọng như: `test_search_relevance_and_preview.py` (kiểm tra độ chính xác tìm kiếm), `test_ask_boundary.py` (kiểm tra chat), `test_authorization_policy.py` (kiểm thử phân quyền Auth).

## 17. Bảng Use Case (UC01 - UC15)

| Mã UC | Tên Use Case | Tác nhân (Actor) | Mô tả ngắn |
|---|---|---|---|
| UC01 | Tra cứu tài liệu (Search) | Guest/User | Tìm tài liệu y khoa theo từ khóa / ngữ nghĩa. |
| UC02 | Hỏi đáp với AI (Ask AI) | Guest/User | Trò chuyện với trợ lý AI trên cơ sở tài liệu RAG. |
| UC03 | Đọc tin tức y tế (Blog) | Guest/User | Xem danh sách và chi tiết các bài báo sức khỏe mới. |
| UC04 | Xem chi tiết Document & PDF | Guest/User | Xem metadata tài liệu và file PDF bản gốc. |
| UC05 | Xác thực (Login/Register) | All | Đăng nhập hệ thống qua Email/SĐT/Google. |
| UC06 | Quản lý Nguồn (Sources) | Admin | Thêm, sửa, ngưng kích hoạt các website nguồn tin. |
| UC07 | Tải lên tài liệu nội bộ | Admin | Admin chủ động upload PDF từ máy tính. |
| UC08 | Tự động cập nhật Nguồn | n8n / Scheduler | Workflow tự động kéo web và đẩy vào Pending. |
| UC09 | Duyệt tài liệu (Governance) | Admin | Kiểm tra và Approve bài nháp trong Pending list. |
| UC10 | Vô hiệu hoá tài liệu lỗi | Admin | Xóa/ẩn tài liệu có thông tin y khoa sai lệch. |
| UC11 | Theo dõi tiến trình (Jobs) | Admin | Xem pipeline cắt chunk/nhúng vector thành công/lỗi. |
| UC12 | Tạm tải file chat (Upload) | User | Upload PDF cá nhân để hỏi nhanh trong phiên chat. |
| UC13 | Phản hồi (Feedback) | User | Like/Dislike/Report chất lượng câu trả lời của AI. |
| UC14 | Xem Thống kê (Analytics) | Admin | Xem tổng số Token, số tài liệu, lượt tìm kiếm. |
| UC15 | Phân quyền User | Admin | Gán/Xóa quyền Admin cho các tài khoản. |

## 18. Logic Code cần ôn cho từng Flow
- **Luồng Ingest:** Tập trung vào `src/backend/app/services/ingest_orchestration_service.py` (Hàm `process_approved_document()`). Ôn cách gọi dedup, storage, chunking, và ChromaDB tuần tự.
- **Luồng Ask AI:** Tập trung vào `src/backend/app/services/ask_service.py` (Hàm `prepare_answer()` và `stream_answer_events()`) kết hợp `ask_context_service.py`. Ôn cách stream data SSE.
- **Luồng Authz:** Tập trung vào `src/backend/app/api/dependencies/authz.py`. Ôn cách lấy JWT Header, gọi Firebase Admin decode, check field `role`.
- **Luồng Firestore:** Tập trung vào các file trong `src/backend/app/repositories/`. Ôn cách CRUD với thư viện `google-cloud-firestore`.

## 19. Câu hỏi phản biện và Câu trả lời (Top 3)
**Q1: So với ChatGPT, nền tảng của bạn có gì khác biệt?**
*A1:* ChatGPT có thể "ảo giác" (hallucinate) thông tin y khoa vì nó học từ toàn bộ Internet mà thiếu xác thực. Nền tảng này sử dụng kiến trúc RAG có kiểm duyệt (Governance). AI không được phép trả lời ngoài phạm vi các tài liệu đã được Admin / Bác sĩ phê duyệt (Source-of-Truth), đảm bảo tính an toàn y tế.

**Q2: Tại sao phải tách RAG thành "Search" và "Ask"?**
*A2:* Để đáp ứng thói quen sử dụng đa dạng. Sinh viên Y khoa/Bác sĩ thường thích "Search" (Tra cứu) để tìm ngay tài liệu PDF đối chứng nguyên bản (nhanh và tin cậy tuyệt đối). Trong khi đó, người bệnh/người phổ thông thích "Ask" để AI tóm tắt tài liệu dễ hiểu. Sự tách biệt này chứng minh đây là nền tảng tri thức chứ không phải Chatbot đơn thuần.

**Q3: Cấu hình Ingest của bạn tránh lặp dữ liệu thế nào khi chạy tự động?**
*A3:* Sử dụng Checksum Deduplication (`checksum_service.py`). Khi có tài liệu mới tải lên, hệ thống sẽ tính Hash SHA-256 từ byte của PDF (hoặc text). Nếu mã Hash đã tồn tại trong DB, hệ thống sẽ Bỏ Qua (Skip) không chunk/embed nữa để tiết kiệm chi phí OpenAI. Nếu có chỉnh sửa văn bản, hệ thống sẽ tạo ra một `DocumentVersion` mới.

---
---

# CHEAT SHEET THUYẾT TRÌNH (BẢN TÓM TẮT 1 TRANG)

**1. HỆ THỐNG LÀM GÌ?**
Xây dựng Nền tảng quản trị tri thức y khoa uy tín. Giúp tự động thu thập, kiểm duyệt, lưu trữ và cung cấp tính năng Tìm kiếm & Hỏi đáp (RAG) an toàn, chống bịa đặt thông tin y tế.

**2. KIẾN TRÚC 5 DÒNG**
- **UI:** React SPA đa dạng (Search, Ask, Admin).
- **API:** FastAPI xử lý bất đồng bộ.
- **Logic:** Tách biệt rõ ràng tầng Services (Nghiệp vụ) và Repositories (CSDL).
- **Database:** Firestore (lưu Metadata), ChromaDB (lưu Vectors), Supabase (lưu Files).
- **Core AI:** OpenAI kết hợp kiến trúc RAG (Retrieval-Augmented Generation).

**3. 5 FLOW QUAN TRỌNG NHẤT**
1. **Flow Tra Cứu (Search):** User search -> Search Service -> ChromaDB (Semantic) -> Snippets -> User.
2. **Flow Hỏi Đáp (Ask):** User hỏi -> Context Service kéo Chroma -> Gắn Prompt -> OpenAI sinh trả lời SSE Stream.
3. **Flow Cập Nhật (Crawl):** n8n/Fetchers kéo tin web -> Gửi API backend -> Lưu hàng chờ (Pending).
4. **Flow Duyệt Bài (Governance):** Admin duyệt Pending -> Tính Hash -> Lưu Supabase -> Chunking -> ChromaDB.
5. **Flow Phân Quyền (Authz):** User đăng nhập Firebase -> Backend nhận Token JWT -> Tách Custom Claims Admin.

**4. 5 FILE BACKEND QUAN TRỌNG NHẤT**
1. `services/ask_service.py` (Lõi xử lý hội thoại AI).
2. `services/search_service.py` (Lõi tìm kiếm và lọc).
3. `services/ingest_orchestration_service.py` (Nhạc trưởng điều phối quá trình đẩy tài liệu vào Chroma).
4. `services/pending_ingest_service.py` (Hàng chờ kiểm duyệt).
5. `api/dependencies/authz.py` (Bảo mật, phân quyền).

**5. 5 FILE FRONTEND QUAN TRỌNG NHẤT**
1. `src/pages/SearchPage.jsx` (Giao diện tra cứu đa nguồn).
2. `src/pages/AskPage.jsx` (Giao diện Chatbot tóm tắt).
3. `src/pages/DocumentDetailPage.jsx` (Đọc Metadata và Render PDF Iframe).
4. `src/components/admin/AdminDashboard.jsx` (Bảng điều khiển quản trị).
5. `src/services/authService.js` (Gọi API Firebase Auth).

**6. 5 CÂU TRẢ LỜI PHẢN BIỆN QUAN TRỌNG NHẤT**
1. **Khác biệt cốt lõi:** Có Quản trị (Governance) và Duyệt nguồn (Source of Truth), không như AI chat tự do.
2. **Xử lý trùng lặp:** Tính Checksum SHA-256 ngay khi nhận file (`checksum_service.py`).
3. **Lưu trữ PDF:** Không lưu trên ổ local server, lưu tại Supabase sinh Presigned URL động (bảo mật, dễ scale).
4. **Hiệu suất DB:** Tách Vector vào ChromaDB chuyên dụng, tách Metadata vào Firestore giúp query nhanh không nghẽn.
5. **Role n8n:** Dùng làm worker vệ tinh để tự động hoá cào web (automation pipeline) giảm tải cho Backend chính.
