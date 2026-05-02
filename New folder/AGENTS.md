# AGENTS.md

## Purpose

This repository is being refactored from an **internal RAG chatbot backend** into a **multi-source knowledge management and retrieval platform**.

Codex must treat this as a **knowledge-first system**, not a chat-first system.

The existing chat flow is still useful, but it is now a **secondary feature** built on top of the knowledge platform.

---

## Core product direction

The target system is:

- a platform to **collect knowledge from multiple sources**
- **normalize and structure** that knowledge
- **store and update** it incrementally
- **govern** source and document lifecycle
- support **search, browsing, analytics, and AI Q&A with citations**

The target system is **not**:
- just a chatbot
- just an `/api/ask` flow
- just Chroma chunks for RAG answers
- just prompt tuning for better chat UX

---

## Priority order

When choosing what to build or refactor, use this order:

1. source registry
2. document lifecycle
3. versioning + dedup
4. ingest jobs / pipeline tracking
5. search independent from chat
6. governance / approval / status management
7. analytics / feedback
8. ask/chat as a consumer of the knowledge layer

If there is a tradeoff between improving chat and improving the knowledge platform, **prioritize the knowledge platform**.

---

## Repository rules for Codex

### 1. Do not rewrite the whole codebase
Preserve working infrastructure when possible.

Keep and reuse:
- FastAPI app/router structure
- Firebase auth and admin claims
- OpenAI client factory
- Chroma integration
- existing ingest foundation
- existing admin knowledge foundation
- existing ask/chat route unless a change is required

### 2. Do not make chat the architectural center
`/api/ask` must remain functional, but must not stay the conceptual center of the system.

Chat should become:
- one access path to knowledge
- one consumer of retrieval
- one UI feature among several

### 3. Move toward document-centric and source-centric design
Do not keep adding logic that is only chunk-centric or conversation-centric.

Prefer explicit models for:
- Source
- Document
- DocumentVersion
- IngestJob
- Feedback
- Chunk

### 4. Put business logic in services
Routes should stay thin.

Prefer:
- validation
- auth
- request parsing
- service calls
- response shaping

Avoid burying core lifecycle logic directly inside API route files.

### 5. Favor incremental ingest
Do not design ingest as repeated blind re-embedding of everything.

Prefer:
- checksum/hash
- dedup
- versioning
- skip unchanged content
- job tracking
- deactivation/archive for old versions where appropriate

### 6. Search must work without chat
Users must be able to:
- search documents
- browse document details
- filter by source/domain/type/status
- inspect source and metadata

without using the ask/chat flow.

### 7. Admin means knowledge operations
Admin is not only for prompt management.

Admin must be able to manage:
- sources
- documents
- ingest jobs
- governance status
- duplicates/outdated items
- analytics
- feedback

---

## Firebase guidance

Firebase is allowed and should remain in use where it fits.

Good uses:
- Firebase Authentication
- admin custom claims
- prompt registry
- lightweight settings
- lightweight logs / audit trail
- lightweight feedback metadata

Do not force Firebase to handle everything if business metadata becomes too relational or complex.

Current storage direction:
- Firebase Auth stays
- Firestore may stay for lightweight metadata
- ChromaDB remains the vector store
- raw files may stay in local/object storage
- if business metadata becomes too complex, a relational store may be added later

---

## File-level guidance

### Existing chat files
Examples:
- `src/backend/app/api/ask.py`
- `src/backend/app/rag/memory/chat_memory.py`
- `src/backend/app/api/user_upload.py`

Rule:
- keep working behavior if possible
- reduce coupling to conversation-only flows over time
- do not expand casual chat features before knowledge-centric refactor is complete

### Existing ingest files
Examples:
- `src/backend/app/api/ingest_admin.py`
- `src/backend/app/api/ingests_doc.py`
- `src/backend/app/api/ingests_web.py`
- `src/backend/app/rag/ingestion/embedding_store.py`

Rule:
- refactor these toward document lifecycle and incremental sync
- ensure chunk metadata carries document/source/version identifiers
- avoid one-off metadata patterns in each route

### Existing admin knowledge files
Examples:
- `src/backend/app/api/admin_knowledge.py`

Rule:
- evolve from chunk browser to governance-oriented admin module
- add document-first views and source-first views
- keep chunk-level inspection as a lower-level detail, not the main abstraction

---

## Expected product behavior after refactor

The system should still support AI Q&A, but its primary value should remain visible even if chat is removed.

If chat disappeared, the platform should still provide:
- source management
- ingest automation
- document repository
- versioning
- search
- governance
- analytics
- knowledge browsing

If a change makes the system more dependent on chat, reconsider that change.

---

## Planning and supporting documents

For detailed migration steps, read:
- `TASKS.md`
- `codex_system_transition_brief.md`

When working on large changes:
- follow the phase order in `TASKS.md`
- prefer completing one phase cleanly before starting the next

---

## Definition of success

A successful refactor means:

- the repo is no longer centered on chat
- the knowledge layer is explicit and reusable
- source/document/version/job concepts exist clearly
- search is independent from ask
- admin manages knowledge operations, not only prompts or chunks
- chat remains available as a feature built on top of the platform

