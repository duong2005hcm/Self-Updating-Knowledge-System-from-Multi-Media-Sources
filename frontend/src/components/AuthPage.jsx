import React, { useMemo, useState } from "react";
import { loginUser, registerUser } from "../auth/users";

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());
}

export default function AuthPage({ onAuthed }) {
  const [mode, setMode] = useState("login"); // login | register
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const title = useMemo(
    () => (mode === "login" ? "Đăng nhập" : "Đăng ký"),
    [mode]
  );

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim();
    const cleanPassword = password;
    const cleanName = name.trim();

    if (!isEmail(cleanEmail)) return setError("Email không hợp lệ.");
    if (cleanPassword.length < 4) return setError("Mật khẩu tối thiểu 4 ký tự.");
    if (mode === "register" && cleanName.length < 2)
      return setError("Tên tối thiểu 2 ký tự.");

    setBusy(true);
    try {
      const res =
        mode === "login"
          ? loginUser({ email: cleanEmail, password: cleanPassword })
          : registerUser({ name: cleanName, email: cleanEmail, password: cleanPassword });

      if (!res.ok) return setError(res.message || "Có lỗi xảy ra.");
      onAuthed(res.user);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" role="dialog" aria-label="Authentication">
        <div className="auth-head">
          <div className="auth-brand">
            <div className="auth-dot" aria-hidden="true" />
            <div>
              <div className="auth-app">RAG AI</div>
              <div className="auth-sub">Đăng nhập để bắt đầu chat</div>
            </div>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Auth mode">
            <button
              type="button"
              className={`auth-tab ${mode === "login" ? "is-active" : ""}`}
              onClick={() => setMode("login")}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === "register" ? "is-active" : ""}`}
              onClick={() => setMode("register")}
            >
              Đăng ký
            </button>
          </div>
        </div>

        <h1 className="auth-title">{title}</h1>

        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && (
            <label className="auth-field">
              <span>Họ tên</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Admin"
                autoComplete="name"
              />
            </label>
          )}

          <label className="auth-field">
            <span>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              inputMode="email"
              autoComplete="email"
            />
          </label>

          <label className="auth-field">
            <span>Mật khẩu</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>

          {error && <div className="auth-error">{error}</div>}

          <button className="auth-submit" disabled={busy}>
            {busy ? "Đang xử lý..." : title}
          </button>
        </form>

        <div className="auth-foot">
          <span className="auth-foot-muted">
            (Demo FE) Tài khoản lưu trong trình duyệt của bạn.
          </span>
        </div>
      </div>
    </div>
  );
}

