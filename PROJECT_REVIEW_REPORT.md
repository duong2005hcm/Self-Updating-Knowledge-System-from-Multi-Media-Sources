# Báo cáo review tổng thể dự án RAG AI

Ngày review: 2026-04-24  
Phạm vi: đọc lại `AGENTS.md`, `TASKS.md`, `FILE_MAP.md`, `codex_system_transition_brief.md`; rà backend, frontend, dependency, smoke/test hiện có. Không đọc/ghi giá trị bí mật trong `.env`.

## 1. Kết luận ngắn

Dự án đang đi đúng hướng kiến trúc: đây là hệ thống tri thức đa nguồn có AI hỗ trợ khai thác, không phải chatbot lấy hội thoại làm trung tâm.

Backend hiện đã đủ mức runnable cho môi trường dev/demo nếu cấu hình Firebase/Firestore, Chroma/OpenAI và network đúng. Các flow lõi như app boot, health, search keyword, ask boundary, frontend build/lint đều đã kiểm tra được.

Tuy nhiên, dự án chưa nên gọi là production-ready. Các điểm còn cần chốt trước khi vận hành thật gồm: smoke admin/vector chưa được verify trong lần chạy hiện tại, frontend vẫn còn hardcoded admin token ở API ingest cũ, auth frontend đang dạng local demo, user-facing document detail/search portal chưa hoàn chỉnh như sản phẩm cuối.

Ước lượng trạng thái hiện tại:

| Hạng mục | Mức sẵn sàng |
| --- | --- |
| Backend core Phase 1-6 | 80-85% cho dev/demo |
| Search/document/ask architecture | Đúng hướng, đủ nền để tiếp tục |
| Frontend user-facing | 45-55%, mới có landing/search entry |
| Production readiness | 55-60%, còn auth/env/smoke/release gate |

Kết luận GO/NO-GO:

- GO để tiếp tục xây user-facing UI: search page, document detail, ask from document.
- GO để tiếp tục Phase 7/8 sau khi giữ đúng nguyên tắc search-first.
- NO-GO cho production release cho đến khi xử lý các blocker/risk ở mục 6.

## 2. Căn cứ từ 4 file định hướng

Các file định hướng được đọc:

- `New folder/AGENTS.md`
- `New folder/TASKS.md`
- `New folder/FILE_MAP.md`
- `New folder/codex_system_transition_brief.md`

Các nguyên tắc chính rút ra:

- Sản phẩm phải là knowledge platform, không phải ChatGPT clone.
- Firestore/Firebase giữ metadata, source registry, document lifecycle, version, governance, job state.
- Chroma giữ chunk text, embedding, chunk metadata, retrieval candidate.
- Flow sản phẩm đúng: search first -> document detail second -> ask AI third.
- `/api/ask` chỉ nên là consumer của knowledge/search layer.
- Route phải mỏng, logic nằm ở service/repository/retrieval layer.

Đánh giá: code hiện tại đã bám khá đúng các nguyên tắc này. Backend đã có router/service/repository riêng cho source, document, ingest, governance, search, ask. Ask đã được tách qua `AskService` và `AskContextService`, không còn là trung tâm duy nhất của hệ thống.

## 3. Kết quả kiểm tra thực tế

Các kiểm tra đã chạy:

| Kiểm tra | Kết quả | Ghi chú |
| --- | --- | --- |
| Import FastAPI app | PASS | `app import ok 45` routes |
| Ask boundary tests | PASS | `6 passed` |
| Backend smoke core | PASS | `/`, `/api/health`, keyword search pass khi cho phép network |
| Backend smoke admin | SKIP | thiếu `SMOKE_ADMIN_TOKEN` |
| Backend smoke vector | SKIP | thiếu `SMOKE_ENABLE_VECTOR=1` và vector env trong smoke run |
| Frontend lint | PASS | `npm.cmd run lint` |
| Frontend build | PASS | `npm.cmd run build` |

Lưu ý: smoke backend chạy trong sandbox không có network bị fail ở Firestore connection. Khi chạy với quyền network thì core smoke pass. Đây là vấn đề môi trường kiểm thử, không phải lỗi logic trực tiếp của app.

Có một warning dependency:

- `RequestsDependencyWarning`: phiên bản `urllib3/chardet/charset_normalizer` trong môi trường hiện tại không khớp kỳ vọng của `requests`.
- Chưa gây fail test, nhưng cần làm sạch venv/dependency trước release.

## 4. Đánh giá kiến trúc hiện tại

### 4.1 Backend

