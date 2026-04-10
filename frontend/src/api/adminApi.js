import axios from "axios";
import axiosClient from "./axiosClient.js";

function resolveAuthUrl() {
  const fallback = import.meta.env.PROD
    ? "https://self-updating-knowledge-system-from-6dk8.onrender.com"
    : "http://localhost:6001";
  const raw =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_AUTH_API ||
    fallback;
  try {
    const url = new URL(String(raw).trim());
    if (url.port === "6000") return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}

const AUTH_URL = resolveAuthUrl();

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("ragai_token")}`,
});

/**
 * Lớp axios cho endpoint admin/auth (URL tuyệt đối).
 * Gọi RAG/knowledge qua axiosClient (base VITE_RAG_API).
 */
const adminApi = {
  getAllUsers: () =>
    axios.get(`${AUTH_URL}/api/auth/admin/users`, { headers: authHeaders() }),

  updateUserRole: (userId, role) =>
    axios.put(
      `${AUTH_URL}/api/auth/admin/users/${userId}`,
      { role },
      { headers: { ...authHeaders(), "Content-Type": "application/json" } }
    ),

  uploadDocument: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return axiosClient.post("/admin/knowledge/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  getDocuments: (params) => axiosClient.get("/admin/knowledge/list", { params }),

  deleteDocument: (docId) => axiosClient.delete(`/admin/knowledge/${docId}`),

  searchKnowledge: (query) =>
    axiosClient.post("/admin/knowledge/search", { query }),
};

export default adminApi;
