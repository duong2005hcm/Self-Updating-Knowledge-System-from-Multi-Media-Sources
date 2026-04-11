//const API_URL = "/api/auth"; // Dùng relative path để Vite Proxy xử lý
function resolveAuthApiUrl() {
  const fallback = import.meta.env.PROD
    ? "https://self-updating-knowledge-system-from-6dk8.onrender.com"
    : "http://localhost:5001";
  const raw =
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_AUTH_API ||
    fallback;
  try {
    const url = new URL(String(raw).trim());
    if (url.port === "6000") return `${fallback}/api/auth`;
    return `${url.origin}/api/auth`;
  } catch {
    return `${fallback}/api/auth`;
  }
}

const API_URL = resolveAuthApiUrl();

export async function registerUser({ name, email, password }) {
  try {
    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (data.token) localStorage.setItem("ragai_token", data.token);
    return { ok: res.ok, ...data };
  } catch (error) {
    return { ok: false, message: "Không thể kết nối đến server." };
  }
}

export async function loginUser({ email, password }) {
  try {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.token) localStorage.setItem("ragai_token", data.token);
    return { ok: res.ok, ...data };
  } catch (error) {
    return { ok: false, message: "Lỗi kết nối server." };
  }
}

export async function loginWithFirebase(idToken) {
  try {
    const res = await fetch(`${API_URL}/firebase-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json();
    if (data.token) localStorage.setItem("ragai_token", data.token);
    return { ok: res.ok, ...data };
  } catch (error) {
    return { ok: false, message: "Lỗi xác thực Firebase." };
  }
}
