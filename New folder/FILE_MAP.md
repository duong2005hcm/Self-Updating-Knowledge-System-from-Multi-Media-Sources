# FILE_MAP.md

## Mục tiêu

File này giúp Codex hiểu:

- file hiện tại nào đang giữ vai trò gì trong hệ thống cũ
- file nào nên **giữ**
- file nào nên **refactor**
- file nào nên **hạ vai trò**
- file mới nào cần tạo để chuyển sang **multi-source knowledge management and retrieval platform**

> Lưu ý: mapping này dựa trên cấu trúc file hiện tại đã được mô tả, không giả định toàn bộ repo đã được quét đầy đủ.

---

# 1. Kiến trúc cũ -> kiến trúc mới

## Kiến trúc cũ
Trục chính hiện tại là:
- ask/chat
- conversation memory
- upload tạm
- ingest vào Chroma để phục vụ RAG
- admin knowledge chủ yếu xem metadata/chunks

## Kiến trúc mới
Trục chính phải trở thành:
- source registry
- document lifecycle
- versioning + dedup
- ingest jobs
- document/document-version/chunk model
- search độc lập với chat
- governance/admin operations
- analytics/feedback
- ask/chat là lớp khai thác phía trên

---

# 2. Repo entry points hiện tại

## 2.1 Main FastAPI app
### File
`src/backend/app/app.py`

### Vai trò hiện tại
- mount các router chính
- entrypoint backend app

### Trạng thái
**GIỮ**

### Việc cần làm
- tiếp tục dùng làm app entrypoint
- mount thêm router mới:
  - `/api/sources`
  - `/api/documents`
  - `/api/search`
  - `/api/pipeline/jobs`
  - `/api/feedback`
  - `/api/admin/governance`
  - `/api/admin/analytics`

### Module đích
- API/Application Layer

---

# 3. Infrastructure / shared clients

## 3.1 OpenAI factory
### File
`src/backend/app/config/openai_factory.py`

### Vai trò hiện tại
- singleton OpenAI client

### Trạng thái
**GIỮ**

### Việc cần làm
- giữ singleton
- không nhúng business logic vào đây
- tiếp tục dùng cho ask/summarize/classification khi cần

### Module đích
- shared infrastructure

---

## 3.2 Chroma manager
### File
`src/backend/app/chroma_manager.py`

### Vai trò hiện tại
- singleton / manager cho Chroma client

### Trạng thái
**GIỮ + SỬA NHẸ**

### Việc cần làm
- tiếp tục là lớp truy cập Chroma tập trung
- chuẩn hóa collection access theo document/source-aware metadata
- tránh để các route thao tác Chroma trực tiếp quá nhiều

### Module đích
- retrieval / vector infrastructure

---

# 4. Ask / chat flow

## 4.1 Ask route
### File
`src/backend/app/api/ask.py`

### Vai trò hiện tại
- lõi chat RAG
- validate ownership
- load history
- load upload context tạm
- route mode
- trả JSON/SSE

### Trạng thái
**GIỮ NHƯNG HẠ VAI TRÒ**

### Việc cần làm
- vẫn giữ hoạt động ổn định
- refactor để route mỏng hơn
- chuyển business logic vào service riêng
- cho ask dùng retrieval service chung thay vì tự ôm logic đặc thù
- giảm phụ thuộc vào conversation-only sources
- hỗ trợ hỏi theo document/source/domain đã có trong knowledge repo

### File mới nên tạo
- `src/backend/app/services/ask_service.py`

### Module đích
- Retrieval consumer / AI Q&A feature

---

## 4.2 Chat memory
### File
`src/backend/app/rag/memory/chat_memory.py`

### Vai trò hiện tại
- load history
- summarize/trim conversation

### Trạng thái
**GIỮ NHƯNG KHÔNG PHÁT TRIỂN SÂU**

### Việc cần làm
- chỉ giữ vai trò memory cho chat feature
- không để memory trở thành backbone của toàn hệ thống
- không dùng conversation memory để mô hình hóa knowledge lifecycle

### Module đích
- chat-only support

---

## 4.3 User temporary upload
### File
`src/backend/app/api/user_upload.py`

