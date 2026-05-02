# TASKS.md

## Mục tiêu

File này chia việc cho Codex để refactor hệ thống hiện tại từ:

> internal RAG chatbot backend

thành:

> multi-source knowledge management and retrieval platform

Nguyên tắc quan trọng:

- **Không rewrite toàn bộ project**
- **Không phá chat flow đang chạy nếu không cần**
- **Giữ chat như module phụ**
- **Đưa source/document/version/job/governance lên trung tâm**
- **Ưu tiên làm theo phase**
- **Mỗi phase phải chạy được trước khi sang phase tiếp theo**

---

# 0. Tổng quan chiến lược

## Giữ lại
- FastAPI app structure
- router architecture hiện có
- Firebase auth + admin custom claims
- Chroma integration
- OpenAI factory
- ingest nền cho PDF/Web
- admin knowledge metadata APIs
- prompt registry/versioning
- ask/chat route

## Giảm vai trò trung tâm
- `/api/ask`
- chat memory
- upload tạm theo conversation
- SSE streaming
- prompt tuning chỉ phục vụ chat

## Thêm mới
- source management
- document management
- document versioning
- ingest jobs tracking
- search độc lập với chat
- governance / approval workflow
- analytics / feedback nền tảng

---

# 1. Phase 1 — Thiết lập knowledge-centric data model

## Mục tiêu
Tạo mô hình dữ liệu để hệ thống không còn chỉ xoay quanh conversation/chunk.

## Kết quả mong muốn
- có model rõ cho `Source`, `Document`, `DocumentVersion`, `IngestJob`, `Feedback`
- ingest metadata không chỉ nằm rải rác trong chunk metadata
- có abstraction để backend làm việc theo document lifecycle

## File hiện có cần xem / sửa
- `src/backend/app/api/ingest_admin.py`
- `src/backend/app/api/ingests_doc.py`
- `src/backend/app/api/ingests_web.py`
- `src/backend/app/rag/ingestion/embedding_store.py`
- `src/backend/app/api/admin_knowledge.py`

## File mới nên tạo
- `src/backend/app/models/source.py`
- `src/backend/app/models/document.py`
- `src/backend/app/models/document_version.py`
- `src/backend/app/models/ingest_job.py`
- `src/backend/app/models/feedback.py`

## Việc cần làm

### 1.1 Tạo model Source
Trường tối thiểu:
- `id`
- `name`
- `type`
- `url_or_path`
- `domain`
- `active`
- `schedule`
- `trust_score`
- `last_sync_at`
- `created_by`
- `created_at`
- `updated_at`

### 1.2 Tạo model Document
Trường tối thiểu:
- `id`
- `source_id`
- `title`
- `source_type`
- `status`
- `domain`
- `topic`
- `priority`
- `checksum`
- `current_version`
- `created_by`
- `created_at`
- `updated_at`
- `effective_at`
- `expires_at`

### 1.3 Tạo model DocumentVersion
Trường tối thiểu:
- `id`
- `document_id`
- `version_no`
- `raw_path`
- `extracted_text`
- `checksum`
- `ingest_job_id`
- `status`
- `created_at`

### 1.4 Tạo model IngestJob
Trường tối thiểu:
- `id`
- `source_id`
- `status`
- `started_at`
- `finished_at`
- `processed_count`
- `created_count`
- `updated_count`
- `skipped_count`
- `failed_count`
- `logs`

### 1.5 Tạo model Feedback
Trường tối thiểu:
- `id`
- `user_id`
- `target_type`
- `target_id`
- `vote`
- `reason`
- `created_at`

### 1.6 Chuẩn hóa metadata mapping
Tạo helper chuẩn hóa metadata dùng chung:
- map từ source/document/version sang chunk metadata
- không còn để từng ingest route tự build metadata khác nhau

## File mới nên tạo thêm
- `src/backend/app/services/metadata_mapper.py`

## Tiêu chí hoàn thành
- Có thể tạo object/document record thống nhất cho mỗi lần ingest
- Ingest route không còn hardcode metadata manh mún
- Chunk metadata có `document_id`, `version_id`, `source_id` rõ ràng

---

# 2. Phase 2 — Thêm source registry và APIs quản lý nguồn

## Mục tiêu
Tạo khả năng quản lý nguồn dữ liệu như một thực thể độc lập.

