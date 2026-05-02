export const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? 0;
    this.detail = options.detail ?? null;
    this.data = options.data ?? null;
    this.url = options.url ?? "";
    this.method = options.method ?? "GET";
  }
}

export function getAuthHeaders(token) {
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
}

export function buildApiUrl(path, params) {
  const normalizedBase = API_BASE.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${normalizedBase}${normalizedPath}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
}

async function parseResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { detail: text } : null;
}

function normalizeErrorMessage(status, data) {
  const detail =
    typeof data === "string"
      ? data
      : data?.detail || data?.message || data?.error || null;

  if (status === 401) {
    return detail || "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.";
  }

  if (status === 403) {
    return detail || "Tài khoản hiện tại không có quyền truy cập tài nguyên này.";
  }

  if (status >= 500) {
    return detail || "Backend đang gặp lỗi nội bộ. Vui lòng thử lại sau.";
  }

  return detail || "Yêu cầu API không thành công.";
}

export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    params,
    body,
    headers = {},
    token,
    raw = false,
  } = options;

  const requestHeaders = {
    Accept: "application/json",
    ...getAuthHeaders(token),
    ...headers,
  };

  const init = {
    method,
    headers: requestHeaders,
  };

  if (body !== undefined && body !== null) {
    if (body instanceof FormData) {
      init.body = body;
      delete init.headers["Content-Type"];
    } else {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
  } else if (!init.headers["Content-Type"] && method !== "GET") {
    init.headers["Content-Type"] = "application/json";
  }

  const url = buildApiUrl(path, params);
  let response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new ApiError(
      `Không kết nối được backend tại ${API_BASE}. Kiểm tra backend đã chạy và VITE_API_URL đã đúng.`,
      {
        status: 0,
        detail: error.message,
        data: { cause: error.message },
        url,
        method,
      }
    );
  }

  if (raw) {
    if (!response.ok) {
      const errorData = await parseResponseBody(response);
      throw new ApiError(normalizeErrorMessage(response.status, errorData), {
        status: response.status,
        detail: errorData?.detail || null,
        data: errorData,
        url,
        method,
      });
    }
    return response;
  }

  const data = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(normalizeErrorMessage(response.status, data), {
      status: response.status,
      detail: data?.detail || null,
      data,
      url,
      method,
    });
  }

  return data;
}
