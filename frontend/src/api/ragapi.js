import { getSystemPrompt } from "../chat/systemPrompt.js";

const DEPLOY_AUTH_API = "https://self-updating-knowledge-system-from-6dk8.onrender.com";
const DEPLOY_RAG_API = "https://self-updating-knowledge-system-from.onrender.com";

const AUTH_URL =
  import.meta.env.VITE_AUTH_API ||
  (import.meta.env.PROD ? DEPLOY_AUTH_API : "http://localhost:5000");
const RAG_URL =
  import.meta.env.VITE_RAG_API ||
  (import.meta.env.PROD ? DEPLOY_RAG_API : "http://localhost:8000");

/**
 * Helper: Tự động lấy header kèm Token xác thực.
 * Đảm bảo key 'ragai_token' trùng với key bạn lưu khi đăng nhập.
 */
const getHeaders = (isMultipart = false) => {
  const token = localStorage.getItem("ragai_token");
  const headers = {
    Authorization: `Bearer ${token}`,
  };
  if (!isMultipart) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
};

// --- CHỨC NĂNG RAG (GỌI FASTAPI - PORT 8000) ---

export async function askRAG(question, sessionId = "default") {
  const system_prompt = getSystemPrompt();
  const body = { question, session_id: sessionId };
  if (system_prompt && String(system_prompt).trim()) {
    body.system_prompt = String(system_prompt).trim();
  }
  const res = await fetch(`${RAG_URL}/api/ask`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Lỗi kết nối AI");
  return await res.json();
}

export async function ingestDoc(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${RAG_URL}/api/admin/ingest/pdf`, {
    method: "POST",
    headers: getHeaders(true),
    body: formData,
  });
  return await res.json();
}

export async function getKnowledgeList() {
  const res = await fetch(`${RAG_URL}/api/admin/documents`, {
    method: "GET",
    headers: getHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || "Không tải được danh sách");
  }
  return data;
}

export async function deleteKnowledge(docId) {
  const res = await fetch(`${RAG_URL}/api/admin/documents/${docId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || "Xóa tài liệu thất bại");
  }
  return data;
}

/** Cập nhật metadata tài liệu trên ChromaDB (FastAPI: PUT /api/admin/documents/{id}). */
export async function updateKnowledge(docId, payload) {
  const res = await fetch(`${RAG_URL}/api/admin/documents/${docId}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || data.message || "Không cập nhật được tài liệu");
  }
  return data;
}

// --- CHỨC NĂNG AUTH & ADMIN (GỌI NODE.JS - PORT 5000) ---

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

/** Gọi sau mỗi câu hỏi RAG thành công để tăng bộ đếm phía server (Firestore). */
export async function logQuestionAsked() {
  try {
    await fetch(`${AUTH_URL}/api/auth/log-question`, {
      method: "POST",
      headers: getHeaders(),
    });
  } catch {
    /* bỏ qua — không chặn luồng chat */
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

export async function ingestWeb(url) {
  const res = await fetch(`${RAG_URL}/api/admin/ingest/web`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ url: url }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || "Lỗi khi ingest website");
  }

  return await res.json();
}
