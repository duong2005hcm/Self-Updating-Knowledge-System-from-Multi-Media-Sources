import axios from "axios";
import { auth } from "../auth/firebase";
import { DEFAULT_SYSTEM_PROMPT, getSystemPrompt } from "../chat/systemPrompt";

const DEPLOY_AUTH_API = "https://self-updating-knowledge-system-from-98qj.onrender.com";
const DEPLOY_RAG_API = "https://self-updating-knowledge-system-from.onrender.com";

function resolveNodeApiBase() {
  const fallback = import.meta.env.PROD ? DEPLOY_AUTH_API : "http://localhost:5001";
  const raw =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_AUTH_API ||
    fallback;

  try {
    const url = new URL(String(raw).trim());
    if (url.port === "6000") {
      return fallback.replace(/\/$/, "");
    }
    return url.origin.replace(/\/$/, "");
  } catch {
    return fallback.replace(/\/$/, "");
  }
}

/** Backend Node (proxy RAG + auth). Ưu tiên VITE_API_URL. */
export function getApiBaseUrl() {
  return resolveNodeApiBase();
}

/** FastAPI trực tiếp — các route chưa proxy qua Node (documents, …). */
function getRagDirectUrl() {
  return (
    import.meta.env.VITE_RAG_API ||
    (import.meta.env.PROD ? DEPLOY_RAG_API : "http://localhost:8000")
  ).replace(/\/$/, "");
}

const AUTH_URL = getApiBaseUrl();
const RAG_URL = getRagDirectUrl();

/** Axios â†’ Node: /api/ask, ingest, user upload */
const ragNodeClient = axios.create({
  baseURL: AUTH_URL,
  timeout: 120000,
});

ragNodeClient.interceptors.request.use((config) => {
  const token = getRagaiToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Thông báo lỗi thân thiện cho UI (Toast / bubble chat).
 */
export function friendlyApiError(err) {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data?.code === "RAG_UPSTREAM_EMPTY_INPUT") {
      return "Dịch vụ RAG Python đang lỗi nội bộ (empty input ở upstream). Hãy kiểm tra hoặc deploy lại backend Python.";
    }
    let detailFirst = null;
    if (Array.isArray(data?.detail) && data.detail.length) {
      const d0 = data.detail[0];
      detailFirst = typeof d0 === "string" ? d0 : d0?.msg ?? null;
    }
    const msg =
      (typeof data?.message === "string" && data.message) ||
      (typeof data?.detail === "string" && data.detail) ||
      detailFirst ||
      null;
    if (msg) return msg;
    if (err.response?.status === 401) {
      return "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.";
    }
    if (err.response?.status === 502) {
      return "Máy chủ AI tạm không phản hồi. Vui lòng thử lại sau.";
    }
    if (err.code === "ECONNABORTED") {
      return "Hết thời gian chờ phản hồi. Thử lại với câu hỏi ngắn hơn hoặc kiểm tra mạng.";
    }
    if (!err.response) {
      return "Không kết nối được tới máy chủ. Hãy chắc backend Node đang chạy (VITE_API_URL).";
    }
    return `Lỗi dịch vụ (${err.response.status}). Vui lòng thử lại.`;
  }
  const m = err?.message;
  return m && String(m).trim() ? String(m) : "Đã có lỗi xảy ra.";
}

// --- Service layer: RAG qua Node (axios) ---

const RAG_CONV_SESSION_KEY = "ragai_rag_conversation_id";

function resolveSystemPrompt() {
  const raw = getSystemPrompt();
  const normalized = typeof raw === "string" ? raw.trim() : "";
  return normalized || DEFAULT_SYSTEM_PROMPT;
}

/**
 * conversation_id: ưu tiên ID hội thoại từ UI; nếu không có thì một UUID lưu trong sessionStorage.
 */
