import React, { useMemo, useState } from "react";
import { loginUser, registerUser } from "../auth/users";
import LightRays from "./LightRays";

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

export default function AuthPage({
  onAuthed,
  onBack,
  subtitle = "Đăng nhập để tiếp tục khai thác tri thức",
}) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const title = useMemo(
    () => (mode === "login" ? "Đăng nhập" : "Đăng ký"),
    [mode]
  );

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    const cleanEmail = email.trim();
    const cleanPassword = password;
    const cleanName = name.trim();

    if (!isEmail(cleanEmail)) {
      setError("Email không hợp lệ.");
      return;
    }
    if (cleanPassword.length < 4) {
      setError("Mật khẩu tối thiểu 4 ký tự.");
      return;
    }
    if (mode === "register" && cleanName.length < 2) {
      setError("Tên tối thiểu 2 ký tự.");
      return;
    }

    setBusy(true);
    try {
      const result =
        mode === "login"
          ? loginUser({ email: cleanEmail, password: cleanPassword })
          : registerUser({
              name: cleanName,
              email: cleanEmail,
              password: cleanPassword,
            });

      if (!result.ok) {
        setError(result.message || "Có lỗi xảy ra.");
        return;
      }

      onAuthed?.(result.user);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <LightRays
        raysOrigin="top-center"
        raysColor="#04000d"
        raysSpeed={1}
        lightSpread={1}
        rayLength={2}
        followMouse
        mouseInfluence={0.1}
      />

      <div className="auth-card" role="dialog" aria-label="Authentication">
        <div className="auth-head">
          <div className="auth-brand">
            <div className="auth-dot" />
            <div>
              <div className="auth-app">SIMLESI AI</div>
              <div className="auth-sub">{subtitle}</div>
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
          {mode === "register" ? (
            <label className="auth-field">
              <span>Họ tên</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="VD: Nguyen Van A"
                autoComplete="name"
              />
            </label>
          ) : null}

          <label className="auth-field">
            <span>Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="user@example.com"
              inputMode="email"
              autoComplete="email"
            />
          </label>

          <label className="auth-field">
            <span>Mật khẩu</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="••••"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>

          {error ? <div className="auth-error">{error}</div> : null}

          <button className="auth-submit" disabled={busy}>
            {busy ? "Đang xử lý..." : title}
          </button>
        </form>

        <div className="auth-foot">
          {onBack ? (
            <button type="button" className="auth-back" onClick={onBack}>
              Quay lại landing page
            </button>
          ) : null}
          <span className="auth-foot-muted">
            Bản quyền © 2024 - SIMLESI AI. All rights reserved.
          </span>
        </div>
      </div>
    </div>
  );
}
