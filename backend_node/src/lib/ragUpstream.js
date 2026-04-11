const axios = require("axios");

/**
 * URL FastAPI RAG. Local: RAG_PYTHON_URL=http://localhost:8000
 * Mặc định Render (cold start có thể chậm / lỗi tạm thời).
 */
const RAG_BASE_URL = (
  process.env.RAG_PYTHON_URL || "https://self-updating-knowledge-system-from.onrender.com"
).replace(/\/$/, "");

/**
 * FastAPI thường không xác thực Bearer JWT của Node.
 * Chỉ gửi Authorization sang Python khi RAG_FORWARD_AUTHORIZATION=true
 */
function optionalAuthHeaders(req) {
  if (process.env.RAG_FORWARD_AUTHORIZATION !== "true") {
    return {};
  }
  const h = {};
  if (req.headers.authorization) {
    h.Authorization = req.headers.authorization;
  }
  return h;
}

function log(direction, tag, payload) {
  const stamp = new Date().toISOString();
  console.log(`[RAG ${direction}] ${stamp} ${tag}`, payload);
}

/**
 * Trả về đúng status + body từ Python (4xx/5xx không còn bị đổi thành 502).
 */
function mirrorPythonResponse(res, axResponse, tag) {
  const status = axResponse.status;
  const data = axResponse.data;
  log("←", tag, { status, ok: status >= 200 && status < 300 });

  if (data === undefined || data === null) {
    return res.status(status).end();
  }
  if (typeof data === "object") {
    return res.status(status).json(data);
  }
  return res.status(status).send(String(data));
}

/**
 * Chỉ dùng khi không nhận được phản hồi HTTP từ Python (mạng, timeout, từ chối kết nối).
 */
function sendPythonOffline(res, err, contextTag) {
  if (err.response) {
    return mirrorPythonResponse(res, err.response, contextTag);
  }
  log("←", contextTag, { code: err.code, message: err.message });
  return res.status(502).json({ message: "RAG Python Server is offline" });
}

module.exports = {
  axios,
  RAG_BASE_URL,
  optionalAuthHeaders,
  log,
  mirrorPythonResponse,
  sendPythonOffline,
};
