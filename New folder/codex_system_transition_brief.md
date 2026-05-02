# System Transition Brief for Codex

## Mục tiêu của file này

File này dùng để giúp Codex hiểu:

1. Hệ thống hiện tại **không phải bỏ đi hoàn toàn**
2. Hệ thống hiện tại đang là **internal RAG chatbot backend**
3. Hướng mới là **multi-source knowledge system**
4. Chức năng chat sẽ được **giữ lại như một module khai thác tri thức**, không còn là trung tâm hệ thống
5. Cần refactor theo hướng **knowledge lifecycle / governance / ingestion / search / admin operations**

---

# 1. Bối cảnh hiện tại

## 1.1 Hệ thống cũ hiện có gì

Hệ thống backend hiện tại đã có các thành phần tốt và chạy được:

- FastAPI app với router khá rõ ràng
- `/api/ask` xử lý chat RAG
- SSE streaming cho câu trả lời realtime
- quản lý prompt động qua Firestore
- quản lý knowledge metadata trên Chroma
- ingest tài liệu PDF và web
- Firebase auth + custom claim `admin=true`
- upload PDF tạm theo conversation
- chat memory theo conversation

## 1.2 Định vị hiện tại của hệ thống

Hệ thống hiện tại về bản chất là:

> **Internal RAG chatbot backend with admin features**

Điểm mạnh:
- backend ổn
- ingest đã có
- metadata đã có nền
- auth/admin đã có
- chat flow đã chạy được

Điểm yếu:
- toàn bộ kiến trúc vẫn xoay quanh `ask/chat`
- knowledge hiện đóng vai trò phụ trợ cho chat
- upload, memory, prompting đều conversation-centric
- thiếu mô hình quản trị vòng đời tri thức rõ ràng
- thiếu source lifecycle / document lifecycle / versioning / approval / pipeline governance

---

# 2. Kết luận định hướng

## 2.1 Không rewrite toàn bộ

**Không xóa toàn bộ hệ thống cũ.**

Thay vào đó:
- giữ lại phần hạ tầng tốt
- refactor lại định vị và luồng nghiệp vụ
- bổ sung các lớp còn thiếu để biến nó thành **knowledge platform**

## 2.2 Định nghĩa mới của hệ thống

Hệ thống mới phải được hiểu là:

> **Nền tảng thu thập, chuẩn hóa, quản trị, cập nhật và khai thác tri thức đa nguồn**

Chat chỉ là một trong nhiều cách khai thác.

---

# 3. Trạng thái mục tiêu sau khi refactor

Sau refactor, sản phẩm **không được** chỉ còn là:

- user hỏi
- hệ thống trả lời
- admin quản lý nguồn

Nếu như vậy thì vẫn chỉ là RAG nội bộ.

Sản phẩm mục tiêu phải có khả năng:

1. quản lý nguồn dữ liệu đa nguồn
2. ingest/cập nhật theo lịch hoặc theo sự kiện
3. kiểm soát tài liệu mới/cũ/trùng/lỗi
4. quản lý metadata cấp source/document/chunk
5. tìm kiếm tài liệu độc lập với chat
6. duyệt và quản trị knowledge
7. theo dõi pipeline ingest
8. dùng chat như một module truy vấn nâng cao

---

# 4. Tư duy kiến trúc mới

## 4.1 Nguyên tắc

### Nguyên tắc 1
**Knowledge first, chat second**

### Nguyên tắc 2
**Document lifecycle rõ ràng**
- source
- document
- version
- chunk
- retrieval
- feedback
- archive

### Nguyên tắc 3
**Incremental update thay vì ingest lại toàn bộ**

### Nguyên tắc 4
**Search và document browsing là chức năng cấp 1**
Không phải chỉ có chat.

### Nguyên tắc 5
**Admin là người vận hành kho tri thức**
Không phải chỉ là “quản lý prompt/chat”.

---

# 5. Giữ / Sửa / Giảm / Bỏ

## 5.1 Giữ nguyên

Các phần sau nên được giữ:

- FastAPI app structure
- router architecture
- OpenAI singleton
- Chroma client singleton
- Firebase auth + custom claims admin
- ingest PDF/Web pipeline nền
- embedding store
- admin knowledge metadata APIs
- prompt registry/versioning (giữ nhưng giảm vai trò trung tâm)