Backend hiện có cấu trúc đúng:

- API layer:
  - `sources`
  - `documents`
  - `search`
  - `pipeline_jobs`
  - `admin_governance`
  - `admin_knowledge`
  - `ingest_admin`
  - `ask`
- Service layer:
  - `SourceService`
  - `DocumentService`
  - `IngestOrchestrationService`
  - `SearchService`
  - `AskService`
  - `AskContextService`
  - `GovernanceService`
- Repository layer:
  - source/document/version/job repositories
  - chunk repository cho Chroma

Điểm đúng hướng:

- Search không phụ thuộc ask.
- Keyword search đã được tách khỏi Chroma để tránh chết theo vector backend.
- Semantic/hybrid dùng Chroma đúng vai trò retrieval.
- PDF ingest đã có `raw_path`, `extracted_text`, `chunk_index`.
- Ask đã chuyển dần sang consumer của knowledge layer.

Điểm cần tiếp tục giữ:

- Không đưa workaround vào route.
- Không để ask quay lại tự làm retrieval riêng.
- Không mở UI theo hướng vào là chat đầu tiên.

### 4.2 Frontend

Frontend hiện đã có landing page user-facing theo hướng knowledge platform:

- Hero giới thiệu nền tảng tri thức.
- Search entry nổi bật.
- Capability cards.
- Flow: tìm kiếm -> mở tài liệu -> hỏi AI.
- Preview tài liệu/nguồn tri thức.

Điểm đúng hướng:

- Landing page không chat-centric.
- User được dẫn vào search trước.
- AI được trình bày là lớp hỗ trợ khai thác tri thức.

Điểm chưa hoàn chỉnh:

- Chưa có search page đầy đủ.
- Chưa có document detail user-facing đầy đủ.
- Chưa có flow hỏi AI từ context tài liệu hoàn chỉnh ở UI.
- Auth frontend hiện còn dạng localStorage demo, chưa phải Firebase auth production.

## 5. Những phần đang vận hành được

Các phần có thể coi là đã có nền vận hành:

- App boot và health.
- Source/document/governance/search routers đã được mount.
- Keyword search pass smoke.
- Ask boundary tests pass.
- PDF ingest pipeline đã được harden trước đó.
- Frontend landing page build/lint pass.
- Dependency runtime đã có source of truth rõ hơn qua `requirements.txt`.

Các phần cần verify live thêm:

- Admin source CRUD với token thật.
- Admin governance với token thật.
- Semantic/hybrid smoke với Chroma/OpenAI env thật.
- PDF ingest trên nhiều file phổ biến hơn, đặc biệt PDF scan/ảnh chưa OCR.

## 6. Lỗi/rủi ro cần xử lý

### P0 - Hardcoded admin token trong frontend ingest cũ

`frontend/src/api/ragapi.js` còn dùng:

- `Authorization: "Bearer super_secret_admin"` cho `ingestDoc`
- `Authorization: "Bearer super_secret_admin"` cho `ingestWeb`

Đây là vấn đề nghiêm trọng nếu UI admin này còn được dùng:

- Không đúng với Firebase ID token flow.
- Không an toàn.
- Dễ gây hiểu nhầm là upload admin hoạt động trong khi backend yêu cầu token thật.

Khuyến nghị:

- Bỏ hardcoded token.
- Truyền Firebase ID token từ auth layer.
- Nếu chưa làm admin UI, ẩn/ngắt các entry ingest admin khỏi user-facing frontend.

### P0 - Auth frontend chỉ phù hợp demo

`frontend/src/auth/users.js` và `frontend/src/auth/session.js` đang lưu user/session bằng localStorage. Password cũng nằm trong localStorage ở frontend.

Điều này chỉ chấp nhận cho demo UI nội bộ, không chấp nhận cho sản phẩm thật.

Khuyến nghị:

- Tích hợp Firebase Auth thật cho frontend.
- Không lưu password client-side.
- Dùng ID token để gọi backend protected APIs.

### P1 - Smoke admin/vector chưa bắt buộc trong release gate

Lần smoke hiện tại pass core nhưng skip:

- admin source/document/governance do thiếu `SMOKE_ADMIN_TOKEN`
- semantic/hybrid do chưa bật `SMOKE_ENABLE_VECTOR=1`

Khuyến nghị:

- Tạo profile smoke release bắt buộc có admin token.
- Tạo profile smoke vector bắt buộc check semantic/hybrid khi có Chroma/OpenAI env.
- Nếu semantic/hybrid fail thì không release.