function getConversationIdForAsk(uiConversationId) {
  const raw =
    uiConversationId != null ? String(uiConversationId).trim() : "";
  const invalid =
    !raw || raw === "default" || raw === "default_session";
  if (!invalid) return raw;

  try {
    let cid = sessionStorage.getItem(RAG_CONV_SESSION_KEY);
    if (!cid) {
      cid =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `conv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem(RAG_CONV_SESSION_KEY, cid);
    }
    return cid;
  } catch {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `conv-${Date.now()}`;
  }
}

/**
 * POST /api/ask — Firebase UID + conversation_id; JWT Node vẫn bắt buộc.
 * @param {string} question
 * @param {string} [conversationIdFromUi] — id luồng chat trong app (ChatPage)
 * @param {unknown[]} [history] — lịch sử gửi kèm (mặc định [])
 */
export async function askAI(question, conversationIdFromUi, history) {
  const q =
    question === undefined || question === null ? "" : String(question).trim();
  if (!q) {
    throw new Error("Vui lòng nhập câu hỏi trước khi gửi.");
  }

  const firebaseUser = auth.currentUser;
  if (!firebaseUser?.uid) {
    throw new Error(
      "Bạn cần đăng nhập (Firebase) trước khi chat. Vui lòng đăng nhập lại."
    );
  }

  const uid = firebaseUser.uid;
  const conversation_id = getConversationIdForAsk(conversationIdFromUi);
  const hist = Array.isArray(history) ? history : [];

  const payload = {
    question: q,
    session_id: uid,
    user_id: uid,
    conversation_id,
    system_prompt: resolveSystemPrompt(),
  };
  if (hist.length > 0) {
    payload.history = hist;
  }
  console.log("Frontend Payload:", payload);

  const { data } = await ragNodeClient.post("/api/ask", payload, {
    timeout: 120000,
    headers: { "Content-Type": "application/json" },
  });
  return data;
}

/** Alias tương thích code cũ (đối số 2 = conversation / session UI id). */
export async function askRAG(question, sessionId = "default") {
  return askAI(question, sessionId, undefined);
}

/**
 * POST /api/admin/ingest/pdf — multipart, field `file`.
 */
function normalizeIngestOptions(options = {}, defaultSourceType = "Web") {
  return {
    domain: String(options.domain || "general").trim() || "general",
    topic: String(options.topic || "general").trim() || "general",
    priority: String(options.priority || "normal").trim() || "normal",
    status: String(options.status || "active").trim() || "active",
    source_type: String(options.source_type || options.sourceType || defaultSourceType).trim() || defaultSourceType,
    created_by: String(options.created_by || options.createdBy || "").trim(),
  };
}

export async function ingestPDF(file, options = {}) {
  const formData = new FormData();
  formData.append("file", file);
  const metadata = normalizeIngestOptions(options, "PDF");
  formData.append("domain", metadata.domain);
  formData.append("topic", metadata.topic);
  formData.append("priority", metadata.priority);
  formData.append("status", metadata.status);
  formData.append("source_type", metadata.source_type);
  if (metadata.created_by) {
    formData.append("created_by", metadata.created_by);
  }
  const headers = await getAdminProxyHeaders();
  delete headers["Content-Type"];
  const { data } = await ragNodeClient.post("/api/admin/ingest/pdf", formData, {
    timeout: 300000,
    headers,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  return data;
}

/** Alias tên cũ trong Ingest_doc. */
export const ingestDoc = ingestPDF;

/**
 * POST /api/admin/ingest/web — body { url }.
 */
export async function ingestWeb(url, limit = 5, options = {}) {
  const metadata = normalizeIngestOptions(options, "Web");
  const headers = await getAdminProxyHeaders();
  const { data } = await ragNodeClient.post(
    "/api/admin/ingest/web",
    {
      url,
      limit: Number(limit) || 5,
      domain: metadata.domain,
      topic: metadata.topic,
      priority: metadata.priority,
      status: metadata.status,
      source_type: metadata.source_type,
      ...(metadata.created_by ? { created_by: metadata.created_by } : {}),
    },
    { timeout: 300000, headers }
  );
  return data;
}

/**
 * POST /api/user/upload/pdf — user tự upload PDF (multipart, field `file`).
 */
export async function uploadUserPDF(file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await ragNodeClient.post("/api/user/upload/pdf", formData, {
    timeout: 300000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  return data;
}

// --- RAG trực tiếp FastAPI (chưa có proxy Node) ---

function getRagaiToken() {
  const token = localStorage.getItem("ragai_token");
  return typeof token === "string" ? token.trim() : "";
}

const getHeaders = (isMultipart = false) => {
  const token = getRagaiToken();
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (!isMultipart) headers["Content-Type"] = "application/json";
  return headers;
};

async function getAdminProxyHeaders() {
  const nodeToken = getRagaiToken();
  if (!nodeToken) {
    throw new Error("Thiếu ragai_token. Vui lòng đăng nhập lại.");
  }
  const firebaseToken = await getFirebaseIdTokenForAdminPrompts();
  return {
    Authorization: `Bearer ${nodeToken}`,
    "X-Firebase-Id-Token": firebaseToken,
    "Content-Type": "application/json",
  };
}

export async function getKnowledgeList() {
  const headers = await getAdminProxyHeaders();
  const res = await fetch(`${AUTH_URL}/api/admin/knowledge/list`, {
    method: "GET",
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || "Khong tai duoc danh sach");
  }
  return {
    ...data,
    documents: Array.isArray(data?.documents) ? data.documents : [],
  };
}

export async function deleteKnowledge(docId) {
  const headers = await getAdminProxyHeaders();
  const res = await fetch(`${AUTH_URL}/api/admin/knowledge/${encodeURIComponent(docId)}`, {
    method: "DELETE",
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || "Xóa tài liệu thất bại");
  }
  return data;
}

export async function updateKnowledge(docId, payload) {
  const headers = await getAdminProxyHeaders();
  const res = await fetch(`${AUTH_URL}/api/admin/knowledge/update/${encodeURIComponent(docId)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || "Không cập nhật được tài liệu");
  }
  return data;
}

export async function getKnowledgeCollections() {
  const headers = await getAdminProxyHeaders();
  const res = await fetch(`${AUTH_URL}/api/admin/knowledge/collections`, {
    method: "GET",
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || "Khong tai duoc collections");
  }
  return data;
}

export async function getKnowledgeGrouped(collectionName, params = {}) {
  const headers = await getAdminProxyHeaders();
  const query = new URLSearchParams(params).toString();
  const suffix = query ? `?${query}` : "";
  const res = await fetch(
    `${AUTH_URL}/api/admin/knowledge/${encodeURIComponent(collectionName)}/grouped${suffix}`,
    { method: "GET", headers }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || "Khong tai duoc grouped knowledge");
  }
  return data;
}
export async function getKnowledgeSources(collectionName, params = {}) {
  const headers = await getAdminProxyHeaders();
  const query = new URLSearchParams(params).toString();
  const suffix = query ? `?${query}` : "";
  const res = await fetch(
    `${AUTH_URL}/api/admin/knowledge/${encodeURIComponent(collectionName)}/sources${suffix}`,
    { method: "GET", headers }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || "Khong tai duoc sources");
  }
  return data;
}