## Kết quả mong muốn
- admin có thể CRUD source
- hệ thống có thể lấy danh sách source active để ingest
- source có trạng thái, lịch cập nhật, domain, trust

## File hiện có cần xem / sửa
- `src/backend/app/app.py`
- `src/backend/app/api/dependencies/admin_auth.py`

## File mới nên tạo
- `src/backend/app/api/sources.py`
- `src/backend/app/services/source_service.py`
- `src/backend/app/repositories/source_repository.py`
- `src/backend/app/schemas/source.py`

## Việc cần làm

### 2.1 Tạo API source management
Tối thiểu cần các endpoint:
- `GET /api/sources`
- `GET /api/sources/{source_id}`
- `POST /api/sources`
- `PUT /api/sources/{source_id}`
- `PATCH /api/sources/{source_id}/toggle`
- `DELETE /api/sources/{source_id}`

### 2.2 Thêm filter
Source list phải filter được theo:
- `type`
- `active`
- `domain`

### 2.3 Gắn admin auth
Chỉ admin mới được CRUD source.

### 2.4 Mount router vào app
Cập nhật:
- `src/backend/app/app.py`

## Tiêu chí hoàn thành
- Admin có thể tạo/sửa/bật tắt nguồn
- API source hoạt động độc lập với chat
- Source trở thành entry point cho ingest

---

# 3. Phase 3 — Refactor ingest thành document lifecycle + incremental update

## Mục tiêu
Biến ingest từ “đẩy dữ liệu vào Chroma” thành “đồng bộ tri thức có kiểm soát”.

## Kết quả mong muốn
- có dedup theo checksum/url/content hash
- có versioning khi tài liệu thay đổi
- có ingest job log
- tài liệu cũ có thể giữ version hoặc deactivate

## File hiện có cần sửa mạnh
- `src/backend/app/api/ingest_admin.py`
- `src/backend/app/api/ingests_doc.py`
- `src/backend/app/api/ingests_web.py`
- `src/backend/app/rag/ingestion/embedding_store.py`
- `src/backend/app/api/admin_knowledge.py`

## File mới nên tạo
- `src/backend/app/services/ingest_service.py`
- `src/backend/app/services/document_service.py`
- `src/backend/app/services/checksum_service.py`
- `src/backend/app/services/versioning_service.py`
- `src/backend/app/services/ingest_job_service.py`

## Việc cần làm

### 3.1 Tạo checksum service
Hỗ trợ checksum theo:
- file bytes
- raw text
- normalized content
- canonical URL nếu là web source

### 3.2 Tạo document upsert flow
Logic:
- tìm document hiện có theo source + external identifier/url/title heuristic
- nếu checksum không đổi -> skip ingest
- nếu checksum đổi -> tạo version mới
- nếu là tài liệu mới -> tạo document mới

### 3.3 Tạo ingest job record
Mỗi lần ingest cần:
- start job
- track status
- lưu counters
- lưu lỗi
- finish job

### 3.4 Chuẩn hóa trạng thái ingest
Ví dụ:
- `pending`
- `running`
- `success`
- `partial_success`
- `failed`
- `skipped`

### 3.5 Gắn document/version metadata vào chunk
Mỗi chunk cần ít nhất:
- `source_id`
- `document_id`
- `version_id`
- `source_type`
- `domain`
- `topic`
- `status`
- `priority`

### 3.6 Refactor admin ingest endpoints
Đưa logic nghiệp vụ vào service layer, route chỉ còn:
- validate
- gọi service
- trả response

## Tiêu chí hoàn thành
- ingest cùng tài liệu 2 lần không tạo bản ghi trùng vô lý
- tài liệu sửa nội dung sẽ tạo version mới
- admin nhìn thấy ingest job result

---

# 4. Phase 4 — Tạo document-centric APIs và knowledge governance

## Mục tiêu
Chuyển admin knowledge từ chunk browser sang knowledge governance module.

## Kết quả mong muốn
- admin xem được danh sách document
- xem version
- xem duplicate/outdated/pending
- approve/reject/deactivate document
- chunk chỉ còn là lớp chi tiết phía dưới document

## File hiện có cần sửa
- `src/backend/app/api/admin_knowledge.py`

## File mới nên tạo
- `src/backend/app/api/documents.py`
- `src/backend/app/api/admin_governance.py`
- `src/backend/app/services/governance_service.py`
- `src/backend/app/repositories/document_repository.py`
- `src/backend/app/schemas/document.py`