### Vai trò hiện tại
- upload PDF tạm theo conversation
- lưu Firestore theo conversation

### Trạng thái
**SỬA MẠNH**

### Vấn đề
- quá conversation-centric
- đúng kiểu chatbot upload-and-ask
- không phù hợp nếu muốn có knowledge repository thực sự

### Việc cần làm
Tách thành 2 luồng:
1. temporary upload cho chat session
2. official knowledge upload vào document repository

### File mới nên tạo
- `src/backend/app/api/documents.py`
- `src/backend/app/services/document_service.py`

### Module đích
- document intake / repository

---

# 5. Prompt system

## 5.1 Prompt registry
### File
`src/backend/app/rag/prompting/prompt_registry.py`

### Vai trò hiện tại
- prompt registry trên Firestore
- versioning
- cache TTL
- publish/rollback/audit

### Trạng thái
**GIỮ NHƯNG GIẢM VAI TRÒ TRUNG TÂM**

### Việc cần làm
- tiếp tục dùng cho prompt quản trị
- prompt có thể phục vụ:
  - ask
  - summarization
  - classification
  - ingestion enrichment
- không xem đây là giá trị lõi của sản phẩm

### Module đích
- prompting infrastructure

---

## 5.2 Admin prompts route
### File
`src/backend/app/api/admin_prompts.py`

### Vai trò hiện tại
- quản trị prompt

### Trạng thái
**GIỮ**

### Việc cần làm
- giữ như module phụ trợ admin
- không ưu tiên phát triển thêm nếu source/document/governance chưa xong

### Module đích
- admin tooling

---

# 6. Knowledge admin hiện tại

## 6.1 Admin knowledge route
### File
`src/backend/app/api/admin_knowledge.py`

### Vai trò hiện tại
- list collections
- list chunks
- chunk detail
- grouped
- sources overview
- filter metadata
- clamp/retry quota limit Chroma

### Trạng thái
**SỬA MẠNH - ĐÂY LÀ FILE RẤT QUAN TRỌNG**

### Vấn đề
- hiện còn thiên về Chroma chunk browser
- admin nhìn tri thức ở mức chunk nhiều hơn document lifecycle

### Việc cần làm
Nâng cấp thành knowledge governance admin:
- documents overview
- sources overview
- version overview
- pending documents
- rejected documents
- outdated documents
- duplicate candidates
- ingest job linkage

Chunk inspection vẫn giữ, nhưng là level phụ.

### File mới nên tạo để tách bớt trách nhiệm
- `src/backend/app/api/admin_governance.py`
- `src/backend/app/services/governance_service.py`
- `src/backend/app/api/documents.py`

### Module đích
- governance / admin operations

---

# 7. Ingestion hiện tại

## 7.1 Admin ingest route
### File
`src/backend/app/api/ingest_admin.py`

### Vai trò hiện tại
- ingest admin
- ghi metadata nghiệp vụ vào Chroma

### Trạng thái
**GIỮ NHƯNG REFACTOR**

### Việc cần làm
- route chỉ còn validate + call service
- chuyển logic ingest vào service
- tạo ingest job record
- gắn source/document/version lifecycle
- thêm skip unchanged / version if changed

### File mới nên tạo
- `src/backend/app/services/ingest_service.py`
- `src/backend/app/services/ingest_job_service.py`

### Module đích
- ingest orchestration

---

## 7.2 Doc ingest route
### File
`src/backend/app/api/ingests_doc.py`

### Vai trò hiện tại
- ingest tài liệu
- thêm metadata vào chunks

### Trạng thái
**GIỮ NHƯNG REFACTOR**

### Việc cần làm
- tạo/upsert document
- tạo document version
- dùng checksum service
- đưa metadata mapping vào helper dùng chung
- không build metadata riêng kiểu ad-hoc

### File mới nên tạo
- `src/backend/app/services/checksum_service.py`
- `src/backend/app/services/metadata_mapper.py`
- `src/backend/app/services/versioning_service.py`

### Module đích
- document ingestion

---

## 7.3 Web ingest route
### File
`src/backend/app/api/ingests_web.py`

### Vai trò hiện tại
- ingest web content
- thêm metadata vào chunks