### P1 - User-facing document detail policy chưa được code hóa đầy đủ ở frontend

Backend documents router hiện vẫn nghiêng về admin/protected flow. Product direction yêu cầu user search xong mở document detail.

Khuyến nghị:

- Phase UI tiếp theo cần chốt endpoint/user policy:
  - metadata nào user xem được
  - chunk/snippet nào user xem được
  - có cần auth user không
  - tài liệu private/public xử lý ra sao

### P1 - PDF scan/image chưa có OCR

Pipeline hiện xử lý text PDF tốt hơn trước, nhưng chưa phải OCR system. PDF dạng ảnh/scan có thể extract rỗng hoặc chất lượng thấp.

Khuyến nghị:

- Chưa cần làm OCR lớn ngay.
- Trước release cần phân loại PDF: text PDF pass, image PDF trả cảnh báo rõ hoặc queue OCR sau.

### P2 - Dependency warning trong môi trường hiện tại

Warning `requests/urllib3/chardet/charset_normalizer` cho thấy môi trường Python có thể chưa sạch.

Khuyến nghị:

- Tạo venv mới từ `requirements.txt`.
- Chạy lại pytest/smoke.
- Nếu warning còn tồn tại, pin rõ bộ dependency tương thích.

### P2 - Legacy RAG path vẫn còn để compatibility

Các nhánh legacy như `simple_rag`/retrieval cũ đã được giảm vai trò, nhưng vẫn còn trong codebase.

Khuyến nghị:

- Giữ comment boundary rõ.
- Không cho `/api/ask` hoặc `AskService` gọi trực tiếp legacy retrieval.
- Sau khi Phase 7/8 ổn định, mới xóa có kiểm soát.

## 7. Hướng tối ưu hệ thống

Ưu tiên tối ưu theo thứ tự:

1. Release gate chặt hơn:
   - `pytest`
   - backend smoke core
   - backend smoke admin
   - backend smoke vector
   - frontend lint/build

2. Chuẩn hóa auth/token:
   - Firebase Auth ở frontend
   - ID token cho protected backend APIs
   - không hardcoded admin token

3. Hoàn thiện user-facing product flow:
   - search page
   - document detail
   - ask from selected document/search result

4. Tăng độ tin cậy ingest:
   - audit extracted text
   - cảnh báo PDF scan
   - retry/error state rõ trong ingest jobs

5. Observability tối thiểu:
   - log request/job/search mode
   - log semantic candidate count
   - log ingest extraction/chunk count

6. Chuẩn bị Phase 7:
   - feedback hữu ích/không hữu ích
   - lưu feedback gắn với document/chunk/answer
   - chưa nên làm analytics phức tạp trước khi UI flow ổn.

## 8. Đánh giá theo định hướng sản phẩm

Flow mong muốn:

1. Home: user thấy knowledge platform, search entry, tài liệu/nguồn tri thức.
2. Search: user tìm tài liệu theo keyword/semantic/hybrid.
3. Document detail: user xem metadata, version, snippet/chunk liên quan.
4. Ask AI: user hỏi dựa trên context tri thức đã chọn.

Hiện trạng:

- Bước 1: đã bắt đầu đúng với landing page.
- Bước 2: backend có API search; frontend search page đầy đủ chưa xong.
- Bước 3: backend có API document/chunk; frontend user-facing document detail chưa xong.
- Bước 4: backend ask đã đúng hướng consumer; frontend ask-from-context chưa hoàn chỉnh.

Vì vậy, sản phẩm đang đúng hướng nhưng chưa đủ hoàn chỉnh như một portal user-facing đầy đủ.

## 9. Kết luận cuối

Dự án không đi sai hướng. Kiến trúc hiện tại đã chuyển đúng từ chatbot-centric sang knowledge-platform-centric.

Backend có thể chạy được ở mức dev/demo nếu env đúng. Frontend landing page đã đủ để bắt đầu demo định hướng sản phẩm, nhưng chưa đủ để gọi là sản phẩm hoàn chỉnh.

Điều kiện tối thiểu trước khi gọi là vận hành tốt:

- Xóa/thay hardcoded admin token ở frontend.
- Dùng Firebase Auth thật cho frontend protected flows.
- Chạy smoke admin và vector bắt buộc trong môi trường thật.
- Hoàn thiện search page và document detail user-facing.
- Chốt policy public/private document detail.

Khuyến nghị bước tiếp theo:

- Không quay lại làm chat trước.
- Làm tiếp user-facing search page và document detail.
- Sau đó mới nối ask AI từ document/search context.