## Việc cần làm

### 4.1 Tạo documents API
Endpoints tối thiểu:
- `GET /api/documents`
- `GET /api/documents/{document_id}`
- `GET /api/documents/{document_id}/versions`
- `GET /api/documents/{document_id}/chunks`

### 4.2 Tạo governance API
Endpoints tối thiểu:
- `PATCH /api/admin/governance/documents/{document_id}/approve`
- `PATCH /api/admin/governance/documents/{document_id}/reject`
- `PATCH /api/admin/governance/documents/{document_id}/deactivate`
- `PATCH /api/admin/governance/documents/{document_id}/reactivate`

### 4.3 Nâng cấp admin knowledge overview
Thay vì chỉ xem collection/chunks, cần thêm:
- documents overview
- sources overview
- pending documents
- outdated documents
- duplicates
- status counts

### 4.4 Bổ sung grouped views theo document/source
Tránh UI admin chỉ nhìn chunks rời rạc.

## Tiêu chí hoàn thành
- admin thao tác được trên document lifecycle
- knowledge admin không còn bị định vị là “viewer cho Chroma chunks”

---

# 5. Phase 5 — Tạo search độc lập với chat

## Mục tiêu
Cho phép user khai thác tri thức mà không cần vào chat.

## Kết quả mong muốn
- có endpoint search tài liệu/chunks
- có filter theo source/domain/type/time
- chat không còn là entry point duy nhất

## File hiện có cần xem / sửa
- `src/backend/app/api/ask.py`
- `src/backend/app/api/admin_knowledge.py`

## File mới nên tạo
- `src/backend/app/api/search.py`
- `src/backend/app/services/search_service.py`
- `src/backend/app/services/retrieval_service.py`
- `src/backend/app/schemas/search.py`

## Việc cần làm

### 5.1 Tạo search endpoint
Endpoints tối thiểu:
- `GET /api/search`
- `POST /api/search`

### 5.2 Hỗ trợ search modes
Ít nhất:
- keyword-like search
- semantic search
- hybrid search

### 5.3 Hỗ trợ filters
- `source_type`
- `domain`
- `status`
- `priority`
- `created_by`
- thời gian

### 5.4 Trả về document-first result
Response nên gồm:
- document summary
- source info
- snippet/chunks liên quan
- metadata
- score

### 5.5 Không phụ thuộc ask route
Search phải dùng được độc lập, không cần conversation.

## Tiêu chí hoàn thành
- user có thể tra cứu kho tri thức mà không cần hỏi đáp
- search hoạt động như chức năng cấp 1

---

# 6. Phase 6 — Giữ ask nhưng hạ xuống thành module phụ

## Mục tiêu
Giữ toàn bộ ask/chat để không mất tính năng, nhưng đổi vai trò của nó trong kiến trúc.

## Kết quả mong muốn
- `/api/ask` vẫn hoạt động
- ask dùng document/source-aware retrieval
- ask không ôm logic quản trị tri thức
- ask trở thành lớp khai thác phía trên search/retrieval layer

## File hiện có cần sửa
- `src/backend/app/api/ask.py`
- `src/backend/app/rag/memory/chat_memory.py`
- `src/backend/app/api/user_upload.py`

## File mới nên tạo
- `src/backend/app/services/ask_service.py`

## Việc cần làm

### 6.1 Tách business logic khỏi ask route
Route chỉ:
- auth
- validate conversation
- parse request
- gọi ask service

### 6.2 Cho ask dùng retrieval service chung
Không tự build retrieval logic riêng nếu không cần.

### 6.3 Giảm sự phụ thuộc vào upload tạm
Upload conversation chỉ là phụ.
Cần chuẩn bị khả năng:
- chọn document có sẵn trong knowledge repository
- hỏi trên collection/domain cụ thể

### 6.4 Giữ SSE streaming nếu đang ổn
Nhưng không đầu tư thêm tính năng chat nếu chưa hoàn thành phase trước.

## Tiêu chí hoàn thành
- chat vẫn chạy
- chat không còn là trung tâm logic kiến trúc
- hỏi đáp bám theo kho tri thức đã quản trị

---

# 7. Phase 7 — Feedback và analytics nền tảng