### Trạng thái
**GIỮ NHƯNG REFACTOR**

### Việc cần làm
- support source registry
- canonical URL / checksum
- dedup URL/content
- update existing document if changed
- create version when content changes

### File mới nên tạo
- `src/backend/app/services/source_service.py`
- `src/backend/app/services/checksum_service.py`
- `src/backend/app/services/versioning_service.py`

### Module đích
- source-based web ingestion

---

## 7.4 Embedding store
### File
`src/backend/app/rag/ingestion/embedding_store.py`

### Vai trò hiện tại
- nhận extra metadata
- merge metadata vào từng chunk

### Trạng thái
**GIỮ NHƯNG REFACTOR NHẸ**

### Việc cần làm
- metadata per chunk phải chuẩn hóa theo schema chung
- bắt buộc có:
  - `source_id`
  - `document_id`
  - `version_id`
  - `source_type`
  - `domain`
  - `topic`
  - `status`
  - `priority`
- không cho route tự truyền metadata lộn xộn

### Module đích
- embedding / vector write layer

---

# 8. Auth / identity

## 8.1 Admin auth dependency
### File
`src/backend/app/api/dependencies/admin_auth.py`

### Vai trò hiện tại
- verify Firebase ID token
- check custom claim admin=true

### Trạng thái
**GIỮ**

### Việc cần làm
- tiếp tục dùng cho source/doc/governance/admin analytics routes
- nếu cần thì thêm helper dependency cho user auth / role separation

### Module đích
- auth / RBAC

---

## 8.2 Firebase init
### File
`src/backend/app/rag/memory/firebase_init.py`

### Vai trò hiện tại
- init Firebase env path
- check file tồn tại

### Trạng thái
**GIỮ**

### Việc cần làm
- giữ làm shared firebase initializer
- dần tách khỏi folder `rag/memory` nếu muốn clean kiến trúc hơn
- có thể sau này move sang:
  - `src/backend/app/infrastructure/firebase_init.py`

### Module đích
- infrastructure

---

# 9. Các module mới cần tạo

## 9.1 Source module
### File mới
- `src/backend/app/api/sources.py`
- `src/backend/app/services/source_service.py`
- `src/backend/app/repositories/source_repository.py`
- `src/backend/app/schemas/source.py`
- `src/backend/app/models/source.py`

### Vai trò
- CRUD nguồn
- toggle active
- list/filter sources
- source health metadata
- schedule metadata

---

## 9.2 Document module
### File mới
- `src/backend/app/api/documents.py`
- `src/backend/app/services/document_service.py`
- `src/backend/app/repositories/document_repository.py`
- `src/backend/app/schemas/document.py`
- `src/backend/app/models/document.py`
- `src/backend/app/models/document_version.py`

### Vai trò
- list documents
- document detail
- version history
- document chunks
- official upload / repository integration

---

## 9.3 Search module
### File mới
- `src/backend/app/api/search.py`
- `src/backend/app/services/search_service.py`
- `src/backend/app/services/retrieval_service.py`
- `src/backend/app/schemas/search.py`

### Vai trò
- search độc lập với chat
- keyword / semantic / hybrid
- filter by domain/source/type/status
- document-first result format

---

## 9.4 Ingest jobs module
### File mới
- `src/backend/app/api/pipeline_jobs.py`
- `src/backend/app/services/ingest_job_service.py`
- `src/backend/app/models/ingest_job.py`
- `src/backend/app/schemas/ingest_job.py`

### Vai trò
- track ingest jobs
- status/counters/logs
- recent jobs
- failed jobs
- rerun if needed later

---

## 9.5 Governance module
### File mới
- `src/backend/app/api/admin_governance.py`
- `src/backend/app/services/governance_service.py`

### Vai trò
- approve/reject document
- deactivate/reactivate
- duplicate handling
- outdated handling
- pending review

---

## 9.6 Feedback / analytics module
### File mới
- `src/backend/app/api/feedback.py`
- `src/backend/app/api/admin_analytics.py`
- `src/backend/app/services/feedback_service.py`
- `src/backend/app/services/analytics_service.py`
- `src/backend/app/models/feedback.py`
- `src/backend/app/schemas/feedback.py`

