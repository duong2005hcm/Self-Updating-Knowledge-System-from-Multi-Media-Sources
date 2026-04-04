import React, { useMemo, useState, useEffect } from "react";
// Import các hàm từ service mới đã tối ưu
import {
  loginUser,
  registerUser,
  loginWithGoogle,
  loginWithPhone,
  verifyOTP
} from "../services/authService";
import LightRays from "./LightRays";

// Helper kiểm tra định dạng email
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s).trim());

export default function AuthPage({ onAuthed }) {
  const [mode, setMode] = useState("login"); // login | register | otp
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);

  const title = useMemo(() => {
    if (mode === "login") return "Đăng nhập";
    if (mode === "register") return "Đăng ký";
    return "Xác thực OTP";
  }, [mode]);

  // Reset lỗi khi chuyển chế độ
  // useEffect(() => {
  //   setError("");
  // }, [mode]);

  // useEffect(() => {
  //   const handle = async () => {
  //     const res = await handleGoogleRedirect();
  //     if (res?.ok) {
  //       onAuthed(res.user); // ✅ dùng cái này thay vì navigate
  //     }
  //   };
  //   handle();
  // }, []);

  // 1. Xử lý Google Login
  const handleGoogleLogin = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await loginWithGoogle();
      if (res.ok) {
        onAuthed(res.user);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError("Không thể mở cửa sổ đăng nhập Google.");
    } finally {
      setBusy(false);
    }
  };

  // 2. Xử lý Phone Login (Gửi mã SMS)
  const handlePhoneLogin = async () => {
    const phoneNumber = prompt("Nhập số điện thoại (VD: +84912345678):");
    if (!phoneNumber) return;

    setError("");
    setBusy(true);
    try {
      const res = await loginWithPhone(phoneNumber);
      if (res.ok) {
        setConfirmationResult(res.confirmation);
        setMode("otp");
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError("Lỗi hệ thống khi gửi SMS.");
    } finally {
      setBusy(false);
    }
  };

  // 3. Xác nhận mã OTP
  const submitOTP = async (e) => {
    e.preventDefault();
    if (otp.length < 6) return setError("Vui lòng nhập đủ 6 số.");

    setBusy(true);
    try {
      const res = await verifyOTP(confirmationResult, otp);
      if (res.ok) {
        onAuthed(res.user);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError("Mã OTP không hợp lệ hoặc đã hết hạn.");
    } finally {
      setBusy(false);
    }
  };

  // 4. Đăng nhập / Đăng ký Email truyền thống
  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isEmail(email)) return setError("Email không hợp lệ.");
    if (password.length < 6) return setError("Mật khẩu phải từ 6 ký tự.");
    if (mode === "register" && name.trim().length < 2) return setError("Vui lòng nhập họ tên.");

    setBusy(true);
    try {
      const res = mode === "login"
        ? await loginUser({ email, password })
        : await registerUser({ name, email, password });

      if (res.ok) {
        onAuthed(res.user);
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError("Không thể kết nối đến máy chủ.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <LightRays raysOrigin="top-center" raysColor="#04000d" followMouse />

      <div className="auth-card">
        <div className="auth-head">
          <div className="auth-brand">
            <div className="auth-dot" />
            <div>
              <div className="auth-app">RAG AI</div>
              <div className="auth-sub">Secure Authentication System</div>
            </div>
          </div>

          {mode !== "otp" && (
            <div className="auth-tabs">
              <button
                className={`auth-tab ${mode === "login" ? "is-active" : ""}`}
                onClick={() => setMode("login")}
              >
                Đăng nhập
              </button>
              <button
                className={`auth-tab ${mode === "register" ? "is-active" : ""}`}
                onClick={() => setMode("register")}
              >
                Đăng ký
              </button>
            </div>
          )}
        </div>

        <h1 className="auth-title">{title}</h1>

        {mode !== "otp" ? (
          <form className="auth-form" onSubmit={submit}>
            {mode === "register" && (
              <label className="auth-field">
                <span>Họ và tên</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nhập tên của bạn"
                  required
                />
              </label>
            )}
            <label className="auth-field">
              <span>Địa chỉ Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
              />
            </label>
            <label className="auth-field">
              <span>Mật khẩu</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>

            {error && <div className="auth-error">{error}</div>}

            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? "Vui lòng đợi..." : title}
            </button>

            <div className="auth-divider"><span>Hoặc đăng nhập bằng</span></div>

            <div className="auth-social-group">
              <button type="button" className="auth-social-btn google" onClick={handleGoogleLogin} disabled={busy}>
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24s.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                Google
              </button>
              <button type="button" className="auth-social-btn phone" onClick={handlePhoneLogin} disabled={busy}>
                <span>📱</span> Phone
              </button>
            </div>
          </form>
        ) : (
          <form className="auth-form" onSubmit={submitOTP}>
            <p className="auth-help-text">Nhập mã 6 chữ số vừa gửi tới điện thoại của bạn.</p>
            <label className="auth-field">
              <span>Mã OTP</span>
              <input
                className="otp-input"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                maxLength={6}
                autoFocus
              />
            </label>
            {error && <div className="auth-error">{error}</div>}
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? "Đang xác nhận..." : "Xác nhận OTP"}
            </button>
            <button type="button" className="auth-back-btn" onClick={() => setMode("login")}>
              ← Quay lại
            </button>
          </form>
        )}

        <div className="auth-foot">
          <p>Bản quyền &copy; 2026 RAG AI System.</p>
        </div>
      </div>

      {/* Container cho Google/Phone Recaptcha */}
      <div id="recaptcha-container"></div>
    </div>
  );
}