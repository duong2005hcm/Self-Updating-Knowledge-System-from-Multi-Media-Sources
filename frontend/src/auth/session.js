const SESSION_KEY = "ragai_session_v1";

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setSession(user) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      name: user?.name || user?.email?.split("@")?.[0] || "User",
      email: user?.email,
    })
  );
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