## Mục tiêu
Tạo vòng phản hồi để cải thiện chất lượng tri thức và retrieval.

## Kết quả mong muốn
- user feedback được lưu có cấu trúc
- admin xem được feedback theo answer/document/source
- có dashboard cơ bản cho nguồn và chất lượng

## File mới nên tạo
- `src/backend/app/api/feedback.py`
- `src/backend/app/api/admin_analytics.py`
- `src/backend/app/services/feedback_service.py`
- `src/backend/app/services/analytics_service.py`
- `src/backend/app/schemas/feedback.py`

## Việc cần làm

### 7.1 Tạo feedback endpoint
Ví dụ:
- `POST /api/feedback`
- `GET /api/admin/feedback`

### 7.2 Hỗ trợ target types
- answer
- document
- source

### 7.3 Tạo analytics cơ bản
Tối thiểu:
- total sources
- total documents
- total versions
- recent ingest jobs
- failed jobs
- pending documents
- top domains
- feedback breakdown

## Tiêu chí hoàn thành
- admin có dashboard vận hành tri thức
- feedback không còn chỉ là phần chat UX

---

# 8. Phase 8 — Frontend định hướng knowledge portal

## Mục tiêu
Đổi entry point sản phẩm từ chat sang knowledge portal.

## Kết quả mong muốn
- trang đầu là dashboard/portal/search
- chat chỉ là một tab / page
- admin có source manager, document browser, pipeline monitor

## Gợi ý folder frontend nếu cần tạo/sửa
- `src/frontend/pages/Home`
- `src/frontend/pages/Search`
- `src/frontend/pages/Documents`
- `src/frontend/pages/Ask`
- `src/frontend/pages/admin/Sources`
- `src/frontend/pages/admin/Documents`
- `src/frontend/pages/admin/Pipeline`
- `src/frontend/pages/admin/Analytics`

## Việc cần làm

### 8.1 User UI
Ít nhất có:
- Home
- Search
- Document Detail
- Ask AI

### 8.2 Admin UI
Ít nhất có:
- Dashboard
- Source Management
- Documents Management
- Pipeline Jobs
- Analytics

### 8.3 Đổi thứ tự demo
Trang đầu không còn là chat.

## Tiêu chí hoàn thành
- nhìn sản phẩm như knowledge platform
- không còn cảm giác “chỉ là chatbot clone”

---

# 9. Gợi ý dùng Firebase

## Có thể dùng Firebase không?
**Có.**

## Nên tiếp tục dùng cho:
- Firebase Auth
- custom claims `admin=true`
- prompt registry trên Firestore
- feedback nhẹ / audit nhẹ / settings nhẹ
- có thể dùng Firestore cho metadata giai đoạn đầu nếu muốn tận dụng code cũ

## Không nên dùng Firebase cho:
- vector store
- toàn bộ business queries phức tạp nếu metadata hệ thống tăng mạnh

## Hướng thực dụng
### Giai đoạn đầu
- Firebase Auth
- Firestore cho source/document/job metadata bản đầu (nếu muốn nhanh)
- ChromaDB cho vector
- local/object storage cho raw files

### Giai đoạn sau nếu phức tạp
- thêm PostgreSQL cho business metadata quan hệ mạnh

---

# 10. Ưu tiên thực hiện

## Ưu tiên cao nhất
1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5

## Chỉ làm sau khi 1-5 ổn
6. Phase 6
7. Phase 7
8. Phase 8

Lý do:
- nếu làm chat/UI trước, dự án sẽ lại quay về chatbot nội bộ

---

# 11. Definition of Done cho toàn dự án

Dự án được xem là chuyển hướng thành công khi:

- có source registry
- có document lifecycle
- có versioning + dedup cơ bản
- có ingest jobs tracking
- có search độc lập với chat
- có governance/approval cho document
- chat chỉ là module khai thác phía trên
- admin quản trị tri thức, không chỉ quản trị prompt/chroma chunks
- UI nhìn như knowledge portal, không phải chat clone

---

# 12. Ghi chú cuối cho Codex

**Đừng tối ưu thêm cho chatbot trước khi hoàn thành knowledge-centric refactor.**

Khi phân vân giữa:
- thêm tính năng chat
- hay thêm quản trị tri thức / source / documents / jobs

=> luôn ưu tiên:
- source
- document
- version
- job
- governance
- search

Chat là phụ.
