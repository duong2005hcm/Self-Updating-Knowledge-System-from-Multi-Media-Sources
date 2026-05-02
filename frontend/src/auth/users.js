const USERS_KEY = "ragai_users_v1";

function readUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function registerUser({ name, email, password }) {
  const users = readUsers();
  const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return { ok: false, message: "Email đã được đăng ký." };
  }
  const next = [
    ...users,
    { id: crypto?.randomUUID?.() ?? `${Date.now()}`, name, email, password },
  ];
  writeUsers(next);
  return { ok: true, user: { name, email } };
}

export function loginUser({ email, password }) {
  const users = readUsers();
  const user = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );
  if (!user) return { ok: false, message: "Sai email hoặc mật khẩu." };
  return { ok: true, user: { name: user.name, email: user.email } };
}