## 5.2 Giảm vai trò trung tâm

Các phần sau vẫn giữ nhưng không được là lõi hệ thống:

- `/api/ask`
- chat SSE streaming
- conversation route mode
- chat memory
- upload tạm theo conversation

## 5.3 Cần refactor mạnh

Các phần cần thay đổi mạnh:

### A. Từ chunk-centric sang source/document-centric
Hiện hệ thống đang nặng về chunk metadata.

Cần nâng thêm mô hình:
- Source
- Document
- DocumentVersion
- Chunk
- Feedback
- IngestJob

### B. Từ upload tạm sang upload vào kho tri thức
Cần phân biệt:
- upload cá nhân tạm thời cho session chat
- upload chính thức vào knowledge repository

### C. Từ knowledge admin viewer sang knowledge governance
Admin phải quản trị:
- document status
- approval
- duplicate
- outdated
- version
- source health
- ingest logs

### D. Từ ingest vào Chroma sang đồng bộ tri thức
Ingest cần có:
- checksum/hash
- dedup
- versioning
- incremental update
- deactivate/archive bản cũ

## 5.4 Không ưu tiên thêm nữa

Các phần không nên tiếp tục đầu tư sâu trong giai đoạn này:

- casual chat features
- tối ưu hội thoại quá sâu
- memory phức tạp cho chat
- UX chỉ phục vụ trò chuyện kiểu ChatGPT clone

---

# 6. Kiến trúc đích

## 6.1 Các lớp hệ thống

### Layer 1: Presentation Layer
- User UI
- Admin UI

### Layer 2: API / Application Layer
- FastAPI routers
- auth
- business orchestration

### Layer 3: Knowledge Processing Layer
- parse
- clean
- normalize
- metadata enrichment
- dedup
- versioning
- embedding

### Layer 4: Retrieval & Intelligence Layer
- document search
- semantic retrieval
- hybrid search
- rerank
- QA with citation

### Layer 5: Data & Orchestration Layer
- Firebase Auth
- Firestore / PostgreSQL for metadata
- ChromaDB for vectors
- file storage for raw docs
- workflow scheduler / jobs

---

# 7. Module đích cần có

## 7.1 Module giữ từ hệ thống cũ
- ask module
- ingest modules
- admin auth
- prompt registry
- chroma knowledge access

## 7.2 Module mới cần thêm
- sources module
- documents module
- pipeline jobs module
- search module
- feedback module
- analytics module
- approval/governance module

---

# 8. API hướng mới

## 8.1 Giữ
- `/api/ask`
- `/api/admin/prompts`
- các ingest endpoints hiện tại

## 8.2 Nên thêm
- `/api/search`
- `/api/sources`
- `/api/documents`
- `/api/pipeline/jobs`
- `/api/feedback`
- `/api/admin/governance`
- `/api/admin/analytics`

---

# 9. Mô hình dữ liệu đích

## 9.1 Source
Thông tin cấp nguồn:
- id
- name
- type (`web`, `pdf`, `youtube`, `internal`, ...)
- url_or_path
- domain
- active
- schedule
- trust_score
- last_sync_at
- created_by

## 9.2 Document
Thông tin tài liệu logic:
- id
- source_id
- title
- source_type
- status
- current_version
- checksum
- created_by
- effective_at
- expires_at
- tags
- domain
- priority

## 9.3 DocumentVersion
- id
- document_id
- version_no
- raw_path
- extracted_text
- checksum
- created_at
- ingest_job_id
- status

## 9.4 Chunk
- id
- document_id
- version_id
- chunk_index
- content
- embedding_ref
- metadata

## 9.5 Feedback
- id
- user_id
- target_type (`answer`, `document`, `source`)
- target_id
- vote
- reason
- created_at

## 9.6 IngestJob
- id
- source_id
- status
- started_at
- finished_at
- processed_count
- created_count
- updated_count
- skipped_count
- failed_count
- logs

---

# 10. User flow mới

## 10.1 User không chỉ chat

User cần có thể:
- tìm tài liệu
- lọc theo domain / source / thời gian
- mở document detail
- xem tài liệu liên quan
- hỏi đáp AI trên kho tri thức
- feedback chất lượng câu trả lời hoặc tài liệu