export async function getKnowledgeChunks(collectionName, params = {}) {
  const headers = await getAdminProxyHeaders();
  const query = new URLSearchParams(params).toString();
  const suffix = query ? `?${query}` : "";
  const res = await fetch(
    `${AUTH_URL}/api/admin/knowledge/${encodeURIComponent(collectionName)}/chunks${suffix}`,
    { method: "GET", headers }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || "Khong tai duoc chunks");
  }
  return data;
}

async function getFirebaseIdTokenForAdminPrompts() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Bạn cần đăng nhập Firebase trước khi quản lý system prompt.");
  }
  return user.getIdToken();
}

async function requestAdminPrompts(path, options = {}) {
  const { method = "GET", body } = options;
  const headers = await getAdminProxyHeaders();

  const res = await fetch(`${AUTH_URL}/api/admin/prompts${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || `Prompt API error (${res.status})`);
  }
  return data;
}

export async function adminPromptListScopes() {
  return requestAdminPrompts("/scopes");
}

export async function adminPromptGetScope(scope) {
  return requestAdminPrompts(`/${encodeURIComponent(scope)}`);
}

export async function adminPromptListVersions(scope, limit = 20) {
  return requestAdminPrompts(
    `/${encodeURIComponent(scope)}/versions?limit=${Math.max(1, Math.min(100, Number(limit) || 20))}`
  );
}

export async function adminPromptSave(scope, content, note = "Updated from Admin Dashboard") {
  const draft = await requestAdminPrompts(`/${encodeURIComponent(scope)}/draft`, {
    method: "POST",
    body: { content, note },
  });
  const version = draft?.version;
  if (!version) {
    throw new Error("Draft created but missing version");
  }

  return requestAdminPrompts(`/${encodeURIComponent(scope)}/publish`, {
    method: "POST",
    body: { version, note },
  });
}

// --- Auth & admin (Node) — fetch giữ nguyên, cùng base AUTH_URL ---

export async function adminGetUsers() {
  const res = await fetch(`${AUTH_URL}/api/auth/admin/users`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Không có quyền Admin");
  return await res.json();
}

export async function adminGetStats() {
  const res = await fetch(`${AUTH_URL}/api/auth/admin/stats`, {
    method: "GET",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Không lấy được thống kê");
  return await res.json();
}

export async function adminGetLoginAnalytics(period) {
  const res = await fetch(
    `${AUTH_URL}/api/auth/admin/stats/login-analytics?period=${encodeURIComponent(period)}`,
    { method: "GET", headers: getHeaders() }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Không tải phân tích đăng nhập");
  return data;
}

export async function adminGetTokenDaily(days = 14) {
  const res = await fetch(
    `${AUTH_URL}/api/auth/admin/stats/token-daily?days=${days}`,
    { method: "GET", headers: getHeaders() }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Không tải thống kê token");
  return data;
}

export async function adminGetIngestDaily(days = 14) {
  const res = await fetch(
    `${AUTH_URL}/api/auth/admin/stats/ingest-daily?days=${days}`,
    { method: "GET", headers: getHeaders() }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Không tải được hoạt động ingest");
  return data;
}

export async function logTokens(tokens) {
  const n = Math.max(0, Math.floor(Number(tokens) || 0));
  if (n <= 0) return;
  try {
    await fetch(`${AUTH_URL}/api/auth/log-tokens`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ tokens: n }),
    });
  } catch {
    /* ignore */
  }
}

export async function syncUserChats(payload) {
  try {
    await fetch(`${AUTH_URL}/api/auth/user/chats/sync`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
  } catch {
    /* ignore */
  }
}

export async function adminGetUserChats(userId) {
  const res = await fetch(`${AUTH_URL}/api/auth/admin/users/${userId}/chats`, {
    method: "GET",
    headers: getHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Không đọc được lịch sử");
  return data;
}

export async function adminResetPassword(userId) {
  const res = await fetch(`${AUTH_URL}/api/auth/admin/users/${userId}/reset-password`, {
    method: "POST",
    headers: getHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Reset thất bại");
  return data;
}

export async function logQuestionAsked() {
  try {
    await fetch(`${AUTH_URL}/api/auth/log-question`, {
      method: "POST",
      headers: getHeaders(),
    });
  } catch {
    /* ignore */
  }
}

export async function adminCreateUser({ email, password, displayName, role = "user" }) {
  const res = await fetch(`${AUTH_URL}/api/auth/admin/users`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ email, password, displayName, role }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Không thêm được người dùng");
  }
  return data;
}

export async function adminUpdateUser(uid, data) {
  const res = await fetch(`${AUTH_URL}/api/auth/admin/users/${uid}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.message || "Cập nhật thất bại");
  return out;
}

export async function adminDeleteUser(uid) {
  const res = await fetch(`${AUTH_URL}/api/auth/admin/users/${uid}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.message || "Xóa thất bại");
  return out;
}