### Vai trò
- user feedback
- admin analytics
- quality insights

---

# 10. Mapping theo lớp kiến trúc mới

## Presentation Layer
Chưa map ở đây nếu hiện tại tập trung backend.
Sau này cần UI cho:
- Home
- Search
- Documents
- Ask
- Admin Sources
- Admin Documents
- Admin Pipeline
- Admin Analytics

## API / Application Layer
### Existing
- `app.py`
- `api/ask.py`
- `api/admin_prompts.py`
- `api/admin_knowledge.py`
- `api/ingest_admin.py`
- `api/ingests_doc.py`
- `api/ingests_web.py`

### New
- `api/sources.py`
- `api/documents.py`
- `api/search.py`
- `api/pipeline_jobs.py`
- `api/admin_governance.py`
- `api/feedback.py`
- `api/admin_analytics.py`

## Knowledge Processing Layer
### Existing
- `rag/ingestion/embedding_store.py`

### New
- `services/metadata_mapper.py`
- `services/checksum_service.py`
- `services/versioning_service.py`
- `services/document_service.py`
- `services/ingest_service.py`

## Retrieval & Intelligence Layer
### Existing
- `api/ask.py`
- `config/openai_factory.py`
- `chroma_manager.py`

### New
- `services/retrieval_service.py`
- `services/search_service.py`
- `services/ask_service.py`

## Data & Orchestration Layer
### Existing
- Firebase auth init
- Firestore-based pieces
- Chroma
- raw uploads storage

### New logical entities
- Source
- Document
- DocumentVersion
- IngestJob
- Feedback

---

# 11. Ưu tiên sửa file theo thứ tự

## Nhóm 1 - sửa trước
1. `src/backend/app/app.py`
2. `src/backend/app/api/ingest_admin.py`
3. `src/backend/app/api/ingests_doc.py`
4. `src/backend/app/api/ingests_web.py`
5. `src/backend/app/rag/ingestion/embedding_store.py`
6. `src/backend/app/api/admin_knowledge.py`

## Nhóm 2 - tạo mới ngay sau đó
1. `src/backend/app/models/source.py`
2. `src/backend/app/models/document.py`
3. `src/backend/app/models/document_version.py`
4. `src/backend/app/models/ingest_job.py`
5. `src/backend/app/services/metadata_mapper.py`
6. `src/backend/app/services/checksum_service.py`
7. `src/backend/app/services/versioning_service.py`
8. `src/backend/app/services/source_service.py`
9. `src/backend/app/services/document_service.py`
10. `src/backend/app/services/ingest_service.py`

## Nhóm 3 - sau khi lifecycle ổn
1. `src/backend/app/api/sources.py`
2. `src/backend/app/api/documents.py`
3. `src/backend/app/api/search.py`
4. `src/backend/app/api/admin_governance.py`
5. `src/backend/app/api/pipeline_jobs.py`

## Nhóm 4 - làm sau
1. `src/backend/app/api/ask.py`
2. `src/backend/app/rag/memory/chat_memory.py`
3. `src/backend/app/api/user_upload.py`

Lý do:
- không để chat tiếp tục kéo toàn dự án về hướng chatbot

---

# 12. Những điều Codex không nên làm

- không xóa `ask.py` chỉ vì nó là chatbot-centric
- không chuyển toàn bộ business logic mới vào `ask.py`
- không tiếp tục mở rộng upload tạm như luồng chính
- không chỉ thêm metadata vào chunks mà bỏ qua document/source layer
- không dùng admin knowledge như chunk browser duy nhất
- không ưu tiên tối ưu casual chat trước source/document/governance

---

# 13. Definition of Done theo file map

Được xem là map xong đúng hướng khi:

- file cũ nào cũng có quyết định rõ: giữ / sửa / hạ vai trò / thay thế
- source/document/version/job trở thành khái niệm thật trong code
- admin knowledge không còn chỉ là viewer cho chunks
- ingest routes không còn trực tiếp mang toàn bộ logic nghiệp vụ
- search được dùng độc lập với ask
- chat vẫn chạy nhưng không còn là entrypoint duy nhất của sản phẩm