## 10.2 Admin không chỉ quản lý prompt
Admin cần có thể:
- thêm/sửa/bật/tắt nguồn
- chạy hoặc theo dõi ingest jobs
- xem tài liệu mới
- duyệt / reject tài liệu
- xử lý duplicate / outdated
- xem feedback / analytics
- tinh chỉnh chất lượng kho tri thức

---

# 11. Demo định hướng mới

## Không nên demo theo thứ tự:
1. mở chat
2. hỏi
3. trả lời

## Nên demo theo thứ tự:
1. thêm hoặc xem nguồn dữ liệu
2. chạy ingest / xem pipeline log
3. xem document đã vào kho
4. xem metadata / version / source
5. search tài liệu
6. cuối cùng mới demo ask/chat

Điều này giúp sản phẩm được nhìn như knowledge system, không phải chatbot clone.

---

# 12. Firebase có dùng được không?

## 12.1 Có thể dùng Firebase không?
**Có. Firebase dùng được.**

Đặc biệt phù hợp cho:

### Firebase Authentication
Dùng rất hợp cho:
- đăng nhập
- quản lý user
- role admin bằng custom claims

Điều này phù hợp với hệ thống hiện tại và nên giữ tiếp.

### Firestore
Có thể tiếp tục dùng cho:
- prompt registry
- user profiles
- lightweight settings
- feedback nhẹ
- ingest job logs ở mức vừa
- metadata nhẹ hoặc audit trail đơn giản

## 12.2 Firebase không nên ôm hết mọi thứ

Không nên ép Firebase/Firestore ôm toàn bộ hệ thống tri thức nếu dữ liệu sẽ lớn và cần query quản trị phức tạp.

### Không phù hợp để làm vector store
Vector store nên tiếp tục dùng:
- ChromaDB

### Không lý tưởng nếu metadata trở nên phức tạp và cần truy vấn quan hệ mạnh
Ví dụ:
- documents
- versions
- approvals
- source relationships
- reporting
- analytics nhiều chiều

Khi đó nên cân nhắc:
- PostgreSQL cho metadata nghiệp vụ chính

## 12.3 Kết luận về Firebase
### Phương án thực dụng nhất
- **Giữ Firebase Auth**
- **Có thể giữ Firestore cho prompt registry và một số metadata/log nhẹ**
- **Dùng ChromaDB cho vector**
- **Nếu hệ thống metadata knowledge phức tạp hơn, thêm PostgreSQL cho phần business data**

### Nếu muốn tối giản để tận dụng code cũ
Có thể đi giai đoạn 1 như sau:
- Firebase Auth
- Firestore cho source/document/job metadata bản đầu
- ChromaDB cho embeddings
- local/object storage cho raw files

Sau đó nếu metadata phức tạp quá mới tách PostgreSQL.

---

# 13. Quy tắc thiết kế cho Codex

Khi sửa code, ưu tiên các nguyên tắc sau:

1. Không phá vỡ chat flow hiện có nếu không cần
2. Không rewrite toàn bộ project
3. Thêm module mới thay vì nhét logic knowledge lifecycle vào ask route
4. Tách rõ source/document/version/chunk
5. Bổ sung incremental ingest
6. Bổ sung document-centric APIs
7. UI/UX định hướng knowledge portal, không phải chỉ chat
8. Ask/chat phải trở thành feature phụ, không phải entry point duy nhất

---

# 14. Mục tiêu code refactor gần nhất

## Phase 1
- giữ hệ thống chat hiện có
- thêm model Source / Document / IngestJob
- thêm APIs cho sources/documents/jobs
- chuẩn hóa ingest metadata

## Phase 2
- thêm dedup + checksum + versioning
- thêm search endpoint độc lập với ask
- thêm admin governance endpoints

## Phase 3
- thêm UI knowledge dashboard
- document browser
- source manager
- pipeline monitor
- ask UI chỉ là một tab chức năng

---

# 15. Kết luận ngắn cho Codex

Dự án này **không còn được xem là chỉ một RAG chatbot nội bộ**.

Mục tiêu refactor là:

> chuyển từ **conversation-centric RAG assistant**
> sang **multi-source knowledge management and retrieval platform**

Trong đó:
- ingest, governance, source lifecycle, document lifecycle là lõi
- chat chỉ là một lớp khai thác phía trên kho tri thức

