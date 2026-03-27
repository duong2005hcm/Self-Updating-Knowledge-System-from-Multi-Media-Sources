const API_URL = "/api/auth"; // Dùng relative path để Vite Proxy xử lý

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